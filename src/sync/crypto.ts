/**
 * Encryption for sync (Senuma 2.1, phase 1: not used by the product yet). WebCrypto only; no
 * network, no storage.
 *
 *   recovery key (160 random bits, shown to the person)
 *        └─ HKDF-SHA-256, per-key salt, bound to account and key id ─▶ wrapping key
 *                                                                        └─ wraps ─▶ workspace key (AES-256-GCM)
 *   workspace key ─ encrypts ─▶ gzip(JSON) padded to 1 kB steps, bound to account, document, key id and revision
 *
 * What a server holding the output can and cannot do is pinned by crypto.test.ts. It is not
 * protection against the code that runs this: a malicious build could read everything.
 */

export const FORMAT = 1;
/** Largest encrypted document sync will write. Firestore's own limit is 1 MiB per document. */
export const PAYLOAD_LIMIT = 512 * 1024;
/** Encrypted sizes move in steps of this many bytes, so small edits do not show in the size. */
export const PAD_STEP = 1024;
/** Refuse to inflate anything larger: a setup is far smaller, and a hostile blob must not exhaust memory. */
const INFLATE_LIMIT = 16 * 1024 * 1024;

const subtle = globalThis.crypto.subtle;
const utf8 = new TextEncoder();
const random = (bytes: number): Uint8Array<ArrayBuffer> => globalThis.crypto.getRandomValues(new Uint8Array(bytes));

export class SyncSizeError extends Error {
    constructor(readonly bytes: number) {
        super(`encrypted document is ${bytes} bytes; the limit is ${PAYLOAD_LIMIT}`);
    }
}

/** Where an encrypted size stands against the limit: the person is warned at three quarters, before sync would stop. */
export function budget(bytes: number): 'ok' | 'near' | 'over' {
    return bytes > PAYLOAD_LIMIT ? 'over' : bytes >= PAYLOAD_LIMIT * 0.75 ? 'near' : 'ok';
}

// ---------- Recovery key ----------

/** Crockford base 32: no I, L, O or U, so it survives being read aloud and typed back. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_BYTES = 20;

function encode32(bytes: Uint8Array): string {
    let bits = 0;
    let held = 0;
    let out = '';
    for (const byte of bytes) {
        held = (held << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            out += ALPHABET[(held >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    return bits ? out + ALPHABET[(held << (5 - bits)) & 31] : out;
}

function decode32(text: string): Uint8Array<ArrayBuffer> | null {
    const out = new Uint8Array(Math.floor((text.length * 5) / 8));
    let bits = 0;
    let held = 0;
    let at = 0;
    for (const char of text) {
        const value = ALPHABET.indexOf(char);
        if (value < 0) return null;
        held = ((held << 5) | value) & 0xfff;
        bits += 5;
        if (bits >= 8) {
            out[at++] = (held >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return out;
}

/** Four characters derived from the secret, so a mistyped key is caught before anything is tried with it. */
async function checkGroup(secret: Uint8Array<ArrayBuffer>): Promise<string> {
    const digest = new Uint8Array(await subtle.digest('SHA-256', new Uint8Array([...utf8.encode('senuma-recovery-check/v1'), ...secret])));
    return encode32(digest).slice(0, 4);
}

/** The secret from which the wrapping key is derived. Never sent anywhere. */
export function newRecoverySecret(): Uint8Array<ArrayBuffer> {
    return random(RECOVERY_BYTES);
}

/** `XXXX-XXXX-…`: eight groups of secret and one check group. */
export async function formatRecoveryKey(secret: Uint8Array<ArrayBuffer>): Promise<string> {
    return (encode32(secret) + (await checkGroup(secret))).match(/.{4}/g)!.join('-');
}

/** Reads a recovery key as a person would type it. Null when it is not one, or is mistyped. */
export async function parseRecoveryKey(text: string): Promise<Uint8Array<ArrayBuffer> | null> {
    const compact = text.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-Z]/g, '');
    if (compact.length !== 36) return null;
    const secret = decode32(compact.slice(0, 32));
    return secret && (await checkGroup(secret)) === compact.slice(32) ? secret : null;
}

// ---------- Workspace key ----------

/** What the server stores about a key. None of it reveals the key without the recovery secret. */
export interface WrappedKey {
    v: 1;
    salt: Uint8Array<ArrayBuffer>;
    /** 12-byte nonce followed by the wrapped key. */
    wrapped: Uint8Array<ArrayBuffer>;
}

const plainId = (value: string): string => {
    if (!/^[\w\-./:]{1,200}$/.test(value)) throw new Error('sync: identifier has characters that are not allowed');
    return value;
};

const keyContext = (uid: string, keyId: string) => utf8.encode(`senuma-sync/kek/v1\n${plainId(uid)}\n${plainId(keyId)}`);

async function wrappingKey(secret: Uint8Array<ArrayBuffer>, salt: Uint8Array<ArrayBuffer>, uid: string, keyId: string): Promise<CryptoKey> {
    const material = await subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: keyContext(uid, keyId) }, material, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey']);
}

/** Wraps key bytes for storage, and returns the key itself in a form that cannot be exported again. */
async function wrap(raw: Uint8Array<ArrayBuffer>, secret: Uint8Array<ArrayBuffer>, uid: string, keyId: string): Promise<{ key: CryptoKey; record: WrappedKey }> {
    const salt = random(16);
    const nonce = random(12);
    const exportable = await subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
    const sealed = new Uint8Array(await subtle.wrapKey('raw', exportable, await wrappingKey(secret, salt, uid, keyId), { name: 'AES-GCM', iv: nonce, additionalData: keyContext(uid, keyId) }));
    const key = await subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
    return { key, record: { v: 1, salt, wrapped: new Uint8Array([...nonce, ...sealed]) } };
}

/** A new workspace key for this account, and the record to store for it. */
export async function createVaultKey(secret: Uint8Array<ArrayBuffer>, uid: string, keyId: string): Promise<{ key: CryptoKey; record: WrappedKey }> {
    const raw = random(32);
    try {
        return await wrap(raw, secret, uid, keyId);
    } finally {
        raw.fill(0);
    }
}

/** For fixed test vectors only: wraps key bytes that are already known. */
export const wrapKnownKeyForTests = wrap;

/** The workspace key, given the stored record and the recovery secret. Null when the secret is wrong or the record was altered. */
export async function openVaultKey(record: WrappedKey, secret: Uint8Array<ArrayBuffer>, uid: string, keyId: string): Promise<CryptoKey | null> {
    try {
        if (record.v !== 1 || record.wrapped.length < 13) return null;
        return await subtle.unwrapKey('raw', record.wrapped.slice(12), await wrappingKey(secret, record.salt, uid, keyId),
            { name: 'AES-GCM', iv: record.wrapped.slice(0, 12), additionalData: keyContext(uid, keyId) }, 'AES-GCM', false, ['encrypt', 'decrypt']);
    } catch {
        return null;
    }
}

/** Random, meaningless identifiers: nothing about the person or the machine goes into them. */
export const newKeyId = (): string => encode32(random(10)).toLowerCase();
export const newDeviceId = (): string => encode32(random(16)).toLowerCase();

// ---------- Documents ----------

/** Where an encrypted document belongs. A document opened under any other context is rejected. */
export interface SealContext {
    uid: string;
    /** Path of the document inside the account's vault, for example `workspace/current`. */
    path: string;
    keyId: string;
    revision: number;
}

export interface Sealed {
    nonce: Uint8Array<ArrayBuffer>;
    payload: Uint8Array<ArrayBuffer>;
}

const context = ({ uid, path, keyId, revision }: SealContext) => {
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('sync: revision must be a whole number');
    return utf8.encode(`senuma-sync/doc/v${FORMAT}\n${plainId(uid)}\n${plainId(path)}\n${plainId(keyId)}\n${revision}`);
};

async function through(data: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream, limit: number): Promise<Uint8Array<ArrayBuffer>> {
    const writer = stream.writable.getWriter();
    // A failure shows up on the reading side; these only keep it from also being reported as unhandled.
    writer.write(data).catch(() => undefined);
    writer.close().catch(() => undefined);
    const reader = stream.readable.getReader() as ReadableStreamDefaultReader<Uint8Array>;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > limit) {
            await reader.cancel();
            throw new Error('sync: document inflates beyond the limit');
        }
        chunks.push(value);
    }
    const out = new Uint8Array(total);
    let at = 0;
    for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
    }
    return out;
}

/** Encrypts any JSON value for one place in one account's vault. Throws `SyncSizeError` when the result is too large to store. */
export async function seal(key: CryptoKey, value: unknown, where: SealContext): Promise<Sealed> {
    const packed = await through(utf8.encode(JSON.stringify(value)), new CompressionStream('gzip'), Infinity);
    // Length, data, then zeros up to the next step: the size on the server says little about the content.
    const padded = new Uint8Array(Math.ceil((packed.length + 4) / PAD_STEP) * PAD_STEP);
    new DataView(padded.buffer).setUint32(0, packed.length);
    padded.set(packed, 4);
    const nonce = random(12);
    const payload = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: context(where) }, key, padded));
    if (payload.length > PAYLOAD_LIMIT) throw new SyncSizeError(payload.length);
    return { nonce, payload };
}

/** The value that was sealed, or null: wrong key, altered bytes, or a document that belongs somewhere else. */
export async function open(key: CryptoKey, sealed: Sealed, where: SealContext): Promise<unknown> {
    try {
        if (sealed.nonce.length !== 12 || sealed.payload.length > PAYLOAD_LIMIT) return null;
        const padded = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv: sealed.nonce, additionalData: context(where) }, key, sealed.payload));
        const length = new DataView(padded.buffer).getUint32(0);
        if (length > padded.length - 4) return null;
        const text = new TextDecoder('utf-8', { fatal: true }).decode(await through(padded.slice(4, 4 + length), new DecompressionStream('gzip'), INFLATE_LIMIT));
        return JSON.parse(text) as unknown;
    } catch {
        return null;
    }
}

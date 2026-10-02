/**
 * Talking to the vault: Firestore's REST interface, nothing else (no Firebase SDK). Loaded only
 * when sync is in use. Everything sent is ciphertext plus the few fields the Security Rules
 * allow; this file never sees a workspace in the clear.
 */
import type { WrappedKey } from './crypto';
import type { Envelope } from './revision';

export type ErrorCode =
    /** No connection, or the service could not be reached. */
    | 'offline'
    /** The sign-in is no longer valid; the person has to sign in again. */
    | 'auth-expired'
    /** The service refused the request. */
    | 'denied'
    /** The service's daily allowance is used up. */
    | 'quota'
    /** The encrypted workspace is over the size limit. */
    | 'too-large'
    /** The cloud copy could not be decrypted or is not a workspace. Nothing was applied. */
    | 'unreadable'
    /** The cloud copy was written by a newer Senuma. */
    | 'schema-newer'
    | 'format-newer'
    /** The cloud copy is older than one this device already saw. */
    | 'went-backwards'
    /** The cloud copy this device synced with is gone. */
    | 'missing'
    /** The cloud copy is encrypted with a key this device does not hold. */
    | 'key-changed'
    /** This device was removed from the account on another device. */
    | 'removed'
    | 'failed';

export class SyncError extends Error {
    constructor(readonly code: ErrorCode, detail = '') {
        super(detail ? `${code}: ${detail}` : code);
    }
}

/** Who is signed in. `token` rejects with `auth-expired` when the sign-in can no longer be used. */
export interface Session {
    uid: string;
    email: string;
    token(): Promise<string>;
}

/** The workspace document as stored, with what is needed to copy it verbatim and to write after it. */
export interface StoredEnvelope extends Omit<Envelope, 'nonce' | 'payload'> {
    nonce: Uint8Array<ArrayBuffer>;
    payload: Uint8Array<ArrayBuffer>;
    /** The server's version stamp: a write is accepted only if this is still current. */
    updateTime: string;
    /** The document's fields exactly as the server returned them, for the verbatim history copy. */
    raw: unknown;
}

export interface StoredDevice {
    id: string;
    keyId: string;
    nonce: Uint8Array<ArrayBuffer>;
    payload: Uint8Array<ArrayBuffer>;
}

export type WriteResult = 'ok' | 'stale' | 'denied';

export interface Transport {
    readCurrent(): Promise<StoredEnvelope | null>;
    /**
     * Writes the next revision. `previous` is what was read (null: there must be no document).
     * With `history`, the previous document is copied to history in the same atomic write.
     * `stale`: the server's copy changed since it was read; nothing was written.
     */
    writeCurrent(next: Pick<Envelope, 'format' | 'keyId' | 'revision' | 'nonce' | 'payload'>, previous: StoredEnvelope | null, history: boolean): Promise<WriteResult>;
    listKeys(): Promise<Record<string, WrappedKey>>;
    createKey(keyId: string, record: WrappedKey): Promise<void>;
    deleteKey(keyId: string): Promise<void>;
    readDevice(id: string): Promise<StoredDevice | null>;
    listDevices(): Promise<StoredDevice[]>;
    putDevice(device: StoredDevice): Promise<void>;
    deleteDevice(id: string): Promise<void>;
    listHistory(): Promise<number[]>;
    deleteHistory(revision: number): Promise<void>;
    /** Removes every document of the vault. Safe to repeat. */
    deleteVault(): Promise<void>;
}

export interface TransportConfig {
    /** `https://firestore.googleapis.com` in production; the local emulator's address in tests. */
    origin: string;
    project: string;
}

type Value = { integerValue?: string; stringValue?: string; bytesValue?: string; timestampValue?: string };
type Fields = Record<string, Value>;
interface Document { name: string; fields?: Fields; updateTime?: string }

const toBase64 = (bytes: Uint8Array): string => {
    let binary = '';
    for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    return btoa(binary);
};
const fromBase64 = (text: string | undefined): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text ?? ''), char => char.charCodeAt(0));

export function firestoreTransport(config: TransportConfig, session: Session): Transport {
    const root = `projects/${config.project}/databases/(default)/documents`;
    const vault = `${root}/vaults/${session.uid}`;
    const url = (path: string) => `${config.origin}/v1/${path}`;

    async function call(method: string, path: string, body?: unknown): Promise<Response> {
        const token = await session.token();
        let response: Response;
        try {
            response = await fetch(url(path), { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        } catch (error) {
            throw new SyncError('offline', String(error));
        }
        if (response.status === 401) throw new SyncError('auth-expired');
        if (response.status === 429) throw new SyncError('quota');
        if (response.status >= 500) throw new SyncError('offline', `service answered ${response.status}`);
        return response;
    }

    const expectOk = async (response: Response, what: string): Promise<void> => {
        if (response.ok) return;
        throw new SyncError(response.status === 403 ? 'denied' : 'failed', `${what}: ${response.status}`);
    };

    const envelopeOf = (document: Document): StoredEnvelope => {
        const fields = document.fields ?? {};
        return {
            format: Number(fields.format?.integerValue),
            keyId: fields.keyId?.stringValue ?? '',
            revision: Number(fields.revision?.integerValue),
            updatedAt: Date.parse(fields.updatedAt?.timestampValue ?? ''),
            nonce: fromBase64(fields.nonce?.bytesValue),
            payload: fromBase64(fields.payload?.bytesValue),
            updateTime: document.updateTime ?? '',
            raw: fields,
        };
    };
    const deviceOf = (document: Document): StoredDevice => ({
        id: document.name.slice(document.name.lastIndexOf('/') + 1),
        keyId: document.fields?.keyId?.stringValue ?? '',
        nonce: fromBase64(document.fields?.nonce?.bytesValue),
        payload: fromBase64(document.fields?.payload?.bytesValue),
    });

    /** Every document of one collection of the vault, in pages no larger than the rules allow. */
    async function list(collection: string, limit: number): Promise<Document[]> {
        const response = await call('POST', `${vault}:runQuery`, { structuredQuery: { from: [{ collectionId: collection }], limit } });
        await expectOk(response, `list ${collection}`);
        return ((await response.json()) as { document?: Document }[]).flatMap(row => (row.document ? [row.document] : []));
    }
    const remove = async (path: string): Promise<void> => expectOk(await call('DELETE', `${vault}/${path}`), `delete ${path}`);

    const transport: Transport = {
        async readCurrent() {
            const response = await call('GET', `${vault}/workspace/current`);
            if (response.status === 404) return null;
            await expectOk(response, 'read workspace');
            return envelopeOf((await response.json()) as Document);
        },

        async writeCurrent(next, previous, history) {
            const fields: Fields = {
                format: { integerValue: String(next.format) },
                keyId: { stringValue: next.keyId },
                revision: { integerValue: String(next.revision) },
                nonce: { bytesValue: toBase64(next.nonce) },
                payload: { bytesValue: toBase64(next.payload) },
            };
            const writes: unknown[] = [];
            if (previous && history) writes.push({ update: { name: `${vault}/history/${previous.revision}`, fields: previous.raw }, currentDocument: { exists: false } });
            writes.push({
                update: { name: `${vault}/workspace/current`, fields },
                // The server stamps the time; the rules refuse any other.
                updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
                currentDocument: previous ? { updateTime: previous.updateTime } : { exists: false },
            });
            const response = await call('POST', `${root}:commit`, { writes });
            if (response.ok) return 'ok';
            if (response.status === 403) return 'denied';
            // The copy on the server is not the one that was read (or a history entry is already there).
            if (response.status === 400 || response.status === 409) return 'stale';
            throw new SyncError('failed', `write workspace: ${response.status}`);
        },

        async listKeys() {
            const keys: Record<string, WrappedKey> = {};
            for (const document of await list('keys', 20)) {
                keys[document.name.slice(document.name.lastIndexOf('/') + 1)] = { v: 1, salt: fromBase64(document.fields?.salt?.bytesValue), wrapped: fromBase64(document.fields?.wrapped?.bytesValue) };
            }
            return keys;
        },
        async createKey(keyId, record) {
            const body = { writes: [{ update: { name: `${vault}/keys/${keyId}`, fields: { v: { integerValue: '1' }, salt: { bytesValue: toBase64(record.salt) }, wrapped: { bytesValue: toBase64(record.wrapped) } } }, currentDocument: { exists: false } }] };
            await expectOk(await call('POST', `${root}:commit`, body), 'create key');
        },
        deleteKey: keyId => remove(`keys/${keyId}`),

        async readDevice(id) {
            const response = await call('GET', `${vault}/devices/${id}`);
            if (response.status === 404) return null;
            await expectOk(response, 'read device');
            return deviceOf((await response.json()) as Document);
        },
        listDevices: async () => (await list('devices', 50)).map(deviceOf),
        async putDevice(device) {
            const fields = { keyId: { stringValue: device.keyId }, nonce: { bytesValue: toBase64(device.nonce) }, payload: { bytesValue: toBase64(device.payload) } };
            await expectOk(await call('PATCH', `${vault}/devices/${device.id}`, { fields }), 'write device');
        },
        deleteDevice: id => remove(`devices/${id}`),

        listHistory: async () => (await list('history', 20)).map(document => Number(document.name.slice(document.name.lastIndexOf('/') + 1))).sort((a, b) => a - b),
        deleteHistory: revision => remove(`history/${revision}`),

        async deleteVault() {
            // History can hold more than one page.
            for (let page = 0; page < 50; page++) {
                const revisions = await transport.listHistory();
                if (!revisions.length) break;
                for (const revision of revisions) await transport.deleteHistory(revision);
            }
            for (const device of await transport.listDevices()) await transport.deleteDevice(device.id);
            await remove('workspace/current');
            // Keys last: until here the data could still be read by a device that held them.
            for (const keyId of Object.keys(await transport.listKeys())) await transport.deleteKey(keyId);
        },
    };
    return transport;
}

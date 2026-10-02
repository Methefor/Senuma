import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../core/types';
import { FORMAT, PAYLOAD_LIMIT, createVaultKey, newRecoverySecret, open, seal } from './crypto';
import { workspaceDoc } from './fixtures';
import { ENVELOPE_FIELDS, inspect, plan, writeAllowed, type Envelope, type SyncMemory, type WorkspacePlain } from './revision';
import { LARGEST_PAYLOAD, SMALLEST_PAYLOAD, WRITE_CASES, type Attempt } from './writeMatrix';

const KEY = 'k1aaaaaa';
const memory = (patch: Partial<SyncMemory> = {}): SyncMemory => ({ baseRevision: 5, keyId: KEY, dirty: false, ...patch });
const head = (revision: number, patch: object = {}) => ({ format: FORMAT, keyId: KEY, revision, ...patch });

describe('what happens next', () => {
    it('does nothing when nothing changed anywhere', () => {
        expect(plan(memory(), head(5))).toEqual({ kind: 'idle' });
    });

    it('sends a local change as the next revision, on condition that nobody wrote in between', () => {
        expect(plan(memory({ dirty: true }), head(5))).toEqual({ kind: 'push', revision: 6, expect: 5 });
    });

    it('creates the first copy only where none exists', () => {
        expect(plan(memory({ baseRevision: 0, keyId: null, dirty: true }), null)).toEqual({ kind: 'push', revision: 1, expect: null });
    });

    it('takes the newer copy when this device changed nothing, and merges when it did', () => {
        expect(plan(memory(), head(8))).toEqual({ kind: 'pull' });
        expect(plan(memory({ dirty: true }), head(8))).toEqual({ kind: 'merge' });
    });

    it('never combines a first sync automatically: a device with no history asks the person', () => {
        expect(plan(memory({ baseRevision: 0, dirty: true }), head(3))).toEqual({ kind: 'first-sync' });
        expect(plan(memory({ baseRevision: 0, dirty: false }), head(3))).toEqual({ kind: 'first-sync' });
    });
});

describe('what stops sync instead of guessing', () => {
    it('a copy older than one this device already saw (a replayed or rolled-back copy)', () => {
        expect(plan(memory(), head(4))).toEqual({ kind: 'blocked', reason: 'went-backwards' });
        expect(plan(memory({ dirty: true }), head(1))).toEqual({ kind: 'blocked', reason: 'went-backwards' });
    });

    it('the copy having disappeared: local data is not re-uploaded behind the person’s back', () => {
        expect(plan(memory({ dirty: true }), null)).toEqual({ kind: 'blocked', reason: 'missing' });
    });

    it('a key this device does not hold, or a newer document format', () => {
        expect(plan(memory(), head(6, { keyId: 'k2bbbbbb' }))).toEqual({ kind: 'blocked', reason: 'key-changed' });
        expect(plan(memory({ dirty: true }), head(6, { format: FORMAT + 1 }))).toEqual({ kind: 'blocked', reason: 'format-newer' });
    });

    it('an old copy presented as a newer revision cannot be opened, so it cannot be pulled', async () => {
        const { key } = await createVaultKey(newRecoverySecret(), 'user_a', KEY);
        const at = (revision: number) => ({ uid: 'user_a', path: 'workspace/current', keyId: KEY, revision });
        const old = await seal(key, { old: true }, at(5));
        expect(plan(memory(), head(9))).toEqual({ kind: 'pull' }); // the counter alone would be believed…
        expect(await open(key, old, at(9))).toBeNull(); // …but the bytes are bound to revision 5
    });
});

describe('the decrypted copy', () => {
    const plain = (schema = SCHEMA_VERSION): WorkspacePlain => ({ schema, deviceId: 'd'.repeat(26), savedAt: 1, doc: { ...workspaceDoc({ links: 3 }), schema } });

    it('is used only when it is a workspace of this build’s schema', () => {
        expect(inspect(plain()).ok).toBe(true);
    });

    it('from a newer Senuma is neither applied nor overwritten', () => {
        expect(inspect(plain(SCHEMA_VERSION + 1))).toEqual({ ok: false, problem: 'schema-newer' });
        expect(inspect(plain(SCHEMA_VERSION - 1))).toEqual({ ok: false, problem: 'schema-older' });
    });

    it('that is anything else is unreadable', () => {
        for (const junk of [null, 1, 'x', [], {}, { schema: SCHEMA_VERSION }, { ...plain(), doc: null }, { ...plain(), doc: { ...plain().doc, schema: 1 } }, { ...plain(), deviceId: 5 }]) {
            expect(inspect(junk)).toEqual({ ok: false, problem: 'unreadable' });
        }
    });
});

describe('what the server can read', () => {
    it('is six fields: a format number, a random key id, a counter, the server’s time, and bytes', () => {
        expect([...ENVELOPE_FIELDS].sort()).toEqual(['format', 'keyId', 'nonce', 'payload', 'revision', 'updatedAt']);
    });

    it('does not include the schema version, the device or its name, or the device’s clock', () => {
        for (const hidden of ['schema', 'schemaVersion', 'deviceId', 'device', 'label', 'name', 'savedAt', 'email', 'createdBy']) {
            expect((ENVELOPE_FIELDS as readonly string[]).includes(hidden), hidden).toBe(false);
        }
    });
});

describe('the write rule (reference for the Security Rules)', () => {
    const now = 1_800_000_000_000;
    const envelope = (patch: Partial<Envelope> = {}): Envelope => ({ format: FORMAT, keyId: KEY, revision: 6, updatedAt: now, nonce: new Uint8Array(12), payload: new Uint8Array(1040), ...patch });
    const previous = envelope({ revision: 5, updatedAt: now - 60_000 });
    const allowed = (next: object, before: Envelope | null = previous) => writeAllowed(before, next as Record<string, unknown>, now);

    it('accepts the next revision, and a first document only as revision 1', () => {
        expect(allowed(envelope())).toBe(true);
        expect(allowed(envelope({ revision: 1 }), null)).toBe(true);
        expect(allowed(envelope({ revision: 2 }), null)).toBe(false);
    });

    it('rejects a skipped, repeated or lowered revision', () => {
        for (const revision of [5, 4, 7, 0, 6.5]) expect(allowed(envelope({ revision })), String(revision)).toBe(false);
    });

    it('rejects extra or missing fields, so nothing readable can be added beside the ciphertext', () => {
        expect(allowed({ ...envelope(), deviceName: 'Laptop' })).toBe(false);
        expect(allowed({ ...envelope(), schemaVersion: 4 })).toBe(false);
        const missing: Partial<Envelope> = envelope();
        delete missing.keyId;
        expect(allowed(missing)).toBe(false);
    });

    it('rejects a client-chosen time, a wrong nonce, an empty or oversized payload, a readable key id', () => {
        expect(allowed(envelope({ updatedAt: now + 1 }))).toBe(false);
        expect(allowed(envelope({ nonce: new Uint8Array(11) }))).toBe(false);
        expect(allowed(envelope({ payload: new Uint8Array(0) }))).toBe(false);
        expect(allowed(envelope({ payload: new Uint8Array(PAYLOAD_LIMIT + 16) }))).toBe(false);
        expect(allowed(envelope({ payload: new Uint8Array(PAYLOAD_LIMIT) }))).toBe(false); // not block-shaped
        expect(allowed(envelope({ payload: new Uint8Array(LARGEST_PAYLOAD) }))).toBe(true);
        expect(LARGEST_PAYLOAD).toBeLessThanOrEqual(PAYLOAD_LIMIT);
        expect(allowed(envelope({ keyId: 'Mete’s key' }))).toBe(false);
        expect(allowed(envelope({ format: FORMAT + 1 }))).toBe(false);
    });

    it('rejects writes that come too fast', () => {
        expect(allowed(envelope(), envelope({ revision: 5, updatedAt: now - 500 }))).toBe(false);
        expect(allowed(envelope(), envelope({ revision: 5, updatedAt: now - 2001 }))).toBe(true);
    });
});

describe('the write rule against the shared matrix (the same rows the emulator tests run against the real rules)', () => {
    const now = 1_800_000_000_000;
    /** Builds what a matrix row describes, in this side's types. */
    function build(attempt: Attempt): Record<string, unknown> {
        const data: Record<string, unknown> = {
            format: 'format' in attempt ? attempt.format : FORMAT,
            keyId: 'keyId' in attempt ? attempt.keyId : KEY,
            revision: attempt.revision,
            updatedAt: attempt.time === 'client' ? now + 5000 : attempt.time === 'text' ? 'now' : now,
            nonce: attempt.nonce === 'text' ? 'AAAAAAAAAAAA' : new Uint8Array(attempt.nonce ?? 12),
            payload: attempt.payload === 'text' ? 'not ciphertext' : new Uint8Array(attempt.payload ?? SMALLEST_PAYLOAD),
            ...attempt.extra,
        };
        if (attempt.omit) delete data[attempt.omit];
        return data;
    }
    for (const entry of WRITE_CASES) {
        it(`${entry.group}: ${entry.name} is ${entry.allowed ? 'accepted' : 'refused'}`, () => {
            const previous: Envelope | null = entry.before && { format: FORMAT, keyId: KEY, revision: entry.before.revision, updatedAt: now - entry.before.ageMs, nonce: new Uint8Array(12), payload: new Uint8Array(SMALLEST_PAYLOAD) };
            expect(writeAllowed(previous, build(entry.attempt), now)).toBe(entry.allowed);
        });
    }

    it('covers every group, with rows that are accepted and rows that are refused', () => {
        for (const group of ['shape', 'revision', 'rate'] as const) expect(WRITE_CASES.some(entry => entry.group === group)).toBe(true);
        expect(WRITE_CASES.filter(entry => entry.allowed).length).toBeGreaterThanOrEqual(4);
        expect(WRITE_CASES.filter(entry => !entry.allowed).length).toBeGreaterThanOrEqual(33);
        expect(WRITE_CASES).toHaveLength(42);
    });
});

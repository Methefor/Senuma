/**
 * The revision model (Senuma 2.1, phase 1: not used by the product yet). Pure decisions: given
 * what this device knows and what the server shows, what may happen next. No network here.
 *
 * Ordering comes from one counter, `revision`, that the server only lets grow by one. Timestamps
 * are never compared to decide anything.
 */
import { SCHEMA_VERSION } from '../core/types';
import { FORMAT, PAYLOAD_LIMIT } from './crypto';
import type { SyncDoc } from './scope';

/**
 * Everything the server can read about a workspace. Kept to what it needs to do its job:
 * order writes (`revision`), limit their rate (`updatedAt`), and let a device find the right
 * key (`keyId`, a random id). The schema version, the writing device and its clock are inside
 * the encrypted part.
 */
export interface Envelope {
    format: number;
    keyId: string;
    revision: number;
    /** Set by the server. Shown to the person; decides nothing. */
    updatedAt: number;
    nonce: Uint8Array;
    payload: Uint8Array;
}

export const ENVELOPE_FIELDS = ['format', 'keyId', 'revision', 'updatedAt', 'nonce', 'payload'] as const satisfies readonly (keyof Envelope)[];

/** The encrypted part of a workspace document. */
export interface WorkspacePlain {
    schema: number;
    /** Random id of the device that wrote this revision. */
    deviceId: string;
    /** That device's clock when it wrote. For display only. */
    savedAt: number;
    doc: SyncDoc;
}

/** The encrypted part of a device entry: nothing about a device is readable on the server. */
export interface DevicePlain {
    label: string;
    createdAt: number;
    lastSyncAt: number;
    lastRevision: number;
}

/** What this device remembers between syncs. */
export interface SyncMemory {
    /** Revision of the last copy this device sent or applied. 0 before the first sync. */
    baseRevision: number;
    /** Key the device holds; null before it has one. */
    keyId: string | null;
    /** Whether the syncable part of the local setup differs from the base. */
    dirty: boolean;
}

/** What the server shows, before anything is decrypted. Null when there is no document. */
export type Head = Pick<Envelope, 'format' | 'keyId' | 'revision'> | null;

export type Step =
    | { kind: 'idle' }
    /** Send the local copy. `expect` is the revision that must still be current (null: there must be no document). */
    | { kind: 'push'; revision: number; expect: number | null }
    /** The server is ahead and nothing changed here: decrypt, save a restore point, apply. */
    | { kind: 'pull' }
    /** Both changed: decrypt, three-way merge against the base, then push or ask. */
    | { kind: 'merge' }
    /** A copy exists and this device has never synced: the person chooses how to combine them. */
    | { kind: 'first-sync' }
    | { kind: 'blocked'; reason: BlockReason };

export type BlockReason =
    /** The server shows an older revision than this device has already seen: a replayed or restored copy. */
    | 'went-backwards'
    /** The copy this device synced with is gone: cloud data was deleted elsewhere. */
    | 'missing'
    /** Written with a key this device does not hold: the key was rotated. */
    | 'key-changed'
    /** Written by a newer document format than this build reads. */
    | 'format-newer';

export function plan(memory: SyncMemory, head: Head): Step {
    if (!head) return memory.baseRevision > 0 ? { kind: 'blocked', reason: 'missing' } : { kind: 'push', revision: 1, expect: null };
    if (head.format > FORMAT) return { kind: 'blocked', reason: 'format-newer' };
    if (memory.keyId !== null && head.keyId !== memory.keyId) return { kind: 'blocked', reason: 'key-changed' };
    if (memory.baseRevision === 0) return { kind: 'first-sync' };
    if (head.revision < memory.baseRevision) return { kind: 'blocked', reason: 'went-backwards' };
    if (head.revision === memory.baseRevision) return memory.dirty ? { kind: 'push', revision: head.revision + 1, expect: head.revision } : { kind: 'idle' };
    return memory.dirty ? { kind: 'merge' } : { kind: 'pull' };
}

export type ReadProblem =
    /** Could not be decrypted, or is not a workspace: nothing is applied. */
    | 'unreadable'
    /** Written by a newer Senuma: this build must not apply or overwrite it. */
    | 'schema-newer'
    /** Older than this build's schema: upgrade it before merging. */
    | 'schema-older';

/** Checks a decrypted workspace before anything is done with it. */
export function inspect(plain: unknown): { ok: true; plain: WorkspacePlain } | { ok: false; problem: ReadProblem } {
    const value = plain as Partial<WorkspacePlain> | null;
    if (!value || typeof value !== 'object' || typeof value.schema !== 'number' || typeof value.deviceId !== 'string' || !value.doc || typeof value.doc !== 'object' || value.doc.schema !== value.schema) {
        return { ok: false, problem: 'unreadable' };
    }
    if (value.schema > SCHEMA_VERSION) return { ok: false, problem: 'schema-newer' };
    if (value.schema < SCHEMA_VERSION) return { ok: false, problem: 'schema-older' };
    return { ok: true, plain: value as WorkspacePlain };
}

/**
 * The server-side write rule, restated so the client refuses first and so the Security Rules
 * (phase 2) have a reference to be tested against. `previous` is null when no document exists.
 */
export function writeAllowed(previous: Envelope | null, next: Record<string, unknown>, serverTime: number, minIntervalMs = 2000): boolean {
    const keys = Object.keys(next);
    if (keys.length !== ENVELOPE_FIELDS.length || !ENVELOPE_FIELDS.every(field => keys.includes(field))) return false;
    const { format, keyId, revision, updatedAt, nonce, payload } = next as unknown as Envelope;
    if (format !== FORMAT || typeof keyId !== 'string' || !/^[a-z0-9]{8,40}$/.test(keyId)) return false;
    if (!Number.isSafeInteger(revision) || updatedAt !== serverTime) return false;
    if (!(nonce instanceof Uint8Array) || nonce.length !== 12) return false;
    if (!(payload instanceof Uint8Array) || payload.length === 0 || payload.length > PAYLOAD_LIMIT) return false;
    if (!previous) return revision === 1;
    return revision === previous.revision + 1 && serverTime > previous.updatedAt + minIntervalMs;
}

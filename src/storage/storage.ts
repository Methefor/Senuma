/**
 * State persistence. The browser key-value store is the source of truth; a localStorage
 * mirror lets the page paint synchronously on open.
 */
import { STORAGE_KEYS } from '../brand';
import { kv, readLocal, writeLocal } from '../browser/kv';
import { inExtension } from '../browser/result';
import { sanitizeSnapshots } from '../core/backup';
import { emptyState } from '../core/defaults';
import { upgrade, type Resolved } from '../core/migrate';
import { sanitize } from '../core/sanitize';
import { SCHEMA_VERSION, type AppState, type Snapshot } from '../core/types';

/** Synchronous best-effort read used for the first paint. */
export function readCachedState(): AppState | null {
    return upgrade(readLocal(STORAGE_KEYS.state));
}

/**
 * A stored state from a newer release than this build (a rollback). It is read as well as
 * this build can, and the original is set aside before this build writes over it.
 */
let newerOriginal: unknown;

export async function loadState(): Promise<Resolved> {
    const stored = await kv.get([STORAGE_KEYS.state, STORAGE_KEYS.legacyData]);
    const raw = stored[STORAGE_KEYS.state] as { schema?: unknown } | undefined;
    if (raw && typeof raw.schema === 'number' && raw.schema > SCHEMA_VERSION) newerOriginal = raw;
    // A state of the current model wins, always (see legacyConvert.ts on why 1.x data is never a fallback).
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) return { state: upgrade(raw) ?? sanitize(raw), source: 'stored' };
    const legacy = stored[STORAGE_KEYS.legacyData];
    if (legacy === undefined || legacy === null) return { state: emptyState(), source: 'fresh' };
    // Only an install that still has 1.x data pays for the converter.
    return (await import('../core/legacyConvert')).resolveState(raw, legacy);
}

/** Rejects when the write fails (for example when the storage quota is exhausted). */
export async function saveState(state: AppState): Promise<void> {
    // In the extension the mirror is only a paint cache and may fail quietly; in the
    // preview it is the store itself, and kv.set reports the failure.
    if (newerOriginal !== undefined) {
        // If the copy cannot be kept, the newer data must not be overwritten: fail the save.
        await kv.set({ [STORAGE_KEYS.newerState]: newerOriginal });
        newerOriginal = undefined;
    }
    if (inExtension) writeLocal(STORAGE_KEYS.state, state);
    await kv.set({ [STORAGE_KEYS.state]: state });
}

/** Calls back when another tab saves a state. */
export function onExternalChange(callback: (state: AppState) => void): void {
    kv.onChange(STORAGE_KEYS.state, value => {
        const state = upgrade(value);
        if (state) callback(state);
    });
}

export async function loadSnapshots(): Promise<Snapshot[]> {
    return sanitizeSnapshots((await kv.get([STORAGE_KEYS.snapshots]))[STORAGE_KEYS.snapshots]);
}

export async function saveSnapshots(snapshots: Snapshot[]): Promise<void> {
    await kv.set({ [STORAGE_KEYS.snapshots]: snapshots });
}

/**
 * State persistence. The browser key-value store is the source of truth; a localStorage
 * mirror lets the page paint synchronously on open.
 */
import { STORAGE_KEYS } from '../brand';
import { kv, readLocal, writeLocal } from '../browser/kv';
import { inExtension } from '../browser/result';
import { sanitizeSnapshots } from '../core/backup';
import { resolveState, upgrade, type Resolved } from '../core/migrate';
import type { AppState, Snapshot } from '../core/types';

/** Synchronous best-effort read used for the first paint. */
export function readCachedState(): AppState | null {
    return upgrade(readLocal(STORAGE_KEYS.state));
}

export async function loadState(): Promise<Resolved> {
    const stored = await kv.get([STORAGE_KEYS.state, STORAGE_KEYS.legacyData]);
    return resolveState(stored[STORAGE_KEYS.state], stored[STORAGE_KEYS.legacyData]);
}

/** Rejects when the write fails (for example when the storage quota is exhausted). */
export async function saveState(state: AppState): Promise<void> {
    // In the extension the mirror is only a paint cache and may fail quietly; in the
    // preview it is the store itself, and kv.set reports the failure.
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

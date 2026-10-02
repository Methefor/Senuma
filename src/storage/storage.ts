/**
 * State persistence. The browser key-value store is the source of truth; a localStorage
 * mirror lets the page paint synchronously on open.
 */
import { STORAGE_KEYS } from '../brand';
import { kv, readLocal, writeLocal } from '../browser/kv';
import { inExtension } from '../browser/result';
import { sanitizeSnapshots } from '../core/backup';
import { capIcons } from '../core/iconPolicy';
import { emptyState } from '../core/defaults';
import { findings, newReport, type ValidationReport } from '../core/limits';
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
    const report = newReport();
    // Oversized icons are left in place here so that the page can make them smaller instead of dropping them.
    const options = { report, keepIcons: true };
    let resolved: Resolved;
    // A state of the current model wins, always (see legacyConvert.ts on why 1.x data is never a fallback).
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) resolved = { state: upgrade(raw, options) ?? sanitize(raw, options), source: 'stored' };
    else {
        const legacy = stored[STORAGE_KEYS.legacyData];
        if (legacy === undefined || legacy === null) return { state: emptyState(), source: 'fresh' };
        // Only an install that still has 1.x data pays for the converter.
        resolved = (await import('../core/legacyConvert')).resolveState(raw, legacy, options);
    }
    return withinLimits(resolved, report, raw);
}

/**
 * The one-time pass over a setup saved before the size limits existed (and the guard for any
 * later one that breaks them). Once a setup is within the limits this does nothing, so it needs
 * no marker. What it changes is reported, and the stored original is set aside first.
 */
async function withinLimits(resolved: Resolved, report: ValidationReport, original: unknown): Promise<Resolved> {
    let { state } = resolved;
    if (capIcons(state).dropped.length > 0) state = await (await import('../app/icons')).settleSetup(state, report);
    if (findings(report) === 0) return { ...resolved, state };
    // Kept once, untouched, in case something the limits removed is wanted back. Best effort: a full store must not stop the page.
    if (original !== undefined) await kv.set({ [STORAGE_KEYS.beforeLimits]: original }).catch(() => undefined);
    // Newer than every copy made before the pass, so this is the one that is shown and saved.
    return { ...resolved, state: { ...state, updatedAt: Date.now() }, report };
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

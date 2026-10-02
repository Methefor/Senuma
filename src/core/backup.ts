/**
 * Backups. A backup file is the whole setup (Spaces, Modes, dock, search, preferences) in
 * one portable JSON document; snapshots are the same thing kept locally as restore points.
 */
import { MAX_SNAPSHOTS, newId } from './defaults';
import { upgrade } from './migrate';
import { isDict } from './sanitize';
import { DEFAULT_BACKGROUND, type Background } from './background';
import type { AppState, Mode, Snapshot } from './types';

/** Written into new backup files. */
export const BACKUP_KIND = 'senuma-backup';
/**
 * Uploaded images never leave the device inside a backup: a file holds no pixels, so a
 * background that points at an upload is exported as the theme default. Everything else
 * about the look (theme, presets, colours, adjustments) travels with the file.
 */
export function withoutUploads(state: AppState): AppState {
    const portable = (background: Background): Background =>
        background.source.kind === 'upload' ? { ...background, source: DEFAULT_BACKGROUND.source } : background;
    const modes: Record<string, Mode> = {};
    for (const [id, mode] of Object.entries(state.modes)) modes[id] = mode.background ? { ...mode, background: portable(mode.background) } : mode;
    return { ...state, wallpapers: {}, modes, prefs: { ...state.prefs, background: portable(state.prefs.background) } };
}

export function exportBackup(state: AppState): string {
    // Activity is private to this device and is left out of files meant to be shared.
    const portable: AppState = { ...withoutUploads(state), recents: [], usage: {} };
    return JSON.stringify({ kind: BACKUP_KIND, schema: state.schema, exportedAt: new Date().toISOString(), state: portable }, null, 2);
}

/** Adds a restore point, newest first, keeping only the most recent few. */
export function addSnapshot(list: Snapshot[], state: AppState, reason: Snapshot['reason'], now = Date.now()): Snapshot[] {
    // Sync applies copies often; it keeps one restore point, the latest, so it cannot push the person's own ones out.
    const kept = reason === 'sync' ? list.filter(snapshot => snapshot.reason !== 'sync') : list;
    return [{ id: newId(), at: now, reason, state: { ...state, recents: [], usage: {} } }, ...kept].slice(0, MAX_SNAPSHOTS);
}

/** Validates snapshots read from storage; unreadable ones are dropped. */
export function sanitizeSnapshots(raw: unknown): Snapshot[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry): Snapshot[] => {
        if (!isDict(entry) || typeof entry.id !== 'string' || typeof entry.at !== 'number') return [];
        const state = upgrade(entry.state);
        if (!state) return [];
        const reason = entry.reason === 'reset' || entry.reason === 'restore' || entry.reason === 'sync' ? entry.reason : 'import';
        return [{ id: entry.id, at: entry.at, reason, state }];
    }).slice(0, MAX_SNAPSHOTS);
}

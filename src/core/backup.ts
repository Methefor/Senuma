/** JSON backup: the whole setup (Spaces, Modes, search, preferences) in one portable file. */
import { fromLegacy } from './migrate';
import { sanitize } from './sanitize';
import type { AppState } from './types';

const BACKUP_KIND = 'browser-os-backup';

export function exportBackup(state: AppState): string {
    // Recent activity is private to this device and is left out of files meant to be shared.
    const portable: AppState = { ...state, recents: [] };
    return JSON.stringify({ kind: BACKUP_KIND, schema: state.schema, exportedAt: new Date().toISOString(), state: portable }, null, 2);
}

/** Reads a backup from this product or an export from New Tab Folders 1.x. Null if unreadable. */
export function importBackup(text: string): AppState | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    if (typeof parsed === 'object' && parsed !== null && (parsed as { kind?: unknown }).kind === BACKUP_KIND) {
        const state = sanitize((parsed as { state?: unknown }).state);
        if (state.spaceOrder.length === 0) return null;
        return { ...state, onboarded: true, updatedAt: Date.now() };
    }
    const legacy = fromLegacy(parsed);
    return legacy && legacy.state.spaceOrder.length > 0 ? legacy.state : null;
}

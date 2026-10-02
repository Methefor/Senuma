/**
 * Backups. A backup file is the whole setup (Spaces, Modes, dock, search, preferences) in
 * one portable JSON document; snapshots are the same thing kept locally as restore points.
 */
import { MAX_SNAPSHOTS, newId } from './defaults';
import { fromLegacy, upgrade } from './migrate';
import { addGroup, addItem, addSpace, itemsOf } from './ops';
import { isDict } from './sanitize';
import { DEFAULT_BACKGROUND, type Background } from './background';
import type { AppState, Mode, Snapshot } from './types';

/** Written into new backup files. */
export const BACKUP_KIND = 'senuma-backup';
/**
 * Kinds written by earlier builds of this product. A file someone exported before the rename
 * must keep working, so these are read forever. (1.x exports have no kind and are handled below.)
 */
const EARLIER_KINDS: readonly string[] = ['browser-os-backup'];
const isBackupKind = (kind: unknown): boolean => kind === BACKUP_KIND || (typeof kind === 'string' && EARLIER_KINDS.includes(kind));

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

/**
 * Reads a backup from this product (any schema version) or an export from New Tab
 * Folders 1.x. Everything is re-validated; null means the file holds nothing usable.
 */
export function importBackup(text: string): AppState | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        return null;
    }
    let state: AppState | null;
    if (isDict(parsed) && isBackupKind(parsed.kind)) {
        // The envelope's schema is authoritative for files whose state omits its own.
        const inner = isDict(parsed.state) ? { schema: parsed.schema, ...parsed.state } : null;
        state = upgrade(inner);
    } else {
        state = fromLegacy(parsed);
        if (state?.legacy) state.legacy.acknowledged = true;
    }
    if (!state || state.spaceOrder.length === 0) return null;
    return { ...state, onboarded: true, updatedAt: Date.now() };
}

/**
 * Adds an imported setup to the current one without removing anything. A Space whose name
 * matches an existing one receives the links it does not already have; other Spaces are
 * appended. Modes, dock and preferences of the current setup are kept.
 */
export function mergeBackup(current: AppState, incoming: AppState): { state: AppState; spaces: number; links: number } {
    let state = current;
    let spaces = 0;
    let links = 0;
    const byName = new Map(current.spaceOrder.map(id => [current.spaces[id]!.name.trim().toLowerCase(), id]));

    for (const incomingId of incoming.spaceOrder) {
        const source = incoming.spaces[incomingId]!;
        let targetId = byName.get(source.name.trim().toLowerCase());
        if (!targetId) {
            const created = addSpace({ ...state, activeModeId: null }, { name: source.name, glyph: source.glyph, accent: source.accent, note: source.note, templateId: source.templateId });
            state = { ...created.state, activeModeId: state.activeModeId };
            targetId = created.id;
            spaces++;
        }
        const existing = new Set(itemsOf(state, state.spaces[targetId]!).map(i => i.url));
        for (const group of source.groups) {
            for (const itemId of group.itemIds) {
                const item = incoming.items[itemId];
                if (!item || existing.has(item.url)) continue;
                const space = state.spaces[targetId]!;
                let groupId = space.groups.find(g => g.name === group.name)?.id;
                if (!groupId) {
                    state = addGroup(state, targetId, group.name);
                    groupId = state.spaces[targetId]!.groups.at(-1)!.id;
                }
                const added = addItem(state, targetId, groupId, { title: item.title, url: item.url, icon: item.icon });
                if (!added.id) continue;
                state = added.state;
                existing.add(item.url);
                links++;
            }
        }
        // A newly created Space starts with an untitled group; drop it if it stayed empty.
        const space = state.spaces[targetId]!;
        const first = space.groups[0]!;
        if (space.groups.length > 1 && !first.name && first.itemIds.length === 0) {
            state = { ...state, spaces: { ...state.spaces, [targetId]: { ...space, groups: space.groups.slice(1) } } };
        }
    }
    return { state, spaces, links };
}

/** Adds a restore point, newest first, keeping only the most recent few. */
export function addSnapshot(list: Snapshot[], state: AppState, reason: Snapshot['reason'], now = Date.now()): Snapshot[] {
    return [{ id: newId(), at: now, reason, state: { ...state, recents: [], usage: {} } }, ...list].slice(0, MAX_SNAPSHOTS);
}

/** Validates snapshots read from storage; unreadable ones are dropped. */
export function sanitizeSnapshots(raw: unknown): Snapshot[] {
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((entry): Snapshot[] => {
        if (!isDict(entry) || typeof entry.id !== 'string' || typeof entry.at !== 'number') return [];
        const state = upgrade(entry.state);
        if (!state) return [];
        const reason = entry.reason === 'reset' || entry.reason === 'restore' ? entry.reason : 'import';
        return [{ id: entry.id, at: entry.at, reason, state }];
    }).slice(0, MAX_SNAPSHOTS);
}

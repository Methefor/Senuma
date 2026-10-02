/** Reading backup files and merging them into a setup. Loaded with Settings, not at startup. */
import { BACKUP_KIND } from './backup';
import { fromLegacy } from './legacyConvert';
import { upgrade } from './migrate';
import { addGroup, addItem, addSpace, itemsOf } from './ops';
import { isDict } from './sanitize';
import type { AppState } from './types';

/**
 * Kinds written by earlier builds of this product. A file someone exported before the rename
 * must keep working, so these are read forever. (1.x exports have no kind and are handled below.)
 */
const EARLIER_KINDS: readonly string[] = ['browser-os-backup'];
const isBackupKind = (kind: unknown): boolean => kind === BACKUP_KIND || (typeof kind === 'string' && EARLIER_KINDS.includes(kind));

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
    // Two Spaces can share a name. The first one receives new links, and a link already in any
    // Space of that name counts as present, so merging the same setup twice adds nothing.
    const key = (name: string) => name.trim().toLowerCase();
    const byName = new Map<string, string>();
    for (const id of current.spaceOrder) if (!byName.has(key(current.spaces[id]!.name))) byName.set(key(current.spaces[id]!.name), id);

    for (const incomingId of incoming.spaceOrder) {
        const source = incoming.spaces[incomingId]!;
        let targetId = byName.get(key(source.name));
        if (!targetId) {
            const created = addSpace({ ...state, activeModeId: null }, { name: source.name, glyph: source.glyph, accent: source.accent, note: source.note, templateId: source.templateId });
            state = { ...created.state, activeModeId: state.activeModeId };
            targetId = created.id;
            byName.set(key(source.name), targetId);
            spaces++;
        }
        const sameName = state.spaceOrder.filter(id => key(state.spaces[id]!.name) === key(source.name));
        const existing = new Set([targetId, ...sameName].flatMap(id => itemsOf(state, state.spaces[id]!).map(i => i.url)));
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


/** Pure state transitions. Every function returns a new AppState and never mutates its input. */
import { ACCENTS, DEFAULT_PROVIDER_ID, MAX_DOCK, MAX_RECENTS, MAX_USAGE, newId } from './defaults';
import type { AppState, DockEntry, ID, Item, Mode, Prefs, SearchProvider, Space, SpaceGroup } from './types';
import { normalizeUrl, titleFromUrl } from './url';

export interface ItemDraft {
    title?: string;
    url: string;
    icon?: string;
}

function withSpace(s: AppState, spaceId: ID, fn: (space: Space) => Space): AppState {
    const space = s.spaces[spaceId];
    if (!space) return s;
    return { ...s, spaces: { ...s.spaces, [spaceId]: fn(space) } };
}

function mapGroups(space: Space, fn: (g: SpaceGroup) => SpaceGroup): Space {
    return { ...space, groups: space.groups.map(fn) };
}

function mapModes(s: AppState, fn: (mode: Mode) => Mode): Record<ID, Mode> {
    const modes: Record<ID, Mode> = {};
    for (const [id, mode] of Object.entries(s.modes)) modes[id] = fn(mode);
    return modes;
}

function insertAt<T>(list: readonly T[], index: number, value: T): T[] {
    const next = [...list];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, value);
    return next;
}

/** Moves `value` so it sits before `before` (or at the end). Returns the same array if nothing changes. */
function reorder<T>(list: readonly T[], value: T, before: T | null, same: (a: T, b: T) => boolean = Object.is): readonly T[] {
    const from = list.findIndex(x => same(x, value));
    if (from < 0 || (before !== null && same(before, value))) return list;
    const rest = list.filter((_, i) => i !== from);
    const at = before === null ? -1 : rest.findIndex(x => same(x, before));
    const next = insertAt(rest, at < 0 ? rest.length : at, list[from]!);
    return next.every((x, i) => x === list[i]) ? list : next;
}

export function itemIdsOf(space: Space): ID[] {
    return space.groups.flatMap(g => g.itemIds);
}

export function itemsOf(s: AppState, space: Space): Item[] {
    return itemIdsOf(space).map(id => s.items[id]).filter((i): i is Item => !!i);
}

export function locateItem(s: AppState, itemId: ID): { spaceId: ID; groupId: ID } | null {
    for (const spaceId of s.spaceOrder) {
        const group = s.spaces[spaceId]?.groups.find(g => g.itemIds.includes(itemId));
        if (group) return { spaceId, groupId: group.id };
    }
    return null;
}

export function activeMode(s: AppState): Mode | undefined {
    return s.activeModeId ? s.modes[s.activeModeId] : undefined;
}

/** Spaces shown on Home: all of them, or the active Mode's selection in the Mode's order. */
export function visibleSpaces(s: AppState): Space[] {
    const ids = activeMode(s)?.spaceIds ?? s.spaceOrder;
    return ids.map(id => s.spaces[id]).filter((sp): sp is Space => !!sp);
}

// ---------- Spaces ----------

export function addSpace(
    s: AppState,
    init: { name: string; glyph?: string; accent?: string; note?: string; templateId?: string },
): { state: AppState; id: ID } {
    const id = newId();
    const space: Space = {
        id,
        name: init.name.trim() || 'Untitled',
        glyph: init.glyph ?? 'folder',
        accent: init.accent ?? ACCENTS[s.spaceOrder.length % ACCENTS.length]!,
        groups: [{ id: newId(), name: '', itemIds: [] }],
        createdAt: Date.now(),
        ...(init.note?.trim() ? { note: init.note.trim() } : {}),
        ...(init.templateId ? { templateId: init.templateId } : {}),
    };
    const mode = activeMode(s);
    return {
        id,
        state: {
            ...s,
            spaces: { ...s.spaces, [id]: space },
            spaceOrder: [...s.spaceOrder, id],
            // A Space created while a Mode is active belongs to that Mode, or it would vanish.
            modes: mode ? { ...s.modes, [mode.id]: { ...mode, spaceIds: [...mode.spaceIds, id] } } : s.modes,
        },
    };
}

export function updateSpace(s: AppState, id: ID, patch: Partial<Pick<Space, 'name' | 'glyph' | 'accent' | 'note'>>): AppState {
    return withSpace(s, id, space => {
        const next: Space = { ...space, ...patch, name: patch.name?.trim() || space.name };
        if (patch.note !== undefined) {
            if (patch.note.trim()) next.note = patch.note.trim();
            else delete next.note;
        }
        return next;
    });
}

function withoutDockEntries(s: AppState, gone: (entry: DockEntry) => boolean): Pick<AppState, 'dock' | 'modes'> {
    return {
        dock: s.dock.filter(e => !gone(e)),
        modes: mapModes(s, mode => (mode.dock ? { ...mode, dock: mode.dock.filter(e => !gone(e)) } : mode)),
    };
}

export function removeSpace(s: AppState, id: ID): AppState {
    const space = s.spaces[id];
    if (!space) return s;
    const itemIds = new Set(itemIdsOf(space));
    const items = { ...s.items };
    for (const itemId of itemIds) delete items[itemId];
    const spaces = { ...s.spaces };
    delete spaces[id];
    const cleaned = withoutDockEntries(s, e => (e.kind === 'space' ? e.id === id : itemIds.has(e.id)));
    const modes: Record<ID, Mode> = {};
    for (const [modeId, mode] of Object.entries(cleaned.modes)) {
        modes[modeId] = { ...mode, spaceIds: mode.spaceIds.filter(x => x !== id) };
    }
    return { ...s, items, spaces, modes, dock: cleaned.dock, spaceOrder: s.spaceOrder.filter(x => x !== id) };
}

export function duplicateSpace(s: AppState, id: ID, copyName: string): { state: AppState; id: ID | null } {
    const source = s.spaces[id];
    if (!source) return { state: s, id: null };
    const created = addSpace(s, { name: copyName, glyph: source.glyph, accent: source.accent, note: source.note });
    const items = { ...created.state.items };
    const groups = source.groups.map(g => ({
        id: newId(),
        name: g.name,
        itemIds: g.itemIds.flatMap(itemId => {
            const item = s.items[itemId];
            if (!item) return [];
            const copy: Item = { ...item, id: newId(), createdAt: Date.now() };
            items[copy.id] = copy;
            return [copy.id];
        }),
    }));
    const state = withSpace({ ...created.state, items }, created.id, space => ({ ...space, groups }));
    return { state, id: created.id };
}

/**
 * Places a Space before another (or last). `visible` reorders what Home shows — the active
 * Mode's own order when a Mode is on — while `all` always reorders the master list.
 */
export function reorderSpace(s: AppState, id: ID, beforeId: ID | null, scope: 'visible' | 'all' = 'visible'): AppState {
    const mode = scope === 'visible' ? activeMode(s) : undefined;
    if (mode) {
        const spaceIds = reorder(mode.spaceIds, id, beforeId);
        return spaceIds === mode.spaceIds ? s : { ...s, modes: { ...s.modes, [mode.id]: { ...mode, spaceIds: [...spaceIds] } } };
    }
    const spaceOrder = reorder(s.spaceOrder, id, beforeId);
    return spaceOrder === s.spaceOrder ? s : { ...s, spaceOrder: [...spaceOrder] };
}

/** Keyboard reordering: one step earlier (-1) or later (+1). */
export function shiftSpace(s: AppState, id: ID, delta: -1 | 1, scope: 'visible' | 'all' = 'visible'): AppState {
    const order = (scope === 'visible' ? activeMode(s)?.spaceIds : undefined) ?? s.spaceOrder;
    const from = order.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= order.length) return s;
    // Moving later means landing before the item two places on.
    return reorderSpace(s, id, delta < 0 ? order[to]! : (order[to + 1] ?? null), scope);
}

// ---------- Groups ----------

export function addGroup(s: AppState, spaceId: ID, name: string): AppState {
    return withSpace(s, spaceId, space => ({
        ...space,
        groups: [...space.groups, { id: newId(), name: name.trim(), itemIds: [] }],
    }));
}

export function renameGroup(s: AppState, spaceId: ID, groupId: ID, name: string): AppState {
    return withSpace(s, spaceId, space => mapGroups(space, g => (g.id === groupId ? { ...g, name: name.trim() } : g)));
}

export function shiftGroup(s: AppState, spaceId: ID, groupId: ID, delta: -1 | 1): AppState {
    return withSpace(s, spaceId, space => {
        const from = space.groups.findIndex(g => g.id === groupId);
        const to = from + delta;
        if (from < 0 || to < 0 || to >= space.groups.length) return space;
        const groups = [...space.groups];
        groups.splice(to, 0, groups.splice(from, 1)[0]!);
        return { ...space, groups };
    });
}

/** Removes a group; its items move to the neighbouring group so nothing is lost. */
export function removeGroup(s: AppState, spaceId: ID, groupId: ID): AppState {
    return withSpace(s, spaceId, space => {
        const index = space.groups.findIndex(g => g.id === groupId);
        if (index < 0 || space.groups.length < 2) return space;
        const removed = space.groups[index]!;
        const rest = space.groups.filter(g => g.id !== groupId);
        const heir = rest[Math.max(0, index - 1)]!;
        return {
            ...space,
            groups: rest.map(g => (g.id === heir.id ? { ...g, itemIds: [...g.itemIds, ...removed.itemIds] } : g)),
        };
    });
}

// ---------- Items ----------

export function addItem(s: AppState, spaceId: ID, groupId: ID | null, draft: ItemDraft): { state: AppState; id: ID | null } {
    const space = s.spaces[spaceId];
    const url = normalizeUrl(draft.url);
    if (!space || !url) return { state: s, id: null };
    const target = space.groups.find(g => g.id === groupId) ?? space.groups[0]!;
    const item: Item = {
        id: newId(),
        title: draft.title?.trim() || titleFromUrl(url),
        url,
        createdAt: Date.now(),
        ...(draft.icon?.trim() ? { icon: draft.icon.trim() } : {}),
    };
    const state = withSpace({ ...s, items: { ...s.items, [item.id]: item } }, spaceId, sp =>
        mapGroups(sp, g => (g.id === target.id ? { ...g, itemIds: [...g.itemIds, item.id] } : g)),
    );
    return { state, id: item.id };
}

export function updateItem(s: AppState, id: ID, patch: Partial<ItemDraft>): AppState {
    const item = s.items[id];
    if (!item) return s;
    const next: Item = { ...item };
    if (patch.url !== undefined) {
        const url = normalizeUrl(patch.url);
        if (!url) return s;
        next.url = url;
    }
    if (patch.title !== undefined) next.title = patch.title.trim() || titleFromUrl(next.url);
    if (patch.icon !== undefined) {
        if (patch.icon.trim()) next.icon = patch.icon.trim();
        else delete next.icon;
    }
    return { ...s, items: { ...s.items, [id]: next } };
}

export function removeItem(s: AppState, id: ID): AppState {
    if (!s.items[id]) return s;
    const where = locateItem(s, id);
    const items = { ...s.items };
    delete items[id];
    const next = { ...s, items, ...withoutDockEntries(s, e => e.kind === 'item' && e.id === id) };
    if (!where) return next;
    return withSpace(next, where.spaceId, space =>
        mapGroups(space, g => ({ ...g, itemIds: g.itemIds.filter(x => x !== id) })),
    );
}

/** Moves an item to a group (in any Space), before `beforeId` or at the end. */
export function moveItem(s: AppState, id: ID, toSpaceId: ID, toGroupId: ID | null, beforeId?: ID): AppState {
    const where = locateItem(s, id);
    const target = s.spaces[toSpaceId];
    if (!where || !target || id === beforeId) return s;
    const groupId = target.groups.find(g => g.id === toGroupId)?.id ?? target.groups[0]!.id;
    const detached = withSpace(s, where.spaceId, space =>
        mapGroups(space, g => ({ ...g, itemIds: g.itemIds.filter(x => x !== id) })),
    );
    return withSpace(detached, toSpaceId, space =>
        mapGroups(space, g => {
            if (g.id !== groupId) return g;
            const at = beforeId ? g.itemIds.indexOf(beforeId) : -1;
            return { ...g, itemIds: insertAt(g.itemIds, at < 0 ? g.itemIds.length : at, id) };
        }),
    );
}

// ---------- Undo: capture what a removal takes away, restore exactly that ----------

interface DockPlacement {
    /** Null is the shared dock; otherwise the Mode whose own dock held the entry. */
    modeId: ID | null;
    entry: DockEntry;
    index: number;
}

function captureDock(s: AppState, gone: (entry: DockEntry) => boolean): DockPlacement[] {
    const placements: DockPlacement[] = [];
    s.dock.forEach((entry, index) => gone(entry) && placements.push({ modeId: null, entry, index }));
    for (const mode of Object.values(s.modes)) {
        mode.dock?.forEach((entry, index) => gone(entry) && placements.push({ modeId: mode.id, entry, index }));
    }
    return placements;
}

function restoreDock(s: AppState, placements: DockPlacement[]): AppState {
    let state = s;
    for (const { modeId, entry, index } of placements) {
        if (modeId === null) state = { ...state, dock: insertAt(state.dock, index, entry) };
        else {
            const mode = state.modes[modeId];
            if (mode?.dock) state = { ...state, modes: { ...state.modes, [modeId]: { ...mode, dock: insertAt(mode.dock, index, entry) } } };
        }
    }
    return state;
}

export interface RemovedItem {
    item: Item;
    spaceId: ID;
    groupId: ID;
    index: number;
    dock: DockPlacement[];
}

export function captureItem(s: AppState, id: ID): RemovedItem | null {
    const item = s.items[id];
    const where = locateItem(s, id);
    if (!item || !where) return null;
    const group = s.spaces[where.spaceId]!.groups.find(g => g.id === where.groupId)!;
    return { item, ...where, index: group.itemIds.indexOf(id), dock: captureDock(s, e => e.kind === 'item' && e.id === id) };
}

/** Puts a removed item back where it was. A no-op if its Space is gone or it already exists. */
export function restoreItem(s: AppState, removed: RemovedItem): AppState {
    const space = s.spaces[removed.spaceId];
    if (!space || s.items[removed.item.id]) return s;
    const group = space.groups.find(g => g.id === removed.groupId) ?? space.groups[0]!;
    const state = withSpace({ ...s, items: { ...s.items, [removed.item.id]: removed.item } }, space.id, sp =>
        mapGroups(sp, g => (g.id === group.id ? { ...g, itemIds: insertAt(g.itemIds, removed.index, removed.item.id) } : g)),
    );
    return restoreDock(state, removed.dock);
}

export interface RemovedSpace {
    space: Space;
    items: Item[];
    index: number;
    modes: { modeId: ID; index: number }[];
    dock: DockPlacement[];
}

export function captureSpace(s: AppState, id: ID): RemovedSpace | null {
    const space = s.spaces[id];
    if (!space) return null;
    const itemIds = new Set(itemIdsOf(space));
    return {
        space,
        items: itemsOf(s, space),
        index: s.spaceOrder.indexOf(id),
        modes: Object.values(s.modes).flatMap(m => (m.spaceIds.includes(id) ? [{ modeId: m.id, index: m.spaceIds.indexOf(id) }] : [])),
        dock: captureDock(s, e => (e.kind === 'space' ? e.id === id : itemIds.has(e.id))),
    };
}

/** Restores a deleted Space with its groups, links, position, Mode membership and dock entries. */
export function restoreSpace(s: AppState, removed: RemovedSpace): AppState {
    if (s.spaces[removed.space.id]) return s;
    const items = { ...s.items };
    for (const item of removed.items) items[item.id] = item;
    let modes = s.modes;
    for (const { modeId, index } of removed.modes) {
        const mode = modes[modeId];
        if (mode) modes = { ...modes, [modeId]: { ...mode, spaceIds: insertAt(mode.spaceIds, index, removed.space.id) } };
    }
    const state: AppState = {
        ...s,
        items,
        modes,
        spaces: { ...s.spaces, [removed.space.id]: removed.space },
        spaceOrder: insertAt(s.spaceOrder, removed.index, removed.space.id),
    };
    return restoreDock(state, removed.dock);
}

export interface RemovedGroup {
    spaceId: ID;
    group: SpaceGroup;
    index: number;
}

export function captureGroup(s: AppState, spaceId: ID, groupId: ID): RemovedGroup | null {
    const space = s.spaces[spaceId];
    const index = space?.groups.findIndex(g => g.id === groupId) ?? -1;
    return space && index >= 0 ? { spaceId, group: space.groups[index]!, index } : null;
}

/** Re-creates a deleted group and takes back the links that were moved out of it. */
export function restoreGroup(s: AppState, removed: RemovedGroup): AppState {
    return withSpace(s, removed.spaceId, space => {
        if (space.groups.some(g => g.id === removed.group.id)) return space;
        const present = new Set(itemIdsOf(space));
        const itemIds = removed.group.itemIds.filter(id => present.has(id));
        const taken = new Set(itemIds);
        const groups = space.groups.map(g => ({ ...g, itemIds: g.itemIds.filter(id => !taken.has(id)) }));
        return { ...space, groups: insertAt(groups, removed.index, { ...removed.group, itemIds }) };
    });
}

// ---------- Dock ----------

const sameEntry = (a: DockEntry, b: DockEntry) => a.kind === b.kind && a.id === b.id;

/** The dock in effect: the active Mode's own dock when it has one, else the shared dock. */
export function activeDock(s: AppState): DockEntry[] {
    return activeMode(s)?.dock ?? s.dock;
}

export function isDocked(s: AppState, entry: DockEntry): boolean {
    return activeDock(s).some(e => sameEntry(e, entry));
}

function withActiveDock(s: AppState, fn: (dock: DockEntry[]) => readonly DockEntry[]): AppState {
    const mode = activeMode(s);
    const current = mode?.dock ?? s.dock;
    const next = fn(current);
    if (next === current) return s;
    return mode?.dock ? { ...s, modes: { ...s.modes, [mode.id]: { ...mode, dock: [...next] } } } : { ...s, dock: [...next] };
}

export function toggleDock(s: AppState, entry: DockEntry): AppState {
    const exists = entry.kind === 'item' ? !!s.items[entry.id] : !!s.spaces[entry.id];
    if (!exists) return s;
    return withActiveDock(s, dock => {
        if (dock.some(e => sameEntry(e, entry))) return dock.filter(e => !sameEntry(e, entry));
        return dock.length >= MAX_DOCK ? dock : [...dock, entry];
    });
}

export function reorderDock(s: AppState, entry: DockEntry, before: DockEntry | null): AppState {
    return withActiveDock(s, dock => reorder(dock, entry, before, sameEntry));
}

/** Gives a Mode its own dock (starting as a copy of the shared one) or returns it to the shared dock. */
export function setModeDock(s: AppState, modeId: ID, own: boolean): AppState {
    const mode = s.modes[modeId];
    if (!mode || !!mode.dock === own) return s;
    const next: Mode = { ...mode };
    if (own) next.dock = [...s.dock];
    else delete next.dock;
    return { ...s, modes: { ...s.modes, [modeId]: next } };
}

// ---------- Modes ----------

export function addMode(s: AppState, init: Omit<Mode, 'id'>): { state: AppState; id: ID } {
    const id = newId();
    return {
        id,
        state: { ...s, modes: { ...s.modes, [id]: { ...init, id } }, modeOrder: [...s.modeOrder, id] },
    };
}

export function updateMode(s: AppState, id: ID, patch: Partial<Pick<Mode, 'name' | 'glyph' | 'spaceIds' | 'themeId' | 'providerId'>>): AppState {
    const mode = s.modes[id];
    if (!mode) return s;
    const next: Mode = { ...mode, ...patch, name: patch.name?.trim() || mode.name };
    if (!next.themeId) delete next.themeId;
    if (!next.providerId) delete next.providerId;
    return { ...s, modes: { ...s.modes, [id]: next } };
}

export function removeMode(s: AppState, id: ID): AppState {
    if (!s.modes[id]) return s;
    const modes = { ...s.modes };
    delete modes[id];
    return {
        ...s,
        modes,
        modeOrder: s.modeOrder.filter(x => x !== id),
        activeModeId: s.activeModeId === id ? null : s.activeModeId,
    };
}

export interface RemovedMode {
    mode: Mode;
    index: number;
    wasActive: boolean;
}

export function captureMode(s: AppState, id: ID): RemovedMode | null {
    const mode = s.modes[id];
    return mode ? { mode, index: s.modeOrder.indexOf(id), wasActive: s.activeModeId === id } : null;
}

/** Restores a deleted Mode; Spaces and dock entries deleted in the meantime are left out. */
export function restoreMode(s: AppState, removed: RemovedMode): AppState {
    if (s.modes[removed.mode.id]) return s;
    const mode: Mode = { ...removed.mode, spaceIds: removed.mode.spaceIds.filter(id => s.spaces[id]) };
    if (mode.dock) mode.dock = mode.dock.filter(e => (e.kind === 'item' ? s.items[e.id] : s.spaces[e.id]));
    return {
        ...s,
        modes: { ...s.modes, [mode.id]: mode },
        modeOrder: insertAt(s.modeOrder, removed.index, mode.id),
        activeModeId: removed.wasActive ? mode.id : s.activeModeId,
    };
}

export function setActiveMode(s: AppState, id: ID | null): AppState {
    const next = id && s.modes[id] ? id : null;
    return next === s.activeModeId ? s : { ...s, activeModeId: next };
}

/** Theme and search default in effect: the active Mode's override, else the user's preference. */
export function effectiveThemeId(s: AppState): string {
    return activeMode(s)?.themeId || s.prefs.themeId;
}

export function effectiveProviderId(s: AppState): ID {
    return activeMode(s)?.providerId || s.prefs.defaultProviderId;
}

// ---------- Continue & usage ----------

export function recordRecent(s: AppState, entry: { url: string; title: string; spaceId?: ID }): AppState {
    const previous = s.recents.find(r => r.url === entry.url);
    const recent = { ...entry, at: Date.now(), count: (previous?.count ?? 0) + 1 };
    return { ...s, recents: [recent, ...s.recents.filter(r => r.url !== entry.url)].slice(0, MAX_RECENTS) };
}

export function removeRecent(s: AppState, url: string): AppState {
    return { ...s, recents: s.recents.filter(r => r.url !== url) };
}

/** Remembers that a command-center result was chosen, so it ranks higher next time. */
export function recordUsage(s: AppState, key: string): AppState {
    const entries = Object.entries({ ...s.usage, [key]: Date.now() }).sort((a, b) => b[1] - a[1]).slice(0, MAX_USAGE);
    return { ...s, usage: Object.fromEntries(entries) };
}

// ---------- Preferences & search ----------

export function setPrefs(s: AppState, patch: Partial<Prefs>): AppState {
    return { ...s, prefs: { ...s.prefs, ...patch } };
}

export function parseAliases(text: string): string[] {
    return [...new Set(text.toLowerCase().split(/[\s,]+/).filter(a => /^[a-z\d]{1,12}$/.test(a)))];
}

/** True when the template is a usable http(s) URL with a query placeholder. */
export function isValidTemplate(template: string): boolean {
    return template.includes('%s') && /^https?:\/\//i.test(template.trim()) && !!normalizeUrl(template.trim().replace('%s', 'q'));
}

export function upsertProvider(s: AppState, provider: SearchProvider): AppState {
    const exists = s.providers.some(p => p.id === provider.id);
    return {
        ...s,
        providers: exists ? s.providers.map(p => (p.id === provider.id ? provider : p)) : [...s.providers, provider],
    };
}

export function removeProvider(s: AppState, id: ID): AppState {
    const target = s.providers.find(p => p.id === id);
    if (!target || target.builtin) return s;
    return {
        ...s,
        modes: mapModes(s, mode => {
            if (mode.providerId !== id) return mode;
            const next = { ...mode };
            delete next.providerId;
            return next;
        }),
        providers: s.providers.filter(p => p.id !== id),
        prefs: s.prefs.defaultProviderId === id ? { ...s.prefs, defaultProviderId: DEFAULT_PROVIDER_ID } : s.prefs,
    };
}

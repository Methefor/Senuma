/** Pure state transitions. Every function returns a new AppState and never mutates its input. */
import { ACCENTS, MAX_RECENTS, newId } from './defaults';
import type { AppState, ID, Item, Mode, Prefs, SearchProvider, Space, SpaceGroup } from './types';
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

/** Spaces shown on Home: all of them, or the active Mode's selection in the Mode's order. */
export function visibleSpaces(s: AppState): Space[] {
    const mode = s.activeModeId ? s.modes[s.activeModeId] : undefined;
    const ids = mode ? mode.spaceIds : s.spaceOrder;
    return ids.map(id => s.spaces[id]).filter((sp): sp is Space => !!sp);
}

export function pinnedItems(s: AppState): Item[] {
    return s.spaceOrder
        .flatMap(id => (s.spaces[id] ? itemsOf(s, s.spaces[id]) : []))
        .filter(i => i.pinned);
}

// ---------- Spaces ----------

export function addSpace(
    s: AppState,
    init: { name: string; glyph?: string; accent?: string; templateId?: string },
): { state: AppState; id: ID } {
    const id = newId();
    const space: Space = {
        id,
        name: init.name.trim() || 'Untitled',
        glyph: init.glyph ?? 'folder',
        accent: init.accent ?? ACCENTS[s.spaceOrder.length % ACCENTS.length]!,
        groups: [{ id: newId(), name: '', itemIds: [] }],
        createdAt: Date.now(),
        ...(init.templateId ? { templateId: init.templateId } : {}),
    };
    const mode = s.activeModeId ? s.modes[s.activeModeId] : undefined;
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

export function updateSpace(s: AppState, id: ID, patch: Partial<Pick<Space, 'name' | 'glyph' | 'accent'>>): AppState {
    return withSpace(s, id, space => ({
        ...space,
        ...patch,
        name: patch.name !== undefined ? patch.name.trim() || space.name : space.name,
    }));
}

export function removeSpace(s: AppState, id: ID): AppState {
    const space = s.spaces[id];
    if (!space) return s;
    const items = { ...s.items };
    for (const itemId of itemIdsOf(space)) delete items[itemId];
    const spaces = { ...s.spaces };
    delete spaces[id];
    const modes: Record<ID, Mode> = {};
    for (const [modeId, mode] of Object.entries(s.modes)) {
        modes[modeId] = { ...mode, spaceIds: mode.spaceIds.filter(x => x !== id) };
    }
    return { ...s, items, spaces, modes, spaceOrder: s.spaceOrder.filter(x => x !== id) };
}

export function duplicateSpace(s: AppState, id: ID, copyName: string): { state: AppState; id: ID | null } {
    const source = s.spaces[id];
    if (!source) return { state: s, id: null };
    const created = addSpace(s, { name: copyName, glyph: source.glyph, accent: source.accent });
    const items = { ...created.state.items };
    const groups = source.groups.map(g => ({
        id: newId(),
        name: g.name,
        itemIds: g.itemIds.flatMap(itemId => {
            const item = s.items[itemId];
            if (!item) return [];
            const copy: Item = { ...item, id: newId(), pinned: false, createdAt: Date.now() };
            items[copy.id] = copy;
            return [copy.id];
        }),
    }));
    const state = withSpace({ ...created.state, items }, created.id, space => ({ ...space, groups }));
    return { state, id: created.id };
}

export function moveSpace(s: AppState, id: ID, delta: number): AppState {
    const from = s.spaceOrder.indexOf(id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= s.spaceOrder.length) return s;
    const order = [...s.spaceOrder];
    order.splice(from, 1);
    order.splice(to, 0, id);
    return { ...s, spaceOrder: order };
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
    const where = locateItem(s, id);
    const items = { ...s.items };
    delete items[id];
    const next = { ...s, items };
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
            const ids = [...g.itemIds];
            ids.splice(at < 0 ? ids.length : at, 0, id);
            return { ...g, itemIds: ids };
        }),
    );
}

export function togglePin(s: AppState, id: ID): AppState {
    const item = s.items[id];
    if (!item) return s;
    return { ...s, items: { ...s.items, [id]: { ...item, pinned: !item.pinned } } };
}

// ---------- Modes ----------

export function addMode(s: AppState, init: Omit<Mode, 'id'>): { state: AppState; id: ID } {
    const id = newId();
    return {
        id,
        state: { ...s, modes: { ...s.modes, [id]: { ...init, id } }, modeOrder: [...s.modeOrder, id] },
    };
}

export function updateMode(s: AppState, id: ID, patch: Partial<Omit<Mode, 'id'>>): AppState {
    const mode = s.modes[id];
    if (!mode) return s;
    const next: Mode = { ...mode, ...patch };
    if (!next.themeId) delete next.themeId;
    if (!next.providerId) delete next.providerId;
    return { ...s, modes: { ...s.modes, [id]: next } };
}

export function removeMode(s: AppState, id: ID): AppState {
    const modes = { ...s.modes };
    delete modes[id];
    return {
        ...s,
        modes,
        modeOrder: s.modeOrder.filter(x => x !== id),
        activeModeId: s.activeModeId === id ? null : s.activeModeId,
    };
}

export function setActiveMode(s: AppState, id: ID | null): AppState {
    return { ...s, activeModeId: id && s.modes[id] ? id : null };
}

/** Theme and search default in effect: the active Mode's override, else the user's preference. */
export function effectiveThemeId(s: AppState): string {
    return (s.activeModeId && s.modes[s.activeModeId]?.themeId) || s.prefs.themeId;
}

export function effectiveProviderId(s: AppState): ID {
    return (s.activeModeId && s.modes[s.activeModeId]?.providerId) || s.prefs.defaultProviderId;
}

// ---------- Continue ----------

export function recordRecent(s: AppState, entry: { url: string; title: string }): AppState {
    const recents = [{ ...entry, at: Date.now() }, ...s.recents.filter(r => r.url !== entry.url)];
    return { ...s, recents: recents.slice(0, MAX_RECENTS) };
}

export function removeRecent(s: AppState, url: string): AppState {
    return { ...s, recents: s.recents.filter(r => r.url !== url) };
}

// ---------- Preferences & search ----------

export function setPrefs(s: AppState, patch: Partial<Prefs>): AppState {
    return { ...s, prefs: { ...s.prefs, ...patch } };
}

export function parseAliases(text: string): string[] {
    return [...new Set(text.toLowerCase().split(/[\s,]+/).filter(a => /^[a-z\d]{1,12}$/.test(a)))];
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
    const modes: Record<ID, Mode> = {};
    for (const [modeId, mode] of Object.entries(s.modes)) {
        modes[modeId] = mode.providerId === id ? updateModeProvider(mode) : mode;
    }
    return {
        ...s,
        modes,
        providers: s.providers.filter(p => p.id !== id),
        prefs: s.prefs.defaultProviderId === id ? { ...s.prefs, defaultProviderId: 'default' } : s.prefs,
    };
}

function updateModeProvider(mode: Mode): Mode {
    const next = { ...mode };
    delete next.providerId;
    return next;
}

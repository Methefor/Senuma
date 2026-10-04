/** Building Spaces from the catalog: onboarding starters and organizing imported links. */
import { CATEGORIES, MODE_PRESETS, categorize, categoryById, type Service } from './catalog';
import { addGroup, addItem, addMode, addSpace, itemsOf } from './ops';
import type { AppState, ID, LooseLink, SpaceGroup } from './types';
import { normalizeUrl } from './url';

/** Display strings are supplied by the caller so this module stays language-agnostic. */
export interface SetupNames {
    category: (id: string) => string;
    /** A catalog group's name; the key '' is an untitled group. */
    group: (key: string) => string;
    mode: (key: string) => string;
    otherSpace: string;
    importedGroup: string;
}

function spaceForCategory(s: AppState, categoryId: string): ID | undefined {
    return s.spaceOrder.find(id => s.spaces[id]?.templateId === categoryId);
}

function createCategorySpace(s: AppState, categoryId: string, names: SetupNames, withServices: boolean): { state: AppState; id: ID } {
    const category = categoryById(categoryId);
    const created = addSpace(s, { name: names.category(categoryId), nameKey: `cat.${categoryId}`, glyph: category?.glyph, accent: category?.accent, templateId: categoryId });
    return { state: withServices ? fillFromCategory(created.state, created.id, categoryId, names) : created.state, id: created.id };
}

/**
 * The group a catalog group's services go into: the one made for it earlier (by key, or by its
 * name from before keys were stored), else an untouched first group, else a new one.
 */
function groupFor(s: AppState, spaceId: ID, key: string, names: SetupNames): { state: AppState; groupId: ID } {
    const space = s.spaces[spaceId]!;
    const name = key ? names.group(key) : '';
    const nameKey = key ? `catgroup.${key}` : undefined;
    const found = space.groups.find(g => (nameKey ? g.nameKey === nameKey || (!g.nameKey && g.name === name) : !g.name));
    if (found) return { state: s, groupId: found.id };
    const first = space.groups[0]!;
    if (space.groups.length === 1 && !first.name && first.itemIds.length === 0) {
        const named: SpaceGroup = { ...first, name, ...(nameKey ? { nameKey } : {}) };
        return { state: { ...s, spaces: { ...s.spaces, [spaceId]: { ...space, groups: [named] } } }, groupId: first.id };
    }
    const state = addGroup(s, spaceId, name, nameKey);
    return { state, groupId: state.spaces[spaceId]!.groups.at(-1)!.id };
}

/** Adds one suggested service to a Space, in its catalog group. Unchanged if the Space already has that address. */
export function addService(s: AppState, spaceId: ID, groupKey: string, [title, url]: Service, names: SetupNames): AppState {
    if (!s.spaces[spaceId] || itemsOf(s, s.spaces[spaceId]).some(i => i.url === normalizeUrl(url))) return s;
    const { state, groupId } = groupFor(s, spaceId, groupKey, names);
    return addItem(state, spaceId, groupId, { title, url }).state;
}

/** Adds a category's starter services to an existing Space, in their groups, skipping links it already has. */
export function fillFromCategory(s: AppState, spaceId: ID, categoryId: string, names: SetupNames): AppState {
    const category = categoryById(categoryId);
    if (!category || !s.spaces[spaceId]) return s;
    let state = s;
    for (const group of category.groups) for (const service of group.services) state = addService(state, spaceId, group.key, service, names);
    return state;
}

/** Onboarding: one starter Space per chosen category, plus Modes when at least two apply. */
export function applyStarter(s: AppState, categoryIds: string[], names: SetupNames): AppState {
    let state = s;
    const created = new Map<string, ID>();
    for (const category of CATEGORIES) {
        if (!categoryIds.includes(category.id) || spaceForCategory(state, category.id)) continue;
        const result = createCategorySpace(state, category.id, names, true);
        state = result.state;
        created.set(category.id, result.id);
    }
    const presets = MODE_PRESETS.filter(p => p.needs.some(c => created.has(c)));
    if (presets.length >= 2 && state.modeOrder.length === 0) {
        for (const preset of presets) {
            const spaceIds = preset.includes.flatMap(c => created.get(c) ?? []);
            state = addMode(state, { name: names.mode(preset.key), nameKey: `modePreset.${preset.key}`, glyph: preset.glyph, spaceIds }).state;
        }
    }
    return state;
}

export interface Proposal {
    /** Null collects everything that matched no known category. */
    categoryId: string | null;
    links: LooseLink[];
}

/** Sorts loose links into per-category proposals. Invalid and duplicate URLs are dropped. */
export function organize(links: LooseLink[]): Proposal[] {
    const seen = new Set<string>();
    const buckets = new Map<string | null, LooseLink[]>();
    for (const link of links) {
        const url = normalizeUrl(link.url);
        if (!url || seen.has(url)) continue;
        seen.add(url);
        const key = categorize(url);
        const bucket = buckets.get(key) ?? [];
        bucket.push({ ...link, url });
        buckets.set(key, bucket);
    }
    const proposals: Proposal[] = [];
    for (const category of CATEGORIES) {
        const bucket = buckets.get(category.id);
        if (bucket) proposals.push({ categoryId: category.id, links: bucket });
    }
    const other = buckets.get(null);
    if (other) proposals.push({ categoryId: null, links: other });
    return proposals;
}

/**
 * Adds proposed links. Categorized links merge into the matching Space (created if missing);
 * the rest go to one "other" Space, grouped by the folder they came from.
 */
export function applyProposals(s: AppState, proposals: Proposal[], names: SetupNames): { state: AppState; added: number } {
    let state = s;
    let added = 0;
    for (const proposal of proposals) {
        const key = proposal.categoryId ?? 'imported';
        let spaceId = spaceForCategory(state, key);
        const isNew = !spaceId;
        if (!spaceId) {
            const result = proposal.categoryId
                ? createCategorySpace(state, key, names, false)
                : addSpace(state, { name: names.otherSpace, nameKey: 'import.otherSpace', glyph: 'folder', templateId: key });
            state = result.state;
            spaceId = result.id;
        }
        const existing = new Set(itemsOf(state, state.spaces[spaceId]!).map(i => i.url));
        const groupIds = new Map<string, ID>();
        for (const link of proposal.links) {
            if (existing.has(link.url)) continue;
            // Uncategorized links keep their source folder as the group; merges into an
            // existing Space land in an "Imported" group so the user's own layout is untouched.
            const groupName = proposal.categoryId ? (isNew ? '' : names.importedGroup) : (link.folder ?? '');
            let groupId = groupIds.get(groupName);
            if (!groupId) {
                const space = state.spaces[spaceId]!;
                groupId = space.groups.find(g => g.name === groupName)?.id;
                if (!groupId) {
                    state = addGroup(state, spaceId, groupName, proposal.categoryId && !isNew ? 'import.importedGroup' : undefined);
                    groupId = state.spaces[spaceId]!.groups.at(-1)!.id;
                }
                groupIds.set(groupName, groupId);
            }
            const result = addItem(state, spaceId, groupId, { title: link.title, url: link.url });
            if (result.id) {
                state = result.state;
                existing.add(link.url);
                added++;
            }
        }
        state = dropEmptyLeadingGroup(state, spaceId);
    }
    return { state, added };
}

/** A fresh Space starts with one untitled group; remove it if the import filled only named ones. */
function dropEmptyLeadingGroup(s: AppState, spaceId: ID): AppState {
    const space = s.spaces[spaceId]!;
    const first = space.groups[0]!;
    if (space.groups.length < 2 || first.name || first.itemIds.length) return s;
    return { ...s, spaces: { ...s.spaces, [spaceId]: { ...space, groups: space.groups.slice(1) } } };
}

/** One URL per line, optionally "Title | URL" or "Title, URL". */
export function parseUrlList(text: string): LooseLink[] {
    return text.split(/\r?\n/).flatMap(line => {
        const parts = line.split(/\s*[|,\t]\s*|\s+(?=\S+$)/).map(p => p.trim()).filter(Boolean);
        const urlPart = parts.find(p => normalizeUrl(p));
        if (!urlPart) return [];
        const title = parts.filter(p => p !== urlPart).join(' ');
        return [{ title, url: urlPart }];
    });
}

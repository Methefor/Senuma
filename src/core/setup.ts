/** Building Spaces from the catalog: onboarding starters and organizing imported links. */
import { CATEGORIES, MODE_PRESETS, categorize, categoryById } from './catalog';
import { addGroup, addItem, addMode, addSpace, itemsOf } from './ops';
import type { AppState, ID, LooseLink } from './types';
import { normalizeUrl } from './url';

/** Display strings are supplied by the caller so this module stays language-agnostic. */
export interface SetupNames {
    category: (id: string) => string;
    mode: (key: string) => string;
    otherSpace: string;
    importedGroup: string;
}

function spaceForCategory(s: AppState, categoryId: string): ID | undefined {
    return s.spaceOrder.find(id => s.spaces[id]?.templateId === categoryId);
}

function createCategorySpace(s: AppState, categoryId: string, name: string, withServices: boolean): { state: AppState; id: ID } {
    const category = categoryById(categoryId);
    const created = addSpace(s, { name, glyph: category?.glyph, accent: category?.accent, templateId: categoryId });
    let state = created.state;
    if (!category || !withServices) return { state, id: created.id };
    category.groups.forEach((group, index) => {
        let groupId = state.spaces[created.id]!.groups[0]!.id;
        if (index === 0) {
            state = { ...state, spaces: { ...state.spaces, [created.id]: renameFirstGroup(state, created.id, group.name) } };
        } else {
            state = addGroup(state, created.id, group.name);
            groupId = state.spaces[created.id]!.groups.at(-1)!.id;
        }
        for (const [title, url] of group.services) state = addItem(state, created.id, groupId, { title, url }).state;
    });
    return { state, id: created.id };
}

function renameFirstGroup(s: AppState, spaceId: ID, name: string) {
    const space = s.spaces[spaceId]!;
    return { ...space, groups: space.groups.map((g, i) => (i === 0 ? { ...g, name } : g)) };
}

/** Onboarding: one starter Space per chosen category, plus Modes when at least two apply. */
export function applyStarter(s: AppState, categoryIds: string[], names: SetupNames): AppState {
    let state = s;
    const created = new Map<string, ID>();
    for (const category of CATEGORIES) {
        if (!categoryIds.includes(category.id) || spaceForCategory(state, category.id)) continue;
        const result = createCategorySpace(state, category.id, names.category(category.id), true);
        state = result.state;
        created.set(category.id, result.id);
    }
    const presets = MODE_PRESETS.filter(p => p.needs.some(c => created.has(c)));
    if (presets.length >= 2 && state.modeOrder.length === 0) {
        for (const preset of presets) {
            const spaceIds = preset.includes.flatMap(c => created.get(c) ?? []);
            state = addMode(state, { name: names.mode(preset.key), glyph: preset.glyph, spaceIds }).state;
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
            const name = proposal.categoryId ? names.category(proposal.categoryId) : names.otherSpace;
            const result = proposal.categoryId
                ? createCategorySpace(state, key, name, false)
                : addSpace(state, { name, glyph: 'folder', templateId: key });
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
                    state = addGroup(state, spaceId, groupName);
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

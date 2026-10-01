/**
 * Rebuilds a trustworthy AppState from anything read off disk or imported. Damaged entries
 * are dropped one by one, so a single corrupted record can never break the page.
 */
import { BUILTIN_PROVIDERS, DEFAULT_PREFS, MAX_RECENTS, emptyState, newId } from './defaults';
import { parseAliases } from './ops';
import { SCHEMA_VERSION, type AppState, type ID, type Item, type Mode, type Prefs, type SearchProvider, type Space } from './types';
import { normalizeUrl } from './url';

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    options.includes(v as T) ? (v as T) : fallback;

function sanitizeItems(raw: unknown): Record<ID, Item> {
    const items: Record<ID, Item> = {};
    if (!isDict(raw)) return items;
    for (const [id, value] of Object.entries(raw)) {
        if (!isDict(value)) continue;
        const url = normalizeUrl(value.url);
        if (!url) continue;
        const item: Item = { id, title: str(value.title).trim() || url, url, createdAt: num(value.createdAt, 0) };
        if (str(value.icon).trim()) item.icon = str(value.icon).trim();
        if (value.pinned === true) item.pinned = true;
        items[id] = item;
    }
    return items;
}

function sanitizeSpaces(raw: unknown, items: Record<ID, Item>): Record<ID, Space> {
    const spaces: Record<ID, Space> = {};
    const claimed = new Set<ID>();
    if (!isDict(raw)) return spaces;
    for (const [id, value] of Object.entries(raw)) {
        if (!isDict(value)) continue;
        const groups = arr(value.groups).flatMap(g => {
            if (!isDict(g)) return [];
            const itemIds = arr(g.itemIds).filter((x): x is ID => {
                if (typeof x !== 'string' || !items[x] || claimed.has(x)) return false;
                claimed.add(x);
                return true;
            });
            return [{ id: str(g.id) || newId(), name: str(g.name), itemIds }];
        });
        const space: Space = {
            id,
            name: str(value.name).trim() || 'Untitled',
            glyph: str(value.glyph, 'folder') || 'folder',
            accent: /^#[\da-f]{6}$/i.test(str(value.accent)) ? str(value.accent) : '#7C9CF0',
            groups: groups.length ? groups : [{ id: newId(), name: '', itemIds: [] }],
            createdAt: num(value.createdAt, 0),
        };
        if (str(value.templateId)) space.templateId = str(value.templateId);
        spaces[id] = space;
    }
    // Items no Space refers to would be invisible forever; drop them.
    for (const id of Object.keys(items)) if (!claimed.has(id)) delete items[id];
    return spaces;
}

function orderFor(raw: unknown, known: Record<ID, unknown>): ID[] {
    const order = [...new Set(arr(raw).filter((x): x is ID => typeof x === 'string' && x in known))];
    for (const id of Object.keys(known)) if (!order.includes(id)) order.push(id);
    return order;
}

function sanitizeProviders(raw: unknown): SearchProvider[] {
    const stored = new Map<ID, Dict>();
    for (const p of arr(raw)) if (isDict(p) && str(p.id)) stored.set(str(p.id), p);
    const aliasesOf = (p: Dict | undefined, fallback: string[]) =>
        p && Array.isArray(p.aliases) ? parseAliases(p.aliases.filter(a => typeof a === 'string').join(' ')) : fallback;
    // Built-ins are always present; only their aliases are user-editable.
    const providers: SearchProvider[] = BUILTIN_PROVIDERS.map(b => ({ ...b, aliases: aliasesOf(stored.get(b.id), [...b.aliases]) }));
    for (const [id, p] of stored) {
        if (providers.some(b => b.id === id)) continue;
        const url = str(p.url);
        if (!url.includes('%s') || !normalizeUrl(url.replace('%s', 'q'))) continue;
        providers.push({ id, name: str(p.name).trim() || id, url, aliases: aliasesOf(p, []) });
    }
    return providers;
}

function sanitizePrefs(raw: unknown, providers: SearchProvider[]): Prefs {
    const p = isDict(raw) ? raw : {};
    const bool = (key: keyof Prefs) => (typeof p[key] === 'boolean' ? (p[key] as boolean) : (DEFAULT_PREFS[key] as boolean));
    const providerId = str(p.defaultProviderId);
    return {
        language: oneOf(p.language, ['en', 'tr'] as const, DEFAULT_PREFS.language),
        themeId: str(p.themeId, DEFAULT_PREFS.themeId) || DEFAULT_PREFS.themeId,
        motion: oneOf(p.motion, ['full', 'reduced', 'off'] as const, DEFAULT_PREFS.motion),
        iconSource: oneOf(p.iconSource, ['remote', 'none'] as const, DEFAULT_PREFS.iconSource),
        openInNewTab: bool('openInNewTab'),
        showContinue: bool('showContinue'),
        showClosedTabs: bool('showClosedTabs'),
        showDock: bool('showDock'),
        defaultProviderId: providers.some(x => x.id === providerId) ? providerId : DEFAULT_PREFS.defaultProviderId,
    };
}

export function sanitize(raw: unknown): AppState {
    if (!isDict(raw)) return emptyState();
    const items = sanitizeItems(raw.items);
    const spaces = sanitizeSpaces(raw.spaces, items);
    const providers = sanitizeProviders(raw.providers);

    const modes: Record<ID, Mode> = {};
    if (isDict(raw.modes)) {
        for (const [id, value] of Object.entries(raw.modes)) {
            if (!isDict(value)) continue;
            const mode: Mode = {
                id,
                name: str(value.name).trim() || 'Mode',
                glyph: str(value.glyph, 'layers') || 'layers',
                spaceIds: [...new Set(arr(value.spaceIds).filter((x): x is ID => typeof x === 'string' && x in spaces))],
            };
            if (str(value.themeId)) mode.themeId = str(value.themeId);
            if (providers.some(p => p.id === value.providerId)) mode.providerId = str(value.providerId);
            modes[id] = mode;
        }
    }

    const recents = arr(raw.recents)
        .flatMap(r => {
            const url = isDict(r) ? normalizeUrl(r.url) : null;
            return isDict(r) && url ? [{ url, title: str(r.title) || url, at: num(r.at, 0) }] : [];
        })
        .slice(0, MAX_RECENTS);

    const state: AppState = {
        schema: SCHEMA_VERSION,
        updatedAt: num(raw.updatedAt, 0),
        onboarded: raw.onboarded === true,
        spaces,
        spaceOrder: orderFor(raw.spaceOrder, spaces),
        items,
        modes,
        modeOrder: orderFor(raw.modeOrder, modes),
        activeModeId: typeof raw.activeModeId === 'string' && raw.activeModeId in modes ? raw.activeModeId : null,
        providers,
        recents,
        prefs: sanitizePrefs(raw.prefs, providers),
    };
    if (isDict(raw.legacy)) {
        state.legacy = {
            isPro: raw.legacy.isPro === true,
            proExpiresAt: typeof raw.legacy.proExpiresAt === 'number' ? raw.legacy.proExpiresAt : null,
        };
    }
    return state;
}

/**
 * Rebuilds a trustworthy AppState from anything read off disk or imported. Damaged entries
 * are dropped one by one, so a single corrupted record can never break the page.
 */
import { ATMOSPHERE_LEVELS, sanitizeBackground, sanitizeWallpapers, type WallpaperAsset } from './background';
import { BUILTIN_PROVIDERS, DEFAULT_PREFS, MAX_DOCK, MAX_RECENTS, MAX_USAGE, emptyState, newId } from './defaults';
import { capIcons } from './iconPolicy';
import { LIMITS, bounded, tooLong, type ValidationOptions, type ValidationReport } from './limits';
import { isValidTemplate, parseAliases } from './ops';
import {
    SCHEMA_VERSION, type AppState, type DockEntry, type ID, type Item, type Mode, type Prefs, type RecentItem, type SearchProvider, type Space,
} from './types';
import { normalizeUrl, titleFromUrl } from './url';

type Dict = Record<string, unknown>;

export const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown, fallback: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
    options.includes(v as T) ? (v as T) : fallback;
/** IDs become object keys and DOM attributes; accept only plain tokens. */
const RESERVED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const isId = (v: unknown): v is ID => typeof v === 'string' && /^[\w-]{1,64}$/.test(v) && !RESERVED_KEYS.has(v);
/** Short internal tokens (a glyph, a theme or template id). Anything longer is not one. */
const token = (v: unknown, fallback = ''): string => (typeof v === 'string' && v.length <= 64 ? v : fallback);
/** A name within its limit, or the default; a name over the limit is counted, never shortened. */
function named(value: unknown, max: number, of: string, report?: ValidationReport): string {
    if (report && tooLong(value, max)) {
        report.namesReplaced++;
        report.originals.push({ kind: 'name', of, original: value as string });
    }
    return bounded(value, max) ?? '';
}

function sanitizeItems(raw: unknown, { report, keepIcons }: ValidationOptions): Record<ID, Item> {
    const items: Record<ID, Item> = {};
    if (!isDict(raw)) return items;
    for (const [id, value] of Object.entries(raw)) {
        if (!isId(id) || !isDict(value)) continue;
        const url = normalizeUrl(value.url);
        if (!url) {
            if (report && str(value.url).trim()) {
                report.linksSkipped++;
                report.originals.push({ kind: 'link', of: bounded(value.title, LIMITS.title) ?? '', original: str(value.url) });
                if (tooLong(value.title, LIMITS.title)) report.originals.push({ kind: 'title', of: '', original: str(value.title) });
            }
            continue;
        }
        if (report && tooLong(value.title, LIMITS.title)) {
            report.titlesReplaced++;
            report.originals.push({ kind: 'title', of: url, original: str(value.title) });
        }
        // No title: the address stands in when it is short enough to be one, else the site's name.
        const title = bounded(value.title, LIMITS.title) || (url.length <= LIMITS.title ? url : titleFromUrl(url));
        const item: Item = { id, title: tooLong(value.title, LIMITS.title) ? titleFromUrl(url) : title, url, createdAt: num(value.createdAt, 0) };
        if (str(value.icon).trim()) item.icon = str(value.icon).trim();
        items[id] = item;
    }
    if (keepIcons) return items;
    const capped = capIcons({ items });
    if (report) report.iconsDropped += capped.dropped.length;
    return capped.value.items;
}

function sanitizeSpaces(raw: unknown, items: Record<ID, Item>, report?: ValidationReport): Record<ID, Space> {
    const spaces: Record<ID, Space> = {};
    const claimed = new Set<ID>();
    const groupIds = new Set<ID>();
    if (!isDict(raw)) return spaces;
    for (const [id, value] of Object.entries(raw)) {
        if (!isId(id) || !isDict(value)) continue;
        const groups = arr(value.groups).flatMap(g => {
            if (!isDict(g)) return [];
            // Each item belongs to exactly one group; a second claim is dropped.
            const itemIds = arr(g.itemIds).filter((x): x is ID => {
                if (typeof x !== 'string' || !Object.hasOwn(items, x) || claimed.has(x)) return false;
                claimed.add(x);
                return true;
            });
            const groupId = isId(g.id) && !groupIds.has(g.id) ? g.id : newId();
            groupIds.add(groupId);
            return [{ id: groupId, name: tooLong(g.name, LIMITS.name) ? named(g.name, LIMITS.name, 'group', report) : str(g.name), itemIds }];
        });
        const space: Space = {
            id,
            name: named(value.name, LIMITS.name, 'space', report) || 'Untitled',
            glyph: token(value.glyph, 'folder') || 'folder',
            accent: /^#[\da-f]{6}$/i.test(str(value.accent)) ? str(value.accent) : '#7C9CF0',
            groups: groups.length ? groups : [{ id: newId(), name: '', itemIds: [] }],
            createdAt: num(value.createdAt, 0),
        };
        const note = named(value.note, LIMITS.label, 'note', report);
        if (note) space.note = note;
        if (token(value.templateId)) space.templateId = token(value.templateId);
        spaces[id] = space;
    }
    // Items no Space refers to would be invisible forever; drop them.
    for (const id of Object.keys(items)) if (!claimed.has(id)) delete items[id];
    return spaces;
}

function orderFor(raw: unknown, known: Record<ID, unknown>): ID[] {
    const order = [...new Set(arr(raw).filter((x): x is ID => typeof x === 'string' && Object.hasOwn(known, x)))];
    for (const id of Object.keys(known)) if (!order.includes(id)) order.push(id);
    return order;
}

function sanitizeDock(raw: unknown, items: Record<ID, Item>, spaces: Record<ID, Space>): DockEntry[] {
    const seen = new Set<string>();
    return arr(raw).flatMap((entry): DockEntry[] => {
        if (!isDict(entry) || typeof entry.id !== 'string') return [];
        const kind = entry.kind === 'space' ? 'space' : entry.kind === 'item' ? 'item' : null;
        if (!kind || !(typeof entry.id === 'string' && Object.hasOwn(kind === 'space' ? spaces : items, entry.id))) return [];
        const key = `${kind}:${entry.id}`;
        if (seen.has(key)) return [];
        seen.add(key);
        return [{ kind, id: entry.id }];
    }).slice(0, MAX_DOCK);
}

function sanitizeProviders(raw: unknown, report?: ValidationReport): SearchProvider[] {
    const stored = new Map<ID, Dict>();
    for (const p of arr(raw)) if (isDict(p) && isId(p.id)) stored.set(p.id, p);
    const aliasesOf = (p: Dict | undefined, fallback: string[]) =>
        p && Array.isArray(p.aliases) ? parseAliases(p.aliases.filter(a => typeof a === 'string').join(' ')) : fallback;
    // Built-ins are always present; only their aliases are user-editable.
    const providers: SearchProvider[] = BUILTIN_PROVIDERS.map(b => ({ ...b, aliases: aliasesOf(stored.get(b.id), [...b.aliases]) }));
    for (const [id, p] of stored) {
        if (providers.some(b => b.id === id)) continue;
        const urlTemplate = str(p.urlTemplate).trim();
        if (!isValidTemplate(urlTemplate)) continue;
        providers.push({ id, name: named(p.name, LIMITS.label, 'search provider', report) || id, urlTemplate, aliases: aliasesOf(p, []) });
    }
    return providers;
}

function sanitizePrefs(raw: unknown, providers: SearchProvider[], wallpapers: Record<ID, WallpaperAsset>): Prefs {
    const p = isDict(raw) ? raw : {};
    const bool = (key: keyof Prefs) => (typeof p[key] === 'boolean' ? (p[key] as boolean) : (DEFAULT_PREFS[key] as boolean));
    const providerId = str(p.defaultProviderId);
    return {
        language: oneOf(p.language, ['en', 'tr'] as const, DEFAULT_PREFS.language),
        themeId: token(p.themeId, DEFAULT_PREFS.themeId) || DEFAULT_PREFS.themeId,
        background: sanitizeBackground(p.background, wallpapers),
        atmosphere: oneOf(p.atmosphere, ATMOSPHERE_LEVELS, DEFAULT_PREFS.atmosphere),
        motion: oneOf(p.motion, ['full', 'reduced', 'off'] as const, DEFAULT_PREFS.motion),
        iconSource: oneOf(p.iconSource, ['site', 'service', 'none'] as const, DEFAULT_PREFS.iconSource),
        openInNewTab: bool('openInNewTab'),
        showContinue: bool('showContinue'),
        showClosedTabs: bool('showClosedTabs'),
        showDock: bool('showDock'),
        dockLabels: bool('dockLabels'),
        defaultProviderId: providers.some(x => x.id === providerId) ? providerId : DEFAULT_PREFS.defaultProviderId,
    };
}

function sanitizeRecents(raw: unknown, spaces: Record<ID, Space>): RecentItem[] {
    const seen = new Set<string>();
    return arr(raw).flatMap((r): RecentItem[] => {
        const url = isDict(r) ? normalizeUrl(r.url) : null;
        if (!isDict(r) || !url || seen.has(url)) return [];
        seen.add(url);
        const recent: RecentItem = { url, title: bounded(r.title, LIMITS.title) || (url.length <= LIMITS.title ? url : titleFromUrl(url)), at: num(r.at, 0), count: Math.max(1, Math.floor(num(r.count, 1))) };
        if (typeof r.spaceId === 'string' && Object.hasOwn(spaces, r.spaceId)) recent.spaceId = r.spaceId;
        return [recent];
    }).slice(0, MAX_RECENTS);
}

export function sanitize(raw: unknown, options: ValidationOptions = {}): AppState {
    if (!isDict(raw)) return emptyState();
    const { report } = options;
    const items = sanitizeItems(raw.items, options);
    const spaces = sanitizeSpaces(raw.spaces, items, report);
    const providers = sanitizeProviders(raw.providers, report);
    const wallpapers = sanitizeWallpapers(raw.wallpapers);

    const modes: Record<ID, Mode> = {};
    if (isDict(raw.modes)) {
        for (const [id, value] of Object.entries(raw.modes)) {
            if (!isId(id) || !isDict(value)) continue;
            const mode: Mode = {
                id,
                name: named(value.name, LIMITS.name, 'mode', report) || 'Mode',
                glyph: token(value.glyph, 'layers') || 'layers',
                spaceIds: [...new Set(arr(value.spaceIds).filter((x): x is ID => typeof x === 'string' && Object.hasOwn(spaces, x)))],
            };
            if (token(value.themeId)) mode.themeId = token(value.themeId);
            if (isDict(value.background)) mode.background = sanitizeBackground(value.background, wallpapers);
            if (providers.some(p => p.id === value.providerId)) mode.providerId = str(value.providerId);
            if (Array.isArray(value.dock)) mode.dock = sanitizeDock(value.dock, items, spaces);
            modes[id] = mode;
        }
    }

    const usage = isDict(raw.usage)
        ? Object.fromEntries(
            Object.entries(raw.usage)
                .filter((e): e is [string, number] => typeof e[1] === 'number' && Number.isFinite(e[1]))
                .sort((a, b) => b[1] - a[1])
                .slice(0, MAX_USAGE),
        )
        : {};

    const state: AppState = {
        schema: SCHEMA_VERSION,
        updatedAt: num(raw.updatedAt, 0),
        onboarded: raw.onboarded === true,
        spaces,
        spaceOrder: orderFor(raw.spaceOrder, spaces),
        items,
        modes,
        modeOrder: orderFor(raw.modeOrder, modes),
        activeModeId: typeof raw.activeModeId === 'string' && Object.hasOwn(modes, raw.activeModeId) ? raw.activeModeId : null,
        dock: sanitizeDock(raw.dock, items, spaces),
        wallpapers,
        providers,
        recents: sanitizeRecents(raw.recents, spaces),
        usage,
        prefs: sanitizePrefs(raw.prefs, providers, wallpapers),
    };
    if (isDict(raw.legacy)) {
        const summary = isDict(raw.legacy.summary) ? raw.legacy.summary : {};
        state.legacy = {
            isPro: raw.legacy.isPro === true,
            proExpiresAt: typeof raw.legacy.proExpiresAt === 'number' ? raw.legacy.proExpiresAt : null,
            ...(typeof raw.legacy.licenseKey === 'string' && raw.legacy.licenseKey ? { licenseKey: raw.legacy.licenseKey.slice(0, 200) } : {}),
            ...(typeof raw.legacy.licenseInstanceId === 'string' && raw.legacy.licenseInstanceId ? { licenseInstanceId: raw.legacy.licenseInstanceId.slice(0, 200) } : {}),
            migratedAt: num(raw.legacy.migratedAt, 0),
            summary: { spaces: num(summary.spaces, 0), links: num(summary.links, 0), groups: num(summary.groups, 0), skipped: num(summary.skipped, 0) },
            acknowledged: raw.legacy.acknowledged !== false,
        };
    }
    return state;
}

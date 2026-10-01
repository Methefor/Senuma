/**
 * Loading and migration. Legacy data (`ntf_data` from New Tab Folders 1.x) is converted into
 * the new model and is never modified or deleted, so it remains a backup of the old install.
 *
 * Idempotency: a legacy install is converted only when no state of the new model exists.
 * Once one does, the legacy data is never read again, so the conversion cannot run twice,
 * duplicate anything, or overwrite later edits.
 */
import { categorize, categoryById } from './catalog';
import { emptyState, newId } from './defaults';
import { isDict, sanitize } from './sanitize';
import { SCHEMA_VERSION, type AppState, type Item, type Space, type SpaceGroup } from './types';
import { isImageUrl, normalizeUrl } from './url';

type Dict = Record<string, unknown>;

const LEGACY_COLORS: Record<string, string> = {
    red: '#E98B7A',
    blue: '#7C9CF0',
    green: '#5CC2A0',
    yellow: '#F4BE8A',
    purple: '#A98BE8',
    pink: '#D97BA6',
    orange: '#F4BE8A',
    teal: '#62B8D8',
};

const LEGACY_THEMES: Record<string, string> = { dark: 'dusk', light: 'fjord', cyberpunk: 'phosphor', nord: 'dusk' };

// ---------- Schema upgrades for the new model ----------

/** MIGRATIONS[n] turns a stored state of schema n into schema n + 1. */
const MIGRATIONS: Record<number, (raw: Dict) => Dict> = {
    // v2 → v3: pinned flags became an ordered dock; providers and recents gained fields.
    2: raw => {
        const items = isDict(raw.items) ? raw.items : {};
        const spaces = isDict(raw.spaces) ? raw.spaces : {};
        const order = Array.isArray(raw.spaceOrder) ? raw.spaceOrder : Object.keys(spaces);
        const dock: unknown[] = [];
        for (const spaceId of order) {
            const space = spaces[String(spaceId)];
            if (!isDict(space) || !Array.isArray(space.groups)) continue;
            for (const group of space.groups) {
                for (const itemId of isDict(group) && Array.isArray(group.itemIds) ? group.itemIds : []) {
                    const item = items[String(itemId)];
                    if (isDict(item) && item.pinned === true) dock.push({ kind: 'item', id: itemId });
                }
            }
        }
        const providers = (Array.isArray(raw.providers) ? raw.providers : []).map(p =>
            isDict(p) ? { ...p, urlTemplate: p.url || undefined, browserDefault: p.id === 'default' || undefined } : p,
        );
        const recents = (Array.isArray(raw.recents) ? raw.recents : []).map(r => (isDict(r) ? { count: 1, ...r } : r));
        const prefs = isDict(raw.prefs) ? { ...raw.prefs, iconSource: raw.prefs.iconSource === 'none' ? 'none' : 'service' } : raw.prefs;
        const legacy = isDict(raw.legacy) ? { acknowledged: true, ...raw.legacy } : raw.legacy;
        return { ...raw, dock, providers, recents, prefs, legacy, schema: 3 };
    },
    // v3 → v4: backgrounds, atmosphere and the wallpaper library arrive. Every new field has
    // a default that sanitize fills in, so the step only has to move the version on.
    3: raw => ({ ...raw, schema: 4 }),
};

/** Brings a stored or imported state up to the current schema and validates it. Null if unusable. */
export function upgrade(raw: unknown): AppState | null {
    if (!isDict(raw)) return null;
    let current = raw;
    let version = typeof current.schema === 'number' ? current.schema : SCHEMA_VERSION;
    // A file from a newer release is read best-effort; unknown fields are ignored by sanitize.
    while (version < SCHEMA_VERSION) {
        const step = MIGRATIONS[version];
        if (!step) return null;
        current = step(current);
        version++;
    }
    return sanitize(current);
}

// ---------- Legacy 1.x conversion ----------

/** Accepts the full legacy `ntf_data` object or a bare legacy folders array (old export files). */
export function fromLegacy(raw: unknown): AppState | null {
    const data: Dict | null = Array.isArray(raw) ? { folders: raw } : isDict(raw) ? raw : null;
    if (!data || !Array.isArray(data.folders)) return null;

    const state = emptyState();
    const summary = { spaces: 0, links: 0, groups: 0, skipped: 0 };

    for (const folder of data.folders) {
        if (!isDict(folder)) {
            summary.skipped++;
            continue;
        }
        const groups: SpaceGroup[] = [{ id: newId(), name: '', itemIds: [] }];
        const votes = new Map<string, number>();
        for (const link of Array.isArray(folder.links) ? folder.links : []) {
            if (!isDict(link)) {
                summary.skipped++;
                continue;
            }
            const title = typeof link.title === 'string' ? link.title.trim() : '';
            // Legacy "headers" were pseudo-links that split a folder into sections.
            if (link.type === 'header') {
                groups.push({ id: newId(), name: title, itemIds: [] });
                continue;
            }
            const url = normalizeUrl(link.url);
            // Anything else with a type is a kind this version never had; without a usable
            // address there is nothing to open, so it is counted and left in the legacy data.
            if (!url || (link.type !== undefined && link.type !== 'link')) {
                summary.skipped++;
                continue;
            }
            // Legacy IDs are not reused: 1.x generated colliding ones (duplicated folders
            // appended "c" to every link ID), and fresh IDs make every record unique.
            const item: Item = {
                id: newId(),
                title: title || url,
                url,
                createdAt: typeof link.createdAt === 'number' ? link.createdAt : Date.now(),
            };
            const icon = typeof link.icon === 'string' ? link.icon.trim() : '';
            // Stored favicon-service URLs are redundant: icons are now resolved at render time.
            if (icon && !icon.includes('/s2/favicons') && (isImageUrl(icon) || icon.length <= 4)) item.icon = icon;
            state.items[item.id] = item;
            groups.at(-1)!.itemIds.push(item.id);
            summary.links++;
            const category = categorize(url);
            if (category) votes.set(category, (votes.get(category) ?? 0) + 1);
        }
        const kept = groups.filter((g, i) => g.itemIds.length > 0 || (i > 0 && g.name));
        const dominant = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const space: Space = {
            id: newId(),
            name: (typeof folder.name === 'string' && folder.name.trim()) || 'Untitled',
            glyph: (dominant && categoryById(dominant)?.glyph) || 'folder',
            accent: LEGACY_COLORS[String(folder.color)] ?? '#7C9CF0',
            groups: kept.length ? kept : [groups[0]!],
            createdAt: Date.now(),
        };
        state.spaces[space.id] = space;
        state.spaceOrder.push(space.id);
        summary.spaces++;
        summary.groups += space.groups.filter(g => g.name).length;
    }

    state.prefs.themeId = LEGACY_THEMES[String(data.theme)] ?? state.prefs.themeId;
    state.prefs.language = data.language === 'EN' ? 'en' : data.language === 'TR' || data.language === undefined ? 'tr' : 'en';
    // Keep what existing users are used to: 1.x opened links in a new tab and loaded
    // every icon from the icon service.
    state.prefs.openInNewTab = true;
    state.prefs.iconSource = 'service';
    // People with a real setup skip new-user onboarding; an empty legacy install does not.
    state.onboarded = summary.links > 0;
    state.legacy = {
        isPro: data.isPro === true,
        proExpiresAt: typeof data.proExpiresAt === 'number' ? data.proExpiresAt : null,
        migratedAt: Date.now(),
        summary,
        acknowledged: summary.links === 0,
    };
    state.updatedAt = Date.now();
    return state;
}

export interface Resolved {
    state: AppState;
    source: 'stored' | 'legacy' | 'fresh';
}

/** Decides what to boot from: the stored state, a legacy install, or a fresh start. */
export function resolveState(stored: unknown, legacy: unknown): Resolved {
    if (isDict(stored)) {
        // A state of the new model exists. Even if it is damaged it is repaired in place;
        // falling back to legacy data here would silently discard everything done since.
        return { state: upgrade(stored) ?? sanitize(stored), source: 'stored' };
    }
    const migrated = fromLegacy(legacy);
    if (migrated) return { state: migrated, source: 'legacy' };
    return { state: emptyState(), source: 'fresh' };
}

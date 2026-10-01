/**
 * Loading and migration. Legacy data (`ntf_data` from New Tab Folders 1.x) is converted into
 * the new model and is never modified or deleted, so it remains a backup of the old install.
 */
import { categorize, categoryById } from './catalog';
import { emptyState, newId } from './defaults';
import { sanitize } from './sanitize';
import { SCHEMA_VERSION, type AppState, type Item, type Space, type SpaceGroup } from './types';
import { isImageUrl, normalizeUrl } from './url';

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);

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

/** Stepwise upgrades for stored states: MIGRATIONS[n] turns schema n into n + 1. */
const MIGRATIONS: Record<number, (raw: Dict) => Dict> = {};

export interface LegacyResult {
    state: AppState;
    /** Links that could not be carried over (no usable URL). */
    dropped: number;
}

/** Accepts the full legacy `ntf_data` object or a bare legacy folders array (old export files). */
export function fromLegacy(raw: unknown): LegacyResult | null {
    const data: Dict | null = Array.isArray(raw) ? { folders: raw } : isDict(raw) ? raw : null;
    if (!data || !Array.isArray(data.folders)) return null;

    const state = emptyState();
    let dropped = 0;

    for (const folder of data.folders) {
        if (!isDict(folder)) continue;
        const groups: SpaceGroup[] = [{ id: newId(), name: '', itemIds: [] }];
        const votes = new Map<string, number>();
        for (const link of Array.isArray(folder.links) ? folder.links : []) {
            if (!isDict(link)) continue;
            const title = typeof link.title === 'string' ? link.title.trim() : '';
            // Legacy "headers" were pseudo-links that split a folder into sections.
            if (link.type === 'header') {
                groups.push({ id: newId(), name: title, itemIds: [] });
                continue;
            }
            const url = normalizeUrl(link.url);
            if (!url) {
                dropped++;
                continue;
            }
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
    }

    state.prefs.themeId = LEGACY_THEMES[String(data.theme)] ?? state.prefs.themeId;
    state.prefs.language = data.language === 'EN' ? 'en' : data.language === 'TR' || data.language === undefined ? 'tr' : 'en';
    // The old product opened links in a new tab; keep what existing users are used to.
    state.prefs.openInNewTab = true;
    state.onboarded = state.spaceOrder.length > 0;
    state.legacy = {
        isPro: data.isPro === true,
        proExpiresAt: typeof data.proExpiresAt === 'number' ? data.proExpiresAt : null,
    };
    state.updatedAt = Date.now();
    return { state, dropped };
}

export interface Resolved {
    state: AppState;
    source: 'stored' | 'legacy' | 'fresh';
    dropped: number;
}

/** Decides what to boot from: the stored state, a legacy install, or a fresh start. */
export function resolveState(stored: unknown, legacy: unknown): Resolved {
    if (isDict(stored)) {
        let raw = stored;
        let version = typeof raw.schema === 'number' ? raw.schema : SCHEMA_VERSION;
        while (version < SCHEMA_VERSION && MIGRATIONS[version]) {
            raw = MIGRATIONS[version]!(raw);
            version++;
        }
        return { state: sanitize(raw), source: 'stored', dropped: 0 };
    }
    const migrated = fromLegacy(legacy);
    if (migrated) return { state: migrated.state, source: 'legacy', dropped: migrated.dropped };
    return { state: emptyState(), source: 'fresh', dropped: 0 };
}

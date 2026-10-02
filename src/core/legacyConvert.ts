/**
 * Conversion of New Tab Folders 1.x data (`ntf_data`; the published 1.8 build is the reference)
 * into the current model. The 1.x data is only read: it is never modified or deleted, so it
 * remains a backup of the old install.
 *
 * Idempotency: a 1.x install is converted only when no state of the new model exists. Once one
 * does, the 1.x data is never read again, so the conversion cannot run twice, duplicate
 * anything, or overwrite later edits.
 *
 * Kept in its own module so that it is loaded only by an install that actually has 1.x data.
 */
import { categorize, categoryById } from './catalog';
import { emptyState, MAX_DOCK, newId } from './defaults';
import { legacyBackground } from './legacy';
import { upgrade, type Resolved } from './migrate';
import { isDict, sanitize } from './sanitize';
import type { AppState, Item, Space, SpaceGroup } from './types';
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

const LEGACY_THEMES: Record<string, string> = { dark: 'dusk', light: 'fjord', cyberpunk: 'phosphor', nord: 'dusk', ocean: 'dusk' };

// ---------- Legacy 1.x conversion ----------

/** Accepts the full legacy `ntf_data` object or a bare legacy folders array (old export files). */
export function fromLegacy(raw: unknown): AppState | null {
    const data: Dict | null = Array.isArray(raw) ? { folders: raw } : isDict(raw) ? raw : null;
    if (!data || !Array.isArray(data.folders)) return null;

    const state = emptyState();
    const summary = { spaces: 0, links: 0, groups: 0, skipped: 0 };
    const pinnedSpaces = new Set<string>();
    const byUrl = new Map<string, string>();

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
            if (!byUrl.has(url)) byUrl.set(url, item.id);
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
        if (folder.pinned === true) pinnedSpaces.add(space.id);
        summary.spaces++;
        summary.groups += space.groups.filter(g => g.name).length;
    }

    state.prefs.themeId = LEGACY_THEMES[String(data.theme)] ?? state.prefs.themeId;
    // 1.x showed pinned folders first; keep that order.
    state.spaceOrder = [...state.spaceOrder.filter(id => pinnedSpaces.has(id)), ...state.spaceOrder.filter(id => !pinnedSpaces.has(id))];

    // The 1.8 quick bar becomes the dock. A quick-bar link whose folder copy is gone is kept in a Space of its own.
    const orphans: Item[] = [];
    for (const link of Array.isArray(data.quickBarLinks) ? data.quickBarLinks : []) {
        if (!isDict(link)) continue;
        const url = normalizeUrl(link.url);
        if (!url) continue;
        let id = byUrl.get(url);
        if (!id) {
            const item: Item = { id: newId(), title: (typeof link.title === 'string' && link.title.trim()) || url, url, createdAt: Date.now() };
            state.items[item.id] = item;
            byUrl.set(url, item.id);
            orphans.push(item);
            summary.links++;
            id = item.id;
        }
        const itemId = id;
        if (state.dock.length < MAX_DOCK && !state.dock.some(entry => entry.id === itemId)) state.dock.push({ kind: 'item', id: itemId });
    }
    if (orphans.length) {
        const space: Space = { id: newId(), name: 'Quick bar', glyph: 'folder', accent: '#7C9CF0', groups: [{ id: newId(), name: '', itemIds: orphans.map(item => item.id) }], createdAt: Date.now() };
        state.spaces[space.id] = space;
        state.spaceOrder.push(space.id);
        summary.spaces++;
    }

    // Early 1.x stored 'TR' / 'EN' and defaulted to Turkish; 1.8 stores locale codes and defaults to English.
    const language = typeof data.language === 'string' ? data.language.toLowerCase() : !('quickBarLinks' in data) ? 'tr' : 'en';
    state.prefs.language = language === 'tr' ? 'tr' : 'en';
    // A 1.8 colour or gradient background carries straight over (a stored picture is handled after boot).
    const carried = legacyBackground(data.background);
    if (carried?.kind === 'ready') state.prefs.background = carried.background;
    // Keep what existing users are used to: 1.x opened links in a new tab and loaded
    // every icon from the icon service.
    state.prefs.openInNewTab = true;
    state.prefs.iconSource = 'service';
    // People with a real setup skip new-user onboarding; an empty legacy install does not.
    state.onboarded = summary.links > 0;
    state.legacy = {
        isPro: data.isPro === true,
        proExpiresAt: typeof data.proExpiresAt === 'number' ? data.proExpiresAt : null,
        ...(typeof data.licenseKey === 'string' && data.licenseKey ? { licenseKey: data.licenseKey } : {}),
        ...(typeof data.licenseInstanceId === 'string' && data.licenseInstanceId ? { licenseInstanceId: data.licenseInstanceId } : {}),
        migratedAt: Date.now(),
        summary,
        acknowledged: summary.links === 0,
    };
    state.updatedAt = Date.now();
    return state;
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

/**
 * Command engine: turns a query into ranked results. Pure and deterministic; results carry
 * a data-only Action, so an AI interpreter can later produce the same Actions.
 */
import { locateItem } from './ops';
import { routeQuery, type Route } from './search';
import type { AppState, ID } from './types';
import { hostOf } from './url';

export type Action =
    | { type: 'open'; url: string; title: string }
    | { type: 'search'; providerId: ID; query: string }
    | { type: 'space'; id: ID }
    | { type: 'mode'; id: ID | null }
    | { type: 'theme'; id: string }
    | { type: 'settings'; section?: string }
    | { type: 'new-space' };

export interface Result {
    key: string;
    kind: 'item' | 'space' | 'mode' | 'command' | 'theme' | 'search' | 'url' | 'recent';
    title: string;
    hint?: string;
    /** Site URL for a favicon, or a glyph name. */
    iconUrl?: string;
    iconOverride?: string;
    glyph?: string;
    accent?: string;
    action: Action;
}

/** Labels supplied by the UI layer so the engine has no language dependency. */
export interface CommandLabels {
    allSpaces: string;
    modeHint: string;
    spaceHint: string;
    themeHint: string;
    newSpace: string;
    settings: string;
    settingsSections: { id: string; label: string }[];
    searchWith: (provider: string, query: string) => string;
    openUrl: (host: string) => string;
    recentHint: string;
    themes: { id: string; name: string }[];
}

const MAX_LOCAL = 7;

/** 0 = no match. Higher is better: exact > prefix > word start > substring. */
export function matchScore(text: string, query: string): number {
    const t = text.toLowerCase();
    const q = query.toLowerCase();
    if (!q) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (new RegExp(`(^|[\\s\\-_/.])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t)) return 60;
    if (t.includes(q)) return 40;
    return 0;
}

interface Intent {
    /** Restricts results to one kind when the phrasing makes the intent explicit. */
    only?: Result['kind'];
    term: string;
    /** "search <provider> for <query>" resolved to a provider. */
    search?: { providerId: ID; query: string };
}

/** Understands a few natural phrasings: "open github", "switch to dev mode", "search youtube for x". */
export function interpret(query: string, s: AppState): Intent {
    const text = query.trim();
    const searchFor = /^search\s+(.+?)\s+for\s+(.+)$/i.exec(text);
    if (searchFor) {
        const name = searchFor[1]!.toLowerCase();
        const provider = s.providers.find(p => p.name.toLowerCase() === name || p.aliases.includes(name));
        if (provider) return { term: text, search: { providerId: provider.id, query: searchFor[2]! } };
    }
    const mode = /^(?:switch\s+to\s+|go\s+to\s+)?(.+?)\s+mode$/i.exec(text) ?? /^(?:switch\s+to|mode)\s+(.+)$/i.exec(text);
    if (mode) return { only: 'mode', term: mode[1]! };
    const space = /^(?:open\s+)?(.+?)\s+space$/i.exec(text);
    if (space) return { only: 'space', term: space[1]! };
    const open = /^(?:open|go\s+to|launch)\s+(.+)$/i.exec(text);
    if (open) return { term: open[1]! };
    return { term: text };
}

function routeResult(route: Route, labels: CommandLabels): Result {
    if (route.kind === 'url') {
        return {
            key: 'route',
            kind: 'url',
            title: labels.openUrl(hostOf(route.url) || route.url),
            glyph: 'globe',
            action: { type: 'open', url: route.url, title: hostOf(route.url) || route.url },
        };
    }
    return {
        key: 'route',
        kind: 'search',
        title: labels.searchWith(route.provider.name, route.query),
        glyph: 'search',
        action: { type: 'search', providerId: route.provider.id, query: route.query },
    };
}

/** Results for an empty query in the command center: where you can go from here. */
export function defaultResults(s: AppState, labels: CommandLabels): Result[] {
    const results: Result[] = [];
    if (s.modeOrder.length) {
        if (s.activeModeId) results.push({ key: 'mode:all', kind: 'mode', title: labels.allSpaces, hint: labels.modeHint, glyph: 'grid', action: { type: 'mode', id: null } });
        for (const id of s.modeOrder) {
            const mode = s.modes[id]!;
            if (id !== s.activeModeId) results.push({ key: `mode:${id}`, kind: 'mode', title: mode.name, hint: labels.modeHint, glyph: mode.glyph, action: { type: 'mode', id } });
        }
    }
    for (const r of s.recents.slice(0, 4)) {
        results.push({ key: `recent:${r.url}`, kind: 'recent', title: r.title, hint: labels.recentHint, iconUrl: r.url, action: { type: 'open', url: r.url, title: r.title } });
    }
    results.push({ key: 'cmd:new-space', kind: 'command', title: labels.newSpace, glyph: 'plus', action: { type: 'new-space' } });
    results.push({ key: 'cmd:settings', kind: 'command', title: labels.settings, glyph: 'sliders', action: { type: 'settings' } });
    return results;
}

export function buildResults(query: string, s: AppState, defaultProviderId: ID, labels: CommandLabels, literal = false): Result[] {
    if (!query.trim()) return [];
    const intent: Intent = literal ? { term: query.trim() } : interpret(query, s);
    if (intent.search) {
        return [routeResult({ kind: 'search', provider: s.providers.find(p => p.id === intent.search!.providerId)!, query: intent.search.query, viaAlias: true }, labels)];
    }
    const term = intent.term;
    const wants = (kind: Result['kind']) => !intent.only || intent.only === kind;
    const scored: { score: number; result: Result }[] = [];
    const push = (score: number, result: Result) => {
        if (score > 0) scored.push({ score, result });
    };

    if (wants('item')) {
        for (const item of Object.values(s.items)) {
            const where = locateItem(s, item.id);
            const space = where ? s.spaces[where.spaceId] : undefined;
            const score = Math.max(matchScore(item.title, term), matchScore(hostOf(item.url), term) - 10);
            push(score + (item.pinned ? 3 : 0), {
                key: `item:${item.id}`,
                kind: 'item',
                title: item.title,
                hint: space?.name,
                iconUrl: item.url,
                iconOverride: item.icon,
                action: { type: 'open', url: item.url, title: item.title },
            });
        }
    }
    if (wants('space')) {
        for (const id of s.spaceOrder) {
            const space = s.spaces[id]!;
            // A hair below items so "claude" opens Claude before a Space of the same name.
            push(matchScore(space.name, term) - (intent.only ? 0 : 1), {
                key: `space:${id}`, kind: 'space', title: space.name, hint: labels.spaceHint, glyph: space.glyph, accent: space.accent, action: { type: 'space', id },
            });
        }
    }
    if (wants('mode')) {
        for (const id of s.modeOrder) {
            const mode = s.modes[id]!;
            push(matchScore(mode.name, term) - (intent.only ? 0 : 2), {
                key: `mode:${id}`, kind: 'mode', title: mode.name, hint: labels.modeHint, glyph: mode.glyph, action: { type: 'mode', id },
            });
        }
        if (s.modeOrder.length) {
            push(matchScore(labels.allSpaces, term) - 2, { key: 'mode:all', kind: 'mode', title: labels.allSpaces, hint: labels.modeHint, glyph: 'grid', action: { type: 'mode', id: null } });
        }
    }
    if (!intent.only) {
        push(matchScore(labels.newSpace, term) - 5, { key: 'cmd:new-space', kind: 'command', title: labels.newSpace, glyph: 'plus', action: { type: 'new-space' } });
        push(matchScore(labels.settings, term) - 5, { key: 'cmd:settings', kind: 'command', title: labels.settings, glyph: 'sliders', action: { type: 'settings' } });
        for (const section of labels.settingsSections) {
            push(matchScore(section.label, term) - 6, {
                key: `cmd:settings:${section.id}`, kind: 'command', title: section.label, hint: labels.settings, glyph: 'sliders', action: { type: 'settings', section: section.id },
            });
        }
        for (const theme of labels.themes) {
            push(matchScore(theme.name, term) - 8, { key: `theme:${theme.id}`, kind: 'theme', title: theme.name, hint: labels.themeHint, glyph: 'swatch', action: { type: 'theme', id: theme.id } });
        }
    }

    const local = scored.sort((a, b) => b.score - a.score).slice(0, MAX_LOCAL).map(x => x.result);
    // "incognito mode" reads like a Mode switch but matches none: treat it as plain text.
    if (intent.only) return local.length ? local : buildResults(query, s, defaultProviderId, labels, true);

    const route = routeQuery(query, s.providers, defaultProviderId);
    if (!route) return local;
    const routed = routeResult(route, labels);
    // An address or an explicit alias states intent outright; otherwise saved things come first.
    const explicit = route.kind === 'url' || route.viaAlias;
    return explicit ? [routed, ...local] : [...local, routed];
}

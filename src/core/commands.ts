/**
 * Command engine: turns a query into ranked results. Pure and deterministic; results carry
 * a data-only Action, so an AI interpreter can later produce the same Actions.
 *
 * Action language: every result that does something starts with a verb, and the same verb
 * always means the same thing — Open (go there), Switch to (change Mode), Search (web),
 * Create, Use (apply a look), Customize. Saved links are shown by name alone: the name is
 * the destination.
 */
import { locateItem, visibleSpaces } from './ops';
import { matchProviderName, routeQuery, type Route } from './search';
import type { AppState, ID } from './types';
import { hostOf } from './url';

export type Action =
    | { type: 'open'; url: string; title: string; spaceId?: ID }
    | { type: 'search'; providerId: ID; query: string }
    | { type: 'space'; id: ID }
    | { type: 'mode'; id: ID | null }
    | { type: 'theme'; id: string }
    | { type: 'settings'; section?: string }
    | { type: 'customize' }
    | { type: 'new-space' }
    /** Rewrites the input instead of leaving it, e.g. to start a provider search. */
    | { type: 'prefill'; text: string };

/** How results are grouped in the command center. */
export type ResultGroup = 'links' | 'spaces' | 'modes' | 'commands' | 'search' | 'recent';

export interface Result {
    key: string;
    kind: 'item' | 'space' | 'mode' | 'command' | 'theme' | 'search' | 'url' | 'recent';
    group: ResultGroup;
    title: string;
    hint?: string;
    /** Site URL to show an app icon for; otherwise `glyph` is used. */
    iconUrl?: string;
    iconOverride?: string;
    glyph?: string;
    accent?: string;
    /** Keyboard shortcut that does the same thing from Home. */
    shortcut?: string;
    action: Action;
}

/** Labels supplied by the UI layer so the engine has no language dependency. */
export interface CommandLabels {
    openSpace: (name: string) => string;
    switchMode: (name: string) => string;
    showAllSpaces: string;
    useTheme: (name: string) => string;
    createSpace: string;
    customize: string;
    openSettings: string;
    openSettingsSection: (label: string) => string;
    settingsSections: { id: string; label: string }[];
    providerName: (id: ID, name: string) => string;
    searchWith: (provider: string, query: string) => string;
    searchWeb: (query: string) => string;
    searchPrompt: (provider: string) => string;
    openUrl: (host: string) => string;
    themes: { id: string; name: string }[];
}

export interface CommandContext {
    /** The Home search box favours web search; the command center favours commands. */
    surface: 'home' | 'palette';
    defaultProviderId: ID;
    labels: CommandLabels;
    now?: number;
}

const MAX_LOCAL = 8;
const FUZZY_MIN_LENGTH = 3;
/** Substring quality or better. Below this a match is a fuzzy guess. */
const STRONG_MATCH = 28;
const RECENT_USE_MS = 7 * 24 * 60 * 60 * 1000;

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 0 = no match. Higher is better: exact > prefix > word start > substring > fuzzy.
 * Fuzzy means the query's letters appear in order ("gthb" → GitHub); tighter runs score higher.
 */
export function matchScore(text: string, query: string): number {
    const t = text.toLowerCase();
    const q = query.toLowerCase().trim();
    if (!q || !t) return 0;
    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (new RegExp(`(^|[\\s\\-_/.:])${escapeRegExp(q)}`).test(t)) return 60;
    if (t.includes(q)) return 40;
    if (q.length < FUZZY_MIN_LENGTH || /\s/.test(q)) return 0;
    const from = t.indexOf(q[0]!);
    if (from < 0) return 0;
    let at = from;
    for (let i = 1; i < q.length; i++) {
        at = t.indexOf(q[i]!, at + 1);
        if (at < 0) return 0;
    }
    const gaps = at - from + 1 - q.length;
    return Math.max(8, 30 - gaps * 4);
}

/** Best score across several ways of naming the same thing (its name, its action phrase). */
const bestScore = (query: string, ...texts: string[]) => Math.max(...texts.map(text => matchScore(text, query)));

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

function routeResult(route: Route, labels: CommandLabels, key = 'route'): Result {
    if (route.kind === 'url') {
        const host = hostOf(route.url) || route.url;
        return { key, kind: 'url', group: 'search', title: labels.openUrl(host), glyph: 'globe', action: { type: 'open', url: route.url, title: host } };
    }
    const { provider, query } = route;
    return {
        key,
        kind: 'search',
        group: 'search',
        title: provider.browserDefault ? labels.searchWeb(query) : labels.searchWith(provider.name, query),
        glyph: 'search',
        action: { type: 'search', providerId: provider.id, query },
    };
}

function modeResult(s: AppState, id: ID | null, labels: CommandLabels): Result {
    const mode = id ? s.modes[id]! : undefined;
    return {
        key: `mode:${id ?? 'all'}`,
        kind: 'mode',
        group: 'modes',
        title: mode ? labels.switchMode(mode.name) : labels.showAllSpaces,
        glyph: mode ? mode.glyph : 'grid',
        action: { type: 'mode', id },
    };
}

function commandResults(labels: CommandLabels): { result: Result; names: string[] }[] {
    const command = (key: string, title: string, glyph: string, action: Action): Result => ({ key, kind: 'command', group: 'commands', title, glyph, action });
    return [
        { result: command('cmd:new-space', labels.createSpace, 'plus', { type: 'new-space' }), names: [labels.createSpace, 'new space'] },
        { result: command('cmd:customize', labels.customize, 'swatch', { type: 'customize' }), names: [labels.customize, 'theme', 'wallpaper', 'background', 'appearance'] },
        { result: command('cmd:settings', labels.openSettings, 'sliders', { type: 'settings' }), names: [labels.openSettings, 'preferences'] },
    ];
}

/** Results for an empty query in the command center: where you can go from here. */
export function defaultResults(s: AppState, labels: CommandLabels): Result[] {
    const results: Result[] = [];
    for (const r of s.recents.slice(0, 4)) {
        results.push({ key: `recent:${r.url}`, kind: 'recent', group: 'recent', title: r.title, hint: hostOf(r.url), iconUrl: r.url, action: { type: 'open', url: r.url, title: r.title, spaceId: r.spaceId } });
    }
    if (s.modeOrder.length) {
        for (const id of s.modeOrder) if (id !== s.activeModeId) results.push(modeResult(s, id, labels));
        if (s.activeModeId) results.push(modeResult(s, null, labels));
    }
    results.push(...commandResults(labels).map(c => c.result));
    return results;
}

export function buildResults(query: string, s: AppState, context: CommandContext, literal = false): Result[] {
    const text = query.trim();
    if (!text) return [];
    const { labels, surface } = context;
    const now = context.now ?? Date.now();
    const intent: Intent = literal ? { term: text } : interpret(text, s);
    if (intent.search) {
        const provider = s.providers.find(p => p.id === intent.search!.providerId)!;
        return [routeResult({ kind: 'search', provider, query: intent.search.query, via: 'alias' }, labels)];
    }
    const term = intent.term;
    const wants = (kind: Result['kind']) => !intent.only || intent.only === kind;
    const scored: { score: number; strong: boolean; result: Result }[] = [];
    const push = (score: number, result: Result) => {
        if (score <= 0) return;
        // Things chosen before come back faster; recent choices more so.
        const used = s.usage[result.key];
        const boost = used ? (now - used < RECENT_USE_MS ? 18 : 10) : 0;
        scored.push({ score: score + boost, strong: score >= STRONG_MATCH, result });
    };

    if (wants('item')) {
        for (const item of Object.values(s.items)) {
            const where = locateItem(s, item.id);
            const space = where ? s.spaces[where.spaceId] : undefined;
            const score = Math.max(matchScore(item.title, term), matchScore(hostOf(item.url), term) - 10);
            push(score, {
                key: `item:${item.id}`,
                kind: 'item',
                group: 'links',
                title: item.title,
                hint: space?.name,
                iconUrl: item.url,
                iconOverride: item.icon,
                action: { type: 'open', url: item.url, title: item.title, spaceId: where?.spaceId },
            });
        }
    }
    if (wants('space')) {
        const visible = visibleSpaces(s).map(sp => sp.id);
        for (const id of s.spaceOrder) {
            const space = s.spaces[id]!;
            const position = visible.indexOf(id);
            // A hair below links so "claude" opens Claude before a Space of the same name.
            push(matchScore(space.name, term) - (intent.only ? 0 : 1), {
                key: `space:${id}`, kind: 'space', group: 'spaces', title: labels.openSpace(space.name), glyph: space.glyph, accent: space.accent,
                ...(position >= 0 && position < 9 ? { shortcut: String(position + 1) } : {}),
                action: { type: 'space', id },
            });
        }
    }
    if (wants('mode') && s.modeOrder.length) {
        for (const id of [...s.modeOrder, null]) {
            const result = modeResult(s, id, labels);
            const name = id ? s.modes[id]!.name : labels.showAllSpaces;
            push(bestScore(term, name, result.title) - (intent.only ? 0 : 2), result);
        }
    }
    if (!intent.only) {
        for (const { result, names } of commandResults(labels)) push(bestScore(term, ...names) - 5, result);
        for (const section of labels.settingsSections) {
            push(matchScore(section.label, term) - 6, {
                key: `cmd:settings:${section.id}`, kind: 'command', group: 'commands', title: labels.openSettingsSection(section.label), glyph: 'sliders',
                action: { type: 'settings', section: section.id },
            });
        }
        for (const theme of labels.themes) {
            push(matchScore(theme.name, term) - 8, {
                key: `theme:${theme.id}`, kind: 'theme', group: 'commands', title: labels.useTheme(theme.name), glyph: 'swatch', action: { type: 'theme', id: theme.id },
            });
        }
        // Naming an engine offers to search it: "youtube" → "Search YouTube…".
        for (const provider of s.providers) {
            if (provider.browserDefault) continue;
            const name = labels.providerName(provider.id, provider.name);
            push(matchScore(name, term) - 12, {
                key: `provider:${provider.id}`, kind: 'search', group: 'search', title: labels.searchPrompt(name), glyph: 'search',
                ...(provider.aliases[0] ? { shortcut: provider.aliases[0] } : {}),
                action: { type: 'prefill', text: `${provider.aliases[0] ?? provider.name.toLowerCase()} ` },
            });
        }
    }

    const ranked = scored.sort((a, b) => b.score - a.score).slice(0, MAX_LOCAL);
    const local = ranked.map(x => x.result);
    // "incognito mode" reads like a Mode switch but matches none: treat it as plain text.
    if (intent.only) return local.length ? local : buildResults(text, s, context, true);

    const route = routeQuery(text, s.providers, context.defaultProviderId);
    if (!route) return local;
    const routed = routeResult(route, labels);
    // An address or an explicit alias states intent outright; otherwise saved things come first.
    if (route.kind === 'url' || route.via === 'alias') return [routed, ...local];

    const named = matchProviderName(text, s.providers);
    const byName = named ? [routeResult({ kind: 'search', ...named, via: 'name' }, labels, 'route:name')] : [];
    // "youtube lofi": in the command center that means YouTube; in the search box the web
    // search stays first, because "amazon rainforest" should not land on a shop.
    if (surface === 'palette') return [...local, ...byName, routed];
    // In the search box a fuzzy guess must never take Enter away from the web search.
    const strong = ranked.filter(x => x.strong).map(x => x.result);
    const guesses = ranked.filter(x => !x.strong).map(x => x.result);
    return [...strong, routed, ...byName, ...guesses];
}

/**
 * Arranges results under group headings for display. The first result stays first (it is
 * what Enter runs); groups then follow in the order their best result appeared.
 */
export function groupResults(results: Result[]): { group: ResultGroup; results: Result[] }[] {
    const groups: { group: ResultGroup; results: Result[] }[] = [];
    for (const result of results) {
        const existing = groups.find(g => g.group === result.group);
        if (existing) existing.results.push(result);
        else groups.push({ group: result.group, results: [result] });
    }
    return groups;
}

import { DEFAULT_BACKGROUND } from './background';
import { SCHEMA_VERSION, type AppState, type ID, type Prefs, type SearchProvider } from './types';

export const MAX_RECENTS = 30;
export const MAX_USAGE = 40;
export const MAX_SNAPSHOTS = 5;
export const MAX_DOCK = 12;

/** Providers are data. Nothing else in the codebase knows any engine by name. */
export const BUILTIN_PROVIDERS: SearchProvider[] = [
    { id: 'default', name: 'Browser default', aliases: [], browserDefault: true, builtin: true },
    { id: 'google', name: 'Google', urlTemplate: 'https://www.google.com/search?q=%s', aliases: ['g'], builtin: true },
    { id: 'duckduckgo', name: 'DuckDuckGo', urlTemplate: 'https://duckduckgo.com/?q=%s', aliases: ['d', 'ddg'], builtin: true },
    { id: 'youtube', name: 'YouTube', urlTemplate: 'https://www.youtube.com/results?search_query=%s', aliases: ['y', 'yt'], builtin: true },
    { id: 'github', name: 'GitHub', urlTemplate: 'https://github.com/search?q=%s', aliases: ['gh'], builtin: true },
    { id: 'reddit', name: 'Reddit', urlTemplate: 'https://www.reddit.com/search/?q=%s', aliases: ['r'], builtin: true },
    { id: 'chatgpt', name: 'ChatGPT', urlTemplate: 'https://chatgpt.com/?q=%s', aliases: ['c', 'gpt'], builtin: true },
    { id: 'claude', name: 'Claude', urlTemplate: 'https://claude.ai/new?q=%s', aliases: ['cl'], builtin: true },
    { id: 'perplexity', name: 'Perplexity', urlTemplate: 'https://www.perplexity.ai/search?q=%s', aliases: ['p'], builtin: true },
    { id: 'amazon', name: 'Amazon', urlTemplate: 'https://www.amazon.com/s?k=%s', aliases: ['a'], builtin: true },
    { id: 'wikipedia', name: 'Wikipedia', urlTemplate: 'https://en.wikipedia.org/w/index.php?search=%s', aliases: ['w'], builtin: true },
    { id: 'stackoverflow', name: 'Stack Overflow', urlTemplate: 'https://stackoverflow.com/search?q=%s', aliases: ['so'], builtin: true },
    { id: 'npm', name: 'npm', urlTemplate: 'https://www.npmjs.com/search?q=%s', aliases: ['npm'], builtin: true },
    { id: 'mdn', name: 'MDN', urlTemplate: 'https://developer.mozilla.org/en-US/search?q=%s', aliases: ['mdn'], builtin: true },
];

export const DEFAULT_PROVIDER_ID = BUILTIN_PROVIDERS[0]!.id;

export const DEFAULT_PREFS: Prefs = {
    language: 'en',
    themeId: 'dusk',
    background: DEFAULT_BACKGROUND,
    atmosphere: 'cinematic',
    motion: 'full',
    iconSource: 'site',
    openInNewTab: false,
    showContinue: true,
    // Needs an optional browser permission, so it starts off and is enabled by the user.
    showClosedTabs: false,
    showDock: true,
    dockLabels: false,
    defaultProviderId: DEFAULT_PROVIDER_ID,
};

export function emptyState(): AppState {
    return {
        schema: SCHEMA_VERSION,
        updatedAt: 0,
        onboarded: false,
        spaces: {},
        spaceOrder: [],
        items: {},
        modes: {},
        modeOrder: [],
        activeModeId: null,
        dock: [],
        wallpapers: {},
        providers: BUILTIN_PROVIDERS.map(p => ({ ...p, aliases: [...p.aliases] })),
        recents: [],
        usage: {},
        prefs: { ...DEFAULT_PREFS, background: { ...DEFAULT_BACKGROUND } },
    };
}

export const ACCENTS = ['#F4BE8A', '#E98B7A', '#D97BA6', '#A98BE8', '#7C9CF0', '#62B8D8', '#5CC2A0', '#A9C46C'] as const;

export function newId(): ID {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

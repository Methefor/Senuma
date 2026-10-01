import { SCHEMA_VERSION, type AppState, type ID, type Prefs, type SearchProvider } from './types';

/** Routes through the browser's own default search engine. */
export const BROWSER_DEFAULT_PROVIDER = 'default';

export const MAX_RECENTS = 30;

export const BUILTIN_PROVIDERS: SearchProvider[] = [
    { id: BROWSER_DEFAULT_PROVIDER, name: 'Browser default', url: '', aliases: [], builtin: true },
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s', aliases: ['g'], builtin: true },
    { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', aliases: ['d', 'ddg'], builtin: true },
    { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s', aliases: ['y', 'yt'], builtin: true },
    { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=%s', aliases: ['gh'], builtin: true },
    { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai/search?q=%s', aliases: ['p'], builtin: true },
    { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/?q=%s', aliases: ['c', 'gpt'], builtin: true },
    { id: 'claude', name: 'Claude', url: 'https://claude.ai/new?q=%s', aliases: ['cl'], builtin: true },
    { id: 'reddit', name: 'Reddit', url: 'https://www.reddit.com/search/?q=%s', aliases: ['r'], builtin: true },
    { id: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/s?k=%s', aliases: ['a'], builtin: true },
    { id: 'wikipedia', name: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=%s', aliases: ['w'], builtin: true },
    { id: 'stackoverflow', name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=%s', aliases: ['so'], builtin: true },
    { id: 'npm', name: 'npm', url: 'https://www.npmjs.com/search?q=%s', aliases: ['npm'], builtin: true },
    { id: 'mdn', name: 'MDN', url: 'https://developer.mozilla.org/en-US/search?q=%s', aliases: ['mdn'], builtin: true },
];

export const DEFAULT_PREFS: Prefs = {
    language: 'en',
    themeId: 'dusk',
    motion: 'full',
    iconSource: 'remote',
    openInNewTab: false,
    showContinue: true,
    showClosedTabs: true,
    showDock: true,
    defaultProviderId: BROWSER_DEFAULT_PROVIDER,
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
        providers: BUILTIN_PROVIDERS.map(p => ({ ...p, aliases: [...p.aliases] })),
        recents: [],
        prefs: { ...DEFAULT_PREFS },
    };
}

export const ACCENTS = ['#F4BE8A', '#E98B7A', '#D97BA6', '#A98BE8', '#7C9CF0', '#62B8D8', '#5CC2A0', '#A9C46C'] as const;

export function newId(): ID {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

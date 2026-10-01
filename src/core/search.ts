/** Universal search router: decides whether input is a URL, an aliased search, or a default search. */
import { BROWSER_DEFAULT_PROVIDER } from './defaults';
import type { ID, SearchProvider } from './types';
import { normalizeUrl } from './url';

export type Route =
    | { kind: 'url'; url: string }
    | { kind: 'search'; provider: SearchProvider; query: string; viaAlias: boolean };

export function findProvider(providers: SearchProvider[], id: ID): SearchProvider {
    return providers.find(p => p.id === id) ?? providers.find(p => p.id === BROWSER_DEFAULT_PROVIDER) ?? providers[0]!;
}

export function routeQuery(input: string, providers: SearchProvider[], defaultId: ID): Route | null {
    const text = input.trim();
    if (!text) return null;

    const url = normalizeUrl(text);
    if (url) return { kind: 'url', url };

    const space = text.search(/\s/);
    if (space > 0) {
        const alias = text.slice(0, space).toLowerCase();
        const query = text.slice(space).trim();
        const provider = providers.find(p => p.aliases.includes(alias));
        if (provider && query) return { kind: 'search', provider, query, viaAlias: true };
    }
    return { kind: 'search', provider: findProvider(providers, defaultId), query: text, viaAlias: false };
}

/** The address to open for a search, or null when the browser's own engine must handle it. */
export function searchUrl(provider: SearchProvider, query: string): string | null {
    if (!provider.url) return null;
    return provider.url.replace('%s', encodeURIComponent(query));
}

/** Used where the browser search API is unavailable (development preview). */
export const FALLBACK_SEARCH_URL = 'https://www.google.com/search?q=%s';

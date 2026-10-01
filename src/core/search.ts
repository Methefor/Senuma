/** Universal search router: decides whether input is a URL, a provider search, or a default search. */
import type { ID, SearchProvider } from './types';
import { normalizeUrl } from './url';

export type Route =
    | { kind: 'url'; url: string }
    | { kind: 'search'; provider: SearchProvider; query: string; via: 'alias' | 'name' | 'default' };

export function findProvider(providers: SearchProvider[], id: ID): SearchProvider {
    return providers.find(p => p.id === id) ?? providers.find(p => p.browserDefault) ?? providers[0]!;
}

/** "y lofi" → YouTube by alias. Aliases are explicit, so this always wins. */
export function matchAlias(text: string, providers: SearchProvider[]): { provider: SearchProvider; query: string } | null {
    const gap = text.search(/\s/);
    if (gap <= 0) return null;
    const alias = text.slice(0, gap).toLowerCase();
    const query = text.slice(gap).trim();
    const provider = providers.find(p => p.aliases.includes(alias));
    return provider && query ? { provider, query } : null;
}

/** "youtube lofi" → YouTube by name. A suggestion, not a certainty: "amazon rainforest" matches too. */
export function matchProviderName(text: string, providers: SearchProvider[]): { provider: SearchProvider; query: string } | null {
    const lower = text.toLowerCase();
    for (const provider of providers) {
        if (provider.browserDefault) continue;
        const name = provider.name.toLowerCase();
        for (const prefix of [name, name.replace(/\s+/g, '')]) {
            if (lower.startsWith(`${prefix} `) && text.slice(prefix.length).trim()) {
                return { provider, query: text.slice(prefix.length).trim() };
            }
        }
    }
    return null;
}

export function routeQuery(input: string, providers: SearchProvider[], defaultId: ID): Route | null {
    const text = input.trim();
    if (!text) return null;

    const url = normalizeUrl(text);
    if (url) return { kind: 'url', url };

    const aliased = matchAlias(text, providers);
    if (aliased) return { kind: 'search', ...aliased, via: 'alias' };
    return { kind: 'search', provider: findProvider(providers, defaultId), query: text, via: 'default' };
}

/** The address to open for a search, or null when the browser's own engine must handle it. */
export function searchUrl(provider: SearchProvider, query: string): string | null {
    if (provider.browserDefault || !provider.urlTemplate) return null;
    // A replacer function, so characters like `$` in the query are never treated as patterns.
    return provider.urlTemplate.replace('%s', () => encodeURIComponent(query));
}

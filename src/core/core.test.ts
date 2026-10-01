import { describe, expect, it } from 'vitest';
import { exportBackup, importBackup } from './backup';
import { categorize } from './catalog';
import { buildResults, interpret, matchScore, type CommandLabels } from './commands';
import { emptyState } from './defaults';
import { fromLegacy, resolveState } from './migrate';
import * as ops from './ops';
import { sanitize } from './sanitize';
import { routeQuery, searchUrl } from './search';
import { applyProposals, applyStarter, organize, parseUrlList, type SetupNames } from './setup';
import type { AppState } from './types';
import { normalizeUrl, titleFromUrl } from './url';

const names: SetupNames = {
    category: id => id.toUpperCase(),
    mode: key => `${key} mode`,
    otherSpace: 'Other',
    importedGroup: 'Imported',
};

const labels: CommandLabels = {
    allSpaces: 'All Spaces',
    modeHint: 'Mode',
    spaceHint: 'Space',
    themeHint: 'Theme',
    newSpace: 'New Space',
    settings: 'Settings',
    settingsSections: [{ id: 'search', label: 'Search settings' }],
    searchWith: (p, q) => `Search ${p} for ${q}`,
    openUrl: host => `Open ${host}`,
    recentHint: 'Recent',
    themes: [{ id: 'noir', name: 'Noir' }],
};

function seeded(): { state: AppState; spaceId: string } {
    const created = ops.addSpace(emptyState(), { name: 'Dev' });
    let state = created.state;
    state = ops.addItem(state, created.id, null, { url: 'github.com', title: 'GitHub' }).state;
    state = ops.addItem(state, created.id, null, { url: 'https://claude.ai', title: 'Claude' }).state;
    return { state, spaceId: created.id };
}

const LEGACY = {
    theme: 'light',
    language: 'TR',
    isPro: true,
    proExpiresAt: 123,
    folders: [
        {
            id: 'f2', name: 'Ai Tools', color: 'blue',
            links: [
                { id: 'l0', title: 'Loose', url: 'https://example.com', icon: '📁' },
                { id: 'h1', title: 'Works', type: 'header' },
                { id: 'l6', title: 'GitHub', url: 'https://github.com', icon: 'https://www.google.com/s2/favicons?domain=github.com&sz=128' },
                { id: 'h2', title: 'Ai Chat', type: 'header' },
                { id: 'l9', title: 'Claude', url: 'claude.ai' },
                { id: 'l10', title: 'Gemini', url: 'https://gemini.google.com' },
                { id: 'bad', title: 'My Portfolio', url: '#' },
                null,
            ],
        },
        'garbage',
        { id: 'f3', name: '', links: 'not-an-array' },
    ],
};

describe('url', () => {
    it('normalizes bare domains, localhost and rejects unsafe input', () => {
        expect(normalizeUrl('github.com')).toBe('https://github.com/');
        expect(normalizeUrl('localhost:3000/app')).toBe('http://localhost:3000/app');
        expect(normalizeUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeUrl('react animations')).toBeNull();
        expect(normalizeUrl('#')).toBeNull();
        expect(normalizeUrl('hello')).toBeNull();
        expect(titleFromUrl('https://www.github.com/x')).toBe('Github');
    });
});

describe('legacy migration', () => {
    it('converts folders to Spaces and headers to groups without losing valid links', () => {
        const result = fromLegacy(LEGACY)!;
        const { state } = result;
        expect(state.spaceOrder).toHaveLength(2);
        const space = state.spaces[state.spaceOrder[0]!]!;
        expect(space.name).toBe('Ai Tools');
        expect(space.groups.map(g => g.name)).toEqual(['', 'Works', 'Ai Chat']);
        expect(space.groups.map(g => g.itemIds.length)).toEqual([1, 1, 2]);
        expect(space.glyph).toBe('spark');
        expect(result.dropped).toBe(1);
        const items = ops.itemsOf(state, space);
        expect(items.find(i => i.title === 'Loose')?.icon).toBe('📁');
        expect(items.find(i => i.title === 'GitHub')?.icon).toBeUndefined();
        expect(items.find(i => i.title === 'Claude')?.url).toBe('https://claude.ai/');
    });

    it('carries preferences and entitlement, and marks the user as onboarded', () => {
        const { state } = fromLegacy(LEGACY)!;
        expect(state.prefs.themeId).toBe('fjord');
        expect(state.prefs.language).toBe('tr');
        expect(state.legacy).toEqual({ isPro: true, proExpiresAt: 123 });
        expect(state.onboarded).toBe(true);
    });

    it('prefers stored state, then legacy, then a fresh start', () => {
        const { state } = seeded();
        expect(resolveState(state, LEGACY).source).toBe('stored');
        expect(resolveState(undefined, LEGACY).source).toBe('legacy');
        expect(resolveState(undefined, undefined).source).toBe('fresh');
        expect(resolveState(undefined, 'corrupt').source).toBe('fresh');
    });

    it('survives a sanitize round trip unchanged', () => {
        const { state } = fromLegacy(LEGACY)!;
        expect(sanitize(JSON.parse(JSON.stringify(state)))).toEqual(state);
    });
});

describe('sanitize', () => {
    it('drops corrupted records but keeps the rest', () => {
        const { state, spaceId } = seeded();
        const raw = JSON.parse(JSON.stringify(state));
        const [firstId, secondId] = raw.spaces[spaceId].groups[0].itemIds;
        raw.items[firstId].url = 'javascript:alert(1)';
        raw.items.orphan = { id: 'orphan', title: 'x', url: 'https://x.com' };
        raw.spaces.broken = 42;
        raw.spaceOrder.push('ghost');
        raw.activeModeId = 'ghost';
        raw.prefs = { themeId: 7, motion: 'wild' };
        const clean = sanitize(raw);
        expect(Object.keys(clean.items)).toEqual([secondId]);
        expect(clean.spaces[spaceId]!.groups[0]!.itemIds).toEqual([secondId]);
        expect(clean.spaceOrder).toEqual([spaceId]);
        expect(clean.activeModeId).toBeNull();
        expect(clean.prefs.themeId).toBe('dusk');
        expect(clean.prefs.motion).toBe('full');
        expect(clean.providers.length).toBeGreaterThan(5);
    });

    it('returns a usable empty state for garbage', () => {
        expect(sanitize(null).spaceOrder).toEqual([]);
        expect(sanitize('x').providers.length).toBeGreaterThan(0);
    });
});

describe('space operations', () => {
    it('adds, moves, pins and removes items', () => {
        let { state, spaceId } = seeded();
        const [a, b] = state.spaces[spaceId]!.groups[0]!.itemIds as [string, string];
        state = ops.addGroup(state, spaceId, 'Docs');
        const docs = state.spaces[spaceId]!.groups[1]!.id;
        state = ops.moveItem(state, a, spaceId, docs);
        expect(state.spaces[spaceId]!.groups[1]!.itemIds).toEqual([a]);
        state = ops.moveItem(state, b, spaceId, docs, a);
        expect(state.spaces[spaceId]!.groups[1]!.itemIds).toEqual([b, a]);
        state = ops.togglePin(state, a);
        expect(ops.pinnedItems(state).map(i => i.id)).toEqual([a]);
        state = ops.removeGroup(state, spaceId, docs);
        expect(state.spaces[spaceId]!.groups[0]!.itemIds).toEqual([b, a]);
        state = ops.removeItem(state, a);
        expect(state.items[a]).toBeUndefined();
        expect(ops.itemIdsOf(state.spaces[spaceId]!)).toEqual([b]);
    });

    it('rejects invalid URLs and does not mutate its input', () => {
        const { state, spaceId } = seeded();
        const snapshot = JSON.stringify(state);
        expect(ops.addItem(state, spaceId, null, { url: 'not a url' }).id).toBeNull();
        ops.removeSpace(state, spaceId);
        ops.duplicateSpace(state, spaceId, 'Copy');
        expect(JSON.stringify(state)).toBe(snapshot);
    });

    it('removing a Space removes its items and Mode references', () => {
        let { state, spaceId } = seeded();
        state = ops.addMode(state, { name: 'Dev', glyph: 'code', spaceIds: [spaceId] }).state;
        state = ops.removeSpace(state, spaceId);
        expect(Object.keys(state.items)).toHaveLength(0);
        expect(Object.values(state.modes)[0]!.spaceIds).toEqual([]);
    });

    it('duplicates a Space with independent items', () => {
        const { state, spaceId } = seeded();
        const copy = ops.duplicateSpace(state, spaceId, 'Dev copy');
        expect(Object.keys(copy.state.items)).toHaveLength(4);
        expect(copy.state.spaces[copy.id!]!.name).toBe('Dev copy');
    });
});

describe('modes', () => {
    it('filters visible Spaces and overrides theme and search default', () => {
        let { state, spaceId } = seeded();
        const other = ops.addSpace(state, { name: 'Fun' });
        state = other.state;
        const mode = ops.addMode(state, { name: 'Dev', glyph: 'code', spaceIds: [spaceId], themeId: 'noir', providerId: 'github' });
        state = ops.setActiveMode(mode.state, mode.id);
        expect(ops.visibleSpaces(state).map(s => s.id)).toEqual([spaceId]);
        expect(ops.effectiveThemeId(state)).toBe('noir');
        expect(ops.effectiveProviderId(state)).toBe('github');
        const added = ops.addSpace(state, { name: 'New' });
        expect(ops.visibleSpaces(added.state).map(s => s.id)).toContain(added.id);
        state = ops.removeMode(state, mode.id);
        expect(state.activeModeId).toBeNull();
        expect(ops.visibleSpaces(state)).toHaveLength(2);
        expect(ops.effectiveThemeId(state)).toBe('dusk');
    });
});

describe('search router', () => {
    const { providers } = emptyState();
    it('routes aliases, addresses and plain queries', () => {
        const yt = routeQuery('y boris brejcha', providers, 'default');
        expect(yt).toMatchObject({ kind: 'search', query: 'boris brejcha', viaAlias: true });
        expect(yt?.kind === 'search' && searchUrl(yt.provider, yt.query)).toBe('https://www.youtube.com/results?search_query=boris%20brejcha');
        expect(routeQuery('gh nextjs animation', providers, 'default')).toMatchObject({ provider: { id: 'github' } });
        expect(routeQuery('github.com/vercel', providers, 'default')).toEqual({ kind: 'url', url: 'https://github.com/vercel' });
        const plain = routeQuery('react animations', providers, 'default');
        expect(plain).toMatchObject({ kind: 'search', viaAlias: false, provider: { id: 'default' } });
        expect(plain?.kind === 'search' && searchUrl(plain.provider, plain.query)).toBeNull();
        expect(routeQuery('g', providers, 'google')).toMatchObject({ query: 'g', viaAlias: false });
        expect(routeQuery('   ', providers, 'default')).toBeNull();
    });
});

describe('command engine', () => {
    it('ranks matches', () => {
        expect(matchScore('GitHub', 'git')).toBeGreaterThan(matchScore('Legit hub', 'git'));
        expect(matchScore('GitHub', 'xyz')).toBe(0);
    });

    it('puts saved items before the web search, and explicit routes first', () => {
        const { state } = seeded();
        const local = buildResults('clau', state, 'default', labels);
        expect(local[0]).toMatchObject({ kind: 'item', title: 'Claude' });
        expect(local.at(-1)?.kind).toBe('search');
        expect(buildResults('y claude', state, 'default', labels)[0]?.kind).toBe('search');
        expect(buildResults('example.org', state, 'default', labels)[0]?.kind).toBe('url');
        expect(buildResults('react animations', state, 'default', labels)).toHaveLength(1);
    });

    it('understands natural phrasings', () => {
        let { state, spaceId } = seeded();
        state = ops.addMode(state, { name: 'Dev', glyph: 'code', spaceIds: [spaceId] }).state;
        expect(interpret('switch to dev mode', state)).toEqual({ only: 'mode', term: 'dev' });
        expect(buildResults('switch to dev mode', state, 'default', labels)[0]).toMatchObject({ kind: 'mode', title: 'Dev' });
        expect(buildResults('open github', state, 'default', labels)[0]).toMatchObject({ kind: 'item', title: 'GitHub' });
        expect(buildResults('open dev space', state, 'default', labels)[0]).toMatchObject({ kind: 'space' });
        expect(buildResults('search youtube for react animations', state, 'default', labels)[0]?.action)
            .toEqual({ type: 'search', providerId: 'youtube', query: 'react animations' });
        // Looks like a Mode switch, matches none: falls back to an ordinary search.
        expect(buildResults('incognito mode', state, 'default', labels).at(-1)?.kind).toBe('search');
    });
});

describe('catalog and import', () => {
    it('categorizes by the most specific known host', () => {
        expect(categorize('https://music.youtube.com/watch')).toBe('music');
        expect(categorize('https://www.youtube.com/')).toBe('entertainment');
        expect(categorize('https://gist.github.com/x')).toBe('dev');
        expect(categorize('https://www.google.com/')).toBeNull();
        expect(categorize('https://unknown.example')).toBeNull();
    });

    it('creates starter Spaces and Modes from interests', () => {
        const state = applyStarter(emptyState(), ['ai', 'dev', 'entertainment'], names);
        expect(state.spaceOrder.map(id => state.spaces[id]!.name)).toEqual(['AI', 'DEV', 'ENTERTAINMENT']);
        expect(state.modeOrder.map(id => state.modes[id]!.name)).toEqual(['dev mode', 'chill mode']);
        expect(Object.keys(state.items).length).toBeGreaterThan(15);
        expect(applyStarter(emptyState(), ['ai'], names).modeOrder).toHaveLength(0);
    });

    it('organizes links, merges into existing Spaces and skips duplicates', () => {
        const starter = applyStarter(emptyState(), ['dev'], names);
        const proposals = organize([
            { title: 'GH', url: 'https://github.com' },
            { title: 'GitLab', url: 'gitlab.com' },
            { title: 'GitLab again', url: 'https://gitlab.com/' },
            { title: 'Blog', url: 'https://blog.example', folder: 'Reading' },
            { title: 'Broken', url: 'nope' },
        ]);
        expect(proposals.map(p => [p.categoryId, p.links.length])).toEqual([['dev', 2], [null, 1]]);
        const { state, added } = applyProposals(starter, proposals, names);
        expect(added).toBe(2);
        const dev = state.spaces[state.spaceOrder[0]!]!;
        expect(dev.groups.at(-1)).toMatchObject({ name: 'Imported' });
        const other = state.spaces[state.spaceOrder[1]!]!;
        expect(other.name).toBe('Other');
        expect(other.groups.map(g => g.name)).toEqual(['Reading']);
        expect(applyProposals(state, proposals, names).added).toBe(0);
    });

    it('parses pasted URL lists', () => {
        expect(parseUrlList('github.com\nDocs | https://devdocs.io\n\nnot a link\nMy site example.org')).toEqual([
            { title: '', url: 'github.com' },
            { title: 'Docs', url: 'https://devdocs.io' },
            { title: 'My site', url: 'example.org' },
        ]);
    });
});

describe('backup', () => {
    it('round-trips a setup without recent activity', () => {
        let { state } = seeded();
        state = ops.recordRecent(state, { url: 'https://github.com/', title: 'GitHub' });
        const restored = importBackup(exportBackup(state))!;
        expect(restored.spaces).toEqual(state.spaces);
        expect(restored.items).toEqual(state.items);
        expect(restored.recents).toEqual([]);
        expect(restored.onboarded).toBe(true);
    });

    it('imports legacy export files and rejects junk', () => {
        expect(importBackup(JSON.stringify(LEGACY.folders))?.spaceOrder).toHaveLength(2);
        expect(importBackup('{"hello":1}')).toBeNull();
        expect(importBackup('not json')).toBeNull();
    });
});

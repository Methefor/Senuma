import { describe, expect, it } from 'vitest';
import { CATEGORIES, categorize } from './catalog';
import { buildResults, defaultResults, groupResults, interpret, matchScore } from './commands';
import { MAX_DOCK, MAX_RECENTS, MAX_USAGE, emptyState } from './defaults';
import { context, labels, names, seeded } from './fixtures';
import { iconCandidates, knownAppIcon } from './icons';
import * as ops from './ops';
import { matchProviderName, routeQuery, searchUrl } from './search';
import { applyProposals, applyStarter, organize, parseUrlList } from './setup';
import { normalizeUrl, titleFromUrl } from './url';

describe('url', () => {
    it('normalizes bare domains, localhost and rejects unsafe input', () => {
        expect(normalizeUrl('github.com')).toBe('https://github.com/');
        expect(normalizeUrl('localhost:3000/app')).toBe('http://localhost:3000/app');
        expect(normalizeUrl('javascript:alert(1)')).toBeNull();
        expect(normalizeUrl('data:text/html,x')).toBeNull();
        expect(normalizeUrl('react animations')).toBeNull();
        expect(normalizeUrl('#')).toBeNull();
        expect(normalizeUrl('hello')).toBeNull();
        expect(titleFromUrl('https://www.github.com/x')).toBe('Github');
    });
});

describe('space operations', () => {
    it('adds, moves and removes items', () => {
        const { state: initial, spaceId, github: a, claude: b } = seeded();
        let state = ops.addGroup(initial, spaceId, 'Docs');
        const docs = state.spaces[spaceId]!.groups[1]!.id;
        state = ops.moveItem(state, a, spaceId, docs);
        expect(state.spaces[spaceId]!.groups[1]!.itemIds).toEqual([a]);
        state = ops.moveItem(state, b, spaceId, docs, a);
        expect(state.spaces[spaceId]!.groups[1]!.itemIds).toEqual([b, a]);
        state = ops.shiftGroup(state, spaceId, docs, -1);
        expect(state.spaces[spaceId]!.groups[0]!.id).toBe(docs);
        state = ops.removeGroup(state, spaceId, docs);
        expect(state.spaces[spaceId]!.groups[0]!.itemIds).toEqual([b, a]);
        state = ops.removeItem(state, a);
        expect(state.items[a]).toBeUndefined();
        expect(ops.itemIdsOf(state.spaces[spaceId]!)).toEqual([b]);
    });

    it('rejects invalid URLs and does not mutate its input', () => {
        const { state, spaceId, github } = seeded();
        const snapshot = JSON.stringify(state);
        expect(ops.addItem(state, spaceId, null, { url: 'not a url' }).id).toBeNull();
        expect(ops.updateItem(state, github, { url: 'javascript:1' })).toBe(state);
        ops.removeSpace(state, spaceId);
        ops.duplicateSpace(state, spaceId, 'Copy');
        ops.toggleDock(state, { kind: 'item', id: github });
        expect(JSON.stringify(state)).toBe(snapshot);
    });

    it('duplicates a Space with independent items', () => {
        const { state, spaceId } = seeded();
        const copy = ops.duplicateSpace(state, spaceId, 'Dev copy');
        expect(Object.keys(copy.state.items)).toHaveLength(4);
        expect(copy.state.spaces[copy.id!]!.name).toBe('Dev copy');
    });

    it('stores and clears a Space note', () => {
        const { state, spaceId } = seeded();
        const noted = ops.updateSpace(state, spaceId, { note: '  Client work  ' });
        expect(noted.spaces[spaceId]!.note).toBe('Client work');
        expect(ops.updateSpace(noted, spaceId, { note: ' ' }).spaces[spaceId]!.note).toBeUndefined();
    });
});

describe('space reordering', () => {
    function three() {
        let state = emptyState();
        const ids = ['A', 'B', 'C'].map(name => {
            const created = ops.addSpace(state, { name });
            state = created.state;
            return created.id;
        }) as [string, string, string];
        return { state, ids };
    }

    it('moves a Space before another, to the end, and by keyboard steps', () => {
        const { state, ids: [a, b, c] } = three();
        expect(ops.reorderSpace(state, c, a).spaceOrder).toEqual([c, a, b]);
        expect(ops.reorderSpace(state, a, null).spaceOrder).toEqual([b, c, a]);
        expect(ops.shiftSpace(state, a, 1).spaceOrder).toEqual([b, a, c]);
        expect(ops.shiftSpace(state, c, -1).spaceOrder).toEqual([a, c, b]);
    });

    it('returns the same state when nothing would change (interrupted or no-op drags)', () => {
        const { state, ids: [a, b, c] } = three();
        expect(ops.reorderSpace(state, a, a)).toBe(state);
        expect(ops.reorderSpace(state, a, b)).toBe(state);
        expect(ops.reorderSpace(state, c, null)).toBe(state);
        expect(ops.reorderSpace(state, 'ghost', a)).toBe(state);
        expect(ops.reorderSpace(state, a, 'ghost').spaceOrder).toEqual([b, c, a]);
        expect(ops.shiftSpace(state, a, -1)).toBe(state);
        expect(ops.shiftSpace(state, c, 1)).toBe(state);
    });

    it('never loses or duplicates a Space', () => {
        const { state: initial, ids } = three();
        let state = initial;
        for (let i = 0; i < 50; i++) {
            state = ops.reorderSpace(state, ids[i % 3]!, i % 4 === 0 ? null : ids[(i * 7) % 3]!);
            expect([...state.spaceOrder].sort()).toEqual([...ids].sort());
        }
    });

    it('reorders within the active Mode without touching the master order', () => {
        const { state, ids: [a, b, c] } = three();
        const mode = ops.addMode(state, { name: 'M', glyph: 'layers', spaceIds: [a, c] });
        const active = ops.setActiveMode(mode.state, mode.id);
        const moved = ops.reorderSpace(active, c, a);
        expect(moved.modes[mode.id]!.spaceIds).toEqual([c, a]);
        expect(moved.spaceOrder).toEqual([a, b, c]);
        expect(ops.reorderSpace(active, c, a, 'all').spaceOrder).toEqual([c, a, b]);
    });
});

describe('modes', () => {
    it('change the visible Spaces, theme, search default and dock together', () => {
        const base = seeded();
        const other = ops.addSpace(base.state, { name: 'Fun' });
        let state = ops.toggleDock(other.state, { kind: 'item', id: base.github });
        const mode = ops.addMode(state, { name: 'Dev', glyph: 'code', spaceIds: [base.spaceId], themeId: 'noir', providerId: 'github' });
        state = ops.setModeDock(mode.state, mode.id, true);
        state = ops.setActiveMode(state, mode.id);
        state = ops.toggleDock(state, { kind: 'space', id: base.spaceId });

        expect(ops.visibleSpaces(state).map(s => s.id)).toEqual([base.spaceId]);
        expect(ops.effectiveThemeId(state)).toBe('noir');
        expect(ops.effectiveProviderId(state)).toBe('github');
        expect(ops.activeDock(state)).toHaveLength(2);
        expect(state.dock).toHaveLength(1);

        const off = ops.setActiveMode(state, null);
        expect(ops.visibleSpaces(off)).toHaveLength(2);
        expect(ops.effectiveThemeId(off)).toBe('dusk');
        expect(ops.effectiveProviderId(off)).toBe('default');
        expect(ops.activeDock(off)).toHaveLength(1);
    });

    it('persist the active Mode through serialization and survive removal', () => {
        const base = seeded();
        const mode = ops.addMode(base.state, { name: 'Dev', glyph: 'code', spaceIds: [base.spaceId] });
        const active = ops.setActiveMode(mode.state, mode.id);
        expect(JSON.parse(JSON.stringify(active)).activeModeId).toBe(mode.id);
        expect(ops.setActiveMode(active, 'ghost').activeModeId).toBeNull();
        const added = ops.addSpace(active, { name: 'New' });
        expect(ops.visibleSpaces(added.state).map(s => s.id)).toContain(added.id);
        expect(ops.removeMode(active, mode.id).activeModeId).toBeNull();
    });

    it('share one dock unless a Mode asks for its own', () => {
        const base = seeded();
        const mode = ops.addMode(base.state, { name: 'Dev', glyph: 'code', spaceIds: [base.spaceId] });
        let state = ops.setActiveMode(mode.state, mode.id);
        state = ops.toggleDock(state, { kind: 'item', id: base.github });
        expect(state.dock).toHaveLength(1);
        state = ops.setModeDock(state, mode.id, true);
        expect(state.modes[mode.id]!.dock).toEqual(state.dock);
        state = ops.setModeDock(state, mode.id, false);
        expect(state.modes[mode.id]!.dock).toBeUndefined();
    });
});

describe('dock', () => {
    it('pins, unpins, reorders and stays bounded', () => {
        const base = seeded();
        const a = { kind: 'item' as const, id: base.github };
        const b = { kind: 'item' as const, id: base.claude };
        const sp = { kind: 'space' as const, id: base.spaceId };
        let state = [a, b, sp].reduce(ops.toggleDock, base.state);
        expect(ops.isDocked(state, sp)).toBe(true);
        expect(ops.reorderDock(state, sp, a).dock).toEqual([sp, a, b]);
        expect(ops.reorderDock(state, a, null).dock).toEqual([b, sp, a]);
        expect(ops.reorderDock(state, a, a)).toBe(state);
        expect(ops.toggleDock(state, b).dock).toEqual([a, sp]);
        expect(ops.toggleDock(state, { kind: 'item', id: 'ghost' })).toBe(state);
        for (let i = 0; i < MAX_DOCK + 4; i++) {
            const added = ops.addItem(state, base.spaceId, null, { url: `site${i}.com` });
            state = ops.toggleDock(added.state, { kind: 'item', id: added.id! });
        }
        expect(state.dock).toHaveLength(MAX_DOCK);
    });
});

describe('continue', () => {
    it('records only what was opened, most recent first, counted and bounded', () => {
        let state = seeded().state;
        state = ops.recordRecent(state, { url: 'https://a.com/', title: 'A' });
        state = ops.recordRecent(state, { url: 'https://b.com/', title: 'B', spaceId: state.spaceOrder[0] });
        state = ops.recordRecent(state, { url: 'https://a.com/', title: 'A' });
        expect(state.recents.map(r => [r.title, r.count])).toEqual([['A', 2], ['B', 1]]);
        for (let i = 0; i < MAX_RECENTS + 10; i++) state = ops.recordRecent(state, { url: `https://s${i}.com/`, title: 's' });
        expect(state.recents).toHaveLength(MAX_RECENTS);
        expect(ops.removeRecent(state, state.recents[0]!.url).recents).toHaveLength(MAX_RECENTS - 1);
    });
});

describe('search router', () => {
    const { providers } = emptyState();

    it('routes aliases, addresses and plain queries', () => {
        expect(routeQuery('y boris brejcha', providers, 'default')).toMatchObject({ kind: 'search', provider: { id: 'youtube' }, query: 'boris brejcha', via: 'alias' });
        expect(routeQuery('gh nextjs animation', providers, 'default')).toMatchObject({ provider: { id: 'github' } });
        expect(routeQuery('github.com/vercel', providers, 'default')).toEqual({ kind: 'url', url: 'https://github.com/vercel' });
        expect(routeQuery('react animations', providers, 'default')).toMatchObject({ kind: 'search', via: 'default', provider: { browserDefault: true } });
        expect(routeQuery('react animations', providers, 'google')).toMatchObject({ provider: { id: 'google' } });
        expect(routeQuery('g', providers, 'google')).toMatchObject({ query: 'g', via: 'default' });
        expect(routeQuery('   ', providers, 'default')).toBeNull();
    });

    it('covers every engine the product promises', () => {
        for (const id of ['default', 'google', 'youtube', 'github', 'reddit', 'chatgpt', 'claude', 'perplexity']) {
            expect(providers.some(p => p.id === id)).toBe(true);
        }
        expect(providers.filter(p => p.browserDefault)).toHaveLength(1);
    });

    it('encodes queries safely', () => {
        const google = providers.find(p => p.id === 'google')!;
        expect(searchUrl(google, 'c++ & "templates" 100%')).toBe('https://www.google.com/search?q=c%2B%2B%20%26%20%22templates%22%20100%25');
        expect(searchUrl(google, 'türkçe ığüşöç 日本')).toBe(`https://www.google.com/search?q=${encodeURIComponent('türkçe ığüşöç 日本')}`);
        expect(searchUrl(google, "$& $1 $' %s")).toBe(`https://www.google.com/search?q=${encodeURIComponent("$& $1 $' %s")}`);
        expect(searchUrl(providers.find(p => p.browserDefault)!, 'x')).toBeNull();
    });

    it('supports custom providers end to end', () => {
        let state = emptyState();
        expect(ops.isValidTemplate('https://kagi.com/search?q=%s')).toBe(true);
        for (const bad of ['https://kagi.com/search', 'javascript:alert(%s)', 'kagi.com/?q=%s', '%s']) expect(ops.isValidTemplate(bad)).toBe(false);
        state = ops.upsertProvider(state, { id: 'kagi', name: 'Kagi', urlTemplate: 'https://kagi.com/search?q=%s', aliases: ops.parseAliases('K, kg  bad!alias') });
        const route = routeQuery('kg static site', state.providers, 'default');
        expect(route).toMatchObject({ provider: { id: 'kagi' }, query: 'static site', via: 'alias' });
        expect(route?.kind === 'search' && searchUrl(route.provider, route.query)).toBe('https://kagi.com/search?q=static%20site');
        expect(matchProviderName('kagi static site', state.providers)).toMatchObject({ provider: { id: 'kagi' }, query: 'static site' });

        const mode = ops.addMode(ops.setPrefs(state, { defaultProviderId: 'kagi' }), { name: 'M', glyph: 'layers', spaceIds: [], providerId: 'kagi' });
        const removed = ops.removeProvider(mode.state, 'kagi');
        expect(removed.providers.some(p => p.id === 'kagi')).toBe(false);
        expect(removed.prefs.defaultProviderId).toBe('default');
        expect(removed.modes[mode.id]!.providerId).toBeUndefined();
        expect(ops.removeProvider(state, 'google')).toBe(state);
    });

    it('matches engines by name, including multi-word names', () => {
        expect(matchProviderName('youtube lofi', providers)).toMatchObject({ provider: { id: 'youtube' }, query: 'lofi' });
        expect(matchProviderName('stack overflow flexbox gap', providers)).toMatchObject({ provider: { id: 'stackoverflow' }, query: 'flexbox gap' });
        expect(matchProviderName('youtube', providers)).toBeNull();
        expect(matchProviderName('youtubers lofi', providers)).toBeNull();
    });
});

describe('command engine', () => {
    it('ranks exact, prefix, word, substring and fuzzy matches in that order', () => {
        const scores = ['github', 'git', 'hub', 'thu', 'gthb'].map(q => matchScore('GitHub', q));
        expect(scores).toEqual([...scores].sort((a, b) => b - a));
        expect(matchScore('My GitHub', 'git')).toBeGreaterThan(matchScore('Legit hub', 'git'));
        expect(scores.at(-1)).toBeGreaterThan(0);
        expect(matchScore('GitHub', 'xyz')).toBe(0);
        expect(matchScore('GitHub', 'gb')).toBe(0);
    });

    it('puts saved items before the web search, and explicit routes first', () => {
        const { state } = seeded();
        const local = buildResults('clau', state, context());
        expect(local[0]).toMatchObject({ kind: 'item', title: 'Claude' });
        expect(local.at(-1)?.kind).toBe('search');
        expect(buildResults('y claude', state, context())[0]?.kind).toBe('search');
        expect(buildResults('example.org', state, context())[0]?.kind).toBe('url');
        expect(buildResults('react animations', state, context('home'))).toHaveLength(1);
    });

    it('finds Spaces, Modes, links, commands, settings pages, themes and engines', () => {
        const base = seeded();
        const state = ops.addMode(base.state, { name: 'Dev', glyph: 'code', spaceIds: [base.spaceId] }).state;
        const kinds = (q: string) => buildResults(q, state, context()).map(r => `${r.kind}:${r.title}`);
        expect(kinds('dev')).toEqual(expect.arrayContaining(['space:Open Dev', 'mode:Switch to Dev Mode']));
        expect(kinds('new')).toContain('command:Create Space');
        expect(kinds('privacy')).toContain('command:Open Settings: Privacy');
        expect(kinds('settings')).toContain('command:Open Settings');
        expect(kinds('wallpaper')).toContain('command:Customize appearance');
        expect(kinds('noir')).toContain('theme:Use Noir theme');
        expect(kinds('youtube')).toContain('search:Search YouTube…');
        expect(buildResults('dev', state, context()).find(r => r.kind === 'space')?.shortcut).toBe('1');
    });

    it('treats an engine name differently in the command center and the search box', () => {
        const { state } = seeded();
        const palette = buildResults('youtube lofi', state, context('palette'));
        expect(palette[0]).toMatchObject({ kind: 'search', action: { providerId: 'youtube', query: 'lofi' } });
        const home = buildResults('amazon rainforest', state, context('home'));
        expect(home[0]).toMatchObject({ action: { providerId: 'default', query: 'amazon rainforest' } });
        expect(home[1]).toMatchObject({ action: { providerId: 'amazon', query: 'rainforest' } });
    });

    it('keeps fuzzy guesses from taking Enter away from the web search on Home', () => {
        const { state } = seeded();
        const home = buildResults('gthb', state, context('home'));
        expect(home[0]).toMatchObject({ kind: 'search', action: { providerId: 'default', query: 'gthb' } });
        expect(home[1]).toMatchObject({ kind: 'item', title: 'GitHub' });
        expect(buildResults('gthb', state, context('palette'))[0]).toMatchObject({ kind: 'item', title: 'GitHub' });
    });

    it('boosts what was chosen before', () => {
        const base = seeded();
        const extra = ops.addItem(base.state, base.spaceId, null, { url: 'gitlab.com', title: 'GitLab' });
        const before = buildResults('git', extra.state, context()).map(r => r.title);
        expect(before.slice(0, 2)).toEqual(['GitHub', 'GitLab']);
        const used = { ...extra.state, usage: { [`item:${extra.id}`]: context().now! - 1000 } };
        expect(buildResults('git', used, context())[0]?.title).toBe('GitLab');
    });

    it('uses one verb per kind of action', () => {
        const base = seeded();
        const state = ops.addMode(base.state, { name: 'Dev', glyph: 'code', spaceIds: [base.spaceId] }).state;
        const titles = [...defaultResults(state, labels), ...buildResults('dev', state, context()), ...buildResults('noir', state, context())]
            .filter(r => r.kind !== 'item' && r.kind !== 'recent')
            .map(r => r.title);
        for (const title of titles) expect(title).toMatch(/^(Open|Switch to|Show|Search|Create|Use|Customize|Go to) /);
    });

    it('groups results for display without changing what Enter runs', () => {
        const base = seeded();
        const state = ops.addMode(base.state, { name: 'Dev', glyph: 'code', spaceIds: [base.spaceId] }).state;
        const results = buildResults('dev', state, context());
        const groups = groupResults(results);
        expect(groups[0]!.results[0]).toBe(results[0]);
        expect(groups.map(g => g.group)).toEqual([...new Set(results.map(r => r.group))]);
        expect(groups.flatMap(g => g.results)).toHaveLength(results.length);
    });

    it('bounds remembered usage', () => {
        let state = emptyState();
        for (let i = 0; i < MAX_USAGE + 10; i++) state = ops.recordUsage(state, `k${i}`);
        expect(Object.keys(state.usage)).toHaveLength(MAX_USAGE);
    });

    it('understands natural phrasings', () => {
        const base = seeded();
        const state = ops.addMode(base.state, { name: 'Dev', glyph: 'code', spaceIds: [base.spaceId] }).state;
        expect(interpret('switch to dev mode', state)).toEqual({ only: 'mode', term: 'dev' });
        expect(buildResults('switch to dev mode', state, context())[0]).toMatchObject({ kind: 'mode', title: 'Switch to Dev Mode' });
        expect(buildResults('open github', state, context())[0]).toMatchObject({ kind: 'item', title: 'GitHub' });
        expect(buildResults('open dev space', state, context())[0]).toMatchObject({ kind: 'space' });
        expect(buildResults('search youtube for react animations', state, context())[0]?.action)
            .toEqual({ type: 'search', providerId: 'youtube', query: 'react animations' });
        // Looks like a Mode switch, matches none: falls back to an ordinary search.
        expect(buildResults('incognito mode', state, context()).at(-1)?.kind).toBe('search');
    });

    it('offers somewhere to go before anything is typed', () => {
        const base = seeded();
        let state = ops.addMode(base.state, { name: 'Dev', glyph: 'code', spaceIds: [base.spaceId] }).state;
        state = ops.recordRecent(state, { url: 'https://github.com/', title: 'GitHub' });
        expect(defaultResults(state, labels).map(r => r.kind)).toEqual(['recent', 'mode', 'command', 'command', 'command']);
        expect(buildResults('  ', state, context())).toEqual([]);
    });
});

describe('icons', () => {
    it('gives well-known apps their own icon instead of a shared generic one', () => {
        const gmail = knownAppIcon('https://mail.google.com/mail/u/0/');
        const sheets = knownAppIcon('https://docs.google.com/spreadsheets/d/abc');
        const docs = knownAppIcon('https://docs.google.com/document/d/abc');
        expect(new Set([gmail, sheets, docs, knownAppIcon('https://drive.google.com/'), knownAppIcon('https://calendar.google.com/')]).size).toBe(5);
        expect(knownAppIcon('https://music.youtube.com/')).not.toBe(knownAppIcon('https://www.youtube.com/'));
        expect(knownAppIcon('https://github.com/')).toBeUndefined();
        expect(knownAppIcon('https://mail.google.com.evil.example/')).toBeUndefined();
    });

    it('never contacts a third-party service unless the user opted in', () => {
        const site = iconCandidates('https://github.com/vercel', 'site');
        expect(site).toEqual(['https://github.com/favicon.ico']);
        expect(iconCandidates('https://github.com/', 'service')[0]).toContain('s2/favicons');
        expect(iconCandidates('https://github.com/', 'none')).toEqual([]);
        expect(iconCandidates('https://github.com/', 'none', 'https://my.cdn/icon.png')).toEqual(['https://my.cdn/icon.png']);
        expect(iconCandidates('file:///C:/notes.html', 'service')).toEqual([]);
        expect(iconCandidates('http://localhost:3000/app', 'site')).toEqual(['http://localhost:3000/favicon.ico']);
    });
});

describe('catalog and import', () => {
    it('categorizes by the most specific known host', () => {
        expect(categorize('https://music.youtube.com/watch')).toBe('entertainment');
        expect(categorize('https://open.spotify.com/album/1')).toBe('entertainment');
        expect(categorize('https://www.figma.com/file/x')).toBe('design');
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
        // Starter sets stay short enough to take in at a glance.
        for (const category of CATEGORIES) {
            const count = category.groups.reduce((sum, g) => sum + g.services.length, 0);
            expect(count, category.id).toBeLessThanOrEqual(10);
            for (const group of category.groups) expect(group.services.length, `${category.id}/${group.name}`).toBeLessThanOrEqual(5);
        }
        expect(applyStarter(emptyState(), ['ai'], names).modeOrder).toHaveLength(0);
        // Running it again (onboarding reopened) adds nothing.
        expect(applyStarter(state, ['ai', 'dev', 'entertainment'], names)).toBe(state);
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

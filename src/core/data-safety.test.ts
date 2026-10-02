import { normalizeUrl } from './url';
import { BRAND, STORAGE_KEYS } from '../brand';
import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKGROUND, MAX_WALLPAPERS, sanitizeBackground, suggestedDim, type WallpaperAsset } from './background';
import { addSnapshot, exportBackup, importBackup, mergeBackup, sanitizeSnapshots } from './backup';
import { MAX_SNAPSHOTS, emptyState } from './defaults';
import { LEGACY, seeded } from './fixtures';
import { fromLegacy, resolveState, upgrade } from './migrate';
import * as ops from './ops';
import { sanitize } from './sanitize';
import { SCHEMA_VERSION, type AppState } from './types';

const roundTrip = (state: AppState): any => JSON.parse(JSON.stringify(state));

describe('legacy migration', () => {
    it('converts folders to Spaces and headers to groups without losing valid links', () => {
        const state = fromLegacy(LEGACY)!;
        expect(state.spaceOrder).toHaveLength(3);
        const space = state.spaces[state.spaceOrder[0]!]!;
        expect(space.name).toBe('Ai Tools');
        expect(space.groups.map(g => g.name)).toEqual(['', 'Works', 'Ai Chat']);
        expect(space.groups.map(g => g.itemIds.length)).toEqual([1, 1, 2]);
        expect(space.glyph).toBe('spark');
        const items = ops.itemsOf(state, space);
        expect(items.find(i => i.title === 'Loose')?.icon).toBe('📁');
        expect(items.find(i => i.title === 'GitHub')?.icon).toBeUndefined();
        expect(items.find(i => i.title === 'Claude')?.url).toBe('https://claude.ai/');
    });

    it('reports exactly what happened', () => {
        // Skipped: the "#" link, the unsupported "note" type, the null link, the "garbage" folder.
        expect(fromLegacy(LEGACY)!.legacy?.summary).toEqual({ spaces: 3, links: 5, groups: 2, skipped: 4 });
    });

    it('keeps duplicate folders and colliding IDs as separate, uniquely identified records', () => {
        const state = fromLegacy(LEGACY)!;
        const [first, second] = state.spaceOrder.map(id => state.spaces[id]!);
        expect(first!.name).toBe(second!.name);
        expect(first!.id).not.toBe(second!.id);
        const ids = Object.keys(state.items);
        expect(new Set(ids).size).toBe(5);
        expect(ids).not.toContain('l9');
    });

    it('carries preferences and entitlement, and skips new-user onboarding', () => {
        const state = fromLegacy(LEGACY)!;
        expect(state.prefs).toMatchObject({ themeId: 'fjord', language: 'tr', openInNewTab: true, iconSource: 'service' });
        expect(state.legacy).toMatchObject({ isPro: true, proExpiresAt: 123, acknowledged: false });
        expect(state.onboarded).toBe(true);
    });

    it('sends an empty legacy install through onboarding instead', () => {
        const state = fromLegacy({ folders: [{ name: 'Empty', links: [] }] })!;
        expect(state.onboarded).toBe(false);
        expect(state.legacy?.acknowledged).toBe(true);
    });

    it('never mutates the legacy source', () => {
        const source = JSON.parse(JSON.stringify(LEGACY));
        fromLegacy(source);
        expect(source).toEqual(JSON.parse(JSON.stringify(LEGACY)));
    });

    it('survives malformed legacy data of every shape', () => {
        for (const junk of [null, undefined, 42, 'x', {}, { folders: null }, { folders: 'x' }]) {
            expect(resolveState(undefined, junk).source).toBe('fresh');
        }
        const odd = fromLegacy({ folders: [{ links: [{ url: 'https://a.com' }, { title: 5, url: 6 }, 7, []] }, null, 3], theme: {}, language: 9 })!;
        expect(Object.keys(odd.items)).toHaveLength(1);
        expect(odd.spaces[odd.spaceOrder[0]!]!.name).toBe('Untitled');
        expect(odd.legacy?.summary.skipped).toBe(5);
    });

    it('is idempotent: once a migrated state is stored, legacy data is never applied again', () => {
        const first = resolveState(undefined, LEGACY);
        expect(first.source).toBe('legacy');
        // The user then edits their setup…
        const edited = ops.removeSpace(first.state, first.state.spaceOrder[0]!);
        // …and every later launch boots from the stored state, however often it runs.
        let stored: unknown = roundTrip(edited);
        for (let launch = 0; launch < 3; launch++) {
            const next = resolveState(stored, LEGACY);
            expect(next.source).toBe('stored');
            expect(next.state.spaceOrder).toEqual(edited.spaceOrder);
            expect(Object.keys(next.state.items)).toEqual(Object.keys(edited.items));
            stored = roundTrip(next.state);
        }
    });

    it('does not fall back to legacy data when the stored state is damaged', () => {
        const resolved = resolveState({ schema: SCHEMA_VERSION, spaces: 'broken', onboarded: true }, LEGACY);
        expect(resolved.source).toBe('stored');
        expect(resolved.state.spaceOrder).toEqual([]);
    });

    it('survives serialization unchanged', () => {
        const state = fromLegacy(LEGACY)!;
        expect(sanitize(roundTrip(state))).toEqual(state);
    });
});

describe('migration from the published 1.8 build', () => {
    const LIVE = {
        folders: [
            { id: 'a', name: 'Work', color: 'blue', links: [{ id: '1', title: 'Mail', url: 'https://mail.example.com' }, { id: '2', title: 'Docs', url: 'docs.example.com' }] },
            { id: 'b', name: 'Fun', pinned: true, links: [{ id: '3', title: 'Video', url: 'https://video.example.com' }] },
        ],
        isPro: true, proExpiresAt: null, licenseKey: 'ABCD-1234', licenseInstanceId: 'x', theme: 'ocean', language: 'tr',
        quickBarLinks: [{ id: '3', title: 'Video', url: 'https://video.example.com', icon: '' }, { id: '9', title: 'Gone', url: 'https://gone.example.com' }, { id: 'bad', url: 'javascript:alert(1)' }],
        background: { type: 'image', value: 'data:image/png;base64,AAAA', id: 'x', overlay: 0, blur: 0 }, widgetLayout: {}, linkStats: {}, searchEngine: 'google', columnCount: 'auto',
    };
    const live = () => JSON.parse(JSON.stringify(LIVE));

    it('keeps every link, turns the quick bar into the dock and puts pinned folders first', () => {
        const state = fromLegacy(live())!;
        expect(state.spaceOrder.map(id => state.spaces[id]!.name)).toEqual(['Fun', 'Work', 'Quick bar']);
        expect(Object.values(state.items).map(item => item.url).sort()).toEqual(
            ['https://docs.example.com', 'https://gone.example.com', 'https://mail.example.com', 'https://video.example.com'].map(u => normalizeUrl(u)!).sort());
        expect(state.dock.map(entry => state.items[entry.id]!.title)).toEqual(['Video', 'Gone']);
        expect(state.legacy!.summary.links).toBe(4);
        expect(sanitize(JSON.parse(JSON.stringify(state))).dock).toEqual(state.dock);
    });

    it('carries language and theme, and keeps the licence key as a record only', () => {
        const state = fromLegacy(live())!;
        expect(state.prefs.language).toBe('tr');
        expect(state.prefs.themeId).toBe('dusk');
        expect(state.legacy).toMatchObject({ isPro: true, licenseKey: 'ABCD-1234' });
        expect(sanitize(JSON.parse(JSON.stringify(state))).legacy?.licenseKey).toBe('ABCD-1234');
        expect(fromLegacy({ ...live(), language: 'de' })!.prefs.language).toBe('en');
        expect(fromLegacy({ ...live(), language: undefined })!.prefs.language).toBe('en');
    });
});

describe('schema upgrades', () => {
    it('turns v2 pinned flags into an ordered dock and renames provider fields', () => {
        const v2 = {
            schema: 2, onboarded: true, updatedAt: 5,
            spaces: { s1: { id: 's1', name: 'Dev', glyph: 'code', accent: '#7C9CF0', createdAt: 1, groups: [{ id: 'g1', name: '', itemIds: ['a', 'b'] }] } },
            spaceOrder: ['s1'],
            items: {
                a: { id: 'a', title: 'A', url: 'https://a.com/', createdAt: 1 },
                b: { id: 'b', title: 'B', url: 'https://b.com/', createdAt: 1, pinned: true },
            },
            providers: [
                { id: 'default', name: 'Browser default', url: '', aliases: [], builtin: true },
                { id: 'mine', name: 'Mine', url: 'https://mine.dev/?q=%s', aliases: ['m'] },
            ],
            recents: [{ url: 'https://a.com/', title: 'A', at: 9 }],
            prefs: { iconSource: 'remote', themeId: 'noir' },
        };
        const state = upgrade(v2)!;
        expect(state.schema).toBe(SCHEMA_VERSION);
        expect(state.dock).toEqual([{ kind: 'item', id: 'b' }]);
        expect(state.providers.find(p => p.id === 'mine')?.urlTemplate).toBe('https://mine.dev/?q=%s');
        expect(state.providers.find(p => p.id === 'default')?.browserDefault).toBe(true);
        expect(state.recents[0]).toMatchObject({ count: 1, at: 9 });
        expect(state.prefs).toMatchObject({ iconSource: 'service', themeId: 'noir' });
    });

    it('gives a v3 state the new appearance fields with safe defaults', () => {
        const v3 = { ...roundTrip(seeded().state), schema: 3 };
        delete v3.wallpapers;
        delete v3.prefs.background;
        delete v3.prefs.atmosphere;
        delete v3.prefs.dockLabels;
        const state = upgrade(v3)!;
        expect(state.schema).toBe(SCHEMA_VERSION);
        expect(state.prefs.background).toEqual(DEFAULT_BACKGROUND);
        expect(state.prefs).toMatchObject({ atmosphere: 'cinematic', dockLabels: false });
        expect(state.wallpapers).toEqual({});
        expect(Object.keys(state.items)).toHaveLength(2);
    });

    it('rejects states it has no upgrade path for', () => {
        expect(upgrade({ schema: 1, spaces: {} })).toBeNull();
        expect(upgrade('nope')).toBeNull();
    });
});

describe('sanitize', () => {
    it('drops corrupted records but keeps the rest', () => {
        const { state, spaceId, claude } = seeded();
        const raw = roundTrip(ops.toggleDock(state, { kind: 'item', id: claude }));
        const [firstId] = raw.spaces[spaceId].groups[0].itemIds;
        raw.items[firstId].url = 'javascript:alert(1)';
        raw.items.orphan = { id: 'orphan', title: 'x', url: 'https://x.com' };
        raw.items['bad id!'] = { title: 'x', url: 'https://y.com' };
        raw.spaces.broken = 42;
        raw.spaceOrder.push('ghost');
        raw.activeModeId = 'ghost';
        raw.dock.push({ kind: 'item', id: 'ghost' }, { kind: 'item', id: claude }, 'x');
        raw.prefs = { themeId: 7, motion: 'wild' };
        raw.usage = { a: 1, b: 'x' };
        const clean = sanitize(raw);
        expect(Object.keys(clean.items)).toEqual([claude]);
        expect(clean.spaces[spaceId]!.groups[0]!.itemIds).toEqual([claude]);
        expect(clean.spaceOrder).toEqual([spaceId]);
        expect(clean.activeModeId).toBeNull();
        expect(clean.dock).toEqual([{ kind: 'item', id: claude }]);
        expect(clean.prefs).toMatchObject({ themeId: 'dusk', motion: 'full' });
        expect(clean.usage).toEqual({ a: 1 });
        expect(clean.providers.length).toBeGreaterThan(5);
    });

    it('lets an item belong to one group only and repairs duplicate group IDs', () => {
        const { state, spaceId, github } = seeded();
        const raw = roundTrip(state);
        raw.spaces[spaceId].groups.push({ id: raw.spaces[spaceId].groups[0].id, name: 'Dupe', itemIds: [github] });
        const clean = sanitize(raw);
        const groups = clean.spaces[spaceId]!.groups;
        expect(groups[1]!.itemIds).toEqual([]);
        expect(groups[0]!.id).not.toBe(groups[1]!.id);
    });

    it('never treats inherited object properties as records (constructor, toString, __proto__)', () => {
        const hostile = JSON.parse(`{
            "schema": 4, "onboarded": true,
            "spaces": { "__proto__": { "id": "__proto__", "name": "p" }, "constructor": { "id": "constructor", "name": "c" }, "ok": { "id": "ok", "name": "Real", "groups": [{ "id": "g", "itemIds": ["toString", "constructor", "valueOf"] }] } },
            "spaceOrder": ["constructor", "toString", "__proto__", "ok"],
            "items": {},
            "modes": { "m": { "id": "m", "name": "M", "spaceIds": ["constructor", "hasOwnProperty", "ok"], "dock": [{ "kind": "item", "id": "toString" }, { "kind": "space", "id": "valueOf" }] } },
            "modeOrder": ["constructor", "m"], "activeModeId": "constructor",
            "dock": [{ "kind": "space", "id": "constructor" }, { "kind": "item", "id": "hasOwnProperty" }],
            "recents": [{ "url": "https://example.com", "title": "x", "at": 1, "spaceId": "constructor" }],
            "prefs": { "background": { "source": { "kind": "upload", "assetId": "constructor" } } }
        }`);
        const state = sanitize(hostile);
        expect(state.spaceOrder).toEqual(['ok']);
        expect(state.spaces.ok!.groups[0]!.itemIds).toEqual([]);
        expect(state.modeOrder).toEqual(['m']);
        expect(state.modes.m!.spaceIds).toEqual(['ok']);
        expect(state.modes.m!.dock ?? []).toEqual([]);
        expect(state.activeModeId).toBeNull();
        expect(state.dock).toEqual([]);
        expect(state.recents[0]!.spaceId).toBeUndefined();
        expect(state.prefs.background.source).toEqual({ kind: 'theme' });
        expect(({} as Record<string, unknown>).name).toBeUndefined();
    });

    it('returns a usable empty state for garbage', () => {
        expect(sanitize(null).spaceOrder).toEqual([]);
        expect(sanitize('x').providers.length).toBeGreaterThan(0);
    });
});

describe('backgrounds', () => {
    const asset = (id: string): WallpaperAsset =>
        ({ id, name: 'Photo', width: 1920, height: 1080, bytes: 1000, color: '#203040', luminance: 0.2, lqip: 'data:image/jpeg;base64,AAAA', createdAt: 1 });
    const upload = (assetId: string) => ({ ...DEFAULT_BACKGROUND, source: { kind: 'upload' as const, assetId } });

    it('accepts every source kind and clamps adjustments', () => {
        const assets = { a1: asset('a1') };
        expect(sanitizeBackground({ source: { kind: 'solid', color: '#112233' } }, assets).source).toEqual({ kind: 'solid', color: '#112233' });
        expect(sanitizeBackground({ source: { kind: 'gradient', from: '#000000', to: '#ffffff', angle: 999 } }, assets).source).toEqual({ kind: 'gradient', from: '#000000', to: '#ffffff', angle: 360 });
        expect(sanitizeBackground({ source: { kind: 'preset', id: 'aurora' } }, assets).source).toEqual({ kind: 'preset', id: 'aurora' });
        expect(sanitizeBackground({ source: { kind: 'upload', assetId: 'a1' } }, assets).source).toEqual({ kind: 'upload', assetId: 'a1' });
        expect(sanitizeBackground({ fit: 'contain', x: -5, y: 500, blur: 9999, dim: 7, saturation: -1 }, assets))
            .toMatchObject({ fit: 'contain', x: 0, y: 100, blur: 40, dim: 0.9, saturation: 0 });
    });

    it('falls back to the theme for anything it cannot show', () => {
        for (const source of [
            { kind: 'solid', color: 'red; background: url(x)' }, { kind: 'gradient', from: '#000000' }, { kind: 'preset', id: 'nope' },
            { kind: 'upload', assetId: 'missing' }, { kind: 'video', src: 'x' }, null, 'theme', 7,
        ]) {
            expect(sanitizeBackground({ source }, {}).source).toEqual({ kind: 'theme' });
        }
        expect(sanitizeBackground(null, {})).toEqual(DEFAULT_BACKGROUND);
    });

    it('rejects wallpaper previews that are not inline raster images', () => {
        const raw = roundTrip(ops.addWallpaper(seeded().state, asset('a1')));
        raw.wallpapers.a1.lqip = 'javascript:alert(1)';
        raw.wallpapers.bad = 'nope';
        raw.wallpapers.a2 = { ...asset('a2'), lqip: 'data:image/svg+xml;base64,AAAA', color: 'red' };
        const clean = sanitize(raw);
        expect(Object.keys(clean.wallpapers)).toEqual(['a1', 'a2']);
        expect(clean.wallpapers.a1!.lqip).toBe('');
        expect(clean.wallpapers.a2).toMatchObject({ lqip: '', color: '#101014' });
    });

    it('lets a Mode override the background and falls through when it does not', () => {
        const base = seeded();
        const mode = ops.addMode(base.state, { name: 'Chill', glyph: 'moon', spaceIds: [] });
        const preset = { ...DEFAULT_BACKGROUND, source: { kind: 'preset' as const, id: 'ember' } };
        let state = ops.updateMode(mode.state, mode.id, { background: preset });
        expect(ops.effectiveBackground(state)).toEqual(DEFAULT_BACKGROUND);
        state = ops.setActiveMode(state, mode.id);
        expect(ops.effectiveBackground(state)).toEqual(preset);
        expect(sanitize(roundTrip(state)).modes[mode.id]!.background).toEqual(preset);
        state = ops.updateMode(state, mode.id, { background: null });
        expect(state.modes[mode.id]!.background).toBeUndefined();
        expect(ops.effectiveBackground(state)).toEqual(DEFAULT_BACKGROUND);
        expect(ops.updateMode(state, mode.id, { name: 'Calm' }).modes[mode.id]!.background).toBeUndefined();
    });

    it('removing an image returns every background that used it to the theme default', () => {
        const base = seeded();
        const mode = ops.addMode(base.state, { name: 'Chill', glyph: 'moon', spaceIds: [] });
        let state = ops.addWallpaper(ops.addWallpaper(mode.state, asset('a1')), asset('a2'));
        state = ops.setPrefs(state, { background: upload('a1') });
        state = ops.updateMode(state, mode.id, { background: upload('a1') });
        const removed = ops.removeWallpaper(state, 'a1');
        expect(Object.keys(removed.wallpapers)).toEqual(['a2']);
        expect(removed.prefs.background.source).toEqual({ kind: 'theme' });
        expect(removed.modes[mode.id]!.background!.source).toEqual({ kind: 'theme' });
        expect(ops.removeWallpaper(state, 'ghost')).toBe(state);
    });

    it('keeps the library bounded', () => {
        let state = seeded().state;
        for (let i = 0; i < MAX_WALLPAPERS + 3; i++) state = ops.addWallpaper(state, asset(`a${i}`));
        expect(Object.keys(state.wallpapers)).toHaveLength(MAX_WALLPAPERS);
    });

    it('a stored state whose image is gone still loads, on the theme background', () => {
        const raw = roundTrip(ops.setPrefs(ops.addWallpaper(seeded().state, asset('a1')), { background: upload('a1') }));
        delete raw.wallpapers.a1;
        expect(sanitize(raw).prefs.background.source).toEqual({ kind: 'theme' });
    });

    it('never puts uploaded images, or references to them, into a backup file', () => {
        const base = seeded();
        const mode = ops.addMode(base.state, { name: 'Chill', glyph: 'moon', spaceIds: [] });
        let state = ops.addWallpaper(mode.state, asset('a1'));
        state = ops.setPrefs(state, { background: { ...upload('a1'), dim: 0.6 }, themeId: 'noir', atmosphere: 'subtle' });
        state = ops.updateMode(state, mode.id, { background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'ember' } } });
        const text = exportBackup(state);
        expect(text).not.toContain('lqip');
        expect(text).not.toContain('assetId');
        const restored = importBackup(text)!;
        expect(restored.wallpapers).toEqual({});
        expect(restored.prefs).toMatchObject({ themeId: 'noir', atmosphere: 'subtle' });
        expect(restored.prefs.background).toMatchObject({ source: { kind: 'theme' }, dim: 0.6 });
        expect(restored.modes[mode.id]!.background!.source).toEqual({ kind: 'preset', id: 'ember' });
    });

    it('suggests more wash when a picture fights the theme', () => {
        expect(suggestedDim(0.9, 'dark')).toBeGreaterThan(suggestedDim(0.1, 'dark'));
        expect(suggestedDim(0.1, 'light')).toBeGreaterThan(suggestedDim(0.9, 'light'));
        expect(suggestedDim(1, 'dark')).toBeLessThanOrEqual(0.9);
    });
});

describe('undo', () => {
    it('restores a link to its exact place, including the dock', () => {
        const base = seeded();
        const docked = ops.toggleDock(base.state, { kind: 'item', id: base.github });
        const removed = ops.captureItem(docked, base.github)!;
        const without = ops.removeItem(docked, base.github);
        expect(without.dock).toEqual([]);
        expect(ops.restoreItem(without, removed)).toEqual(docked);
    });

    it('restores a Space with its groups, links, order, Mode membership and dock entries', () => {
        const base = seeded();
        let state = ops.addGroup(base.state, base.spaceId, 'Docs');
        state = ops.moveItem(state, base.claude, base.spaceId, state.spaces[base.spaceId]!.groups[1]!.id);
        state = ops.addSpace(state, { name: 'Fun' }).state;
        state = ops.reorderSpace(state, base.spaceId, null);
        const mode = ops.addMode(state, { name: 'Work', glyph: 'briefcase', spaceIds: [base.spaceId, state.spaceOrder[0]!] });
        state = ops.setModeDock(mode.state, mode.id, true);
        state = ops.toggleDock(state, { kind: 'space', id: base.spaceId });
        state = ops.toggleDock(ops.setActiveMode(state, mode.id), { kind: 'item', id: base.claude });
        state = ops.setActiveMode(state, null);

        const removed = ops.captureSpace(state, base.spaceId)!;
        const without = ops.removeSpace(state, base.spaceId);
        expect(Object.keys(without.items)).toHaveLength(0);
        expect(without.dock).toEqual([]);
        expect(without.modes[mode.id]!.dock).toEqual([]);
        expect(ops.restoreSpace(without, removed)).toEqual(state);
    });

    it('keeps changes made after the deletion when undoing', () => {
        const base = seeded();
        const removed = ops.captureItem(base.state, base.github)!;
        let state = ops.removeItem(base.state, base.github);
        state = ops.addItem(state, base.spaceId, null, { url: 'vercel.com' }).state;
        const restored = ops.restoreItem(state, removed);
        expect(ops.itemsOf(restored, restored.spaces[base.spaceId]!).map(i => i.title)).toEqual(['GitHub', 'Claude', 'Vercel']);
    });

    it('restores a deleted group and takes its links back', () => {
        const base = seeded();
        let state = ops.addGroup(base.state, base.spaceId, 'Docs');
        const docs = state.spaces[base.spaceId]!.groups[1]!.id;
        state = ops.moveItem(state, base.claude, base.spaceId, docs);
        const removed = ops.captureGroup(state, base.spaceId, docs)!;
        const without = ops.removeGroup(state, base.spaceId, docs);
        expect(without.spaces[base.spaceId]!.groups[0]!.itemIds).toEqual([base.github, base.claude]);
        expect(ops.restoreGroup(without, removed)).toEqual(state);
    });

    it('is a no-op when the thing to restore into is gone, or is already back', () => {
        const base = seeded();
        const removed = ops.captureItem(base.state, base.github)!;
        expect(ops.restoreItem(base.state, removed)).toBe(base.state);
        const gone = ops.removeSpace(base.state, base.spaceId);
        expect(ops.restoreItem(gone, removed)).toBe(gone);
    });
});

describe('backup files', () => {
    it('round-trip a setup without private activity', () => {
        const base = seeded();
        let state = ops.recordRecent(base.state, { url: 'https://github.com/', title: 'GitHub' });
        state = ops.recordUsage(ops.toggleDock(state, { kind: 'space', id: base.spaceId }), 'item:x');
        const text = exportBackup(state);
        expect(JSON.parse(text)).toMatchObject({ kind: 'senuma-backup', schema: SCHEMA_VERSION });
        const restored = importBackup(text)!;
        expect(restored.spaces).toEqual(state.spaces);
        expect(restored.items).toEqual(state.items);
        expect(restored.dock).toEqual(state.dock);
        expect(restored.recents).toEqual([]);
        expect(restored.usage).toEqual({});
        expect(restored.onboarded).toBe(true);
    });

    it('validate what they import', () => {
        const { state, spaceId } = seeded();
        const file = JSON.parse(exportBackup(state));
        file.state.items.evil = { id: 'evil', title: 'x', url: 'javascript:alert(1)' };
        file.state.spaces[spaceId].groups[0].itemIds.push('evil', 'missing');
        const restored = importBackup(JSON.stringify(file))!;
        expect(Object.keys(restored.items)).toHaveLength(2);
        expect(restored.spaces[spaceId]!.groups[0]!.itemIds).toHaveLength(2);
    });

    it('read 1.x export files and reject unusable ones', () => {
        expect(importBackup(JSON.stringify(LEGACY.folders))?.spaceOrder).toHaveLength(3);
        expect(importBackup(JSON.stringify(LEGACY.folders))?.legacy?.acknowledged).toBe(true);
        const unusable = [
            '{"hello":1}', 'not json', '[]', '{"kind":"browser-os-backup"}',
            '{"kind":"browser-os-backup","schema":1,"state":{}}',
            JSON.stringify({ kind: 'browser-os-backup', schema: SCHEMA_VERSION, state: emptyState() }),
        ];
        for (const junk of unusable) expect(importBackup(junk)).toBeNull();
    });

    it('keeps every backup made before the rename readable', () => {
        const { state } = seeded();
        const current = JSON.parse(exportBackup(state));
        // A file exported by an earlier build of this product.
        const earlier = JSON.stringify({ ...current, kind: 'browser-os-backup' });
        const fromEarlier = importBackup(earlier)!;
        expect(fromEarlier.spaces).toEqual(state.spaces);
        expect(fromEarlier.items).toEqual(state.items);
        // An earlier build's file from an older schema, too.
        const v3 = JSON.parse(earlier);
        v3.schema = 3;
        v3.state.schema = 3;
        delete v3.state.wallpapers;
        delete v3.state.prefs.background;
        expect(importBackup(JSON.stringify(v3))?.spaceOrder).toEqual(state.spaceOrder);
        // A New Tab Folders 1.x export: the whole data object, or just the folders.
        expect(importBackup(JSON.stringify(LEGACY))?.spaceOrder).toHaveLength(3);
        expect(importBackup(JSON.stringify(LEGACY.folders))?.spaceOrder).toHaveLength(3);
        // And a kind nobody ever wrote is still refused.
        expect(importBackup(JSON.stringify({ ...current, kind: 'someone-elses-backup' }))).toBeNull();
    });

    it('writes the new name into new files without touching stored data keys', () => {
        expect(JSON.parse(exportBackup(seeded().state)).kind).toBe('senuma-backup');
        expect(BRAND.backupFilePrefix).toBe('senuma-backup');
        // Renaming these would orphan every user's setup.
        expect(STORAGE_KEYS).toEqual({ state: 'bos.state', snapshots: 'bos.snapshots', newerState: 'bos.state.newer', legacyData: 'ntf_data' });
    });

    it('merge adds what is missing and removes nothing', () => {
        const current = seeded();
        let incoming = seeded().state;
        const incomingSpace = incoming.spaceOrder[0]!;
        incoming = ops.addItem(incoming, incomingSpace, null, { url: 'vercel.com' }).state;
        incoming = ops.addGroup(incoming, incomingSpace, 'Docs');
        incoming = ops.addItem(incoming, incomingSpace, incoming.spaces[incomingSpace]!.groups[1]!.id, { url: 'devdocs.io' }).state;
        const extra = ops.addSpace(incoming, { name: 'Travel', glyph: 'globe' });
        incoming = ops.addItem(extra.state, extra.id, null, { url: 'booking.com' }).state;

        const merged = mergeBackup(current.state, incoming);
        expect([merged.spaces, merged.links]).toEqual([1, 3]);
        const dev = merged.state.spaces[current.spaceId]!;
        expect(dev.groups.map(g => [g.name, g.itemIds.length])).toEqual([['', 3], ['Docs', 1]]);
        expect(merged.state.spaceOrder.map(id => merged.state.spaces[id]!.name)).toEqual(['Dev', 'Travel']);
        expect(merged.state.spaces[merged.state.spaceOrder[1]!]!.groups).toHaveLength(1);
        // Merging the same file again changes nothing.
        expect(mergeBackup(merged.state, incoming)).toMatchObject({ spaces: 0, links: 0 });
    });
});

describe('snapshots', () => {
    it('are bounded, newest first, and exclude private activity', () => {
        let list = sanitizeSnapshots(undefined);
        const state = ops.recordRecent(seeded().state, { url: 'https://github.com/', title: 'GitHub' });
        for (let i = 0; i < MAX_SNAPSHOTS + 3; i++) list = addSnapshot(list, state, 'import', i);
        expect(list).toHaveLength(MAX_SNAPSHOTS);
        expect(list[0]!.at).toBe(MAX_SNAPSHOTS + 2);
        expect(list[0]!.state.recents).toEqual([]);
    });

    it('restore to an identical setup after a storage round trip, dropping unreadable entries', () => {
        const { state } = seeded();
        const stored = JSON.parse(JSON.stringify([...addSnapshot([], state, 'reset', 1), { id: 'x', at: 'bad' }, null]));
        const [snapshot, ...rest] = sanitizeSnapshots(stored);
        expect(rest).toEqual([]);
        expect(snapshot!.reason).toBe('reset');
        expect(snapshot!.state.spaces).toEqual(state.spaces);
        expect(snapshot!.state.items).toEqual(state.items);
    });
});

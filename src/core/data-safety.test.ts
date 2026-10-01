import { describe, expect, it } from 'vitest';
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

    it('returns a usable empty state for garbage', () => {
        expect(sanitize(null).spaceOrder).toEqual([]);
        expect(sanitize('x').providers.length).toBeGreaterThan(0);
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
        expect(JSON.parse(text)).toMatchObject({ kind: 'browser-os-backup', schema: SCHEMA_VERSION });
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

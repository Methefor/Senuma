import { describe, expect, it } from 'vitest';
import { MAX_DOCK, emptyState } from '../core/defaults';
import * as ops from '../core/ops';
import type { AppState } from '../core/types';
import { seededRandom, workspace } from './fixtures';
import { canonical, keepSide, mergeDocs, type MergeResult } from './merge';
import { emptyDoc, toSyncable, type SyncDoc } from './scope';

/** Two Spaces, four links, a dock and a Mode: the setup both devices start from. */
function start() {
    let state = emptyState();
    const dev = ops.addSpace(state, { name: 'Dev' });
    const media = ops.addSpace(dev.state, { name: 'Media' });
    state = media.state;
    const add = (space: string, url: string, title: string) => {
        const added = ops.addItem(state, space, null, { url, title });
        state = added.state;
        return added.id!;
    };
    const github = add(dev.id, 'github.com', 'GitHub');
    const claude = add(dev.id, 'claude.ai', 'Claude');
    const youtube = add(media.id, 'youtube.com', 'YouTube');
    const spotify = add(media.id, 'open.spotify.com', 'Spotify');
    state = ops.toggleDock(state, { kind: 'item', id: github });
    const mode = ops.addMode(state, { name: 'Work', glyph: 'W', spaceIds: [dev.id] });
    return { state: mode.state, dev: dev.id, media: media.id, github, claude, youtube, spotify, mode: mode.id };
}

const merge = (base: AppState, local: AppState, remote: AppState, resolutions = {}): MergeResult => mergeDocs(toSyncable(base), toSyncable(local), toSyncable(remote), resolutions);
const titles = (doc: SyncDoc) => Object.values(doc.items).map(item => item.title).sort();
const placesOf = (doc: SyncDoc, id: string) => Object.values(doc.spaces).flatMap(space => space.groups).filter(group => group.itemIds.includes(id)).length;

/** What must hold for any merged setup before it could be applied. */
function expectSound(doc: SyncDoc) {
    const placed = Object.values(doc.spaces).flatMap(space => space.groups.flatMap(group => group.itemIds));
    expect(new Set(placed).size, 'a link is in two places').toBe(placed.length);
    expect([...placed].sort(), 'links and their places disagree').toEqual(Object.keys(doc.items).sort());
    expect([...doc.spaceOrder].sort()).toEqual(Object.keys(doc.spaces).sort());
    expect([...doc.modeOrder].sort()).toEqual(Object.keys(doc.modes).sort());
    for (const space of Object.values(doc.spaces)) expect(space.groups.length, 'a Space without a group').toBeGreaterThan(0);
    for (const entry of [...doc.dock, ...Object.values(doc.modes).flatMap(mode => mode.dock ?? [])]) expect(entry.kind === 'item' ? entry.id in doc.items : entry.id in doc.spaces, 'dock points at nothing').toBe(true);
    for (const mode of Object.values(doc.modes)) for (const id of mode.spaceIds) expect(id in doc.spaces, 'Mode shows a missing Space').toBe(true);
    expect(doc.dock.length).toBeLessThanOrEqual(MAX_DOCK);
}

describe('changes on one side only', () => {
    it('nothing changed: nothing changes', () => {
        const { state } = start();
        const result = merge(state, state, state);
        expect(result.conflicts).toEqual([]);
        expect(canonical(result.doc)).toBe(canonical(toSyncable(state)));
    });

    it('are taken exactly, whichever side made them', () => {
        const s = start();
        let edited = ops.updateItem(s.state, s.github, { title: 'GitHub — work' });
        edited = ops.addItem(edited, s.media, null, { url: 'netflix.com', title: 'Netflix' }).state;
        edited = ops.removeItem(edited, s.spotify);
        edited = ops.updateSpace(edited, s.dev, { name: 'Code' });
        edited = ops.shiftSpace(edited, s.media, -1, 'all');
        edited = ops.addGroup(edited, s.dev, 'Docs');
        edited = ops.setPrefs(edited, { themeId: 'noir' });
        for (const result of [merge(s.state, edited, s.state), merge(s.state, s.state, edited)]) {
            expect(result.conflicts).toEqual([]);
            expect(canonical(result.doc)).toBe(canonical(toSyncable(edited)));
        }
    });
});

describe('changes on both sides that do not collide', () => {
    it('edits to different links are both kept', () => {
        const s = start();
        const result = merge(s.state, ops.updateItem(s.state, s.github, { title: 'GH' }), ops.updateItem(s.state, s.youtube, { title: 'YT' }));
        expect(result.conflicts).toEqual([]);
        expect(titles(result.doc)).toEqual(['Claude', 'GH', 'Spotify', 'YT']);
    });

    it('links added to the same group on both sides are both kept, each once', () => {
        const s = start();
        const local = ops.addItem(s.state, s.dev, null, { url: 'vercel.com', title: 'Vercel' }).state;
        const remote = ops.addItem(s.state, s.dev, null, { url: 'npmjs.com', title: 'npm' }).state;
        const result = merge(s.state, local, remote);
        expect(result.conflicts).toEqual([]);
        expect(titles(result.doc)).toEqual(['Claude', 'GitHub', 'Spotify', 'Vercel', 'YouTube', 'npm']);
        expectSound(result.doc);
    });

    it('the same edit on both sides is one edit', () => {
        const s = start();
        const edited = ops.updateItem(s.state, s.github, { title: 'Hub' });
        const result = merge(s.state, edited, edited);
        expect(result.conflicts).toEqual([]);
        expect(result.doc.items[s.github]!.title).toBe('Hub');
    });

    it('a link moved on one side and renamed on the other is moved and renamed', () => {
        const s = start();
        const result = merge(s.state, ops.moveItem(s.state, s.github, s.media, null), ops.updateItem(s.state, s.github, { title: 'Hub' }));
        expect(result.conflicts).toEqual([]);
        expect(result.doc.items[s.github]!.title).toBe('Hub');
        expect(result.doc.spaces[s.media]!.groups[0]!.itemIds).toContain(s.github);
        expectSound(result.doc);
    });

    it('a reorder on one side and an addition on the other: the new order, with the addition', () => {
        const s = start();
        const reordered = ops.shiftSpace(s.state, s.media, -1, 'all');
        const added = ops.addSpace(s.state, { name: 'Read' });
        const result = merge(s.state, reordered, added.state);
        expect(result.conflicts).toEqual([]);
        expect(result.doc.spaceOrder).toEqual([s.media, s.dev, added.id]);
    });

    it('a deletion on one side of something the other left alone is a deletion', () => {
        const s = start();
        const result = merge(s.state, ops.removeItem(s.state, s.claude), ops.updateItem(s.state, s.github, { title: 'GH' }));
        expect(result.conflicts).toEqual([]);
        expect(titles(result.doc)).toEqual(['GH', 'Spotify', 'YouTube']);
    });

    it('a Space deleted on one side goes with its links, its dock entries and its place in Modes', () => {
        const s = start();
        const result = merge(s.state, s.state, ops.removeSpace(s.state, s.dev));
        expect(result.conflicts).toEqual([]);
        expect(Object.keys(result.doc.spaces)).toEqual([s.media]);
        expect(titles(result.doc)).toEqual(['Spotify', 'YouTube']);
        expect(result.doc.dock).toEqual([]);
        expect(result.doc.modes[s.mode]!.spaceIds).toEqual([]);
        expectSound(result.doc);
    });

    it('settings changed on different sides are both kept; docks are combined', () => {
        const s = start();
        const local = ops.toggleDock(ops.setPrefs(s.state, { themeId: 'noir' }), { kind: 'space', id: s.media });
        const remote = ops.toggleDock(ops.setPrefs(s.state, { language: 'tr' }), { kind: 'item', id: s.spotify });
        const result = merge(s.state, local, remote);
        expect(result.conflicts).toEqual([]);
        expect(result.doc.prefs).toMatchObject({ themeId: 'noir', language: 'tr' });
        expect(result.doc.dock.map(entry => entry.id).sort()).toEqual([s.github, s.media, s.spotify].sort());
    });

    it('two different setups with no common past are joined, nothing dropped', () => {
        const a = start();
        const b = start();
        const result = mergeDocs({ ...emptyDoc(), providers: toSyncable(a.state).providers, prefs: toSyncable(a.state).prefs }, toSyncable(a.state), toSyncable(b.state));
        expect(result.conflicts).toEqual([]);
        expect(Object.keys(result.doc.spaces)).toHaveLength(4);
        expect(Object.keys(result.doc.items)).toHaveLength(8);
        expectSound(result.doc);
    });
});

describe('conflicts are reported, never decided silently', () => {
    it('the same link renamed differently', () => {
        const s = start();
        const local = ops.updateItem(s.state, s.github, { title: 'Mine' });
        const remote = ops.updateItem(s.state, s.github, { title: 'Theirs' });
        const open = merge(s.state, local, remote);
        expect(open.conflicts).toEqual([{ key: `item:${s.github}:title`, kind: 'item', id: s.github, field: 'title', base: 'GitHub', local: 'Mine', remote: 'Theirs' }]);
        expect(merge(s.state, local, remote, keepSide(open.conflicts, 'remote'))).toMatchObject({ conflicts: [], doc: { items: { [s.github]: { title: 'Theirs' } } } });
        expect(merge(s.state, local, remote, keepSide(open.conflicts, 'local'))).toMatchObject({ conflicts: [], doc: { items: { [s.github]: { title: 'Mine' } } } });
    });

    it('finds the same conflicts from either device', () => {
        const s = start();
        const a = ops.updateSpace(ops.updateItem(s.state, s.github, { title: 'A' }), s.dev, { name: 'A-dev' });
        const b = ops.updateSpace(ops.removeItem(s.state, s.github), s.dev, { name: 'B-dev' });
        expect(merge(s.state, a, b).conflicts.map(c => c.key).sort()).toEqual(merge(s.state, b, a).conflicts.map(c => c.key).sort());
        expect(merge(s.state, a, b).conflicts).toHaveLength(2);
    });

    it('a link edited on one side and deleted on the other is kept or removed by choice', () => {
        const s = start();
        const local = ops.updateItem(s.state, s.claude, { url: 'https://claude.ai/new' });
        const remote = ops.removeItem(s.state, s.claude);
        const open = merge(s.state, local, remote);
        expect(open.conflicts.map(c => c.key)).toEqual([`item:${s.claude}:exists`]);
        const kept = merge(s.state, local, remote, { [`item:${s.claude}:exists`]: 'local' });
        expect(kept.conflicts).toEqual([]);
        expect(kept.doc.items[s.claude]!.url).toBe('https://claude.ai/new');
        const removed = merge(s.state, local, remote, { [`item:${s.claude}:exists`]: 'remote' });
        expect(removed.doc.items[s.claude]).toBeUndefined();
        expectSound(kept.doc);
        expectSound(removed.doc);
    });

    it('a Space deleted on one side while the other added to it is ONE question, and the answer covers its links', () => {
        const s = start();
        const local = ops.addItem(s.state, s.dev, null, { url: 'vercel.com', title: 'Vercel' }).state;
        const remote = ops.removeSpace(s.state, s.dev);
        const open = merge(s.state, local, remote);
        expect(open.conflicts.map(c => c.key)).toEqual([`space:${s.dev}:exists`]);
        const kept = merge(s.state, local, remote, keepSide(open.conflicts, 'local'));
        expect(kept.conflicts).toEqual([]);
        expect(titles(kept.doc)).toEqual(['Claude', 'GitHub', 'Spotify', 'Vercel', 'YouTube']);
        const removed = merge(s.state, local, remote, keepSide(open.conflicts, 'remote'));
        expect(removed.conflicts).toEqual([]);
        expect(titles(removed.doc)).toEqual(['Spotify', 'YouTube']);
        expectSound(kept.doc);
        expectSound(removed.doc);
    });

    it('a link moved to different Spaces on each side is never in both', () => {
        const s = start();
        const read = ops.addSpace(s.state, { name: 'Read' });
        const local = ops.moveItem(read.state, s.github, s.media, null);
        const remote = ops.moveItem(read.state, s.github, read.id, null);
        const open = merge(read.state, local, remote);
        expect(open.conflicts.map(c => c.key)).toEqual([`item:${s.github}:group`]);
        for (const side of ['local', 'remote'] as const) {
            const settled = merge(read.state, local, remote, keepSide(open.conflicts, side));
            expect(settled.conflicts).toEqual([]);
            expect(placesOf(settled.doc, s.github)).toBe(1);
            expectSound(settled.doc);
        }
        expect(placesOf(open.doc, s.github)).toBe(1);
    });

    it('two different reorderings of the same list', () => {
        const s = start();
        const third = ops.addSpace(s.state, { name: 'Read' });
        const local = ops.shiftSpace(third.state, s.dev, 1, 'all');
        const remote = ops.shiftSpace(third.state, third.id, -1, 'all');
        const open = merge(third.state, local, remote);
        expect(open.conflicts.map(c => c.key)).toEqual(['space:all:order']);
        expect(merge(third.state, local, remote, { 'space:all:order': 'remote' }).doc.spaceOrder).toEqual(toSyncable(remote).spaceOrder);
        expect(merge(third.state, local, remote, { 'space:all:order': 'local' }).doc.spaceOrder).toEqual(toSyncable(local).spaceOrder);
    });

    it('the same setting changed to different values', () => {
        const s = start();
        const open = merge(s.state, ops.setPrefs(s.state, { themeId: 'noir' }), ops.setPrefs(s.state, { themeId: 'paper' }));
        expect(open.conflicts.map(c => c.key)).toEqual(['pref:themeId:value']);
    });

    it('an unresolved result keeps this device’s version, so nothing here is lost while the person decides', () => {
        const s = start();
        const local = ops.updateItem(s.state, s.github, { title: 'Mine' });
        const open = merge(s.state, local, ops.removeItem(s.state, s.github));
        expect(open.conflicts).toHaveLength(1);
        expect(open.doc.items[s.github]!.title).toBe('Mine');
    });

    it('refuses copies of different schemas', () => {
        const doc = toSyncable(start().state);
        expect(() => mergeDocs(doc, doc, { ...doc, schema: doc.schema + 1 })).toThrow();
    });
});

describe('any sequence of edits', () => {
    /** A random but repeatable series of real operations on a setup. */
    function edit(state: AppState, random: () => number, steps: number): AppState {
        const pick = <T>(list: T[]): T | undefined => list[Math.floor(random() * list.length)];
        let s = state;
        for (let i = 0; i < steps; i++) {
            const space = pick(s.spaceOrder);
            const item = pick(Object.keys(s.items));
            const roll = Math.floor(random() * 11);
            if (roll === 0 && space) s = ops.addItem(s, space, null, { url: `site${Math.floor(random() * 1e6)}.example`, title: `Site ${i}` }).state;
            else if (roll === 1 && item) s = ops.updateItem(s, item, { title: `Renamed ${Math.floor(random() * 1e6)}` });
            else if (roll === 2 && item) s = ops.removeItem(s, item);
            else if (roll === 3 && item && space) s = ops.moveItem(s, item, space, null);
            else if (roll === 4) s = ops.addSpace(s, { name: `Space ${Math.floor(random() * 1e6)}` }).state;
            else if (roll === 5 && space && s.spaceOrder.length > 2) s = ops.removeSpace(s, space);
            else if (roll === 6 && space) s = ops.updateSpace(s, space, { name: `Named ${Math.floor(random() * 1e6)}` });
            else if (roll === 7 && space) s = ops.shiftSpace(s, space, random() < 0.5 ? -1 : 1, 'all');
            else if (roll === 8 && space) s = ops.addGroup(s, space, `Group ${i}`);
            else if (roll === 9 && item) s = ops.toggleDock(s, { kind: 'item', id: item });
            else if (roll === 10) s = ops.setPrefs(s, { themeId: pick(['noir', 'dusk', 'paper'])! });
        }
        return s;
    }

    it('made on one device arrives unchanged on the other (300 runs)', () => {
        for (let seed = 1; seed <= 300; seed++) {
            const random = seededRandom(seed);
            const base = workspace({ links: 12, spaces: 3 }, seed);
            const edited = edit(base, random, 1 + Math.floor(random() * 12));
            const want = canonical(toSyncable(edited));
            for (const result of [merge(base, edited, base), merge(base, base, edited), merge(edited, edited, edited)]) {
                expect(result.conflicts, `seed ${seed}`).toEqual([]);
                expect(canonical(result.doc), `seed ${seed}`).toBe(want);
            }
        }
    });

    it('made on both devices gives a sound setup, the same conflicts from either side, and loses no untouched or newly added link (300 runs)', () => {
        let withConflicts = 0;
        for (let seed = 1; seed <= 300; seed++) {
            const random = seededRandom(seed * 7919);
            const base = workspace({ links: 12, spaces: 3 }, seed);
            const a = edit(base, random, 1 + Math.floor(random() * 8));
            const b = edit(base, random, 1 + Math.floor(random() * 8));
            const open = merge(base, a, b);
            expect(open.conflicts.map(c => c.key).sort(), `seed ${seed}`).toEqual(merge(base, b, a).conflicts.map(c => c.key).sort());
            if (open.conflicts.length) withConflicts++;
            for (const side of ['local', 'remote'] as const) {
                // Settling one question can raise another (keeping a Space brings its own questions), so settle until quiet.
                let resolutions = keepSide(open.conflicts, side);
                let settled = merge(base, a, b, resolutions);
                for (let round = 0; round < 6 && settled.conflicts.length; round++) {
                    resolutions = { ...resolutions, ...keepSide(settled.conflicts, side) };
                    settled = merge(base, a, b, resolutions);
                }
                expect(settled.conflicts, `seed ${seed}`).toEqual([]);
                expectSound(settled.doc);
                // A link nobody deleted, in a Space nobody deleted, is still there; so is every link either side added to a surviving Space.
                const spaceOf = (state: AppState, id: string) => ops.locateItem(state, id)?.spaceId;
                for (const state of [a, b]) {
                    const other = state === a ? b : a;
                    for (const id of Object.keys(state.items)) {
                        const added = !(id in base.items);
                        const deletedElsewhere = id in base.items && !(id in other.items);
                        const space = spaceOf(state, id)!;
                        const spaceGone = !(space in settled.doc.spaces);
                        if (!deletedElsewhere && !spaceGone && (added || id in other.items)) expect(id in settled.doc.items, `seed ${seed}: link ${id} lost`).toBe(true);
                    }
                }
            }
        }
        expect(withConflicts).toBeGreaterThan(20); // the runs really do collide
    });
});

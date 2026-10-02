import { describe, expect, it } from 'vitest';
import { seededRandom, workspace } from '../sync/fixtures';
import { importBackup, mergeBackup } from './backupImport';
import { exportBackup } from './backup';
import { emptyState } from './defaults';
import { seeded } from './fixtures';
import { ICON_CAP, ICON_TOTAL, capIcons, embeddedTotal } from './iconPolicy';
import { settleIcons } from './iconSettle';
import { fromLegacy } from './legacyConvert';
import { LIMITS, bounded, findings, newReport } from './limits';
import * as ops from './ops';
import { sanitize } from './sanitize';
import type { AppState } from './types';
import { normalizeUrl, titleFromUrl } from './url';

const long = (length: number, fill = 'x') => fill.repeat(length);
const urlOf = (length: number) => `https://example.com/${long(length - 'https://example.com/'.length, 'p')}`;
const embedded = (length: number) => `data:image/png;base64,${long(length - 22, 'A')}`;

describe('addresses', () => {
    it('are accepted up to 4096 characters and refused whole beyond that, never shortened', () => {
        expect(normalizeUrl(urlOf(LIMITS.url))).toBe(urlOf(LIMITS.url));
        expect(normalizeUrl(urlOf(LIMITS.url + 1))).toBeNull();
        expect(normalizeUrl(`example.com/${long(5000)}`)).toBeNull();
        // Whatever comes back is the whole address given, or nothing.
        const random = seededRandom(3);
        for (let run = 0; run < 300; run++) {
            const given = urlOf(30 + Math.floor(random() * 8000));
            const result = normalizeUrl(given);
            expect(result === null || result === given, `run ${run}`).toBe(true);
            expect(result === null).toBe(given.length > LIMITS.url);
        }
    });

    it('a link with an overlong address is not added, and editing one to an overlong address is refused', () => {
        const { state, spaceId, github } = seeded();
        const added = ops.addItem(state, spaceId, null, { url: urlOf(LIMITS.url + 1), title: 'Too long' });
        expect(added).toEqual({ state, id: null });
        expect(ops.updateItem(state, github, { url: urlOf(LIMITS.url + 1) })).toBe(state);
    });
});

describe('titles and names when typing or editing', () => {
    it('a link title of 256 characters is kept; a longer one is not kept in part: the site’s name is used', () => {
        const { state, spaceId } = seeded();
        const ok = ops.addItem(state, spaceId, null, { url: 'example.com', title: long(LIMITS.title) });
        expect(ok.state.items[ok.id!]!.title).toHaveLength(LIMITS.title);
        const over = ops.addItem(state, spaceId, null, { url: 'example.com', title: long(LIMITS.title + 1) });
        expect(over.state.items[over.id!]!.title).toBe('Example');
    });

    it('surrounding whitespace is trimmed, and is not counted against the limit', () => {
        const { state, spaceId } = seeded();
        const added = ops.addItem(state, spaceId, null, { url: 'example.com', title: `   ${long(LIMITS.title)}   ` });
        expect(added.state.items[added.id!]!.title).toBe(long(LIMITS.title));
        expect(bounded('  a  b  ', 10)).toBe('a  b'); // inner spacing is the person's own
    });

    it('an edit to an overlong title, Space name, note, group name or Mode name is refused: the old one stays', () => {
        const { state, spaceId, github } = seeded();
        expect(ops.updateItem(state, github, { title: long(LIMITS.title + 1) }).items[github]!.title).toBe('GitHub');
        expect(ops.updateSpace(state, spaceId, { name: long(LIMITS.name + 1) }).spaces[spaceId]!.name).toBe('Dev');
        const noted = ops.updateSpace(state, spaceId, { note: 'kept' });
        expect(ops.updateSpace(noted, spaceId, { note: long(LIMITS.label + 1) }).spaces[spaceId]!.note).toBe('kept');
        expect(ops.updateSpace(noted, spaceId, { note: '' }).spaces[spaceId]!.note).toBeUndefined();
        const grouped = ops.addGroup(state, spaceId, 'Docs');
        const group = grouped.spaces[spaceId]!.groups[1]!.id;
        expect(ops.renameGroup(grouped, spaceId, group, long(LIMITS.name + 1))).toBe(grouped);
        expect(ops.renameGroup(grouped, spaceId, group, long(LIMITS.name)).spaces[spaceId]!.groups[1]!.name).toHaveLength(LIMITS.name);
        const mode = ops.addMode(state, { name: 'Work', glyph: 'W', spaceIds: [] });
        expect(ops.updateMode(mode.state, mode.id, { name: long(LIMITS.name + 1) }).modes[mode.id]!.name).toBe('Work');
    });

    it('new Spaces, groups and Modes with an overlong name get the default name', () => {
        const state = emptyState();
        const space = ops.addSpace(state, { name: long(LIMITS.name + 1) });
        expect(space.state.spaces[space.id]!.name).toBe('Untitled');
        expect(ops.addGroup(space.state, space.id, long(LIMITS.name + 1)).spaces[space.id]!.groups[1]!.name).toBe('');
        const mode = ops.addMode(state, { name: long(LIMITS.name + 1), glyph: 'W', spaceIds: [] });
        expect(mode.state.modes[mode.id]!.name).toBe('Mode');
    });

    it('a search provider with an overlong name or address is not saved', () => {
        const state = emptyState();
        const provider = { id: 'p1', name: 'Docs', urlTemplate: 'https://docs.example/search?q=%s', aliases: ['d'] };
        expect(ops.upsertProvider(state, provider).providers.at(-1)).toEqual(provider);
        expect(ops.upsertProvider(state, { ...provider, name: long(LIMITS.label + 1) })).toBe(state);
        expect(ops.upsertProvider(state, { ...provider, urlTemplate: `https://docs.example/${long(LIMITS.url)}?q=%s` })).toBe(state);
    });
});

describe('icons when a link is saved without a page to re-encode them', () => {
    it('an embedded icon over 32 KB is not stored; the link is still added', () => {
        const { state, spaceId, github } = seeded();
        const added = ops.addItem(state, spaceId, null, { url: 'example.com', icon: embedded(ICON_CAP + 1) });
        expect(added.id).not.toBeNull();
        expect('icon' in added.state.items[added.id!]!).toBe(false);
        expect(ops.addItem(state, spaceId, null, { url: 'example.com', icon: embedded(ICON_CAP) }).state.items).toSatisfy((items: AppState['items']) => embeddedTotal(items) === ICON_CAP);
        // On edit, an oversized icon is refused and the one already there stays.
        const withIcon = ops.updateItem(state, github, { icon: embedded(1000) });
        expect(ops.updateItem(withIcon, github, { icon: embedded(ICON_CAP + 1) }).items[github]!.icon).toHaveLength(1000);
    });

    it('all embedded icons together stay within 128 KB, and replacing an icon gives its room back', () => {
        let { state } = seeded();
        const space = state.spaceOrder[0]!;
        const ids: string[] = [];
        for (let i = 0; i < 6; i++) {
            const added = ops.addItem(state, space, null, { url: `site${i}.example`, icon: embedded(30_000) });
            state = added.state;
            ids.push(added.id!);
        }
        expect(ids.map(id => !!state.items[id]!.icon)).toEqual([true, true, true, true, false, false]);
        expect(embeddedTotal(state.items)).toBeLessThanOrEqual(ICON_TOTAL);
        // The fourth link swaps its 30 000-character icon for another of the same size: allowed, because its own room counts.
        expect(ops.updateItem(state, ids[3]!, { icon: embedded(30_000).replace(/A$/, 'B') }).items[ids[3]!]!.icon!.endsWith('B')).toBe(true);
    });
});

describe('stored and imported data', () => {
    /** A stored state as an older build, or a hand-edited file, could hold it. */
    function oversized() {
        const base = workspace({ links: 6, spaces: 2 });
        const [a, b, c, d] = Object.keys(base.items);
        const space = base.spaceOrder[0]!;
        const raw = JSON.parse(JSON.stringify(base)) as AppState;
        raw.items[a!]!.title = long(LIMITS.title + 50, 'T');
        raw.items[b!]!.url = urlOf(LIMITS.url + 10);
        raw.items[c!]!.icon = embedded(ICON_CAP + 1000);
        raw.items[d!]!.title = `  ${long(LIMITS.title, 'k')}  `;
        raw.spaces[space]!.name = long(LIMITS.name + 1, 'S');
        raw.spaces[space]!.note = long(LIMITS.label + 1, 'n');
        raw.spaces[space]!.groups[1]!.name = long(LIMITS.name + 1, 'g');
        return { raw, a: a!, b: b!, c: c!, d: d!, space };
    }

    it('overlong values are rejected and counted; everything else is untouched', () => {
        const { raw, a, b, c, d, space } = oversized();
        const report = newReport();
        const state = sanitize(raw, { report });
        expect(report).toMatchObject({ linksSkipped: 1, titlesReplaced: 1, namesReplaced: 3, iconsReencoded: 0, iconsDropped: 1 });
        // Every text value that was not kept is in the report exactly as it was, so it can be given back.
        expect(report.originals).toEqual(expect.arrayContaining([
            { kind: 'title', of: normalizeUrl(raw.items[a]!.url), original: raw.items[a]!.title },
            { kind: 'link', of: raw.items[b]!.title, original: raw.items[b]!.url },
            { kind: 'name', of: 'space', original: raw.spaces[space]!.name },
            { kind: 'name', of: 'note', original: raw.spaces[space]!.note },
            { kind: 'name', of: 'group', original: raw.spaces[space]!.groups[1]!.name },
        ]));
        expect(report.originals).toHaveLength(5);
        expect(state.items[b]).toBeUndefined(); // the link with the overlong address is left out, not shortened
        expect(state.items[a]!.title).toBe(titleFromUrl(raw.items[a]!.url));
        expect(state.items[a]!.url).toBe(normalizeUrl(raw.items[a]!.url));
        expect('icon' in state.items[c]!).toBe(false);
        expect(state.items[d]!.title).toBe(long(LIMITS.title, 'k')); // only its surrounding spaces went
        expect(state.spaces[space]!.name).toBe('Untitled');
        expect(state.spaces[space]!.note).toBeUndefined();
        expect(state.spaces[space]!.groups[1]!.name).toBe('');
        expect(Object.keys(state.items)).toHaveLength(5);
    });

    it('a setup within the limits is read back exactly, with nothing to report', () => {
        const clean = sanitize(workspace({ links: 40, spaces: 3 }));
        const report = newReport();
        expect(sanitize(clean, { report })).toEqual(clean);
        expect(findings(report)).toBe(0);
    });

    it('nothing is ever shortened: every kept title and name is the one given (trimmed), or the default (300 runs)', () => {
        const random = seededRandom(11);
        for (let run = 0; run < 300; run++) {
            const base = workspace({ links: 5, spaces: 2 }, run + 1);
            const raw = JSON.parse(JSON.stringify(base)) as AppState;
            const given: Record<string, string> = {};
            for (const item of Object.values(raw.items)) {
                item.title = `${random() < 0.3 ? '  ' : ''}${long(Math.floor(random() ** 2 * 600) + 1, 'Qz')}`.slice(0, Math.floor(random() ** 2 * 600) + 1);
                given[item.id] = item.title;
            }
            for (const space of Object.values(raw.spaces)) space.name = long(Math.floor(random() * 300) + 1, 'N').slice(0, Math.floor(random() * 300) + 1);
            const state = sanitize(raw);
            for (const item of Object.values(state.items)) {
                expect(item.title.length).toBeLessThanOrEqual(LIMITS.title);
                expect(item.title === given[item.id]!.trim() || item.title === titleFromUrl(item.url) || (given[item.id]!.trim() === '' && item.title === item.url), `run ${run}`).toBe(true);
            }
            for (const space of Object.values(state.spaces)) expect(space.name === raw.spaces[space.id]!.name.trim() || space.name === 'Untitled', `run ${run}`).toBe(true);
        }
    });

    it('a backup file goes through the same limits and reports them', () => {
        const { raw } = oversized();
        const report = newReport();
        const imported = importBackup(JSON.stringify({ kind: 'senuma-backup', schema: raw.schema, state: raw }), { report })!;
        expect(report).toMatchObject({ linksSkipped: 1, titlesReplaced: 1, namesReplaced: 3, iconsDropped: 1 });
        expect(embeddedTotal(imported.items)).toBe(0);
        // A file this build wrote comes back with nothing to report.
        const again = newReport();
        importBackup(exportBackup(imported), { report: again });
        expect(findings(again)).toBe(0);
    });

    it('a New Tab Folders 1.x export goes through the same limits and reports them', () => {
        const report = newReport();
        const state = fromLegacy({
            folders: [{ name: long(LIMITS.name + 1), links: [
                { title: long(LIMITS.title + 1), url: 'https://a.example' },
                { title: 'Fine', url: urlOf(LIMITS.url + 1) },
                { title: 'Icon', url: 'https://b.example', icon: embedded(ICON_CAP + 1) },
                { type: 'header', title: long(LIMITS.name + 1) },
                { title: 'After', url: 'https://c.example' },
            ] }],
            quickBarLinks: [],
        }, { report })!;
        expect(report).toMatchObject({ titlesReplaced: 1, namesReplaced: 2, iconsDropped: 1 });
        expect(state.legacy!.summary.skipped).toBe(1); // the overlong address, counted where 1.x upgrades already report
        expect(Object.values(state.items).map(item => item.title).sort()).toEqual(['A', 'After', 'Icon']);
        expect(Object.values(state.spaces)[0]!.name).toBe('Untitled');
        expect(embeddedTotal(state.items)).toBe(0);
    });

    it('when a page will re-encode, oversized icons are left for it, and the pass that follows enforces the limits itself', async () => {
        const { raw, c } = oversized();
        const kept = sanitize(raw, { keepIcons: true });
        expect(kept.items[c]!.icon).toHaveLength(ICON_CAP + 1000);
        const settled = await settleIcons(kept, async () => `data:image/webp;base64,${long(2000, 'R')}`);
        expect(settled.report).toEqual({ reencoded: [c], dropped: [] });
        expect(capIcons(settled.value).dropped).toEqual([]);
        const withoutEncoder = await settleIcons(kept);
        expect(withoutEncoder.report).toEqual({ reencoded: [], dropped: [c] });
    });

    it('merging an imported setup cannot push the embedded icons past the total', () => {
        const current = sanitize(workspace({ links: 6, spaces: 1, iconBytes: 30_000 }, 1));
        const incoming = sanitize(workspace({ links: 6, spaces: 1, iconBytes: 30_000 }, 2));
        expect(embeddedTotal(current.items)).toBeGreaterThan(ICON_TOTAL * 0.8);
        const merged = mergeBackup(current, incoming).state;
        const result = mergeBackup(current, incoming);
        expect(Object.keys(merged.items)).toHaveLength(12); // no link is ever dropped for this reason
        expect(result.links).toBe(6);
        expect(embeddedTotal(merged.items)).toBeLessThanOrEqual(ICON_TOTAL);
        // The count is exact: incoming links that had an icon and now show their site's icon.
        const hadIcon = new Set(Object.values(incoming.items).filter(item => item.icon).map(item => item.url));
        const lostIcon = Object.values(result.state.items).filter(item => hadIcon.has(item.url) && !item.icon);
        expect(hadIcon.size).toBe(4);
        expect(result.iconsDropped).toBe(lostIcon.length);
        expect(result.iconsDropped).toBe(4);
        expect(mergeBackup(sanitize(workspace({ links: 3, spaces: 1 }, 5)), sanitize(workspace({ links: 3, spaces: 1 }, 6))).iconsDropped).toBe(0);
        expect(capIcons(merged).dropped).toEqual([]);
    });
});

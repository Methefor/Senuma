import { describe, expect, it } from 'vitest';
import { PAYLOAD_LIMIT, createVaultKey, newRecoverySecret, seal } from '../sync/crypto';
import { seededRandom, workspace } from '../sync/fixtures';
import { toSyncable } from '../sync/scope';
import { ICON_CAP, ICON_REFERENCE_MAX, ICON_TOTAL, capIcons, embeddedTotal, iconFits, isEmbedded, type Reencode } from './iconPolicy';
import { settleIcon, settleIcons } from './iconSettle';
import type { Item } from './types';

const embedded = (length: number, fill = 'A') => `data:image/png;base64,${fill.repeat(Math.max(0, length - 22))}`;
/** Stands in for the browser's re-encoder: a complete, different, smaller image of the size asked for. */
const shrinkTo = (length: number): Reencode => async (_original, max) => (length <= max ? `data:image/webp;base64,${'R'.repeat(length - 23)}` : null);
const items = (icons: (string | undefined)[]): Record<string, Item> =>
    Object.fromEntries(icons.map((icon, index) => [`i${index}`, { id: `i${index}`, title: `Link ${index}`, url: `https://site${index}.example`, createdAt: 1000 + index, ...(icon ? { icon } : {}) }]));

/** The policy, as a check that can be run on any set of links. */
function expectWithinPolicy(held: Record<string, Item>) {
    for (const item of Object.values(held)) {
        if (!item.icon) continue;
        if (isEmbedded(item.icon)) expect(item.icon.length, `${item.id} over the cap`).toBeLessThanOrEqual(ICON_CAP);
        else expect(item.icon.length).toBeLessThanOrEqual(ICON_REFERENCE_MAX);
    }
    expect(embeddedTotal(held)).toBeLessThanOrEqual(ICON_TOTAL);
}

describe('saving one link', () => {
    it('keeps an emoji, an image address and a small embedded icon exactly as given', async () => {
        for (const icon of ['⭐', 'https://example.com/icon.png', embedded(900), embedded(ICON_CAP)]) expect(await settleIcon(icon)).toBe(icon);
        expect(await settleIcon(undefined)).toBeUndefined();
        expect(await settleIcon('   ')).toBeUndefined();
    });

    it('re-encodes an embedded icon over 32 KB when it can, and uses the result only if it fits', async () => {
        const big = embedded(ICON_CAP + 1);
        expect(await settleIcon(big, { reencode: shrinkTo(4000) })).toHaveLength(4000);
        expect(await settleIcon(embedded(900_000), { reencode: shrinkTo(4000) })).toHaveLength(4000);
        // A re-encoder that returns something too large, something that is not an image, or fails, is not believed.
        expect(await settleIcon(big, { reencode: async () => embedded(ICON_CAP + 5) })).toBeUndefined();
        expect(await settleIcon(big, { reencode: async () => 'data:text/html;base64,AAAA' })).toBeUndefined();
        expect(await settleIcon(big, { reencode: async () => 'https://example.com/x.png' })).toBeUndefined();
        expect(await settleIcon(big, { reencode: async () => null })).toBeUndefined();
        expect(await settleIcon(big, { reencode: async () => { throw new Error('cannot decode'); } })).toBeUndefined();
    });

    it('falls back to the site’s own icon (no stored icon) when it cannot be made to fit', async () => {
        expect(await settleIcon(embedded(ICON_CAP + 1))).toBeUndefined();
        expect(await settleIcon(embedded(ICON_CAP + 1), { reencode: shrinkTo(ICON_CAP + 1) })).toBeUndefined();
    });

    it('never cuts an icon short: the result is the original, a complete re-encoding, or nothing', async () => {
        const random = seededRandom(7);
        for (let run = 0; run < 200; run++) {
            const original = embedded(Math.floor(random() * 120_000) + 30, 'Q');
            const result = await settleIcon(original, run % 2 ? { reencode: shrinkTo(1 + 23 + Math.floor(random() * 60_000)) } : {});
            if (result === undefined || result === original) continue;
            expect(result.startsWith('data:image/webp;base64,R') || result === 'data:image/webp;base64,', `run ${run}`).toBe(true); // the re-encoder's own output…
            expect(original.startsWith(result), `run ${run}`).toBe(false); // …never a prefix of the original
            expect(result.length).toBeLessThanOrEqual(ICON_CAP);
        }
    });

    it('refuses embedded data that is not an image, and endless non-embedded strings', async () => {
        expect(await settleIcon('data:text/html;base64,PHNjcmlwdD4=')).toBeUndefined();
        expect(await settleIcon('data:application/octet-stream;base64,AAAA', { reencode: shrinkTo(100) })).toBeUndefined();
        expect(await settleIcon(`https://example.com/${'a'.repeat(ICON_REFERENCE_MAX)}`)).toBeUndefined();
        expect(iconFits('🔥')).toBe(true);
    });

    it('respects the room left in the workspace: a fitting icon is shrunk further, or dropped, when little room remains', async () => {
        const icon = embedded(20_000);
        expect(await settleIcon(icon, { room: 50_000 })).toBe(icon);
        expect(await settleIcon(icon, { room: 5000, reencode: shrinkTo(3000) })).toHaveLength(3000);
        expect(await settleIcon(icon, { room: 5000 })).toBeUndefined();
        expect(await settleIcon(icon, { room: 0, reencode: shrinkTo(30) })).toBeUndefined();
    });
});

describe('data that already exists (imports, backups, older setups)', () => {
    it('leaves a setup that is within the policy untouched, as the same object', async () => {
        const holder = { items: items(['⭐', embedded(3000), undefined, 'https://example.com/a.png']) };
        const result = await settleIcons(holder);
        expect(result.value).toBe(holder);
        expect(result.report).toEqual({ reencoded: [], dropped: [] });
        expect(capIcons(holder).value).toBe(holder);
    });

    it('re-encodes oversized icons and reports which links changed; without a re-encoder they fall back', async () => {
        const holder = { items: items([embedded(200_000), embedded(1000), embedded(40_000)]) };
        const fixed = await settleIcons(holder, shrinkTo(5000));
        expect(fixed.report).toEqual({ reencoded: ['i0', 'i2'], dropped: [] });
        expect(fixed.value.items.i1!.icon).toBe(holder.items.i1!.icon);
        expectWithinPolicy(fixed.value.items);
        const plain = await settleIcons(holder);
        expect(plain.report).toEqual({ reencoded: [], dropped: ['i0', 'i2'] });
        expect('icon' in plain.value.items.i0!).toBe(false);
        expect(holder.items.i0!.icon).toHaveLength(200_000); // the input is not modified
    });

    it('holds all embedded icons together to 128 KB: older links keep theirs, newer ones fall back', async () => {
        const holder = { items: items(Array.from({ length: 10 }, () => embedded(30_000))) };
        const result = await settleIcons(holder);
        expect(result.report.dropped).toEqual(['i4', 'i5', 'i6', 'i7', 'i8', 'i9']);
        expect(embeddedTotal(result.value.items)).toBe(120_000);
        expect(capIcons(holder).dropped).toEqual(result.report.dropped);
    });

    it('adding a link never takes an icon away from an earlier one', () => {
        const before = items(Array.from({ length: 4 }, () => embedded(30_000)));
        const after = { ...before, ...Object.fromEntries(Object.entries(items(Array.from({ length: 9 }, () => embedded(30_000)))).slice(4)) };
        const kept = (held: Record<string, Item>) => Object.values(capIcons({ items: held }).value.items).filter(item => item.icon).map(item => item.id);
        expect(kept(after)).toEqual(kept(before));
    });

    it('any mix of icons ends within the policy, with every link still there and nothing else about it changed (300 runs)', async () => {
        for (let seed = 1; seed <= 300; seed++) {
            const random = seededRandom(seed);
            const icons = Array.from({ length: 1 + Math.floor(random() * 40) }, () => {
                const roll = random();
                return roll < 0.2 ? undefined : roll < 0.3 ? '⭐' : roll < 0.4 ? `https://cdn.example/${'p'.repeat(Math.floor(random() * 3000))}` : embedded(Math.floor(random() ** 3 * 250_000) + 30);
            });
            const holder = { items: items(icons) };
            for (const result of [(await settleIcons(holder, seed % 3 ? shrinkTo(24 + Math.floor(random() * 9000)) : undefined)).value, capIcons(holder).value]) {
                expectWithinPolicy(result.items);
                expect(Object.keys(result.items)).toEqual(Object.keys(holder.items));
                for (const [id, item] of Object.entries(result.items)) {
                    expect({ ...item, icon: undefined }).toEqual({ ...holder.items[id]!, icon: undefined });
                }
            }
        }
    });
});

describe('what sync uploads', () => {
    it('is within the policy whatever the setup holds', () => {
        for (const shape of [{ links: 100, iconBytes: 8192 }, { links: 300, iconBytes: 2048 }, { links: 40, iconBytes: 200_000 }, { links: 500, iconBytes: 31_000, iconShare: 0.5 }]) {
            const state = workspace(shape);
            expect(embeddedTotal(state.items)).toBeGreaterThan(ICON_TOTAL); // the setup itself is over…
            expectWithinPolicy(toSyncable(state).items); // …the uploaded copy is not
        }
    });

    it('so embedded icons can take at most about a fifth of the document limit, however many there are', async () => {
        const { key } = await createVaultKey(newRecoverySecret(), 'user_a', 'k1aaaaaa');
        const size = async (shape: Parameters<typeof workspace>[0]) => (await seal(key, toSyncable(workspace(shape)), { uid: 'user_a', path: 'workspace/current', keyId: 'k1aaaaaa', revision: 1 })).payload.length;
        const without = await size({ links: 1000 });
        const flooded = await size({ links: 1000, iconBytes: 31_000 });
        expect(flooded - without).toBeLessThan(PAYLOAD_LIMIT * 0.21);
        expect(flooded).toBeLessThan(PAYLOAD_LIMIT / 3);
    }, 10_000);
});

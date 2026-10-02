import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKGROUND, type Background } from '../core/background';
import * as ops from '../core/ops';
import { sanitize } from '../core/sanitize';
import type { AppState } from '../core/types';
import { workspace } from './fixtures';
import { canonical, mergeDocs } from './merge';
import { applyWithAssets, backgroundStatus, chooseBackground, differsFrom, projectWithAssets, reconcileAssets, useSyncedBackground, type Held } from './wallpaper';

const PHOTO = 'photoA1';
const asset = (id: string) => ({ id, name: 'holiday.jpg', width: 10, height: 10, bytes: 100, color: '#000000', luminance: 0, lqip: 'data:image/webp;base64,AAAA', createdAt: 1 });
const upload = (assetId = PHOTO): Background => ({ ...DEFAULT_BACKGROUND, source: { kind: 'upload', assetId }, dim: 0.5 });
const preset: Background = { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'forest-fog' } };
const solid: Background = { ...DEFAULT_BACKGROUND, source: { kind: 'solid', color: '#112233' } };

/** Device A added a picture and uses it. Device B has the same setup but not the picture. */
function twoDevices() {
    // Validated once, as a stored setup is on every load, so later validation has nothing of its own to change.
    const shared = sanitize(workspace({ links: 6, spaces: 2 }));
    const a: AppState = ops.setPrefs(ops.addWallpaper(shared, asset(PHOTO)), { background: upload() });
    const fromA = projectWithAssets(a, {});
    const received = applyWithAssets(shared, fromA, {})!;
    return { shared, a, fromA, b: received.state, held: received.held };
}

describe('the picture is on this device', () => {
    it('is applied and shown like any background; nothing is held or flagged', () => {
        const { a, fromA } = twoDevices();
        const again = applyWithAssets(ops.setPrefs(a, { background: preset }), fromA, {})!;
        expect(again.state.prefs.background).toEqual(upload());
        expect(again.held).toEqual({});
        expect(backgroundStatus(again.state, again.held)).toEqual([]);
    });
});

describe('the picture is not on this device', () => {
    it('is a valid state: the setup shows the theme’s backdrop and passes validation unchanged', () => {
        const { b } = twoDevices();
        expect(b.prefs.background).toEqual(DEFAULT_BACKGROUND);
        expect(sanitize(b).prefs.background).toEqual(b.prefs.background); // nothing for the validator to "repair"
    });

    it('keeps the reference exactly, and reports it as this device’s synced value', () => {
        const { b, held, fromA } = twoDevices();
        expect(held.default).toEqual({ synced: upload(), chosenHere: false });
        expect(canonical(projectWithAssets(b, held))).toBe(canonical(fromA));
    });

    it('has nothing to send, so it cannot overwrite the device that has the picture', () => {
        const { b, held, fromA } = twoDevices();
        expect(differsFrom(fromA, b, held)).toBe(false);
        // Survives a restart: the setup is validated again when loaded, and still reports the same.
        expect(differsFrom(fromA, sanitize(b), held)).toBe(false);
    });

    it('raises a flag the interface can show, and blocks nothing', () => {
        const { b, held } = twoDevices();
        expect(backgroundStatus(b, held)).toEqual([{ slot: 'default', assetMissingLocally: true, deviceChoice: false }]);
    });

    it('applying the same copy again changes nothing', () => {
        const { b, held, fromA } = twoDevices();
        const again = applyWithAssets(b, fromA, held)!;
        expect(again.state.prefs.background).toEqual(b.prefs.background);
        expect(again.held).toEqual(held);
    });
});

describe('the picture arrives later', () => {
    it('the device starts using it and the flag clears', () => {
        const { b, held, fromA } = twoDevices();
        const arrived = reconcileAssets(ops.addWallpaper(b, asset(PHOTO)), held);
        expect(arrived.state.prefs.background).toEqual(upload());
        expect(arrived.held).toEqual({});
        expect(backgroundStatus(arrived.state, arrived.held)).toEqual([]);
        expect(differsFrom(fromA, arrived.state, arrived.held)).toBe(false);
    });

    it('a different picture arriving changes nothing', () => {
        const { b, held } = twoDevices();
        const other = reconcileAssets(ops.addWallpaper(b, asset('somethingElse')), held);
        expect(other.state.prefs.background).toEqual(DEFAULT_BACKGROUND);
        expect(other.held).toEqual(held);
    });

    it('a background chosen here meanwhile stays until the person goes back to the synced one', () => {
        const { b, held, fromA } = twoDevices();
        const chosen = chooseBackground(b, held, 'default', preset);
        const arrived = reconcileAssets(ops.addWallpaper(chosen.state, asset(PHOTO)), chosen.held);
        expect(arrived.state.prefs.background).toEqual(preset);
        expect(backgroundStatus(arrived.state, arrived.held)).toEqual([{ slot: 'default', assetMissingLocally: false, deviceChoice: true }]);
        const back = useSyncedBackground(arrived.state, arrived.held, 'default');
        expect(back.state.prefs.background).toEqual(upload());
        expect(back.held).toEqual({});
        expect(differsFrom(fromA, back.state, back.held)).toBe(false);
    });
});

describe('the person changes the background', () => {
    it('on the device without the picture: it is this device’s own, and the synced reference is untouched', () => {
        const { b, held, fromA } = twoDevices();
        for (const choice of [preset, solid, upload('photoOnB')]) {
            const start = choice.source.kind === 'upload' ? ops.addWallpaper(b, asset('photoOnB')) : b;
            const chosen = chooseBackground(start, held, 'default', choice);
            expect(chosen.state.prefs.background).toEqual(choice);
            expect(chosen.held.default).toEqual({ synced: upload(), chosenHere: true });
            expect(differsFrom(fromA, chosen.state, chosen.held)).toBe(false); // nothing to send
            expect(backgroundStatus(chosen.state, chosen.held)).toEqual([{ slot: 'default', assetMissingLocally: true, deviceChoice: true }]);
        }
    });

    it('on that device, for all devices, when asked to: an ordinary change that syncs', () => {
        const { b, held, fromA } = twoDevices();
        const chosen = chooseBackground(b, held, 'default', preset, 'everywhere');
        expect(chosen.held).toEqual({});
        expect(differsFrom(fromA, chosen.state, chosen.held)).toBe(true);
        expect(projectWithAssets(chosen.state, chosen.held).prefs.background).toEqual(preset);
    });

    it('on the device that has the picture: an ordinary change that syncs, and the other device follows it', () => {
        const { a, b, held, fromA } = twoDevices();
        const changed = chooseBackground(a, {}, 'default', preset);
        expect(differsFrom(fromA, changed.state, changed.held)).toBe(true);
        const received = applyWithAssets(b, projectWithAssets(changed.state, changed.held), held)!;
        expect(received.state.prefs.background).toEqual(preset);
        expect(received.held).toEqual({});
    });

    it('a choice made here survives further syncs while the picture is still missing', () => {
        const { a, b, held } = twoDevices();
        const chosen = chooseBackground(b, held, 'default', solid);
        const fromAAgain = projectWithAssets(ops.updateSpace(a, a.spaceOrder[0]!, { name: 'Renamed on A' }), {});
        const received = applyWithAssets(chosen.state, fromAAgain, chosen.held)!;
        expect(received.state.prefs.background).toEqual(solid);
        expect(received.held.default).toEqual({ synced: upload(), chosenHere: true });
        expect(received.state.spaces[a.spaceOrder[0]!]!.name).toBe('Renamed on A');
    });

    it('going back to the synced background while the picture is missing shows the theme’s backdrop again', () => {
        const { b, held } = twoDevices();
        const chosen = chooseBackground(b, held, 'default', solid);
        const back = useSyncedBackground(chosen.state, chosen.held, 'default');
        expect(back.state.prefs.background).toEqual(DEFAULT_BACKGROUND);
        expect(back.held.default).toEqual({ synced: upload(), chosenHere: false });
    });
});

describe('merging between a device with the picture and one without', () => {
    it('finds no conflict and no change in the background, whichever device merges', () => {
        const { a, b, held, fromA } = twoDevices();
        const editedA = ops.updateSpace(a, a.spaceOrder[0]!, { name: 'A edit' });
        const editedB = ops.addItem(b, b.spaceOrder[1]!, null, { url: 'added-on-b.example', title: 'B edit' }).state;
        for (const [local, remote] of [[projectWithAssets(editedB, held), projectWithAssets(editedA, {})], [projectWithAssets(editedA, {}), projectWithAssets(editedB, held)]] as const) {
            const merged = mergeDocs(fromA, local, remote);
            expect(merged.conflicts).toEqual([]);
            expect(merged.doc.prefs.background).toEqual(upload());
            expect(Object.values(merged.doc.items).some(item => item.title === 'B edit')).toBe(true);
            expect(merged.doc.spaces[a.spaceOrder[0]!]!.name).toBe('A edit');
        }
    });

    it('a device choice on one side and a real change on the other is not a conflict: the real change wins everywhere', () => {
        const { a, b, held, fromA } = twoDevices();
        const chosenB = chooseBackground(b, held, 'default', solid);
        const changedA = chooseBackground(a, {}, 'default', preset);
        const merged = mergeDocs(fromA, projectWithAssets(chosenB.state, chosenB.held), projectWithAssets(changedA.state, changedA.held));
        expect(merged.conflicts).toEqual([]);
        expect(merged.doc.prefs.background).toEqual(preset);
    });

    it('two devices that each lack the other’s picture settle after one exchange and stay settled (no ping-pong)', () => {
        const { a, b, held, fromA } = twoDevices();
        // B deliberately sets its own picture for everyone; A does not have it.
        const bSets = chooseBackground(ops.addWallpaper(b, asset('photoOnB')), held, 'default', upload('photoOnB'), 'everywhere');
        const fromB = projectWithAssets(bSets.state, bSets.held);
        expect(mergeDocs(fromA, fromA, fromB).conflicts).toEqual([]);
        let deviceA = applyWithAssets(a, fromB, {})!;
        let deviceB = { state: bSets.state, held: bSets.held };
        expect(backgroundStatus(deviceA.state, deviceA.held)).toEqual([{ slot: 'default', assetMissingLocally: true, deviceChoice: false }]);
        // Sync back and forth: neither device ever has anything to send, and the synced value never moves.
        for (let round = 0; round < 5; round++) {
            expect(differsFrom(fromB, deviceA.state, deviceA.held), `A, round ${round}`).toBe(false);
            expect(differsFrom(fromB, deviceB.state, deviceB.held), `B, round ${round}`).toBe(false);
            deviceB = applyWithAssets(deviceB.state, projectWithAssets(deviceA.state, deviceA.held), deviceB.held)!;
            deviceA = applyWithAssets(deviceA.state, projectWithAssets(deviceB.state, deviceB.held), deviceA.held)!;
            expect(projectWithAssets(deviceA.state, deviceA.held).prefs.background).toEqual(upload('photoOnB'));
        }
        // A may still show its own picture, on A only.
        const aKeeps = chooseBackground(deviceA.state, deviceA.held, 'default', upload(PHOTO));
        expect(aKeeps.state.prefs.background).toEqual(upload(PHOTO));
        expect(differsFrom(fromB, aKeeps.state, aKeeps.held)).toBe(false);
    });
});

describe('a Mode’s own background', () => {
    it('follows the same rules', () => {
        const shared = workspace({ links: 4, spaces: 1 });
        const withMode = ops.addMode(ops.addWallpaper(shared, asset(PHOTO)), { name: 'Evening', glyph: 'E', spaceIds: [], background: upload() });
        const fromA = projectWithAssets(withMode.state, {});
        const received = applyWithAssets(shared, fromA, {})!;
        const slot = `mode:${withMode.id}`;
        expect(received.state.modes[withMode.id]!.background).toEqual(DEFAULT_BACKGROUND);
        expect(received.held[slot]).toEqual({ synced: upload(), chosenHere: false });
        expect(differsFrom(fromA, received.state, received.held)).toBe(false);
        expect(backgroundStatus(received.state, received.held)).toEqual([{ slot, assetMissingLocally: true, deviceChoice: false }]);
        const arrived = reconcileAssets(ops.addWallpaper(received.state, asset(PHOTO)), received.held);
        expect(arrived.state.modes[withMode.id]!.background).toEqual(upload());
        const held: Held = arrived.held;
        expect(held).toEqual({});
    });
});

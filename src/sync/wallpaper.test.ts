import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../brand';
import { DEFAULT_BACKGROUND, type Background } from '../core/background';
import { exportBackup } from '../core/backup';
import * as ops from '../core/ops';
import { sanitize } from '../core/sanitize';
import type { AppState } from '../core/types';
import { workspace } from './fixtures';
import { canonical, mergeDocs } from './merge';
import {
    applyWithAssets, backgroundStatus, chooseBackground, differsFrom, emptyDeviceLocal, projectWithAssets, reconcileAssets, sanitizeDeviceLocal, useSyncedBackground,
    type DeviceLocal,
} from './wallpaper';

const PHOTO = 'photoA1';
const asset = (id: string) => ({ id, name: 'holiday.jpg', width: 10, height: 10, bytes: 100, color: '#000000', luminance: 0, lqip: 'data:image/webp;base64,AAAA', createdAt: 1 });
const upload = (assetId = PHOTO): Background => ({ ...DEFAULT_BACKGROUND, source: { kind: 'upload', assetId }, dim: 0.5 });
const preset: Background = { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'forest-fog' } };
const solid: Background = { ...DEFAULT_BACKGROUND, source: { kind: 'solid', color: '#112233' } };
const none = emptyDeviceLocal;
const holding = (synced: Background, chosen?: Background): DeviceLocal => ({ heldSyncedBackgrounds: { default: synced }, backgroundOverrides: chosen ? { default: chosen } : {} });

/** Device A added a picture and uses it. Device B has the same setup but not the picture. */
function twoDevices() {
    // Validated once, as a stored setup is on every load, so later validation has nothing of its own to change.
    const shared = sanitize(workspace({ links: 6, spaces: 2 }));
    const a: AppState = ops.setPrefs(ops.addWallpaper(shared, asset(PHOTO)), { background: upload() });
    const fromA = projectWithAssets(a, none());
    const received = applyWithAssets(shared, fromA, none())!;
    return { shared, a, fromA, b: received.state, device: received.device };
}

describe('the picture is on this device', () => {
    it('is applied and shown like any background; nothing is held or flagged', () => {
        const { a, fromA } = twoDevices();
        const again = applyWithAssets(ops.setPrefs(a, { background: preset }), fromA, none())!;
        expect(again.state.prefs.background).toEqual(upload());
        expect(again.device).toEqual(none());
        expect(backgroundStatus(again.state, again.device)).toEqual([]);
    });
});

describe('the picture is not on this device', () => {
    it('is a valid state: the setup shows the theme’s backdrop and passes validation unchanged', () => {
        const { b } = twoDevices();
        expect(b.prefs.background).toEqual(DEFAULT_BACKGROUND);
        expect(sanitize(b).prefs.background).toEqual(b.prefs.background); // nothing for the validator to "repair"
    });

    it('keeps the reference exactly, in the device-local record, and reports it as this device’s synced value', () => {
        const { b, device, fromA } = twoDevices();
        expect(device).toEqual(holding(upload()));
        expect(canonical(projectWithAssets(b, device))).toBe(canonical(fromA));
    });

    it('has nothing to send, so it cannot overwrite the device that has the picture', () => {
        const { b, device, fromA } = twoDevices();
        expect(differsFrom(fromA, b, device)).toBe(false);
        // After a restart the setup is validated again when loaded, and still reports the same.
        expect(differsFrom(fromA, sanitize(b), sanitizeDeviceLocal(JSON.parse(JSON.stringify(device)), sanitize(b)))).toBe(false);
    });

    it('raises a flag the interface can show, and blocks nothing', () => {
        const { b, device } = twoDevices();
        expect(backgroundStatus(b, device)).toEqual([{ slot: 'default', assetMissingLocally: true, deviceChoice: false }]);
    });

    it('applying the same copy again changes nothing', () => {
        const { b, device, fromA } = twoDevices();
        const again = applyWithAssets(b, fromA, device)!;
        expect(again.state.prefs.background).toEqual(b.prefs.background);
        expect(again.device).toEqual(device);
    });
});

describe('the picture arrives later', () => {
    it('the device starts using it and the flag clears', () => {
        const { b, device, fromA } = twoDevices();
        const arrived = reconcileAssets(ops.addWallpaper(b, asset(PHOTO)), device);
        expect(arrived.state.prefs.background).toEqual(upload());
        expect(arrived.device).toEqual(none());
        expect(backgroundStatus(arrived.state, arrived.device)).toEqual([]);
        expect(differsFrom(fromA, arrived.state, arrived.device)).toBe(false);
    });

    it('a different picture arriving changes nothing', () => {
        const { b, device } = twoDevices();
        const other = reconcileAssets(ops.addWallpaper(b, asset('somethingElse')), device);
        expect(other.state.prefs.background).toEqual(DEFAULT_BACKGROUND);
        expect(other.device).toEqual(device);
    });

    it('a background chosen here meanwhile stays until the person goes back to the synced one', () => {
        const { b, device, fromA } = twoDevices();
        const chosen = chooseBackground(b, device, 'default', preset);
        const arrived = reconcileAssets(ops.addWallpaper(chosen.state, asset(PHOTO)), chosen.device);
        expect(arrived.state.prefs.background).toEqual(preset);
        expect(backgroundStatus(arrived.state, arrived.device)).toEqual([{ slot: 'default', assetMissingLocally: false, deviceChoice: true }]);
        const back = useSyncedBackground(arrived.state, arrived.device, 'default');
        expect(back.state.prefs.background).toEqual(upload());
        expect(back.device).toEqual(none());
        expect(differsFrom(fromA, back.state, back.device)).toBe(false);
    });
});

describe('the person changes the background', () => {
    it('on the device without the picture: it is this device’s own, and the synced reference is untouched', () => {
        const { b, device, fromA } = twoDevices();
        for (const choice of [preset, solid, upload('photoOnB')]) {
            const start = choice.source.kind === 'upload' ? ops.addWallpaper(b, asset('photoOnB')) : b;
            const chosen = chooseBackground(start, device, 'default', choice);
            expect(chosen.state.prefs.background).toEqual(choice);
            expect(chosen.device).toEqual(holding(upload(), choice));
            expect(differsFrom(fromA, chosen.state, chosen.device)).toBe(false); // nothing to send
            expect(backgroundStatus(chosen.state, chosen.device)).toEqual([{ slot: 'default', assetMissingLocally: true, deviceChoice: true }]);
        }
    });

    it('on that device, for all devices, when asked to: an ordinary change that syncs', () => {
        const { b, device, fromA } = twoDevices();
        const chosen = chooseBackground(b, device, 'default', preset, 'everywhere');
        expect(chosen.device).toEqual(none());
        expect(differsFrom(fromA, chosen.state, chosen.device)).toBe(true);
        expect(projectWithAssets(chosen.state, chosen.device).prefs.background).toEqual(preset);
    });

    it('on the device that has the picture: an ordinary change that syncs; it supersedes what the other device held and chose', () => {
        const { a, b, device, fromA } = twoDevices();
        const chosenOnB = chooseBackground(b, device, 'default', solid);
        const changed = chooseBackground(a, none(), 'default', preset);
        expect(differsFrom(fromA, changed.state, changed.device)).toBe(true);
        const received = applyWithAssets(chosenOnB.state, projectWithAssets(changed.state, changed.device), chosenOnB.device)!;
        expect(received.state.prefs.background).toEqual(preset);
        expect(received.device).toEqual(none());
    });

    it('a choice made here survives further syncs while the picture is still missing', () => {
        const { a, b, device } = twoDevices();
        const chosen = chooseBackground(b, device, 'default', solid);
        const fromAAgain = projectWithAssets(ops.updateSpace(a, a.spaceOrder[0]!, { name: 'Renamed on A' }), none());
        const received = applyWithAssets(chosen.state, fromAAgain, chosen.device)!;
        expect(received.state.prefs.background).toEqual(solid);
        expect(received.device).toEqual(holding(upload(), solid));
        expect(received.state.spaces[a.spaceOrder[0]!]!.name).toBe('Renamed on A');
    });

    it('going back to the synced background while the picture is missing shows the theme’s backdrop again', () => {
        const { b, device } = twoDevices();
        const chosen = chooseBackground(b, device, 'default', solid);
        const back = useSyncedBackground(chosen.state, chosen.device, 'default');
        expect(back.state.prefs.background).toEqual(DEFAULT_BACKGROUND);
        expect(back.device).toEqual(holding(upload()));
    });
});

describe('merging between a device with the picture and one without', () => {
    it('finds no conflict and no change in the background, whichever device merges', () => {
        const { a, b, device, fromA } = twoDevices();
        const editedA = ops.updateSpace(a, a.spaceOrder[0]!, { name: 'A edit' });
        const editedB = ops.addItem(b, b.spaceOrder[1]!, null, { url: 'added-on-b.example', title: 'B edit' }).state;
        for (const [local, remote] of [[projectWithAssets(editedB, device), projectWithAssets(editedA, none())], [projectWithAssets(editedA, none()), projectWithAssets(editedB, device)]] as const) {
            const merged = mergeDocs(fromA, local, remote);
            expect(merged.conflicts).toEqual([]);
            expect(merged.doc.prefs.background).toEqual(upload());
            expect(Object.values(merged.doc.items).some(item => item.title === 'B edit')).toBe(true);
            expect(merged.doc.spaces[a.spaceOrder[0]!]!.name).toBe('A edit');
        }
    });

    it('a device choice on one side and a real change on the other is not a conflict: the real change wins everywhere', () => {
        const { a, b, device, fromA } = twoDevices();
        const chosenB = chooseBackground(b, device, 'default', solid);
        const changedA = chooseBackground(a, none(), 'default', preset);
        const merged = mergeDocs(fromA, projectWithAssets(chosenB.state, chosenB.device), projectWithAssets(changedA.state, changedA.device));
        expect(merged.conflicts).toEqual([]);
        expect(merged.doc.prefs.background).toEqual(preset);
    });

    it('two devices that each lack the other’s picture settle after one exchange and stay settled (no ping-pong)', () => {
        const { a, b, device, fromA } = twoDevices();
        // B deliberately sets its own picture for everyone; A does not have it.
        const bSets = chooseBackground(ops.addWallpaper(b, asset('photoOnB')), device, 'default', upload('photoOnB'), 'everywhere');
        const fromB = projectWithAssets(bSets.state, bSets.device);
        expect(mergeDocs(fromA, fromA, fromB).conflicts).toEqual([]);
        let deviceA = applyWithAssets(a, fromB, none())!;
        let deviceB = { state: bSets.state, device: bSets.device };
        expect(backgroundStatus(deviceA.state, deviceA.device)).toEqual([{ slot: 'default', assetMissingLocally: true, deviceChoice: false }]);
        // Sync back and forth: neither device ever has anything to send, and the synced value never moves.
        for (let round = 0; round < 5; round++) {
            expect(differsFrom(fromB, deviceA.state, deviceA.device), `A, round ${round}`).toBe(false);
            expect(differsFrom(fromB, deviceB.state, deviceB.device), `B, round ${round}`).toBe(false);
            deviceB = applyWithAssets(deviceB.state, projectWithAssets(deviceA.state, deviceA.device), deviceB.device)!;
            deviceA = applyWithAssets(deviceA.state, projectWithAssets(deviceB.state, deviceB.device), deviceA.device)!;
            expect(projectWithAssets(deviceA.state, deviceA.device).prefs.background).toEqual(upload('photoOnB'));
        }
        // A may still show its own picture, on A only.
        const aKeeps = chooseBackground(deviceA.state, deviceA.device, 'default', upload(PHOTO));
        expect(aKeeps.state.prefs.background).toEqual(upload(PHOTO));
        expect(differsFrom(fromB, aKeeps.state, aKeeps.device)).toBe(false);
    });
});

describe('a Mode’s own background', () => {
    it('follows the same rules', () => {
        const shared = sanitize(workspace({ links: 4, spaces: 1 }));
        const withMode = ops.addMode(ops.addWallpaper(shared, asset(PHOTO)), { name: 'Evening', glyph: 'E', spaceIds: [], background: upload() });
        const fromA = projectWithAssets(withMode.state, none());
        const received = applyWithAssets(shared, fromA, none())!;
        const slot = `mode:${withMode.id}`;
        expect(received.state.modes[withMode.id]!.background).toEqual(DEFAULT_BACKGROUND);
        expect(received.device.heldSyncedBackgrounds[slot]).toEqual(upload());
        expect(differsFrom(fromA, received.state, received.device)).toBe(false);
        expect(backgroundStatus(received.state, received.device)).toEqual([{ slot, assetMissingLocally: true, deviceChoice: false }]);
        const arrived = reconcileAssets(ops.addWallpaper(received.state, asset(PHOTO)), received.device);
        expect(arrived.state.modes[withMode.id]!.background).toEqual(upload());
        expect(arrived.device).toEqual(none());
    });
});

describe('the device-local record', () => {
    const memory = new Map<string, string>();
    beforeEach(() => {
        memory.clear();
        vi.stubGlobal('localStorage', { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value), removeItem: (key: string) => void memory.delete(key) });
    });
    afterEach(() => vi.unstubAllGlobals());

    it('survives a restart: saved under its own key and read back the same', async () => {
        const { b, device } = twoDevices();
        const chosen = chooseBackground(b, device, 'default', solid);
        const { loadDeviceLocal, saveDeviceLocal } = await import('../storage/deviceLocal');
        await saveDeviceLocal(chosen.device);
        expect([...memory.keys()]).toEqual([STORAGE_KEYS.device]);
        expect(STORAGE_KEYS.device).not.toBe(STORAGE_KEYS.state);
        expect(await loadDeviceLocal(chosen.state)).toEqual(chosen.device);
        expect(await loadDeviceLocal(sanitize(chosen.state))).toEqual(chosen.device);
    });

    it('is empty when nothing was stored, and for anything that is not a record', async () => {
        const { b } = twoDevices();
        const { loadDeviceLocal } = await import('../storage/deviceLocal');
        expect(await loadDeviceLocal(b)).toEqual(none());
        for (const junk of [null, 5, 'x', [], { heldSyncedBackgrounds: 'x' }, { heldSyncedBackgrounds: { default: { source: { kind: 'preset', id: 'forest-fog' } } } }, { heldSyncedBackgrounds: { 'mode:gone': upload() } }, { backgroundOverrides: { default: solid } }]) {
            expect(sanitizeDeviceLocal(junk, b)).toEqual(none());
        }
    });

    it('drops a device choice whose own picture was since removed here, and keeps the held reference', () => {
        const { b, device } = twoDevices();
        const withPicture = ops.addWallpaper(b, asset('photoOnB'));
        const chosen = chooseBackground(withPicture, device, 'default', upload('photoOnB'));
        expect(sanitizeDeviceLocal(chosen.device, withPicture)).toEqual(chosen.device);
        expect(sanitizeDeviceLocal(chosen.device, b)).toEqual(holding(upload()));
    });

    it('never enters the synced copy, a backup file or a restore point', () => {
        const { b, device } = twoDevices();
        const marker: Background = { ...DEFAULT_BACKGROUND, source: { kind: 'solid', color: '#abcdef' } };
        const chosen = chooseBackground(b, device, 'default', marker);
        const synced = JSON.stringify(projectWithAssets(chosen.state, chosen.device));
        for (const leak of ['#abcdef', 'heldSyncedBackgrounds', 'backgroundOverrides', 'assetMissingLocally', 'bos.device']) expect(synced.includes(leak), leak).toBe(false);
        // The setup itself, which is what backups and restore points are made from, has no such fields.
        expect(Object.keys(chosen.state)).toEqual(Object.keys(b));
        const backup = exportBackup(chosen.state);
        for (const leak of ['heldSyncedBackgrounds', 'backgroundOverrides', PHOTO]) expect(backup.includes(leak), leak).toBe(false);
    });
});

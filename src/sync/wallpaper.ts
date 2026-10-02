/**
 * Backgrounds that point at a picture this device does not have (Senuma 2.1 sync core; not
 * used by the product yet).
 *
 * An uploaded picture syncs only as a reference; its pixels stay on the device that added it.
 * Another device receiving that reference is in a VALID state, not a broken one. What it needs
 * to remember is kept in a device-local record (`DeviceLocal`, stored under its own key by
 * storage/deviceLocal.ts), which is never part of the synced copy:
 *
 *   - `heldSyncedBackgrounds`: the synced background, exactly as received, for each place whose
 *     picture is missing here. It is what this device reports as the synced value, so it is
 *     never rewritten or "corrected" from here.
 *   - `backgroundOverrides`: a background the person chose on this device meanwhile. It is this
 *     device's own and does not travel, unless the person says it should.
 *
 * The setup itself always holds a background this device can show (the override, or the
 * theme's backdrop), so nothing that renders or validates the setup sees a reference it cannot
 * follow. If the picture arrives later the device starts using it. A background change made on
 * another device supersedes both records.
 *
 * Because a holding device reports exactly the reference it received, two devices with
 * different pictures available can never overwrite each other by merely syncing.
 */
import { DEFAULT_BACKGROUND, sanitizeBackground, type Background } from '../core/background';
import type { AppState, ID } from '../core/types';
import { applySyncable, toSyncable, type SyncDoc } from './scope';

/** `default` for the setup's own background, `mode:<id>` for a Mode's. */
export type Slot = string;

/** Per-device record. Never uploaded, never merged, never in a backup file. */
export interface DeviceLocal {
    heldSyncedBackgrounds: Record<Slot, Background>;
    backgroundOverrides: Record<Slot, Background>;
}

export const emptyDeviceLocal = (): DeviceLocal => ({ heldSyncedBackgrounds: {}, backgroundOverrides: {} });

export interface BackgroundStatus {
    slot: Slot;
    /** The synced background names a picture that is not on this device. */
    assetMissingLocally: boolean;
    /** This device shows its own choice instead of the synced background. */
    deviceChoice: boolean;
}

type Result = { state: AppState; device: DeviceLocal };

const assetOf = (background: Background | undefined): ID | null => (background?.source.kind === 'upload' ? background.source.assetId : null);
const available = (state: AppState, background: Background | undefined): boolean => {
    const asset = assetOf(background);
    return asset === null || Object.hasOwn(state.wallpapers, asset);
};
const copy = <T>(value: T): T => structuredClone(value);
const without = <T>(record: Record<Slot, T>, slot: Slot): Record<Slot, T> => {
    const rest = { ...record };
    delete rest[slot];
    return rest;
};

function slots(doc: SyncDoc): [Slot, Background][] {
    return [['default', doc.prefs.background], ...Object.values(doc.modes).flatMap(mode => (mode.background ? [[`mode:${mode.id}`, mode.background] as [Slot, Background]] : []))];
}

function withBackground(state: AppState, slot: Slot, background: Background): AppState {
    if (slot === 'default') return { ...state, prefs: { ...state.prefs, background } };
    const mode = state.modes[slot.slice(5)];
    return mode ? { ...state, modes: { ...state.modes, [mode.id]: { ...mode, background } } } : state;
}

/** What this device reports as its synced copy: the setup, with every held reference put back. */
export function projectWithAssets(state: AppState, device: DeviceLocal): SyncDoc {
    const doc = toSyncable(state);
    for (const [slot, synced] of Object.entries(device.heldSyncedBackgrounds)) {
        if (slot === 'default') doc.prefs.background = copy(synced);
        else if (doc.modes[slot.slice(5)]) doc.modes[slot.slice(5)]!.background = copy(synced);
    }
    return doc;
}

/**
 * Puts a synced copy into the setup. Backgrounds this device can show are applied, and end
 * anything held or chosen here for that place. Ones it cannot show are held, and the setup
 * keeps a background it can show. Null for a copy of another schema.
 */
export function applyWithAssets(state: AppState, doc: SyncDoc, device: DeviceLocal): Result | null {
    let next = applySyncable(state, doc);
    if (!next) return null;
    const out = emptyDeviceLocal();
    for (const [slot, synced] of slots(doc)) {
        if (available(state, synced)) continue;
        out.heldSyncedBackgrounds[slot] = copy(synced);
        // A choice made here stays while the synced picture, this one or another, is still missing.
        const chosen = device.backgroundOverrides[slot];
        if (chosen && available(state, chosen)) out.backgroundOverrides[slot] = chosen;
        next = withBackground(next, slot, out.backgroundOverrides[slot] ?? { ...DEFAULT_BACKGROUND });
    }
    return { state: next, device: out };
}

/** After pictures were added on this device: start using any that a held background was waiting for. */
export function reconcileAssets(state: AppState, device: DeviceLocal): Result {
    let next = state;
    let held = device.heldSyncedBackgrounds;
    for (const [slot, synced] of Object.entries(device.heldSyncedBackgrounds)) {
        // Still missing, or the person chose something here meanwhile: that choice is theirs and stays until they undo it.
        if (!available(state, synced) || device.backgroundOverrides[slot]) continue;
        next = withBackground(next, slot, copy(synced));
        held = without(held, slot);
    }
    return { state: next, device: { ...device, heldSyncedBackgrounds: held } };
}

/**
 * The person picks a background on this device.
 *   - `this-device`: only here; the synced background is untouched. Possible only while one is held.
 *   - `everywhere`: a real change, synced like any other.
 *   - `auto` (default): `this-device` while the synced picture is missing here, otherwise `everywhere`.
 */
export function chooseBackground(state: AppState, device: DeviceLocal, slot: Slot, background: Background, scope: 'auto' | 'this-device' | 'everywhere' = 'auto'): Result {
    const synced = device.heldSyncedBackgrounds[slot];
    const local = !!synced && (scope === 'this-device' || (scope === 'auto' && !available(state, synced)));
    const next = withBackground(state, slot, background);
    if (local) return { state: next, device: { ...device, backgroundOverrides: { ...device.backgroundOverrides, [slot]: copy(background) } } };
    return { state: next, device: { heldSyncedBackgrounds: without(device.heldSyncedBackgrounds, slot), backgroundOverrides: without(device.backgroundOverrides, slot) } };
}

/** Back to the synced background, giving up a choice made on this device. */
export function useSyncedBackground(state: AppState, device: DeviceLocal, slot: Slot): Result {
    const synced = device.heldSyncedBackgrounds[slot];
    if (!synced) return { state, device };
    const backgroundOverrides = without(device.backgroundOverrides, slot);
    if (available(state, synced)) return { state: withBackground(state, slot, copy(synced)), device: { heldSyncedBackgrounds: without(device.heldSyncedBackgrounds, slot), backgroundOverrides } };
    return { state: withBackground(state, slot, { ...DEFAULT_BACKGROUND }), device: { ...device, backgroundOverrides } };
}

/** For the interface: non-blocking facts about each place that is not simply showing the synced background. */
export function backgroundStatus(state: AppState, device: DeviceLocal): BackgroundStatus[] {
    return Object.entries(device.heldSyncedBackgrounds).map(([slot, synced]) => ({ slot, assetMissingLocally: !available(state, synced), deviceChoice: slot in device.backgroundOverrides }));
}

/** Whether the device has anything to send: its report differs from the copy it last synced with. */
export function differsFrom(base: SyncDoc, state: AppState, device: DeviceLocal): boolean {
    return JSON.stringify(sorted(projectWithAssets(state, device))) !== JSON.stringify(sorted(base));
}

const sorted = (value: unknown): unknown =>
    Array.isArray(value) ? value.map(sorted)
        : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, inner]) => [key, sorted(inner)]))
            : value;

/**
 * Rebuilds a trustworthy record from whatever was stored. A held background keeps its
 * reference even though the picture is not here (that is its whole point); an override must be
 * something this device can show, and exists only beside a held background.
 */
export function sanitizeDeviceLocal(raw: unknown, state: AppState): DeviceLocal {
    const out = emptyDeviceLocal();
    const record = (value: unknown): Record<string, unknown> => (value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {});
    const stored = record(raw);
    const known = (slot: Slot) => slot === 'default' || (slot.startsWith('mode:') && Object.hasOwn(state.modes, slot.slice(5)));
    for (const [slot, value] of Object.entries(record(stored.heldSyncedBackgrounds))) {
        const source = record(record(value).source);
        if (!known(slot) || source.kind !== 'upload' || typeof source.assetId !== 'string' || !/^[\w-]{1,64}$/.test(source.assetId)) continue;
        out.heldSyncedBackgrounds[slot] = sanitizeBackground(value, { [source.assetId]: true });
    }
    for (const [slot, value] of Object.entries(record(stored.backgroundOverrides))) {
        if (!(slot in out.heldSyncedBackgrounds) || !record(value).source) continue;
        const background = sanitizeBackground(value, state.wallpapers);
        // An override whose own picture has since been removed here is no longer a choice.
        if (JSON.stringify(sorted(background.source)) === JSON.stringify(sorted(record(value).source))) out.backgroundOverrides[slot] = background;
    }
    return out;
}

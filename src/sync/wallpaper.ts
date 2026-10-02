/**
 * Backgrounds that point at a picture this device does not have (Senuma 2.1, phase 1: not used
 * by the product yet).
 *
 * An uploaded picture syncs only as a reference; its pixels stay on the device that added it.
 * Another device receiving that reference is in a VALID state, not a broken one:
 *
 *   - the reference is held beside the setup, untouched, and is what this device reports as the
 *     synced value, so it is never rewritten or "corrected" from here;
 *   - the setup itself gets a background this device can show (the theme's), so nothing that
 *     renders or validates the setup ever sees a reference it cannot follow;
 *   - `assetMissingLocally` tells the interface, without blocking anything;
 *   - a background chosen here meanwhile is this device's own and does not travel, unless the
 *     person says it should;
 *   - if the picture arrives later, the device starts using it.
 *
 * Because a holding device reports exactly the reference it received, two devices with
 * different pictures available can never overwrite each other by merely syncing.
 */
import { DEFAULT_BACKGROUND, type Background } from '../core/background';
import type { AppState, ID } from '../core/types';
import { applySyncable, toSyncable, type SyncDoc } from './scope';

/** `default` for the setup's own background, `mode:<id>` for a Mode's. */
export type Slot = string;

export interface HeldBackground {
    /** The synced background, exactly as received. */
    synced: Background;
    /** The person picked a background on this device while the picture was missing. */
    chosenHere: boolean;
}

/** Per-device record, kept beside the setup and never uploaded. */
export type Held = Record<Slot, HeldBackground>;

export interface BackgroundStatus {
    slot: Slot;
    /** The synced background names a picture that is not on this device. */
    assetMissingLocally: boolean;
    /** This device shows its own choice instead of the synced background. */
    deviceChoice: boolean;
}

const assetOf = (background: Background | undefined): ID | null => (background?.source.kind === 'upload' ? background.source.assetId : null);
const available = (state: AppState, background: Background | undefined): boolean => {
    const asset = assetOf(background);
    return asset === null || Object.hasOwn(state.wallpapers, asset);
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function slots(doc: SyncDoc): [Slot, Background][] {
    return [['default', doc.prefs.background], ...Object.values(doc.modes).flatMap(mode => (mode.background ? [[`mode:${mode.id}`, mode.background] as [Slot, Background]] : []))];
}

function withBackground(state: AppState, slot: Slot, background: Background): AppState {
    if (slot === 'default') return { ...state, prefs: { ...state.prefs, background } };
    const mode = state.modes[slot.slice(5)];
    return mode ? { ...state, modes: { ...state.modes, [mode.id]: { ...mode, background } } } : state;
}

const backgroundAt = (state: AppState, slot: Slot): Background | undefined => (slot === 'default' ? state.prefs.background : state.modes[slot.slice(5)]?.background);

/** What this device reports as its synced copy: the setup, with every held reference put back. */
export function projectWithAssets(state: AppState, held: Held): SyncDoc {
    const doc = toSyncable(state);
    for (const [slot, entry] of Object.entries(held)) {
        if (slot === 'default') doc.prefs.background = structuredClone(entry.synced);
        else if (doc.modes[slot.slice(5)]) doc.modes[slot.slice(5)]!.background = structuredClone(entry.synced);
    }
    return doc;
}

/**
 * Puts a synced copy into the setup. Backgrounds this device can show are applied; ones it
 * cannot are held, and the setup keeps a background it can show. Null for a copy of another schema.
 */
export function applyWithAssets(state: AppState, doc: SyncDoc, held: Held): { state: AppState; held: Held } | null {
    let next = applySyncable(state, doc);
    if (!next) return null;
    const nextHeld: Held = {};
    for (const [slot, synced] of slots(doc)) {
        if (available(state, synced)) continue; // applied as it is; anything held for this slot is over
        const before = held[slot];
        // Still waiting for a picture: what this device was showing stays. A reference to a
        // different missing picture is a new decision elsewhere, so a choice made here stays too.
        const shown = before ? backgroundAt(state, slot) : undefined;
        nextHeld[slot] = { synced: structuredClone(synced), chosenHere: before?.chosenHere ?? false };
        next = withBackground(next, slot, shown && available(state, shown) ? shown : { ...DEFAULT_BACKGROUND });
    }
    return { state: next, held: nextHeld };
}

/** After pictures were added on this device: start using any that a held background was waiting for. */
export function reconcileAssets(state: AppState, held: Held): { state: AppState; held: Held } {
    let next = state;
    const nextHeld: Held = {};
    for (const [slot, entry] of Object.entries(held)) {
        if (!available(state, entry.synced)) nextHeld[slot] = entry;
        // The picture is here now. A choice made on this device meanwhile is the person's and stays until they undo it.
        else if (entry.chosenHere) nextHeld[slot] = entry;
        else next = withBackground(next, slot, structuredClone(entry.synced));
    }
    return { state: next, held: nextHeld };
}

/**
 * The person picks a background on this device.
 *   - `this-device`: only here; the synced background is untouched. Possible only while one is held.
 *   - `everywhere`: a real change, synced like any other.
 *   - `auto` (default): `this-device` while the synced picture is missing here, otherwise `everywhere`.
 */
export function chooseBackground(state: AppState, held: Held, slot: Slot, background: Background, scope: 'auto' | 'this-device' | 'everywhere' = 'auto'): { state: AppState; held: Held } {
    const entry = held[slot];
    const local = scope === 'this-device' || (scope === 'auto' && !!entry && !available(state, entry.synced));
    const next = withBackground(state, slot, background);
    if (local && entry) return { state: next, held: { ...held, [slot]: { ...entry, chosenHere: true } } };
    const rest = { ...held };
    delete rest[slot];
    return { state: next, held: rest };
}

/** Back to the synced background, giving up a choice made on this device. */
export function useSyncedBackground(state: AppState, held: Held, slot: Slot): { state: AppState; held: Held } {
    const entry = held[slot];
    if (!entry) return { state, held };
    if (available(state, entry.synced)) {
        const rest = { ...held };
        delete rest[slot];
        return { state: withBackground(state, slot, structuredClone(entry.synced)), held: rest };
    }
    return { state: withBackground(state, slot, { ...DEFAULT_BACKGROUND }), held: { ...held, [slot]: { ...entry, chosenHere: false } } };
}

/** For the interface: non-blocking facts about each background that is not simply the synced one. */
export function backgroundStatus(state: AppState, held: Held): BackgroundStatus[] {
    return Object.entries(held).map(([slot, entry]) => ({ slot, assetMissingLocally: !available(state, entry.synced), deviceChoice: entry.chosenHere }));
}

/** Whether the device has anything to send: its report differs from the copy it last synced with. */
export function differsFrom(base: SyncDoc, state: AppState, held: Held): boolean {
    return !same(sorted(projectWithAssets(state, held)), sorted(base));
}

const sorted = (value: unknown): unknown =>
    Array.isArray(value) ? value.map(sorted)
        : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, inner]) => [key, sorted(inner)]))
            : value;

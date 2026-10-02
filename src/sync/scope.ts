/**
 * What sync carries and what stays on the device (Senuma 2.1, phase 1: not used by the product yet).
 *
 * Every field of the saved state is classified here, by name. Adding a field to `AppState` or
 * `Prefs` without classifying it is a type error, so nothing can start leaving the device by
 * accident.
 *
 * Invariant the engine relies on: `toSyncable(applySyncable(state, doc))` equals `doc`. A device
 * that has applied a synced copy and changed nothing must look unchanged, or two devices would
 * push each other's "corrections" back and forth for ever.
 */
import { SCHEMA_VERSION, type AppState, type DockEntry, type ID, type Item, type Mode, type Prefs, type SearchProvider, type Space } from '../core/types';

type Scope = 'synced' | 'local';

export const STATE_SCOPE = {
    schema: 'synced',
    spaces: 'synced',
    spaceOrder: 'synced',
    items: 'synced',
    modes: 'synced',
    modeOrder: 'synced',
    dock: 'synced',
    providers: 'synced',
    prefs: 'synced', // per key, below
    /** Clocks decide nothing in sync. */
    updatedAt: 'local',
    onboarded: 'local',
    /** Which Mode is on is a per-device moment, not a setup. */
    activeModeId: 'local',
    /** Images the person added, and their metadata, stay on the device. */
    wallpapers: 'local',
    /** Links opened from the page: browsing-derived, never uploaded. */
    recents: 'local',
    usage: 'local',
    legacy: 'local',
} as const satisfies Record<keyof AppState, Scope>;

export const PREF_SCOPE = {
    language: 'synced',
    themeId: 'synced',
    /** An uploaded picture is carried only as a reference; a device without it shows the theme's backdrop. */
    background: 'synced',
    atmosphere: 'synced',
    openInNewTab: 'synced',
    showContinue: 'synced',
    showDock: 'synced',
    dockLabels: 'synced',
    defaultProviderId: 'synced',
    /** Accessibility and performance belong to the device. */
    motion: 'local',
    /** Changes what the browser requests from third parties, so it is never switched on from elsewhere. */
    iconSource: 'local',
    /** Tied to a permission granted per browser. */
    showClosedTabs: 'local',
} as const satisfies Record<keyof Prefs, Scope>;

type SyncedPrefKey = { [K in keyof Prefs]: (typeof PREF_SCOPE)[K] extends 'synced' ? K : never }[keyof Prefs];
export type SyncedPrefs = Pick<Prefs, SyncedPrefKey>;

const SYNCED_PREFS = (Object.keys(PREF_SCOPE) as (keyof Prefs)[]).filter(key => PREF_SCOPE[key] === 'synced') as SyncedPrefKey[];

/** The part of a setup that is encrypted and synced. Plain data, no behaviour. */
export interface SyncDoc {
    schema: number;
    spaces: Record<ID, Space>;
    spaceOrder: ID[];
    items: Record<ID, Item>;
    modes: Record<ID, Mode>;
    modeOrder: ID[];
    dock: DockEntry[];
    providers: SearchProvider[];
    prefs: SyncedPrefs;
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function emptyDoc(): SyncDoc {
    return { schema: SCHEMA_VERSION, spaces: {}, spaceOrder: [], items: {}, modes: {}, modeOrder: [], dock: [], providers: [], prefs: {} as SyncedPrefs };
}

export function toSyncable(state: AppState): SyncDoc {
    const prefs = Object.fromEntries(SYNCED_PREFS.map(key => [key, state.prefs[key]])) as SyncedPrefs;
    return clone({
        schema: state.schema,
        spaces: state.spaces,
        spaceOrder: state.spaceOrder,
        items: state.items,
        modes: state.modes,
        modeOrder: state.modeOrder,
        dock: state.dock,
        providers: state.providers,
        prefs,
    });
}

/**
 * Puts a synced copy into a setup, leaving everything local as it was. Returns null when the
 * copy is of a different schema: it must be upgraded first, and a newer one is never applied.
 */
export function applySyncable(state: AppState, doc: SyncDoc): AppState | null {
    if (doc.schema !== state.schema) return null;
    const copy = clone(doc);
    return {
        ...state,
        spaces: copy.spaces,
        spaceOrder: copy.spaceOrder,
        items: copy.items,
        modes: copy.modes,
        modeOrder: copy.modeOrder,
        dock: copy.dock,
        providers: copy.providers,
        prefs: { ...state.prefs, ...copy.prefs },
        activeModeId: state.activeModeId !== null && copy.modes[state.activeModeId] ? state.activeModeId : null,
    };
}

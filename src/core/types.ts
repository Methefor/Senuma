/** Persistent data model. One normalized tree, one source of truth, stable IDs (sync-ready). */

export type ID = string;

export const SCHEMA_VERSION = 3;

/** A saved destination: an app, site or document. */
export interface Item {
    id: ID;
    title: string;
    url: string;
    /** Emoji or image URL. Absent means "resolve the site's icon". */
    icon?: string;
    createdAt: number;
}

export interface SpaceGroup {
    id: ID;
    /** Empty name renders as an untitled section. */
    name: string;
    itemIds: ID[];
}

/** A context of activity (AI, Coding, Work…). Always has at least one group. */
export interface Space {
    id: ID;
    name: string;
    /** Optional one-line context shown under the title. */
    note?: string;
    glyph: string;
    accent: string;
    groups: SpaceGroup[];
    /** Catalog category this Space was created from; lets imports merge into it. */
    templateId?: string;
    createdAt: number;
}

/** A shortcut in the dock: a saved link or a whole Space. */
export interface DockEntry {
    kind: 'item' | 'space';
    id: ID;
}

/**
 * A working environment. Everything a Mode overrides is listed here; anything absent
 * falls through to the user's defaults. There is no inheritance beyond that.
 */
export interface Mode {
    id: ID;
    name: string;
    glyph: string;
    /** Spaces shown on Home, in this Mode's own order. */
    spaceIds: ID[];
    themeId?: string;
    providerId?: ID;
    /** Present when the Mode has its own dock instead of the shared one. */
    dock?: DockEntry[];
}

export interface SearchProvider {
    id: ID;
    name: string;
    aliases: string[];
    /** `%s` is replaced by the encoded query. */
    urlTemplate?: string;
    /** Routed through the browser's own default engine instead of a URL. */
    browserDefault?: boolean;
    builtin?: boolean;
}

/** Something opened from inside this page. The only activity that is ever recorded. */
export interface RecentItem {
    url: string;
    title: string;
    /** Last opened. */
    at: number;
    count: number;
    spaceId?: ID;
}

export type Language = 'en' | 'tr';
export type MotionLevel = 'full' | 'reduced' | 'off';
/** site: each site's own icon. service: a third-party icon service. none: monograms only. */
export type IconSource = 'site' | 'service' | 'none';

export interface Prefs {
    language: Language;
    themeId: string;
    motion: MotionLevel;
    iconSource: IconSource;
    openInNewTab: boolean;
    showContinue: boolean;
    showClosedTabs: boolean;
    showDock: boolean;
    defaultProviderId: ID;
}

export interface MigrationSummary {
    spaces: number;
    links: number;
    groups: number;
    skipped: number;
}

export interface LegacyRecord {
    /** Entitlement carried over from the previous product, kept so it can be honoured later. */
    isPro: boolean;
    proExpiresAt: number | null;
    migratedAt: number;
    summary: MigrationSummary;
    /** False until the user has seen the upgrade summary. */
    acknowledged: boolean;
}

export interface AppState {
    schema: number;
    /** Last local modification; newest wins between open tabs (and, later, sync). */
    updatedAt: number;
    onboarded: boolean;
    spaces: Record<ID, Space>;
    spaceOrder: ID[];
    items: Record<ID, Item>;
    modes: Record<ID, Mode>;
    modeOrder: ID[];
    activeModeId: ID | null;
    dock: DockEntry[];
    providers: SearchProvider[];
    recents: RecentItem[];
    /** Command-center result key → last used time. Bounded; used only to rank results. */
    usage: Record<string, number>;
    prefs: Prefs;
    legacy?: LegacyRecord;
}

/** A link gathered from an import source before it is placed in a Space. */
export interface LooseLink {
    title: string;
    url: string;
    folder?: string;
}

/** A local restore point taken before a destructive operation. */
export interface Snapshot {
    id: ID;
    at: number;
    reason: 'import' | 'reset' | 'restore';
    state: AppState;
}

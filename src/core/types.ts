/** Persistent data model. One normalized tree, one source of truth, stable IDs (sync-ready). */

export type ID = string;

export const SCHEMA_VERSION = 2;

/** A saved destination: an app, site or document. */
export interface Item {
    id: ID;
    title: string;
    url: string;
    /** Emoji or image URL. Absent means "use the site's favicon". */
    icon?: string;
    /** Pinned items appear in the dock. */
    pinned?: boolean;
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
    glyph: string;
    accent: string;
    groups: SpaceGroup[];
    /** Catalog category this Space was created from; lets imports merge into it. */
    templateId?: string;
    createdAt: number;
}

/** A working environment: which Spaces are visible, and optionally the look and search default. */
export interface Mode {
    id: ID;
    name: string;
    glyph: string;
    spaceIds: ID[];
    themeId?: string;
    providerId?: string;
}

export interface SearchProvider {
    id: ID;
    name: string;
    /** URL template; `%s` is replaced by the encoded query. Empty for the browser default. */
    url: string;
    aliases: string[];
    builtin?: boolean;
}

export interface RecentItem {
    url: string;
    title: string;
    at: number;
}

export type Language = 'en' | 'tr';
export type MotionLevel = 'full' | 'reduced' | 'off';

export interface Prefs {
    language: Language;
    themeId: string;
    motion: MotionLevel;
    /** 'remote' fetches favicons from Google's icon service; 'none' uses local monograms only. */
    iconSource: 'remote' | 'none';
    openInNewTab: boolean;
    showContinue: boolean;
    showClosedTabs: boolean;
    showDock: boolean;
    defaultProviderId: ID;
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
    providers: SearchProvider[];
    recents: RecentItem[];
    prefs: Prefs;
    /** Entitlement carried over from the previous product, kept so it can be honoured later. */
    legacy?: { isPro: boolean; proExpiresAt: number | null };
}

/** A link gathered from an import source before it is placed in a Space. */
export interface LooseLink {
    title: string;
    url: string;
    folder?: string;
}

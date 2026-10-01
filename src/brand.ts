/**
 * Single source of truth for naming and versions.
 *
 * `extensionName` is what the browser and the Chrome Web Store show; it is unchanged until a
 * rename is approved. `productName` is what the interface calls itself and is a development
 * placeholder until the final name is chosen.
 */
export const BRAND = {
    productName: 'Browser OS',
    tagline: 'Your web, organized around what you are doing.',
    extensionName: 'NewTabFolders',
    shortName: 'NTF',
    /** Human-readable prerelease label, shown in About. */
    version: '2.0.0-alpha.2',
    /**
     * Numeric manifest version for development builds. It stays below 2.0.0 on purpose:
     * the published version number is decided at release preparation, not here.
     */
    manifestVersion: '1.99.2',
    description: 'Your new tab as a launch surface: Spaces for everything you do online, one search box, and a command center.',
    backupFilePrefix: 'browser-os-backup',
} as const;

/** Storage keys. Legacy keys are only ever read, never written or removed. */
export const STORAGE_KEYS = {
    state: 'bos.state',
    snapshots: 'bos.snapshots',
    legacyData: 'ntf_data',
} as const;

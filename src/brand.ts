/**
 * Single source of truth for naming. The public extension name is unchanged
 * until a rename is approved; "Browser OS" is the internal codename only.
 */
export const BRAND = {
    extensionName: 'NewTabFolders',
    shortName: 'NTF',
    codename: 'Browser OS',
    version: '2.0.0',
    description: 'Your new tab as a launch surface: Spaces for everything you do online, one search box, and a command center.',
    backupFilePrefix: 'new-tab-backup',
} as const;

/** Storage keys. Legacy keys are only ever read, never written or removed. */
export const STORAGE_KEYS = {
    state: 'bos.state',
    legacyData: 'ntf_data',
} as const;

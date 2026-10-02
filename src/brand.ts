/**
 * Single source of truth for naming and versions.
 *
 * Senuma is the prepared release identity on this branch. A public rename is on hold until
 * the open trademark question is answered (docs/RELEASE_STATUS.md); nothing here is published.
 */
export const BRAND = {
    productName: 'Senuma',
    /** What the browser and the store show. */
    extensionName: 'Senuma',
    shortName: 'Senuma',
    descriptor: 'New Tab Workspace',
    tagline: 'Make the browser yours.',
    /** The name people upgrading from 1.x know the product by. */
    legacyName: 'New Tab Folders',
    /** Machine-readable pre-release version (package.json carries the same value). */
    version: '2.0.0-rc.1',
    /** What people see: About, the browser's extension page, the RC package name. */
    displayVersion: '2.0.0 RC 1',
    /**
     * Numeric manifest version for development builds. It stays below 2.0.0 on purpose:
     * a release build sets it equal to `version` (a test enforces both cases).
     */
    manifestVersion: '1.99.10',
    description: 'A personal new-tab workspace for your Spaces, searches and online world.',
    backupFilePrefix: 'senuma-backup',
} as const;

/**
 * Storage keys. These are technical identifiers, not branding: renaming them would orphan
 * every user's data, so they keep their original spelling. Legacy keys are only ever read.
 */
export const STORAGE_KEYS = {
    state: 'bos.state',
    snapshots: 'bos.snapshots',
    /** A state written by a newer release, kept untouched if an older build has to take over. */
    newerState: 'bos.state.newer',
    legacyData: 'ntf_data',
} as const;

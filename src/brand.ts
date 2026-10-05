/**
 * Single source of truth for naming and versions.
 *
 * Senuma is the prepared release identity on this branch. A public rename is on hold until
 * the open trademark question is answered (docs/RELEASE_STATUS.md); nothing here is published.
 */
export const BRAND = {
    productName: 'Senuma',
    /** The manifest name: what the browser's extension list and the store show (approved 2026-10-03). */
    extensionName: 'Senuma — New Tab Workspace',
    /** Where space is short: the toolbar button's title, and the package file name. */
    shortName: 'Senuma',
    descriptor: 'New Tab Workspace',
    tagline: 'Make the browser yours.',
    /** The name people upgrading from 1.x know the product by. */
    legacyName: 'New Tab Folders',
    /** Machine-readable pre-release version (package.json carries the same value). */
    version: '2.0.1',
    /** What people see: About, the browser's extension page, the RC package name. */
    displayVersion: '2.0.1',
    /** The manifest version. A release sets it equal to `version`; a pre-release uses 1.99.x (a test enforces both). */
    manifestVersion: '2.0.1',
    /** The manifest and store short description (approved 2026-10-03; 132 characters at most). */
    description: 'Turn every new tab into a personal workspace with Spaces, Modes, search, themes and fast access to the web.',
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

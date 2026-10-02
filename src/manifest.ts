import { BRAND } from './brand';

/**
 * Permission policy (warnings verified against the browser permission-warning API):
 *
 * Required — none of these shows an install warning:
 *   storage  the saved setup.
 *   search   sends the default search through the engine chosen in browser settings.
 *
 * Optional — requested from a click, only when the feature is turned on:
 *   bookmarks        importing browser bookmarks ("Read and change your bookmarks").
 *   tabs + sessions  recently closed tabs in Continue ("Read your browsing history").
 *
 * Deliberately not used: history, topSites, favicon, host permissions.
 */
const REQUIRED = ['storage', 'search'];
const OPTIONAL = ['bookmarks', 'tabs', 'sessions'];

/**
 * `grantOptional` is for automated tests only: browser permission prompts cannot be
 * clicked by a test, so the test build declares the optional permissions as required.
 */
export function buildManifest({ grantOptional = false } = {}) {
    return {
        manifest_version: 3,
        name: BRAND.extensionName,
        short_name: BRAND.shortName,
        version: BRAND.manifestVersion,
        version_name: BRAND.displayVersion,
        description: BRAND.description,
        permissions: grantOptional ? [...REQUIRED, ...OPTIONAL] : REQUIRED,
        ...(grantOptional ? {} : { optional_permissions: OPTIONAL }),
        chrome_url_overrides: { newtab: 'newtab.html' },
        // Needed only so the toolbar button can open a new tab.
        background: { service_worker: 'background.js' },
        icons: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
        action: {
            default_icon: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png' },
            default_title: BRAND.extensionName,
        },
        // The page loads no remote code and needs no web-accessible resources.
        content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'",
        },
    };
}

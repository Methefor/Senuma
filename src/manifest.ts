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
 * Store and browser-facing text per language (`_locales/<code>/messages.json`).
 *
 * The Chrome Web Store offers a translated listing only for locales the package declares, so each
 * language the listing should exist in needs an entry here. Only the description is localized:
 * the name is the brand and stays “Senuma — New Tab Workspace” everywhere.
 *
 * This has nothing to do with the language of the interface, which the person chooses in
 * Settings (src/i18n), and it never touches anything a person typed. Build-time only: none of
 * this is in the page's bundle.
 *
 * Adding a language: one entry (Chrome's locale code, e.g. `es`, `fr`, `de`, `pt_BR`), at most
 * 132 characters, written by a native speaker.
 */
export const DEFAULT_LOCALE = 'en';
export const STORE_DESCRIPTIONS: Record<string, string> = {
    en: BRAND.description,
    tr: 'Her yeni sekmeyi Alanlar, Modlar, arama, temalar ve web’e hızlı erişimle kişisel bir çalışma alanına çevir.',
};
/** The store's limit for the short description. */
export const DESCRIPTION_LIMIT = 132;

/** The `_locales` files, keyed by their path inside the package. */
export function buildLocales(): Record<string, string> {
    return Object.fromEntries(Object.entries(STORE_DESCRIPTIONS).map(([code, message]) => [
        `_locales/${code}/messages.json`,
        JSON.stringify({ extDescription: { message, description: 'Short description shown in the browser and the Chrome Web Store (132 characters at most).' } }, null, 2),
    ]));
}

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
        default_locale: DEFAULT_LOCALE,
        // Resolved by the browser from _locales, by its own interface language (English when it has no entry).
        description: '__MSG_extDescription__',
        permissions: grantOptional ? [...REQUIRED, ...OPTIONAL] : REQUIRED,
        ...(grantOptional ? {} : { optional_permissions: OPTIONAL }),
        chrome_url_overrides: { newtab: 'newtab.html' },
        // Needed only so the toolbar button can open a new tab.
        background: { service_worker: 'background.js' },
        icons: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
        action: {
            default_icon: { 16: 'icons/icon16.png', 32: 'icons/icon32.png', 48: 'icons/icon48.png' },
            default_title: BRAND.shortName,
        },
        // The page loads no remote code and needs no web-accessible resources.
        content_security_policy: {
            extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'",
        },
    };
}

import { BRAND } from './brand';

export function buildManifest() {
    return {
        manifest_version: 3,
        name: BRAND.extensionName,
        short_name: BRAND.shortName,
        version: BRAND.version,
        description: BRAND.description,
        // storage: user data. tabs + sessions: titles/URLs of recently closed tabs for Continue
        // (both already granted to existing installs). search: route the default search through
        // the browser's own search engine, as the Chrome Web Store requires for new-tab pages.
        permissions: ['storage', 'tabs', 'sessions', 'search'],
        // Requested only when the user starts a bookmark import.
        optional_permissions: ['bookmarks'],
        chrome_url_overrides: { newtab: 'newtab.html' },
        background: { service_worker: 'background.js' },
        icons: { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' },
        action: {
            default_icon: { 16: 'icons/icon16.png', 48: 'icons/icon48.png' },
            default_title: BRAND.extensionName,
        },
    };
}

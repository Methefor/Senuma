/**
 * Icon resolution. Pure: decides which image addresses to try for a link, in order. The
 * component walks the list and falls back to a monogram when all fail.
 *
 * Privacy order: the user's own icon → the vendor's own icon for well-known apps → the
 * site's own /favicon.ico → (only if the user opted in) a third-party icon service.
 * Nothing in the first three steps tells a third party which sites are saved.
 */
import type { IconSource } from './types';
import { isImageUrl } from './url';

const GOOGLE_PRODUCT = 'https://www.gstatic.com/images/branding/product/1x/';

/**
 * Apps whose site favicon is wrong or generic (every Google app answers with the same "G").
 * Matched by host plus optional path prefix; each icon is served by the app's own vendor.
 */
const KNOWN_APPS: readonly (readonly [match: string, icon: string])[] = [
    ['mail.google.com', `${GOOGLE_PRODUCT}gmail_2020q4_48dp.png`],
    ['calendar.google.com', `${GOOGLE_PRODUCT}calendar_2020q4_48dp.png`],
    ['drive.google.com', `${GOOGLE_PRODUCT}drive_2020q4_48dp.png`],
    ['docs.google.com/document', `${GOOGLE_PRODUCT}docs_2020q4_48dp.png`],
    ['docs.google.com/spreadsheets', `${GOOGLE_PRODUCT}sheets_2020q4_48dp.png`],
    ['docs.google.com/presentation', `${GOOGLE_PRODUCT}slides_2020q4_48dp.png`],
    ['docs.google.com/forms', `${GOOGLE_PRODUCT}forms_2020q4_48dp.png`],
    ['docs.google.com', `${GOOGLE_PRODUCT}docs_2020q4_48dp.png`],
    ['meet.google.com', `${GOOGLE_PRODUCT}meet_2020q4_48dp.png`],
    ['chat.google.com', `${GOOGLE_PRODUCT}chat_2020q4_48dp.png`],
    ['keep.google.com', `${GOOGLE_PRODUCT}keep_2020q4_48dp.png`],
    ['photos.google.com', `${GOOGLE_PRODUCT}photos_48dp.png`],
    ['translate.google.com', `${GOOGLE_PRODUCT}translate_48dp.png`],
    ['maps.google.com', `${GOOGLE_PRODUCT}maps_48dp.png`],
    ['www.google.com/maps', `${GOOGLE_PRODUCT}maps_48dp.png`],
    ['classroom.google.com', `${GOOGLE_PRODUCT}classroom_48dp.png`],
    ['play.google.com', `${GOOGLE_PRODUCT}play_prism_48dp.png`],
    ['gemini.google.com', 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg'],
    ['music.youtube.com', `${GOOGLE_PRODUCT}youtube_music_48dp.png`],
    ['www.youtube.com', `${GOOGLE_PRODUCT}youtube_48dp.png`],
    ['youtube.com', `${GOOGLE_PRODUCT}youtube_48dp.png`],
    ['www.google.com', `${GOOGLE_PRODUCT}googleg_48dp.png`],
    ['google.com', `${GOOGLE_PRODUCT}googleg_48dp.png`],
];

const ICON_SERVICE = 'https://www.google.com/s2/favicons?sz=64&domain=';

export function knownAppIcon(url: string): string | undefined {
    let target: string;
    try {
        const parsed = new URL(url);
        target = parsed.hostname + parsed.pathname;
    } catch {
        return undefined;
    }
    return KNOWN_APPS.find(([match]) => target === match || target.startsWith(match.includes('/') ? match : `${match}/`))?.[1];
}

/** Image addresses to try, best first. Empty means "use the monogram". */
export function iconCandidates(url: string, source: IconSource, userIcon?: string): string[] {
    if (isImageUrl(userIcon)) return [userIcon!];
    if (source === 'none') return [];
    let origin: string;
    let host: string;
    try {
        ({ origin, hostname: host } = new URL(url));
    } catch {
        return [];
    }
    if (!/^https?:/.test(origin)) return [];
    const known = knownAppIcon(url);
    const site = `${origin}/favicon.ico`;
    const service = ICON_SERVICE + encodeURIComponent(host);
    // The service has the sharper image, so once the user has chosen it, it goes first.
    const ordered = source === 'service' ? [known, service, site] : [known, site];
    return ordered.filter((x): x is string => !!x);
}

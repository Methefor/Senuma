/**
 * Words about the size limits. Kept out of the main dictionaries: they are needed only when a
 * limit actually changed something, in the link editor's rare fallback, and in Settings → Data.
 */
import { currentLanguage } from '../i18n';

const en = {
    iconTooLarge: 'That picture is too large for an icon, so the site’s own icon is used.',
    lede: 'Saved data is now kept within size limits.',
    where: 'The original text is in Settings → Data.',
    linksSkipped: 'Links left out (address unusable or too long): {n}.',
    titlesReplaced: 'Long titles replaced by the site’s name: {n}.',
    namesReplaced: 'Long names replaced by the default: {n}.',
    iconsReencoded: 'Large icons made smaller: {n}.',
    iconsDropped: 'Icons replaced by the site’s own icon: {n}.',
    kept: 'Original values kept',
    keptHint: 'Kept exactly as they were: {titles} titles, {names} names, {links} links left out. Download to get them back.',
    download: 'Download',
    remove: 'Remove',
} as const;

export type LimitsKey = keyof typeof en;

/** Turkish is fetched only for people who use Senuma in Turkish. */
let tr: Record<LimitsKey, string> | undefined;

/** Call before `lt` wherever the words are about to be shown. */
export async function loadLimitsText(): Promise<void> {
    if (currentLanguage() === 'tr') tr ??= (await import('./tr-limits')).tr;
}

export function lt(key: LimitsKey, params: Record<string, string | number> = {}): string {
    const text: string = (currentLanguage() === 'tr' && tr?.[key]) || en[key];
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

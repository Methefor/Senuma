/**
 * Size limits of the saved state. They hold wherever a value enters: typing, editing, import,
 * backup restore, 1.x conversion and stored state.
 *
 * A value over its limit is never cut down to fit. An address that is too long is not a
 * different, shorter address, so the link is skipped. A title or name that is too long is not
 * kept in part: the default takes its place (the site's name, "Untitled"). Either is counted in
 * a report, so the person can be told. Trimming surrounding whitespace is the only change ever
 * made to text that is kept.
 */
export const LIMITS = {
    /** A link's title. */
    title: 256,
    /** A link's address, and a search provider's address template. */
    url: 4096,
    /** Names of Spaces, groups and Modes. */
    name: 128,
    /** Small labels: a Space's note, a search provider's name. */
    label: 128,
} as const;

/** The text, trimmed, when it is within `max` characters; null when it is not text or is too long. */
export function bounded(value: unknown, max: number): string | null {
    if (typeof value !== 'string') return null;
    const text = value.trim();
    return text.length <= max ? text : null;
}

/** Text that was given but is over its limit. */
export const tooLong = (value: unknown, max: number): boolean => typeof value === 'string' && value.trim().length > max;

/** What validation changed or left out, for telling the person. */
export interface ValidationReport {
    /** Links left out: no usable address, or an address over the limit. */
    linksSkipped: number;
    /** Link titles over the limit, replaced by the site's name. */
    titlesReplaced: number;
    /** Names and labels over the limit, replaced by the default. */
    namesReplaced: number;
    /** Embedded icons made smaller. */
    iconsReencoded: number;
    /** Icons over the limits that could not be made to fit; those links show their site's icon. */
    iconsDropped: number;
}

export const newReport = (): ValidationReport => ({ linksSkipped: 0, titlesReplaced: 0, namesReplaced: 0, iconsReencoded: 0, iconsDropped: 0 });

export const findings = (report: ValidationReport): number => report.linksSkipped + report.titlesReplaced + report.namesReplaced + report.iconsReencoded + report.iconsDropped;

export interface ValidationOptions {
    report?: ValidationReport;
    /**
     * Leave embedded icons that are over the limits in place, because the caller is about to
     * re-encode them (which needs a page, and time). Such a caller must finish with
     * `settleIcons`, which enforces the limits itself.
     */
    keepIcons?: boolean;
}

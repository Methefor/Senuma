import { type ValidationReport } from '../core/limits';
import { t, type MessageKey } from '../i18n';

/**
 * One sentence per kind of change the size limits made, for a toast. Nothing is changed without
 * being said. `kept`: the replaced text was set aside on this device (an upgrade); for an import
 * the file itself still holds it.
 */
export function limitsNotice(report: ValidationReport, kept = false): string {
    const parts: [number, MessageKey][] = [
        [report.linksSkipped, 'limits.linksSkipped'],
        [report.titlesReplaced, 'limits.titlesReplaced'],
        [report.namesReplaced, 'limits.namesReplaced'],
        [report.iconsReencoded, 'limits.iconsReencoded'],
        [report.iconsDropped, 'limits.iconsDropped'],
    ];
    return [t('limits.lede'), ...(kept && report.originals.length ? [t('limits.where')] : []), ...parts.filter(([count]) => count > 0).map(([n, key]) => t(key, { n }))].join(' ');
}

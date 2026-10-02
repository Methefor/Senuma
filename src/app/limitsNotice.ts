import { type ValidationReport } from '../core/limits';
import { t, type MessageKey } from '../i18n';

/** One sentence per kind of change the size limits made, for a toast. Nothing is changed without being said. */
export function limitsNotice(report: ValidationReport): string {
    const parts: [number, MessageKey][] = [
        [report.linksSkipped, 'limits.linksSkipped'],
        [report.titlesReplaced, 'limits.titlesReplaced'],
        [report.namesReplaced, 'limits.namesReplaced'],
        [report.iconsReencoded, 'limits.iconsReencoded'],
        [report.iconsDropped, 'limits.iconsDropped'],
    ];
    return [t('limits.lede'), ...parts.filter(([count]) => count > 0).map(([n, key]) => t(key, { n }))].join(' ');
}

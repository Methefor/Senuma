import { type ValidationReport } from '../core/limits';
import { loadLimitsText, lt, type LimitsKey } from './limitsText';

/**
 * One sentence per kind of change the size limits made, for a toast. Nothing is changed without
 * being said. `kept`: the replaced text was set aside on this device (an upgrade); for an import
 * the file itself still holds it.
 */
export async function limitsNotice(report: ValidationReport, kept = false): Promise<string> {
    await loadLimitsText();
    const parts: [number, LimitsKey][] = [
        [report.linksSkipped, 'linksSkipped'],
        [report.titlesReplaced, 'titlesReplaced'],
        [report.namesReplaced, 'namesReplaced'],
        [report.iconsReencoded, 'iconsReencoded'],
        [report.iconsDropped, 'iconsDropped'],
    ];
    return [lt('lede'), ...(kept && report.originals.length ? [lt('where')] : []), ...parts.filter(([count]) => count > 0).map(([n, key]) => lt(key, { n }))].join(' ');
}

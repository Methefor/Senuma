/**
 * Feedback messages. Senuma never sends them: it prepares an email the person reads, may edit,
 * and sends from their own mail app. Technical details are added only when the person leaves
 * the box ticked, and are exactly the lines shown in the preview.
 */
import type { HelpKey } from './strings-en';

export type FeedbackKind = 'problem' | 'idea' | 'general';

/**
 * Where feedback goes: the temporary support contact listed in the store (docs/STORE_LISTING.md).
 * To be replaced by a Senuma address once one exists.
 */
export const FEEDBACK_ADDRESS = 'rumeliskelesi+senuma@gmail.com';

export interface Environment {
    browser: string;
    os: string;
}

interface Brand {
    brand: string;
    version: string;
}

interface UserAgentData {
    platform: string;
    getHighEntropyValues(hints: string[]): Promise<{ platform?: string; platformVersion?: string; fullVersionList?: Brand[] }>;
}

/** Names Chrome adds to its brand list so that sites do not rely on it; never a real browser. */
const NOT_A_BRAND = /not.?a.?brand/i;

export function describeBrowser(brands: Brand[] | undefined, userAgent: string): string {
    const real = (brands ?? []).filter(b => !NOT_A_BRAND.test(b.brand));
    const named = real.find(b => b.brand !== 'Chromium') ?? real[0];
    if (named) return `${named.brand} ${named.version}`;
    const chrome = /Chrome\/([\d.]+)/.exec(userAgent);
    return chrome ? `Chromium-based ${chrome[1]}` : 'Unknown';
}

export function describeOs(platform: string | undefined, version: string | undefined, userAgent: string): string {
    const major = Number((version ?? '').split('.')[0]);
    switch (platform) {
        // Windows reports 13 and above for Windows 11, 1-10 for Windows 10 (0 is older).
        case 'Windows': return major >= 13 ? 'Windows 11' : major > 0 ? 'Windows 10' : 'Windows';
        case 'macOS': return version ? `macOS ${version.split('.').slice(0, 2).join('.')}` : 'macOS';
        case 'Chrome OS': case 'ChromeOS': return 'ChromeOS';
        case 'Linux': return 'Linux';
        default:
            if (platform) return platform;
            return /Windows/.test(userAgent) ? 'Windows' : /Mac OS X/.test(userAgent) ? 'macOS' : /CrOS/.test(userAgent) ? 'ChromeOS' : /Linux/.test(userAgent) ? 'Linux' : 'Unknown';
    }
}

/** Reads the browser and system from the browser itself. Local only: nothing is requested. */
export async function detectEnvironment(): Promise<Environment> {
    const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
    const values = await data?.getHighEntropyValues(['platformVersion', 'fullVersionList']).catch(() => undefined);
    return {
        browser: describeBrowser(values?.fullVersionList, navigator.userAgent),
        os: describeOs(values?.platform ?? data?.platform, values?.platformVersion, navigator.userAgent),
    };
}

export interface ReportInput {
    kind: FeedbackKind;
    description: string;
    steps: string;
    includeTech: boolean;
    version: string;
    language: string;
    environment: Environment;
}

/** The subject and body exactly as the person will see them in the preview and the mail app. */
export function composeReport(input: ReportInput, text: (key: HelpKey) => string): { subject: string; body: string } {
    const summary = input.description.trim().split('\n')[0]!.slice(0, 60);
    const subject = `[Senuma ${input.version}] ${text(`report.subject.${input.kind}`)}${summary ? `: ${summary}` : ''}`;
    const lines = [`${text('report.type')}: ${text(`report.subject.${input.kind}`)}`, '', `${text('report.description')}:`, input.description.trim(), ''];
    if (input.kind === 'problem') lines.push(`${text('report.steps')}:`, input.steps.trim() || '1. \n2. \n3. ', '');
    if (input.includeTech) {
        lines.push(
            `${text('report.tech')}:`,
            `${text('report.version')}: ${input.version}`,
            `${text('report.browser')}: ${input.environment.browser}`,
            `${text('report.os')}: ${input.environment.os}`,
            `${text('report.language')}: ${input.language}`,
        );
    }
    return { subject, body: lines.join('\n').trimEnd() };
}

export function mailtoUrl(address: string, subject: string, body: string): string {
    // Mail apps expect CRLF line breaks in a mailto body.
    return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body.replace(/\n/g, '\r\n'))}`;
}

import { BRAND } from '../brand';
import { t } from '../i18n';

/**
 * The Senuma mark: a frame with a place resting in its corner. Drawn inline so it needs no
 * request. Used where the product introduces itself (first run, About) and nowhere on Home:
 * there, the person's own setup is the subject.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
    return (
        <svg class="brand-mark" width={size} height={size} viewBox="0 0 128 128" aria-hidden="true">
            <defs>
                <linearGradient id="brand-tile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#F8D4AB" />
                    <stop offset="1" stop-color="#EDA571" />
                </linearGradient>
            </defs>
            <rect width="128" height="128" rx="28" fill="url(#brand-tile)" />
            <rect x="27" y="27" width="74" height="74" rx="20" fill="none" stroke="#14172A" stroke-width="12" />
            <path d="M33 95V64a31 31 0 0 1 31 31z" fill="#14172A" />
        </svg>
    );
}

/** Mark, wordmark and (optionally) the tagline. */
export function BrandLockup({ size = 34, tagline = false }: { size?: number; tagline?: boolean }) {
    return (
        <div class="brand-lockup">
            <BrandMark size={size} />
            <div>
                <span class="brand-word">{BRAND.productName.toLowerCase()}</span>
                {tagline && <span class="brand-tagline">{t('brand.tagline')}</span>}
            </div>
        </div>
    );
}

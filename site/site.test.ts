import { describe, expect, it } from 'vitest';
import { buildSite, FEEDBACK_ADDRESS, loadContent, PRIVACY_URL, SECTIONS, SITE_LANGUAGES, STORE_URL } from './build';

const files = buildSite();
const pages = { en: files['index.html']!, tr: files['tr/index.html']! };

/** Every key path in a content file, so two languages can be compared shape for shape. */
function shape(value: unknown, path = ''): string[] {
    if (Array.isArray(value)) return [`${path}[${value.length}]`, ...value.flatMap((item, index) => shape(item, `${path}[${index}]`))];
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => shape(item, `${path}.${key}`));
    return [path];
}

describe('landing page', () => {
    it('is built in English and Turkish, with a guide page for each', () => {
        expect(Object.keys(files).sort()).toEqual(['guide/index.html', 'index.html', 'robots.txt', 'site.js', 'styles.css', 'tr/guide/index.html', 'tr/index.html']);
        expect(pages.en).toContain('<html lang="en">');
        expect(pages.tr).toContain('<html lang="tr">');
    });

    it('has the same content shape in every language, with nothing empty', () => {
        const english = shape(loadContent('en'));
        for (const lang of SITE_LANGUAGES) {
            const content = loadContent(lang);
            expect(shape(content), lang).toEqual(english);
            expect(JSON.stringify(content), lang).not.toMatch(/:\s*""/);
        }
    });

    it('has every section, in the agreed order, with the same anchors in both languages', () => {
        for (const html of Object.values(pages)) {
            const ids = [...html.matchAll(/<section class="[^"]*" id="([^"]+)"/g)].map(match => match[1]);
            expect(ids).toEqual([...SECTIONS]);
        }
    });

    it('keeps user-facing identifiers out of translation: same sections, media and guide anchors', () => {
        const pick = (lang: 'en' | 'tr') => loadContent(lang).features.map(feature => `${feature.id}|${feature.media}|${feature.still}`);
        expect(pick('tr')).toEqual(pick('en'));
        expect(loadContent('tr').guide.cards.map(card => card.anchor)).toEqual(loadContent('en').guide.cards.map(card => card.anchor));
    });

    it('loads nothing from anyone else: no analytics, fonts, scripts or images from other hosts', () => {
        for (const html of [...Object.values(pages), files['guide/index.html']!, files['tr/guide/index.html']!]) {
            const sources = [...html.matchAll(/\s(?:src|srcset|poster)="([^"]+)"/g), ...html.matchAll(/<link[^>]+href="([^"]+)"/g)].map(match => match[1]!);
            expect(sources.filter(source => /^(https?:)?\/\//.test(source))).toEqual([]);
            expect(html).not.toMatch(/gtag|googletagmanager|google-analytics|analytics\.js|plausible|hotjar|segment\.com|fonts\.googleapis/i);
        }
        expect(files['styles.css']).not.toMatch(/@import|url\(\s*["']?https?:/);
        expect(files['site.js']).not.toMatch(/fetch\(|XMLHttpRequest|sendBeacon|cookie|localStorage/);
    });

    it('links out only to the store, the privacy policy and email', () => {
        for (const [lang, html] of Object.entries(pages)) {
            const external = [...html.matchAll(/<a[^>]+href="((?:https?|mailto):[^"]+)"/g)].map(match => match[1]!.replace(/&amp;/g, '&'));
            expect(external.length).toBeGreaterThan(5);
            for (const href of external) {
                expect(href.startsWith(STORE_URL) || href === PRIVACY_URL || href.startsWith(`mailto:${FEEDBACK_ADDRESS}`), href).toBe(true);
            }
            // Every store link says which page and language sent the visit.
            for (const href of external.filter(link => link.startsWith(STORE_URL))) expect(href).toContain(`utm_source=landing&utm_medium=${lang}`);
        }
    });

    it('makes only the privacy claims we allow, and none of the ones we never make', () => {
        const never = /zero network|no network requests|nothing (ever )?leaves|fully offline|zero[- ]knowledge|anonymous|anonim|hiçbir şey cihazından|ağ isteği yapmaz|trademark|tescilli/i;
        const hype = /#1|\bbest\b|fastest|trusted by|users love|\d[\d.,]*\s*(k|m|\+)?\s*(users|installs|downloads|kullanıcı|indirme)|★|testimonial|en iyi|en hızlı/i;
        for (const [lang, html] of Object.entries(pages)) {
            const text = html.replace(/<[^>]+>/g, ' ');
            expect(text, lang).not.toMatch(never);
            expect(text, lang).not.toMatch(hype);
        }
        expect(pages.en).toMatch(/No Senuma account/);
        expect(pages.en).toMatch(/No analytics/);
        expect(pages.en).toMatch(/No Senuma cloud required in this release/);
        // The page says what does go out, in both languages.
        expect(pages.en).toMatch(/searches go to the search engine you choose/i);
        expect(pages.tr).toMatch(/Aramaların seçtiğin arama motoruna gider/);
    });

    it('describes every picture and offers stills to people who ask for less motion', () => {
        for (const html of Object.values(pages)) {
            for (const [tag] of html.matchAll(/<img[^>]+>/g)) expect(tag).toMatch(/\salt="/);
            // Only the brand mark beside the name is decorative.
            expect([...html.matchAll(/<img[^>]+alt=""/g)].length).toBe(1);
            expect([...html.matchAll(/prefers-reduced-motion: reduce/g)].length).toBe(5);
        }
    });

    it('is not indexable until someone deploys it on purpose', () => {
        expect(files['robots.txt']).toContain('Disallow: /');
    });
});

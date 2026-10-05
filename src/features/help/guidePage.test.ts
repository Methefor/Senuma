import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { githubSlug, guideBody, guidePage } from './guidePage';
import { GUIDE_TOPICS, guideUrl } from './topics';

const read = (lang: string) => readFileSync(`docs/guide/${lang}.md`, 'utf8');

describe('packaged user guide', () => {
    it('has every section, in the same order, in both languages', () => {
        for (const lang of ['en', 'tr']) expect(guideBody(read(lang)).sections).toEqual([...GUIDE_TOPICS]);
    });

    it('resolves every link inside the guide (an unknown anchor fails the build)', () => {
        for (const lang of ['en', 'tr']) {
            const { html } = guideBody(read(lang));
            const ids = new Set([...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]));
            for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) expect(ids.has(target)).toBe(true);
        }
    });

    it('leaves no Markdown behind and carries no script', () => {
        for (const lang of ['en', 'tr']) {
            const page = guidePage(read(lang), { lang, title: 'Guide', other: { href: 'x.html', label: 'Other', lang: 'xx' }, top: 'Top' });
            const text = page.replace(/<pre>[\s\S]*?<\/pre>/g, '').replace(/<code>[^<]*<\/code>/g, '');
            expect(text).not.toMatch(/\*\*|\]\(|^#{1,3} /m);
            expect(page).not.toMatch(/<script|\son\w+=/i);
        }
    });

    it('matches GitHub anchors, including Turkish capitals', () => {
        expect(githubSlug('4. Links & Groups')).toBe('4-links--groups');
        expect(githubSlug('21. İçe / Dışa Aktarma')).toBe('21-içe--dışa-aktarma');
    });

    it('escapes text and refuses links that are not https', () => {
        expect(guideBody('## 1. A <b>\n\nx < y').html).toContain('A &lt;b&gt;');
        expect(() => guideBody('## 1. A\n\n[x](javascript:alert(1))')).toThrow();
    });

    it('points a language without its own guide at the English one', () => {
        expect(guideUrl('tr', 'dim')).toBe('help/tr.html#dim');
        expect(guideUrl('fr' as never, 'dim')).toBe('help/en.html#dim');
    });
});

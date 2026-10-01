import { describe, expect, it } from 'vitest';
import { en } from './en';
import { ensureLanguage, setLanguage, t } from './index';
import { tr } from './tr';

describe('i18n', () => {
    it('fills parameters and picks plural forms', () => {
        setLanguage('en');
        expect(t('space.count', { n: 1 })).toBe('1 link');
        expect(t('space.count', { n: 4 })).toBe('4 links');
        expect(t('search.with', { provider: 'YouTube', query: 'lofi' })).toBe('Search YouTube for “lofi”');
        expect(t('migrate.spaces', { n: 8 })).toBe('8 folders → 8 Spaces');
    });

    it('shows English until another language has loaded, then that language', async () => {
        setLanguage('tr');
        expect(t('undo')).toBe('Undo');
        await ensureLanguage('tr');
        expect(t('undo')).toBe('Geri al');
        expect(t('space.count', { n: 3 })).toBe('3 bağlantı');
        setLanguage('en');
    });

    it('keeps Turkish complete and its placeholders in step with English', () => {
        const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join();
        for (const key of Object.keys(en) as (keyof typeof en)[]) {
            const translated = tr[key];
            expect(translated, `missing Turkish for ${key}`).toBeTruthy();
            // Compare the plural ("many") form: it carries every placeholder in both languages.
            expect(placeholders(translated!.split('|').at(-1)!), key).toBe(placeholders(en[key].split('|').at(-1)!));
        }
    });
});

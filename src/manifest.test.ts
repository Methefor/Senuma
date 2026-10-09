import { describe, expect, it } from 'vitest';
import { BRAND } from './brand';
import { buildLocales, buildManifest, DEFAULT_LOCALE, DESCRIPTION_LIMIT, STORE_DESCRIPTIONS } from './manifest';

describe('store localization (_locales)', () => {
    const manifest = buildManifest();
    const locales = Object.fromEntries(Object.entries(buildLocales()).map(([path, text]) => [path, JSON.parse(text) as Record<string, { message: string }>]));

    it('localizes only the description; the name, short name and toolbar title stay the brand', () => {
        expect(manifest.default_locale).toBe(DEFAULT_LOCALE);
        expect(manifest.description).toBe('__MSG_extDescription__');
        expect(manifest.name).toBe(BRAND.extensionName);
        expect(manifest.short_name).toBe(BRAND.shortName);
        expect(manifest.action.default_title).toBe(BRAND.shortName);
        expect(JSON.stringify(manifest).match(/__MSG_\w+__/g)).toEqual(['__MSG_extDescription__']);
    });

    it('has one complete file per language, English as the default and unchanged', () => {
        expect(Object.keys(locales).sort()).toEqual(['_locales/en/messages.json', '_locales/tr/messages.json']);
        expect(locales['_locales/en/messages.json']!.extDescription!.message).toBe(BRAND.description);
        for (const messages of Object.values(locales)) {
            expect(Object.keys(messages)).toEqual(['extDescription']);
            expect(messages.extDescription!.message.trim()).not.toBe('');
        }
    });

    it('keeps every description within the store limit and free of claims we do not make', () => {
        for (const [code, text] of Object.entries(STORE_DESCRIPTIONS)) {
            expect([...text].length, code).toBeLessThanOrEqual(DESCRIPTION_LIMIT);
            expect(text, code).not.toMatch(/#1|best|fastest|en iyi|en hızlı/i);
        }
    });

    it('changes no permission', () => {
        expect(manifest.permissions).toEqual(['storage', 'search']);
        expect(manifest.optional_permissions).toEqual(['bookmarks', 'tabs', 'sessions']);
        expect('host_permissions' in manifest).toBe(false);
    });
});

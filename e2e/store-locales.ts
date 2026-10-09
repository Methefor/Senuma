/**
 * Store localization in the real browser: the description follows the browser's own language
 * (Turkish, English, English for a language without an entry), the name never changes, and the
 * language of Senuma's interface stays the person's choice.
 *
 *   npm run build && vite-node e2e/store-locales.ts
 */
import { chromium } from 'playwright';
import { BRAND } from '../src/brand';
import { STORE_DESCRIPTIONS } from '../src/manifest';
import { DIST, check, expect, newProfile, removeProfile, report } from './harness';

interface Seen {
    ui: string;
    name: string;
    shortName: string;
    description: string;
    message: string;
    title: string;
    permissions: string;
}

async function inBrowser(lang: string, body: (seen: Seen, page: import('playwright').Page) => Promise<void>): Promise<void> {
    const profile = newProfile();
    const context = await chromium.launchPersistentContext(profile, {
        channel: 'chromium', headless: true, locale: lang, viewport: { width: 1280, height: 800 },
        args: [`--lang=${lang}`, `--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    try {
        const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 20_000 }));
        const seen = await worker.evaluate(async () => {
            const manifest = chrome.runtime.getManifest();
            return {
                ui: chrome.i18n.getUILanguage(),
                name: manifest.name,
                shortName: manifest.short_name ?? '',
                description: manifest.description ?? '',
                message: chrome.i18n.getMessage('extDescription'),
                title: await chrome.action.getTitle({}),
                permissions: ((await chrome.permissions.getAll()).permissions ?? []).sort().join(','),
            };
        });
        const page = await context.newPage();
        await page.goto('chrome://newtab/');
        await page.waitForSelector('.onboarding, .home');
        await body(seen, page);
    } finally {
        await context.close();
        removeProfile(profile);
    }
}

const brandOnly = (seen: Seen) => seen.name === BRAND.extensionName && seen.shortName === BRAND.shortName && seen.title === BRAND.shortName
    // Chrome lists the new-tab override itself as a permission; nothing else may appear.
    && seen.permissions === 'newTabPageOverride,search,storage';

await check('Store locales', 'a Turkish browser gets the Turkish description; name, toolbar title and permissions are unchanged', () => inBrowser('tr', async (seen, page) => {
    expect(seen.description === STORE_DESCRIPTIONS.tr && seen.message === STORE_DESCRIPTIONS.tr, `${seen.ui}: ${seen.description}`);
    expect(brandOnly(seen), JSON.stringify(seen));
    expect((await page.title()) === 'Senuma', await page.title());
}).then(() => STORE_DESCRIPTIONS.tr));

await check('Store locales', 'an English browser gets the English description, exactly as before', () => inBrowser('en-US', async seen => {
    expect(seen.description === BRAND.description && brandOnly(seen), JSON.stringify(seen));
}));

await check('Store locales', 'a browser in a language without an entry falls back to English', () => inBrowser('de', async seen => {
    expect(seen.description === BRAND.description && brandOnly(seen), `${seen.ui}: ${seen.description}`);
}).then(() => 'German browser → English description'));

await check('Runtime language', 'the interface language is still the person’s choice and what they typed is never translated', () => inBrowser('tr', async (_seen, page) => {
    // A Turkish browser starts Senuma in Turkish (existing behaviour); the person switches to English.
    await page.waitForSelector('.onboarding');
    await page.locator('.interest').nth(1).click();
    await page.locator('.onboarding .button.is-primary').click();
    await page.locator('.onboarding .button.is-primary').click();
    await page.locator('.onboarding .choice').last().click();
    await page.waitForSelector('.onboarding', { state: 'detached' });
    const before = await page.locator('.plate .plate-name').first().innerText();
    await page.locator('.deck-head .quiet-button').click();
    await page.locator('.overlay-form input').first().fill('Projelerim');
    await page.locator('.overlay-form button[type=submit]').click();
    await page.waitForSelector('.overlay-space');
    await page.keyboard.press('Escape');
    await page.locator('.topbar .icon-button[aria-label]').last().click();
    await page.locator('.settings-nav button').first().click();
    await page.locator('.settings-body select').first().selectOption('en');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    const names = await page.locator('.plate .plate-name').allInnerTexts();
    expect(names.includes('Projelerim'), `the typed name changed: ${names.join(', ')}`);
    expect(names[0] !== before, `the default name did not follow the interface language: ${before} → ${names[0]}`);
    expect((await page.locator('html').getAttribute('lang')) === 'en', 'interface did not switch to English in a Turkish browser');
    return `default “${before}” → “${names[0]}”; “Projelerim” kept; interface English inside a Turkish browser`;
}));

process.exit(report());

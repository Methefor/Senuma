import { mkdirSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { emptyState } from '../src/core/defaults';
import { applyStarter } from '../src/core/setup';
import { en } from '../src/i18n/en';
import { newProfile, removeProfile } from './harness';

const out = resolve('assets/video');
const frames = resolve('assets/gifs/frames');
mkdirSync(out, { recursive: true });
mkdirSync(frames, { recursive: true });
const profile = newProfile();
const size = { width: 1280, height: 800 };
const dist = resolve('dist');
const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true, viewport: size,
    recordVideo: { dir: out, size },
    args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const names = {
        category: (id: string) => en[`cat.${id}` as keyof typeof en] as string,
        mode: (key: string) => en[`modePreset.${key}` as keyof typeof en] as string,
        otherSpace: 'Bookmarks', importedGroup: 'Imported',
    };
    const state = applyStarter(emptyState(), ['dev', 'work', 'design'], names);
    await worker.evaluate(s => chrome.storage.local.set({ 'bos.state': { ...s, onboarded: true } }), state);
    const page = await context.newPage();
    await page.goto('chrome://newtab/');
    await page.waitForSelector('.home');
    let frame = 0;
    const hold = async (count: number) => {
        for (let i = 0; i < count; i++) {
            await page.screenshot({ path: join(frames, `${String(frame++).padStart(3, '0')}.png`) });
            await page.waitForTimeout(160);
        }
    };
    await hold(8);
    await page.locator('.plate', { hasText: 'Coding' }).click();
    await hold(12);
    await page.keyboard.press('Escape');
    await hold(6);
    await page.locator('body').click({ position: { x: 6, y: 400 } });
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.overlay-palette');
    await page.keyboard.type('git', { delay: 140 });
    await hold(12);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await hold(6);
    await page.locator('.topbar button[aria-label="Customize"]').click();
    await hold(12);
    await page.keyboard.press('Escape');
    await page.locator('#mode-switch').click();
    await page.locator('.menu button', { hasText: 'Dev' }).click();
    await hold(12);
    await page.locator('#mode-switch').click();
    await page.locator('.menu button', { hasText: 'All Spaces' }).click();
    await hold(8);
    const video = page.video();
    await page.close();
    await context.close();
    if (video) renameSync(await video.path(), join(out, `senuma-product-tour-${Date.now()}.webm`));
    console.log(`Recorded real RC interface: ${frame} GIF frames and WebM tour, synthetic state only.`);
} finally {
    await context.close();
    removeProfile(profile);
}

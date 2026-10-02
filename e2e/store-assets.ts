/**
 * Store-listing images, taken from the real build. Nothing is uploaded.
 *
 *   npm run store:assets
 *
 * Output (drafts/store/, images git-ignored): icon-128.png, eight captioned 1280×800
 * screenshots, a 1400×560 hero and a 440×280 small tile. Copy lives in docs/STORE_LISTING.md.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { BRAND } from '../src/brand';
import { DEFAULT_BACKGROUND } from '../src/core/background';
import { emptyState } from '../src/core/defaults';
import * as ops from '../src/core/ops';
import { applyStarter } from '../src/core/setup';
import type { AppState } from '../src/core/types';
import { en } from '../src/i18n/en';
import { DIST, launch, newProfile, openNewTab, removeProfile, writeStorage } from './harness';

const OUT = resolve('drafts/store');
const RAW = join(OUT, 'raw');
mkdirSync(RAW, { recursive: true });
const SIZE = { width: 1280, height: 800 };
const STACK = `'Segoe UI Variable Display','Segoe UI',-apple-system,system-ui,sans-serif`;

const names = {
    category: (id: string) => en[`cat.${id}` as keyof typeof en] as string,
    mode: (key: string) => en[`modePreset.${key}` as keyof typeof en] as string,
    otherSpace: 'Bookmarks', importedGroup: 'Imported',
};
function demo(): AppState {
    let state = applyStarter(emptyState(), ['ai', 'dev', 'work', 'entertainment', 'design'], names);
    const now = Date.now();
    // Dock and Continue use entries whose marks are packaged; everything else shows a letter.
    ['GitHub', 'Vercel', 'Letterboxd'].forEach((title, index) => {
        const item = Object.values(state.items).find(i => i.title === title);
        if (!item) return;
        state = ops.toggleDock(state, { kind: 'item', id: item.id });
        state = ops.recordRecent(state, { url: item.url, title: item.title });
        state = { ...state, recents: state.recents.map(r => (r.url === item.url ? { ...r, at: now - (index * 47 + 3) * 60_000 } : r)) };
    });
    for (const id of state.modeOrder) {
        if (state.modes[id]!.name === 'Dev') state = ops.updateMode(state, id, { themeId: 'phosphor', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'ink' }, dim: 0.06 } });
    }
    return { ...state, onboarded: true, updatedAt: now, prefs: { ...state.prefs, iconSource: 'none', themeId: 'dusk', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'mountain-mirror' }, dim: 0.43 } } };
}

const profile = newProfile();
const session = await launch(DIST, profile, SIZE);
const raw = async (page: Page, name: string) => {
    await page.addStyleTag({ content: '.toasts{display:none}' }).catch(() => undefined);
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(RAW, `${name}.png`) });
};
const open = async (state: AppState) => {
    await writeStorage(session, { 'bos.state': { ...state, updatedAt: Date.now() } });
    return openNewTab(session);
};

const state = demo();
let page = await open(state);
await page.waitForSelector('.backdrop-photo.is-ready');
await raw(page, 'home');

await page.locator('.plate', { hasText: 'Coding' }).click();
await page.waitForSelector('.overlay-space');
await raw(page, 'space');
await page.keyboard.press('Escape');

await page.locator('#home-search').fill('y lofi');
await raw(page, 'search');
await page.locator('#home-search').fill('');

await page.locator('body').click({ position: { x: 6, y: 400 } });
await page.keyboard.press('Control+k');
await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
await page.keyboard.type('git');
await raw(page, 'command');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

await page.locator('.topbar button[aria-label="Customize"]').click();
await page.waitForSelector('.overlay-customize');
await raw(page, 'customize');
await page.keyboard.press('Escape');

await page.locator('.topbar button[aria-label="Settings"]').click();
await page.locator('.settings-nav button', { hasText: 'Privacy' }).click();
await raw(page, 'privacy');
await page.close();

const dev = state.modeOrder.find(id => state.modes[id]!.name === 'Dev')!;
page = await open(ops.setActiveMode(state, dev));
await raw(page, 'mode');
await page.close();

page = await open({ ...state, prefs: { ...state.prefs, themeId: 'fjord', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'glass-facade' }, dim: 0.35 } } });
await page.waitForSelector('.backdrop-photo.is-ready');
await raw(page, 'theme');
await page.close();
await session.context.close();
removeProfile(profile);

// ---------- Compose: one short line over each real screen ----------
const SHOTS: [file: string, source: string, headline: string, sub: string][] = [
    ['screenshot-1-home', 'home', BRAND.tagline, 'A personal new-tab workspace.'],
    ['screenshot-2-spaces', 'space', 'Spaces', 'Everything you use, organized around you.'],
    ['screenshot-3-modes', 'mode', 'Modes', 'A different new tab for each part of your day.'],
    ['screenshot-4-search', 'search', 'Search', 'The web through your own search engine, or a site you choose.'],
    ['screenshot-5-command-center', 'command', 'Command center', 'Everything is a command away.'],
    ['screenshot-6-personalization', 'customize', 'Personalization', 'Make every new tab feel like yours.'],
    ['screenshot-7-themes', 'theme', 'Themes and photographs', 'Six themes, built-in photographs, or your own images.'],
    ['screenshot-8-privacy', 'privacy', 'Personal by design', 'On your device. No account, no analytics.'],
];
const tools = await chromium.launch();
const canvas = await tools.newPage();
const icon = `data:image/svg+xml;base64,${Buffer.from(readFileSync('src/assets/brand/icon.svg')).toString('base64')}`;
const data = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
const word = (px: number) => `<span style="font:600 ${px}px/1 ${STACK};letter-spacing:-.02em">${BRAND.productName.toLowerCase()}</span>`;
const backdrop = 'radial-gradient(120% 120% at 20% 0%,#1c2044 0%,#0b0d1a 62%)';
for (const [file, source, headline, sub] of SHOTS) {
    await canvas.setViewportSize(SIZE);
    await canvas.setContent(`<body style="margin:0;width:1280px;height:800px;overflow:hidden;background:${backdrop};color:#EEF0F7;font-family:${STACK}">
      <div style="height:128px;padding:0 56px;display:flex;align-items:center;gap:22px">
        <img src="${icon}" width="40" height="40">
        <div><div style="font:600 30px/1.1 ${STACK};letter-spacing:-.02em">${headline}</div><div style="font:400 17px/1.3 ${STACK};color:#B9BDCF;margin-top:5px">${sub}</div></div>
      </div>
      <img src="${data(join(RAW, `${source}.png`))}" style="display:block;width:1075px;height:672px;margin:0 auto;border-radius:14px 14px 0 0;box-shadow:0 20px 70px #000a"></body>`);
    await canvas.screenshot({ path: join(OUT, `${file}.png`) });
    console.log(`${file}.png`);
}

copyFileSync('src/assets/brand/icon128.png', join(OUT, 'icon-128.png'));
await canvas.setViewportSize({ width: 1400, height: 560 });
await canvas.setContent(`<body style="margin:0;width:1400px;height:560px;overflow:hidden;background:${backdrop};color:#EEF0F7;font-family:${STACK};display:flex;align-items:center">
  <div style="padding-left:84px;width:560px;flex:none"><div style="display:flex;align-items:center;gap:16px"><img src="${icon}" width="60" height="60">${word(46)}</div>
    <div style="font:600 40px/1.12 ${STACK};letter-spacing:-.02em;margin-top:30px">${BRAND.tagline}</div>
    <div style="font:400 19px/1.45 ${STACK};color:#B9BDCF;margin-top:14px">${BRAND.descriptor}. Spaces, search and a look that is yours.</div></div>
  <img src="${data(join(RAW, 'home.png'))}" style="height:470px;border-radius:14px;box-shadow:0 30px 90px #000b;margin-left:20px"></body>`);
await canvas.screenshot({ path: join(OUT, 'hero-1400x560.png') });
await canvas.setViewportSize({ width: 440, height: 280 });
await canvas.setContent(`<body style="margin:0;width:440px;height:280px;background:${backdrop};color:#EEF0F7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:${STACK}"><div style="display:flex;align-items:center;gap:12px"><img src="${icon}" width="48" height="48">${word(36)}</div><div style="font:400 15px ${STACK};color:#B9BDCF">${BRAND.tagline}</div></body>`);
await canvas.screenshot({ path: join(OUT, 'tile-440x280.png') });
console.log('hero-1400x560.png, tile-440x280.png, icon-128.png');
await tools.close();
process.exit(0);

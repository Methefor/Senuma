/**
 * Local store-listing drafts, taken from the real build. Nothing is uploaded.
 *
 *   npm run store:assets
 *
 * Output (drafts/store/, images git-ignored): icon-128.png, five 1280×800 screenshots,
 * a 1400×560 hero and a 440×280 small tile. Copy lives in docs/STORE_LISTING.md.
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
mkdirSync(OUT, { recursive: true });
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
    // Dock and Continue use entries whose icons need no third-party logo in a store image.
    ['GitHub', 'Vercel', 'Letterboxd'].forEach((title, index) => {
        const item = Object.values(state.items).find(i => i.title === title);
        if (!item) return;
        state = ops.toggleDock(state, { kind: 'item', id: item.id });
        state = ops.recordRecent(state, { url: item.url, title: item.title });
        state = { ...state, recents: state.recents.map(r => (r.url === item.url ? { ...r, at: now - (index * 47 + 3) * 60_000 } : r)) };
    });
    for (const id of state.modeOrder) {
        const mode = state.modes[id]!;
        if (mode.name === 'Dev') state = ops.updateMode(state, id, { themeId: 'phosphor', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'ink' }, dim: 0.06 } });
    }
    return { ...state, onboarded: true, updatedAt: now, prefs: { ...state.prefs, iconSource: 'none', themeId: 'dusk', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'mountain-mirror' }, dim: 0.43 } } };
}

const profile = newProfile();
const session = await launch(DIST, profile, SIZE);
const shot = async (page: Page, file: string) => {
    await page.addStyleTag({ content: '.toasts{display:none}' }).catch(() => undefined);
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(OUT, file) });
    console.log(file);
};

// 5 · first run (storage still empty)
let page = await session.context.newPage();
await page.goto('chrome://newtab/');
await page.waitForSelector('.onboarding');
await shot(page, 'screenshot-5-first-run.png');
await page.close();

const state = demo();
await writeStorage(session, { 'bos.state': state });
page = await openNewTab(session);
await page.waitForSelector('.backdrop-photo.is-ready');
await page.waitForTimeout(800);
await shot(page, 'screenshot-1-home.png');

await page.locator('body').click({ position: { x: 6, y: 400 } });
await page.keyboard.press('Control+k');
await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
await page.keyboard.type('git');
await shot(page, 'screenshot-2-command-center.png');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

await page.locator('.topbar button[aria-label="Customize"]').click();
await page.waitForSelector('.overlay-customize');
await shot(page, 'screenshot-4-customize.png');
await page.keyboard.press('Escape');
await page.close();

const dev = state.modeOrder.find(id => state.modes[id]!.name === 'Dev')!;
await writeStorage(session, { 'bos.state': { ...ops.setActiveMode(state, dev), updatedAt: Date.now() } });
page = await openNewTab(session);
await shot(page, 'screenshot-3-mode.png');
await page.close();
await session.context.close();
removeProfile(profile);

// Icon, hero and small tile.
copyFileSync('src/assets/brand/icon128.png', join(OUT, 'icon-128.png'));
const tools = await chromium.launch();
const canvas = await tools.newPage();
const icon = `data:image/svg+xml;base64,${Buffer.from(readFileSync('src/assets/brand/icon.svg')).toString('base64')}`;
const home = `data:image/png;base64,${readFileSync(join(OUT, 'screenshot-1-home.png')).toString('base64')}`;
const word = (px: number) => `<span style="font:600 ${px}px/1 ${STACK};letter-spacing:-.02em">${BRAND.productName.toLowerCase()}</span>`;
await canvas.setViewportSize({ width: 1400, height: 560 });
await canvas.setContent(`<body style="margin:0;width:1400px;height:560px;overflow:hidden;background:radial-gradient(120% 120% at 20% 0%,#1c2044 0%,#0b0d1a 62%);color:#EEF0F7;font-family:${STACK};display:flex;align-items:center">
  <div style="padding-left:84px;width:560px;flex:none"><div style="display:flex;align-items:center;gap:16px"><img src="${icon}" width="60" height="60">${word(46)}</div>
    <div style="font:600 40px/1.12 ${STACK};letter-spacing:-.02em;margin-top:30px">${BRAND.tagline}</div>
    <div style="font:400 19px/1.45 ${STACK};color:#B9BDCF;margin-top:14px">${BRAND.descriptor}. Spaces, search and a look that is yours.</div></div>
  <img src="${home}" style="height:470px;border-radius:14px;box-shadow:0 30px 90px #000b;margin-left:20px"></body>`);
await canvas.screenshot({ path: join(OUT, 'hero-1400x560.png') });
console.log('hero-1400x560.png');
await canvas.setViewportSize({ width: 440, height: 280 });
await canvas.setContent(`<body style="margin:0;width:440px;height:280px;background:radial-gradient(120% 120% at 20% 0%,#1c2044 0%,#0b0d1a 65%);color:#EEF0F7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:${STACK}"><div style="display:flex;align-items:center;gap:12px"><img src="${icon}" width="48" height="48">${word(36)}</div><div style="font:400 15px ${STACK};color:#B9BDCF">${BRAND.tagline}</div></body>`);
await canvas.screenshot({ path: join(OUT, 'tile-440x280.png') });
console.log('tile-440x280.png');
await tools.close();
process.exit(0);

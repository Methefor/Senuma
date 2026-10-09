/**
 * Store-listing images, taken from the real build. Nothing is uploaded.
 *
 *   npm run store:assets            (English → drafts/store/)
 *   CAPTURE_LANG=tr npm run store:assets   (the Turkish interface → drafts/store-tr/)
 *
 * Output (drafts/store/, images git-ignored): icon-128.png, the five captioned 1280×800 store
 * screenshots, extra captioned screens for docs and the landing page (extra-*), a 1400×560 hero
 * and a 440×280 small tile. Scenes and copy: docs/MEDIA_PLAN.md §1, docs/MESSAGING_SYSTEM.md.
 *
 * Marketing captures show real site icons, loaded from each site as the product does by default
 * (needs a network connection). The product itself is unchanged: letters remain the fallback,
 * and “Letters only” stays a setting.
 */
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { BRAND } from '../src/brand';
import { DEFAULT_BACKGROUND } from '../src/core/background';
import * as ops from '../src/core/ops';
import type { AppState, Language } from '../src/core/types';
import { CAPTURE_TIME, demo, modeId, nextStamp, words } from './demo-state';
import { DIST, launch, newProfile, openNewTab, removeProfile, writeStorage } from './harness';

const LANG: Language = process.env.CAPTURE_LANG === 'tr' ? 'tr' : 'en';
/** The interface's own labels in the capture language: scripts click what is on screen. */
const t = words(LANG);
const OUT = resolve(LANG === 'en' ? 'drafts/store' : `drafts/store-${LANG}`);
const RAW = join(OUT, 'raw');
mkdirSync(RAW, { recursive: true });
const SIZE = { width: 1280, height: 800 };
const STACK = `'Segoe UI Variable Display','Segoe UI',-apple-system,system-ui,sans-serif`;

const profile = newProfile();
const session = await launch(DIST, profile, SIZE);
await session.context.clock.setFixedTime(CAPTURE_TIME);
/** Every site icon on screen has loaded or given up (a monogram then stays, as in the product). */
const iconsSettled = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll('.app-icon img')].every(img => (img as HTMLImageElement).complete), null, { timeout: 15_000 }).catch(() => undefined);
const raw = async (page: Page, name: string) => {
    await page.addStyleTag({ content: '.toasts{display:none}' }).catch(() => undefined);
    await iconsSettled(page);
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(RAW, `${name}.png`) });
};
const open = async (state: AppState) => {
    await writeStorage(session, { 'bos.state': { ...state, updatedAt: nextStamp() } });
    return openNewTab(session);
};

const state = demo({ language: LANG });
let page = await open(state);
await page.waitForSelector('.backdrop-photo.is-ready');
await raw(page, 'home');

await page.locator('.plate', { hasText: t('cat.entertainment') }).click();
await page.waitForSelector('.overlay-space');
await page.locator('.suggestions summary').click();
// Watch and Listen above the open suggestions; the header stays in place.
await page.locator('.suggestions').evaluate(el => el.scrollIntoView({ block: 'end' }));
await raw(page, 'space');
await page.keyboard.press('Escape');

await page.locator('#home-search').fill('y lofi mix');
await raw(page, 'search');
await page.locator('#home-search').fill('');

await page.locator('body').click({ position: { x: 6, y: 400 } });
await page.keyboard.press('Control+k');
await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
await page.keyboard.type('git');
await raw(page, 'command-general');
await page.keyboard.press('Control+a');
await page.keyboard.type('y lofi mix');
await raw(page, 'command');
await page.keyboard.press('Escape');
await page.keyboard.press('Escape');

await page.locator(`.topbar button[aria-label="${t('customize.title')}"]`).click();
await page.waitForSelector('.overlay-customize');
await raw(page, 'customize-pickers');
await page.locator('.overlay-customize .segmented button', { hasText: t('atmosphere.cinematic') }).click();
await page.locator('.overlay-customize .tune').evaluate(el => el.scrollIntoView({ block: 'center' }));
await raw(page, 'customize');
await page.keyboard.press('Escape');

await page.locator(`.topbar button[aria-label="${t('settings.title')}"]`).click();
await page.locator('.settings-nav button', { hasText: t('settings.privacy') }).click();
await raw(page, 'privacy');
await page.close();

page = await open(ops.setActiveMode(state, modeId(state, 'dev')));
await raw(page, 'mode');
await page.close();

page = await open({ ...state, prefs: { ...state.prefs, themeId: 'fjord', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'glass-facade' }, dim: 0.35 } } });
await page.waitForSelector('.backdrop-photo.is-ready');
await raw(page, 'theme');
await page.close();
await session.context.close();
removeProfile(profile);

// ---------- Compose: one short line over each real screen ----------
// Captions are the lines of docs/MESSAGING_SYSTEM.md, in the capture language.
const TAGLINE = LANG === 'tr' ? 'Tarayıcını kendine göre yap.' : BRAND.tagline;
const SECOND = LANG === 'tr' ? 'Web’deki yerin.' : 'Your place on the web.';
const CAPTIONS: Record<Language, [headline: string, sub: string][]> = {
    en: [
        [TAGLINE, SECOND],
        ['Everything you use, organized.', 'Add only what you use, one at a time.'],
        ['One search bar. Your rules.', '“y lofi mix” searches YouTube. Make your own shortcuts.'],
        ['Make every new tab yours.', 'Fit, position, dim, blur and add atmosphere.'],
        ['A workspace for every mode.', 'Its own Spaces, look, search and dock.'],
        ['One search bar. Your rules.', 'Type a shortcut, a space, then your search.'],
        ['Everything, one shortcut away.', 'Ctrl+K opens links, Spaces, Modes and settings.'],
        ['Make every new tab feel like yours.', 'Six themes, built-in photographs, or your own images.'],
        ['Six themes.', 'Each with its own colours, type and backdrop.'],
        ['Personal by design.', 'No Senuma account. No analytics. Stored in your browser.'],
    ],
    tr: [
        [TAGLINE, SECOND],
        ['Kullandığın her şey, düzenli.', 'Yalnızca kullandığını ekle, birer birer.'],
        ['Tek arama çubuğu. Senin kuralların.', '“y lofi mix” YouTube’da arar. Kendi kısayollarını oluştur.'],
        ['Her yeni sekme senin olsun.', 'Sığdır, konumlandır, karart, bulanıklaştır, atmosfer kat.'],
        ['Her hâl için bir çalışma alanı.', 'Kendi Alanları, görünümü, araması ve dock’u.'],
        ['Tek arama çubuğu. Senin kuralların.', 'Bir kısayol, bir boşluk, sonra araman.'],
        ['Her şey tek kısayol uzağında.', 'Ctrl+K bağlantıları, Alanları, Modları ve ayarları açar.'],
        ['Her yeni sekme sana ait hissettirsin.', 'Altı tema, hazır fotoğraflar ya da kendi görsellerin.'],
        ['Altı tema.', 'Her birinin kendi renkleri, yazı tipi ve arka planı.'],
        ['Doğası gereği kişisel.', 'Senuma hesabı yok. Analitik yok. Tarayıcında saklanır.'],
    ],
};
const SOURCES: [file: string, source: string][] = [
    // The five store screenshots (MEDIA_PLAN.md §1), in store order.
    ['screenshot-1-home', 'home'], ['screenshot-2-spaces', 'space'], ['screenshot-3-search', 'command'], ['screenshot-4-customize', 'customize'], ['screenshot-5-modes', 'mode'],
    // Extras for docs and the landing page.
    ['extra-search-box', 'search'], ['extra-command-center', 'command-general'], ['extra-customize-pickers', 'customize-pickers'], ['extra-themes', 'theme'], ['extra-privacy', 'privacy'],
];
const SHOTS = SOURCES.map(([file, source], index) => [file, source, ...CAPTIONS[LANG][index]!] as const);
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
    <div style="font:600 40px/1.12 ${STACK};letter-spacing:-.02em;margin-top:30px">${TAGLINE}</div>
    <div style="font:400 19px/1.45 ${STACK};color:#B9BDCF;margin-top:14px">${SECOND}</div></div>
  <img src="${data(join(RAW, 'home.png'))}" style="height:470px;border-radius:14px;box-shadow:0 30px 90px #000b;margin-left:20px"></body>`);
await canvas.screenshot({ path: join(OUT, 'hero-1400x560.png') });
await canvas.setViewportSize({ width: 440, height: 280 });
await canvas.setContent(`<body style="margin:0;width:440px;height:280px;background:${backdrop};color:#EEF0F7;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:${STACK}"><div style="display:flex;align-items:center;gap:12px"><img src="${icon}" width="48" height="48">${word(36)}</div><div style="font:400 15px ${STACK};color:#B9BDCF">${TAGLINE}</div></body>`);
await canvas.screenshot({ path: join(OUT, 'tile-440x280.png') });
console.log('hero-1400x560.png, tile-440x280.png, icon-128.png');
await tools.close();
process.exit(0);

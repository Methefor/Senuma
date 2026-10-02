/**
 * Senuma brand direction: icon round 2 and brand application on the real product. Local only.
 *
 *   npx vite-node e2e/senuma-brand.ts icons    icon concepts and wordmark
 *   npx vite-node e2e/senuma-brand.ts apply    brand applied to the product, store and landing mock-ups
 *
 * Nothing in src/ or dist/ is changed: the product screens come from a throw-away copy of the
 * built extension (proto/senuma/ext) with the display name and icons swapped.
 * Output: proto/senuma/*.png and index.html (git-ignored).
 */
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Page } from 'playwright';
import { DEFAULT_BACKGROUND } from '../src/core/background';
import { emptyState } from '../src/core/defaults';
import * as ops from '../src/core/ops';
import { applyStarter } from '../src/core/setup';
import type { AppState } from '../src/core/types';
import { en } from '../src/i18n/en';
import { DIST, launch, newProfile, openNewTab, removeProfile, writeStorage } from './harness';

const OUT = resolve('proto/senuma');
mkdirSync(OUT, { recursive: true });
const STACK = `'Segoe UI Variable Display','Segoe UI',-apple-system,'SF Pro Display',system-ui,sans-serif`;
const NAME = 'Senuma';
const TAGLINE = 'Make the browser yours.';
const SECONDARY = 'Your place on the web.';
const DESCRIPTOR = 'New Tab Workspace';
const INK = '#14172A';
const PAPER = '#FBF3E8';

/** Each concept is a function of two colours so it can be drawn on the tile, in ink, or in white. */
type Mark = (fg: string, bg: string) => string;
const CONCEPTS: { id: string; label: string; idea: string; letter: boolean; mark: Mark }[] = [
    {
        id: 'corners', label: 'Framed place', idea: 'personal space · frame', letter: false,
        mark: fg => `<g fill="none" stroke="${fg}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"><path d="M32 60V44a12 12 0 0 1 12-12h16"/><path d="M96 68v16a12 12 0 0 1-12 12H68"/></g><circle cx="64" cy="64" r="12" fill="${fg}"/>`,
    },
    {
        id: 'strata', label: 'Strata', idea: 'layers · an S only by rhythm', letter: false,
        mark: fg => `<rect x="46" y="28" width="54" height="18" rx="9" fill="${fg}"/><rect x="28" y="55" width="72" height="18" rx="9" fill="${fg}"/><rect x="28" y="82" width="54" height="18" rx="9" fill="${fg}"/>`,
    },
    {
        id: 'bento', label: 'Connected Spaces', idea: 'Spaces side by side', letter: false,
        mark: fg => `<rect x="28" y="28" width="32" height="72" rx="10" fill="${fg}"/><rect x="68" y="28" width="32" height="32" rx="10" fill="${fg}"/><circle cx="84" cy="84" r="16" fill="${fg}"/>`,
    },
    {
        id: 'channel', label: 'Channel', idea: 'one place, a path through it', letter: true,
        mark: (fg, bg) => `<rect x="26" y="26" width="76" height="76" rx="20" fill="${fg}"/><path d="M110 50H60a9 9 0 0 0 0 18h8a9 9 0 0 1 0 18H18" fill="none" stroke="${bg}" stroke-width="10"/>`,
    },
    {
        id: 'door', label: 'Open door', idea: 'entry', letter: false,
        mark: fg => `<rect x="34" y="26" width="60" height="76" rx="12" fill="none" stroke="${fg}" stroke-width="10"/><path d="M50 44l26 8v42l-26-8z" fill="${fg}"/>`,
    },
    {
        id: 'nested', label: 'Room within', idea: 'environment · portal', letter: false,
        mark: fg => `<rect x="26" y="26" width="76" height="76" rx="21" fill="none" stroke="${fg}" stroke-width="10"/><rect x="48" y="48" width="32" height="32" rx="10" fill="${fg}"/>`,
    },
];
const CHOSEN = process.env.SENUMA_ICON ?? 'corners';

const TILE = '<defs><linearGradient id="t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8D4AB"/><stop offset="1" stop-color="#EDA571"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#t)"/>';
const concept = (id: string) => CONCEPTS.find(c => c.id === id)!;
/** Full-colour icon: ink mark on the warm tile (visible on light and dark toolbars alike). */
const tileSvg = (id: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${TILE}${concept(id).mark(INK, '#F2BD8E')}</svg>`;
/** One-colour version: the mark alone. */
const monoSvg = (id: string, fg: string, bg: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${concept(id).mark(fg, bg)}</svg>`;
const uri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const icon = (id = CHOSEN) => uri(tileSvg(id));
const png = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;
const wordmark = (size: number, color: string) => `<span style="font:600 ${size}px/1 ${STACK};letter-spacing:-.02em;color:${color}">senuma</span>`;

async function shoot(page: Page, html: string, file: string, width: number): Promise<void> {
    await page.setViewportSize({ width, height: 800 });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0}body{font-family:${STACK};-webkit-font-smoothing:antialiased}</style>${html}`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(OUT, file), fullPage: true });
    console.log(file);
}

async function icons(): Promise<void> {
    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 2 });
    const sizes = [16, 32, 48, 128];
    const row = (bg: string, fg: string, inner: string, note: string) => `<div style="display:flex;align-items:flex-end;gap:14px;padding:14px 16px;background:${bg};border-radius:10px;margin-top:8px">${inner}<span style="margin-left:auto;font-size:10.5px;color:${fg};opacity:.65">${note}</span></div>`;
    const sheet = `<section style="padding:34px 40px;background:#F3F1EC;color:#14161F">
      <h2 style="font:500 12px ${STACK};letter-spacing:.14em;color:#6A6F82;margin-bottom:6px">SENUMA · ICON ROUND 2 · 16 / 32 / 48 / 128 px</h2>
      <p style="font-size:12.5px;color:#6A6F82;margin-bottom:22px">Ink mark on a warm tile, so the icon holds on light and dark toolbars. Each concept also shown as a one-colour mark.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:26px 24px">
      ${CONCEPTS.map(c => `<div>
          <div style="font:600 13.5px ${STACK}">${c.label}${c.id === CHOSEN ? ' · used in the mock-ups' : ''}</div>
          <div style="font-size:11.5px;color:#6A6F82;margin:2px 0 6px">${c.idea}${c.letter ? '' : ' · no letter'}</div>
          ${row('#ffffff', '#14161F', sizes.map(s => `<img src="${icon(c.id)}" width="${s}" height="${s}">`).join(''), 'light toolbar')}
          ${row('#202124', '#e8eaed', sizes.slice(0, 3).map(s => `<img src="${icon(c.id)}" width="${s}" height="${s}">`).join(''), 'dark toolbar')}
          ${row('#ffffff', '#14161F', [16, 32, 48].map(s => `<img src="${uri(monoSvg(c.id, '#14161F', '#ffffff'))}" width="${s}" height="${s}">`).join('') + `<span style="width:12px"></span>` + [16, 32, 48].map(s => `<span style="display:inline-flex;background:#202124;border-radius:6px;padding:4px"><img src="${uri(monoSvg(c.id, '#ffffff', '#202124'))}" width="${s}" height="${s}"></span>`).join(''), 'one colour')}
        </div>`).join('')}
      </div></section>`;
    await shoot(page, sheet, '01-icons-round2.png', 1320);

    await page.setViewportSize({ width: 1320, height: 400 });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{font-family:${STACK};background:#fff;padding:26px 40px}</style><h2 style="font:500 12px ${STACK};letter-spacing:.14em;color:#6A6F82;margin-bottom:16px">TRUE 16 PX, ENLARGED 8× (no smoothing) · colour and one-colour</h2><div style="display:flex;gap:18px;flex-wrap:wrap">${CONCEPTS.flatMap(c => [tileSvg(c.id), monoSvg(c.id, '#14161F', '#ffffff')].map((s, i) => `<figure style="text-align:center"><canvas data-src="${uri(s)}" width="16" height="16" style="width:96px;height:96px;image-rendering:pixelated;border:1px solid #eee"></canvas><figcaption style="font-size:10.5px;margin-top:4px">${c.label}${i ? ' (mono)' : ''}</figcaption></figure>`)).join('')}</div>`);
    await page.evaluate(async () => {
        for (const canvas of document.querySelectorAll('canvas')) {
            const image = new Image();
            image.src = canvas.dataset.src!;
            await image.decode();
            canvas.getContext('2d')!.drawImage(image, 0, 0, 16, 16);
        }
    });
    await page.screenshot({ path: join(OUT, '02-icons-16px.png'), fullPage: true });
    console.log('02-icons-16px.png');

    const forms = ['senuma', 'Senuma', 'SENUMA'];
    const words = `<section style="padding:38px 44px;background:#0B0E1A;color:#EEF0F7">
      <h2 style="font:500 12px ${STACK};letter-spacing:.14em;color:#8B90A6;margin-bottom:24px">SENUMA · WORDMARK · system type stack, no custom font</h2>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:26px 30px;align-items:baseline">
        ${[500, 600].flatMap(w => forms.map((f, i) => `<div><div style="font-size:11px;color:#8B90A6;margin-bottom:8px">${['lowercase', 'Title Case', 'UPPERCASE'][i]} · ${w}${i === 0 && w === 600 ? ' · preferred' : ''}</div><div style="font:${w} 52px/1 ${STACK};letter-spacing:${i === 2 ? '.14em' : '-.02em'}">${f}</div></div>`)).join('')}
      </div>
      <div style="display:flex;gap:44px;align-items:center;margin-top:44px;padding-top:30px;border-top:1px solid #222741;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:14px"><img src="${icon()}" width="48" height="48">${wordmark(38, '#EEF0F7')}</div>
        <div style="display:flex;align-items:center;gap:14px;background:${PAPER};padding:14px 22px;border-radius:12px"><img src="${icon()}" width="48" height="48">${wordmark(38, INK)}</div>
        <div style="display:flex;align-items:center;gap:10px"><img src="${icon()}" width="22" height="22">${wordmark(18, '#EEF0F7')}</div>
        <div><div style="font:600 30px/1.1 ${STACK};letter-spacing:-.02em">senuma</div><div style="font:400 15px ${STACK};color:#B9BDCF;margin-top:6px">${TAGLINE}</div></div>
      </div></section>`;
    await shoot(page, words, '03-wordmark.png', 1320);
    await browser.close();
}

const names = {
    category: (id: string) => en[`cat.${id}` as keyof typeof en] as string,
    mode: (key: string) => en[`modePreset.${key}` as keyof typeof en] as string,
    otherSpace: 'Bookmarks', importedGroup: 'Imported',
};
function demoState(): AppState {
    let state = applyStarter(emptyState(), ['ai', 'dev', 'work', 'entertainment', 'gaming'], names);
    const now = Date.now();
    ['Claude', 'GitHub', 'Gmail', 'YouTube', 'Spotify', 'Figma'].forEach((title, index) => {
        const item = Object.values(state.items).find(i => i.title === title);
        if (!item) return;
        state = ops.toggleDock(state, { kind: 'item', id: item.id });
        state = ops.recordRecent(state, { url: item.url, title: item.title });
        state = { ...state, recents: state.recents.map(r => (r.url === item.url ? { ...r, at: now - (index * 47 + 3) * 60_000 } : r)) };
    });
    return { ...state, onboarded: true, updatedAt: now, prefs: { ...state.prefs, themeId: 'dusk', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'mountain-mirror' }, dim: 0.43 } } };
}

function framed(shot: string, caption: string): string {
    return `<div style="width:1440px;background:#1f2023;color:#e8eaed">
      <div style="display:flex;align-items:flex-end;height:42px;padding:0 10px;background:#17181b">
        <div style="display:flex;align-items:center;gap:9px;height:34px;padding:0 14px;min-width:230px;background:#2b2c30;border-radius:10px 10px 0 0;font-size:12.5px"><img src="${icon()}" width="16" height="16">New Tab<span style="margin-left:auto;opacity:.5">×</span></div>
        <span style="padding:0 14px 9px;opacity:.5">+</span></div>
      <div style="display:flex;align-items:center;gap:12px;height:44px;padding:0 14px;background:#2b2c30">
        <span style="opacity:.45;letter-spacing:10px">←→↻</span>
        <div style="flex:1;height:30px;border-radius:15px;background:#1f2023;display:flex;align-items:center;padding:0 16px;font-size:12.5px;color:#9aa0a6">Search or type a URL</div>
        <img src="${icon()}" width="20" height="20"><span style="opacity:.45">⋮</span></div>
      <img src="${png(join(OUT, 'raw', shot))}" width="1440" style="display:block">
      <div style="padding:9px 16px;font-size:12px;color:#9aa0a6;background:#17181b">${caption}</div></div>`;
}

async function apply(): Promise<void> {
    const tools = await chromium.launch();
    const render = await tools.newPage();
    const sheet = await tools.newPage({ deviceScaleFactor: 1 });

    const ext = join(OUT, 'ext');
    rmSync(ext, { recursive: true, force: true });
    cpSync(DIST, ext, { recursive: true });
    for (const file of readdirSync(join(ext, 'assets')).filter(f => /^newtab-.*\.js$/.test(f))) {
        const path = join(ext, 'assets', file);
        writeFileSync(path, readFileSync(path, 'utf8').replaceAll('Browser OS', NAME));
    }
    for (const size of [16, 48, 128]) {
        await render.setViewportSize({ width: size, height: size });
        await render.setContent(`<body style="margin:0;background:transparent"><img src="${icon()}" width="${size}" height="${size}" style="display:block">`);
        await render.screenshot({ path: join(ext, 'icons', `icon${size}.png`), omitBackground: true });
    }
    const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
    writeFileSync(join(ext, 'manifest.json'), JSON.stringify({ ...manifest, name: NAME, short_name: NAME, action: { ...manifest.action, default_title: NAME } }, null, 2));

    mkdirSync(join(OUT, 'raw'), { recursive: true });
    const profile = newProfile();
    const session = await launch(ext, profile);
    let page = await session.context.newPage();
    await page.goto('chrome://newtab/');
    await page.waitForSelector('.onboarding');
    // Prototype-only: a small lockup above the first step. This is where the brand introduces itself.
    await page.evaluate(({ src, tagline, stack }) => {
        const lockup = document.createElement('div');
        lockup.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:22px';
        lockup.innerHTML = `<img src="${src}" width="34" height="34"><div><div style="font:600 21px/1.05 ${stack};letter-spacing:-.02em">senuma</div><div style="font:400 12.5px/1.3 ${stack};opacity:.62;margin-top:3px">${tagline}</div></div>`;
        document.querySelector('.onboarding')!.prepend(lockup);
    }, { src: icon(), tagline: TAGLINE, stack: STACK });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(OUT, 'raw', 'onboarding.png') });
    await page.close();

    await writeStorage(session, { 'bos.state': demoState() });
    page = await openNewTab(session);
    await page.addStyleTag({ content: '.toasts{display:none}' });
    await page.waitForSelector('.backdrop-photo.is-ready');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(OUT, 'raw', 'home.png') });
    await page.locator('.topbar button[aria-label="Settings"]').click();
    await page.locator('.settings-nav button', { hasText: 'About' }).click();
    // Prototype-only: the same lockup in About, in place of the plain name.
    await page.evaluate(({ src, stack }) => {
        const name = document.querySelector('.about-name');
        if (!name) return;
        const version = name.querySelector('span')?.textContent ?? '';
        name.innerHTML = `<span style="display:inline-flex;align-items:center;gap:10px;margin:0;color:inherit"><img src="${src}" width="30" height="30"><b style="font:600 22px/1 ${stack};letter-spacing:-.02em">senuma</b></span><span>${version}</span>`;
    }, { src: icon(), stack: STACK });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, 'raw', 'about.png') });
    await session.context.close();
    removeProfile(profile);

    await shoot(sheet, framed('home.png', 'Home. No logo on the page: the tab and the toolbar carry the brand, the user’s own world stays the subject.'), '10-home-frame.png', 1440);
    await shoot(sheet, framed('onboarding.png', 'First run. Brand lockup above step one (prototype only).'), '11-onboarding.png', 1440);
    await shoot(sheet, framed('about.png', 'Settings → About. Lockup instead of the plain name (prototype only).'), '12-about.png', 1440);

    const toolbar = (bg: string, fg: string, label: string) => `<div style="display:flex;align-items:center;gap:14px;height:46px;padding:0 16px;background:${bg};color:${fg};border-radius:10px"><div style="flex:1;height:30px;border-radius:15px;background:${fg}14;display:flex;align-items:center;padding:0 14px;font-size:12px;opacity:.75">${label}</div><span style="opacity:.5">◧</span><img src="${icon()}" width="16" height="16"><span style="opacity:.5">⋮</span></div>`;
    const menuRow = (bg: string, fg: string) => `<div style="width:320px;background:${bg};color:${fg};border-radius:12px;padding:10px 6px;box-shadow:0 6px 24px #0003"><div style="font-size:12px;opacity:.6;padding:4px 12px 8px">Extensions</div><div style="display:flex;align-items:center;gap:12px;padding:8px 12px"><img src="${icon()}" width="16" height="16"><span style="font-size:13px">${NAME}</span><span style="margin-left:auto;opacity:.5">📌</span></div></div>`;
    await shoot(sheet, `<section style="padding:34px 40px;background:#E9E7E1;display:grid;gap:16px">
        <h2 style="font:500 12px ${STACK};letter-spacing:.14em;color:#6A6F82">TOOLBAR AND EXTENSION ICON</h2>
        ${toolbar('#ffffff', '#1f2330', 'Light toolbar · 16 px')}${toolbar('#2b2c30', '#e8eaed', 'Dark toolbar · 16 px')}
        <div style="display:flex;gap:18px;align-items:flex-start">${menuRow('#ffffff', '#1f2330')}${menuRow('#2b2c30', '#e8eaed')}
          <div style="display:flex;align-items:flex-end;gap:16px;background:#fff;padding:16px 20px;border-radius:12px">${[16, 32, 48, 128].map(s => `<img src="${icon()}" width="${s}" height="${s}">`).join('')}</div></div>
      </section>`, '13-toolbar-icon.png', 1100);

    const sentence = 'A calm, personal new tab: Spaces for everything you do online, one search box, and a command center.';
    const letter = (n: string, c: string) => `<div style="flex:none;width:48px;height:48px;border-radius:11px;background:${c};color:#fff;font:700 22px/48px ${STACK};text-align:center">${n[0]}</div>`;
    const card = (ic: string, title: string, sub: string, rating: string, text: string) => `<div style="display:flex;gap:14px;padding:16px;border:1px solid #e3e5ea;border-radius:14px;background:#fff">${ic}<div style="min-width:0"><div style="font:600 15px/1.25 ${STACK};color:#1f2330">${title}</div><div style="font-size:12px;color:#6b7080;margin-top:2px">${sub}</div><div style="font-size:12px;color:#6b7080;margin-top:5px">${rating}</div><div style="font-size:12.5px;line-height:1.4;color:#3a3f52;margin-top:6px">${text}</div></div></div>`;
    const neighbours: [string, string, string, string][] = [
        ['Start Page Plus', '#2f7df6', 'Speed dial, weather and to-do on every new tab.', '4.6 ★ (2.1K)'],
        ['QuickDial New Tab', '#19a974', 'Visual bookmarks and wallpapers for your new tab page.', '4.4 ★ (870)'],
        ['Minimal Tab', '#111318', 'A clean new tab with clock, quotes and focus mode.', '4.7 ★ (5.3K)'],
        ['Bookmark Board', '#e8590c', 'Organize bookmarks into boards. Sync across devices.', '4.2 ★ (410)'],
        ['Tab Dashboard Pro', '#7048e8', 'Widgets, notes and tab manager in one dashboard.', '4.5 ★ (1.4K)'],
    ];
    const cards = neighbours.map(([n, c, t, r]) => card(letter(n, c), n, 'Productivity', r, t));
    cards.splice(1, 0, card(`<img src="${icon()}" width="48" height="48" style="flex:none">`, `${NAME} — ${DESCRIPTOR}`, DESCRIPTOR, '☆☆☆☆☆ No ratings yet', sentence));
    await shoot(sheet, `<div style="width:1180px;background:#f6f7f9;padding:26px 30px 30px"><div style="font-size:12px;color:#6b7080">Extension store · mock search results · neighbours are invented</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px">${cards.join('')}</div></div>`, '14-store-card.png', 1180);

    await shoot(sheet, `<div style="width:1280px;background:#fff;color:#1f2330;padding:34px 48px 40px">
        <div style="font-size:12px;color:#6b7080;margin-bottom:26px">Extension store · mock listing · not published</div>
        <div style="display:flex;gap:22px;align-items:center"><img src="${icon()}" width="72" height="72"><div style="flex:1"><h1 style="font:600 30px/1.2 ${STACK};letter-spacing:-.01em">${NAME} — ${DESCRIPTOR}</h1><div style="margin-top:8px;font-size:13.5px;color:#6b7080">☆☆☆☆☆ No ratings yet · usesenuma.com (concept address, not owned)</div></div><div style="background:#1a56db;color:#fff;font:600 14px ${STACK};padding:11px 22px;border-radius:22px">Add to browser</div></div>
        <img src="${png(join(OUT, 'raw', 'home.png'))}" width="1184" style="display:block;margin-top:28px;border-radius:14px">
        <p style="font-size:20px;margin-top:26px;color:#3a3f52">${TAGLINE}</p>
        <p style="font-size:14.5px;line-height:1.55;margin-top:10px;max-width:780px;color:#3a3f52">${sentence} Everything stays on your device. No account, no analytics.</p></div>`, '15-store-hero.png', 1280);

    await shoot(sheet, `<div style="width:1440px;background:radial-gradient(120% 90% at 50% 0%,#1a1d3a 0%,#0b0d1a 60%);color:#EEF0F7;padding:0 0 70px">
        <nav style="display:flex;align-items:center;gap:12px;padding:26px 64px"><img src="${icon()}" width="28" height="28">${wordmark(22, '#EEF0F7')}<span style="margin-left:auto;font-size:14px;color:#B9BDCF">Features&nbsp;&nbsp;&nbsp;&nbsp;Privacy&nbsp;&nbsp;&nbsp;&nbsp;Help</span><span style="margin-left:26px;background:#F4BE8A;color:${INK};font:600 14px ${STACK};padding:10px 18px;border-radius:20px">Add to Chrome</span></nav>
        <div style="text-align:center;padding:64px 0 46px"><h1 style="font:600 64px/1.05 ${STACK};letter-spacing:-.03em">${SECONDARY}</h1><p style="font:400 21px/1.5 ${STACK};color:#B9BDCF;margin-top:20px">${NAME} is a new tab workspace: Spaces for everything you do online,<br>one search box, and a look that is yours.</p>
          <div style="margin-top:30px"><span style="background:#F4BE8A;color:${INK};font:600 16px ${STACK};padding:14px 26px;border-radius:26px">${TAGLINE}</span></div>
          <div style="margin-top:22px;font-size:13px;color:#8B90A6">On your device. No account, no analytics.</div></div>
        <img src="${png(join(OUT, 'raw', 'home.png'))}" width="1180" style="display:block;margin:0 auto;border-radius:18px;box-shadow:0 40px 120px #000a">
        <div style="text-align:center;margin-top:26px;font-size:12px;color:#8B90A6">Landing-page concept · usesenuma.com is a concept address, not owned · copy not final</div></div>`, '16-landing-hero.png', 1440);

    const family = ['Spaces', 'Sync', 'Themes', 'Mobile', 'Pro'];
    await shoot(sheet, `<section style="padding:40px 48px;background:#0B0E1A;color:#EEF0F7">
        <div style="display:flex;align-items:center;gap:14px"><img src="${icon()}" width="44" height="44">${wordmark(36, '#EEF0F7')}</div>
        <p style="font:400 22px/1.3 ${STACK};margin-top:14px;color:#C9CCDA">${TAGLINE}</p><p style="font:400 22px/1.3 ${STACK};margin-top:6px;color:#C9CCDA">${SECONDARY}</p>
        <div style="margin-top:30px;font:600 22px ${STACK}">${NAME} — ${DESCRIPTOR}</div>
        <div style="margin-top:30px;font-size:11px;letter-spacing:.14em;color:#8B90A6">FAMILY NAMING TEST · not products, not commitments</div>
        <div style="display:flex;flex-wrap:wrap;gap:12px 28px;margin-top:12px">${family.map(f => `<span style="font:600 20px ${STACK};letter-spacing:-.01em">${NAME} <span style="opacity:.6;font-weight:400">${f}</span></span>`).join('')}</div></section>`, '17-copy-family.png', 1100);

    const files = readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
    writeFileSync(join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Senuma — local brand direction</title><body style="background:#111;color:#ddd;font-family:system-ui;padding:24px"><h1>Senuma — local brand direction (not published)</h1>${files.map(f => `<h3>${f}</h3><img src="${f}" style="max-width:100%;border:1px solid #333">`).join('')}`);
    await tools.close();
}

const stage = process.argv[2];
if (stage === 'icons') await icons();
else if (stage === 'apply') await apply();
else { await icons(); await apply(); }
process.exit(0);

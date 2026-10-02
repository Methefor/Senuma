/**
 * Brand prototype: SENUMA vs AVLUNA on the real product. Local only.
 *
 *   npx vite-node e2e/brand-proto.ts sheets     wordmark and icon exploration
 *   npx vite-node e2e/brand-proto.ts product    the same screens, branded twice
 *
 * Nothing in src/ or dist/ is changed. Each brand gets a throw-away copy of the built
 * extension (proto/brand/<brand>/ext) with the display name and icons swapped, and every
 * screen is captured from that copy with identical data, theme and wallpaper.
 * Output: proto/brand/*.png and proto/brand/index.html (git-ignored).
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

const OUT = resolve('proto/brand');
mkdirSync(OUT, { recursive: true });
const STACK = `'Segoe UI Variable Display','Segoe UI',-apple-system,'SF Pro Display',system-ui,sans-serif`;
const TAGLINE = 'Make the browser yours.';
const SECONDARY = 'Your place on the web.';

interface Brand {
    slug: 'senuma' | 'avluna';
    name: string;
    domain: string;
    /** Tile background and mark colours. */
    tile: string;
    icons: { id: string; label: string; mark: string }[];
    chosen: string;
    wordmark: { weight: number; tracking: string };
}

const INK = '#EEF0F7';
const ACCENT = '#F4BE8A';
const BRANDS: Brand[] = [
    {
        slug: 'senuma', name: 'Senuma', domain: 'usesenuma.com',
        tile: '<rect width="128" height="128" rx="28" fill="#0E1220"/>',
        icons: [
            { id: 's-letter', label: 'S (two hooks)', mark: `<g fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"><path d="M88 36H48v24h24"/><path d="M40 92h40V68H56"/></g>` },
            { id: 's-se', label: 'se', mark: `<text x="64" y="86" text-anchor="middle" font-family="${STACK.replace(/"/g, '')}" font-weight="700" font-size="66" letter-spacing="-3" fill="${INK}">se</text>` },
            { id: 's-space', label: 'Space with an entry', mark: `<rect x="31" y="31" width="66" height="66" rx="15" fill="none" stroke="${INK}" stroke-width="11"/><rect x="88" y="64" width="18" height="24" fill="#0E1220"/><rect x="47" y="59" width="24" height="24" rx="6" fill="${ACCENT}"/>` },
        ],
        chosen: 's-letter',
        wordmark: { weight: 600, tracking: '-0.015em' },
    },
    {
        slug: 'avluna', name: 'Avluna', domain: 'useavluna.com',
        tile: '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#15183A"/><stop offset=".62" stop-color="#3B2553"/><stop offset="1" stop-color="#B86A5C"/></linearGradient><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE9CF"/><stop offset="1" stop-color="#F4BE8A"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#g)"/>',
        icons: [
            { id: 'a-letter', label: 'A (open peak)', mark: `<path d="M36 96L64 32l28 64" fill="none" stroke="#FFF4E8" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><circle cx="64" cy="84" r="7" fill="${ACCENT}"/>` },
            { id: 'a-av', label: 'AV', mark: `<g fill="none" stroke="#FFF4E8" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"><path d="M18 90l22-52 22 52"/><path d="M66 38l22 52 22-52"/></g>` },
            { id: 'a-portal', label: 'Portal (nested arches)', mark: `<path d="M30 102V62a34 34 0 0 1 68 0v40" fill="none" stroke="#FFF4E8" stroke-width="10" stroke-linecap="round"/><path d="M49 102V66a15 15 0 0 1 30 0v36z" fill="url(#d)"/>` },
        ],
        chosen: 'a-portal',
        wordmark: { weight: 500, tracking: '0.005em' },
    },
];

const svg = (brand: Brand, id: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${brand.tile}${brand.icons.find(i => i.id === id)!.mark}</svg>`;
const dataUri = (brand: Brand, id = brand.chosen) => `data:image/svg+xml;base64,${Buffer.from(svg(brand, id)).toString('base64')}`;
const png = (file: string) => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

async function shoot(page: Page, html: string, file: string, width: number, height?: number): Promise<void> {
    await page.setViewportSize({ width, height: height ?? 800 });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box;margin:0}body{font-family:${STACK};-webkit-font-smoothing:antialiased}</style>${html}`);
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(OUT, file), fullPage: !height });
    console.log(file);
}

// ---------- 1. Sheets: wordmarks and icons ----------

async function sheets(): Promise<void> {
    const browser = await chromium.launch();
    const page = await browser.newPage({ deviceScaleFactor: 2 });

    const forms = (b: Brand) => [b.name.toLowerCase(), b.name, b.name.toUpperCase()];
    const weights = [400, 500, 600, 700];
    const wordmarks = BRANDS.map(b => `
        <section style="padding:36px 44px;background:#0B0E1A;color:${INK}">
          <h2 style="font:500 12px ${STACK};letter-spacing:.14em;color:#8B90A6;margin-bottom:22px">${b.name.toUpperCase()} · WORDMARK · system type stack</h2>
          <div style="display:grid;grid-template-columns:90px repeat(3,1fr);gap:18px 28px;align-items:baseline">
            <span></span><span style="font-size:11px;color:#8B90A6">lowercase</span><span style="font-size:11px;color:#8B90A6">Title Case</span><span style="font-size:11px;color:#8B90A6">UPPERCASE (+0.16em)</span>
            ${weights.map(w => `<span style="font-size:11px;color:#8B90A6">weight ${w}</span>${forms(b).map((f, i) => `<span style="font:${w} 46px/1 ${STACK};letter-spacing:${i === 2 ? '.16em' : '-.015em'}">${f}</span>`).join('')}`).join('')}
          </div>
          <div style="display:flex;gap:56px;margin-top:38px;padding-top:28px;border-top:1px solid #222741;flex-wrap:wrap">
            ${[['tight −0.03em', '-.03em'], ['normal', '0'], ['open +0.04em', '.04em']].map(([l, t]) => `<div><div style="font-size:11px;color:#8B90A6;margin-bottom:8px">spacing ${l}</div><div style="font:600 34px/1 ${STACK};letter-spacing:${t}">${b.name.toLowerCase()}</div></div>`).join('')}
            <div><div style="font-size:11px;color:#8B90A6;margin-bottom:8px">on light</div><div style="font:600 34px/1 ${STACK};letter-spacing:-.015em;background:#F3F1EC;color:#14161F;padding:8px 16px;border-radius:8px">${b.name.toLowerCase()}</div></div>
          </div>
        </section>`).join('<div style="height:2px;background:#000"></div>');
    await shoot(page, wordmarks, '01-wordmarks.png', 1280);

    const sizes = [16, 32, 48, 128];
    const icons = BRANDS.map(b => `
        <section style="padding:32px 44px;background:#F3F1EC;color:#14161F">
          <h2 style="font:500 12px ${STACK};letter-spacing:.14em;color:#6A6F82;margin-bottom:20px">${b.name.toUpperCase()} · ICON DIRECTIONS · actual pixel sizes 16 / 32 / 48 / 128</h2>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:28px">
            ${b.icons.map(i => `<div>
                <div style="font:600 13px ${STACK};margin-bottom:12px">${i.label}${i.id === b.chosen ? ' · used in mockups' : ''}</div>
                <div style="display:flex;align-items:flex-end;gap:16px;padding:18px;background:#fff;border-radius:12px">${sizes.map(s => `<img src="${dataUri(b, i.id)}" width="${s}" height="${s}">`).join('')}</div>
                <div style="display:flex;align-items:flex-end;gap:16px;padding:18px;background:#202124;border-radius:12px;margin-top:8px">${sizes.slice(0, 3).map(s => `<img src="${dataUri(b, i.id)}" width="${s}" height="${s}">`).join('')}<span style="color:#9aa0a6;font-size:11px;margin-left:8px">on a dark toolbar</span></div>
              </div>`).join('')}
          </div>
        </section>`).join('<div style="height:2px;background:#ddd"></div>');
    await shoot(page, icons, '02-icons.png', 1280);

    // The same icons at true 16 px, enlarged 8× without smoothing: what the toolbar really gets.
    const tiny = `<section style="padding:28px 44px;background:#fff;color:#14161F"><h2 style="font:500 12px ${STACK};letter-spacing:.14em;color:#6A6F82;margin-bottom:18px">16 PX RENDERINGS, ENLARGED 8× (no smoothing)</h2><div style="display:flex;gap:26px;flex-wrap:wrap">${BRANDS.flatMap(b => b.icons.map(i => `<figure style="text-align:center"><canvas data-src="${dataUri(b, i.id)}" width="16" height="16" style="width:128px;height:128px;image-rendering:pixelated;border-radius:6px"></canvas><figcaption style="font-size:11px;margin-top:6px">${b.name} · ${i.label}</figcaption></figure>`)).join('')}</div></section>`;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{font-family:${STACK}}</style>${tiny}`);
    await page.evaluate(async () => {
        for (const canvas of document.querySelectorAll('canvas')) {
            const image = new Image();
            image.src = canvas.dataset.src!;
            await image.decode();
            canvas.getContext('2d')!.drawImage(image, 0, 0, 16, 16);
        }
    });
    await page.screenshot({ path: join(OUT, '03-icons-16px.png'), fullPage: true });
    console.log('03-icons-16px.png');
    await browser.close();
}

// ---------- 2. Product: identical screens, two brands ----------

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
    // Same theme and the same packaged photograph for both brands.
    return { ...state, onboarded: true, updatedAt: now, prefs: { ...state.prefs, themeId: 'dusk', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'mountain-mirror' }, dim: 0.43 } } };
}

async function buildExtension(brand: Brand, render: Page): Promise<string> {
    const dir = join(OUT, brand.slug, 'ext');
    rmSync(dir, { recursive: true, force: true });
    cpSync(DIST, dir, { recursive: true });
    for (const file of readdirSync(join(dir, 'assets')).filter(f => /^newtab-.*\.js$/.test(f))) {
        const path = join(dir, 'assets', file);
        writeFileSync(path, readFileSync(path, 'utf8').replaceAll('Browser OS', brand.name));
    }
    for (const size of [16, 48, 128]) {
        await render.setViewportSize({ width: size, height: size });
        await render.setContent(`<body style="margin:0;background:transparent"><img src="${dataUri(brand)}" width="${size}" height="${size}" style="display:block">`);
        await render.screenshot({ path: join(dir, 'icons', `icon${size}.png`), omitBackground: true });
    }
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ ...manifest, name: brand.name, short_name: brand.name, action: { ...manifest.action, default_title: brand.name } }, null, 2));
    return dir;
}

/** A neutral browser window around a page capture: the tab and toolbar are where a new-tab brand lives. */
function framed(brand: Brand, shot: string, caption: string): string {
    return `<div style="width:1440px;background:#1f2023;color:#e8eaed">
      <div style="display:flex;align-items:flex-end;height:42px;padding:0 10px;background:#17181b">
        <div style="display:flex;align-items:center;gap:9px;height:34px;padding:0 14px;min-width:230px;background:#2b2c30;border-radius:10px 10px 0 0;font-size:12.5px"><img src="${dataUri(brand)}" width="16" height="16">New Tab<span style="margin-left:auto;opacity:.5">×</span></div>
        <span style="padding:0 14px 9px;opacity:.5">+</span>
      </div>
      <div style="display:flex;align-items:center;gap:12px;height:44px;padding:0 14px;background:#2b2c30">
        <span style="opacity:.45;letter-spacing:10px">←→↻</span>
        <div style="flex:1;height:30px;border-radius:15px;background:#1f2023;display:flex;align-items:center;padding:0 16px;font-size:12.5px;color:#9aa0a6">Search or type a URL</div>
        <img src="${dataUri(brand)}" width="20" height="20" title="${brand.name}"><span style="opacity:.45">⋮</span>
      </div>
      <img src="${png(join(OUT, brand.slug, shot))}" width="1440" style="display:block">
      <div style="padding:9px 16px;font-size:12px;color:#9aa0a6;background:#17181b">${brand.name} · ${caption}</div>
    </div>`;
}

async function product(): Promise<void> {
    const tools = await chromium.launch();
    const render = await tools.newPage();
    const sheet = await tools.newPage({ deviceScaleFactor: 1 });
    const screens = ['home', 'onboarding', 'command', 'customize', 'about'] as const;
    const captions: Record<(typeof screens)[number], string> = {
        home: 'Home (new tab). The page itself carries no brand; the tab and toolbar icon do.',
        onboarding: 'First run. Prototype-only brand lockup added above the first step, same for both.',
        command: 'Command center (Ctrl/Cmd + K).',
        customize: 'Customize panel.',
        about: 'Settings → About.',
    };

    for (const brand of BRANDS) {
        const ext = await buildExtension(brand, render);
        const profile = newProfile();
        const session = await launch(ext, profile);
        const dir = join(OUT, brand.slug);
        const state = demoState();
        const fresh = async (stored?: AppState) => {
            if (stored) await writeStorage(session, { 'bos.state': stored });
            const page = stored ? await openNewTab(session) : await session.context.newPage();
            await page.addStyleTag({ content: '.toasts{display:none}' }).catch(() => undefined);
            return page;
        };

        // Onboarding first, while storage is empty.
        let page = await session.context.newPage();
        await page.goto('chrome://newtab/');
        await page.waitForSelector('.onboarding');
        await page.evaluate(({ icon, name, tagline, stack }) => {
            const lockup = document.createElement('div');
            lockup.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:22px';
            lockup.innerHTML = `<img src="${icon}" width="34" height="34" style="border-radius:9px"><div><div style="font:600 20px/1.1 ${stack};letter-spacing:-.01em">${name}</div><div style="font:400 12.5px/1.3 ${stack};opacity:.62;margin-top:3px">${tagline}</div></div>`;
            document.querySelector('.onboarding')!.prepend(lockup);
        }, { icon: dataUri(brand), name: brand.name, tagline: TAGLINE, stack: STACK });
        await page.waitForTimeout(900);
        await page.screenshot({ path: join(dir, 'onboarding.png') });
        await page.close();

        page = await fresh(state);
        await page.waitForSelector('.backdrop-photo.is-ready');
        await page.waitForTimeout(1500);
        await page.screenshot({ path: join(dir, 'home.png') });

        await page.locator('body').click({ position: { x: 6, y: 400 } });
        await page.keyboard.press('Control+k');
        await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
        await page.keyboard.type('git');
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(dir, 'command.png') });
        await page.keyboard.press('Escape');
        await page.keyboard.press('Escape');

        await page.locator('.topbar button[aria-label="Customize"]').click();
        await page.waitForSelector('.overlay-customize');
        await page.waitForTimeout(800);
        await page.screenshot({ path: join(dir, 'customize.png') });
        await page.keyboard.press('Escape');

        await page.locator('.topbar button[aria-label="Settings"]').click();
        await page.locator('.settings-nav button', { hasText: 'About' }).click();
        await page.waitForTimeout(600);
        await page.screenshot({ path: join(dir, 'about.png') });
        await page.close();
        await session.context.close();
        removeProfile(profile);

        for (const screen of screens) await shoot(sheet, framed(brand, `${screen}.png`, captions[screen]), `${brand.slug}-${screen}.png`, 1440);
    }

    // Side by side, one sheet per screen.
    for (const screen of screens) {
        const pair = `<div style="display:flex;gap:16px;background:#000;padding:16px">${BRANDS.map(b => `<img src="${png(join(OUT, `${b.slug}-${screen}.png`))}" width="1000">`).join('')}</div>`;
        await shoot(sheet, pair, `10-compare-${screen}.png`, 2048);
    }

    // ----- Store listing and search card (a neutral mock; not a copy of any store's branding) -----
    const stars = '<span style="color:#c9ccd3;letter-spacing:2px">★★★★★</span> <span style="color:#6b7080">No ratings yet</span>';
    const sentence = 'A calm, personal new tab: Spaces for everything you do online, one search box, and a command center.';
    const listing = (b: Brand, title: string) => `
      <div style="width:1280px;background:#fff;color:#1f2330;padding:34px 48px 40px">
        <div style="font-size:12px;color:#6b7080;margin-bottom:26px">Extension store · mock listing · not published</div>
        <div style="display:flex;gap:22px;align-items:center">
          <img src="${dataUri(b)}" width="72" height="72">
          <div style="flex:1"><h1 style="font:600 30px/1.2 ${STACK};letter-spacing:-.01em">${title}</h1>
            <div style="margin-top:8px;font-size:13.5px">${stars} · <span style="color:#6b7080">${b.domain} (concept address, not owned)</span></div></div>
          <div style="background:#1a56db;color:#fff;font:600 14px ${STACK};padding:11px 22px;border-radius:22px">Add to browser</div>
        </div>
        <img src="${png(join(OUT, b.slug, 'home.png'))}" width="1184" style="display:block;margin-top:28px;border-radius:14px">
        <h2 style="font:600 17px ${STACK};margin-top:28px">${b.name}</h2>
        <p style="font-size:20px;margin-top:6px;color:#3a3f52">${TAGLINE}</p>
        <p style="font-size:14.5px;line-height:1.55;margin-top:10px;max-width:780px;color:#3a3f52">${sentence} Everything stays on your device. No account, no analytics.</p>
      </div>`;
    for (const b of BRANDS) await shoot(sheet, listing(b, `${b.name} — New Tab Workspace`), `${b.slug}-store-listing.png`, 1280);
    await shoot(sheet, `<div style="display:flex;gap:16px;background:#000;padding:16px">${BRANDS.map(b => `<img src="${png(join(OUT, `${b.slug}-store-listing.png`))}" width="1000">`).join('')}</div>`, '11-compare-store-listing.png', 2048);

    // Search-result context: the same invented neighbours for both brands, ours in the same slot.
    const neighbours: [string, string, string, string][] = [
        ['Start Page Plus', '#2f7df6', 'Speed dial, weather and to-do on every new tab.', '4.6 ★ (2.1K)'],
        ['QuickDial New Tab', '#19a974', 'Visual bookmarks and wallpapers for your new tab page.', '4.4 ★ (870)'],
        ['Minimal Tab', '#111318', 'A clean new tab with clock, quotes and focus mode.', '4.7 ★ (5.3K)'],
        ['Bookmark Board', '#e8590c', 'Organize bookmarks into boards. Sync across devices.', '4.2 ★ (410)'],
        ['Tab Dashboard Pro', '#7048e8', 'Widgets, notes and tab manager in one dashboard.', '4.5 ★ (1.4K)'],
    ];
    const card = (icon: string, title: string, descriptor: string, rating: string, text: string, own = false) => `
      <div style="display:flex;gap:14px;padding:16px;border:1px solid #e3e5ea;border-radius:14px;background:#fff">
        ${icon}
        <div style="min-width:0"><div style="font:600 15px/1.25 ${STACK};color:#1f2330">${title}</div>
          <div style="font-size:12px;color:#6b7080;margin-top:2px">${descriptor}</div>
          <div style="font-size:12px;color:${own ? '#9aa0ad' : '#6b7080'};margin-top:5px">${rating}</div>
          <div style="font-size:12.5px;line-height:1.4;color:#3a3f52;margin-top:6px">${text}</div></div>
      </div>`;
    const letter = (name: string, color: string) => `<div style="flex:none;width:48px;height:48px;border-radius:11px;background:${color};color:#fff;font:700 22px/48px ${STACK};text-align:center">${name[0]}</div>`;
    const results = (b: Brand, title: string, descriptor: string) => {
        const cards = neighbours.map(([n, c, t, r]) => card(letter(n, c), n, 'Productivity', r, t));
        cards.splice(1, 0, card(`<img src="${dataUri(b)}" width="48" height="48" style="flex:none">`, title, descriptor, '☆☆☆☆☆ No ratings yet', sentence, true));
        return `<div style="width:1180px;background:#f6f7f9;padding:26px 30px 30px;color:#1f2330">
          <div style="font-size:12px;color:#6b7080;margin-bottom:6px">Extension store · mock search results for “new tab” · neighbours are invented</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:14px">${cards.join('')}</div></div>`;
    };
    for (const b of BRANDS) {
        await shoot(sheet, results(b, `${b.name} — New Tab Workspace`, 'New Tab Workspace') + results(b, `${b.name} — Your New Tab`, 'Your New Tab'), `${b.slug}-store-cards.png`, 1180);
    }
    await shoot(sheet, `<div style="display:flex;flex-direction:column;gap:14px;background:#000;padding:14px">${BRANDS.map(b => `<img src="${png(join(OUT, `${b.slug}-store-cards.png`))}" width="1180">`).join('')}</div>`, '12-compare-store-cards.png', 1208);

    // Taglines, store titles, family names: pure text, same treatment.
    const family = ['Sync', 'Spaces', 'Pro', 'Mobile', 'Themes'];
    const text = `<div style="display:grid;grid-template-columns:1fr 1fr;background:#0B0E1A;color:${INK}">${BRANDS.map(b => `
      <section style="padding:40px 44px;border-right:1px solid #222741">
        <div style="display:flex;align-items:center;gap:14px"><img src="${dataUri(b)}" width="44" height="44"><span style="font:${b.wordmark.weight} 34px/1 ${STACK};letter-spacing:${b.wordmark.tracking}">${b.name}</span></div>
        <p style="font:400 22px/1.3 ${STACK};margin-top:14px;color:#C9CCDA">${TAGLINE}</p>
        <div style="display:flex;align-items:center;gap:14px;margin-top:34px"><img src="${dataUri(b)}" width="44" height="44"><span style="font:${b.wordmark.weight} 34px/1 ${STACK};letter-spacing:${b.wordmark.tracking}">${b.name}</span></div>
        <p style="font:400 22px/1.3 ${STACK};margin-top:14px;color:#C9CCDA">${SECONDARY}</p>
        <div style="margin-top:36px;font:600 22px ${STACK}">${b.name} — New Tab Workspace</div>
        <div style="margin-top:10px;font:600 22px ${STACK}">${b.name} — Your New Tab</div>
        <div style="margin-top:34px;font-size:11px;letter-spacing:.14em;color:#8B90A6">FAMILY TEST (not a commitment)</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px 22px;margin-top:12px">${family.map(f => `<span style="font:${b.wordmark.weight} 19px ${STACK}">${b.name} <span style="opacity:.6;font-weight:400">${f}</span></span>`).join('')}</div>
        <div style="margin-top:30px;font-size:13px;color:#8B90A6">${b.domain} · get${b.slug}.com — concept addresses only, not owned</div>
      </section>`).join('')}</div>`;
    await shoot(sheet, text, '13-compare-copy.png', 1440);

    const files = readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
    writeFileSync(join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>Senuma vs Avluna — local prototype</title><body style="background:#111;color:#ddd;font-family:system-ui;padding:24px"><h1>Senuma vs Avluna — local prototype (not published)</h1>${files.map(f => `<h3>${f}</h3><img src="${f}" style="max-width:100%;border:1px solid #333">`).join('')}`);
    await tools.close();
}

const stage = process.argv[2];
if (stage === 'sheets') await sheets();
else if (stage === 'product') await product();
else { await sheets(); await product(); }
process.exit(0);

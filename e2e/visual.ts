/**
 * Visual review: screenshots of the real extension at the sizes and zoom levels the product
 * must hold up at, with realistic amounts of data, in every theme, with and without a photo.
 *
 *   npm run visual                 → e2e/.out/*.png (all)
 *   npm run visual -- noir photo   → only captures whose name contains one of the words
 *
 * Zoom is emulated the way it behaves in the browser: 125% zoom on a 1366 px window gives the
 * page 1093 CSS px at a device scale of 1.25. These are internal evaluation captures.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { DEFAULT_BACKGROUND } from '../src/core/background';
import { emptyState } from '../src/core/defaults';
import * as ops from '../src/core/ops';
import { applyStarter } from '../src/core/setup';
import type { AppState } from '../src/core/types';
import { en } from '../src/i18n/en';
import { DIST, launch, newProfile, openNewTab, removeProfile, writeStorage } from './harness';

const OUT = 'e2e/.out';
mkdirSync(OUT, { recursive: true });

const names = {
    category: (id: string) => en[`cat.${id}` as keyof typeof en] as string,
    mode: (key: string) => en[`modePreset.${key}` as keyof typeof en] as string,
    otherSpace: 'Bookmarks',
    importedGroup: 'Imported',
};

/** A setup like a real person's: starter Spaces, some of their own, a dock, recent activity. */
function setup(categories: string[], extraSpaces: number, themeId: string): AppState {
    let state = applyStarter(emptyState(), categories, names);
    const extras = ['Side project', 'Travel', 'Home renovation', 'Reading list', 'Client · Acme', 'Client · Northwind', 'Fitness', 'Recipes', 'Taxes 2026', 'Newsletters', 'Garden'];
    for (let i = 0; i < extraSpaces; i++) {
        const created = ops.addSpace(state, { name: extras[i % extras.length]!, glyph: ['code', 'globe', 'folder', 'book', 'briefcase'][i % 5]! });
        state = created.state;
        for (let j = 0; j < 6; j++) state = ops.addItem(state, created.id, null, { url: `https://example-${i}-${j}.com`, title: `Resource ${j + 1}` }).state;
    }
    const byTitle = (title: string) => Object.values(state.items).find(item => item.title === title);
    const now = Date.now();
    ['Claude', 'GitHub', 'Gmail', 'YouTube', 'Spotify', 'Figma'].forEach((title, index) => {
        const item = byTitle(title);
        if (!item) return;
        state = ops.toggleDock(state, { kind: 'item', id: item.id });
        state = ops.recordRecent(state, { url: item.url, title: item.title, spaceId: ops.locateItem(state, item.id)?.spaceId });
        state = { ...state, recents: state.recents.map(r => (r.url === item.url ? { ...r, at: now - (index * 47 + 3) * 60_000 } : r)) };
    });
    const work = state.spaceOrder.find(id => state.spaces[id]!.templateId === 'work');
    if (work) {
        state = ops.toggleDock(state, { kind: 'space', id: work });
        state = ops.updateSpace(state, work, { note: 'Acme · Q4 launch' });
    }
    return { ...state, onboarded: true, updatedAt: now, prefs: { ...state.prefs, themeId } };
}

const withTheme = (state: AppState, themeId: string): AppState => ({ ...state, prefs: { ...state.prefs, themeId } });

/** Gives the Dev and Chill Modes their own looks and activates one of them. */
function withModeLooks(state: AppState, active: 'Dev' | 'Chill'): AppState {
    let next = state;
    for (const id of next.modeOrder) {
        const mode = next.modes[id]!;
        if (mode.name === 'Dev') next = ops.updateMode(next, id, { themeId: 'phosphor', providerId: 'github', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'ink' }, dim: 0.06 } });
        if (mode.name === 'Chill') next = ops.updateMode(next, id, { themeId: 'atelier', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'ember' }, dim: 0.08 } });
    }
    const target = next.modeOrder.find(id => next.modes[id]!.name === active)!;
    return { ...ops.setActiveMode(next, target), updatedAt: Date.now() };
}

/** Draws a photo-like picture in the page, saves it, and applies it through Customize. */
async function applyPhoto(page: Page, dir: string, bright: boolean): Promise<void> {
    const dataUrl = await page.evaluate(isBright => {
        const canvas = document.createElement('canvas');
        canvas.width = 2880;
        canvas.height = 1620;
        const c = canvas.getContext('2d')!;
        const sky = c.createLinearGradient(0, 0, 0, 1620);
        if (isBright) {
            sky.addColorStop(0, '#bfe0f5');
            sky.addColorStop(0.55, '#fdf1dc');
            sky.addColorStop(1, '#f3c9a0');
        } else {
            sky.addColorStop(0, '#0b1730');
            sky.addColorStop(0.6, '#3b2a55');
            sky.addColorStop(1, '#e0865a');
        }
        c.fillStyle = sky;
        c.fillRect(0, 0, 2880, 1620);
        // Sun, haze and three ridgelines: enough structure to behave like a landscape photo.
        const sun = c.createRadialGradient(1950, 980, 10, 1950, 980, 520);
        sun.addColorStop(0, isBright ? 'rgba(255,255,255,.95)' : 'rgba(255,214,160,.9)');
        sun.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sun;
        c.fillRect(0, 0, 2880, 1620);
        const ridges = isBright ? ['#c9d9c2', '#9fbfa6', '#6f9c86'] : ['#2a2146', '#1a1632', '#0c0c1c'];
        ridges.forEach((colour, layer) => {
            c.fillStyle = colour;
            c.beginPath();
            c.moveTo(0, 1620);
            for (let x = 0; x <= 2880; x += 40) {
                c.lineTo(x, 1080 + layer * 150 + Math.sin(x / (190 - layer * 40) + layer * 2) * (90 - layer * 20) + Math.sin(x / 61 + layer) * 22);
            }
            c.lineTo(2880, 1620);
            c.fill();
        });
        return canvas.toDataURL('image/jpeg', 0.9);
    }, bright);
    const file = join(dir, bright ? 'bright.jpg' : 'dark.jpg');
    writeFileSync(file, Buffer.from(dataUrl.split(',')[1]!, 'base64'));
    await page.locator('.topbar button[aria-label="Customize"]').click();
    await page.locator('.overlay-customize input[type=file]').setInputFiles(file);
    await page.locator('.backdrop-photo.is-ready').waitFor({ timeout: 15_000 });
    await page.locator('.customize-foot .button.is-primary').click();
    await page.waitForSelector('.overlay-customize', { state: 'detached' });
    await page.waitForTimeout(600);
}

interface Shot {
    name: string;
    width: number;
    height: number;
    scale?: number;
    state: AppState;
    /** Runs after Home is ready, e.g. to open a panel. `dir` is a scratch folder. */
    prepare?: (page: Page, dir: string) => Promise<void>;
}

const everyday = ['ai', 'dev', 'work', 'entertainment', 'gaming'];
const small = setup(everyday, 0, 'dusk');
const large = setup(['ai', 'dev', 'research', 'work', 'design', 'entertainment', 'gaming', 'finance', 'social', 'study'], 10, 'dusk');
const links = (state: AppState) => Object.keys(state.items).length;
console.log(`small: ${small.spaceOrder.length} Spaces / ${links(small)} links · large: ${large.spaceOrder.length} Spaces / ${links(large)} links`);

const D = { width: 1440, height: 900 };
const shots: Shot[] = [
    // Every theme, no wallpaper
    { name: '01-home-dusk', ...D, state: small },
    { name: '02-home-noir', ...D, state: withTheme(small, 'noir') },
    { name: '03-home-atelier', ...D, state: withTheme(small, 'atelier') },
    { name: '04-home-fjord', ...D, state: withTheme(small, 'fjord') },
    { name: '05-home-editorial', ...D, state: withTheme(small, 'editorial') },
    { name: '06-home-phosphor', ...D, state: withTheme(small, 'phosphor') },
    // Sizes and zoom
    { name: '07-size-1366-20spaces', width: 1366, height: 768, state: large },
    { name: '08-size-1920-20spaces', width: 1920, height: 1080, state: large },
    { name: '09-size-ultrawide', width: 2560, height: 1080, state: small },
    { name: '10-zoom-125', width: 1093, height: 614, scale: 1.25, state: small },
    { name: '11-zoom-150-20spaces', width: 911, height: 512, scale: 1.5, state: large },
    // Modes
    { name: '12-mode-dev', ...D, state: withModeLooks(small, 'Dev') },
    { name: '13-mode-chill', ...D, state: withModeLooks(small, 'Chill') },
    // Panels
    { name: '14-space-view', ...D, state: small, prepare: async page => { await page.locator('.plate', { hasText: 'Coding' }).click(); await page.waitForSelector('.overlay-space'); } },
    {
        name: '15-space-empty', ...D, state: ops.addSpace(small, { name: 'Design', glyph: 'pen', accent: '#D97BA6' }).state,
        prepare: async page => { await page.locator('.plate', { hasText: 'Design' }).click(); await page.waitForSelector('.overlay-space'); },
    },
    {
        name: '16-command-center', ...D, state: small,
        prepare: async page => { await page.keyboard.press('Control+k'); await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette')); await page.keyboard.type('dev'); },
    },
    {
        name: '17-customize', ...D, state: small,
        prepare: async page => {
            await page.locator('.topbar button[aria-label="Customize"]').click();
            await page.waitForSelector('.overlay-customize');
            await page.locator('.swatch-tile[aria-label="Aurora"]').click();
        },
    },
    {
        name: '18-mode-editor', ...D, state: withModeLooks(small, 'Dev'),
        prepare: async page => {
            await page.locator('.topbar button[aria-label="Settings"]').click();
            await page.locator('.settings-nav button', { hasText: 'Modes' }).click();
        },
    },
    // Personal photos
    { name: '19-photo-dark-dusk', ...D, state: small, prepare: (page, dir) => applyPhoto(page, dir, false) },
    { name: '20-photo-bright-dusk', ...D, state: small, prepare: (page, dir) => applyPhoto(page, dir, true) },
    { name: '21-photo-bright-fjord', ...D, state: withTheme(small, 'fjord'), prepare: (page, dir) => applyPhoto(page, dir, true) },
    { name: '22-photo-20spaces-noir', width: 1366, height: 768, state: withTheme(large, 'noir'), prepare: (page, dir) => applyPhoto(page, dir, false) },
    {
        name: '23-search-focus', ...D, state: small,
        prepare: async page => { await page.locator('#home-search').fill('y lofi beats'); },
    },
    {
        name: '24-onboarding-look', ...D, state: emptyState(),
        prepare: async page => {
            await page.locator('.interest', { hasText: 'AI' }).click();
            await page.locator('.interest', { hasText: 'Media' }).click();
            await page.locator('.onboarding .button.is-primary').click();
        },
    },
];

const only = process.argv.slice(2);
for (const shot of shots) {
    if (only.length && !only.some(word => shot.name.includes(word))) continue;
    const profile = newProfile();
    const session = await launch(DIST, profile, { width: shot.width, height: shot.height });
    if (shot.state.updatedAt) await writeStorage(session, { 'bos.state': shot.state });
    await session.context.close();
    // Relaunch at the wanted scale so the saved state is what the first tab paints.
    const context = await chromium.launchPersistentContext(profile, {
        channel: 'chromium', headless: true, locale: 'en-US',
        viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: shot.scale ?? 1,
        args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    const page = await openNewTab({ ...session, context });
    await shot.prepare?.(page, profile);
    // Confirmation toasts are transient; keep them out of evaluation captures.
    await page.addStyleTag({ content: '.toasts { display: none }' });
    // Let icons settle; they are the only thing that arrives after first paint.
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${shot.name}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log(`${shot.name}.png  ${shot.width}×${shot.height}${shot.scale ? ` @${shot.scale}x` : ''}${overflow ? '  HORIZONTAL OVERFLOW' : ''}`);
    await context.close();
    removeProfile(profile);
}
process.exit(0);

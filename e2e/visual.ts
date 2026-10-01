/**
 * Visual review: screenshots of the real extension at the sizes and zoom levels the product
 * must hold up at, with realistic amounts of data.
 *
 *   npm run visual            → e2e/.out/*.png
 *
 * Zoom is emulated the way it behaves in the browser: 125% zoom on a 1366 px window gives the
 * page 1093 CSS px at a device scale of 1.25.
 */
import { mkdirSync } from 'node:fs';
import { emptyState } from '../src/core/defaults';
import * as ops from '../src/core/ops';
import { applyStarter } from '../src/core/setup';
import { THEMES } from '../src/core/themes';
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

/** A setup like a real user's: `spaces` Spaces, a dock, recent activity. */
function setup(categories: string[], extraSpaces: number, themeId: string): AppState {
    let state = applyStarter(emptyState(), categories, names);
    const extras = ['Side project', 'Travel', 'Home renovation', 'Reading list', 'Client · Acme', 'Client · Northwind', 'Fitness', 'Recipes', 'Taxes 2026', 'Newsletters'];
    for (let i = 0; i < extraSpaces; i++) {
        const created = ops.addSpace(state, { name: extras[i % extras.length]!, glyph: ['code', 'globe', 'folder', 'book', 'briefcase'][i % 5]! });
        state = created.state;
        for (let j = 0; j < 6; j++) state = ops.addItem(state, created.id, null, { url: `https://example-${i}-${j}.com`, title: `Resource ${j + 1}` }).state;
    }
    const byTitle = (title: string) => Object.values(state.items).find(item => item.title === title);
    for (const title of ['Claude', 'GitHub', 'Gmail', 'YouTube', 'Spotify']) {
        const item = byTitle(title);
        if (item) {
            state = ops.toggleDock(state, { kind: 'item', id: item.id });
            state = ops.recordRecent(state, { url: item.url, title: item.title, spaceId: ops.locateItem(state, item.id)?.spaceId });
        }
    }
    return { ...state, onboarded: true, updatedAt: Date.now(), prefs: { ...state.prefs, themeId } };
}

interface Shot {
    name: string;
    width: number;
    height: number;
    scale?: number;
    state: AppState;
    /** Runs after Home is ready, e.g. to open a panel. */
    prepare?: (page: import('playwright').Page) => Promise<void>;
}

const small = setup(['ai', 'dev', 'work', 'entertainment'], 0, 'dusk');
const large = setup(['ai', 'dev', 'research', 'work', 'design', 'entertainment', 'music', 'gaming', 'finance', 'social', 'study'], 9, 'dusk');
const links = (state: AppState) => Object.keys(state.items).length;
console.log(`small: ${small.spaceOrder.length} Spaces / ${links(small)} links · large: ${large.spaceOrder.length} Spaces / ${links(large)} links`);

const shots: Shot[] = [
    { name: 'home-4-1440', width: 1440, height: 900, state: small },
    { name: 'home-4-1366', width: 1366, height: 768, state: small },
    { name: 'home-20-1366', width: 1366, height: 768, state: large },
    { name: 'home-20-1920', width: 1920, height: 1080, state: large },
    { name: 'home-4-ultrawide', width: 2560, height: 1080, state: small },
    { name: 'home-4-zoom125', width: 1093, height: 614, scale: 1.25, state: small },
    { name: 'home-20-zoom150', width: 911, height: 512, scale: 1.5, state: large },
    ...THEMES.filter(t => t.id !== 'dusk').map(theme => ({
        name: `theme-${theme.id}`, width: 1440, height: 900, state: { ...small, prefs: { ...small.prefs, themeId: theme.id } },
    })),
    {
        name: 'space-dev', width: 1440, height: 900, state: small,
        prepare: async page => {
            await page.locator('.plate', { hasText: 'Coding' }).click();
        },
    },
    {
        name: 'palette', width: 1440, height: 900, state: small,
        prepare: async page => {
            await page.keyboard.press('Control+k');
            await page.waitForSelector('.overlay-palette');
            await page.keyboard.type('git');
        },
    },
    {
        name: 'settings-modes', width: 1440, height: 900, state: small,
        prepare: async page => {
            await page.locator('.topbar .icon-button').click();
            await page.locator('.settings-nav button', { hasText: 'Modes' }).click();
        },
    },
    {
        name: 'onboarding-look', width: 1440, height: 900, state: emptyState(),
        prepare: async page => {
            await page.locator('.interest', { hasText: 'AI' }).click();
            await page.locator('.interest', { hasText: 'Music' }).click();
            await page.locator('.onboarding .button.is-primary').click();
        },
    },
];

const only = process.argv.slice(2);
for (const shot of shots) {
    if (only.length && !only.some(name => shot.name.includes(name))) continue;
    const profile = newProfile();
    const session = await launch(DIST, profile, { width: shot.width, height: shot.height });
    if (shot.state.updatedAt) await writeStorage(session, { 'bos.state': shot.state });
    await session.context.close();
    // Relaunch at the wanted scale so the saved state is what the first tab paints.
    const { chromium } = await import('playwright');
    const context = await chromium.launchPersistentContext(profile, {
        channel: 'chromium', headless: true, locale: 'en-US',
        viewport: { width: shot.width, height: shot.height }, deviceScaleFactor: shot.scale ?? 1,
        args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
    });
    const page = await openNewTab({ ...session, context });
    await shot.prepare?.(page);
    // Let icons settle; they are the only thing that arrives after first paint.
    await page.waitForTimeout(1800);
    await page.screenshot({ path: `${OUT}/${shot.name}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    console.log(`${shot.name}.png  ${shot.width}×${shot.height}${shot.scale ? ` @${shot.scale}x` : ''}${overflow ? '  HORIZONTAL OVERFLOW' : ''}`);
    await context.close();
    removeProfile(profile);
}
process.exit(0);

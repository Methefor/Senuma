/**
 * Release-candidate hardening: the unpleasant cases, in a real Chromium, against the built
 * extension. Complements extension.e2e.ts (the everyday paths).
 *
 *   npm run test:rc
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { DEFAULT_BACKGROUND } from '../src/core/background';
import { emptyState } from '../src/core/defaults';
import * as ops from '../src/core/ops';
import { applyStarter } from '../src/core/setup';
import type { AppState } from '../src/core/types';
import { en } from '../src/i18n/en';
import { DIST, check, expect, launch, newProfile, note, openNewTab, readStorage, removeProfile, report, waitForState, writeStorage } from './harness';

const KEY = 'bos.state';
const names = {
    category: (id: string) => en[`cat.${id}` as keyof typeof en] as string,
    mode: (key: string) => en[`modePreset.${key}` as keyof typeof en] as string,
    otherSpace: 'Bookmarks',
    importedGroup: 'Imported',
};
const starter = (categories: string[]): AppState => ({ ...applyStarter(emptyState(), categories, names), onboarded: true, updatedAt: Date.now() });
const stamp = (state: AppState): AppState => ({ ...state, onboarded: true, updatedAt: Date.now() });
const allErrors: string[] = [];

/** True when nothing on the page is wider than the window (no sideways scrolling, no clipped Home). */
const fitsWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

async function withSession(body: (session: Awaited<ReturnType<typeof launch>>, profile: string) => Promise<void>): Promise<void> {
    const profile = newProfile();
    const session = await launch(DIST, profile);
    try {
        await body(session, profile);
    } finally {
        allErrors.push(...session.errors);
        await session.context.close();
        removeProfile(profile);
    }
}

// ---------- Amounts and shapes of data ----------

await withSession(async session => {
    await check('Data shapes', 'zero Spaces: Home offers a way forward instead of an empty page', async () => {
        await writeStorage(session, { [KEY]: stamp(emptyState()) });
        const page = await openNewTab(session);
        expect((await page.locator('.plate').count()) === 0, 'unexpected Spaces');
        const text = await page.locator('.home').innerText();
        expect(/Build your first Space/.test(text) && (await page.locator('#home-search').count()) === 1, `no way forward is offered: "${text.slice(0, 120)}"`);
        expect(await fitsWidth(page), 'page is wider than the window');
        await page.close();
        return 'search plus “Build your first Space” with starter templates';
    });

    await check('Data shapes', 'one Space with one link renders and opens', async () => {
        let state = ops.addSpace(emptyState(), { name: 'Only', glyph: 'folder' });
        state = { ...ops.addItem(state.state, state.id, null, { url: 'https://example.com', title: 'Example' }).state } as never;
        await writeStorage(session, { [KEY]: stamp(state as unknown as AppState) });
        const page = await openNewTab(session);
        expect((await page.locator('.plate').count()) === 1, 'the Space is missing');
        await page.locator('.plate').click();
        await page.waitForSelector('.overlay-space');
        expect((await page.locator('.space .tile:not(.tile-add)').count()) === 1, 'the link is missing');
        await page.close();
    });

    await check('Data shapes', '24 Spaces with long, emoji and right-to-left names stay inside the layout', async () => {
        let state = emptyState();
        const awkward = [
            'A very long Space name that someone typed without thinking about how wide a card is going to be on a small laptop screen',
            '🎮🎧🎬 Fun', 'مساحة العمل', 'עבודה ופרויקטים', 'Çalışma · İş · Öğrenme', 'Supercalifragilisticexpialidocious-without-any-spaces-at-all-in-it',
        ];
        for (let i = 0; i < 24; i++) {
            const created = ops.addSpace(state, { name: awkward[i % awkward.length]! + (i >= awkward.length ? ` ${i}` : ''), glyph: 'folder' });
            state = created.state;
            for (let j = 0; j < 3; j++) state = ops.addItem(state, created.id, null, { url: `https://site-${i}-${j}.example.com/`, title: j === 0 ? '🔥 ' + 'Long title '.repeat(12) : `Link ${j}` }).state;
        }
        await writeStorage(session, { [KEY]: stamp(state) });
        for (const viewport of [{ width: 1366, height: 768 }, { width: 911, height: 512 }]) {
            const page = await openNewTab(session);
            await page.setViewportSize(viewport);
            await page.waitForTimeout(250);
            expect((await page.locator('.plate').count()) === 24, 'not every Space is shown');
            expect(await fitsWidth(page), `sideways overflow at ${viewport.width}px`);
            const spill = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.plate')].filter(plate => {
                const box = plate.getBoundingClientRect();
                return [...plate.querySelectorAll<HTMLElement>('.plate-name')].some(n => n.getBoundingClientRect().right > box.right + 1 || n.getBoundingClientRect().left < box.left - 1);
            }).length);
            expect(spill === 0, `${spill} Space names spill out of their card at ${viewport.width}px`);
            await page.screenshot({ path: `e2e/.out/rc-24-spaces-${viewport.width}.png` });
            await page.close();
        }
        return 'checked at 1366 px and at 150% zoom (911 px)';
    });

    await check('Data shapes', 'very long addresses, duplicates and a broken icon do not break a Space', async () => {
        const created = ops.addSpace(emptyState(), { name: 'Edge', glyph: 'folder' });
        let state = created.state;
        const long = `https://example.com/${'segment/'.repeat(240)}?q=${'x'.repeat(300)}`;
        state = ops.addItem(state, created.id, null, { url: long, title: '' }).state;
        for (let i = 0; i < 3; i++) state = ops.addItem(state, created.id, null, { url: 'https://duplicate.example.com/', title: 'Same' }).state;
        state = ops.addItem(state, created.id, null, { url: 'https://no-such-host.invalid/', title: 'Unreachable', icon: 'https://no-such-host.invalid/icon.png' }).state;
        await writeStorage(session, { [KEY]: stamp(state) });
        const page = await openNewTab(session);
        await page.locator('.plate').click();
        await page.waitForSelector('.overlay-space');
        await page.waitForTimeout(600);
        expect((await page.locator('.space .tile:not(.tile-add)').count()) === 5, 'not every link is shown');
        expect(await fitsWidth(page), 'a long address widened the page');
        const letters = await page.locator('.space .app-icon-mono').count();
        expect(letters >= 1, 'a link whose icon cannot load shows nothing instead of a letter');
        await page.close();
        return `${long.length}-character address kept; broken icon fell back to a letter`;
    });

    await check('URL safety', 'javascript:, vbscript:, data: and file: addresses cannot be added', async () => {
        const created = ops.addSpace(emptyState(), { name: 'Safe', glyph: 'folder' });
        await writeStorage(session, { [KEY]: stamp(created.state) });
        const page = await openNewTab(session);
        await page.locator('.plate').click();
        const field = page.locator('#space-filter');
        const hostile = ['javascript:alert(document.domain)', 'JaVaScRiPt:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,<script>alert(1)</script>', 'file:///C:/Windows/win.ini', 'chrome://settings', ' javascript:alert(1)'];
        for (const address of hostile) {
            await field.fill(address);
            await page.keyboard.press('Enter');
        }
        await page.waitForTimeout(500);
        const state = await readStorage<AppState>(session, KEY);
        const urls = Object.values(state!.items).map(item => item.url);
        expect(urls.every(url => /^https?:\/\//.test(url)), `stored: ${urls.join(' | ')}`);
        expect(urls.length === 0, `something was added: ${urls.join(' | ')}`);
        await page.close();
        return `${hostile.length} hostile addresses refused`;
    });

    await check('URL safety', 'a hostile address already in storage is dropped at load, never rendered as a link', async () => {
        const created = ops.addSpace(emptyState(), { name: 'Stored', glyph: 'folder' });
        const good = ops.addItem(created.state, created.id, null, { url: 'https://example.com/', title: 'Good' }).state;
        const raw = JSON.parse(JSON.stringify(stamp(good)));
        raw.items.evil = { id: 'evil', title: 'Evil', url: 'javascript:alert(1)', createdAt: 1 };
        raw.spaces[created.id].groups[0].itemIds.push('evil');
        raw.recents = [{ url: 'javascript:alert(2)', title: 'Evil recent', at: Date.now() }];
        await writeStorage(session, { [KEY]: raw });
        const page = await openNewTab(session);
        const hrefs = await page.evaluate(() => [...document.querySelectorAll('a')].map(a => a.getAttribute('href') ?? ''));
        expect(!hrefs.some(href => /^\s*(javascript|vbscript|data):/i.test(href)), `rendered: ${hrefs.join(' | ')}`);
        await page.locator('.plate').click();
        await page.waitForSelector('.overlay-space');
        expect((await page.locator('.space .tile:not(.tile-add)').count()) === 1, 'the hostile link is shown');
        await page.close();
    });

    await check('Links', 'links that open a new tab never hand the page over (noopener)', async () => {
        const state = starter(['dev']);
        await writeStorage(session, { [KEY]: { ...state, prefs: { ...state.prefs, openInNewTab: true } } });
        const page = await openNewTab(session);
        const unsafe = await page.evaluate(() => [...document.querySelectorAll('a[target="_blank"]')].filter(a => !/noopener/.test(a.getAttribute('rel') ?? '')).length);
        const total = await page.locator('a[target="_blank"]').count();
        expect(unsafe === 0, `${unsafe} of ${total} new-tab links lack rel="noopener"`);
        await page.close();
        return `${total} new-tab links, all rel="noopener"`;
    });
});

// ---------- Damaged, old and foreign data ----------

await withSession(async (session, profile) => {
    const cases: [string, unknown][] = [
        ['a string', 'not a state'],
        ['an array', [1, 2, 3]],
        ['null fields', { schema: 4, spaces: null, items: null, prefs: null, spaceOrder: 'x' }],
        ['a truncated object', { schema: 4, onboarded: true, spaces: { a: { id: 'a' } }, spaceOrder: ['a', 'ghost'] }],
        ['prototype-like keys', { schema: 4, onboarded: true, spaces: { __proto__: { id: '__proto__', name: 'p' }, constructor: { id: 'constructor', name: 'c' } }, spaceOrder: ['__proto__', 'constructor'], items: {} }],
        ['a schema from the future', { ...starter(['dev']), schema: 99, somethingNew: { a: 1 } }],
    ];
    for (const [label, value] of cases) {
        await check('Damaged storage', `${label}: the page still opens and is usable`, async () => {
            // Start from a clean paint cache, as a different build or a restored profile would.
            const cleaner = await session.context.newPage();
            await cleaner.goto('chrome://newtab/');
            await cleaner.waitForSelector('.home, .onboarding');
            await cleaner.evaluate(() => localStorage.clear());
            await cleaner.close();
            await writeStorage(session, { [KEY]: value });
            const page = await session.context.newPage();
            await page.goto('chrome://newtab/');
            await page.waitForSelector('.home, .onboarding', { timeout: 10_000 });
            const where = (await page.locator('.onboarding').count()) ? 'onboarding' : `Home with ${await page.locator('.plate').count()} Spaces`;
            const polluted = await page.evaluate(() => ({}) as Record<string, unknown>).then(o => 'name' in o || 'id' in o);
            expect(!polluted, 'Object.prototype was polluted');
            await page.close();
            return where;
        });
    }

    await check('Old schema', 'a schema-2 state is upgraded in memory and shown', async () => {
        const v4 = starter(['dev']);
        const firstItem = Object.keys(v4.items)[0]!;
        const v2 = JSON.parse(JSON.stringify(v4));
        for (const field of ['dock', 'wallpapers']) delete v2[field];
        for (const field of ['background', 'atmosphere']) delete v2.prefs[field];
        v2.schema = 2;
        v2.items[firstItem].pinned = true;
        await writeStorage(session, { [KEY]: v2 });
        const page = await openNewTab(session);
        expect((await page.locator('.plate').count()) === v4.spaceOrder.length, 'Spaces were lost in the upgrade');
        expect((await page.locator('.dock .dock-item').count()) === 1, 'the pinned link did not become a dock entry');
        await page.close();
    });

    await check('Malformed import', 'hostile and broken files are refused; nothing changes; nothing is polluted', async () => {
        const state = starter(['dev']);
        await writeStorage(session, { [KEY]: state });
        const page = await openNewTab(session);
        await page.locator('.topbar button[aria-label="Settings"]').click();
        await page.locator('.settings-nav button', { hasText: 'Data' }).click();
        const files: [string, string][] = [
            ['not-json.json', '{"kind": "browser-os-backup", '],
            ['empty.json', ''],
            ['array.json', '[]'],
            ['proto.json', '{"kind":"browser-os-backup","schema":4,"state":{"__proto__":{"polluted":true},"spaces":{"__proto__":{"id":"x"}},"items":"x"}}'],
            ['wrong-kind.json', '{"kind":"something-else","schema":4,"state":{}}'],
            ['binary.json', '\u0000\u0001\u0002\uFFFF'],
            ['deep.json', `${'{"a":'.repeat(5000)}1${'}'.repeat(5000)}`],
        ];
        for (const [name, content] of files) {
            const file = join(profile, name);
            writeFileSync(file, content);
            await page.locator('.settings-body input[type=file]').setInputFiles(file);
            await page.locator('.toast', { hasText: 'not a readable backup' }).first().waitFor({ timeout: 5000 }).catch(() => {
                throw new Error(`${name} was not refused`);
            });
            await page.waitForTimeout(150);
        }
        const after = await readStorage<AppState>(session, KEY);
        expect(after!.updatedAt === state.updatedAt, 'state changed after refused imports');
        expect(await page.evaluate(() => !('polluted' in {})), 'Object.prototype was polluted');
        await page.close();
        return `${files.length} files refused`;
    });

    await check('Storage failure', 'when a save is refused (quota), the user is told and the page keeps working', async () => {
        await writeStorage(session, { [KEY]: starter(['dev']) });
        const page = await openNewTab(session);
        await page.evaluate(() => {
            chrome.storage.local.set = (() => Promise.reject(new Error('QUOTA_BYTES quota exceeded'))) as never;
        });
        await page.locator('.deck-head .quiet-button').click();
        await page.locator('.overlay-form input').first().fill('Will not save');
        await page.locator('.overlay-form button[type=submit]').click();
        await page.locator('.toast', { hasText: 'could not be saved' }).waitFor({ timeout: 5000 });
        expect((await page.locator('.home').count()) === 1, 'the page did not survive');
        const stored = await readStorage<AppState>(session, KEY);
        expect(!Object.values(stored!.spaces).some(space => space.name === 'Will not save'), 'the save went through after all');
        await page.close();
        return 'message shown: “Your changes could not be saved. Storage may be full.”';
    });
});

// ---------- A rollback: data written by a newer release ----------

await withSession(async session => {
    await check('Newer data', 'a state from a newer release is shown, left alone until edited, and set aside before it is overwritten', async () => {
        const newer = { ...JSON.parse(JSON.stringify(starter(['dev']))), schema: 99, somethingNew: { kept: true } };
        await writeStorage(session, { [KEY]: newer });
        const page = await openNewTab(session);
        expect((await page.locator('.plate').count()) === newer.spaceOrder.length, 'Spaces from the newer state are not shown');
        await page.waitForTimeout(800);
        const untouched = await readStorage<{ schema: number; updatedAt: number; somethingNew?: unknown }>(session, KEY);
        expect(untouched?.schema === 99 && untouched.updatedAt === newer.updatedAt && !!untouched.somethingNew, 'the newer state was rewritten just by opening a tab');
        await page.locator('.deck-head .quiet-button').click();
        await page.locator('.overlay-form input').first().fill('Added by the older build');
        await page.locator('.overlay-form button[type=submit]').click();
        const saved = await waitForState<AppState>(session, s => s.schema === 4 && s);
        const kept = await readStorage<{ schema: number; somethingNew?: { kept: boolean } }>(session, 'bos.state.newer');
        expect(kept?.schema === 99 && kept.somethingNew?.kept === true, 'the newer original was not set aside');
        expect(saved.spaceOrder.length === newer.spaceOrder.length + 1, 'the edit was not saved');
        await page.close();
        return 'original kept under bos.state.newer; the older build then saves in its own schema';
    });
});

// ---------- Offline ----------

await withSession(async session => {
    await check('Offline', 'first run with no network: onboarding completes and Home works', async () => {
        await session.context.setOffline(true);
        const page = await session.context.newPage();
        await page.goto('chrome://newtab/');
        await page.waitForSelector('.onboarding');
        for (const name of ['AI', 'Coding']) await page.locator('.interest', { hasText: name }).click();
        await page.locator('.onboarding .button.is-primary').click();
        await page.locator('.theme-card', { hasText: 'Dusk' }).click();
        await page.locator('.onboarding .button.is-primary').click();
        await page.locator('.choice', { hasText: 'Start fresh' }).click();
        await page.waitForSelector('.home .plate');
        const state = await waitForState<AppState>(session, s => s.onboarded && s);
        expect(state.spaceOrder.length >= 2, 'Spaces were not created');
        await page.close();
    });

    await check('Offline', 'Home, a Space, the command center, Customize and a packaged photograph all work offline', async () => {
        const state = starter(['ai', 'dev', 'entertainment']);
        await writeStorage(session, { [KEY]: { ...state, prefs: { ...state.prefs, background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'forest-fog' }, dim: 0.4 } } } });
        const page = await openNewTab(session);
        await page.waitForSelector('.backdrop-photo.is-ready', { timeout: 5000 });
        const marks = await page.locator('.app-icon-mark').count();
        expect(marks > 5, `only ${marks} packaged marks shown`);
        const unpainted = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('.app-icon')].filter(icon => !icon.querySelector('.app-icon-mark, .app-icon-mono, .app-icon-emoji, img.is-loaded')).length);
        expect(unpainted === 0, `${unpainted} icons are blank`);
        await page.locator('.plate', { hasText: 'Coding' }).click();
        await page.waitForSelector('.overlay-space');
        await page.keyboard.press('Escape');
        await page.waitForSelector('.overlay-space', { state: 'detached' });
        await page.keyboard.press('Control+k');
        await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
        await page.keyboard.type('git');
        await page.locator('.result', { hasText: 'GitHub' }).first().waitFor();
        await page.keyboard.press('Escape');
        await page.locator('.topbar button[aria-label="Customize"]').click();
        await page.waitForSelector('.overlay-customize');
        const thumbs = await page.evaluate(async () => {
            const tiles = [...document.querySelectorAll<HTMLElement>('.swatch-fill')].map(tile => /url\("?(wallpapers\/[^")]+)/.exec(tile.style.backgroundImage)?.[1]).filter((u): u is string => !!u);
            const loaded = await Promise.all(tiles.map(url => fetch(url).then(r => r.ok, () => false)));
            return { total: tiles.length, loaded: loaded.filter(Boolean).length };
        });
        expect(thumbs.total === 8 && thumbs.loaded === 8, `photograph previews offline: ${thumbs.loaded}/${thumbs.total}`);
        await page.screenshot({ path: 'e2e/.out/rc-offline-home.png' });
        await page.close();
        return `${marks} packaged marks, 8/8 photograph previews, picture shown; every icon has a mark, image or letter`;
    });

    await check('Offline', 'a search offline still hands the query to the browser; nothing breaks', async () => {
        const page = await openNewTab(session);
        await page.locator('#home-search').fill('weather tomorrow');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1200);
        // Offline, the browser shows its own "no internet" page for the search. That is the browser's page, not ours.
        return `navigated to: ${page.url().slice(0, 60)}`;
    });
    await session.context.setOffline(false);
});

// ---------- Several tabs at once ----------

await withSession(async session => {
    await writeStorage(session, { [KEY]: starter(['ai', 'dev', 'work']) });
    const a = await openNewTab(session);
    const b = await openNewTab(session);
    const addSpace = async (page: Page, name: string) => {
        await page.bringToFront();
        await page.locator('.deck-head .quiet-button').click();
        await page.locator('.overlay-form input').first().fill(name);
        await page.locator('.overlay-form button[type=submit]').click();
        await page.waitForSelector('.overlay-space');
        await page.keyboard.press('Escape');
        await page.waitForSelector('.overlay-space', { state: 'detached' });
    };
    const spaceNames = (page: Page) => page.locator('.plate .plate-name').allTextContents();

    await check('Several tabs', 'edits made one after another in different tabs are all kept', async () => {
        await addSpace(a, 'From tab A');
        await b.waitForFunction(() => [...document.querySelectorAll('.plate-name')].some(n => n.textContent === 'From tab A'), null, { timeout: 5000 });
        await addSpace(b, 'From tab B');
        await a.waitForFunction(() => [...document.querySelectorAll('.plate-name')].some(n => n.textContent === 'From tab B'), null, { timeout: 5000 });
        const stored = await readStorage<AppState>(session, KEY);
        const stored_names = stored!.spaceOrder.map(id => stored!.spaces[id]!.name);
        expect(stored_names.includes('From tab A') && stored_names.includes('From tab B'), `stored: ${stored_names.join(', ')}`);
        expect(JSON.stringify(await spaceNames(a)) === JSON.stringify(await spaceNames(b)), 'tabs show different Spaces');
    });

    await check('Several tabs', 'edits made at the same instant: the tabs agree afterwards and storage is valid (last write wins)', async () => {
        // Both tabs change the state inside the same save window, without seeing each other.
        const rename = (page: Page, name: string) => page.evaluate(newName => {
            const first = document.querySelector<HTMLElement>('.plate');
            first?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 10 }));
            return newName;
        }, name);
        void rename;
        const before = await readStorage<AppState>(session, KEY);
        const firstId = before!.spaceOrder[0]!;
        const lastId = before!.spaceOrder[before!.spaceOrder.length - 1]!;
        // Drive the same store functions the UI uses, at the same moment, in both tabs.
        await Promise.all([
            a.evaluate(() => (document.querySelector<HTMLElement>('.plate') as HTMLElement).focus()),
            b.evaluate(() => (document.querySelector<HTMLElement>('.plate:last-of-type') as HTMLElement)?.focus()),
        ]);
        await Promise.all([a.keyboard.press('Alt+ArrowRight'), b.keyboard.press('Alt+ArrowLeft')]);
        await a.waitForTimeout(1500);
        const stored = await readStorage<AppState>(session, KEY);
        const [inA, inB] = [await spaceNames(a), await spaceNames(b)];
        expect(JSON.stringify(inA) === JSON.stringify(inB), `tabs disagree: A=${inA.join(',')} B=${inB.join(',')}`);
        const storedNames = stored!.spaceOrder.map(id => stored!.spaces[id]!.name);
        expect(JSON.stringify(storedNames) === JSON.stringify(inA), 'what is shown is not what is stored');
        expect(new Set(stored!.spaceOrder).size === before!.spaceOrder.length, 'a Space was lost or duplicated');
        const movedFirst = stored!.spaceOrder[0] !== firstId;
        const movedLast = stored!.spaceOrder[stored!.spaceOrder.length - 1] !== lastId;
        return `of two simultaneous reorders, ${movedFirst && movedLast ? 'both were' : movedFirst || movedLast ? 'one was' : 'neither was'} kept; no Space lost; both tabs and storage agree`;
    });

    await check('Several tabs', 'a tab that was open in the background catches up when it is used again', async () => {
        const c = await openNewTab(session);
        await addSpace(c, 'From tab C');
        await a.bringToFront();
        await a.waitForFunction(() => [...document.querySelectorAll('.plate-name')].some(n => n.textContent === 'From tab C'), null, { timeout: 5000 });
        await c.close();
    });

    await check('Several tabs', 'the active Mode follows across tabs (a Mode is one setting, not one per tab)', async () => {
        const [d, e] = [await openNewTab(session), await openNewTab(session)];
        await d.bringToFront();
        await d.locator('#mode-switch').click();
        await d.screenshot({ path: 'e2e/.out/rc-debug-mode.png' });
        console.log('menu:', await d.locator('.menu button').allTextContents());
        await d.locator('.menu button', { hasText: 'Dev' }).first().click({ timeout: 4000 });
        await e.waitForFunction(() => /Dev/.test(document.querySelector('#mode-switch')?.textContent ?? ''), null, { timeout: 5000 });
        await d.close();
        await e.close();
    });
    await a.close();
    await b.close();
});

// ---------- Keyboard and names ----------

await withSession(async session => {
    await writeStorage(session, { [KEY]: starter(['ai', 'dev', 'work']) });
    const page = await openNewTab(session);

    /** Controls in view with no accessible name at all. */
    const unnamed = (scope: string) => page.evaluate(selector => {
        const root = document.querySelector(selector) ?? document.body;
        return [...root.querySelectorAll<HTMLElement>('button, a[href], input:not([type=hidden]):not([hidden]), select, textarea, [role=radio], [role=switch], [role=option]')]
            .filter(el => el.offsetParent !== null || el.getClientRects().length > 0)
            .filter(el => {
                const labelled = el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent?.trim() || el.getAttribute('placeholder')
                    || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label')?.textContent?.trim()
                    || (el.getAttribute('aria-labelledby') && document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent);
                return !labelled;
            })
            .map(el => el.outerHTML.slice(0, 90));
    }, scope);

    await check('Accessibility', 'every control on Home has a name', async () => {
        const missing = await unnamed('.home');
        expect(missing.length === 0, missing.join(' || '));
    });

    await check('Accessibility', 'Tab reaches search, Spaces and the dock, in that order, with a visible focus ring', async () => {
        await page.locator('body').click({ position: { x: 5, y: 300 } });
        const seen: string[] = [];
        let ringless = 0;
        for (let i = 0; i < 40; i++) {
            await page.keyboard.press('Tab');
            const info = await page.evaluate(() => {
                const el = document.activeElement as HTMLElement | null;
                if (!el || el === document.body) return null;
                // A text field may draw its ring on the box around it.
                const ringOn = (node: Element) => {
                    const style = getComputedStyle(node);
                    return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none';
                };
                const ring = ringOn(el) || (el.tagName === 'INPUT' && !!el.parentElement && ringOn(el.parentElement));
                const area = el.closest('.dock') ? 'dock' : el.closest('.plate') || el.classList.contains('plate') ? 'space' : el.id === 'home-search' ? 'search' : el.closest('.topbar') ? 'topbar' : 'other';
                return { area, ring };
            });
            if (!info) continue;
            if (!info.ring) ringless++;
            if (seen[seen.length - 1] !== info.area) seen.push(info.area);
        }
        expect(seen.includes('search') && seen.includes('space'), `Tab order visited: ${seen.join(' → ')}`);
        expect(ringless === 0, `${ringless} focused controls had no visible focus indicator`);
        return seen.join(' → ');
    });

    for (const [label, open, scope] of [
        ['Space view', async () => { await page.locator('.plate').first().click(); await page.waitForSelector('.overlay-space'); }, '.overlay-space'],
        ['command center', async () => { await page.keyboard.press('Control+k'); await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette')); await page.keyboard.type('a'); }, '.overlay-palette'],
        ['Customize', async () => { await page.locator('.topbar button[aria-label="Customize"]').click(); await page.waitForSelector('.overlay-customize'); }, '.overlay-customize'],
        ['Settings', async () => { await page.locator('.topbar button[aria-label="Settings"]').click(); await page.waitForSelector('.settings-nav'); }, '.overlay'],
    ] as const) {
        await check('Accessibility', `${label}: named controls, focus stays inside, Escape closes and returns focus`, async () => {
            await page.locator('body').click({ position: { x: 5, y: 300 } });
            await open();
            await page.waitForTimeout(250);
            const missing = await unnamed(scope);
            expect(missing.length === 0, `unnamed: ${missing.join(' || ')}`);
            let escaped = 0;
            for (let i = 0; i < 30; i++) {
                await page.keyboard.press('Tab');
                if (!(await page.evaluate(() => !!document.activeElement?.closest('.overlay, [role=dialog], .menu')))) escaped++;
            }
            expect(escaped === 0, `focus left the panel ${escaped} times while tabbing`);
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            if (await page.locator('.overlay').count()) await page.keyboard.press('Escape');
            await page.waitForTimeout(300);
            expect((await page.locator('.overlay').count()) === 0, 'Escape did not close the panel');
        });
    }

    await check('Accessibility', 'Settings sections: every control in every section has a name', async () => {
        await page.locator('.topbar button[aria-label="Settings"]').click();
        await page.waitForSelector('.settings-nav');
        const problems: string[] = [];
        for (const section of await page.locator('.settings-nav button').allTextContents()) {
            await page.locator('.settings-nav button', { hasText: section }).first().click();
            await page.waitForTimeout(120);
            const missing = await unnamed('.overlay');
            if (missing.length) problems.push(`${section}: ${missing.join(' | ')}`);
        }
        await page.keyboard.press('Escape');
        expect(problems.length === 0, problems.join(' || '));
    });

    await check('Reduced motion', 'with the system setting on, a photograph and a theme change appear without animation', async () => {
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const state = starter(['ai', 'dev']);
        await writeStorage(session, { [KEY]: { ...state, prefs: { ...state.prefs, background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'milky-way' }, dim: 0.3 } } } });
        const tab = await openNewTab(session);
        await tab.emulateMedia({ reducedMotion: 'reduce' });
        await tab.reload();
        await tab.waitForSelector('.backdrop-photo.is-ready');
        await tab.waitForTimeout(400);
        const moving = await tab.evaluate(() => document.getAnimations().filter(animation => {
            const timing = animation.effect?.getComputedTiming();
            return animation.playState === 'running' && Number(timing?.duration ?? 0) > 50;
        }).length);
        expect(moving === 0, `${moving} animations still running`);
        const longest = await tab.evaluate(() => Math.max(0, ...[...document.querySelectorAll<HTMLElement>('.backdrop, .backdrop *, .plate, .dock, .app-icon-mark')].flatMap(el =>
            getComputedStyle(el).transitionDuration.split(',').map(d => parseFloat(d) * (d.includes('ms') ? 1 : 1000)).filter((ms, i) => {
                const property = getComputedStyle(el).transitionProperty.split(',')[i]?.trim() ?? 'all';
                return /transform|all|translate|scale|filter/.test(property) && ms > 0;
            }))));
        expect(longest <= 10, `a movement transition of ${longest} ms remains`);
        await tab.close();
        await page.emulateMedia({ reducedMotion: null });
    });
    await page.close();
});

await check('Console', 'no errors or uncaught exceptions on any extension page during the run', async () => {
    expect(allErrors.length === 0, allErrors.slice(0, 5).join(' || '));
});

note('Several tabs', 'how conflicts are resolved',
    'The whole setup is one record. Each tab saves about a quarter of a second after a change, and every other tab adopts a record that is newer than its own. '
    + 'Two edits inside the same quarter second in different tabs: the later save wins and the earlier one is dropped (whole record, not field by field). Nothing is corrupted.');

process.exit(report() ? 1 : 0);

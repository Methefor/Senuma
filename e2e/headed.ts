/**
 * Headed pass in real Google Chrome (not Chromium, not headless), Windows only.
 *
 *   npm run headed
 *
 * Opens a visible Chrome window on a throw-away profile, loads dist/ unpacked and walks the
 * things only a real window shows: where keyboard focus is on a fresh tab, the browser's own
 * permission prompts, restart and reload. Native UI (address bar, prompts) is read and pressed
 * through Windows UI Automation by e2e/headed/win.ps1, which only ever touches this Chrome.
 *
 * This script records what happened. It does not decide what should happen: every line of
 * the output is an observation, and docs/HEADED_CHROME_PASS.md is written from it.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type BrowserContext, type Page, type Worker } from 'playwright';
import { LEGACY } from '../src/core/fixtures';
import type { AppState } from '../src/core/types';
import { check, note, outcomes, removeProfile, report } from './harness';

const OUT = 'e2e/.out';
mkdirSync(OUT, { recursive: true });
const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));

interface Chrome {
    context: BrowserContext;
    worker: Worker;
    id: string;
    version: string;
    win: (...args: string[]) => string;
}

function helper(profile: string): Chrome['win'] {
    return (...args) => {
        try {
            return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve('e2e/headed/win.ps1'), '-Profile', profile, ...args], { encoding: 'utf8' }).trim();
        } catch (error) {
            return `HELPER-ERROR ${String((error as { stdout?: string }).stdout ?? '').trim()}`;
        }
    };
}

async function start(profile: string, load = true): Promise<Chrome & { installedAlready: boolean }> {
    const context = await chromium.launchPersistentContext(profile, {
        channel: 'chrome', headless: false, viewport: null, acceptDownloads: true,
        args: ['--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check', '--window-size=1440,960', '--window-position=40,40'],
        ignoreDefaultArgs: ['--disable-extensions'],
    });
    const browser = context.browser()!;
    await sleep(1500);
    const installedAlready = context.serviceWorkers().some(worker => worker.url().endsWith('/background.js'));
    let id = installedAlready ? context.serviceWorkers()[0]!.url().split('/')[2]! : '';
    if (load) {
        const cdp = await browser.newBrowserCDPSession();
        id = ((await cdp.send('Extensions.loadUnpacked' as never, { path: resolve('dist') } as never)) as unknown as { id: string }).id;
    }
    const worker = context.serviceWorkers().find(w => id && w.url().includes(id))
        ?? (await context.waitForEvent('serviceworker', { timeout: load ? 15_000 : 4000 }).catch(() => undefined as never));
    return { context, worker, id, version: browser.version(), win: helper(profile), installedAlready };
}

/** Turns on "Developer mode" on chrome://extensions. Without it Chrome switches an unpacked extension off when it reloads. */
async function developerMode(context: BrowserContext): Promise<void> {
    const extensions = await context.newPage();
    await extensions.goto('chrome://extensions/');
    await extensions.evaluate(() => new Promise<void>(done => {
        const api = (window as unknown as { chrome: { developerPrivate: { updateProfileConfiguration: (config: object, callback: () => void) => void } } }).chrome.developerPrivate;
        api.updateProfileConfiguration({ inDeveloperMode: true }, () => done());
    })).catch(() => undefined);
    await extensions.close();
}

/** A new tab opened the way a person opens one: Ctrl+T in the real window. */
async function freshTab(gc: Chrome): Promise<Page> {
    const before = new Set(gc.context.pages());
    const sent = gc.win('-Action', 'keys', '-Keys', '^t');
    if (!sent.startsWith('SENT')) throw new Error(`could not send Ctrl+T: ${sent}`);
    for (let i = 0; i < 40; i++) {
        const page = gc.context.pages().find(p => !before.has(p));
        if (page) {
            await page.waitForLoadState('domcontentloaded').catch(() => undefined);
            await sleep(900);
            return page;
        }
        await sleep(100);
    }
    throw new Error('no new tab appeared');
}

const state = (gc: Chrome) => gc.worker.evaluate(async () => (await chrome.storage.local.get('bos.state'))['bos.state']) as Promise<AppState>;
const permissions = (gc: Chrome) => gc.worker.evaluate(async () => ((await chrome.permissions.getAll()).permissions ?? []).sort().join(', ')) as Promise<string>;
const focus = (gc: Chrome) => gc.win('-Action', 'focus').replace(/^FOCUS: /, '');
const where = (focused: string) => (/Omnibox/.test(focused) ? 'the address bar' : /RenderWidgetHost|Document/.test(focused) ? 'the page' : focused);
const shot = (gc: Chrome, name: string) => gc.win('-Action', 'shot', '-Out', resolve(OUT, `headed-${name}.png`));
const keys = async (gc: Chrome, sequence: string, wait = 700) => {
    const result = gc.win('-Action', 'keys', '-Keys', sequence);
    await sleep(wait);
    return result;
};
const ALLOW = '^(.zin ver|Allow)$';
const DENY = '^(Reddet|Deny)$';
/** “Keep changes” on Chrome's “this page was changed by an extension” bubble. */
const KEEP = 'iklikleri koru|Keep';

/** Reads the browser's own dialog that holds a button of the given name, if one is showing. */
function prompt(gc: Chrome, button = ALLOW): { text: string; buttons: string } {
    const raw = gc.win('-Action', 'prompt', '-Name', button);
    if (!raw.startsWith('PROMPT:')) return { text: '', buttons: '' };
    const [title = '', texts = '', buttons = ''] = raw.slice(7).split('||').map(part => part.trim());
    return { text: [title, texts].filter(Boolean).join(' — '), buttons: buttons.replace(/^buttons: /, '') };
}

// =====================================================================================
// Profile A: a new install
// =====================================================================================

const profileA = mkdtempSync(join(tmpdir(), 'bos-headed-a-'));
let gc = await start(profileA);
let page: Page;

await check('Load', 'dist/ loads unpacked in Google Chrome', async () => {
    const manifest = (await gc.worker.evaluate(() => chrome.runtime.getManifest())) as { version: string; version_name: string; permissions: string[]; optional_permissions: string[] };
    return `Google Chrome ${gc.version}; extension ${gc.id}; manifest ${manifest.version} (“${manifest.version_name}”); required: ${manifest.permissions.join(', ')}; optional: ${manifest.optional_permissions.join(', ')}; granted: ${await permissions(gc)}`;
});

await check('First new tab', 'Ctrl+T on a new install', async () => {
    page = await freshTab(gc);
    const focused = focus(gc);
    const onboarding = await page.locator('.onboarding').count();
    const language = await page.evaluate(() => document.documentElement.lang);
    shot(gc, '01-first-tab');
    return `address: ${page.url().replace(gc.id, '<id>')}; tab title “${await page.title()}”; ${onboarding ? 'onboarding is shown' : 'Home is shown'}; page language “${language}” (browser UI language ${await page.evaluate(() => navigator.language)}); keyboard focus is in ${where(focused)} [${focused}]`;
});

await check('First new tab', 'the browser asks whether to keep the new tab page', async () => {
    const seen = prompt(gc, KEEP);
    if (!seen.text) return 'no such bubble was showing on the first tab';
    shot(gc, '01b-keep-changes-bubble');
    const pressed = gc.win('-Action', 'invoke', '-Name', KEEP);
    await sleep(800);
    return `Chrome shows its own bubble: “${seen.text}” with buttons: ${seen.buttons}. Pressed “keep”: ${pressed}`;
});

await check('First new tab', 'onboarding can be completed', async () => {
    const select = page.locator('.onboarding select');
    if (await select.count()) await select.selectOption('en');
    for (const name of ['AI', 'Coding', 'Work', 'Media']) await page.locator('.interest', { hasText: name }).click();
    await page.locator('.onboarding .button.is-primary').click();
    await page.locator('.theme-card', { hasText: 'Dusk' }).click();
    await page.locator('.onboarding .button.is-primary').click();
    const importWhy = (await page.locator('.onboarding').innerText()).replace(/\s+/g, ' ');
    await page.locator('.choice', { hasText: 'Start fresh' }).click();
    await page.waitForSelector('.home .plate');
    const stored = await state(gc);
    return `${stored.spaceOrder.length} Spaces, ${Object.keys(stored.items).length} links, ${stored.modeOrder.length} Modes; the last step explained bookmarks as: “${/Import your existing[^.]*\.[^.]*\.[^.]*\./.exec(importWhy)?.[0] ?? importWhy.slice(0, 160)}”`;
});

await check('Focus and shortcuts', 'a fresh tab, nothing clicked: Ctrl+K', async () => {
    page = await freshTab(gc);
    const before = focus(gc);
    await keys(gc, '^k');
    const palette = await page.locator('.overlay-palette').count();
    const after = focus(gc);
    shot(gc, '02-fresh-ctrl-k');
    await keys(gc, '{ESC}{ESC}', 400);
    return `focus before: ${where(before)}; after Ctrl+K: command center ${palette ? 'OPENED' : 'did NOT open'}; focus then: ${where(after)} [${after}]`;
});

await check('Focus and shortcuts', 'a fresh tab, nothing clicked: “/”', async () => {
    page = await freshTab(gc);
    const before = focus(gc);
    await keys(gc, '/');
    const palette = await page.locator('.overlay-palette').count();
    const searchFocused = await page.evaluate(() => document.activeElement?.id === 'home-search');
    const after = focus(gc);
    shot(gc, '03-fresh-slash');
    await keys(gc, '{ESC}{ESC}', 400);
    return `focus before: ${where(before)}; after “/”: command center ${palette ? 'opened' : 'not opened'}, page search field ${searchFocused ? 'focused' : 'not focused'}; focus then: ${where(after)} (the character went to ${/Omnibox/.test(after) ? 'the address bar' : 'the page'})`;
});

await check('Focus and shortcuts', 'click the page, then Ctrl+K, “/” and M', async () => {
    page = await freshTab(gc);
    const clicked = gc.win('-Action', 'click', '-Name', '0.03,0.6');
    await sleep(500);
    const afterClick = focus(gc);
    await keys(gc, '^k');
    const palette = await page.locator('.overlay-palette').count();
    const inputFocused = await page.evaluate(() => !!document.activeElement?.closest('.overlay-palette'));
    await keys(gc, 'git', 500);
    const results = await page.locator('.result').count();
    const first = results ? (await page.locator('.result').first().innerText()).replace(/\s+/g, ' ') : '';
    shot(gc, '04-clicked-ctrl-k');
    await keys(gc, '{ESC}', 500);
    const closed = (await page.locator('.overlay-palette').count()) === 0;
    await keys(gc, '/');
    const slash = await page.evaluate(() => `${document.activeElement?.id || document.activeElement?.tagName}${document.querySelector('.overlay-palette') ? ' (command center open)' : ''}`);
    await keys(gc, '{ESC}{ESC}', 500);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await keys(gc, 'm');
    const menu = await page.locator('.menu').count();
    const items = menu ? (await page.locator('.menu button').allTextContents()).join(', ') : '';
    shot(gc, '05-mode-menu');
    await keys(gc, '{ESC}', 400);
    return `${clicked}; focus after the click: ${where(afterClick)}; Ctrl+K: command center ${palette ? 'opened' : 'did not open'}, its field ${inputFocused ? 'has' : 'does not have'} focus; typing “git” gave ${results} results (first: “${first.slice(0, 60)}”); Escape ${closed ? 'closed it' : 'did not close it'}; “/” moved focus to: ${slash}; M: Mode menu ${menu ? `opened (${items})` : 'did not open'}`;
});

// ---------- Permission prompts ----------

async function openSettings(target: Page, section: string): Promise<void> {
    await target.locator('.topbar button[aria-label="Settings"]').click();
    await target.locator('.settings-nav button', { hasText: section }).click();
    await sleep(300);
}

await check('Bookmarks permission', 'what is said before the prompt, and the prompt itself', async () => {
    page = await freshTab(gc);
    await openSettings(page, 'Data');
    const row = page.locator('.row', { hasText: 'Import browser bookmarks' });
    const explanation = (await row.innerText()).replace(/\s+/g, ' ');
    await row.locator('.button').click();
    await sleep(1800);
    const seen = prompt(gc);
    shot(gc, '06-bookmarks-prompt');
    return `in-product explanation: “${explanation}” → browser prompt: “${seen.text}”; buttons: ${seen.buttons}`;
});

await check('Bookmarks permission', 'declining', async () => {
    const pressed = gc.win('-Action', 'invoke', '-Name', DENY);
    await sleep(1200);
    const toast = (await page.locator('.toast').allTextContents()).join(' / ');
    const review = await page.locator('.review-list').count();
    const usable = await page.locator('.settings-nav').count();
    shot(gc, '07-bookmarks-declined');
    return `${pressed}; granted: ${await permissions(gc)}; message shown: “${toast}”; import review ${review ? 'opened' : 'not opened'}; Settings still ${usable ? 'usable' : 'gone'}`;
});

await check('Bookmarks permission', 'granting later', async () => {
    const row = page.locator('.row', { hasText: 'Import browser bookmarks' });
    await row.locator('.button').click();
    await sleep(1800);
    const seen = prompt(gc);
    const pressed = gc.win('-Action', 'invoke', '-Name', ALLOW);
    await sleep(1500);
    const granted = await permissions(gc);
    shot(gc, '07b-bookmarks-granted');
    const shown = ((await page.locator('.toast').allTextContents()).join(' / ') || (await page.locator('.overlay').last().innerText().catch(() => ''))).replace(/\s+/g, ' ').slice(0, 200);
    return `prompt again: “${seen.text.slice(0, 120)}”; ${pressed}; granted: ${granted}; then (profile has no bookmarks yet): “${shown}”`;
});

await check('Bookmarks permission', 'importing real bookmarks once granted', async () => {
    // The extension gives bookmark access back after each read, so the test's own bookmarks
    // are made on Chrome's bookmarks page, as a person would have made them.
    const manager = await gc.context.newPage();
    await manager.goto('chrome://bookmarks/');
    await manager.evaluate(async () => {
        const folder = await chrome.bookmarks.create({ title: 'Reading' });
        await chrome.bookmarks.create({ parentId: folder.id, title: 'A blog', url: 'https://blog.example.org/' });
        await chrome.bookmarks.create({ title: 'GitLab', url: 'https://gitlab.com/' });
        await chrome.bookmarks.create({ title: 'Figma', url: 'https://www.figma.com/' });
        await chrome.bookmarks.create({ title: 'Script', url: 'javascript:void(0)' });
    });
    page = await freshTab(gc);
    await openSettings(page, 'Data');
    const before = await state(gc);
    await page.locator('.row', { hasText: 'Import browser bookmarks' }).locator('.button').click();
    await sleep(1500);
    const promptAgain = prompt(gc).text;
    const review = (await page.locator('.review-list').innerText()).replace(/\s+/g, ' ');
    shot(gc, '08-bookmarks-review');
    await page.locator('.review .button.is-primary').click();
    await sleep(900);
    const after = await state(gc);
    const bookmarksLeft = await manager.evaluate(async () => (await chrome.bookmarks.search({})).filter(b => b.url).length);
    await manager.close();
    const grantedAfter = await permissions(gc);
    return `prompt on this third request: ${promptAgain ? `shown (${promptAgain.slice(0, 60)})` : 'none shown, access was given silently'}; review listed: “${review.slice(0, 140)}”; links ${Object.keys(before.items).length} → ${Object.keys(after.items).length}; the browser still has its ${bookmarksLeft} bookmarks (nothing changed there); granted after the import: ${grantedAfter}`;
});

await check('Bookmarks permission', 'revoking, then asking again', async () => {
    const removed = await gc.worker.evaluate(() => chrome.permissions.remove({ permissions: ['bookmarks'] }));
    const granted = await permissions(gc);
    page = await freshTab(gc);
    await openSettings(page, 'Data');
    await page.locator('.row', { hasText: 'Import browser bookmarks' }).locator('.button').click();
    await sleep(1800);
    const seen = prompt(gc);
    const pressed = seen.text ? gc.win('-Action', 'invoke', '-Name', DENY) : 'no prompt to dismiss';
    await sleep(800);
    const home = await page.locator('.home').count();
    await page.keyboard.press('Escape');
    return `revoked: ${removed}; granted after revoking: ${granted}; asking again shows the prompt: ${seen.text ? 'yes' : 'no'}; ${pressed}; Home still ${home ? 'works' : 'broken'}`;
});

await check('Recently closed pages permission', 'explanation, prompt, declining', async () => {
    const site = await gc.context.newPage();
    await site.goto('https://example.com/').catch(() => undefined);
    await sleep(600);
    await site.close();
    page = await freshTab(gc);
    await openSettings(page, 'Privacy');
    const row = page.locator('.row', { hasText: 'recently closed tabs' });
    const explanation = (await row.innerText()).replace(/\s+/g, ' ');
    await row.locator('.switch').click();
    await sleep(1800);
    const seen = prompt(gc);
    shot(gc, '09-closed-tabs-prompt');
    const pressed = gc.win('-Action', 'invoke', '-Name', DENY);
    await sleep(1200);
    const toast = (await page.locator('.toast').allTextContents()).join(' / ');
    const stored = await state(gc);
    return `in-product explanation: “${explanation}” → browser prompt: “${seen.text}”; buttons: ${seen.buttons}; ${pressed}; message: “${toast}”; setting is ${stored.prefs.showClosedTabs ? 'ON' : 'off'}; granted: ${await permissions(gc)}`;
});

await check('Recently closed pages permission', 'granting later, using it, turning it off', async () => {
    const row = page.locator('.row', { hasText: 'recently closed tabs' });
    await row.locator('.switch').click();
    await sleep(1800);
    const pressed = gc.win('-Action', 'invoke', '-Name', ALLOW);
    await sleep(1500);
    const granted = await permissions(gc);
    const on = (await state(gc)).prefs.showClosedTabs;
    await page.keyboard.press('Escape');
    const tab = await freshTab(gc);
    const continued = (await tab.locator('.continue-link').allTextContents()).map(text => text.replace(/\s+/g, ' ').trim());
    shot(gc, '10-continue-closed-tabs');
    await openSettings(tab, 'Privacy');
    await tab.locator('.row', { hasText: 'recently closed tabs' }).locator('.switch').click();
    await sleep(1200);
    const afterOff = await permissions(gc);
    await tab.keyboard.press('Escape');
    page = tab;
    return `${pressed}; granted: ${granted}; setting ${on ? 'on' : 'off'}; Continue on a new tab lists: ${continued.join(' | ') || '(nothing)'}; after turning it off, granted: ${afterOff}`;
});

// ---------- Search ----------

await check('Search', 'default search and an alternate provider', async () => {
    const tab = await freshTab(gc);
    await tab.locator('#home-search').fill('weather in izmir');
    await Promise.all([tab.waitForURL(url => !url.protocol.startsWith('chrome'), { timeout: 20_000 }), tab.keyboard.press('Enter')]);
    const first = new URL(tab.url());
    const other = await freshTab(gc);
    await other.locator('#home-search').fill('y lofi & chill');
    await Promise.all([other.waitForURL(/youtube\.com/, { timeout: 20_000 }), other.keyboard.press('Enter')]);
    const second = new URL(other.url());
    await tab.close();
    await other.close();
    return `“weather in izmir” → ${first.hostname}${first.pathname} (this profile’s default engine, through chrome.search); “y lofi & chill” → ${second.hostname}${second.pathname}?search_query=${second.searchParams.get('search_query')}`;
});

// ---------- Appearance that must survive ----------

await check('Appearance', 'a packaged photograph for everything, and a different look for Dev Mode', async () => {
    page = await freshTab(gc);
    await page.locator('.topbar button[aria-label="Customize"]').click();
    await page.waitForSelector('.overlay-customize');
    await page.locator('.swatch-tile[aria-label="Milky Way"]').click();
    await page.locator('.customize-foot .button.is-primary').click();
    await sleep(700);
    await page.locator('#mode-switch').click();
    await page.locator('.menu button', { hasText: 'Dev' }).first().click();
    await sleep(400);
    await page.locator('.topbar button[aria-label="Customize"]').click();
    await page.waitForSelector('.overlay-customize');
    await page.locator('.segmented button', { hasText: 'Dev only' }).click();
    await page.locator('.theme-card', { hasText: 'Phosphor' }).click();
    await page.locator('.swatch-tile[aria-label="Ink"]').click();
    await page.locator('.customize-foot .button.is-primary').click();
    await sleep(900);
    shot(gc, '11-dev-mode-look');
    const stored = await state(gc);
    const dev = Object.values(stored.modes).find(mode => mode.name === 'Dev');
    return `default background: ${JSON.stringify(stored.prefs.background.source)}; Dev Mode: theme ${dev?.themeId}, background ${JSON.stringify(dev?.background?.source)}; active Mode: ${stored.activeModeId === dev?.id ? 'Dev' : 'other'}`;
});

// ---------- Data ----------

let exported = '';
await check('Data', 'export, undo, replace by import, restore point', async () => {
    await page.locator('.plate').first().click({ button: 'right' });
    const deletedName = (await page.locator('.plate .plate-name').first().innerText()).trim();
    await page.locator('.menu button', { hasText: 'Delete' }).click();
    await sleep(400);
    const gone = !(await page.locator('.plate .plate-name').allTextContents()).includes(deletedName);
    await page.locator('.toast-action').click();
    await sleep(500);
    const back = (await page.locator('.plate .plate-name').allTextContents()).includes(deletedName);

    await openSettings(page, 'Data');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.row', { hasText: 'Export your setup' }).locator('.button').click()]);
    const file = join(profileA, 'backup.json');
    await download.saveAs(file);
    exported = readFileSync(file, 'utf8');
    const parsed = JSON.parse(exported);

    const smaller = JSON.parse(exported);
    const keep = smaller.state.spaceOrder[0];
    smaller.state.spaceOrder = [keep];
    smaller.state.spaces = { [keep]: smaller.state.spaces[keep] };
    const replaceFile = join(profileA, 'replace.json');
    writeFileSync(replaceFile, JSON.stringify(smaller));
    const before = await state(gc);
    await page.locator('.settings-body input[type=file]').setInputFiles(replaceFile);
    await page.locator('.choice', { hasText: 'Replace my setup' }).click();
    await sleep(900);
    const replaced = await state(gc);
    await page.locator('.list-row .button', { hasText: 'Restore' }).first().click();
    await sleep(900);
    const restored = await state(gc);
    await page.keyboard.press('Escape');
    return `deleted “${deletedName}”: ${gone ? 'removed' : 'NOT removed'}, Undo: ${back ? 'came back' : 'did NOT come back'}; export: ${download.suggestedFilename()} (${(exported.length / 1024).toFixed(1)} kB, schema ${parsed.schema}, kind ${parsed.kind}); import “replace”: ${before.spaceOrder.length} → ${replaced.spaceOrder.length} Spaces; restore point: back to ${restored.spaceOrder.length} Spaces, photograph ${restored.prefs.background.source.kind === 'preset' ? 'still set' : 'lost'}`;
});

// ---------- Several tabs ----------

await check('Several tabs', 'three real tabs; an edit in one shows in the others', async () => {
    const a = await freshTab(gc);
    const b = await freshTab(gc);
    const c = await freshTab(gc);
    await c.locator('#mode-switch').click();
    await c.locator('.menu button', { hasText: 'All Spaces' }).first().click();
    await c.locator('.deck-head .quiet-button').click();
    await c.locator('.overlay-form input').first().fill('Headed pass');
    await c.locator('.overlay-form button[type=submit]').click();
    await c.waitForSelector('.overlay-space');
    await c.keyboard.press('Escape');
    await sleep(1500);
    const seen = await Promise.all([a, b].map(tab => tab.locator('.plate .plate-name').allTextContents().then(names => names.includes('Headed pass'))));
    const modes = await Promise.all([a, b].map(tab => tab.locator('#mode-switch').innerText()));
    await a.close();
    await b.close();
    page = c;
    return `created a Space in tab 3; tab 1 shows it: ${seen[0]}, tab 2 shows it: ${seen[1]} (without reloading; background tabs); their Mode switch now reads “${modes.join('” / “').replace(/\s+/g, ' ')}”`;
});

// ---------- Reload and restart ----------

await check('Extension reload', 'reload the extension, then open a tab', async () => {
    await developerMode(gc.context);
    const before = await state(gc);
    await gc.worker.evaluate(() => chrome.runtime.reload()).catch(() => undefined);
    await sleep(3500);
    const worker = gc.context.serviceWorkers().find(w => w.url().includes(gc.id));
    let tabInfo = '';
    try {
        const tab = await freshTab(gc);
        tabInfo = `a new tab opens ${tab.url().includes(gc.id) ? 'the extension page' : tab.url()}; Home ${await tab.locator('.home').count() ? 'shown' : 'not shown'}`;
        if (worker) gc.worker = worker;
        page = tab;
    } catch (error) {
        tabInfo = `new tab: ${(error as Error).message}`;
    }
    let same = 'state not readable';
    try {
        const after = await state(gc);
        same = `Spaces ${before.spaceOrder.length} → ${after.spaceOrder.length}, saved time ${after.updatedAt === before.updatedAt ? 'unchanged' : 'changed'}`;
    } catch { /* worker gone: reported below */ }
    return `service worker after reload: ${worker ? 'running' : 'not running (Chrome switched the unpacked extension off)'}; ${tabInfo}; ${same}`;
});

let beforeRestart: AppState | undefined;
await check('Browser restart', 'quit Chrome and start it again on the same profile', async () => {
    try {
        beforeRestart = await state(gc);
    } catch { /* read after restart instead */ }
    await gc.context.close();
    await sleep(4000);
    const again = await start(profileA, false).catch(async () => {
        await sleep(4000);
        return start(profileA, false);
    });
    const stillInstalled = again.installedAlready && !!again.worker;
    gc = stillInstalled ? again : await (async () => {
        await again.context.close();
        await sleep(1000);
        return start(profileA, true);
    })();
    page = await freshTab(gc);
    const after = await state(gc);
    await page.waitForSelector('.home');
    await sleep(1200);
    shot(gc, '12-after-restart');
    const dev = Object.values(after.modes).find(mode => mode.name === 'Dev');
    const scheme = await page.evaluate(() => `${document.documentElement.dataset.theme ?? ''}`);
    const photo = await page.locator('.backdrop-photo.is-ready').count();
    return `extension present after restart without loading it again: ${stillInstalled ? 'yes' : 'no (an unpacked extension loaded for this session had to be loaded again; a store install does not need this)'}; same ID: ${gc.id}; Spaces ${beforeRestart?.spaceOrder.length ?? '?'} → ${after.spaceOrder.length}; default photograph kept: ${JSON.stringify(after.prefs.background.source)}; Dev Mode look kept: ${dev?.themeId} + ${JSON.stringify(dev?.background?.source)}; active Mode ${after.activeModeId === dev?.id ? 'Dev' : 'All/other'}; page theme attribute “${scheme}”; photograph on screen: ${photo ? 'yes' : 'no (the active Mode uses its own background)'}; granted: ${await permissions(gc)}`;
});

await check('Browser restart', 'the default look (photograph) after switching back to All Spaces', async () => {
    await page.locator('#mode-switch').click();
    await page.locator('.menu button', { hasText: 'All Spaces' }).first().click();
    await page.waitForSelector('.backdrop-photo.is-ready', { timeout: 6000 });
    await sleep(800);
    shot(gc, '13-photo-after-restart');
    return 'Milky Way is shown again from the packaged file';
});

const errorsA = '';
await gc.context.close();

// =====================================================================================
// Profile B: an existing 1.x user
// =====================================================================================

const profileB = mkdtempSync(join(tmpdir(), 'bos-headed-b-'));
gc = await start(profileB);
await check('Upgrade summary', '1.x data present before the first tab', async () => {
    await gc.worker.evaluate(data => chrome.storage.local.set({ ntf_data: data, app_version: '1.2' }), LEGACY as never);
    const legacyBefore = (await gc.worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('ntf_data')).ntf_data))) as string;
    page = await freshTab(gc);
    await page.waitForSelector('.home');
    await page.waitForSelector('.migration', { timeout: 6000 });
    await sleep(900);
    const focused = focus(gc);
    const text = (await page.locator('.migration').innerText()).replace(/\s+/g, ' ');
    shot(gc, '14-upgrade-summary');
    const stored = await state(gc);
    const legacyStill = (await gc.worker.evaluate(async () => JSON.stringify((await chrome.storage.local.get('ntf_data')).ntf_data))) as string;
    return `no onboarding; summary reads: “${text}”; ${stored.spaceOrder.length} Spaces, ${Object.keys(stored.items).length} links, language ${stored.prefs.language}, theme ${stored.prefs.themeId}; 1.x data unchanged: ${legacyStill === legacyBefore}; focus: ${where(focused)}`;
});
await gc.context.close();

note('Scope', 'what was driven how',
    'New tabs were opened with a real Ctrl+T. Ctrl+K, “/”, M, Escape and typed text were real key presses sent to the Chrome window. The click that moves focus to the page was a real mouse click. '
    + 'Permission prompts were read and answered through Windows UI Automation (their real buttons). Clicks inside the page were sent by the test driver. '
    + `Chrome’s interface language on this machine is Turkish, so prompt texts are quoted in Turkish.${errorsA}`);

writeFileSync(join(OUT, 'headed-results.json'), JSON.stringify(outcomes, null, 2));
removeProfile(profileA);
removeProfile(profileB);
process.exit(report() ? 1 : 0);

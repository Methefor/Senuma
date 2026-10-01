/**
 * Runtime validation of the built extension inside a real Chromium.
 *
 *   npm run test:e2e
 *
 * Everything here runs against the unpacked extension through the new-tab override, with
 * real chrome.* APIs and a real profile on disk. Nothing is mocked.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { LEGACY } from '../src/core/fixtures';
import {
    DIST, DIST_GRANTED, check, expect, launch, newProfile, note, openNewTab, readStorage, removeProfile, report, waitForState, writeStorage,
    type Session,
} from './harness';

const plateNames = (page: Page) => page.locator('.plate .plate-name').allTextContents();
const settle = (page: Page, ms = 350) => page.waitForTimeout(ms);
const allErrors: string[] = [];

/** Switches Mode with the pointer (the "M" key is checked separately). */
async function switchMode(page: Page, name: string): Promise<void> {
    await page.locator('#mode-switch').click();
    await page.locator('.menu button', { hasText: name }).click();
}

/** Opens the command center and waits until its input has focus, as a person would see it. */
async function openPalette(page: Page): Promise<void> {
    await page.keyboard.press('Control+k');
    await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
}

async function completeOnboarding(page: Page, interests: string[], theme = 'Noir'): Promise<void> {
    await page.waitForSelector('.onboarding');
    for (const name of interests) await page.locator('.interest', { hasText: name }).click();
    await page.locator('.onboarding .button.is-primary').click();
    await page.locator('.theme-card', { hasText: theme }).click();
    await page.locator('.onboarding .button.is-primary').click();
    await page.locator('.choice', { hasText: 'Start fresh' }).click();
    await page.waitForSelector('.onboarding', { state: 'detached' });
}

// =====================================================================================
// 1. Fresh install, with the manifest exactly as it would ship
// =====================================================================================

async function freshInstall(): Promise<void> {
    const profile = newProfile();
    let session = await launch(DIST, profile);
    let page = await openNewTab(session);

    await check('Extension startup', 'unpacked extension loads and its service worker starts', async () => {
        expect(/^[a-p]{32}$/.test(session.extensionId), 'no extension id');
        return `Chromium ${session.context.browser()?.version() ?? ''}`;
    });

    await check('Extension startup', 'chrome://newtab is overridden by the extension page', async () => {
        const href = await page.evaluate(() => location.href);
        expect(href === `chrome-extension://${session.extensionId}/newtab.html`, `new tab opened ${href}`);
    });

    await check('Manifest', 'granted permissions are exactly storage + search', async () => {
        const granted = await page.evaluate(() => chrome.permissions.getAll());
        const permissions = (granted.permissions ?? []).filter(p => p !== 'newTabPageOverride').sort();
        expect(permissions.join() === 'search,storage', `granted: ${permissions.join()}`);
        expect((granted.origins ?? []).length === 0, 'host permissions were granted');
        return 'no host permissions; bookmarks, tabs, sessions not granted';
    });

    await check('Manifest', 'optional APIs are absent until asked for, and the page still works', async () => {
        const present = await page.evaluate(() => ({ bookmarks: !!chrome.bookmarks, sessions: !!chrome.sessions }));
        expect(!present.bookmarks && !present.sessions, `unexpected APIs: ${JSON.stringify(present)}`);
    });

    await check('Onboarding', 'a new user gets onboarding, not an empty page', async () => {
        await page.waitForSelector('.onboarding');
        expect((await page.locator('.interest').count()) === 11, 'expected 11 interest choices');
    });

    await check('Onboarding', 'three steps create Spaces, apply the theme and finish', async () => {
        await completeOnboarding(page, ['AI', 'Coding', 'Work', 'Movies & TV', 'Music']);
        const names = await plateNames(page);
        expect(names.join() === 'AI,Coding,Work,Movies & TV,Music', `Spaces: ${names.join()}`);
        expect((await page.evaluate(() => document.documentElement.style.getPropertyValue('--backdrop-color'))) === '#000000', 'Noir not applied');
        return `${names.length} Spaces, theme Noir`;
    });

    await check('Chrome storage', 'state is written to chrome.storage.local', async () => {
        const state = await waitForState(session, s => s.onboarded && s);
        expect(state.schema === 3 && state.spaceOrder.length === 5, 'unexpected stored state');
        expect(state.modeOrder.length === 3, `expected 3 starter Modes, got ${state.modeOrder.length}`);
        return `schema ${state.schema}, ${Object.keys(state.items).length} links, ${state.modeOrder.length} Modes`;
    });

    await check('Command center', 'Ctrl+K opens it, arrows move, Escape closes', async () => {
        await page.keyboard.press('Control+k');
        const input = page.locator('.overlay-palette input');
        await input.waitFor();
        expect(await input.evaluate(el => el === document.activeElement), 'input not focused');
        await page.keyboard.press('ArrowDown');
        expect((await page.locator('.result.is-active').count()) === 1, 'no active row');
        await page.keyboard.press('Escape');
        await page.waitForSelector('.overlay-palette', { state: 'detached' });
    });

    await check('Command center', 'fuzzy match finds a link ("gthb" → GitHub)', async () => {
        await openPalette(page);
        await page.keyboard.type('gthb');
        const first = await page.locator('.result').first().innerText();
        expect(/GitHub/.test(first), `first result: ${first}`);
        await page.keyboard.press('Escape');
    });

    await check('Command center', 'finds Spaces, Modes, settings pages and themes', async () => {
        await openPalette(page);
        const resultsFor = async (query: string) => {
            await page.locator('.overlay-palette input').fill(query);
            return (await page.locator('.result').allInnerTexts()).join(' | ');
        };
        expect(/Coding[\s\S]*Space/.test(await resultsFor('coding')), 'Space not found');
        expect(/Dev[\s\S]*Mode/.test(await resultsFor('dev')), 'Mode not found');
        expect(/Privacy/.test(await resultsFor('privacy')), 'settings page not found');
        expect(/Search YouTube for/.test(await resultsFor('youtube lofi')), 'engine by name not offered');
        await page.keyboard.press('Escape');
    });

    await check('Theme', 'switching theme from the command center applies and is stored', async () => {
        await openPalette(page);
        await page.keyboard.type('atelier');
        await page.keyboard.press('Enter');
        await waitForState(session, s => s.prefs.themeId === 'atelier');
        expect((await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))) === '#CFAE7C', 'accent not applied');
    });

    await check('Modes', 'switching Mode changes the Spaces on Home and is stored', async () => {
        await openPalette(page);
        await page.keyboard.type('switch to dev mode');
        await page.keyboard.press('Enter');
        const names = await plateNames(page);
        expect(names.join() === 'Coding,AI', `Dev Mode shows: ${names.join()}`);
        await waitForState(session, s => s.activeModeId && s.modes[s.activeModeId].name === 'Dev');
        expect(/Dev/.test(await page.locator('#mode-switch').innerText()), 'Mode switch does not show Dev');
        return 'Dev → Coding, AI';
    });

    await check('Modes', 'M opens the Mode menu; choosing one switches', async () => {
        await page.keyboard.press('m');
        await page.locator('.menu button', { hasText: 'Chill' }).click();
        expect((await plateNames(page)).join() === 'Movies & TV,Music', 'Chill Mode did not switch');
        await page.keyboard.press('m');
        await page.locator('.menu button', { hasText: 'All Spaces' }).click();
        expect((await plateNames(page)).length === 5, 'All Spaces did not restore');
    });

    await check('Modes', 'a Mode can carry its own theme, search engine and dock', async () => {
        const state = await readStorage<any>(session, 'bos.state');
        const devId = state.modeOrder.find((id: string) => state.modes[id].name === 'Dev');
        const github = Object.values<any>(state.items).find(i => i.title === 'GitHub').id;
        state.modes[devId] = { ...state.modes[devId], themeId: 'phosphor', providerId: 'github', dock: [{ kind: 'item', id: github }] };
        state.updatedAt = Date.now();
        await writeStorage(session, { 'bos.state': state });
        await settle(page);
        await switchMode(page, 'Dev');
        expect((await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))) === '#6CF5A2', 'Mode theme not applied');
        expect((await page.locator('.dock .dock-item').count()) === 1, 'Mode dock not shown');
        await page.locator('#home-search').fill('preact signals');
        expect(/Search GitHub for/.test(await page.locator('.result').first().innerText()), 'Mode search engine not used');
        await page.locator('#home-search').fill('');
        return 'Dev → Phosphor theme, GitHub search, own dock';
    });

    await check('Persistence', 'a second new tab shows the same Spaces, theme and Mode', async () => {
        const second = await openNewTab(session);
        expect((await plateNames(second)).join() === 'Coding,AI', 'Mode not carried to a new tab');
        expect((await second.evaluate(() => document.documentElement.style.getPropertyValue('--accent'))) === '#6CF5A2', 'theme not carried');
        await second.close();
    });

    await check('Cross-tab sync', 'a change in one tab appears in another open tab without reload', async () => {
        const second = await openNewTab(session);
        await page.bringToFront();
        await switchMode(page, 'All Spaces');
        await page.locator('.deck-head .quiet-button').click();
        await page.locator('.overlay-form input').first().fill('Travel');
        await page.locator('.overlay-form button[type=submit]').click();
        await page.keyboard.press('Escape');
        await second.waitForFunction(() => [...document.querySelectorAll('.plate-name')].some(n => n.textContent === 'Travel'), null, { timeout: 5000 });
        expect((await plateNames(second)).length === 6, 'second tab did not receive the new Space');
        await second.close();
    });

    await check('Space', 'paste-to-add, filter and arrow-key navigation work', async () => {
        await page.locator('.plate', { hasText: 'Travel' }).click();
        const field = page.locator('#space-filter');
        await field.fill('booking.com');
        await page.keyboard.press('Enter');
        await field.fill('airbnb.com');
        await page.keyboard.press('Enter');
        expect((await page.locator('.space .tile:not(.tile-add)').count()) === 2, 'links not added');
        await field.fill('air');
        expect((await page.locator('.space .tile:not(.tile-add)').count()) === 1, 'filter did not narrow');
        await field.fill('');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowRight');
        expect(/Airbnb/.test(await page.evaluate(() => document.activeElement?.textContent ?? '')), 'arrow keys did not move focus');
        await page.keyboard.press('Escape');
    });

    await check('Context menus', 'right-click a Space → Add to dock; the dock shows it', async () => {
        const before = await page.locator('.dock .dock-item').count();
        await page.locator('.plate', { hasText: 'Travel' }).click({ button: 'right' });
        await page.locator('.menu button', { hasText: 'Add to dock' }).click();
        expect((await page.locator('.dock .dock-item').count()) === before + 1, 'dock did not gain the Space');
    });

    await check('Home', 'keyboard reorder (Alt+→) moves a Space and persists', async () => {
        await page.locator('.plate', { hasText: 'AI' }).focus();
        await page.keyboard.press('Alt+ArrowRight');
        const names = await plateNames(page);
        expect(names[0] === 'Coding' && names[1] === 'AI', `order: ${names.join()}`);
        await waitForState(session, s => s.spaces[s.spaceOrder[1]].name === 'AI');
    });

    await check('Home', 'drag reorder moves a Space and persists', async () => {
        await page.locator('.plate', { hasText: 'Music' }).dragTo(page.locator('.plate', { hasText: 'Coding' }), { targetPosition: { x: 10, y: 40 } });
        const names = await plateNames(page);
        expect(names[0] === 'Music', `order after drag: ${names.join()}`);
        await waitForState(session, s => s.spaces[s.spaceOrder[0]].name === 'Music');
    });

    await check('Home', 'an interrupted drag (dropped outside) changes nothing', async () => {
        const before = (await plateNames(page)).join();
        await page.locator('.plate', { hasText: 'Work' }).dragTo(page.locator('.clock'));
        expect((await plateNames(page)).join() === before, 'order changed after a cancelled drag');
        expect((await page.locator('.plate.is-dragging, .plate.is-drop-before, .plate.is-drop-after').count()) === 0, 'drag state left behind');
    });

    await check('Undo', 'deleting a Space can be undone with everything in it', async () => {
        await page.locator('.plate', { hasText: 'Travel' }).click({ button: 'right' });
        await page.locator('.menu button', { hasText: 'Delete' }).click();
        expect(!(await plateNames(page)).includes('Travel'), 'Space was not deleted');
        await page.locator('.toast-action').click();
        expect((await plateNames(page)).includes('Travel'), 'Space was not restored');
        const state = await waitForState(session, s => Object.values<any>(s.spaces).some(sp => sp.name === 'Travel') && s);
        const travel = Object.values<any>(state.spaces).find(sp => sp.name === 'Travel');
        expect(travel.groups[0].itemIds.length === 2, 'restored Space lost its links');
        expect(state.dock.some((e: any) => e.kind === 'space' && e.id === travel.id), 'restored Space lost its dock entry');
    });

    let exported = '';
    await check('Export', 'export downloads a versioned, valid backup file', async () => {
        await page.locator('.topbar .icon-button').click();
        await page.locator('.settings-nav button', { hasText: 'Data' }).click();
        const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.row', { hasText: 'Export your setup' }).locator('.button').click()]);
        const file = join(profile, 'backup.json');
        await download.saveAs(file);
        exported = readFileSync(file, 'utf8');
        const parsed = JSON.parse(exported);
        expect(parsed.kind === 'browser-os-backup' && parsed.schema === 3, 'missing kind/schema');
        expect(parsed.state.recents.length === 0, 'backup contains activity');
        return `${download.suggestedFilename()}, schema ${parsed.schema}, ${parsed.state.spaceOrder.length} Spaces`;
    });

    await check('Import', 'an unreadable file is rejected and nothing changes', async () => {
        const bad = join(profile, 'bad.json');
        writeFileSync(bad, '{"kind":"browser-os-backup","schema":3,"state":{"spaces":"nope"}}');
        const before = await readStorage<any>(session, 'bos.state');
        await page.locator('.settings-body input[type=file]').setInputFiles(bad);
        await page.locator('.toast', { hasText: 'not a readable backup' }).waitFor();
        const after = await readStorage<any>(session, 'bos.state');
        expect(after.updatedAt === before.updatedAt, 'state changed after a rejected import');
    });

    await check('Import', 'merge adds what is missing and removes nothing', async () => {
        const incoming = JSON.parse(exported);
        const firstSpace = incoming.state.spaces[incoming.state.spaceOrder[0]];
        incoming.state.items.extra1 = { id: 'extra1', title: 'Bandcamp Daily', url: 'https://daily.bandcamp.com/', createdAt: 1 };
        firstSpace.groups[0].itemIds.push('extra1');
        const file = join(profile, 'merge.json');
        writeFileSync(file, JSON.stringify(incoming));
        const before = await readStorage<any>(session, 'bos.state');
        await page.locator('.settings-body input[type=file]').setInputFiles(file);
        await page.locator('.choice', { hasText: 'Merge into my setup' }).click();
        const after = await waitForState(session, s => Object.keys(s.items).length === Object.keys(before.items).length + 1 && s);
        expect(after.spaceOrder.length === before.spaceOrder.length, 'merge created duplicate Spaces');
    });

    await check('Import', 'replace saves a restore point first, then replaces', async () => {
        const smaller = JSON.parse(exported);
        const keep = smaller.state.spaceOrder[0];
        smaller.state.spaceOrder = [keep];
        smaller.state.spaces = { [keep]: smaller.state.spaces[keep] };
        const file = join(profile, 'replace.json');
        writeFileSync(file, JSON.stringify(smaller));
        const before = await readStorage<any>(session, 'bos.state');
        await page.locator('.settings-body input[type=file]').setInputFiles(file);
        await page.locator('.choice', { hasText: 'Replace my setup' }).click();
        await waitForState(session, s => s.spaceOrder.length === 1);
        const snapshots = await readStorage<any[]>(session, 'bos.snapshots');
        expect(snapshots?.length === 1 && snapshots[0].reason === 'import', 'no restore point saved');
        expect(snapshots[0].state.spaceOrder.length === before.spaceOrder.length, 'restore point does not hold the previous setup');
    });

    await check('Backup', 'restoring a restore point brings the previous setup back', async () => {
        await page.locator('.list-row .button', { hasText: 'Restore' }).first().click();
        const state = await waitForState(session, s => s.spaceOrder.length === 6 && s);
        expect(Object.values<any>(state.spaces).some(sp => sp.name === 'Travel'), 'restored setup is missing a Space');
        const snapshots = await readStorage<any[]>(session, 'bos.snapshots');
        expect(snapshots?.length === 2, 'restoring did not snapshot the state it replaced');
        await page.keyboard.press('Escape');
    });

    await check('Search', 'a shortcut routes to its engine with the query encoded ("y lofi & chill")', async () => {
        const tab = await openNewTab(session);
        await tab.locator('#home-search').fill('y lofi & chill');
        await Promise.all([tab.waitForURL(/youtube\.com\/results/, { timeout: 15_000 }), tab.keyboard.press('Enter')]);
        // The site may re-encode the address after loading; what matters is the query it received.
        const received = new URL(tab.url()).searchParams.get('search_query');
        expect(received === 'lofi & chill', `YouTube received: ${received}`);
        await tab.close();
        return 'YouTube received the query "lofi & chill" intact';
    });

    await check('Search', 'the default search goes through chrome.search (browser default engine)', async () => {
        const tab = await openNewTab(session);
        await tab.locator('#home-search').fill('preact hooks tutorial');
        await Promise.all([tab.waitForURL(url => !url.protocol.startsWith('chrome'), { timeout: 15_000 }), tab.keyboard.press('Enter')]);
        const url = new URL(tab.url());
        expect(/google\./.test(url.hostname), `landed on ${url.hostname}`);
        expect(decodeURIComponent(tab.url()).includes('preact hooks tutorial') || decodeURIComponent(tab.url()).includes('preact+hooks+tutorial'), 'query not passed');
        await tab.close();
        return `→ ${url.hostname} (this profile's default engine)`;
    });

    await check('Search', 'an address goes straight to the site', async () => {
        const tab = await openNewTab(session);
        await tab.locator('#home-search').fill('example.com');
        await Promise.all([tab.waitForURL(/example\.com/, { timeout: 15_000 }), tab.keyboard.press('Enter')]);
        await tab.close();
    });

    await check('Opening links', 'clicking a link navigates and is remembered for Continue', async () => {
        const tab = await openNewTab(session);
        await tab.locator('.plate', { hasText: 'Travel' }).click();
        await Promise.all([tab.waitForURL(/booking\.com/, { timeout: 20_000, waitUntil: 'commit' }), tab.locator('.tile', { hasText: 'Booking' }).click()]);
        await tab.close();
        const state = await waitForState(session, s => s.recents.length > 0 && s);
        expect(/booking\.com/.test(state.recents[0].url) && state.recents[0].count === 1, 'recent not recorded');
        const home = await openNewTab(session);
        expect(/Booking/.test(await home.locator('.continue').innerText()), 'Continue does not list the link');
        await home.close();
        return 'Continue lists it; only links opened from this page are recorded';
    });

    await check('Startup', 'time from navigation to a mounted, usable Home', async () => {
        const samples: number[] = [];
        for (let i = 0; i < 7; i++) {
            const tab = await openNewTab(session);
            samples.push(await tab.evaluate(() => performance.getEntriesByName('app:mounted')[0]?.startTime ?? -1));
            await tab.close();
        }
        const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]!;
        expect(median(samples) > 0 && median(samples) < 400, `median mount ${median(samples)}ms`);
        return `median ${Math.round(median(samples))} ms, slowest ${Math.round(Math.max(...samples))} ms (7 new tabs, headless Chromium)`;
    });

    const before = await readStorage<any>(session, 'bos.state');
    allErrors.push(...session.errors);
    await session.context.close();

    // ---- Browser restart ----
    session = await launch(DIST, profile);
    page = await openNewTab(session);
    await check('Persistence', 'everything survives a full browser restart', async () => {
        const after = await readStorage<any>(session, 'bos.state');
        expect(JSON.stringify(after.spaces) === JSON.stringify(before.spaces), 'Spaces differ after restart');
        expect(after.prefs.themeId === before.prefs.themeId && after.activeModeId === before.activeModeId, 'theme or Mode differ after restart');
        expect((await plateNames(page)).length === 6, 'Home does not show the Spaces after restart');
        expect((await readStorage<any[]>(session, 'bos.snapshots'))?.length === 2, 'restore points lost');
        return `${after.spaceOrder.length} Spaces, theme ${after.prefs.themeId}, restore points intact`;
    });

    // Reloading goes through chrome://extensions, exactly like the Reload button. Unpacked
    // extensions are disabled on reload unless developer mode is on, as on a real machine.
    const extensionsPage = await session.context.newPage();
    await extensionsPage.goto('chrome://extensions/');
    const developer = (action: string) => extensionsPage.evaluate(
        async ([id, what]) => {
            const api = (chrome as any).developerPrivate;
            if (what === 'reload') {
                await api.updateProfileConfiguration({ inDeveloperMode: true });
                await api.reload(id, { failQuietly: true });
            }
            const info = await api.getExtensionInfo(id);
            return { state: info.state as string, problems: [...(info.manifestErrors ?? []), ...(info.installWarnings ?? []), ...(info.runtimeErrors ?? [])].length };
        },
        [session.extensionId, action] as const,
    );

    await check('Manifest', 'Chrome reports no manifest errors, install warnings or runtime errors', async () => {
        const info = await developer('inspect');
        expect(info.state === 'ENABLED' && info.problems === 0, JSON.stringify(info));
    });

    await check('Persistence', 'everything survives an extension reload', async () => {
        await developer('reload');
        // The extension reports itself disabled for a moment while it restarts.
        await extensionsPage.waitForTimeout(1500);
        const info = await developer('inspect');
        expect(info.state === 'ENABLED', `after reload the extension is ${info.state}`);
        const reloaded = await openNewTab(session);
        expect((await plateNames(reloaded)).length === 6, 'Spaces missing after extension reload');
        const after = await readStorage<any>(session, 'bos.state');
        expect(JSON.stringify(after.spaces) === JSON.stringify(before.spaces), 'state changed across extension reload');
        await reloaded.close();
    });

    allErrors.push(...session.errors);
    await session.context.close();
    removeProfile(profile);
}

// =====================================================================================
// 2. Upgrade from New Tab Folders 1.x
// =====================================================================================

async function legacyUpgrade(): Promise<void> {
    const profile = newProfile();
    const session = await launch(DIST, profile);
    // What a 1.x install leaves behind.
    await writeStorage(session, { ntf_data: LEGACY, app_version: '1.2' });
    const legacyBefore = JSON.stringify(await readStorage(session, 'ntf_data'));

    const page = await openNewTab(session);

    await check('Legacy migration', 'a 1.x install is converted; new-user onboarding is skipped', async () => {
        expect((await page.locator('.onboarding').count()) === 0, 'onboarding was shown to an upgrading user');
        const names = await plateNames(page);
        expect(names.join() === 'Ai Tools,Ai Tools,Untitled', `Spaces: ${names.join()}`);
        return '3 folders → 3 Spaces (including a duplicate-named folder, kept separately)';
    });

    await check('Legacy migration', 'the upgrade summary shows what happened', async () => {
        const text = await page.locator('.migration').innerText();
        expect(/3 klasör → 3 Alan/.test(text) && /5 bağlantı/.test(text) && /2 grup/.test(text) && /4 öğe atlandı/.test(text), text.replace(/\n/g, ' / '));
        return 'shown in the user\'s 1.x language (Turkish): 3 → 3, 5 links, 2 groups, 4 skipped';
    });

    await check('Legacy migration', 'preferences carry over (theme, language, link behaviour, icons)', async () => {
        const state = await waitForState(session, s => s.legacy && s);
        expect(state.prefs.themeId === 'fjord' && state.prefs.language === 'tr' && state.prefs.openInNewTab === true, JSON.stringify(state.prefs));
        expect(state.prefs.iconSource === 'service' && state.legacy.isPro === true, 'icon behaviour or entitlement not carried');
    });

    await check('Legacy migration', 'the legacy source data is untouched', async () => {
        expect(JSON.stringify(await readStorage(session, 'ntf_data')) === legacyBefore, 'ntf_data was modified');
        expect((await readStorage(session, 'app_version')) === '1.2', 'app_version was modified');
    });

    await check('Legacy migration', 'idempotent: reopening never converts again or duplicates anything', async () => {
        const first = await readStorage<any>(session, 'bos.state');
        for (let i = 0; i < 3; i++) {
            const tab = await openNewTab(session);
            expect((await plateNames(tab)).length === 3, `tab ${i + 1} shows a different number of Spaces`);
            await tab.close();
        }
        const again = await readStorage<any>(session, 'bos.state');
        expect(JSON.stringify(again.spaceOrder) === JSON.stringify(first.spaceOrder), 'Space IDs changed: migration ran again');
        expect(Object.keys(again.items).length === 5, 'links were duplicated');
    });

    await check('Legacy migration', 'edits made after upgrading are never overwritten by legacy data', async () => {
        await page.locator('.plate').nth(2).click({ button: 'right' });
        await page.locator('.menu button').last().click();
        await waitForState(session, s => s.spaceOrder.length === 2);
        const tab = await openNewTab(session);
        expect((await plateNames(tab)).length === 2, 'deleted Space came back from legacy data');
        await tab.close();
    });

    await check('Legacy migration', '"Review setup" opens Spaces and the summary does not return', async () => {
        await page.locator('.migration .button.is-primary').click();
        await page.waitForSelector('.overlay-settings');
        await page.keyboard.press('Escape');
        expect((await page.locator('.migration').count()) === 0, 'summary still shown');
        const tab = await openNewTab(session);
        await settle(tab, 700);
        expect((await tab.locator('.migration').count()) === 0, 'summary returned in a new tab');
        await tab.close();
    });

    allErrors.push(...session.errors);
    await session.context.close();
    removeProfile(profile);
}

// =====================================================================================
// 3. Optional-permission features. Chrome's permission prompt cannot be clicked by an
//    automated test, so this build declares those permissions up front (see manifest.ts).
//    It exercises the same adapter code, minus the prompt itself.
// =====================================================================================

async function optionalFeatures(): Promise<void> {
    const profile = newProfile();
    const session: Session = await launch(DIST_GRANTED, profile);

    await session.worker.evaluate(async () => {
        const folder = await chrome.bookmarks.create({ title: 'Reading' });
        await chrome.bookmarks.create({ parentId: folder.id, title: 'A blog', url: 'https://blog.example.org/' });
        await chrome.bookmarks.create({ title: 'GitLab', url: 'https://gitlab.com/' });
        await chrome.bookmarks.create({ title: 'Figma', url: 'https://www.figma.com/' });
        await chrome.bookmarks.create({ title: 'Broken', url: 'javascript:void(0)' });
    });

    const page = await openNewTab(session);

    await check('Bookmark import', 'onboarding reads real bookmarks, sorts them and lets the user review', async () => {
        await page.waitForSelector('.onboarding');
        await page.locator('.interest', { hasText: 'Coding' }).click();
        await page.locator('.onboarding .button.is-primary').click();
        await page.locator('.onboarding .button.is-primary').click();
        await page.locator('.choice', { hasText: 'Import browser bookmarks' }).click();
        const review = await page.locator('.review-list').innerText();
        expect(/Coding[\s\S]*1 link/.test(review) && /Design[\s\S]*1 link/.test(review) && /Bookmarks[\s\S]*1 link/.test(review), review.replace(/\n/g, ' / '));
        return 'Coding 1, Design 1, Bookmarks 1; javascript: bookmark dropped';
    });

    await check('Bookmark import', 'applying merges into existing Spaces and creates new ones', async () => {
        await page.locator('.review .button.is-primary').click();
        await page.waitForSelector('.onboarding', { state: 'detached' });
        const state = await waitForState(session, s => s.onboarded && s);
        const names = state.spaceOrder.map((id: string) => state.spaces[id].name);
        expect(names.join() === 'Coding,Design,Bookmarks', `Spaces: ${names.join()}`);
        const coding = state.spaces[state.spaceOrder[0]];
        expect(coding.groups.at(-1).name === 'Imported', 'imported links did not get their own group');
        expect(state.spaces[state.spaceOrder[2]].groups[0].name === 'Reading', 'bookmark folder name not kept');
        const tree = await session.worker.evaluate(() => chrome.bookmarks.search({}));
        expect(tree.filter(b => b.url).length === 4, 'the browser bookmarks themselves were modified');
    });

    await check('Recently closed', 'turning it on shows closed tabs in Continue; nothing is stored', async () => {
        const site = await session.context.newPage();
        await site.goto('https://example.com/');
        await site.close();
        await page.locator('.topbar .icon-button').click();
        await page.locator('.settings-nav button', { hasText: 'Privacy' }).click();
        await page.locator('.row', { hasText: 'recently closed tabs' }).locator('.switch').click();
        await waitForState(session, s => s.prefs.showClosedTabs === true);
        await page.keyboard.press('Escape');
        const tab = await openNewTab(session);
        await tab.locator('.continue-link', { hasText: 'Example Domain' }).waitFor({ timeout: 5000 });
        const state = await readStorage<any>(session, 'bos.state');
        expect(state.recents.length === 0, 'closed tabs were written into stored state');
        await tab.close();
    });

    await check('Recently closed', 'clicking one restores the tab through chrome.sessions', async () => {
        const tab = await openNewTab(session);
        const [restored] = await Promise.all([
            session.context.waitForEvent('page', { timeout: 10_000 }),
            tab.locator('.continue-link', { hasText: 'Example Domain' }).click(),
        ]);
        await restored.waitForURL(/example\.com/);
        await tab.close();
    });

    allErrors.push(...session.errors);
    await session.context.close();
    removeProfile(profile);
}

await freshInstall();
await legacyUpgrade();
await optionalFeatures();

await check('Console', 'no errors or uncaught exceptions on any extension page during the run', async () => {
    expect(allErrors.length === 0, allErrors.slice(0, 5).join(' || '));
});

note('Not automatable', 'the browser permission prompt itself (bookmarks, recently closed tabs)',
    'chrome.permissions.request() waits for a human click. The request path is covered up to the prompt; granting it needs one manual check.');
note('Not automatable', 'address-bar focus on a fresh new tab',
    'Chrome keeps keyboard focus in the address bar when a new tab opens, so Ctrl+K and "/" reach the page only after the page is clicked or focused. Needs a manual check in a real window.');

process.exit(report() ? 1 : 0);

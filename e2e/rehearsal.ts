/**
 * Release rehearsal: a real 1.x install, with realistic data, updated in place to this build.
 *
 *   npm run rehearse
 *
 * The published 1.x files (repository root) and the V2 build are loaded from the SAME folder,
 * under the SAME extension ID (a throw-away manifest `key`), in the SAME browser profile, so
 * the browser treats the swap as an update: storage and granted permissions carry over, the
 * way they do for a Chrome Web Store update. Nothing here touches the repository or the store.
 */
import { generateKeyPairSync, createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { AppState } from '../src/core/types';
import { DIST, check, expect, launch, note, removeProfile, report, type Session } from './harness';

const root = mkdtempSync(join(tmpdir(), 'bos-rehearsal-'));
const extension = join(root, 'extension');
const profile = join(root, 'profile');
mkdirSync(profile);

// One key for both versions: the browser derives the extension ID from it.
/**
 * The published build, read from this machine's own Chrome profile when it is installed there
 * (pass its folder in NTF_LIVE_BUILD to override). It carries the store key, so the rehearsal
 * runs under the real extension ID. Without it, the 1.x files in the repository root are used.
 */
const LIVE_CANDIDATES = [process.env.NTF_LIVE_BUILD, ...['Profile 1', 'Default'].map(p => join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/User Data', p, 'Extensions/oghlifenjhpbebcdeboejbmemelkfobe'))]
    .filter((p): p is string => !!p && existsSync(p))
    .map(p => (existsSync(join(p, 'manifest.json')) ? p : join(p, readdirSync(p).sort().at(-1)!)));
const LIVE = LIVE_CANDIDATES[0];
const liveKey = LIVE ? (JSON.parse(readFileSync(join(LIVE, 'manifest.json'), 'utf8')).key as string | undefined) : undefined;
const der = liveKey ? Buffer.from(liveKey, 'base64') : generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey.export({ type: 'spki', format: 'der' });
const key = der.toString('base64');
const expectedId = [...createHash('sha256').update(der).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');

function install(version: 'legacy' | 'v2'): { version: string; permissions: string[] } {
    rmSync(extension, { recursive: true, force: true });
    mkdirSync(extension);
    if (version === 'legacy' && LIVE) {
        cpSync(LIVE, extension, { recursive: true });
        rmSync(join(extension, '_metadata'), { recursive: true, force: true });
    } else if (version === 'legacy') {
        for (const entry of ['index.html', 'js', 'css', 'assets/icons', 'changelog.html', 'guide.html']) cpSync(entry, join(extension, entry), { recursive: true });
        writeFileSync(join(extension, 'manifest.json'), JSON.stringify({ ...JSON.parse(readFileSync('manifest.json', 'utf8')), key }, null, 2));
    } else {
        cpSync(DIST, extension, { recursive: true });
        writeFileSync(join(extension, 'manifest.json'), JSON.stringify({ ...JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8')), key }, null, 2));
    }
    const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
    return { version: manifest.version, permissions: manifest.permissions };
}

// ---------- A realistic 1.x setup ----------

const favicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
const link = (id: string, title: string, url: string, icon?: string) => ({ id, title, url, ...(icon ? { icon } : {}) });
const header = (id: string, title: string) => ({ id, title, type: 'header' });
const sites: Record<string, [string, string][]> = {
    'AI Tools': [['ChatGPT', 'chatgpt.com'], ['Claude', 'claude.ai'], ['Gemini', 'gemini.google.com'], ['Perplexity', 'www.perplexity.ai'], ['Midjourney', 'www.midjourney.com'], ['Hugging Face', 'huggingface.co'], ['ElevenLabs', 'elevenlabs.io']],
    'Yazılım': [['GitHub', 'github.com'], ['Stack Overflow', 'stackoverflow.com'], ['Vercel', 'vercel.com'], ['npm', 'www.npmjs.com'], ['MDN', 'developer.mozilla.org'], ['Supabase', 'supabase.com'], ['Localhost', 'localhost:3000'], ['Cloudflare', 'dash.cloudflare.com']],
    'İş': [['Gmail', 'mail.google.com'], ['Takvim', 'calendar.google.com'], ['Drive', 'drive.google.com'], ['Notion', 'www.notion.so'], ['Slack', 'app.slack.com'], ['Trello', 'trello.com'], ['Zoom', 'zoom.us']],
    'Sosyal': [['X', 'x.com'], ['Instagram', 'www.instagram.com'], ['Reddit', 'www.reddit.com'], ['LinkedIn', 'www.linkedin.com'], ['WhatsApp', 'web.whatsapp.com'], ['YouTube', 'www.youtube.com']],
    'Eğlence 🎬': [['Netflix', 'www.netflix.com'], ['Spotify', 'open.spotify.com'], ['Twitch', 'www.twitch.tv'], ['BluTV', 'www.blutv.com'], ['Letterboxd', 'letterboxd.com'], ['IMDb', 'www.imdb.com']],
    'Alışveriş': [['Trendyol', 'www.trendyol.com'], ['Hepsiburada', 'www.hepsiburada.com'], ['Amazon', 'www.amazon.com.tr'], ['Sahibinden', 'www.sahibinden.com'], ['AliExpress', 'www.aliexpress.com']],
    'Finans': [['TradingView', 'www.tradingview.com'], ['Investing', 'www.investing.com'], ['Binance', 'www.binance.com'], ['CoinMarketCap', 'coinmarketcap.com'], ['Yahoo Finance', 'finance.yahoo.com']],
    'Okuma listesi': [['Hacker News', 'news.ycombinator.com'], ['Medium', 'medium.com'], ['Wikipedia', 'www.wikipedia.org'], ['arXiv', 'arxiv.org'], ['Substack', 'substack.com'], ['Ekşi Sözlük', 'eksisozluk.com']],
    'Tasarım': [['Figma', 'www.figma.com'], ['Dribbble', 'dribbble.com'], ['Behance', 'www.behance.net'], ['Coolors', 'coolors.co']],
};
let serial = 0;
const colors = ['blue', 'purple', 'green', 'orange', 'pink', 'red', 'teal', 'yellow', 'gray'];
const folders: unknown[] = Object.entries(sites).map(([name, entries], index) => {
    const links: unknown[] = [];
    entries.forEach(([title, host], position) => {
        // Folders with five or more links are split by a header, as people did in 1.x.
        if (entries.length >= 6 && position === 0) links.push(header(`h${serial++}`, 'Sık kullanılan'));
        if (entries.length >= 6 && position === 3) links.push(header(`h${serial++}`, 'Diğer'));
        const icon = position % 3 === 0 ? favicon(host.split(':')[0]!) : position % 3 === 1 ? undefined : ['📁', '⭐', '🔥', '💼'][position % 4];
        // 1.x stored addresses both with and without a scheme.
        links.push(link(`l${serial++}`, title, position % 2 ? host : `https://${host}`, icon));
    });
    return { id: `f${index + 1}`, name, color: colors[index % colors.length], links };
});
// The kinds of damage a working 1.x install can actually hold. (Shapes that crash 1.x itself,
// such as a null link or a folder that is not an object, are covered by the unit tests.)
(folders[0] as { links: unknown[] }).links.push(
    link('bad1', 'Boş adres', '#'), link('bad2', 'Betik', 'javascript:alert(1)'), link('bad3', 'Yerel dosya', 'file:///C:/notes.html'),
    { id: 'note1', title: 'Yapışkan not', type: 'note', url: 'https://example.org' }, link('l0', 'Aynı kimlik', 'https://duplicate-id.example.com'), link('l0', 'Aynı kimlik 2', 'https://duplicate-id-2.example.com'),
);
folders.push({ id: 'f1', name: 'AI Tools', color: 'blue', links: [link('dup', 'Claude', 'https://claude.ai')] }); // duplicate id and name
folders.push({ id: 'f-empty', name: '', links: [] });

(folders[1] as { pinned?: boolean }).pinned = true;
const LEGACY_DATA = { licenseKey: 'TEST-KEY-0000', quickBarLinks: [{ id: 'q1', title: 'GitHub', url: 'https://github.com', icon: '' }, { id: 'q2', title: 'Spotify', url: 'https://open.spotify.com', icon: '' }], updatedAt: 1, folders, isPro: true, proExpiresAt: Date.now() + 200 * 86_400_000, theme: 'light', tutorialCompleted: true, sidebarCollapsed: true, tabsSortOrder: 'recent', language: 'TR' };
const validLinks = Object.values(sites).flat().length + 3; // + the two colliding-id links and the duplicate folder's link
const realFolders = Object.keys(sites).length;

const storage = <T>(session: Session, keys: string[] | null): Promise<T> => session.worker.evaluate(k => chrome.storage.local.get(k), keys) as Promise<T>;
const allPermissions = (session: Session): Promise<string[]> => session.worker.evaluate(async () => (await chrome.permissions.getAll()).permissions ?? []) as Promise<string[]>;

let legacySnapshot = '';
let migratedAt = 0;
let v2Stamp = 0;

// ---------- 1. Install 1.x and populate it ----------
{
    const installed = install('legacy');
    const session = await launch(extension, profile);
    await check('1.x install', 'the published 1.x files load under the rehearsal ID', async () => {
        expect(session.extensionId === expectedId, `ID ${session.extensionId}, expected ${expectedId}`);
        return `version ${installed.version}, ID ${session.extensionId}, permissions ${installed.permissions.join(', ')}`;
    });
    await check('1.x install', `populated with ${realFolders} real folders (+ damaged ones), headers and ${validLinks} valid links`, async () => {
        await session.worker.evaluate(data => chrome.storage.local.set({ ntf_data: data, app_version: '1.2' }), LEGACY_DATA);
        const page = await session.context.newPage();
        await page.goto('chrome://newtab/');
        await page.waitForSelector('.folder-card', { timeout: 10_000 });
        const shown = await page.locator('.folder-card').count();
        expect(shown >= realFolders, `1.x shows only ${shown} folders`);
        await page.screenshot({ path: 'e2e/.out/rehearsal-1-legacy.png' });
        await page.close();
        const stored = await storage<{ ntf_data: unknown }>(session, ['ntf_data']);
        legacySnapshot = JSON.stringify(stored.ntf_data);
        return `1.x renders ${shown} folders from this data (theme light, language TR, PRO flag set)`;
    });
    await session.context.close();
}

// ---------- 2. Update in place ----------
{
    const installed = install('v2');
    let session = await launch(extension, profile);
    await check('Update', 'same ID, same profile: the browser treats it as an update', async () => {
        expect(session.extensionId === expectedId, `ID changed to ${session.extensionId}`);
        const manifest = await session.worker.evaluate(() => chrome.runtime.getManifest()) as { version: string; version_name?: string };
        expect(manifest.version === installed.version, `running ${manifest.version}`);
        return `now ${manifest.version} (${manifest.version_name})`;
    });

    await check('Update', 'permissions after the update', async () => {
        const granted = await allPermissions(session);
        return `granted now: ${granted.sort().join(', ')} (1.x required storage, tabs, sessions; V2 requires storage, search and makes tabs, sessions, bookmarks optional)`;
    });

    const page = await session.context.newPage();
    await check('Migration', 'the first new tab shows Home with the converted setup, not onboarding', async () => {
        await page.goto('chrome://newtab/');
        await page.waitForSelector('.home', { timeout: 10_000 });
        expect((await page.locator('.onboarding').count()) === 0, 'onboarding was shown to an existing user');
        await page.waitForSelector('.migration');
        await page.waitForTimeout(900);
        await page.screenshot({ path: 'e2e/.out/rehearsal-2-after-update.png' });
        return (await page.locator('.migration').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    });

    await check('Migration', 'every real folder is a Space; every valid link is kept; damaged entries are skipped and counted', async () => {
        const state = (await storage<{ 'bos.state': AppState }>(session, ['bos.state']))['bos.state'];
        const spaceNames = state.spaceOrder.map(id => state.spaces[id]!.name);
        for (const name of Object.keys(sites)) expect(spaceNames.includes(name), `Space “${name}” is missing`);
        const links = Object.keys(state.items).length;
        expect(links === validLinks, `${links} links kept, expected ${validLinks}`);
        const urls = Object.values(state.items).map(item => item.url);
        expect(urls.every(url => /^https?:\/\//.test(url)), 'an unsafe or relative address survived');
        const groups = Object.values(state.spaces).reduce((sum, space) => sum + space.groups.filter(group => group.name).length, 0);
        expect(groups >= 10, `only ${groups} named groups from headers`);
        const summary = state.legacy!.summary;
        migratedAt = state.legacy!.migratedAt;
        expect(summary.links === links && summary.spaces === state.spaceOrder.length, `summary says ${JSON.stringify(summary)}`);
        return `${state.spaceOrder.length} Spaces, ${links} links, ${groups} named groups, ${summary.skipped} entries skipped (reported to the user)`;
    });

    await check('Migration', 'theme, language, icon behaviour and entitlement carry over', async () => {
        const state = (await storage<{ 'bos.state': AppState }>(session, ['bos.state']))['bos.state'];
        const scheme = await page.evaluate(() => document.documentElement.dataset.scheme);
        expect(scheme === 'light', `light theme became ${state.prefs.themeId} (${scheme})`);
        expect(state.prefs.language === 'tr', `language ${state.prefs.language}`);
        expect(state.prefs.iconSource === 'service', `icon source ${state.prefs.iconSource}`);
        expect(state.legacy?.isPro === true && typeof state.legacy.proExpiresAt === 'number', 'PRO entitlement not recorded');
        const emoji = Object.values(state.items).filter(item => item.icon && !/^https?:/.test(item.icon)).length;
        const iconUrls = Object.values(state.items).filter(item => item.icon && /^https?:/.test(item.icon)).length;
        return `theme ${state.prefs.themeId}, language tr, icons “service” (as in 1.x), PRO recorded; ${emoji} emoji icons kept, ${iconUrls} stored icon addresses`;
    });

    await check('Legacy data', 'the 1.x data is byte-for-byte what it was', async () => {
        const stored = await storage<{ ntf_data: unknown; app_version: string }>(session, ['ntf_data', 'app_version']);
        expect(JSON.stringify(stored.ntf_data) === legacySnapshot, 'ntf_data changed');
        expect(stored.app_version === '1.2', 'app_version changed');
    });

    // ---------- 3. Restart, edit, reload ----------
    await check('After the update', 'dismiss the summary, add a Space, restart the browser: everything is there, nothing converts again', async () => {
        await page.locator('.migration-actions button').last().click();
        await page.locator('.deck-head .quiet-button').click();
        await page.locator('.overlay-form input').first().fill('V2 ile eklendi');
        await page.locator('.overlay-form button[type=submit]').click();
        await page.waitForSelector('.overlay-space');
        await page.keyboard.press('Escape');
        await page.waitForTimeout(700);
        const before = (await storage<{ 'bos.state': AppState }>(session, ['bos.state']))['bos.state'];
        v2Stamp = before.updatedAt;
        await session.context.close();

        session = await launch(extension, profile);
        const tab = await session.context.newPage();
        await tab.goto('chrome://newtab/');
        await tab.waitForSelector('.home');
        const after = (await storage<{ 'bos.state': AppState }>(session, ['bos.state']))['bos.state'];
        expect(after.updatedAt === v2Stamp, 'the state was rewritten on restart');
        expect(after.legacy?.migratedAt === migratedAt, 'migration ran again');
        expect(Object.values(after.spaces).some(space => space.name === 'V2 ile eklendi'), 'the edit made after the update was lost');
        expect(Object.keys(after.items).length === validLinks, 'links were duplicated or lost');
        expect((await tab.locator('.migration').count()) === 0, 'the summary came back');
        const stored = await storage<{ ntf_data: unknown }>(session, ['ntf_data']);
        expect(JSON.stringify(stored.ntf_data) === legacySnapshot, 'ntf_data changed');
        await tab.waitForTimeout(900);
        await tab.screenshot({ path: 'e2e/.out/rehearsal-3-after-restart.png' });
        await tab.close();
        return `${after.spaceOrder.length} Spaces, ${Object.keys(after.items).length} links, summary gone, 1.x data untouched`;
    });

    await check('After the update', 'change data again, restart again: both edits kept, still one conversion, 1.x data untouched', async () => {
        const tab = await session.context.newPage();
        await tab.goto('chrome://newtab/');
        await tab.waitForSelector('.home');
        await tab.locator('.deck-head .quiet-button').click();
        await tab.locator('.overlay-form input').first().fill('İkinci düzenleme');
        await tab.locator('.overlay-form button[type=submit]').click();
        await tab.waitForSelector('.overlay-space');
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(700);
        await session.context.close();
        session = await launch(extension, profile);
        const again = await session.context.newPage();
        await again.goto('chrome://newtab/');
        await again.waitForSelector('.home');
        const state = (await storage<{ 'bos.state': AppState }>(session, ['bos.state']))['bos.state'];
        const names = Object.values(state.spaces).map(space => space.name);
        expect(names.includes('V2 ile eklendi') && names.includes('İkinci düzenleme'), `Spaces: ${names.join(', ')}`);
        expect(state.legacy?.migratedAt === migratedAt, 'migration ran again');
        expect(Object.keys(state.items).length === validLinks, 'links changed');
        expect((await again.locator('.migration').count()) === 0, 'the notice came back');
        const stored = await storage<{ ntf_data: unknown }>(session, ['ntf_data']);
        expect(JSON.stringify(stored.ntf_data) === legacySnapshot, 'ntf_data changed');
        await again.close();
        return `${state.spaceOrder.length} Spaces, ${Object.keys(state.items).length} links, dock ${state.dock.length}, Modes ${state.modeOrder.length}`;
    });

    await check('After the update', 'storage holds both generations side by side', async () => {
        const everything = await storage<Record<string, unknown>>(session, null);
        const sizes = Object.entries(everything).map(([name, value]) => `${name} ${(JSON.stringify(value).length / 1024).toFixed(1)} kB`);
        expect('ntf_data' in everything && 'bos.state' in everything, 'a generation is missing');
        return sizes.join(' · ');
    });
    await session.context.close();
}

// ---------- 4. Rollback, then forward again ----------
{
    install('legacy');
    // 1.x's service worker stays asleep on a plain start, so this step drives the page only.
    const legacyContext = await chromium.launchPersistentContext(profile, {
        channel: 'chromium', headless: true, locale: 'en-US', viewport: { width: 1440, height: 900 },
        args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    await check('Rollback', 'putting 1.x back: it opens with its own data exactly as it left it', async () => {
        const page = await legacyContext.newPage();
        await page.goto('chrome://newtab/');
        await page.waitForSelector('.folder-card', { timeout: 10_000 });
        const shown = await page.locator('.folder-card').count();
        expect(shown >= realFolders, `1.x shows ${shown} folders after rollback`);
        await page.screenshot({ path: 'e2e/.out/rehearsal-4-rollback.png' });
        await page.close();
        return `1.x shows ${shown} folders; changes made in V2 are not visible in 1.x (separate data)`;
    });
    await legacyContext.close();

    install('v2');
    const session = await launch(extension, profile);
    await check('Rollback', 'updating again after a rollback keeps the V2 setup; it does not convert a second time', async () => {
        const page = await session.context.newPage();
        await page.goto('chrome://newtab/');
        await page.waitForSelector('.home');
        const state = (await storage<{ 'bos.state': AppState }>(session, ['bos.state']))['bos.state'];
        expect(state.legacy?.migratedAt === migratedAt, 'converted again');
        expect(Object.values(state.spaces).some(space => space.name === 'V2 ile eklendi'), 'V2 edits were lost');
        expect(Object.keys(state.items).length === validLinks, 'links changed');
        await page.close();
        return 'V2 state from before the rollback is used as it was';
    });
    const errors = session.errors;
    await check('Console', 'no errors on any V2 page during the rehearsal', async () => {
        expect(errors.length === 0, errors.slice(0, 4).join(' || '));
    });
    await session.context.close();
}

note('Scope', 'what this rehearsal cannot show',
    'An update delivered by the Chrome Web Store itself (signature check, staged rollout, the browser’s own permission-change handling for a published item). '
    + 'The unpacked swap exercises the same storage and code paths, not the store’s delivery.');
console.log(`\nfixture: ${realFolders} real folders, ${validLinks} valid links, files in ${readdirSync(extension).length} top-level entries`);
removeProfile(root);
process.exit(report() ? 1 : 0);

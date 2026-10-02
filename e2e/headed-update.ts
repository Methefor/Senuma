/**
 * One observation, in visible Google Chrome: after a 1.x install is updated in place to V2,
 * does Chrome show its "Change back to Google?" bubble again?
 *
 *   npm run headed:update
 *
 * The 1.x files in the repository root and the V2 build are loaded from the same folder under
 * the same extension ID (throw-away manifest key), so Chrome sees one extension being updated.
 * This is the closest thing to a store update that can be done locally; it is not a store update.
 */
import { execFileSync } from 'node:child_process';
import { createHash, generateKeyPairSync } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from 'playwright';
import { DIST, check, note, removeProfile, report } from './harness';

const sleep = (ms: number) => new Promise(done => setTimeout(done, ms));
const KEEP = 'iklikleri koru|Keep';
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const der = publicKey.export({ type: 'spki', format: 'der' });
const key = der.toString('base64');
const id = [...createHash('sha256').update(der).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');

function install(dir: string, version: 'legacy' | 'v2'): string {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    if (version === 'legacy') for (const entry of ['index.html', 'js', 'css', 'assets/icons', 'changelog.html', 'guide.html']) cpSync(join('archive/legacy/repository-1.x', entry), join(dir, entry), { recursive: true });
    else cpSync(DIST, dir, { recursive: true });
    const manifest = { ...JSON.parse(readFileSync(version === 'legacy' ? 'archive/legacy/repository-1.x/manifest.json' : join(DIST, 'manifest.json'), 'utf8')), key };
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return `${manifest.version} (new tab page: ${manifest.chrome_url_overrides.newtab})`;
}

async function scenario(label: string, answerInLegacy: boolean): Promise<void> {
    const root = mkdtempSync(join(tmpdir(), 'bos-update-'));
    const extension = join(root, 'extension');
    const profile = join(root, 'profile');
    mkdirSync(profile);
    const win = (...args: string[]) => {
        try {
            return execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve('e2e/headed/win.ps1'), '-Profile', profile, ...args], { encoding: 'utf8' }).trim();
        } catch (error) {
            return `HELPER-ERROR ${String((error as { stdout?: string }).stdout ?? '').trim()}`;
        }
    };
    const bubble = () => {
        const raw = win('-Action', 'prompt', '-Name', KEEP);
        return raw.startsWith('PROMPT:') ? raw.slice(7).split('||')[0]!.trim() : '';
    };
    const freshTab = async (context: BrowserContext): Promise<Page> => {
        const before = new Set(context.pages());
        win('-Action', 'keys', '-Keys', '^t');
        for (let i = 0; i < 40; i++) {
            const page = context.pages().find(p => !before.has(p));
            if (page) { await sleep(1500); return page; }
            await sleep(100);
        }
        throw new Error('no new tab appeared');
    };
    const launch = async () => {
        const context = await chromium.launchPersistentContext(profile, {
            channel: 'chrome', headless: false, viewport: null,
            args: ['--enable-unsafe-extension-debugging', '--no-first-run', '--no-default-browser-check', '--window-size=1280,860', '--window-position=40,40'],
            ignoreDefaultArgs: ['--disable-extensions'],
        });
        await sleep(1200);
        const cdp = await context.browser()!.newBrowserCDPSession();
        const load = () => cdp.send('Extensions.loadUnpacked' as never, { path: extension } as never) as Promise<unknown> as Promise<{ id: string }>;
        return { context, load };
    };

    await check(label, 'install 1.x, open a tab', async () => {
        const legacy = install(extension, 'legacy');
        const { context, load } = await launch();
        const loaded = await load();
        const page = await freshTab(context);
        const first = bubble();
        const answered = first && answerInLegacy ? win('-Action', 'invoke', '-Name', KEEP) : 'left unanswered';
        await sleep(600);
        await freshTab(context);
        const second = bubble();

        // The update: same folder, same ID, new files; then the same call Chrome uses to (re)load it.
        const v2 = install(extension, 'v2');
        const reloaded = await load();
        await sleep(2500);
        const afterUpdate = await freshTab(context);
        const third = bubble();
        win('-Action', 'shot', '-Out', resolve('e2e/.out', `headed-update-${answerInLegacy ? 'kept' : 'unanswered'}.png`));
        const url = afterUpdate.url();
        const isV2 = await afterUpdate.locator('.home, .onboarding').count();

        // And once more after a full browser restart.
        await context.close();
        await sleep(3000);
        const again = await launch();
        await again.load();
        await sleep(1500);
        const afterRestart = await freshTab(again.context);
        const fourth = bubble();
        const stillV2 = await afterRestart.locator('.home, .onboarding').count();
        await again.context.close();
        removeProfile(root);
        void page;
        return [
            `1.x ${legacy}, ID ${loaded.id === id ? 'as expected' : loaded.id}`,
            `first 1.x tab: bubble ${first ? `SHOWN (“${first}”) → ${answered}` : 'not shown'}`,
            `next 1.x tab: bubble ${second ? 'shown' : 'not shown'}`,
            `updated to ${v2}, same ID: ${reloaded.id === loaded.id}`,
            `first tab after the update: ${url.includes('newtab.html') && isV2 ? 'V2 page' : url}; bubble ${third ? 'SHOWN AGAIN' : 'not shown'}`,
            `first tab after restarting Chrome: ${stillV2 ? 'V2 page' : 'not V2'}; bubble ${fourth ? 'SHOWN' : 'not shown'}`,
        ].join(' · ');
    });
}

await scenario('User had pressed “Keep changes” in 1.x', true);
await scenario('User had never answered the bubble in 1.x', false);
note('Scope', 'what this does and does not show',
    'Chrome keys the bubble to the extension that controls the new tab page. This run updates an unpacked extension in place; a Chrome Web Store update is delivered differently and must be observed in a staged rollout.');
process.exit(report() ? 1 : 0);




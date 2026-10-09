/**
 * Records the five priority vertical clips (docs/MEDIA_PLAN.md § 7) from the real product, in a
 * real portrait window: 432×768 CSS px at 2.5× = 1080×1920. English and Turkish are separate
 * recordings of the interface in that language. Nothing is cropped from the 16:9 footage and
 * nothing is uploaded.
 *
 *   npm run build && vite-node e2e/media-portrait.ts && python scripts/media-portrait.py
 *   CAPTURE_LANG=tr vite-node e2e/media-portrait.ts      (one language only)
 *
 * Output: e2e/.out/media-portrait/<lang>/<scene>/ (frames + timeline.json). A mark that starts
 * with “@” tells the composer which overlay line starts there; any other mark is a key pressed.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Locator, Page } from 'playwright';
import { DEFAULT_BACKGROUND } from '../src/core/background';
import * as ops from '../src/core/ops';
import type { AppState, Language } from '../src/core/types';
import { CAPTURE_TIME, demo, modeId, nextStamp, words } from './demo-state';
import { DIST, launch, newProfile, removeProfile, writeStorage, type Session } from './harness';

const VIEWPORT = { width: 432, height: 768 };
const SCALE = 2.5;
const LANGUAGES: Language[] = process.env.CAPTURE_LANG === 'tr' ? ['tr'] : process.env.CAPTURE_LANG === 'en' ? ['en'] : ['en', 'tr'];
const ONLY = process.env.CAPTURE_SCENE;

/** A visible pointer for the recording only (headless Chrome draws no cursor). */
const POINTER = `addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:0;top:0;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 0 0 1.5px rgba(0,0,0,.35),0 2px 8px rgba(0,0,0,.45);pointer-events:none;z-index:2147483647;transform:translate(-200px,-200px);transition:scale .08s';
    document.documentElement.appendChild(dot);
    addEventListener('mousemove', e => { dot.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', () => { dot.style.scale = '.75'; }, true);
    addEventListener('mouseup', () => { dot.style.scale = '1'; }, true);
});`;

type Mark = (text: string) => void;
const pause = (page: Page, ms: number) => page.waitForTimeout(ms);
const iconsSettled = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll('.app-icon img')].every(img => (img as HTMLImageElement).complete), null, { timeout: 15_000 }).catch(() => undefined);

async function record(page: Page, dir: string, run: (mark: Mark) => Promise<void>): Promise<void> {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const cdp = await page.context().newCDPSession(page);
    const frames: { file: string; t: number }[] = [];
    const keys: { t: number; text: string }[] = [];
    let n = 0;
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
        const file = `${String(n++).padStart(5, '0')}.jpg`;
        writeFileSync(join(dir, file), Buffer.from(data, 'base64'));
        frames.push({ file, t: metadata.timestamp ?? Date.now() / 1000 });
        void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => undefined);
    });
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 93, everyNthFrame: 1 });
    await page.waitForTimeout(500);
    const start = Date.now() / 1000;
    await run(text => keys.push({ t: Date.now() / 1000, text }));
    await page.waitForTimeout(500);
    const end = Date.now() / 1000;
    await cdp.send('Page.stopScreencast');
    await cdp.detach();
    writeFileSync(join(dir, 'timeline.json'), JSON.stringify({ start, end, frames, keys }));
    console.log(`${dir.split(/[\\/]/).slice(-2).join('/')}: ${frames.length} frames, ${(end - start).toFixed(1)} s`);
}

async function tap(page: Page, target: Locator): Promise<void> {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 16 });
    await page.waitForTimeout(140);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.mouse.up();
}

async function slide(page: Page, input: Locator, to: number): Promise<void> {
    await input.scrollIntoViewIfNeeded();
    const box = (await input.boundingBox())!;
    const { value, max } = await input.evaluate(el => ({ value: Number((el as HTMLInputElement).value), max: Number((el as HTMLInputElement).max) }));
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 8 + (box.width - 16) * (value / max), y, { steps: 12 });
    await page.mouse.down();
    await page.mouse.move(box.x + 8 + (box.width - 16) * (to / max), y, { steps: 20 });
    await page.mouse.up();
}

const type = (page: Page, text: string) => page.keyboard.type(text, { delay: 80 });

async function fresh(session: Session, page: Page | null, state: AppState): Promise<Page> {
    await page?.close();
    await new Promise(done => setTimeout(done, 900));
    await writeStorage(session, { 'bos.state': { ...state, updatedAt: nextStamp() } });
    const next = await session.context.newPage();
    // The page is exactly 432×768 at 2.5×, inside a larger window running at the same real scale.
    const metrics = await session.context.newCDPSession(next);
    await metrics.send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: SCALE, mobile: false });
    await next.goto('chrome://newtab/');
    await next.waitForSelector('.home', { timeout: 10_000 });
    await next.addStyleTag({ content: '* { caret-color: auto; } .toasts { display: none; }' });
    await next.waitForSelector('.backdrop-photo.is-ready', { timeout: 12_000 }).catch(() => undefined);
    await iconsSettled(next);
    // The pointer waits at the left edge, clear of the Spaces and the dock.
    await next.mouse.move(14, VIEWPORT.height * 0.66);
    await next.waitForTimeout(500);
    return next;
}

for (const lang of LANGUAGES) {
    const t = words(lang);
    const out = resolve('e2e/.out/media-portrait', lang);
    mkdirSync(out, { recursive: true });
    const profile = newProfile();
    const session = await launch(DIST, profile, VIEWPORT, SCALE);
    await session.context.clock.setFixedTime(CAPTURE_TIME);
    await session.context.addInitScript(POINTER);
    // Four Spaces fit this window with the dock (a fifth would sit under it), and Gaming gives the Mode clip its target.
    const base = demo({ modeLooks: true, language: lang, interests: ['ai', 'dev', 'work', 'gaming'] });
    let page: Page | null = null;
    const scene = async (name: string, state: AppState, run: (page: Page, mark: Mark) => Promise<void>) => {
        if (ONLY && ONLY !== name) return;
        page = await fresh(session, page, state);
        const current = page;
        await record(current, join(out, name), mark => run(current, mark));
    };
    const leaveField = async (current: Page) => {
        // Single-key shortcuts belong to the page, not to a text field.
        await current.locator('#home-search').fill('');
        await current.mouse.click(10, VIEWPORT.height * 0.66);
        await current.waitForTimeout(250);
    };

    await scene('v1-lofi', base, async (current, mark) => {
        await pause(current, 1500);
        await tap(current, current.locator('#home-search'));
        await pause(current, 800); // the tip shows in the empty box
        mark('@1');
        await type(current, 'y lofi mix');
        await pause(current, 1300);
        mark('@2');
        mark('Enter');
        await pause(current, 1300);
    });

    await scene('v2-command', base, async (current, mark) => {
        await pause(current, 1500);
        mark('Ctrl K');
        await current.keyboard.press('Control+k');
        await current.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
        await pause(current, 450);
        mark('@1');
        await type(current, t('cat.dev').toLowerCase());
        await pause(current, 800);
        mark('Enter');
        await current.keyboard.press('Enter');
        await current.waitForSelector('.overlay-space');
        await iconsSettled(current);
        await pause(current, 1300);
        mark('Esc');
        await current.keyboard.press('Escape');
        await pause(current, 500);
        mark('Ctrl K');
        await current.keyboard.press('Control+k');
        await current.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
        await pause(current, 350);
        mark('@2');
        // The Mode's own name: the first result must be the switch, in the interface language.
        await type(current, t('modePreset.dev').toLowerCase());
        await pause(current, 700);
        const first = (await current.locator('.result').first().innerText()).replace(/\s+/g, ' ');
        const wanted = t('command.switchMode', { name: t('modePreset.dev') });
        if (!first.includes(wanted)) throw new Error(`v2 (${lang}): first result is “${first}”, expected “${wanted}”`);
        mark('Enter');
        await current.keyboard.press('Enter');
        await pause(current, 1800);
    });

    await scene('v3-modes', ops.setActiveMode(base, modeId(base, 'work')), async (current, mark) => {
        mark('@1');
        await pause(current, 2400);
        mark('M');
        await current.keyboard.press('m');
        await current.waitForSelector('.menu');
        await pause(current, 500);
        await tap(current, current.locator('.menu button', { hasText: t('modePreset.gaming') }));
        await current.waitForSelector('.backdrop-photo.is-ready', { timeout: 10_000 }).catch(() => undefined);
        mark('@2');
        await pause(current, 2300);
        mark('@3');
        await pause(current, 1400);
    });

    // Starts on the theme's own backdrop, so choosing a photograph is the first visible change.
    const plain = { ...base, prefs: { ...base.prefs, background: { ...DEFAULT_BACKGROUND } } };
    await scene('v4-customize', plain, async (current, mark) => {
        const customize = current.locator(`.topbar button[aria-label="${t('customize.title')}"]`);
        await pause(current, 1500);
        await tap(current, customize);
        await current.waitForSelector('.overlay-customize');
        await pause(current, 500);
        await tap(current, current.locator('.swatch-tile[aria-label="Mountain Mirror"]'));
        await pause(current, 700);
        await tap(current, current.locator('.customize-foot .button.is-primary'));
        await current.waitForSelector('.backdrop-photo.is-ready', { timeout: 10_000 }).catch(() => undefined);
        mark('@1');
        await pause(current, 1500);
        await tap(current, customize);
        await current.waitForSelector('.overlay-customize');
        await current.locator('.overlay-customize .tune').evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
        await pause(current, 700);
        mark('@2');
        await tap(current, current.locator('.overlay-customize .tune .segmented button', { hasText: t('background.fit.contain') }));
        await pause(current, 600);
        await tap(current, current.locator('.overlay-customize .tune .segmented button', { hasText: t('background.fit.cover') }));
        await pause(current, 400);
        await tap(current, current.locator(`.position-grid button[aria-label="${t('background.position')} 50% 0%"]`));
        await pause(current, 500);
        mark('@3');
        await slide(current, current.locator('.slider', { hasText: t('background.dim') }).locator('input'), 0.6);
        await pause(current, 350);
        await slide(current, current.locator('.slider', { hasText: t('background.blur') }).locator('input'), 10);
        await pause(current, 500);
        mark('@4');
        await tap(current, current.locator('.overlay-customize .segmented button', { hasText: t('atmosphere.cinematic') }));
        await pause(current, 700);
        await tap(current, current.locator('.customize-foot .button.is-primary'));
        mark('@5');
        await pause(current, 1800);
    });

    await scene('v5-ai-dev', base, async (current, mark) => {
        await pause(current, 1500);
        await current.mouse.click(10, VIEWPORT.height * 0.66);
        mark('1');
        await current.keyboard.press('1');
        await current.waitForSelector('.overlay-space');
        await iconsSettled(current);
        mark('@1');
        await pause(current, 1900);
        mark('Esc');
        await current.keyboard.press('Escape');
        await pause(current, 450);
        await tap(current, current.locator('#home-search'));
        mark('@2');
        await type(current, 'cl explain closures');
        await pause(current, 1300);
        await leaveField(current);
        mark('2');
        await current.keyboard.press('2');
        await current.waitForSelector('.overlay-space');
        await iconsSettled(current);
        mark('@3');
        await pause(current, 1900);
        mark('Esc');
        await current.keyboard.press('Escape');
        await pause(current, 450);
        await tap(current, current.locator('#home-search'));
        mark('@4');
        await type(current, 'gh senuma');
        await pause(current, 1400);
    });

    await (page as Page | null)?.close();
    await session.context.close();
    removeProfile(profile);
}
process.exit(0);

/**
 * Records the real product for the GIFs and the product video (docs/MEDIA_PLAN.md §2–3).
 * Nothing is uploaded or published.
 *
 *   npm run build && vite-node e2e/media-capture.ts && python scripts/media-compose.py
 *   CAPTURE_LANG=tr CAPTURE_ONLY=loops vite-node e2e/media-capture.ts   (the five landing loops, Turkish interface → e2e/.out/media-tr/)
 *
 * Each scene is a scripted, human-paced run of a real flow, recorded with Chrome's screencast
 * (frames with timestamps) into e2e/.out/media/<scene>/. Keys pressed are logged so the
 * composer can show them. The only thing added to the page is a pointer dot, because headless
 * Chrome draws no cursor; nothing in the product is changed or faked.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Locator, Page } from 'playwright';
import { exportBackup } from '../src/core/backup';
import * as ops from '../src/core/ops';
import type { AppState, Language } from '../src/core/types';
import { CAPTURE_TIME, demo, modeId, nextStamp, words } from './demo-state';
import { DIST, launch, newProfile, openNewTab, removeProfile, writeStorage, type Session } from './harness';

const LANG: Language = process.env.CAPTURE_LANG === 'tr' ? 'tr' : 'en';
/** The interface's own labels in the capture language. */
const t = words(LANG);
/** `loops`: only the five scenes the landing page shows as loops (no backup GIF, no video). */
const ONLY_LOOPS = process.env.CAPTURE_ONLY === 'loops';
const OUT = resolve(LANG === 'en' ? 'e2e/.out/media' : `e2e/.out/media-${LANG}`);
mkdirSync(OUT, { recursive: true });

/** A visible pointer for the recording only. */
const POINTER = `addEventListener('DOMContentLoaded', () => {
    const dot = document.createElement('div');
    dot.style.cssText = 'position:fixed;left:0;top:0;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 0 0 2px rgba(0,0,0,.35),0 3px 10px rgba(0,0,0,.45);pointer-events:none;z-index:2147483647;transform:translate(-200px,-200px);transition:scale .08s';
    document.documentElement.appendChild(dot);
    addEventListener('mousemove', e => { dot.style.transform = 'translate(' + e.clientX + 'px,' + e.clientY + 'px)'; }, true);
    addEventListener('mousedown', () => { dot.style.scale = '.75'; }, true);
    addEventListener('mouseup', () => { dot.style.scale = '1'; }, true);
});`;

type Mark = (text: string) => void;

/**
 * How long the person takes between steps: 1 for the GIFs, shorter for the video so it fits the
 * storyboard at real speed (the product’s own animations are never sped up).
 */
let PACE = 1;
const wait = (page: Page, ms: number) => page.waitForTimeout(ms * PACE);

async function record(page: Page, name: string, run: (key: Mark) => Promise<void>): Promise<void> {
    const dir = join(OUT, name);
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
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
    await page.waitForTimeout(700);
    const start = Date.now() / 1000;
    await run(text => keys.push({ t: Date.now() / 1000, text }));
    await page.waitForTimeout(800);
    const end = Date.now() / 1000;
    await cdp.send('Page.stopScreencast');
    await cdp.detach();
    writeFileSync(join(dir, 'timeline.json'), JSON.stringify({ start, end, frames, keys }));
    console.log(`${name}: ${frames.length} frames, ${(end - start).toFixed(1)} s`);
}

/** Moves the pointer there at a human pace and clicks. */
async function tap(page: Page, target: Locator): Promise<void> {
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: Math.round(22 * PACE) });
    await wait(page, 160);
    await page.mouse.down();
    await page.waitForTimeout(70);
    await page.mouse.up();
}

/** Drags a range input from its current value to `to`. */
async function slide(page: Page, input: Locator, to: number): Promise<void> {
    const box = (await input.boundingBox())!;
    const { value, max } = await input.evaluate(el => ({ value: Number((el as HTMLInputElement).value), max: Number((el as HTMLInputElement).max) }));
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 8 + (box.width - 16) * (value / max), y, { steps: Math.round(18 * PACE) });
    await page.mouse.down();
    await page.mouse.move(box.x + 8 + (box.width - 16) * (to / max), y, { steps: Math.round(26 * PACE) });
    await page.mouse.up();
}

const type = (page: Page, text: string) => page.keyboard.type(text, { delay: Math.round(85 * Math.max(PACE, 0.7)) });
const iconsSettled = (page: Page) => page.waitForFunction(() => [...document.querySelectorAll('.app-icon img')].every(img => (img as HTMLImageElement).complete), null, { timeout: 15_000 }).catch(() => undefined);

async function fresh(session: Session, page: Page | null, state: AppState): Promise<Page> {
    // A closing tab saves its pending change on the way out; let that land before the next scene's state.
    await page?.close();
    await new Promise(done => setTimeout(done, 900));
    await writeStorage(session, { 'bos.state': { ...state, updatedAt: nextStamp() } });
    const next = await openNewTab(session);
    await next.addStyleTag({ content: '* { caret-color: auto; }' });
    await next.waitForSelector('.backdrop-photo.is-ready', { timeout: 15_000 }).catch(() => undefined);
    await iconsSettled(next);
    await next.mouse.move(next.viewportSize()!.width * 0.62, next.viewportSize()!.height * 0.82);
    await next.waitForTimeout(600);
    return next;
}


async function customizeFlow(page: Page, key: Mark): Promise<void> {
    const pause = (ms: number) => wait(page, ms);
    await tap(page, page.locator(`.topbar button[aria-label="${t('customize.title')}"]`));
    await page.waitForSelector('.overlay-customize');
    await pause(700);
    await tap(page, page.locator('.swatch-tile[aria-label="Forest Fog"]'));
    await pause(1100);
    await page.locator('.overlay-customize .tune').evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    await pause(800);
    await tap(page, page.locator('.overlay-customize .tune .segmented button', { hasText: t('background.fit.contain') }));
    await pause(900);
    await tap(page, page.locator('.overlay-customize .tune .segmented button', { hasText: t('background.fit.cover') }));
    await pause(600);
    await tap(page, page.locator(`.position-grid button[aria-label="${t('background.position')} 50% 0%"]`));
    await pause(700);
    await slide(page, page.locator('.slider', { hasText: t('background.dim') }).locator('input'), 0.6);
    await pause(500);
    await slide(page, page.locator('.slider', { hasText: t('background.blur') }).locator('input'), 16);
    await pause(700);
    await tap(page, page.locator('.overlay-customize .segmented button', { hasText: t('atmosphere.cinematic') }));
    await pause(1000);
    await tap(page, page.locator('.customize-foot .button.is-primary'));
    key('');
    await pause(1100);
}

async function modeFlow(page: Page, key: Mark, order: ('work' | 'dev' | 'chill' | 'gaming')[]): Promise<void> {
    for (const name of order.map(mode => t(`modePreset.${mode}`))) {
        key('M');
        await page.keyboard.press('m');
        await page.waitForSelector('.menu');
        await wait(page, 450);
        await tap(page, page.locator('.menu button', { hasText: name }));
        await page.waitForSelector('.backdrop-photo.is-ready, .backdrop', { timeout: 10_000 }).catch(() => undefined);
        await wait(page, 1300);
    }
}

// ---------- GIFs: 1280×800 ----------
{
    const profile = newProfile();
    const session = await launch(DIST, profile, { width: 1280, height: 800 });
    await session.context.clock.setFixedTime(CAPTURE_TIME);
    await session.context.addInitScript(POINTER);
    const base = demo({ modeLooks: true, language: LANG });
    let page = await fresh(session, null, base);

    await record(page, 'gif-1-space', async key => {
        await tap(page, page.locator('.deck-head .quiet-button'));
        await page.waitForSelector('.overlay-form');
        await page.waitForTimeout(400);
        await type(page, LANG === 'tr' ? 'Seyahat' : 'Travel');
        await page.waitForTimeout(350);
        await tap(page, page.locator('.overlay-form button[type=submit]'));
        await page.waitForSelector('.overlay-space');
        await page.waitForTimeout(700);
        await tap(page, page.locator('#space-filter'));
        await page.waitForTimeout(300);
        await page.keyboard.insertText('airbnb.com'); // pasted, as a person would
        await page.waitForTimeout(500);
        key('Enter');
        await page.keyboard.press('Enter');
        await iconsSettled(page);
        await page.waitForTimeout(1400);
        key('Esc');
        await page.keyboard.press('Escape');
    });

    page = await fresh(session, page, base);
    await record(page, 'gif-2-command', async key => {
        key('Ctrl K');
        await page.keyboard.press('Control+k');
        await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
        await page.waitForTimeout(500);
        await type(page, t('cat.dev').toLowerCase());
        await page.waitForTimeout(700);
        key('Enter');
        await page.keyboard.press('Enter');
        await page.waitForSelector('.overlay-space');
        await iconsSettled(page);
        await page.waitForTimeout(1300);
        key('Esc');
        await page.keyboard.press('Escape');
    });

    page = await fresh(session, page, base);
    await record(page, 'gif-3-shortcut', async key => {
        await tap(page, page.locator('#home-search'));
        await page.waitForTimeout(1400); // the tip shows in the empty box
        await type(page, 'y lofi mix');
        await page.waitForTimeout(1300);
        key('Enter'); // the cut: Enter opens YouTube, which is not part of the GIF
    });

    page = await fresh(session, page, base);
    // Seven controls in one GIF: a brisker hand keeps it near ten seconds.
    PACE = 0.6;
    await record(page, 'gif-4-background', async key => customizeFlow(page, key));
    PACE = 1;

    page = await fresh(session, page, ops.setActiveMode(base, modeId(base, 'work')));
    await record(page, 'gif-5-modes', async key => modeFlow(page, key, ['dev', 'chill', 'work']));
    if (ONLY_LOOPS) {
        await page.close();
        await session.context.close();
        removeProfile(profile);
        process.exit(0);
    }

    // The backup imported in GIF 6: this setup plus a Travel Space.
    const travel = ops.addSpace(base, { name: 'Travel', glyph: 'globe' });
    let incoming = travel.state;
    for (const url of ['https://www.airbnb.com', 'https://www.google.com/travel/flights', 'https://www.booking.com']) incoming = ops.addItem(incoming, travel.id, null, { url }).state;
    const backupFile = join(profile, 'senuma-backup.json');
    writeFileSync(backupFile, exportBackup(incoming));
    page = await fresh(session, page, base);
    await record(page, 'gif-6-backup', async () => {
        await tap(page, page.locator('.topbar button[aria-label="Settings"]'));
        await tap(page, page.locator('.settings-nav button', { hasText: 'Data' }));
        await page.waitForTimeout(600);
        const exportButton = page.locator('.row', { hasText: 'Export your setup' }).locator('.button');
        const [download] = await Promise.all([page.waitForEvent('download'), tap(page, exportButton)]);
        await download.saveAs(join(profile, 'exported.json'));
        await page.waitForTimeout(900);
        const choose = page.locator('.row', { hasText: 'Import a backup file' }).locator('.button');
        const [chooser] = await Promise.all([page.waitForEvent('filechooser'), tap(page, choose)]);
        await chooser.setFiles(backupFile);
        await page.waitForSelector('text=Merge into my setup');
        await page.waitForTimeout(1300);
        await tap(page, page.locator('button', { hasText: 'Merge into my setup' }));
        await page.waitForTimeout(1800);
    });
    await page.close();
    await session.context.close();
    removeProfile(profile);
}

// ---------- Product video: 1920×1080 ----------
{
    PACE = 0.5;
    const profile = newProfile();
    const session = await launch(DIST, profile, { width: 1920, height: 1080 });
    await session.context.clock.setFixedTime(CAPTURE_TIME);
    await session.context.addInitScript(POINTER);
    const base = demo({ modeLooks: true });
    let page = await fresh(session, null, base);

    await record(page, 'video-1-home', async () => {
        await page.mouse.move(1180, 900, { steps: 30 });
        await page.waitForTimeout(2200);
    });
    await record(page, 'video-2-spaces', async () => {
        await tap(page, page.locator('.plate', { hasText: 'Media' }));
        await page.waitForSelector('.overlay-space');
        await iconsSettled(page);
        await page.waitForTimeout(500);
        await tap(page, page.locator('.suggestions summary'));
        await page.waitForTimeout(500);
        await tap(page, page.locator('.suggestions .pick', { hasText: 'SoundCloud' }));
        await iconsSettled(page);
        await page.waitForTimeout(900);
    });
    page = await fresh(session, page, base);
    await record(page, 'video-3-shortcut', async key => {
        await tap(page, page.locator('#home-search'));
        await page.waitForTimeout(700);
        await type(page, 'y lofi mix');
        await page.waitForTimeout(900);
        key('Enter');
    });
    page = await fresh(session, page, base);
    await record(page, 'video-4-command', async key => {
        key('Ctrl K');
        await page.keyboard.press('Control+k');
        await page.waitForFunction(() => document.activeElement?.closest('.overlay-palette'));
        await page.waitForTimeout(250);
        await page.keyboard.type('switch to dev mode', { delay: 55 });
        await page.waitForTimeout(400);
        key('Enter');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1300);
    });
    page = await fresh(session, page, base);
    await record(page, 'video-5-background', async key => customizeFlow(page, key));
    page = await fresh(session, page, ops.setActiveMode(base, modeId(base, 'work')));
    await record(page, 'video-6-modes', async key => modeFlow(page, key, ['chill', 'dev']));
    await page.close();
    await session.context.close();
    removeProfile(profile);
}
process.exit(0);

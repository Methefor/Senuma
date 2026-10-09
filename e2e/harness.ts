/**
 * Runs the built extension in a real Chromium, as an unpacked extension, with a persistent
 * profile. Used by the runtime test (extension.e2e.ts) and the visual review (visual.ts).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type BrowserContext, type Page, type Worker } from 'playwright';

export const DIST = resolve('dist');
/** Same code, but optional permissions are pre-granted: prompts cannot be clicked by a test. */
export const DIST_GRANTED = resolve('dist-e2e');

export interface Session {
    context: BrowserContext;
    worker: Worker;
    extensionId: string;
    /** Console errors and uncaught exceptions from every extension page. */
    errors: string[];
}

export function newProfile(): string {
    return mkdtempSync(join(tmpdir(), 'bos-e2e-'));
}

export function removeProfile(dir: string): void {
    try {
        rmSync(dir, { recursive: true, force: true });
    } catch {
        // Chromium can hold a lock for a moment after closing; a leftover temp dir is harmless.
    }
}

/**
 * `deviceScaleFactor` is for captures: a 432×768 window at 2.5 records as 1080×1920 (docs/MEDIA_PLAN.md § 7).
 * The window itself runs at that scale and is larger than the page: Chrome's screencast records the
 * window's own pixels, and shrinks a page that does not fit its window.
 */
export async function launch(extensionDir: string, profileDir: string, viewport = { width: 1440, height: 900 }, deviceScaleFactor?: number): Promise<Session> {
    const context = await chromium.launchPersistentContext(profileDir, {
        channel: 'chromium',
        headless: true,
        locale: 'en-US',
        // A capture sizes its pages itself (Emulation.setDeviceMetricsOverride) inside a larger real window.
        viewport: deviceScaleFactor ? null : viewport,
        args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`,
            ...(deviceScaleFactor ? [`--force-device-scale-factor=${deviceScaleFactor}`, `--window-size=${viewport.width + 300},${viewport.height + 400}`] : [])],
    });
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker', { timeout: 20_000 }));
    const errors: string[] = [];
    // Only our own code counts: tests also navigate to real sites, whose errors are theirs.
    const EXTENSION = 'chrome-extension://';
    const watch = (page: Page) => {
        page.on('pageerror', error => (error.stack ?? '').includes(EXTENSION) && errors.push(`exception: ${error.message}`));
        page.on('console', message => {
            // A site refusing to serve its favicon is expected and handled; it is not our error.
            const fromExtension = message.location().url.startsWith(EXTENSION);
            if (fromExtension && message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text());
        });
    };
    context.pages().forEach(watch);
    context.on('page', watch);
    return { context, worker, extensionId: worker.url().split('/')[2]!, errors };
}

/** Opens a new tab the way a user does, so the override (not a direct file URL) is exercised. */
export async function openNewTab(session: Session): Promise<Page> {
    const page = await session.context.newPage();
    await page.goto('chrome://newtab/');
    await page.waitForSelector('.home', { timeout: 10_000 });
    return page;
}

/** Reads a key from the extension's storage through the service worker. */
export async function readStorage<T = unknown>(session: Session, key: string): Promise<T | undefined> {
    const worker = session.context.serviceWorkers()[0] ?? session.worker;
    return worker.evaluate(async k => (await chrome.storage.local.get(k))[k], key) as Promise<T | undefined>;
}

export async function writeStorage(session: Session, values: Record<string, unknown>): Promise<void> {
    const worker = session.context.serviceWorkers()[0] ?? session.worker;
    await worker.evaluate(v => chrome.storage.local.set(v), values);
}

/** State writes are debounced; wait until storage reflects `predicate`. */
export async function waitForState<T>(session: Session, predicate: (state: any) => T | false | undefined | null, timeout = 5000): Promise<T> {
    const started = Date.now();
    for (;;) {
        const state = await readStorage<any>(session, 'bos.state');
        const result = state ? predicate(state) : undefined;
        if (result) return result;
        if (Date.now() - started > timeout) throw new Error('storage did not reach the expected state in time');
        await new Promise(r => setTimeout(r, 100));
    }
}

// ---------- Tiny reporting test runner ----------

export interface Outcome {
    area: string;
    name: string;
    status: 'pass' | 'fail' | 'note';
    detail?: string;
}

export const outcomes: Outcome[] = [];

export async function check(area: string, name: string, body: () => Promise<string | void>): Promise<boolean> {
    try {
        const detail = await body();
        outcomes.push({ area, name, status: 'pass', ...(detail ? { detail } : {}) });
        return true;
    } catch (error) {
        outcomes.push({ area, name, status: 'fail', detail: error instanceof Error ? error.message.split('\n')[0] : String(error) });
        return false;
    }
}

export function note(area: string, name: string, detail: string): void {
    outcomes.push({ area, name, status: 'note', detail });
}

export function expect(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

export function report(): number {
    let area = '';
    for (const o of outcomes) {
        if (o.area !== area) {
            area = o.area;
            console.log(`\n${area}`);
        }
        const mark = o.status === 'pass' ? 'PASS' : o.status === 'fail' ? 'FAIL' : 'NOTE';
        console.log(`  ${mark}  ${o.name}${o.detail ? ` — ${o.detail}` : ''}`);
    }
    const failed = outcomes.filter(o => o.status === 'fail').length;
    const passed = outcomes.filter(o => o.status === 'pass').length;
    console.log(`\n${passed} passed, ${failed} failed, ${outcomes.length - passed - failed} notes`);
    return failed;
}

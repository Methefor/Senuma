/**
 * The sync engine wired to this browser: the setup in the page, the device's own storage, the
 * network. Loaded only when sync is turned on, or when Account & Sync is opened.
 *
 * The engine runs in the page, not in the service worker. Only one tab syncs at a time (a
 * browser lock); the others pick the result up from storage like any other change.
 */
import { replaceSetup } from '../app/actions';
import { STORAGE_KEYS } from '../brand';
import { kv } from '../browser/kv';
import { loadDeviceLocal, saveDeviceLocal } from '../storage/deviceLocal';
import { app } from '../storage/store';
import { SYNC, SYNC_ON_FLAG } from './config';
import { createEngine, type Engine, type Status, type SyncMeta } from './engine';
import { mockAuth, type MockUser } from './mockAuth';
import { firestoreTransport } from './transport';
import { projectWithAssets } from './wallpaper';

/** Emulator builds only: who the mock sign-in signs in as, and the signed-in mock user. */
const MOCK_PICK = 'bos.sync.mock.pick';
const MOCK_SESSION = 'bos.sync.mock.session';
const DEFAULT_USER: MockUser = { uid: 'local_owner', email: 'owner@example.test' };

/** After a local change, wait this long for more before syncing. */
const QUIET_MS = 3000;
const RETRY_MS = [15_000, 60_000, 300_000];

const read = async <T>(key: string): Promise<T | null> => ((await kv.get([key]))[key] as T | undefined) ?? null;

function deviceLabel(): string {
    const brands = (navigator as Navigator & { userAgentData?: { brands?: { brand: string }[]; platform?: string } }).userAgentData;
    const browser = brands?.brands?.map(entry => entry.brand).find(name => !/not.?a.?brand|chromium/i.test(name)) ?? 'Browser';
    return `${browser} · ${brands?.platform || navigator.platform || 'this device'}`;
}

export interface Runtime {
    engine: Engine;
    /** One sync, unless another tab is already doing one. */
    syncNow(): Promise<Status>;
}

let runtime: Promise<Runtime> | null = null;

function build(): Runtime {
    if (!SYNC) throw new Error('This build has no sync.');
    const config = SYNC;
    const engine = createEngine({
        local: {
            state: () => app.get(),
            async apply(next) {
                if (!(await replaceSetup(next, 'sync'))) throw new Error('the restore point could not be saved');
            },
            meta: () => read<SyncMeta>(STORAGE_KEYS.sync),
            async saveMeta(meta) {
                await kv.set({ [STORAGE_KEYS.sync]: meta });
                // A plain flag the page can read before anything loads.
                if (meta) localStorage.setItem(SYNC_ON_FLAG, '1');
                else localStorage.removeItem(SYNC_ON_FLAG);
            },
            device: () => loadDeviceLocal(app.get()),
            saveDevice: saveDeviceLocal,
            online: () => navigator.onLine,
            now: () => Date.now(),
            label: deviceLabel,
            wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
        },
        auth: mockAuth(config.project, { read: () => read<MockUser>(MOCK_SESSION), write: user => kv.set({ [MOCK_SESSION]: user }) }, async () => (await read<MockUser>(MOCK_PICK)) ?? DEFAULT_USER),
        transport: session => firestoreTransport(config, session),
    });

    const syncNow = async (): Promise<Status> => {
        if (!navigator.locks) return engine.sync();
        const result = await navigator.locks.request('senuma-sync', { ifAvailable: true }, lock => (lock ? engine.sync() : null));
        return result ?? engine.status();
    };

    // ---- when to sync ----
    let quiet: number | undefined;
    let retry: number | undefined;
    let failures = 0;
    let lastSent = '';
    const report = async () => canonicalText(projectWithAssets(app.get(), await loadDeviceLocal(app.get())));
    const settle = (status: Status) => {
        clearTimeout(retry);
        if (status.phase === 'offline' || (status.phase === 'error' && ['failed', 'quota', 'denied'].includes(status.error ?? ''))) {
            retry = window.setTimeout(() => void syncNow().then(settle), RETRY_MS[Math.min(failures++, RETRY_MS.length - 1)]);
        } else failures = 0;
    };
    app.subscribe(() => {
        clearTimeout(quiet);
        quiet = window.setTimeout(async () => {
            // Only when something that syncs changed: opening links or closing tabs is not a reason to talk to the service.
            const now = await report();
            if (now === lastSent || !localStorage.getItem(SYNC_ON_FLAG)) return;
            lastSent = now;
            settle(await syncNow());
        }, QUIET_MS);
    });
    window.addEventListener('online', () => void syncNow().then(settle));
    void report().then(text => {
        lastSent = text;
    });
    void syncNow().then(settle);
    return { engine, syncNow };
}

const canonicalText = (value: unknown): string => JSON.stringify(value);

/** The one engine of this page. */
export function syncRuntime(): Promise<Runtime> {
    runtime ??= Promise.resolve().then(build);
    return runtime;
}

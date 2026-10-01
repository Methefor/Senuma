/**
 * Remembers icon addresses that failed to load, so a missing favicon is not requested again
 * on every new tab. Icons that do load are cached by the browser HTTP cache.
 */
import { readLocal, writeLocal } from './kv';

const KEY = 'bos.icons.failed';
const RETRY_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 300;
const WRITE_DELAY_MS = 1000;

const failed = new Map<string, number>();
const stored = readLocal(KEY);
if (stored && typeof stored === 'object') {
    for (const [url, at] of Object.entries(stored)) {
        if (typeof at === 'number' && Date.now() - at < RETRY_AFTER_MS) failed.set(url, at);
    }
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function iconFailed(url: string): boolean {
    return failed.has(url);
}

export function markIconFailed(url: string): void {
    // Offline, everything fails; that says nothing about the icon.
    if (!navigator.onLine) return;
    failed.set(url, Date.now());
    clearTimeout(timer);
    timer = setTimeout(() => {
        const newest = [...failed.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES);
        writeLocal(KEY, Object.fromEntries(newest));
    }, WRITE_DELAY_MS);
}

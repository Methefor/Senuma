/**
 * Persistence. chrome.storage.local is the source of truth; a localStorage mirror lets the
 * page paint synchronously on open. Outside the extension (dev preview) localStorage is both.
 */
import { STORAGE_KEYS } from '../brand';
import { resolveState, type Resolved } from '../core/migrate';
import { sanitize } from '../core/sanitize';
import type { AppState } from '../core/types';

const area = typeof chrome !== 'undefined' && chrome.storage ? chrome.storage.local : null;

function readLocal(key: string): unknown {
    try {
        const text = localStorage.getItem(key);
        return text === null ? undefined : JSON.parse(text);
    } catch {
        return undefined;
    }
}

/** Synchronous best-effort read used for the first paint. */
export function readCachedState(): AppState | null {
    const cached = readLocal(STORAGE_KEYS.state);
    return cached ? sanitize(cached) : null;
}

export async function loadState(): Promise<Resolved> {
    if (!area) return resolveState(readLocal(STORAGE_KEYS.state), readLocal(STORAGE_KEYS.legacyData));
    const stored = await area.get([STORAGE_KEYS.state, STORAGE_KEYS.legacyData]);
    return resolveState(stored[STORAGE_KEYS.state], stored[STORAGE_KEYS.legacyData]);
}

/** Throws when the write fails (for example when the storage quota is exhausted). */
export async function saveState(state: AppState): Promise<void> {
    try {
        localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
    } catch (error) {
        // The mirror is only a paint cache; without the extension store it is the only copy.
        if (!area) throw error;
    }
    if (area) await area.set({ [STORAGE_KEYS.state]: state });
}

/** Calls back when another tab saves a state. */
export function onExternalChange(callback: (state: AppState) => void): void {
    if (!area) {
        window.addEventListener('storage', event => {
            if (event.key === STORAGE_KEYS.state && event.newValue) callback(sanitize(readLocal(STORAGE_KEYS.state)));
        });
        return;
    }
    chrome.storage.onChanged.addListener((changes, areaName) => {
        const change = changes[STORAGE_KEYS.state];
        if (areaName === 'local' && change?.newValue) callback(sanitize(change.newValue));
    });
}

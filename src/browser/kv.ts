/**
 * Key-value storage. In the extension this is chrome.storage.local; in the development
 * preview it is localStorage, so both environments look the same to callers.
 * Writes reject on failure (for example a full quota) and callers must handle it.
 */
import { inExtension } from './result';

export interface KeyValueStore {
    get(keys: string[]): Promise<Record<string, unknown>>;
    set(values: Record<string, unknown>): Promise<void>;
    /** Calls back when another page changes `key`. */
    onChange(key: string, callback: (value: unknown) => void): void;
}

export function readLocal(key: string): unknown {
    try {
        const text = localStorage.getItem(key);
        return text === null ? undefined : JSON.parse(text);
    } catch {
        return undefined;
    }
}

/** Returns false when the value could not be written. */
export function writeLocal(key: string, value: unknown): boolean {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

const extensionStore: KeyValueStore = {
    get: keys => chrome.storage.local.get(keys),
    set: values => chrome.storage.local.set(values),
    onChange(key, callback) {
        chrome.storage.onChanged.addListener((changes, area) => {
            const change = changes[key];
            if (area === 'local' && change?.newValue !== undefined) callback(change.newValue);
        });
    },
};

const previewStore: KeyValueStore = {
    async get(keys) {
        return Object.fromEntries(keys.map(key => [key, readLocal(key)] as const).filter(([, value]) => value !== undefined));
    },
    async set(values) {
        for (const [key, value] of Object.entries(values)) {
            if (!writeLocal(key, value)) throw new Error('Storage is full');
        }
    },
    onChange(key, callback) {
        window.addEventListener('storage', event => {
            if (event.key === key && event.newValue) callback(readLocal(key));
        });
    },
};

export const kv: KeyValueStore = inExtension ? extensionStore : previewStore;

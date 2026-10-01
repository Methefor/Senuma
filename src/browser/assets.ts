/**
 * Local image store for uploaded wallpapers.
 *
 * Why IndexedDB: it stores Blobs natively, off the main thread, with a quota in the hundreds
 * of megabytes. chrome.storage would need images base64-encoded into JSON (a third larger,
 * parsed on every read, 10 MB total), and localStorage is synchronous and smaller still.
 * Nothing in here is ever sent anywhere: images stay in this browser profile.
 */
import { fail, ok, type BrowserResult } from './result';

const DB_NAME = 'bos-assets';
const STORE = 'wallpapers';

export type WallpaperVariant = 'full' | 'thumb';

interface StoredWallpaper {
    id: string;
    full: Blob;
    thumb: Blob;
}

let opening: Promise<IDBDatabase> | undefined;

function open(): Promise<IDBDatabase> {
    opening ??= new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB unavailable'));
        request.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
    // A failed open must not poison every later attempt.
    opening.catch(() => (opening = undefined));
    return opening;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE, mode);
        const request = work(transaction.objectStore(STORE));
        transaction.oncomplete = () => resolve(request.result);
        transaction.onerror = () => reject(transaction.error ?? request.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('Storage write was aborted'));
    });
}

export async function putWallpaper(id: string, full: Blob, thumb: Blob): Promise<BrowserResult<true>> {
    try {
        await run('readwrite', store => store.put({ id, full, thumb } satisfies StoredWallpaper));
        return ok(true);
    } catch (error) {
        return fail('failed', error);
    }
}

export async function deleteWallpaper(id: string): Promise<BrowserResult<true>> {
    releaseWallpaperUrls(id);
    try {
        await run('readwrite', store => store.delete(id));
        return ok(true);
    } catch (error) {
        return fail('failed', error);
    }
}

export async function listWallpaperIds(): Promise<BrowserResult<string[]>> {
    try {
        return ok((await run('readonly', store => store.getAllKeys())).map(String));
    } catch (error) {
        return fail('failed', error);
    }
}

// Object URLs are created once per image and reused, so reopening a panel or re-rendering
// the page never re-reads the blob.
const urls = new Map<string, Promise<string | null>>();

/** A URL for the stored image, or null when it is missing or unreadable. */
export function wallpaperUrl(id: string, variant: WallpaperVariant): Promise<string | null> {
    const key = `${id}:${variant}`;
    let pending = urls.get(key);
    if (!pending) {
        pending = run<StoredWallpaper | undefined>('readonly', store => store.get(id))
            .then(record => (record?.[variant] instanceof Blob ? URL.createObjectURL(record[variant]) : null))
            .catch(() => null);
        urls.set(key, pending);
        // A miss is not cached: the image may be added (or storage may recover) later.
        void pending.then(url => url === null && urls.delete(key));
    }
    return pending;
}

function releaseWallpaperUrls(id: string): void {
    for (const variant of ['full', 'thumb'] as const) {
        const key = `${id}:${variant}`;
        void urls.get(key)?.then(url => url && URL.revokeObjectURL(url));
        urls.delete(key);
    }
}

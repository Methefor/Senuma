/**
 * One-time, read-only access to the cloud copy that New Tab Folders 1.x kept for people who
 * signed in to its sync. Senuma has no sync of its own; this exists only so that nobody's
 * newer cloud copy is stranded by the upgrade.
 *
 * Rules this module keeps:
 *   - It runs only when the person asks for it (a button in Settings → Data).
 *   - It only reads. It never writes, updates or deletes anything in the cloud, and it never
 *     changes the 1.x sign-in record or the 1.x data on this device.
 *   - The refreshed sign-in token lives in memory for the one request and is then dropped.
 *
 * How 1.x identified people: Google sign-in exchanged for a Firebase account. The account id
 * and a refresh token were kept on the device under `ntf_auth`; the cloud copy is one document
 * per account id holding the whole 1.x data object.
 */
import { STORAGE_KEYS } from '../brand';
import { parseCloudDocument, type LegacyCloudCopy } from '../core/legacy';
import { fail, inExtension, ok, type BrowserResult } from './result';

const AUTH_KEY = 'ntf_auth';
/** The public web key and project of the 1.x sync backend, as shipped inside 1.x itself. */
const PROJECT = 'newtabfolders';
const WEB_KEY = 'AIzaSyBnuBvBbRvW7pDG1BA0izz8mTpKrFK1Vqg';
const TOKEN_URL = `https://securetoken.googleapis.com/v1/token?key=${WEB_KEY}`;
const DOCUMENT_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/`;

export interface LegacyCloudSession {
    /** The address 1.x showed for the signed-in account, when it stored one. */
    email: string;
    /** When the 1.x data on this device was last saved. 0 when unknown. */
    localUpdatedAt: number;
}

interface StoredAuth { uid: string; refreshToken: string; email: string }

async function storedAuth(): Promise<{ auth: StoredAuth; localUpdatedAt: number } | null> {
    if (!inExtension) return null;
    const stored = await chrome.storage.local.get([AUTH_KEY, STORAGE_KEYS.legacyData]);
    const auth = stored[AUTH_KEY] as Partial<StoredAuth> | undefined;
    if (!auth || typeof auth.uid !== 'string' || typeof auth.refreshToken !== 'string' || !/^[\w-]{6,128}$/.test(auth.uid)) return null;
    const legacy = stored[STORAGE_KEYS.legacyData] as { updatedAt?: unknown } | undefined;
    return {
        auth: { uid: auth.uid, refreshToken: auth.refreshToken, email: typeof auth.email === 'string' ? auth.email : '' },
        localUpdatedAt: typeof legacy?.updatedAt === 'number' ? legacy.updatedAt : 0,
    };
}

/** Whether this device was signed in to 1.x sync. Makes no network request. */
export async function legacyCloudSession(): Promise<LegacyCloudSession | null> {
    try {
        const found = await storedAuth();
        return found ? { email: found.auth.email, localUpdatedAt: found.localUpdatedAt } : null;
    } catch {
        return null;
    }
}

/** Fetches the cloud copy for the account this device was signed in with. Read-only. */
export async function fetchLegacyCloud(): Promise<BrowserResult<LegacyCloudCopy | null>> {
    const found = await storedAuth().catch(() => null);
    if (!found) return fail('unavailable');
    try {
        const refreshed = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: found.auth.refreshToken }),
        });
        // The saved sign-in is no longer accepted (revoked, or too old).
        if (refreshed.status === 400 || refreshed.status === 401 || refreshed.status === 403) return fail('denied');
        if (!refreshed.ok) return fail('failed', `sign-in ${refreshed.status}`);
        const token = ((await refreshed.json()) as { id_token?: unknown }).id_token;
        if (typeof token !== 'string') return fail('failed', 'no token');

        const response = await fetch(DOCUMENT_URL + found.auth.uid, { headers: { Authorization: `Bearer ${token}` } });
        if (response.status === 404) return ok(null);
        if (response.status === 401 || response.status === 403) return fail('denied');
        if (!response.ok) return fail('failed', `read ${response.status}`);
        return ok(parseCloudDocument(await response.json()));
    } catch (error) {
        return fail('failed', error);
    }
}

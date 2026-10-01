/** Optional permissions: asked for only when the user turns on the feature that needs them. */
import { fail, inExtension, ok, type BrowserResult } from './result';

export type OptionalPermission = 'bookmarks' | 'tabs' | 'sessions';

export async function hasPermissions(permissions: OptionalPermission[]): Promise<boolean> {
    if (!inExtension) return false;
    try {
        return await chrome.permissions.contains({ permissions });
    } catch {
        return false;
    }
}

/** Must be called from a user gesture (a click). Shows the browser prompt when needed. */
export async function requestPermissions(permissions: OptionalPermission[]): Promise<BrowserResult<true>> {
    if (!inExtension) return fail('unavailable');
    try {
        return (await chrome.permissions.request({ permissions })) ? ok(true) : fail('denied');
    } catch (error) {
        return fail('failed', error);
    }
}

export async function releasePermissions(permissions: OptionalPermission[]): Promise<void> {
    if (!inExtension) return;
    try {
        await chrome.permissions.remove({ permissions });
    } catch {
        // Nothing depends on the removal succeeding; the feature is already switched off.
    }
}

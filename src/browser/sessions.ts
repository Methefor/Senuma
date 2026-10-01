/** Recently closed tabs. Needs the optional `tabs` + `sessions` permissions. */
import { hasPermissions, releasePermissions, requestPermissions, type OptionalPermission } from './permissions';
import { fail, inExtension, ok, type BrowserResult } from './result';

const NEEDED: OptionalPermission[] = ['tabs', 'sessions'];
const MAX_SESSIONS = 10;

export interface ClosedTab {
    sessionId: string;
    url: string;
    title: string;
}

export const requestClosedTabsAccess = () => requestPermissions(NEEDED);
export const releaseClosedTabsAccess = () => releasePermissions(NEEDED);

/** Read fresh each time and never stored. `denied` means the permission is not granted. */
export async function recentlyClosed(): Promise<BrowserResult<ClosedTab[]>> {
    if (!inExtension) return fail('unavailable');
    if (!(await hasPermissions(NEEDED))) return fail('denied');
    try {
        const sessions = await chrome.sessions.getRecentlyClosed({ maxResults: MAX_SESSIONS });
        const tabs = sessions.flatMap(session => (session.tab ? [session.tab] : (session.window?.tabs ?? [])));
        return ok(tabs.flatMap(tab => (tab.url && tab.sessionId ? [{ sessionId: tab.sessionId, url: tab.url, title: tab.title || tab.url }] : [])));
    } catch (error) {
        return fail('failed', error);
    }
}

export async function restoreClosed(sessionId: string): Promise<BrowserResult<true>> {
    try {
        await chrome.sessions.restore(sessionId);
        return ok(true);
    } catch (error) {
        return fail('failed', error);
    }
}

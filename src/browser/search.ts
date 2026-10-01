import { fail, inExtension, ok, type BrowserResult } from './result';

/**
 * Searches with the engine the user chose in their browser settings. New-tab pages are
 * expected to respect that choice rather than hardcode an engine.
 */
export async function searchWithBrowserDefault(text: string, newTab: boolean): Promise<BrowserResult<true>> {
    if (!inExtension || !chrome.search?.query) return fail('unavailable');
    try {
        await chrome.search.query({ text, disposition: newTab ? 'NEW_TAB' : 'CURRENT_TAB' });
        return ok(true);
    } catch (error) {
        return fail('failed', error);
    }
}

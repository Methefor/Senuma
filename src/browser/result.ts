/** Every browser capability answers with a typed result instead of throwing. */
export type BrowserFailure =
    /** The API does not exist here (development preview, or another browser). */
    | 'unavailable'
    /** The user declined the permission the capability needs. */
    | 'denied'
    /** The API exists and was allowed, but the call itself failed. */
    | 'failed';

export type BrowserResult<T> = { ok: true; value: T } | { ok: false; reason: BrowserFailure; message?: string };

export const ok = <T>(value: T): BrowserResult<T> => ({ ok: true, value });
export const fail = (reason: BrowserFailure, error?: unknown): BrowserResult<never> =>
    ({ ok: false, reason, ...(error ? { message: error instanceof Error ? error.message : String(error) } : {}) });

/** True when running as the installed extension rather than the development preview. */
export const inExtension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;

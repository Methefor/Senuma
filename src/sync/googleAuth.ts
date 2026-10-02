/**
 * Google sign-in for sync, behind the same `Auth` interface as the emulator's mock sign-in.
 *
 *   1. The person presses “Continue with Google”. The optional `identity` permission is asked
 *      for then, not at install.
 *   2. `chrome.identity.launchWebAuthFlow` opens Google's own sign-in window. Senuma asks for
 *      `openid email` and nothing else: no Gmail, Drive, Contacts or any other Google data.
 *   3. Google returns an ID token for the extension's own redirect address. Its nonce and state
 *      are checked here; its signature and audience are checked by Firebase in the next step.
 *   4. Firebase Authentication exchanges it for a Firebase session (REST, no SDK). The session's
 *      refresh token is kept on this device only, to stay signed in.
 */
import type { Auth } from './mockAuth';
import { SyncError, type Session } from './transport';

export interface GoogleConfig {
    /** Firebase Web API key of the project (a public identifier, not a secret). */
    apiKey: string;
    /** OAuth client ID of type “Web application” whose redirect URI is this extension's. */
    clientId: string;
}

/** What is kept on this device between sessions. */
export interface StoredSession {
    uid: string;
    email: string;
    idToken: string;
    refreshToken: string;
    /** When `idToken` stops being accepted, by this device's clock. */
    expiresAt: number;
}

export interface SessionStore {
    read(): Promise<StoredSession | null>;
    write(session: StoredSession | null): Promise<void>;
}

/** The scopes Senuma asks Google for. Anything beyond knowing who signed in is out of scope. */
export const SCOPES = 'openid email';

const IDENTITY: chrome.permissions.Permissions = { permissions: ['identity'] };
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
const payloadOf = (jwt: string): Record<string, unknown> => {
    try {
        const part = jwt.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(decodeURIComponent(escape(atob(part + '='.repeat((4 - (part.length % 4)) % 4))))) as Record<string, unknown>;
    } catch {
        return {};
    }
};

/**
 * Must be called straight from the click that starts signing in: the browser grants optional
 * permissions only in response to a user action. Resolves to false when the person declines.
 */
export function requestSignInPermission(): Promise<boolean> {
    return chrome.permissions.request(IDENTITY);
}

export function googleAuth(config: GoogleConfig, store: SessionStore): Auth {
    async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
        let response: Response;
        try {
            response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        } catch (error) {
            throw new SyncError('offline', String(error));
        }
        const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
        // A refresh token that was revoked, or an account that was deleted or disabled.
        if (response.status === 400 || response.status === 401 || response.status === 403) throw new SyncError('auth-expired', JSON.stringify(data.error ?? response.status));
        if (!response.ok) throw new SyncError('offline', `sign-in service answered ${response.status}`);
        return data;
    }

    async function refresh(saved: StoredSession): Promise<StoredSession> {
        const data = await post(`https://securetoken.googleapis.com/v1/token?key=${config.apiKey}`, { grant_type: 'refresh_token', refresh_token: saved.refreshToken });
        const next: StoredSession = { ...saved, idToken: String(data.id_token), refreshToken: String(data.refresh_token ?? saved.refreshToken), expiresAt: Date.now() + Number(data.expires_in ?? 3600) * 1000 };
        await store.write(next);
        return next;
    }

    const session = (first: StoredSession): Session => {
        let current = first;
        return {
            uid: first.uid,
            email: first.email,
            async token() {
                const saved = await store.read();
                // Signed out (or into another account) in the meantime.
                if (!saved || saved.uid !== first.uid) throw new SyncError('auth-expired');
                current = saved;
                if (current.expiresAt - 60_000 > Date.now()) return current.idToken;
                current = await refresh(current);
                return current.idToken;
            },
        };
    };

    return {
        async current() {
            const saved = await store.read();
            return saved ? session(saved) : null;
        },

        async signIn() {
            if (!(await chrome.permissions.contains(IDENTITY))) throw new SyncError('denied', 'the sign-in permission was not given');
            const nonce = random();
            const state = random();
            const redirect = chrome.identity.getRedirectURL();
            const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
            url.search = new URLSearchParams({ client_id: config.clientId, response_type: 'id_token', redirect_uri: redirect, scope: SCOPES, nonce, state, prompt: 'select_account' }).toString();
            let returned: string | undefined;
            try {
                returned = await chrome.identity.launchWebAuthFlow({ url: url.toString(), interactive: true });
            } catch (error) {
                // Closed by the person, or the window could not load.
                throw new SyncError('denied', String(error));
            }
            if (!returned?.startsWith(redirect)) throw new SyncError('denied', 'no answer from Google');
            const answer = new URLSearchParams(new URL(returned).hash.slice(1));
            const idToken = answer.get('id_token');
            if (answer.get('state') !== state || !idToken) throw new SyncError('denied', answer.get('error') ?? 'the answer was not for this request');
            if (payloadOf(idToken).nonce !== nonce) throw new SyncError('denied', 'the answer was not for this request');

            const data = await post(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${config.apiKey}`, {
                postBody: new URLSearchParams({ id_token: idToken, providerId: 'google.com' }).toString(),
                requestUri: redirect,
                returnSecureToken: true,
                returnIdpCredential: false,
            });
            const saved: StoredSession = {
                uid: String(data.localId), email: String(data.email ?? ''), idToken: String(data.idToken), refreshToken: String(data.refreshToken),
                expiresAt: Date.now() + Number(data.expiresIn ?? 3600) * 1000,
            };
            if (!saved.uid || saved.uid === 'undefined' || !saved.refreshToken) throw new SyncError('denied', 'no session was returned');
            await store.write(saved);
            return session(saved);
        },

        async signOut() {
            await store.write(null);
            // Nothing else uses the permission; give it back.
            await chrome.permissions.remove(IDENTITY).catch(() => false);
        },
    };
}

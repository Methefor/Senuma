import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCOPES, googleAuth, requestSignInPermission, type StoredSession } from './googleAuth';

const REDIRECT = 'https://oghlifenjhpbebcdeboejbmemelkfobe.chromiumapp.org/';
const config = { apiKey: 'test-api-key', clientId: 'test-client.apps.googleusercontent.com' };
const jwt = (payload: object) => `h.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.s`;

let saved: StoredSession | null;
let granted: boolean;
let flow: (url: string) => Promise<string>;
let calls: { url: string; body: unknown }[];
let answer: (url: string, body: Record<string, unknown>) => { status: number; body: object };
const store = { read: async () => saved, write: async (next: StoredSession | null) => void (saved = next) };

beforeEach(() => {
    saved = null;
    granted = true;
    calls = [];
    flow = async url => {
        const sent = new URL(url).searchParams;
        return `${REDIRECT}#id_token=${jwt({ nonce: sent.get('nonce'), email: 'tester@example.com' })}&state=${sent.get('state')}`;
    };
    answer = url => (url.includes('signInWithIdp')
        ? { status: 200, body: { localId: 'uid_1', email: 'tester@example.com', idToken: 'firebase-id-1', refreshToken: 'refresh-1', expiresIn: '3600' } }
        : { status: 200, body: { id_token: 'firebase-id-2', refresh_token: 'refresh-2', expires_in: '3600' } });
    vi.stubGlobal('chrome', {
        permissions: { contains: async () => granted, request: async () => (granted = true), remove: vi.fn(async () => true) },
        identity: { getRedirectURL: () => REDIRECT, launchWebAuthFlow: async ({ url }: { url: string }) => flow(url) },
    });
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
        const body = JSON.parse(init.body) as Record<string, unknown>;
        calls.push({ url, body });
        const reply = answer(url, body);
        return new Response(JSON.stringify(reply.body), { status: reply.status });
    });
});
afterEach(() => vi.unstubAllGlobals());

describe('signing in with Google', () => {
    it('asks Google for who signed in and nothing else', async () => {
        let asked = '';
        const inner = flow;
        flow = async url => {
            asked = url;
            return inner(url);
        };
        await googleAuth(config, store).signIn();
        const params = new URL(asked).searchParams;
        expect(new URL(asked).origin + new URL(asked).pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
        expect(params.get('scope')).toBe('openid email');
        expect(SCOPES.split(' ').sort()).toEqual(['email', 'openid']);
        expect(asked).not.toMatch(/gmail|drive|contacts|calendar|profile|offline_access|googleapis\.com\/auth/i);
        expect(params.get('response_type')).toBe('id_token');
        expect(params.get('redirect_uri')).toBe(REDIRECT);
        expect(params.get('client_id')).toBe(config.clientId);
        expect(params.get('nonce')).toMatch(/^[0-9a-f]{32}$/);
        expect(params.get('state')).toMatch(/^[0-9a-f]{32}$/);
        expect(params.get('state')).not.toBe(params.get('nonce'));
    });

    it('exchanges the Google answer for a Firebase session and keeps it on the device', async () => {
        const session = await googleAuth(config, store).signIn();
        expect(session.uid).toBe('uid_1');
        expect(session.email).toBe('tester@example.com');
        expect(calls[0]!.url).toBe('https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=test-api-key');
        expect(new URLSearchParams((calls[0]!.body as { postBody: string }).postBody).get('providerId')).toBe('google.com');
        expect(calls[0]!.body).toMatchObject({ requestUri: REDIRECT, returnSecureToken: true, returnIdpCredential: false });
        expect(saved).toMatchObject({ uid: 'uid_1', refreshToken: 'refresh-1', idToken: 'firebase-id-1' });
        expect(await session.token()).toBe('firebase-id-1');
    });

    it('refuses an answer that is not for this request: wrong state, wrong nonce, no token, another address', async () => {
        const cases: ((url: URLSearchParams) => string)[] = [
            sent => `${REDIRECT}#id_token=${jwt({ nonce: sent.get('nonce') })}&state=someone-else`,
            sent => `${REDIRECT}#id_token=${jwt({ nonce: 'replayed' })}&state=${sent.get('state')}`,
            sent => `${REDIRECT}#error=access_denied&state=${sent.get('state')}`,
            sent => `https://evil.example/#id_token=${jwt({ nonce: sent.get('nonce') })}&state=${sent.get('state')}`,
        ];
        for (const make of cases) {
            flow = async url => make(new URL(url).searchParams);
            await expect(googleAuth(config, store).signIn()).rejects.toMatchObject({ code: 'denied' });
        }
        expect(calls).toEqual([]); // nothing was sent to Firebase
        expect(saved).toBeNull();
    });

    it('does nothing without the sign-in permission, and treats a closed window as a refusal', async () => {
        granted = false;
        await expect(googleAuth(config, store).signIn()).rejects.toMatchObject({ code: 'denied' });
        granted = true;
        flow = async () => {
            throw new Error('The user did not approve access.');
        };
        await expect(googleAuth(config, store).signIn()).rejects.toMatchObject({ code: 'denied' });
        expect(saved).toBeNull();
        expect(await requestSignInPermission()).toBe(true);
    });
});

describe('staying signed in', () => {
    it('refreshes an expired session and keeps the new token', async () => {
        const auth = googleAuth(config, store);
        const session = await auth.signIn();
        saved = { ...saved!, expiresAt: Date.now() - 1 };
        expect(await session.token()).toBe('firebase-id-2');
        expect(calls.at(-1)!.url).toBe('https://securetoken.googleapis.com/v1/token?key=test-api-key');
        expect(calls.at(-1)!.body).toEqual({ grant_type: 'refresh_token', refresh_token: 'refresh-1' });
        expect(saved).toMatchObject({ refreshToken: 'refresh-2', idToken: 'firebase-id-2' });
    });

    it('a refused refresh is an expired sign-in; an unreachable service is offline', async () => {
        const session = await googleAuth(config, store).signIn();
        saved = { ...saved!, expiresAt: 0 };
        answer = () => ({ status: 400, body: { error: { message: 'TOKEN_EXPIRED' } } });
        await expect(session.token()).rejects.toMatchObject({ code: 'auth-expired' });
        vi.stubGlobal('fetch', async () => {
            throw new TypeError('Failed to fetch');
        });
        await expect(session.token()).rejects.toMatchObject({ code: 'offline' });
    });

    it('is picked up again after a restart, and signing out removes it and gives the permission back', async () => {
        await googleAuth(config, store).signIn();
        const again = googleAuth(config, store);
        expect((await again.current())?.uid).toBe('uid_1');
        await again.signOut();
        expect(saved).toBeNull();
        expect(await again.current()).toBeNull();
        expect(chrome.permissions.remove).toHaveBeenCalledWith({ permissions: ['identity'] });
    });

    it('a session from before a sign-out cannot be used', async () => {
        const auth = googleAuth(config, store);
        const session = await auth.signIn();
        await auth.signOut();
        await expect(session.token()).rejects.toMatchObject({ code: 'auth-expired' });
    });
});

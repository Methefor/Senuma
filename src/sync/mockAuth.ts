/**
 * Sign-in for the local emulator ONLY. It makes the unsigned tokens the Firebase emulator
 * accepts and no real service does; there is no Google sign-in here. Real sign-in replaces
 * this file when a real project exists, behind the same `Auth` interface.
 */
import { SyncError, type Session } from './transport';

export interface Auth {
    /** The session saved on this device, or null. */
    current(): Promise<Session | null>;
    signIn(): Promise<Session>;
    signOut(): Promise<void>;
}

export interface MockUser {
    uid: string;
    email: string;
    /** Stands in for a sign-in that can no longer be refreshed. */
    expired?: boolean;
}

const base64url = (value: object): string => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** An unsigned token in the shape the emulator reads: who, and that the sign-in was through Google. */
export function mockToken(user: MockUser, project: string): string {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: `https://securetoken.google.com/${project}`, aud: project, iat: now, exp: now + 3600, auth_time: now,
        sub: user.uid, user_id: user.uid, email: user.email, email_verified: true,
        firebase: { sign_in_provider: 'google.com', identities: {} },
    };
    return `${base64url({ alg: 'none', type: 'JWT' })}.${base64url(payload)}.`;
}

/**
 * `read` and `write` keep the chosen mock user wherever the caller likes (browser storage in the
 * emulator build, a variable in tests). `pick` chooses who "signs in".
 */
export function mockAuth(project: string, store: { read(): Promise<MockUser | null>; write(user: MockUser | null): Promise<void> }, pick: () => Promise<MockUser>): Auth {
    const session = (user: MockUser): Session => ({
        uid: user.uid,
        email: user.email,
        async token() {
            // Looked up each time, so that a sign-in expiring mid-session is seen.
            const now = await store.read();
            if (!now || now.uid !== user.uid || now.expired) throw new SyncError('auth-expired');
            return mockToken(user, project);
        },
    });
    return {
        async current() {
            const user = await store.read();
            return user ? session(user) : null;
        },
        async signIn() {
            const user = await pick();
            await store.write({ uid: user.uid, email: user.email });
            return session(user);
        },
        signOut: () => store.write(null),
    };
}

/**
 * Whether this build has sync at all, and where its vault lives. Decided when the extension is
 * built: an ordinary build has no sync, and everything behind this constant is left out of it.
 *
 *   emulator  the local Firestore emulator with its mock sign-in (`npm run build:sync`).
 *   firebase  a real Firebase project with Google sign-in (`npm run build:sync:firebase`, which
 *             reads the project's identifiers from `.env.senuma-dev.local`; see .env.senuma-dev.example).
 */
export type SyncConfig =
    | { kind: 'emulator'; origin: string; project: string; mock: true }
    | { kind: 'firebase'; origin: string; project: string; mock: false; apiKey: string; clientId: string };

// Each value is read as import.meta.env.X directly, so that the build replaces it with a constant
// and leaves out every branch it does not take. (Through a variable, all of it would ship.)
export const SYNC: SyncConfig | null = import.meta.env.VITE_SENUMA_SYNC === 'emulator'
    ? { kind: 'emulator', origin: 'http://127.0.0.1:8085', project: 'demo-senuma', mock: true }
    : import.meta.env.VITE_SENUMA_SYNC === 'firebase'
        ? { kind: 'firebase', origin: 'https://firestore.googleapis.com', project: String(import.meta.env.VITE_FIREBASE_PROJECT), mock: false, apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY), clientId: String(import.meta.env.VITE_GOOGLE_CLIENT_ID) }
        : null;

/** Set while this device has sync turned on, so the page knows to load the engine. Read synchronously at startup. */
export const SYNC_ON_FLAG = 'bos.sync.on';

/**
 * Whether this build has sync at all, and where its vault lives. Decided when the extension is
 * built: an ordinary build has no sync, and everything behind this constant is left out of it.
 *
 * `emulator` is the only value today: the local Firestore emulator with its mock sign-in. There
 * is no production configuration because there is no production project yet.
 */
export interface SyncConfig {
    origin: string;
    project: string;
    /** Sign-in is the emulator's mock sign-in, not Google. */
    mock: true;
}

export const SYNC: SyncConfig | null = import.meta.env.VITE_SENUMA_SYNC === 'emulator'
    ? { origin: 'http://127.0.0.1:8085', project: 'demo-senuma', mock: true }
    : null;

/** Set while this device has sync turned on, so the page knows to load the engine. Read synchronously at startup. */
export const SYNC_ON_FLAG = 'bos.sync.on';

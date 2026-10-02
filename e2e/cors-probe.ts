/**
 * Can an extension page with NO host permissions talk to the real Google endpoints sync needs?
 * Sends requests with made-up credentials to a project that does not exist, and records whether
 * the browser lets the page read each response (CORS) or blocks it. No account, no project, no data.
 *
 *   npm run build && npx vite-node e2e/cors-probe.ts
 */
import { DIST, launch, newProfile, openNewTab, removeProfile } from './harness';

const PROJECT = 'senuma-cors-probe-does-not-exist';
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;
const probes: [string, string, RequestInit][] = [
    ['Firestore: read a document', `${FIRESTORE}/vaults/probe/workspace/current`, { headers: { Authorization: 'Bearer not-a-token' } }],
    ['Firestore: commit (the write sync uses)', `${FIRESTORE}:commit`, { method: 'POST', headers: { Authorization: 'Bearer not-a-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ writes: [] }) }],
    ['Firestore: query a collection', `${FIRESTORE}/vaults/probe:runQuery`, { method: 'POST', headers: { Authorization: 'Bearer not-a-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'devices' }], limit: 1 } }) }],
    ['Firestore: update a document', `${FIRESTORE}/vaults/probe/devices/probe`, { method: 'PATCH', headers: { Authorization: 'Bearer not-a-token', 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: {} }) }],
    ['Firestore: delete a document', `${FIRESTORE}/vaults/probe/devices/probe`, { method: 'DELETE', headers: { Authorization: 'Bearer not-a-token' } }],
    ['Firebase Auth: exchange a Google sign-in', 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=not-a-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ postBody: 'id_token=x&providerId=google.com', requestUri: 'http://localhost', returnSecureToken: true }) }],
    ['Firebase Auth: refresh a session', 'https://securetoken.googleapis.com/v1/token?key=not-a-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: 'x' }) }],
    ['Firebase Auth: delete the account', 'https://identitytoolkit.googleapis.com/v1/accounts:delete?key=not-a-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: 'x' }) }],
];

const profile = newProfile();
const session = await launch(DIST, profile);
const page = await openNewTab(session);
const manifest = await session.worker.evaluate(() => chrome.runtime.getManifest()) as { host_permissions?: string[]; optional_host_permissions?: string[]; permissions?: string[] };
console.log(`extension ${session.extensionId}; permissions: ${manifest.permissions?.join(', ')}; host permissions: ${JSON.stringify(manifest.host_permissions ?? [])}; optional host: ${JSON.stringify(manifest.optional_host_permissions ?? [])}\n`);
for (const [what, url, init] of probes) {
    const result = await page.evaluate(async ({ url, init }) => {
        try {
            const response = await fetch(url, init);
            const body = await response.text();
            return `readable: HTTP ${response.status}; allow-origin: ${response.headers.get('access-control-allow-origin') ?? '(none)'}; body: ${body.replace(/\s+/g, ' ').slice(0, 110)}`;
        } catch (error) {
            return `BLOCKED: ${String(error)}`;
        }
    }, { url, init });
    console.log(`${what.padEnd(44)} ${result}`);
}
await session.context.close();
removeProfile(profile);

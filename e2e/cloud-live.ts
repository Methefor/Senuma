/**
 * Live check of the one-time cloud import against the real 1.x sync backend.
 *
 *   npx vite-node e2e/cloud-live.ts "<Chrome profile name>"      (after `npm run build`)
 *
 * Only for a profile that was signed in to 1.x cloud sync with an expendable test account.
 * The named profile is never opened or written: its 1.x extension storage (and nothing else of
 * the profile) is copied to a temporary folder while Chrome is closed, and Senuma runs against
 * that copy only. Nothing is written to the cloud; the check proves it. No token, account id or
 * address is printed, and the copy is deleted at the end.
 */
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importBackup } from '../src/core/backupImport';
import type { AppState } from '../src/core/types';
import { DIST, check, expect, launch, removeProfile, report } from './harness';

const ID = 'oghlifenjhpbebcdeboejbmemelkfobe';
const profileName = process.argv[2];
if (!profileName) throw new Error('Pass the Chrome profile name, for example "Profile 3".');
const chromeData = join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/User Data');
// NTF_USER_DATA points the check at a synthetic profile folder when trying out the script itself.
const userData = process.env.NTF_USER_DATA ?? chromeData;
const original = join(userData, profileName, 'Local Extension Settings', ID);
if (!existsSync(original)) throw new Error(`No New Tab Folders data in “${profileName}”.`);
if (/chrome\.exe/i.test(execSync('tasklist /FI "IMAGENAME eq chrome.exe"').toString())) throw new Error('Chrome is running. Close it first.');

/** Content and size of every file, so any change to the original shows. */
const fingerprint = (dir: string) => {
    const hash = createHash('sha256');
    for (const name of readdirSync(dir).sort()) hash.update(name).update(String(statSync(join(dir, name)).size)).update(readFileSync(join(dir, name)));
    return hash.digest('hex');
};
const originalBefore = fingerprint(original);

const root = mkdtempSync(join(tmpdir(), 'senuma-cloud-live-'));
const profile = join(root, 'profile');
const copy = join(profile, 'Default', 'Local Extension Settings', ID);
mkdirSync(copy, { recursive: true });
for (const name of readdirSync(original)) if (name !== 'LOCK') cpSync(join(original, name), join(copy, name));

// Senuma under the published extension ID, so it opens the copied 1.x storage.
// The published build's files (code only) supply the store key; any profile that has it installed will do.
const builds = [join(userData, profileName), join(chromeData, 'Profile 1'), join(chromeData, 'Default')].map(p => join(p, 'Extensions', ID)).find(p => existsSync(p));
const saved = 'release/legacy/NewTabFolders-1.80-published';
const live = builds ? join(builds, readdirSync(builds).sort().at(-1)!) : existsSync(saved) ? saved : null;
const key = live ? (JSON.parse(readFileSync(join(live, 'manifest.json'), 'utf8')).key as string | undefined) : undefined;
if (!key) throw new Error('The published build (with its key) was not found in that profile or in release/legacy.');
const extension = join(root, 'extension');
cpSync(DIST, extension, { recursive: true });
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8')) as { version: string; permissions: string[]; host_permissions?: string[] };
writeFileSync(join(extension, 'manifest.json'), JSON.stringify({ ...manifest, key }, null, 2));

type Stored = { 'bos.state': AppState; 'bos.snapshots'?: { at: number; reason: string }[]; ntf_auth?: Record<string, unknown>; ntf_data?: { updatedAt?: number } };
const session = await launch(extension, profile);
const storage = () => session.worker.evaluate(() => chrome.storage.local.get(['bos.state', 'bos.snapshots', 'ntf_auth', 'ntf_data'])) as Promise<Stored>;
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v as object).sort(([a], [b]) => a.localeCompare(b))) : v))).digest('hex');
const shape = (state: AppState) => ({ spaces: state.spaceOrder.map(id => state.spaces[id]!.name).sort(), links: Object.values(state.items).map(item => item.url).sort() });

// Every request to a Google API host, without anything that identifies the account.
const calls: string[] = [];
const documents: { updateTime: string; body: unknown }[] = [];
session.context.on('request', request => {
    const url = new URL(request.url());
    if (/googleapis\.com$/.test(url.hostname)) calls.push(`${request.method()} ${url.hostname}`);
});
session.context.on('response', response => {
    if (response.request().method() !== 'GET' || !response.url().includes('firestore.googleapis.com') || !response.ok()) return;
    void response.json().then(body => documents.push({ updateTime: String((body as { updateTime?: unknown }).updateTime), body })).catch(() => undefined);
});

const cloudJson = () => (documents.at(-1)!.body as { fields: { ntf_data: { stringValue: string } } }).fields.ntf_data.stringValue;

const page = await session.context.newPage();
let authDigest = '';
let dataDigest = '';
let converted: AppState;
let beforeMerge: AppState;

await check('Copy', 'Senuma opens the copied 1.x storage and finds the saved sign-in', async () => {
    expect(session.extensionId === ID, `running as ${session.extensionId}`);
    await page.goto('chrome://newtab/');
    await page.waitForSelector('.home, .onboarding', { timeout: 15_000 });
    await page.waitForTimeout(1500);
    const stored = await storage();
    expect(!!stored.ntf_data, 'the copy holds no 1.x data');
    expect(typeof stored.ntf_auth?.uid === 'string' && typeof stored.ntf_auth.refreshToken === 'string', 'the copy holds no 1.x sign-in record: this profile was not signed in to sync');
    authDigest = digest(stored.ntf_auth);
    dataDigest = digest(stored.ntf_data);
    converted = stored['bos.state'];
    expect(calls.length === 0, `requests before anything was asked: ${calls.join(', ')}`);
    if (await page.locator('.migration-actions button').count()) await page.locator('.migration-actions button').last().click();
    return `profile “${profileName}” (copy only); converted on this device: ${converted.spaceOrder.length} Spaces, ${Object.keys(converted.items).length} links; no network request so far`;
});

const openData = async () => {
    await page.goto('chrome://newtab/');
    await page.waitForSelector('.home');
    await page.locator('.topbar button').last().click();
    await page.locator('.settings-nav button').nth(4).click();
    await page.locator('.row', { hasText: /cloud copy|bulut kopya/i }).waitFor({ timeout: 5000 });
};
const askCloud = async () => {
    const seen = documents.length;
    await page.locator('.row', { hasText: /cloud copy|bulut kopya/i }).locator('.button').click();
    await page.waitForSelector('.choice, .toast', { timeout: 20_000 });
    expect((await page.locator('.choice').count()) === 2, `no copy offered; the page said: “${(await page.locator('.toast').allInnerTexts()).join(' ')}”`);
    for (let i = 0; i < 20 && documents.length === seen; i++) await page.waitForTimeout(100);
};

await check('Live read', 'the real cloud document is found and read on request', async () => {
    await openData();
    expect(calls.length === 0, `requests before the button was pressed: ${calls.join(', ')}`);
    await askCloud();
    const copyInCloud = importBackup(cloudJson());
    expect(!!copyInCloud, 'the document could not be converted');
    return `requests: ${calls.join(', ')}; the cloud copy holds ${copyInCloud!.spaceOrder.length} Spaces and ${Object.keys(copyInCloud!.items).length} links`;
});

await check('Live read', 'cloud date and device date are shown and agree with the data', async () => {
    const fields = (documents.at(-1)!.body as { fields: { updatedAt?: { integerValue?: string } } }).fields;
    const cloudAt = Number(fields.updatedAt?.integerValue);
    const localAt = (await storage()).ntf_data?.updatedAt ?? 0;
    const shown = (await page.locator('.settings-body .note').allInnerTexts()).join(' / ').replace(/\s+/g, ' ');
    const language = (await storage())['bos.state'].prefs.language;
    for (const time of [cloudAt, localAt]) expect(!time || shown.includes(new Date(time).toLocaleString(language)), `the page does not show ${new Date(time).toISOString()}: “${shown}”`);
    return `cloud ${new Date(cloudAt).toISOString()}, device ${localAt ? new Date(localAt).toISOString() : 'unknown'} → ${cloudAt > localAt ? 'cloud is newer' : cloudAt === localAt ? 'same' : 'device is newer'}; shown: “${shown.slice(0, 220)}”`;
});

await check('Merge', 'a restore point is saved first; nothing already here is lost', async () => {
    const before = await storage();
    beforeMerge = before['bos.state'];
    await page.locator('.choice').first().click();
    await page.waitForTimeout(1200);
    const after = await storage();
    const newest = after['bos.snapshots']?.[0];
    expect(!!newest && newest.at > (before['bos.snapshots']?.[0]?.at ?? 0) && newest.reason === 'import', 'no restore point was saved before the merge');
    const was = shape(beforeMerge);
    const now = shape(after['bos.state']);
    expect(was.links.every(url => now.links.includes(url)) && was.spaces.every(name => now.spaces.includes(name)), 'something that was here before the merge is gone');
    return `Spaces ${was.spaces.length} → ${now.spaces.length}, links ${was.links.length} → ${now.links.length}`;
});

await check('Restore', 'the restore point brings back the setup from before the merge', async () => {
    await openData();
    await page.locator('.list-row .button').first().click();
    await page.waitForTimeout(1200);
    const now = shape((await storage())['bos.state']);
    expect(JSON.stringify(now) === JSON.stringify(shape(beforeMerge)), 'the restored setup differs from the one before the merge');
    return `${now.spaces.length} Spaces, ${now.links.length} links, as before`;
});

await check('Replace', 'a restore point is saved first; the setup becomes the cloud copy', async () => {
    await openData();
    const before = await storage();
    await askCloud();
    const expected = importBackup(cloudJson())!;
    await page.locator('.choice').nth(1).click();
    await page.waitForTimeout(1200);
    const after = await storage();
    const newest = after['bos.snapshots']?.[0];
    expect(!!newest && newest.at > (before['bos.snapshots']?.[0]?.at ?? 0), 'no restore point was saved before the replace');
    const now = shape(after['bos.state']);
    expect(JSON.stringify(now) === JSON.stringify(shape(expected)), 'the setup is not the cloud copy');
    return `${now.spaces.length} Spaces, ${now.links.length} links, equal to the cloud copy; ${after['bos.snapshots']?.length} restore points kept`;
});

await check('Read-only', 'nothing was written, updated or deleted in the cloud', async () => {
    const allowed = new Set(['POST securetoken.googleapis.com', 'GET firestore.googleapis.com', 'OPTIONS securetoken.googleapis.com', 'OPTIONS firestore.googleapis.com']);
    const other = calls.filter(call => !allowed.has(call));
    expect(other.length === 0, `unexpected requests: ${other.join(', ')}`);
    expect(documents.length >= 2 && documents[0]!.updateTime === documents.at(-1)!.updateTime && documents[0]!.updateTime !== 'undefined', 'the document\'s server-side update time changed, or was not reported');
    return `${calls.length} requests in all: ${[...new Set(calls)].join(', ')}; the document's server-side update time is the same on the first and last read (${documents[0]!.updateTime})`;
});

await check('Read-only', 'the 1.x sign-in record and 1.x data in the copy are unchanged', async () => {
    const stored = await storage();
    expect(digest(stored.ntf_auth) === authDigest, 'ntf_auth changed');
    expect(digest(stored.ntf_data) === dataDigest, 'ntf_data changed');
});

await check('Permissions', 'no new Chrome permission', async () => {
    const granted = await session.worker.evaluate(() => chrome.permissions.getAll()) as { permissions?: string[]; origins?: string[] };
    expect(!manifest.host_permissions?.length && !(granted.origins ?? []).length, `host access: ${JSON.stringify(granted.origins)}`);
    expect(!manifest.permissions.includes('identity') && (granted.permissions ?? []).every(name => ['storage', 'search', 'newTabPageOverride'].includes(name)), `granted: ${granted.permissions?.join(', ')}`);
    return `manifest ${manifest.version}; granted: ${(granted.permissions ?? []).sort().join(', ')}; no host access, no identity`;
});

await check('Console', 'no errors on any Senuma page', async () => {
    expect(session.errors.length === 0, session.errors.slice(0, 4).join(' || '));
});

await session.context.close();
await check('Original profile', 'untouched', async () => {
    expect(fingerprint(original) === originalBefore, 'the original profile\'s extension storage changed');
    return `“${profileName}”: extension storage identical before and after`;
});
removeProfile(root);
process.exit(report() ? 1 : 0);

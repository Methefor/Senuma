/**
 * Account & Sync in the running extension: two browser profiles as two devices, a third as a
 * stranger, against the local Firestore emulator with its mock sign-in. No real service.
 *
 *   npm run test:sync:e2e      (builds the sync build and runs this inside the emulator)
 */
import { resolve } from 'node:path';
import { sanitize } from '../src/core/sanitize';
import type { AppState } from '../src/core/types';
import { workspace } from '../src/sync/fixtures';
import { check, expect, launch, newProfile, readStorage, removeProfile, report, waitForState, writeStorage, type Session } from './harness';
import type { Page } from 'playwright';

const DIST_SYNC = resolve('dist-sync');
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST ?? '';
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(EMULATOR)) throw new Error('Run inside the emulator: npm run test:sync:e2e');
const ADMIN = { Authorization: 'Bearer owner' };
const DOCS = `http://${EMULATOR}/v1/projects/demo-senuma/databases/(default)/documents`;
const OWNER = 'local_owner';

/** What the service holds for an account: every document, raw. */
async function vault(uid = OWNER): Promise<string> {
    const parts: string[] = [];
    for (const name of ['workspace', 'history', 'keys', 'devices']) parts.push(await (await fetch(`${DOCS}/vaults/${uid}/${name}`, { headers: ADMIN })).text());
    return parts.join('\n');
}
const cloudRevision = async (): Promise<number | null> => {
    const response = await fetch(`${DOCS}/vaults/${OWNER}/workspace/current`, { headers: ADMIN });
    return response.ok ? Number(((await response.json()) as { fields: { revision: { integerValue: string } } }).fields.revision.integerValue) : null;
};

await fetch(`http://${EMULATOR}/emulator/v1/projects/demo-senuma/databases/(default)/documents`, { method: 'DELETE' });

interface Device { session: Session; page: Page; profile: string; files: string[] }

/**
 * Opens a new tab and records every file the page loads, through the browser's own network log
 * (extension files do not appear in the page's performance entries).
 */
async function openTracked(session: Session): Promise<{ page: Page; files: string[] }> {
    const page = await session.context.newPage();
    const files: string[] = [];
    const cdp = await session.context.newCDPSession(page);
    cdp.on('Network.requestWillBeSent', event => void files.push(String(event.request.url).split('/').pop() ?? ''));
    await cdp.send('Network.enable');
    await page.goto('chrome://newtab/');
    await page.waitForSelector('.home', { timeout: 10_000 });
    return { page, files };
}
async function device(seed: number, links = 6): Promise<Device> {
    const profile = newProfile();
    const session = await launch(DIST_SYNC, profile);
    await writeStorage(session, { 'bos.state': { ...sanitize(workspace({ links, spaces: 2 }, seed)), onboarded: true, updatedAt: 1000 } });
    return { session, profile, ...(await openTracked(session)) };
}
const state = (d: Device) => readStorage<AppState>(d.session, 'bos.state') as Promise<AppState>;
const openSync = async (d: Device) => {
    if (!(await d.page.locator('.overlay-settings').count())) await d.page.locator('.topbar button').last().click();
    await d.page.locator('.settings-nav button', { hasText: 'Account & Sync' }).click();
    await d.page.locator('[data-sync=root]').waitFor();
};
const phase = (d: Device, wanted: string, timeout = 20_000) => d.page.locator(`[data-sync=root][data-phase="${wanted}"]`).waitFor({ timeout });
const syncNow = async (d: Device) => {
    await d.page.locator('[data-sync=sync-now]').click();
    await d.page.waitForTimeout(400);
};
/** An edit made on a device, the way another tab's edit arrives: through storage. */
async function edit(d: Device, change: (current: AppState) => void): Promise<void> {
    const current = await state(d);
    change(current);
    await writeStorage(d.session, { 'bos.state': { ...current, updatedAt: Date.now() } });
    await d.page.waitForTimeout(600);
}
const loaded = async (d: Device) => d.files.filter(name => /sync/i.test(name));

const a = await device(1);
let recoveryKey = '';

await check('Lazy loading', 'nothing of sync is loaded by opening a new tab, or by opening Settings', async () => {
    expect((await loaded(a)).length === 0, `loaded at startup: ${(await loaded(a)).join(', ')}`);
    await a.page.locator('.topbar button').last().click();
    await a.page.locator('.settings-nav').waitFor();
    await a.page.waitForTimeout(500);
    expect((await loaded(a)).length === 0, `loaded with Settings: ${(await loaded(a)).join(', ')}`);
    await openSync(a);
    await phase(a, 'signed-out');
    const now = await loaded(a);
    expect(now.some(name => /SyncSettings/.test(name)) && now.some(name => /syncRuntime/.test(name)), `after opening the screen: ${now.join(', ')}`);
    return `loaded only when Account & Sync was opened: ${now.map(name => name.replace(/-[\w-]{8}\./, '.')).join(', ')}`;
});

await check('Signed out', 'the screen says what sync does and does not do, and claims no more than that', async () => {
    const text = (await a.page.locator('[data-sync=root]').innerText()).replace(/\s+/g, ' ');
    for (const needed of ['works without an account', 'encrypted before it leaves this device', 'are not uploaded', 'What is not hidden', 'no analytics', 'Test build']) expect(text.includes(needed), `missing: “${needed}”`);
    for (const banned of [/zero.knowledge/i, /nobody can ever/i, /military/i, /anonymous/i, /can never (be )?(read|access)/i, /revoke/i]) expect(!banned.test(text), `claims too much: ${banned}`);
});

await check('Turning sync on', 'the recovery key is shown once and nothing is uploaded until it is confirmed', async () => {
    await a.page.locator('[data-sync=sign-in]').click();
    await phase(a, 'new-vault');
    recoveryKey = (await a.page.locator('[data-sync=recovery-key]').innerText()).trim();
    expect(/^([0-9A-HJKMNP-TV-Z]{4}-){8}[0-9A-HJKMNP-TV-Z]{4}$/.test(recoveryKey), `key shown: ${recoveryKey}`);
    expect(!(await vault()).includes('"name"'), 'something was uploaded before the key was confirmed');
    expect(await a.page.locator('[data-sync=confirm-vault]').isDisabled(), 'sync could be turned on without confirming the key');
    await a.page.locator('[data-sync=confirm-key]').fill('zzzz');
    expect(await a.page.locator('[data-sync=confirm-vault]').isDisabled(), 'a wrong confirmation was accepted');
    await a.page.locator('[data-sync=confirm-key]').fill(recoveryKey.slice(-4).toLowerCase());
    await a.page.locator('[data-sync=confirm-vault]').click();
    await phase(a, 'synced');
    expect((await cloudRevision()) === 1, 'no first revision in the vault');
    return 'key shown, confirmed by its last four characters, then revision 1 written';
});

await check('Privacy', 'what the emulator holds has no title, address, Space name or device name in it', async () => {
    const held = await vault();
    const local = await state(a);
    const secrets = [...Object.values(local.items).flatMap(item => [item.title, new URL(item.url).hostname]), ...Object.values(local.spaces).map(space => space.name), 'Chromium', 'Windows', 'owner@example.test'];
    for (const secret of secrets) expect(!held.includes(secret), `found in the vault: ${secret}`);
    const fields = [...new Set([...held.matchAll(/"(\w+)": \{\s*"(?:integer|string|bytes|timestamp)Value"/g)].map(match => match[1]))].sort();
    expect(JSON.stringify(fields) === JSON.stringify(['format', 'keyId', 'nonce', 'payload', 'revision', 'salt', 'updatedAt', 'v', 'wrapped']), `fields: ${fields.join(', ')}`);
    return `fields stored: ${fields.join(', ')}`;
});

const b = await device(2);

await check('A second device', 'needs the recovery key; a wrong one is refused in place and changes nothing', async () => {
    await openSync(b);
    await b.page.locator('[data-sync=sign-in]').click();
    await phase(b, 'needs-key');
    const before = JSON.stringify((await state(b)).items);
    await b.page.locator('[data-sync=enter-key]').fill(`${recoveryKey.slice(0, -1)}${recoveryKey.endsWith('0') ? '1' : '0'}`);
    await b.page.locator('[data-sync=unlock]').click();
    await b.page.locator('.field-error', { hasText: 'not the recovery key' }).waitFor({ timeout: 8000 });
    expect(JSON.stringify((await state(b)).items) === before, 'the setup changed');
    expect((await b.page.locator('[data-sync=root]').getAttribute('data-phase')) === 'needs-key', 'left the key screen');
});

await check('A second device', 'with its own setup is asked how to combine; merging keeps both, and a restore point is saved first', async () => {
    await b.page.locator('[data-sync=enter-key]').fill(recoveryKey.toLowerCase());
    await b.page.locator('[data-sync=unlock]').click();
    await phase(b, 'first-sync');
    const said = (await b.page.locator('[data-sync=root]').innerText()).replace(/\s+/g, ' ');
    expect(/2 Spaces and 6 links.*2 Spaces and 6 links/.test(said), said.slice(0, 200));
    expect((await cloudRevision()) === 1, 'something was written before the choice');
    await b.page.locator('[data-sync=first-merge]').click();
    await phase(b, 'synced');
    const merged = await waitForState(b.session, (s: AppState) => (Object.keys(s.items).length === 12 ? s : null));
    const points = await readStorage<{ reason: string }[]>(b.session, 'bos.snapshots');
    expect(points?.[0]?.reason === 'sync', `restore points: ${JSON.stringify(points?.map(point => point.reason))}`);
    await syncNow(a);
    await waitForState(a.session, (s: AppState) => Object.keys(s.items).length === 12);
    return `${Object.keys(merged.items).length} links on both devices`;
});

let shared = '';
await check('Edits', 'an edit on one device arrives on the other', async () => {
    shared = Object.keys((await state(a)).items)[0]!;
    await edit(a, current => void (current.items[shared]!.title = 'Renamed on device A'));
    await syncNow(a);
    await phase(a, 'synced');
    await syncNow(b);
    await waitForState(b.session, (s: AppState) => s.items[shared]?.title === 'Renamed on device A');
});

await check('Conflict', 'the same link renamed on both devices stops sync and shows both versions; nothing changes until a choice is made', async () => {
    await edit(a, current => void (current.items[shared]!.title = 'Title from A'));
    await edit(b, current => void (current.items[shared]!.title = 'Title from B'));
    await syncNow(a);
    await phase(a, 'synced');
    const cloud = await cloudRevision();
    await syncNow(b);
    await phase(b, 'conflict');
    const panel = (await b.page.locator('[data-sync=conflicts]').innerText()).replace(/\s+/g, ' ');
    expect(/Changed both here and on another device: 1/.test(panel) && panel.includes('Title from B') && panel.includes('Title from A') && panel.includes('This device') && panel.includes('Cloud'), panel.slice(0, 260));
    expect((await state(b)).items[shared]!.title === 'Title from B' && (await cloudRevision()) === cloud, 'something was changed before the choice');
    expect(await b.page.locator('[data-sync=apply-choices]').isDisabled(), 'choices could be applied before any was made');
    expect(!(await b.page.locator('[data-sync=keep-both]').isDisabled()), 'keep both is not offered for a link');
    return panel.slice(0, 200);
});

await check('Conflict', '“keep both” keeps this device’s link and adds the cloud’s beside it, on both devices', async () => {
    await b.page.locator('[data-sync=keep-both]').click();
    await phase(b, 'synced');
    const settled = await waitForState(b.session, (s: AppState) => (s.items[`${shared}-cloud`] ? s : null));
    expect(settled.items[shared]!.title === 'Title from B' && settled.items[`${shared}-cloud`]!.title === 'Title from A', 'the two versions are not both there');
    await syncNow(a);
    await waitForState(a.session, (s: AppState) => s.items[shared]?.title === 'Title from B' && s.items[`${shared}-cloud`]?.title === 'Title from A');
});

await check('Conflict', 'choosing per item works: the cloud’s version is taken for the one chosen', async () => {
    await edit(a, current => void (current.items[shared]!.title = 'Second from A'));
    await edit(b, current => void (current.items[shared]!.title = 'Second from B'));
    await syncNow(a);
    await phase(a, 'synced');
    await syncNow(b);
    await phase(b, 'conflict');
    await b.page.locator('.sync-side', { hasText: 'Cloud' }).locator('input').click();
    await b.page.locator('[data-sync=apply-choices]').click();
    await phase(b, 'synced');
    await waitForState(b.session, (s: AppState) => s.items[shared]?.title === 'Second from A');
});

await check('Paused', 'a paused device neither sends nor receives; resuming carries on', async () => {
    await b.page.locator('[data-sync=pause]').click();
    await phase(b, 'paused');
    const before = await cloudRevision();
    await edit(b, current => void (current.items[shared]!.title = 'Edited while paused'));
    await b.page.waitForTimeout(4500); // longer than the quiet period after which a change would be sent
    expect((await cloudRevision()) === before, 'a paused device sent its edit');
    await b.page.locator('[data-sync=resume]').click();
    await phase(b, 'synced');
    expect((await cloudRevision()) === before! + 1, 'the edit was not sent after resuming');
});

await check('Offline', 'offline is a state, not an error; the edit waits and is sent when the connection is back', async () => {
    await b.session.context.setOffline(true);
    await edit(b, current => void (current.items[shared]!.title = 'Edited offline'));
    await b.page.locator('[data-sync=sync-now]').click();
    await phase(b, 'offline');
    const said = await b.page.locator('[data-sync=state]').innerText();
    expect(/saved on this device/.test(said), said);
    const before = await cloudRevision();
    await b.session.context.setOffline(false);
    await b.page.evaluate(() => window.dispatchEvent(new Event('online')));
    await phase(b, 'synced');
    expect((await cloudRevision()) === before! + 1, 'the offline edit was not sent');
    await syncNow(a);
    await waitForState(a.session, (s: AppState) => s.items[shared]?.title === 'Edited offline');
});

await check('Sign-in expired', 'sync stops with a plain message; signing in again carries on', async () => {
    await writeStorage(a.session, { 'bos.sync.mock.session': { uid: OWNER, email: 'owner@example.test', expired: true } });
    await a.page.locator('[data-sync=sync-now]').click();
    await a.page.locator('[data-sync=error][data-error="auth-expired"]').waitFor({ timeout: 10_000 });
    await a.page.locator('[data-sync=sign-in-again]').click();
    await phase(a, 'synced');
});

await check('Recovery key', 'can be shown again on a syncing device, only after an explicit confirmation', async () => {
    expect((await a.page.locator('[data-sync=recovery-key]').count()) === 0, 'the key is on screen without being asked for');
    const row = a.page.locator('.row', { hasText: 'Recovery key' }).first();
    await row.locator('.button', { hasText: 'Show' }).click();
    expect((await a.page.locator('[data-sync=recovery-key]').count()) === 0, 'the key was shown without confirmation');
    await row.locator('.button', { hasText: 'Show the key' }).click();
    const shown = (await a.page.locator('[data-sync=recovery-key]').innerText()).trim();
    expect(shown === recoveryKey, `shown ${shown}`);
    await row.locator('.button', { hasText: 'Hide' }).click();
});

await check('Devices', 'both devices are listed by name with this one marked; the wording does not promise a lock-out', async () => {
    await syncNow(a);
    const list = a.page.locator('[data-sync=devices] .list-row');
    await a.page.waitForFunction(() => document.querySelectorAll('[data-sync=devices] .list-row').length === 2, null, { timeout: 10_000 });
    const text = (await a.page.locator('[data-sync=devices]').innerText()).replace(/\s+/g, ' ');
    expect((await list.count()) === 2 && /this device/.test(text) && /last synced/.test(text), text);
    const hint = (await a.page.locator('[data-sync=root]').innerText()).replace(/\s+/g, ' ');
    expect(/does not erase what that device already has/.test(hint) && /does not sign that device out/.test(hint), 'the limits of removal are not stated');
});

await check('Devices', 'a removed device stops syncing and is told so; everything on it is still there', async () => {
    const links = Object.keys((await state(b)).items).length;
    const other = a.page.locator('[data-sync=devices] .list-row').filter({ hasNot: a.page.locator('input') });
    await other.locator('.button', { hasText: 'Remove' }).click();
    await other.locator('.button.is-danger').click();
    await a.page.waitForFunction(() => document.querySelectorAll('[data-sync=devices] .list-row').length === 1, null, { timeout: 10_000 });
    await syncNow(b);
    await phase(b, 'signed-out');
    const said = (await b.page.locator('[data-sync=root]').innerText()).replace(/\s+/g, ' ');
    expect(/removed from sync on another device/.test(said) && /still here/.test(said), said.slice(0, 200));
    expect(Object.keys((await state(b)).items).length === links, 'links were removed from the device');
});

await check('Signing out', 'stops sync on the device and leaves its setup exactly as it was; the cloud copy stays', async () => {
    const before = JSON.stringify((await state(a)).items);
    const revision = await cloudRevision();
    await a.page.locator('[data-sync=sign-out]').click();
    await phase(a, 'signed-out');
    expect(JSON.stringify((await state(a)).items) === before, 'the setup changed');
    expect((await cloudRevision()) === revision, 'the cloud copy changed');
    expect((await readStorage(a.session, 'bos.sync')) === null || (await readStorage(a.session, 'bos.sync')) === undefined, 'sync memory was left behind');
});

const stranger = await device(3);
await check('A different account', 'gets its own empty vault and is never asked for, or shown, anything of the first', async () => {
    await writeStorage(stranger.session, { 'bos.sync.mock.pick': { uid: 'local_stranger', email: 'stranger@example.test' } });
    await openSync(stranger);
    await stranger.page.locator('[data-sync=sign-in]').click();
    await phase(stranger, 'new-vault'); // not "enter your recovery key": no vault of the owner's is visible
    expect(!(await vault('local_stranger')).includes('integerValue'), 'something exists for the stranger before confirming');
});

await check('Restart', 'a device with sync on loads the engine by itself on the next new tab, and one without does not', async () => {
    const c = await device(4);
    await openSync(c);
    await c.page.locator('[data-sync=sign-in]').click();
    await phase(c, 'needs-key');
    await c.page.locator('[data-sync=enter-key]').fill(recoveryKey);
    await c.page.locator('[data-sync=unlock]').click();
    await phase(c, 'first-sync');
    await c.page.locator('[data-sync=first-cloud]').click();
    await phase(c, 'synced');
    const before = (await readStorage<{ lastSyncAt: number }>(c.session, 'bos.sync'))!.lastSyncAt;
    const tab = await openTracked(c.session);
    await waitForState(c.session, () => true); // the page is up
    for (let i = 0; i < 40 && !tab.files.some(name => /syncRuntime/.test(name)); i++) await tab.page.waitForTimeout(250);
    expect(tab.files.some(name => /syncRuntime/.test(name)), `files of the new tab: ${tab.files.filter(name => /\.js$/.test(name)).join(', ')}`);
    // And it synced by itself on opening.
    for (let i = 0; i < 40 && (await readStorage<{ lastSyncAt: number }>(c.session, 'bos.sync'))!.lastSyncAt === before; i++) await tab.page.waitForTimeout(250);
    expect((await readStorage<{ lastSyncAt: number }>(c.session, 'bos.sync'))!.lastSyncAt > before, 'the new tab did not sync');
    const off = await openTracked(a.session); // A signed out
    await off.page.waitForTimeout(1500);
    expect(!off.files.some(name => /sync/i.test(name)), `sync code was loaded on a device with sync off: ${off.files.filter(name => /sync/i.test(name)).join(', ')}`);
    expect(c.session.errors.length === 0, c.session.errors.slice(0, 3).join(' || '));
    await c.session.context.close();
    removeProfile(c.profile);
});

await check('Console', 'no errors on any page of any device', async () => {
    const errors = [...a.session.errors, ...b.session.errors, ...stranger.session.errors];
    expect(errors.length === 0, errors.slice(0, 4).join(' || '));
});

for (const d of [a, b, stranger]) {
    await d.session.context.close();
    removeProfile(d.profile);
}
process.exit(report() ? 1 : 0);

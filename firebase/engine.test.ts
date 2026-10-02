/**
 * The sync engine end to end, as two or more simulated devices against the local emulator:
 * real encryption, real REST transport, the real Security Rules. Sign-in is the emulator's mock
 * sign-in; no real project or account is involved.
 *
 *   npm run test:rules        (runs this file and rules.test.ts inside the emulator)
 */
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { Bytes, collection, doc, getDoc, getDocs, setDoc, type DocumentData, type Firestore } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_BACKGROUND } from '../src/core/background';
import { emptyState } from '../src/core/defaults';
import { ICON_TOTAL, embeddedTotal } from '../src/core/iconPolicy';
import * as ops from '../src/core/ops';
import { sanitize } from '../src/core/sanitize';
import type { AppState } from '../src/core/types';
import { PAYLOAD_LIMIT, formatRecoveryKey, newRecoverySecret } from '../src/sync/crypto';
import { createEngine, type Local, type SyncMeta } from '../src/sync/engine';
import { workspace } from '../src/sync/fixtures';
import { canonical } from '../src/sync/merge';
import { mockAuth, type MockUser } from '../src/sync/mockAuth';
import { toSyncable } from '../src/sync/scope';
import { firestoreTransport } from '../src/sync/transport';
import { backgroundStatus, chooseBackground, emptyDeviceLocal, type DeviceLocal } from '../src/sync/wallpaper';

const PROJECT = 'demo-senuma';
let env: RulesTestEnvironment;
let origin = '';
let serial = 0;
/** A fresh account per test, so that tests neither share a vault nor wait on each other's writes. */
const account = (name = 'alice'): MockUser => ({ uid: `${name}_${Date.now().toString(36)}_${serial++}`, email: `${name}@example.test` });

beforeAll(async () => {
    const address = process.env.FIRESTORE_EMULATOR_HOST ?? '';
    if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(address)) throw new Error(`These tests run only against a local emulator (FIRESTORE_EMULATOR_HOST is “${address}”). Use: npm run test:rules`);
    origin = `http://${address}`;
    env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host: address.slice(0, address.lastIndexOf(':')), port: Number(address.slice(address.lastIndexOf(':') + 1)), rules: readFileSync('firebase/firestore.rules', 'utf8') } });
});
afterAll(async () => {
    await env?.cleanup();
});

/** One simulated device: its own setup, its own sync memory, its own sign-in, nothing shared but the vault. */
function device(label: string, user: MockUser, initial: AppState = { ...emptyState(), onboarded: true }) {
    let state = initial;
    let meta: SyncMeta | null = null;
    let local: DeviceLocal = emptyDeviceLocal();
    let signedIn: MockUser | null = null;
    let online = true;
    const restorePoints: AppState[] = [];
    const io: Local = {
        state: () => state,
        async apply(next) {
            restorePoints.push(state);
            state = next;
        },
        meta: async () => meta,
        async saveMeta(next) {
            meta = next && (JSON.parse(JSON.stringify(next)) as SyncMeta);
        },
        device: async () => local,
        async saveDevice(next) {
            local = next;
        },
        online: () => online,
        now: () => Date.now(),
        label: () => label,
        wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
    };
    const auth = mockAuth(PROJECT, { read: async () => signedIn, write: async next => void (signedIn = next) }, async () => user);
    const engine = createEngine({ local: io, auth, transport: session => firestoreTransport({ origin, project: PROJECT }, session) });
    return {
        engine, restorePoints,
        get state() { return state; },
        get meta() { return meta; },
        get local() { return local; },
        edit(change: (current: AppState) => AppState) { state = change(state); },
        setLocal(next: DeviceLocal) { local = next; },
        setOnline(value: boolean) { online = value; },
        expire() { if (signedIn) signedIn = { ...signedIn, expired: true }; },
        doc: () => canonical(toSyncable(state)),
    };
}
type Device = ReturnType<typeof device>;

const setup = (seed: number, links = 6) => sanitize({ ...workspace({ links, spaces: 2 }, seed), onboarded: true });

/** Device A creates the vault; returns it with the recovery key the person was shown. */
async function firstDevice(user: MockUser, state = setup(1)): Promise<{ a: Device; recoveryKey: string }> {
    const a = device('Laptop', user, state);
    const shown = await a.engine.signIn();
    expect(shown.phase).toBe('new-vault');
    expect((await a.engine.confirmNewVault()).phase).toBe('synced');
    return { a, recoveryKey: shown.recoveryKey! };
}
/** A second device joins with the recovery key. */
async function join(user: MockUser, recoveryKey: string, label = 'Desktop', state?: AppState): Promise<Device> {
    const b = device(label, user, state);
    expect((await b.engine.signIn()).phase).toBe('needs-key');
    expect(await b.engine.unlock(recoveryKey)).toBe(true);
    return b;
}

/** Everything stored for an account, read with the rules off: what the service holds. */
async function stored(uid: string): Promise<Record<string, DocumentData>> {
    const out: Record<string, DocumentData> = {};
    await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore() as unknown as Firestore;
        for (const name of ['workspace', 'history', 'keys', 'devices']) {
            for (const entry of (await getDocs(collection(db, `vaults/${uid}/${name}`))).docs) out[`${name}/${entry.id}`] = entry.data();
        }
    });
    return out;
}
const revisionOf = async (uid: string): Promise<number | null> => (await stored(uid))['workspace/current']?.revision ?? null;
/** Changes the stored workspace document behind everyone's back, as a hostile or broken server could. */
async function tamper(uid: string, change: (current: DocumentData) => DocumentData): Promise<void> {
    await env.withSecurityRulesDisabled(async context => {
        const at = doc(context.firestore() as unknown as Firestore, `vaults/${uid}/workspace/current`);
        await setDoc(at, change((await getDoc(at)).data()!));
    });
}
const firstItem = (state: AppState) => Object.keys(state.items)[0]!;

describe('first sync', () => {
    it('nothing is uploaded until the person confirms the recovery key; then the vault holds one encrypted copy', async () => {
        const user = account();
        const a = device('Laptop', user, setup(1));
        const shown = await a.engine.signIn();
        expect(shown.phase).toBe('new-vault');
        expect(shown.recoveryKey).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){8}[0-9A-HJKMNP-TV-Z]{4}$/);
        expect(await stored(user.uid)).toEqual({});
        expect((await a.engine.confirmNewVault()).phase).toBe('synced');
        const vault = await stored(user.uid);
        expect(Object.keys(vault).map(path => path.split('/')[0]).sort()).toEqual(['devices', 'keys', 'workspace']);
        expect(vault['workspace/current']!.revision).toBe(1);
        expect(a.meta!.baseRevision).toBe(1);
        // The recovery key can be shown again on this device (after the interface asks for confirmation).
        expect(await a.engine.recoveryKey()).toBe(shown.recoveryKey);
    });

    it('a second account gets its own empty vault and never sees the first', async () => {
        const { a } = await firstDevice(account());
        const stranger = device('Other', account('bob'), setup(9));
        expect((await stranger.engine.signIn()).phase).toBe('new-vault'); // no key to ask for: nothing of Alice's is visible
        expect((await stranger.engine.confirmNewVault()).phase).toBe('synced');
        expect(stranger.doc()).not.toBe(a.doc());
        expect((await stranger.engine.devices()).map(entry => entry.label)).toEqual(['Other']);
    });
});

describe('a second device', () => {
    it('with an empty setup joins with the recovery key and receives the workspace without being asked anything', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        expect(b.engine.status().phase).toBe('synced');
        expect(b.doc()).toBe(a.doc());
        expect(b.restorePoints).toHaveLength(1); // even an empty setup is kept before being replaced
    });

    it('with its own setup is asked how to combine, and merging keeps everything from both', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user, setup(1));
        const b = device('Desktop', user, setup(2));
        await b.engine.signIn();
        await b.engine.unlock(recoveryKey);
        expect(b.engine.status()).toMatchObject({ phase: 'first-sync', firstSync: { cloud: { spaces: 2, links: 6 }, device: { spaces: 2, links: 6 } } });
        expect(await revisionOf(user.uid)).toBe(1); // nothing was written while waiting for the answer
        expect((await b.engine.resolveFirstSync('merge')).phase).toBe('synced');
        expect(Object.keys(b.state.items)).toHaveLength(12);
        expect(b.restorePoints).toHaveLength(1);
        await a.engine.sync();
        expect(a.doc()).toBe(b.doc());
    });

    it('can instead take the cloud copy, or put its own in the cloud’s place', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user, setup(1));
        const takes = device('Takes', user, setup(2));
        await takes.engine.signIn();
        await takes.engine.unlock(recoveryKey);
        await takes.engine.resolveFirstSync('cloud');
        expect(takes.doc()).toBe(a.doc());
        const gives = device('Gives', user, setup(3));
        await gives.engine.signIn();
        await gives.engine.unlock(recoveryKey);
        await gives.engine.resolveFirstSync('device');
        await a.engine.sync();
        expect(a.doc()).toBe(gives.doc());
        expect(a.restorePoints).toHaveLength(1); // A's previous setup was kept before it was replaced
    });

    it('with a wrong, mistyped or foreign recovery key is refused and nothing changes', async () => {
        const user = account();
        const { recoveryKey } = await firstDevice(user);
        const b = device('Desktop', user, setup(2));
        const before = b.doc();
        await b.engine.signIn();
        const someoneElses = await formatRecoveryKey(newRecoverySecret());
        for (const wrong of [someoneElses, 'not a key', '', recoveryKey.slice(0, -1) + (recoveryKey.endsWith('0') ? '1' : '0')]) expect(await b.engine.unlock(wrong), wrong).toBe(false);
        expect(b.engine.status().phase).toBe('needs-key');
        expect(b.meta).toBeNull();
        expect(b.doc()).toBe(before);
        expect(Object.keys(await stored(user.uid)).filter(path => path.startsWith('devices/'))).toHaveLength(1);
        expect(await b.engine.unlock(recoveryKey.toLowerCase().replace(/-/g, ' '))).toBe(true); // as a person types it
    });
});

describe('edits', () => {
    it('a local edit is sent as the next revision; the other device receives it and keeps a restore point', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const id = firstItem(a.state);
        a.edit(state => ops.updateItem(state, id, { title: 'Renamed on the laptop' }));
        expect((await a.engine.sync()).phase).toBe('synced');
        expect(await revisionOf(user.uid)).toBe(2);
        const before = b.state;
        expect((await b.engine.sync()).phase).toBe('synced');
        expect(b.state.items[id]!.title).toBe('Renamed on the laptop');
        expect(b.restorePoints.at(-1)).toBe(before);
        // Nothing left to do on either side.
        await a.engine.sync();
        await b.engine.sync();
        expect(await revisionOf(user.uid)).toBe(2);
        // The revision that was replaced is kept as history, verbatim.
        expect((await stored(user.uid))['history/1']!.revision).toBe(1);
    });

    it('concurrent edits that do not collide are merged without a question', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const id = firstItem(a.state);
        a.edit(state => ops.updateItem(state, id, { title: 'A’s title' }));
        b.edit(state => ops.addItem(state, state.spaceOrder[1]!, null, { url: 'added-on-b.example', title: 'B’s link' }).state);
        await a.engine.sync();
        expect((await b.engine.sync()).phase).toBe('synced');
        await a.engine.sync();
        expect(a.doc()).toBe(b.doc());
        expect(a.state.items[id]!.title).toBe('A’s title');
        expect(Object.values(a.state.items).some(item => item.title === 'B’s link')).toBe(true);
    });

    it('concurrent edits that collide stop: nothing is changed here or in the cloud until the person chooses', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const id = firstItem(a.state);
        a.edit(state => ops.updateItem(state, id, { title: 'A’s title' }));
        b.edit(state => ops.updateItem(state, id, { title: 'B’s title' }));
        await a.engine.sync();
        const cloud = await revisionOf(user.uid);
        const mine = b.doc();
        const status = await b.engine.sync();
        expect(status).toMatchObject({ phase: 'conflict', canKeepBoth: true });
        expect(status.conflicts).toEqual([expect.objectContaining({ kind: 'item', id, field: 'title', local: 'B’s title', remote: 'A’s title' })]);
        expect(b.doc()).toBe(mine);
        expect(await revisionOf(user.uid)).toBe(cloud);
        expect((await b.engine.sync()).phase).toBe('conflict'); // asking again does not decide it either
        // Keep the cloud's.
        expect((await b.engine.resolveConflicts('remote')).phase).toBe('synced');
        expect(b.state.items[id]!.title).toBe('A’s title');
    });

    it('a conflict settled as “keep this device” reaches the other device; “keep both” keeps the two versions side by side', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const id = firstItem(a.state);
        a.edit(state => ops.updateItem(state, id, { title: 'A’s title' }));
        b.edit(state => ops.updateItem(state, id, { title: 'B’s title' }));
        await a.engine.sync();
        await b.engine.sync();
        expect((await b.engine.resolveConflicts('local')).phase).toBe('synced');
        await a.engine.sync();
        expect(a.state.items[id]!.title).toBe('B’s title');

        a.edit(state => ops.updateItem(state, id, { title: 'A again' }));
        b.edit(state => ops.updateItem(state, id, { title: 'B again' }));
        await a.engine.sync();
        await b.engine.sync();
        expect((await b.engine.resolveConflicts('both')).phase).toBe('synced');
        expect(b.state.items[id]!.title).toBe('B again');
        expect(b.state.items[`${id}-cloud`]!.title).toBe('A again');
        const group = Object.values(b.state.spaces).flatMap(space => space.groups).find(candidate => candidate.itemIds.includes(id))!;
        expect(group.itemIds.slice(group.itemIds.indexOf(id), group.itemIds.indexOf(id) + 2)).toEqual([id, `${id}-cloud`]);
        await a.engine.sync();
        expect(a.doc()).toBe(b.doc());
    });

    it('an edit against a deletion is a question too, and choosing per conflict works', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const id = firstItem(a.state);
        a.edit(state => ops.removeItem(state, id));
        b.edit(state => ops.updateItem(state, id, { title: 'Still wanted' }));
        await a.engine.sync();
        const status = await b.engine.sync();
        expect(status.conflicts!.map(conflict => conflict.key)).toEqual([`item:${id}:exists`]);
        expect((await b.engine.resolveConflicts({ [`item:${id}:exists`]: 'local' })).phase).toBe('synced');
        await a.engine.sync();
        expect(a.state.items[id]!.title).toBe('Still wanted');
    });
});

describe('offline and paused', () => {
    it('edits made offline wait on the device and are merged when it is back', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        b.setOnline(false);
        b.edit(state => ops.addItem(state, state.spaceOrder[0]!, null, { url: 'offline-one.example', title: 'Offline one' }).state);
        b.edit(state => ops.addItem(state, state.spaceOrder[0]!, null, { url: 'offline-two.example', title: 'Offline two' }).state);
        expect((await b.engine.sync()).phase).toBe('offline');
        a.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'Renamed meanwhile' }));
        await a.engine.sync();
        expect(await revisionOf(user.uid)).toBe(2);
        b.setOnline(true);
        expect((await b.engine.sync()).phase).toBe('synced');
        await a.engine.sync();
        expect(a.doc()).toBe(b.doc());
        expect(Object.values(a.state.items).filter(item => item.title.startsWith('Offline'))).toHaveLength(2);
        expect(a.state.spaces[a.state.spaceOrder[0]!]!.name).toBe('Renamed meanwhile');
    });

    it('an unreachable service is “offline”, not an error, and changes nothing', async () => {
        const user = account();
        const { a } = await firstDevice(user);
        const unreachable = createEngine({
            local: { state: () => a.state, apply: async () => undefined, meta: async () => a.meta, saveMeta: async () => undefined, device: async () => a.local, saveDevice: async () => undefined, online: () => true, now: () => Date.now(), label: () => 'x', wait: async () => undefined },
            auth: mockAuth(PROJECT, { read: async () => user, write: async () => undefined }, async () => user),
            transport: session => firestoreTransport({ origin: 'http://127.0.0.1:9', project: PROJECT }, session),
        });
        expect((await unreachable.sync()).phase).toBe('offline');
    });

    it('paused sync sends and receives nothing; resuming carries on from where it stopped', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        expect((await a.engine.pause()).phase).toBe('paused');
        a.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'While paused' }));
        b.edit(state => ops.updateSpace(state, state.spaceOrder[1]!, { name: 'From the desktop' }));
        expect((await a.engine.sync()).phase).toBe('paused');
        await b.engine.sync();
        expect(await revisionOf(user.uid)).toBe(2); // only B's
        expect(a.state.spaces[a.state.spaceOrder[1]!]!.name).not.toBe('From the desktop');
        expect((await a.engine.resume()).phase).toBe('synced');
        await b.engine.sync();
        expect(a.doc()).toBe(b.doc());
    });

    it('an expired sign-in stops sync with a clear state; signing in again as the same account carries on', async () => {
        const user = account();
        const { a } = await firstDevice(user);
        a.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'Edited' }));
        a.expire();
        const before = a.doc();
        expect(await a.engine.sync()).toMatchObject({ phase: 'error', error: 'auth-expired' });
        expect(a.doc()).toBe(before);
        expect(await revisionOf(user.uid)).toBe(1);
        expect((await a.engine.reauthenticate()).phase).toBe('synced');
        expect(await revisionOf(user.uid)).toBe(2);
    });
});

describe('a cloud copy that cannot be trusted', () => {
    it('corrupted ciphertext is refused whole: nothing is applied', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const before = b.doc();
        await tamper(user.uid, current => ({ ...current, revision: 2, payload: Bytes.fromUint8Array(crypto.getRandomValues(new Uint8Array(2064))) }));
        expect(await b.engine.sync()).toMatchObject({ phase: 'error', error: 'unreadable' });
        expect(b.doc()).toBe(before);
        expect(b.meta!.baseRevision).toBe(1);
        expect(await a.engine.sync()).toMatchObject({ phase: 'error', error: 'unreadable' });
    });

    it('an old revision put back is refused: by its number, and by its bytes if it is renumbered', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const old = (await stored(user.uid))['workspace/current']!;
        a.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'Newer' }));
        await a.engine.sync();
        await b.engine.sync();
        const before = b.doc();
        await tamper(user.uid, () => old); // revision 1 again
        expect(await b.engine.sync()).toMatchObject({ phase: 'error', error: 'went-backwards' });
        await tamper(user.uid, () => ({ ...old, revision: 3 })); // the same old bytes, labelled as something new
        expect(await b.engine.sync()).toMatchObject({ phase: 'error', error: 'unreadable' });
        expect(b.doc()).toBe(before);
        expect(b.state.spaces[b.state.spaceOrder[0]!]!.name).toBe('Newer');
    });

    it('a copy written by a newer document format stops sync instead of being guessed at', async () => {
        const user = account();
        const { a } = await firstDevice(user);
        await tamper(user.uid, current => ({ ...current, format: 2, revision: 2 }));
        expect(await a.engine.sync()).toMatchObject({ phase: 'error', error: 'format-newer' });
    });

    it('a deleted cloud copy is not silently re-uploaded; the device can start it again on request', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const kept = a.doc();
        expect((await a.engine.deleteCloudData()).phase).toBe('signed-out');
        expect(await stored(user.uid)).toEqual({});
        expect(a.doc()).toBe(kept); // deleting cloud data does not touch the device
        expect(a.meta).toBeNull();
        b.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'After deletion' }));
        expect(await b.engine.sync()).toMatchObject({ phase: 'error', error: 'missing' });
        expect(await stored(user.uid)).toEqual({});
        expect((await b.engine.uploadAgain()).phase).toBe('synced');
        expect(await revisionOf(user.uid)).toBe(1);
        const c = await join(user, recoveryKey, 'Third'); // the same recovery key still opens it
        expect(c.doc()).toBe(b.doc());
    });
});

describe('limits', () => {
    it('a workspace over the size limit is not sent, not cut short, and stays whole on the device', async () => {
        const user = account();
        const { a } = await firstDevice(user);
        const before = (await stored(user.uid))['workspace/current']!;
        a.edit(() => sanitize({ ...workspace({ links: 15_000 }), onboarded: true }));
        expect(await a.engine.sync()).toMatchObject({ phase: 'error', error: 'too-large' });
        expect(Object.keys(a.state.items)).toHaveLength(15_000);
        const after = (await stored(user.uid))['workspace/current']!;
        expect(after.revision).toBe(1);
        expect((after.payload as Bytes).isEqual(before.payload as Bytes)).toBe(true);
    });

    it('oversized icons never reach the vault, and capping them does not make the device look changed', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        // A setup that holds what no save path would allow: a 200 KB icon and ten 30 KB ones.
        a.edit(state => {
            const items = { ...state.items };
            const ids = Object.keys(items);
            const icon = (length: number) => `data:image/png;base64,${'Q'.repeat(length)}`;
            ids.slice(0, 5).forEach((id, index) => (items[id] = { ...items[id]!, icon: icon(index === 0 ? 200_000 : 30_000) }));
            return { ...state, items };
        });
        expect((await a.engine.sync()).phase).toBe('synced');
        expect(((await stored(user.uid))['workspace/current']!.payload as Bytes).toUint8Array().length).toBeLessThan(PAYLOAD_LIMIT / 3);
        const revision = await revisionOf(user.uid);
        await a.engine.sync();
        expect(await revisionOf(user.uid)).toBe(revision); // nothing to send: no back-and-forth
        const b = await join(user, recoveryKey);
        expect(embeddedTotal(b.state.items)).toBeLessThanOrEqual(ICON_TOTAL);
        expect(Object.values(b.state.items).filter(item => item.icon?.startsWith('data:'))).toHaveLength(4);
        expect(Object.keys(b.state.items)).toHaveLength(Object.keys(a.state.items).length); // every link arrived
    });
});

describe('a background picture one device does not have', () => {
    it('is held, flagged, and never overwrites the device that has it', async () => {
        const user = account();
        const withPicture = ops.setPrefs(ops.addWallpaper(setup(1), { id: 'photoA1', name: 'family-holiday-2024.jpg', width: 10, height: 10, bytes: 100, color: '#000000', luminance: 0, lqip: 'data:image/webp;base64,AAAA', createdAt: 1 }),
            { background: { ...DEFAULT_BACKGROUND, source: { kind: 'upload', assetId: 'photoA1' } } });
        const { a, recoveryKey } = await firstDevice(user, withPicture);
        const b = await join(user, recoveryKey);
        expect(b.state.prefs.background).toEqual(DEFAULT_BACKGROUND);
        expect(backgroundStatus(b.state, b.local)).toEqual([{ slot: 'default', assetMissingLocally: true, deviceChoice: false }]);
        const revision = await revisionOf(user.uid);
        await b.engine.sync();
        await a.engine.sync();
        await b.engine.sync();
        expect(await revisionOf(user.uid)).toBe(revision);
        expect(a.state.prefs.background.source).toEqual({ kind: 'upload', assetId: 'photoA1' });
        // B picks its own background: it stays on B.
        const chosen = chooseBackground(b.state, b.local, 'default', { ...DEFAULT_BACKGROUND, source: { kind: 'solid', color: '#112233' } });
        b.edit(() => chosen.state);
        b.setLocal(chosen.device);
        await b.engine.sync();
        await a.engine.sync();
        expect(await revisionOf(user.uid)).toBe(revision);
        expect(a.state.prefs.background.source).toEqual({ kind: 'upload', assetId: 'photoA1' });
        // A real edit on B still syncs, and still does not disturb A's background.
        b.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'Edited on B' }));
        await b.engine.sync();
        await a.engine.sync();
        expect(a.state.spaces[a.state.spaceOrder[0]!]!.name).toBe('Edited on B');
        expect(a.state.prefs.background.source).toEqual({ kind: 'upload', assetId: 'photoA1' });
        expect(b.state.prefs.background.source).toEqual({ kind: 'solid', color: '#112233' });
    });
});

describe('devices', () => {
    it('are listed with their own names, readable only with the key; this device is marked', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        await join(user, recoveryKey, 'Desktop in the study');
        const list = await a.engine.devices();
        expect(list.map(entry => [entry.label, entry.thisDevice, entry.readable]).sort()).toEqual([['Desktop in the study', false, true], ['Laptop', true, true]]);
        expect(list.every(entry => entry.lastSyncAt > 0 && entry.createdAt > 0)).toBe(true);
        await a.engine.renameDevice('Work laptop');
        expect((await a.engine.devices()).find(entry => entry.thisDevice)!.label).toBe('Work laptop');
    });

    it('signing out stops sync on that device only, and leaves its setup exactly as it was', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const kept = b.state;
        expect((await b.engine.signOut()).phase).toBe('signed-out');
        expect(b.state).toBe(kept); // the very same setup: nothing was applied, removed or reset
        expect(b.meta).toBeNull();
        expect((await a.engine.devices()).map(entry => entry.label)).toEqual(['Laptop']);
        expect(await revisionOf(user.uid)).toBe(1); // the cloud copy stays
        b.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'Edited after signing out' }));
        expect((await b.engine.sync()).phase).toBe('signed-out');
        expect(await revisionOf(user.uid)).toBe(1);
    });

    it('removing a device takes it off the list and it stops syncing; it is not a revocation', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const kept = b.doc();
        await a.engine.removeDevice(b.meta!.deviceId);
        expect((await a.engine.devices()).map(entry => entry.label)).toEqual(['Laptop']);
        b.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'Edited after removal' }));
        expect(await b.engine.sync()).toMatchObject({ phase: 'signed-out', error: 'removed' });
        expect(await revisionOf(user.uid)).toBe(1); // its edit was not sent
        expect(b.meta).toBeNull();
        expect(b.doc()).not.toBe(kept); // its own setup, edit included, is still there
        // What removal does NOT do: the device keeps what it had, and with the recovery key it can join again.
        const again = device('Desktop', user, b.state);
        await again.engine.signIn();
        expect(await again.engine.unlock(recoveryKey)).toBe(true);
    });

    it('a new recovery key locks out devices that only have the old one, until they are given the new one', async () => {
        const user = account();
        const { a, recoveryKey } = await firstDevice(user);
        const b = await join(user, recoveryKey);
        const next = await a.engine.newRecoveryKey();
        expect(next).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){8}[0-9A-HJKMNP-TV-Z]{4}$/);
        expect(next).not.toBe(recoveryKey);
        const vault = await stored(user.uid);
        expect(Object.keys(vault).filter(path => path.startsWith('keys/'))).toHaveLength(1);
        expect(Object.keys(vault).filter(path => path.startsWith('history/'))).toHaveLength(0);
        expect((await b.engine.sync()).phase).toBe('needs-key');
        expect(await b.engine.unlock(recoveryKey)).toBe(false);
        expect(await b.engine.unlock(next!)).toBe(true);
        a.edit(state => ops.updateSpace(state, state.spaceOrder[0]!, { name: 'After the key change' }));
        await a.engine.sync();
        await b.engine.sync();
        expect(b.doc()).toBe(a.doc());
    });
});

describe('what the service holds (privacy)', () => {
    it('contains no title, address, Space or group name, Mode name, device name, picture file name, activity or account address', async () => {
        const user = account();
        // A setup with something in every part, including everything that must stay on the device.
        let state = setup(4, 12);
        state = ops.addMode(state, { name: 'Evening reading mode', glyph: 'E', spaceIds: [...state.spaceOrder] }).state;
        state = ops.addGroup(state, state.spaceOrder[0]!, 'Private group heading');
        state = ops.upsertProvider(state, { id: 'p1', name: 'Internal wiki search', urlTemplate: 'https://wiki.internal.example/find?q=%s', aliases: ['iw'] });
        state = ops.recordRecent(state, { url: 'https://recently-visited.example/page', title: 'Recently visited page' });
        state = ops.recordUsage(state, 'usage-key-marker');
        state = ops.addWallpaper(state, { id: 'wallA', name: 'family-holiday-2024.jpg', width: 10, height: 10, bytes: 100, color: '#000000', luminance: 0, lqip: 'data:image/webp;base64,LQIPMARKERLQIPMARKER', createdAt: 1 });
        state = ops.setPrefs(state, { background: { ...DEFAULT_BACKGROUND, source: { kind: 'upload', assetId: 'wallA' } } });
        const { a, recoveryKey } = await firstDevice(user, state);
        const b = await join(user, recoveryKey, 'Mete’s desktop in the study');
        a.edit(current => ops.updateItem(current, firstItem(current), { title: 'A title changed later' }));
        await a.engine.sync(); // so that history exists too
        await b.engine.sync();

        const vault = await stored(user.uid);
        expect(Object.keys(vault).map(path => path.split('/')[0]).filter((name, index, all) => all.indexOf(name) === index).sort()).toEqual(['devices', 'history', 'keys', 'workspace']);
        // Everything readable, as text: field names, strings, and every byte of every blob.
        const haystack = Object.entries(vault).map(([path, data]) => path + JSON.stringify(data, (_key, value: unknown) => (value instanceof Bytes ? Buffer.from(value.toUint8Array()).toString('latin1') : value))).join('\n');
        const secrets = [
            ...Object.values(a.state.items).flatMap(item => [item.title, item.url, new URL(item.url).hostname]),
            ...Object.values(a.state.spaces).flatMap(space => [space.name, ...space.groups.map(group => group.name)]).filter(Boolean),
            'Evening reading mode', 'Private group heading', 'Internal wiki search', 'wiki.internal.example',
            'Laptop', 'Mete’s desktop in the study', 'desktop', 'study',
            'family-holiday-2024', 'LQIPMARKER', 'wallA',
            'recently-visited.example', 'Recently visited page', 'usage-key-marker',
            user.email, 'example.test', 'https://', 'http', '"items"', '"spaces"', 'A title changed later',
        ];
        for (const secret of secrets) expect(haystack.includes(secret), `found in the vault: ${secret}`).toBe(false);
        // And the only field names anywhere are the approved ones.
        const names = new Set(Object.values(vault).flatMap(data => Object.keys(data)));
        expect([...names].sort()).toEqual(['format', 'keyId', 'nonce', 'payload', 'revision', 'salt', 'updatedAt', 'v', 'wrapped']);
        // Sanity: the same search does find these things in what the device itself holds.
        expect(JSON.stringify(a.state).includes('Evening reading mode') && JSON.stringify(a.state).includes('recently-visited.example')).toBe(true);
    });

    it('the copy another device decrypts has no activity, no picture files and no device-only settings in it either', async () => {
        const user = account();
        let state = ops.recordRecent(setup(5), { url: 'https://recently-visited.example/page', title: 'Recently visited page' });
        state = ops.recordUsage(state, 'usage-key-marker');
        state = { ...state, prefs: { ...state.prefs, iconSource: 'service', showClosedTabs: true, motion: 'off' } };
        const { recoveryKey } = await firstDevice(user, state);
        const b = await join(user, recoveryKey);
        expect(b.state.recents).toEqual([]);
        expect(b.state.usage).toEqual({});
        expect(b.state.prefs).toMatchObject({ iconSource: emptyState().prefs.iconSource, showClosedTabs: false, motion: emptyState().prefs.motion });
        expect(JSON.stringify(b.meta!.base).includes('recently-visited')).toBe(false);
    });
});

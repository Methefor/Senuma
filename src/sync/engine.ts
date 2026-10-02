/**
 * The sync engine. Loaded only when sync is in use.
 *
 * It owns no storage and no network of its own: everything about the device comes through
 * `Local`, sign-in through `Auth`, the vault through `Transport`. That is what lets the same
 * engine run in the page and, in tests, as several simulated devices against the emulator.
 *
 * What it guarantees:
 *   - the local setup is the source of truth and is never replaced without a restore point;
 *   - a copy on either side that is newer than the last common one is never overwritten:
 *     it is merged, or the person is asked;
 *   - nothing is decided by comparing clocks;
 *   - only ciphertext, and the few fields the rules allow, ever leave the device.
 */
import { mergeBackup } from '../core/backupImport';
import { emptyState } from '../core/defaults';
import { SCHEMA_VERSION, type AppState } from '../core/types';
import {
    FORMAT, SyncSizeError, budget, createVaultKey, formatRecoveryKey, newDeviceId, newKeyId, newRecoverySecret, open, openVaultKey, parseRecoveryKey, seal,
    type WrappedKey,
} from './crypto';
import { canonical, keepSide, mergeDocs, type Conflict, type Resolutions } from './merge';
import type { Auth } from './mockAuth';
import { inspect, plan, type DevicePlain, type WorkspacePlain } from './revision';
import { applySyncable, type SyncDoc } from './scope';
import { SyncError, type ErrorCode, type Session, type StoredEnvelope, type Transport } from './transport';
import { applyWithAssets, projectWithAssets, type DeviceLocal } from './wallpaper';

/** What this device remembers about sync. Kept on the device; never uploaded. */
export interface SyncMeta {
    v: 1;
    uid: string;
    email: string;
    deviceId: string;
    deviceLabel: string;
    deviceCreatedAt: number;
    keyId: string;
    /** The wrapped key record, as stored in the vault (base64), so the key can be reopened offline. */
    salt: string;
    wrapped: string;
    /** The recovery key, kept so it can be shown again on this device after a confirmation. */
    recovery: string;
    /** Revision of the last copy this device sent or applied; 0 before the first sync. */
    baseRevision: number;
    /** That copy. */
    base: SyncDoc | null;
    paused: boolean;
    /** This device's clock at its last successful sync. For display only. */
    lastSyncAt: number;
}

/** Everything the engine needs from the device it runs on. */
export interface Local {
    state(): AppState;
    /** Replaces the setup, saving a restore point of the current one first. Rejects, changing nothing, if that cannot be saved. */
    apply(next: AppState): Promise<void>;
    meta(): Promise<SyncMeta | null>;
    saveMeta(meta: SyncMeta | null): Promise<void>;
    device(): Promise<DeviceLocal>;
    saveDevice(device: DeviceLocal): Promise<void>;
    online(): boolean;
    now(): number;
    /** A default name for this device, for the person's own list. */
    label(): string;
    wait(ms: number): Promise<void>;
}

export type Phase =
    | 'signed-out' | 'connecting'
    /** Signed in, no vault yet: a recovery key is waiting to be saved by the person. */
    | 'new-vault'
    /** Signed in, a vault exists: this device needs the recovery key. */
    | 'needs-key'
    /** A cloud copy exists and this device has its own setup: the person chooses how to combine them. */
    | 'first-sync'
    | 'syncing' | 'synced' | 'paused' | 'offline' | 'conflict' | 'error';

export interface Status {
    phase: Phase;
    account?: string;
    error?: ErrorCode;
    conflicts?: Conflict[];
    /** Whether every conflict can be settled by keeping both versions. */
    canKeepBoth?: boolean;
    lastSyncAt?: number;
    /** Shown once, while the vault is being created. */
    recoveryKey?: string;
    /** What each side holds, for the first-sync choice. */
    firstSync?: { cloud: { spaces: number; links: number }; device: { spaces: number; links: number } };
    /** The encrypted workspace is at three quarters of the size limit or more. */
    nearLimit?: boolean;
}

export interface DeviceInfo {
    id: string;
    label: string;
    thisDevice: boolean;
    createdAt: number;
    /** That device's own clock at its last sync. */
    lastSyncAt: number;
    /** False when the entry could not be read with this device's key. */
    readable: boolean;
}

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), char => char.charCodeAt(0));
const counts = (doc: { spaces: object; items: object }) => ({ spaces: Object.keys(doc.spaces).length, links: Object.keys(doc.items).length });
const ATTEMPTS = 4;

/**
 * "Keep both": beside each listed link, as this device has it, the cloud's version is added as a
 * second link. The copy's id is derived from the original's, so doing this twice adds nothing.
 */
export function withCloudCopies(doc: SyncDoc, cloud: SyncDoc, itemIds: string[]): SyncDoc {
    if (!itemIds.length) return doc;
    const next = JSON.parse(JSON.stringify(doc)) as SyncDoc;
    for (const id of itemIds) {
        const [mine, theirs, copyId] = [next.items[id], cloud.items[id], `${id}-cloud`.slice(0, 64)];
        if (!mine || !theirs || next.items[copyId] || canonical({ ...mine, id: '' }) === canonical({ ...theirs, id: '' })) continue;
        const group = Object.values(next.spaces).flatMap(space => space.groups).find(candidate => candidate.itemIds.includes(id));
        if (!group) continue;
        next.items[copyId] = { ...theirs, id: copyId };
        group.itemIds.splice(group.itemIds.indexOf(id) + 1, 0, copyId);
    }
    return next;
}
/** The rules refuse a write within two seconds of the last one. */
const WRITE_SPACING_MS = 2200;

export function createEngine(deps: { local: Local; auth: Auth; transport: (session: Session) => Transport }) {
    const { local, auth } = deps;
    let status: Status = { phase: 'signed-out' };
    const listeners = new Set<(status: Status) => void>();
    let session: Session | null = null;
    let transport: Transport | null = null;
    let key: CryptoKey | null = null;
    let running: Promise<Status> | null = null;
    /** A vault being created: nothing is uploaded until the person confirms they saved the key. */
    let pending: { secret: Uint8Array<ArrayBuffer>; keyId: string } | null = null;
    /** Choices the person made for the conflicts currently open. */
    let resolutions: Resolutions = {};
    let firstSyncChoice: 'merge' | 'cloud' | 'device' | null = null;
    /** Links whose cloud version is to be kept as a second link beside this device's ("keep both"). */
    let alsoKeepCloud: string[] = [];

    const set = (next: Status): Status => {
        status = next;
        for (const listener of listeners) listener(status);
        return status;
    };

    async function connect(): Promise<Transport> {
        session ??= await auth.current();
        if (!session) throw new SyncError('auth-expired');
        transport ??= deps.transport(session);
        return transport;
    }

    async function workspaceKey(meta: SyncMeta): Promise<CryptoKey> {
        if (key) return key;
        const secret = await parseRecoveryKey(meta.recovery);
        const opened = secret && await openVaultKey({ v: 1, salt: unb64(meta.salt), wrapped: unb64(meta.wrapped) }, secret, meta.uid, meta.keyId);
        if (!opened) throw new SyncError('key-changed');
        return (key = opened);
    }

    const place = (meta: SyncMeta, revision: number) => ({ uid: meta.uid, path: 'workspace/current', keyId: meta.keyId, revision });

    /** Decrypts and checks the cloud copy. Throws rather than return anything that is not a workspace of this schema. */
    async function read(meta: SyncMeta, head: StoredEnvelope): Promise<SyncDoc> {
        const checked = inspect(await open(await workspaceKey(meta), head, place(meta, head.revision)));
        if (!checked.ok) throw new SyncError(checked.problem === 'schema-newer' ? 'schema-newer' : 'unreadable', checked.problem);
        return checked.plain.doc;
    }

    /** Encrypts and writes `doc` as `revision`. False when the server's copy changed meanwhile. */
    async function write(meta: SyncMeta, doc: SyncDoc, revision: number, previous: StoredEnvelope | null): Promise<boolean> {
        const plain: WorkspacePlain = { schema: SCHEMA_VERSION, deviceId: meta.deviceId, savedAt: local.now(), doc };
        let sealed;
        try {
            sealed = await seal(await workspaceKey(meta), plain, place(meta, revision));
        } catch (error) {
            if (error instanceof SyncSizeError) throw new SyncError('too-large', String(error.bytes));
            throw error;
        }
        nearLimit = budget(sealed.payload.length) === 'near';
        const io = await connect();
        let history = true;
        for (let attempt = 0; attempt < 3; attempt++) {
            const result = await io.writeCurrent({ format: FORMAT, keyId: meta.keyId, revision, ...sealed }, previous, history);
            if (result === 'ok') return true;
            if (result === 'denied') {
                // Most likely written too soon after the last revision; the rules ask for a pause.
                await local.wait(WRITE_SPACING_MS);
                continue;
            }
            const now = await io.readCurrent();
            if (now?.updateTime !== previous?.updateTime) return false;
            // Nothing changed, so the refusal was the history entry already being there.
            history = false;
        }
        throw new SyncError('denied');
    }
    let nearLimit = false;

    async function saveDeviceEntry(meta: SyncMeta): Promise<void> {
        const plain: DevicePlain = { label: meta.deviceLabel, createdAt: meta.deviceCreatedAt, lastSyncAt: local.now(), lastRevision: meta.baseRevision };
        const sealed = await seal(await workspaceKey(meta), plain, { uid: meta.uid, path: `devices/${meta.deviceId}`, keyId: meta.keyId, revision: 0 });
        await (await connect()).putDevice({ id: meta.deviceId, keyId: meta.keyId, ...sealed });
    }

    async function settled(meta: SyncMeta, doc: SyncDoc, revision: number, changed: boolean): Promise<Status> {
        const next: SyncMeta = { ...meta, base: doc, baseRevision: revision, lastSyncAt: local.now() };
        await local.saveMeta(next);
        resolutions = {};
        alsoKeepCloud = [];
        firstSyncChoice = null;
        // The device entry is for the person's device list; failing to refresh it is not a sync failure.
        if (changed) await saveDeviceEntry(next).catch(() => undefined);
        return set({ phase: 'synced', account: meta.email, lastSyncAt: next.lastSyncAt, nearLimit });
    }

    /** Puts a synced copy into the setup (restore point first) and returns what this device now reports. */
    async function applyRemote(doc: SyncDoc): Promise<void> {
        const applied = applyWithAssets(local.state(), doc, await local.device());
        if (!applied) throw new SyncError('unreadable', 'schema');
        if (canonical(projectWithAssets(local.state(), await local.device())) !== canonical(doc)) await local.apply(applied.state);
        await local.saveDevice(applied.device);
    }

    async function cycle(): Promise<Status> {
        const meta = await local.meta();
        if (!meta) return set({ phase: status.phase === 'new-vault' || status.phase === 'needs-key' ? status.phase : 'signed-out', ...(status.recoveryKey ? { recoveryKey: status.recoveryKey } : {}), ...(status.account ? { account: status.account } : {}) });
        if (meta.paused) return set({ phase: 'paused', account: meta.email, lastSyncAt: meta.lastSyncAt });
        if (!local.online()) return set({ phase: 'offline', account: meta.email, lastSyncAt: meta.lastSyncAt });
        set({ phase: 'syncing', account: meta.email, lastSyncAt: meta.lastSyncAt });
        const io = await connect();

        for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
            const [head, entry] = await Promise.all([io.readCurrent(), io.readDevice(meta.deviceId)]);
            const projection = projectWithAssets(local.state(), await local.device());
            const dirty = !meta.base || canonical(projection) !== canonical(meta.base);
            const step = plan({ baseRevision: meta.baseRevision, keyId: meta.keyId, dirty }, head);

            if (step.kind === 'blocked') throw new SyncError(step.reason);
            // Its entry is gone while the vault lives on: this device was removed elsewhere.
            if (!entry && head && meta.baseRevision > 0) throw new SyncError('removed');
            if (step.kind === 'idle') return settled(meta, meta.base!, meta.baseRevision, !entry);

            if (step.kind === 'push') {
                if (await write(meta, projection, step.revision, head)) return settled(meta, projection, step.revision, true);
                continue;
            }

            const remote = await read(meta, head!);

            if (step.kind === 'pull') {
                await applyRemote(remote);
                return settled(meta, remote, head!.revision, true);
            }

            if (step.kind === 'first-sync') {
                const empty = local.state().spaceOrder.length === 0;
                const choice = empty ? 'cloud' : firstSyncChoice;
                if (!choice) return set({ phase: 'first-sync', account: meta.email, firstSync: { cloud: counts(remote), device: counts(projection) } });
                if (choice === 'cloud') {
                    await applyRemote(remote);
                    return settled(meta, remote, head!.revision, true);
                }
                if (choice === 'merge') {
                    // No common past, so the same link has different ids on each side: join by address, nothing dropped.
                    const cloud = applySyncable(emptyState(), remote);
                    if (!cloud) throw new SyncError('unreadable', 'schema');
                    await local.apply(mergeBackup(local.state(), cloud).state);
                }
                const mine = projectWithAssets(local.state(), await local.device());
                if (await write(meta, mine, head!.revision + 1, head)) return settled(meta, mine, head!.revision + 1, true);
                continue;
            }

            // Both sides changed since the last common copy.
            const merged = mergeDocs(meta.base!, projection, remote, resolutions);
            if (merged.conflicts.length) {
                return set({ phase: 'conflict', account: meta.email, lastSyncAt: meta.lastSyncAt, conflicts: merged.conflicts, canKeepBoth: merged.conflicts.every(conflict => conflict.kind === 'item') });
            }
            await applyRemote(withCloudCopies(merged.doc, remote, alsoKeepCloud));
            const mine = projectWithAssets(local.state(), await local.device());
            if (await write(meta, mine, head!.revision + 1, head)) return settled(meta, mine, head!.revision + 1, true);
            // Someone wrote in between. What was applied here is this device's local copy now; merge again from the top.
        }
        throw new SyncError('failed', 'the cloud copy kept changing');
    }

    async function failed(error: unknown): Promise<Status> {
        const code: ErrorCode = error instanceof SyncError ? error.code : 'failed';
        const meta = await local.meta().catch(() => null);
        const account = meta?.email ?? status.account;
        if (code === 'offline') return set({ phase: 'offline', ...(account ? { account } : {}), ...(meta ? { lastSyncAt: meta.lastSyncAt } : {}) });
        if (code === 'key-changed') {
            key = null;
            return set({ phase: 'needs-key', ...(account ? { account } : {}) });
        }
        if (code === 'removed') {
            // Removed on another device: stop syncing here and forget the key. The setup on this device stays as it is.
            await forget();
            return set({ phase: 'signed-out', error: 'removed' });
        }
        return set({ phase: 'error', error: code, ...(account ? { account } : {}), ...(meta ? { lastSyncAt: meta.lastSyncAt } : {}) });
    }

    /** Drops everything about sync on this device. Never touches the setup. */
    async function forget(): Promise<void> {
        await local.saveMeta(null);
        await auth.signOut().catch(() => undefined);
        session = null;
        transport = null;
        key = null;
        pending = null;
        resolutions = {};
        firstSyncChoice = null;
    }

    function run(work: () => Promise<Status>): Promise<Status> {
        running ??= work().catch(failed).finally(() => {
            running = null;
        });
        return running;
    }

    async function register(secret: Uint8Array<ArrayBuffer>, keyId: string, record: WrappedKey): Promise<SyncMeta> {
        const meta: SyncMeta = {
            v: 1, uid: session!.uid, email: session!.email, deviceId: newDeviceId(), deviceLabel: local.label(), deviceCreatedAt: local.now(),
            keyId, salt: b64(record.salt), wrapped: b64(record.wrapped), recovery: await formatRecoveryKey(secret),
            baseRevision: 0, base: null, paused: false, lastSyncAt: 0,
        };
        key = null;
        await local.saveMeta(meta);
        await saveDeviceEntry(meta);
        return meta;
    }

    return {
        status: () => status,
        subscribe(listener: (status: Status) => void): () => void {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },

        /** Call once when the engine is loaded: picks up where this device left off. */
        start: () => run(cycle),
        /** One sync now. Calls made while one is running get the same result. */
        sync: () => run(cycle),

        /** Signs in and finds out whether a vault exists. Uploads nothing. */
        signIn: () => run(async () => {
            set({ phase: 'connecting' });
            try {
                session = await auth.signIn();
            } catch (error) {
                if (error instanceof SyncError && error.code === 'denied') return set({ phase: 'signed-out' });
                throw error;
            }
            transport = deps.transport(session);
            const keys = await transport.listKeys();
            if (Object.keys(keys).length) return set({ phase: 'needs-key', account: session.email });
            pending = { secret: newRecoverySecret(), keyId: newKeyId() };
            return set({ phase: 'new-vault', account: session.email, recoveryKey: await formatRecoveryKey(pending.secret) });
        }),

        /** The person has saved the recovery key: create the vault and send the first copy. */
        confirmNewVault: () => run(async () => {
            if (!pending || !session) throw new SyncError('failed', 'no vault is being created');
            const io = await connect();
            const { record } = await createVaultKey(pending.secret, session.uid, pending.keyId);
            await io.createKey(pending.keyId, record);
            await register(pending.secret, pending.keyId, record);
            pending = null;
            return cycle();
        }),

        /** A device joining an existing vault. Resolves to false, changing nothing, when the key is not this vault's. */
        async unlock(text: string): Promise<boolean> {
            const secret = await parseRecoveryKey(text);
            if (!secret) return false;
            try {
                const io = await connect();
                const keys = await io.listKeys();
                const head = await io.readCurrent();
                // The key the current copy was written with, when there is one; otherwise any key the secret opens.
                const candidates = head && keys[head.keyId] ? [head.keyId] : Object.keys(keys);
                for (const keyId of candidates) {
                    if (!(await openVaultKey(keys[keyId]!, secret, session!.uid, keyId))) continue;
                    const existing = await local.meta();
                    if (existing) {
                        // This device was already syncing; only its key changed (rotation on another device).
                        key = null;
                        await local.saveMeta({ ...existing, keyId, salt: b64(keys[keyId]!.salt), wrapped: b64(keys[keyId]!.wrapped), recovery: await formatRecoveryKey(secret), base: existing.base });
                        await saveDeviceEntry((await local.meta())!).catch(() => undefined);
                    } else await register(secret, keyId, keys[keyId]!);
                    await run(cycle);
                    return true;
                }
                return false;
            } catch (error) {
                await failed(error);
                return false;
            }
        },

        /** The person's answer to the first-sync question. */
        resolveFirstSync(choice: 'merge' | 'cloud' | 'device'): Promise<Status> {
            firstSyncChoice = choice;
            return run(cycle);
        },

        /** The person's answer to open conflicts: one side for all, both, or a choice per conflict. */
        resolveConflicts(choice: 'local' | 'remote' | 'both' | Resolutions): Promise<Status> {
            const open = status.conflicts ?? [];
            if (choice === 'both') {
                // An edit against a deletion: the edited one is kept. Two different edits: this device's stays and the cloud's is added beside it.
                resolutions = { ...resolutions, ...Object.fromEntries(open.map(conflict => [conflict.key, conflict.local === null ? 'remote' as const : 'local' as const])) };
                alsoKeepCloud = [...new Set([...alsoKeepCloud, ...open.filter(conflict => conflict.kind === 'item' && conflict.field !== 'exists' && conflict.field !== 'group').map(conflict => conflict.id)])];
            } else resolutions = { ...resolutions, ...(typeof choice === 'string' ? keepSide(open, choice) : choice) };
            return run(cycle);
        },

        pause: () => run(async () => {
            const meta = await local.meta();
            if (meta) await local.saveMeta({ ...meta, paused: true });
            return cycle();
        }),
        resume: () => run(async () => {
            const meta = await local.meta();
            if (meta) await local.saveMeta({ ...meta, paused: false });
            return cycle();
        }),

        /** After the sign-in expired: sign in again as the same account and carry on. */
        reauthenticate: () => run(async () => {
            const meta = await local.meta();
            const next = await auth.signIn();
            if (meta && next.uid !== meta.uid) {
                await auth.signOut();
                throw new SyncError('denied', 'a different account');
            }
            session = next;
            transport = deps.transport(next);
            return cycle();
        }),

        /** Stops syncing on this device. The setup on this device is not touched; the cloud copy stays. */
        signOut: () => run(async () => {
            const meta = await local.meta();
            if (meta && local.online()) await connect().then(io => io.deleteDevice(meta.deviceId)).catch(() => undefined);
            await forget();
            return set({ phase: 'signed-out' });
        }),

        /** Removes the encrypted copy, the device list and the keys from the service. The setup on this device stays. */
        deleteCloudData: () => run(async () => {
            await (await connect()).deleteVault();
            await forget();
            return set({ phase: 'signed-out' });
        }),

        /**
         * After the cloud copy was deleted elsewhere: start the vault again from this device's setup,
         * with the key this device already holds.
         */
        uploadAgain: () => run(async () => {
            const meta = await local.meta();
            if (!meta) return cycle();
            const io = await connect();
            if (await io.readCurrent()) return cycle(); // it is there after all
            const keys = await io.listKeys();
            if (!keys[meta.keyId]) await io.createKey(meta.keyId, { v: 1, salt: unb64(meta.salt), wrapped: unb64(meta.wrapped) });
            const fresh: SyncMeta = { ...meta, baseRevision: 0, base: null };
            await local.saveMeta(fresh);
            await saveDeviceEntry(fresh);
            return cycle();
        }),

        /** The recovery key kept on this device. The caller asks for confirmation before showing it. */
        recoveryKey: async (): Promise<string | null> => (await local.meta())?.recovery ?? null,

        async devices(): Promise<DeviceInfo[]> {
            const meta = await local.meta();
            if (!meta) return [];
            const vaultKey = await workspaceKey(meta);
            const stored = await (await connect()).listDevices();
            return Promise.all(stored.map(async device => {
                const plain = await open(vaultKey, device, { uid: meta.uid, path: `devices/${device.id}`, keyId: device.keyId, revision: 0 }) as Partial<DevicePlain> | null;
                return {
                    id: device.id, thisDevice: device.id === meta.deviceId, readable: !!plain,
                    label: typeof plain?.label === 'string' ? plain.label : '', createdAt: Number(plain?.createdAt) || 0, lastSyncAt: Number(plain?.lastSyncAt) || 0,
                };
            }));
        },

        async renameDevice(label: string): Promise<void> {
            const meta = await local.meta();
            if (!meta || !label.trim()) return;
            const next = { ...meta, deviceLabel: label.trim().slice(0, 60) };
            await local.saveMeta(next);
            await saveDeviceEntry(next);
        },

        /**
         * Takes a device off the list. That device stops syncing the next time it tries. This does
         * not take back what it already has, and it is not a revocation of its sign-in.
         */
        async removeDevice(id: string): Promise<void> {
            await (await connect()).deleteDevice(id);
        },

        /**
         * A new workspace key and recovery key. The current copy is re-encrypted; history made with
         * the old key is removed. Other devices will need the new recovery key. Returns it.
         */
        async newRecoveryKey(): Promise<string | null> {
            const meta = await local.meta();
            if (!meta) return null;
            const io = await connect();
            const head = await io.readCurrent();
            if (!head || head.revision !== meta.baseRevision) {
                await run(cycle);
                return null; // sync first, so that nothing unseen is re-encrypted blind
            }
            const secret = newRecoverySecret();
            const keyId = newKeyId();
            const { record } = await createVaultKey(secret, meta.uid, keyId);
            await io.createKey(keyId, record);
            const previous = { keyId: meta.keyId };
            key = null;
            const next: SyncMeta = { ...meta, keyId, salt: b64(record.salt), wrapped: b64(record.wrapped), recovery: await formatRecoveryKey(secret) };
            await local.saveMeta(next);
            const doc = projectWithAssets(local.state(), await local.device());
            if (!(await write(next, doc, head.revision + 1, head))) throw new SyncError('failed', 'the cloud copy changed during the key change');
            await settled(next, doc, head.revision + 1, true);
            for (const revision of await io.listHistory()) await io.deleteHistory(revision).catch(() => undefined);
            await io.deleteKey(previous.keyId).catch(() => undefined);
            return next.recovery;
        },
    };
}

export type Engine = ReturnType<typeof createEngine>;

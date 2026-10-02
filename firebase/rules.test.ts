/**
 * Firestore Security Rules, tested against the local emulator only.
 *
 *   npm run test:rules        (starts the emulator, runs this file, stops the emulator)
 *
 * No real project exists or is contacted: the project id is a `demo-` one, which the Firebase
 * tools treat as having no real resources, and the test refuses to start unless the emulator
 * address is a local one.
 */
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
    Bytes, Timestamp, collection, deleteDoc, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, writeBatch,
    type DocumentData, type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LARGEST_PAYLOAD, SMALLEST_PAYLOAD, WRITE_CASES, type Attempt, type Before } from '../src/sync/writeMatrix';

const PROJECT = 'demo-senuma';
const ALICE = 'alice_uid';
const BOB = 'bob_uid';
const KEY = 'k1aaaaaa';
const DEVICE = 'abcdefghijklmnopqrstuvwxyz';

let env: RulesTestEnvironment;

const google = { firebase: { sign_in_provider: 'google.com' } };
const as = (uid: string, token: Record<string, unknown> = google): Firestore => env.authenticatedContext(uid, token).firestore() as unknown as Firestore;
const anonymous = (): Firestore => env.unauthenticatedContext().firestore() as unknown as Firestore;

const bytes = (length: number) => Bytes.fromUint8Array(new Uint8Array(length).fill(7));
const current = (db: Firestore, uid = ALICE) => doc(db, `vaults/${uid}/workspace/current`);

/** A valid workspace document at `revision`, stamped by the server. */
const envelope = (revision: number, patch: DocumentData = {}): DocumentData =>
    ({ format: 1, keyId: KEY, revision, updatedAt: serverTimestamp(), nonce: bytes(12), payload: bytes(SMALLEST_PAYLOAD), ...patch });
const wrappedKey = (patch: DocumentData = {}): DocumentData => ({ v: 1, salt: bytes(16), wrapped: bytes(60), ...patch });
const device = (patch: DocumentData = {}): DocumentData => ({ keyId: KEY, nonce: bytes(12), payload: bytes(SMALLEST_PAYLOAD), ...patch });

/** Like assertFails, but says which of several attempts was let through. */
const refused = (what: string, attempt: Promise<unknown>) => assertFails(attempt).catch(() => {
    throw new Error(`accepted, but must be refused: ${what}`);
});

/** Puts documents in place without the rules, as "what is already on the server". */
async function seed(documents: Record<string, DocumentData>): Promise<void> {
    await env.withSecurityRulesDisabled(async context => {
        const db = context.firestore() as unknown as Firestore;
        for (const [path, data] of Object.entries(documents)) await setDoc(doc(db, path), data);
    });
}
const seededEnvelope = (revision: number, ageMs = 60_000, patch: DocumentData = {}): DocumentData =>
    ({ ...envelope(revision), updatedAt: Timestamp.fromMillis(Date.now() - ageMs), ...patch });
const seedCurrent = (before: Before | null, uid = ALICE) => (before ? seed({ [`vaults/${uid}/workspace/current`]: seededEnvelope(before.revision, before.ageMs) }) : Promise.resolve());

/** Builds the document an entry of the shared matrix describes. */
function build(attempt: Attempt): DocumentData {
    const data: DocumentData = {
        format: 'format' in attempt ? attempt.format : 1,
        keyId: 'keyId' in attempt ? attempt.keyId : KEY,
        revision: attempt.revision,
        updatedAt: attempt.time === 'client' ? Timestamp.fromMillis(Date.now() + 5000) : attempt.time === 'text' ? 'now' : serverTimestamp(),
        nonce: attempt.nonce === 'text' ? 'AAAAAAAAAAAA' : bytes(attempt.nonce ?? 12),
        payload: attempt.payload === 'text' ? 'not ciphertext' : bytes(attempt.payload ?? SMALLEST_PAYLOAD),
        ...attempt.extra,
    };
    if (attempt.omit) delete data[attempt.omit];
    return data;
}

beforeAll(async () => {
    const address = process.env.FIRESTORE_EMULATOR_HOST ?? '';
    if (!/^(127\.0\.0\.1|localhost|\[::1\]):\d+$/.test(address)) throw new Error(`These tests run only against a local emulator (FIRESTORE_EMULATOR_HOST is “${address}”). Use: npm run test:rules`);
    const [host, port] = [address.slice(0, address.lastIndexOf(':')), Number(address.slice(address.lastIndexOf(':') + 1))];
    env = await initializeTestEnvironment({ projectId: PROJECT, firestore: { host, port, rules: readFileSync('firebase/firestore.rules', 'utf8') } });
});
afterAll(async () => {
    await env?.cleanup();
});
beforeEach(async () => {
    await env.clearFirestore();
});

describe('authorization', () => {
    beforeEach(() => seed({
        [`vaults/${ALICE}/workspace/current`]: seededEnvelope(5),
        [`vaults/${ALICE}/history/4`]: seededEnvelope(4),
        [`vaults/${ALICE}/keys/${KEY}`]: wrappedKey(),
        [`vaults/${ALICE}/devices/${DEVICE}`]: device(),
    }));
    const paths = ['workspace/current', 'history/4', `keys/${KEY}`, `devices/${DEVICE}`];

    it('the owner reads every document of their vault', async () => {
        for (const path of paths) await assertSucceeds(getDoc(doc(as(ALICE), `vaults/${ALICE}/${path}`)));
    });

    it('the owner writes the workspace, a key and a device entry', async () => {
        await assertSucceeds(setDoc(current(as(ALICE)), envelope(6)));
        await assertSucceeds(setDoc(doc(as(ALICE), `vaults/${ALICE}/keys/k2bbbbbb`), wrappedKey()));
        await assertSucceeds(setDoc(doc(as(ALICE), `vaults/${ALICE}/devices/${DEVICE}`), device({ payload: bytes(2064) })));
    });

    it('a stranger reads nothing', async () => {
        for (const path of paths) await assertFails(getDoc(doc(as(BOB), `vaults/${ALICE}/${path}`)));
        for (const name of ['history', 'keys', 'devices']) await assertFails(getDocs(query(collection(as(BOB), `vaults/${ALICE}/${name}`), limit(5))));
    });

    it('a stranger writes nothing', async () => {
        await assertFails(setDoc(current(as(BOB)), envelope(6)));
        await assertFails(setDoc(doc(as(BOB), `vaults/${ALICE}/keys/k2bbbbbb`), wrappedKey()));
        await assertFails(setDoc(doc(as(BOB), `vaults/${ALICE}/devices/${DEVICE}`), device()));
        await assertFails(setDoc(doc(as(BOB), `vaults/${ALICE}/history/5`), seededEnvelope(5)));
    });

    it('nobody signed out reads anything', async () => {
        for (const path of paths) await assertFails(getDoc(doc(anonymous(), `vaults/${ALICE}/${path}`)));
    });

    it('nobody signed out writes anything', async () => {
        await assertFails(setDoc(current(anonymous()), envelope(6)));
        await assertFails(setDoc(doc(anonymous(), `vaults/${ALICE}/keys/k2bbbbbb`), wrappedKey()));
        await assertFails(deleteDoc(current(anonymous())));
    });

    it('the right account signed in some other way than Google is refused', async () => {
        for (const provider of ['password', 'anonymous', 'custom']) {
            const db = as(ALICE, { firebase: { sign_in_provider: provider } });
            await assertFails(getDoc(current(db)));
            await assertFails(setDoc(current(db), envelope(6)));
        }
    });

    it('nothing outside the declared paths exists for anyone, the owner included', async () => {
        const db = as(ALICE);
        await assertFails(setDoc(doc(db, `vaults/${ALICE}`), { note: 'x' }));
        await assertFails(getDoc(doc(db, `vaults/${ALICE}`)));
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/workspace/other`), envelope(1)));
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/notes/a`), { text: 'x' }));
        await assertFails(setDoc(doc(db, 'users/alice_uid'), { ntf_data: 'x' }));
        await assertFails(getDocs(query(collection(db, 'vaults'), limit(5))));
        await assertFails(getDocs(query(collection(db, `vaults/${ALICE}/workspace`), limit(5))));
    });
});

describe('the workspace document: shape, revision and rate (shared matrix)', () => {
    for (const entry of WRITE_CASES) {
        it(`${entry.group}: ${entry.name} is ${entry.allowed ? 'accepted' : 'refused'}`, async () => {
            await seedCurrent(entry.before);
            const write = setDoc(current(as(ALICE)), build(entry.attempt));
            await (entry.allowed ? assertSucceeds(write) : assertFails(write));
        });
    }

    it('an accepted write is stored with the server’s time, and nothing else beside the six fields', async () => {
        await assertSucceeds(setDoc(current(as(ALICE)), envelope(1)));
        const stored = (await getDoc(current(as(ALICE)))).data()!;
        expect(Object.keys(stored).sort()).toEqual(['format', 'keyId', 'nonce', 'payload', 'revision', 'updatedAt']);
        expect(Math.abs((stored.updatedAt as Timestamp).toMillis() - Date.now())).toBeLessThan(60_000);
        expect((stored.payload as Bytes).toUint8Array()).toHaveLength(SMALLEST_PAYLOAD);
    });

    it('the key id may change from one revision to the next (key rotation)', async () => {
        await seedCurrent({ revision: 5, ageMs: 60_000 });
        await assertSucceeds(setDoc(current(as(ALICE)), envelope(6, { keyId: 'k2bbbbbb' })));
    });

    it('the largest payload is accepted and stored whole', async () => {
        await assertSucceeds(setDoc(current(as(ALICE)), envelope(1, { payload: bytes(LARGEST_PAYLOAD) })));
        expect(((await getDoc(current(as(ALICE)))).data()!.payload as Bytes).toUint8Array()).toHaveLength(LARGEST_PAYLOAD);
    });
});

describe('revision across deletion', () => {
    it('after the document is deleted, it can be created again only at revision 1', async () => {
        await seedCurrent({ revision: 9, ageMs: 60_000 });
        await assertSucceeds(deleteDoc(current(as(ALICE))));
        await assertFails(setDoc(current(as(ALICE)), envelope(10))); // not a continuation
        await assertFails(setDoc(current(as(ALICE)), envelope(9)));
        await assertSucceeds(setDoc(current(as(ALICE)), envelope(1)));
    });

    it('a second device writing its own "first" document over an existing one is refused', async () => {
        await seedCurrent({ revision: 3, ageMs: 60_000 });
        await assertFails(setDoc(current(as(ALICE)), envelope(1)));
    });
});

describe('identity and ownership', () => {
    it('a document cannot be written under another account’s path, whoever signs in', async () => {
        await assertFails(setDoc(current(as(BOB), ALICE), envelope(1)));
        await assertFails(setDoc(current(as(ALICE), BOB), envelope(1)));
    });

    it('ciphertext read from one vault cannot be copied into another account’s vault', async () => {
        await seed({ [`vaults/${ALICE}/workspace/current`]: seededEnvelope(5), [`vaults/${BOB}/workspace/current`]: seededEnvelope(5) });
        const stolen = (await getDoc(current(as(ALICE)))).data()!;
        // Alice cannot place her document in Bob's vault, as his first document or as his next revision.
        await assertFails(setDoc(current(as(ALICE), BOB), { ...stolen, revision: 6, updatedAt: serverTimestamp() }));
        await assertFails(setDoc(doc(as(ALICE), `vaults/${BOB}/history/5`), stolen));
        // Bob cannot read it to copy it in the first place.
        await assertFails(getDoc(current(as(BOB), ALICE)));
    });

    it('the account in the path is the only thing that grants access: a matching name elsewhere does not', async () => {
        await assertFails(setDoc(doc(as(BOB), `vaults/${BOB}/workspace/current`), envelope(1, { owner: ALICE })));
        await assertFails(setDoc(current(as(BOB), ALICE), envelope(1, { keyId: KEY })));
    });
});

describe('history', () => {
    beforeEach(() => seedCurrent({ revision: 5, ageMs: 60_000 }));

    it('the current document can be copied, verbatim, under its own revision number', async () => {
        const db = as(ALICE);
        const now = (await getDoc(current(db))).data()!;
        await assertSucceeds(setDoc(doc(db, `vaults/${ALICE}/history/5`), now));
    });

    it('a copy and the next revision go in together as one write', async () => {
        const db = as(ALICE);
        const now = (await getDoc(current(db))).data()!;
        const batch = writeBatch(db);
        batch.set(doc(db, `vaults/${ALICE}/history/5`), now);
        batch.set(current(db), envelope(6));
        await assertSucceeds(batch.commit());
        expect((await getDoc(doc(db, `vaults/${ALICE}/history/5`))).data()!.revision).toBe(5);
        expect((await getDoc(current(db))).data()!.revision).toBe(6);
    });

    it('history cannot be invented, altered, misnumbered or rewritten', async () => {
        const db = as(ALICE);
        const now = (await getDoc(current(db))).data()!;
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/history/5`), { ...now, payload: bytes(2064) })); // not what is on the server
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/history/4`), now)); // under another number
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/history/3`), seededEnvelope(3))); // made up
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/history/05`), now));
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/history/latest`), now));
        await assertSucceeds(setDoc(doc(db, `vaults/${ALICE}/history/5`), now));
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/history/5`), now)); // already written: never updated
    });

    it('is listed only in small pages', async () => {
        const db = as(ALICE);
        await assertSucceeds(getDocs(query(collection(db, `vaults/${ALICE}/history`), limit(20))));
        await assertFails(getDocs(query(collection(db, `vaults/${ALICE}/history`), limit(21))));
        await assertFails(getDocs(collection(db, `vaults/${ALICE}/history`)));
    });
});

describe('wrapped keys', () => {
    it('a key record is created once, with exactly its three fields, and never changed', async () => {
        const db = as(ALICE);
        const at = doc(db, `vaults/${ALICE}/keys/${KEY}`);
        await assertSucceeds(setDoc(at, wrappedKey()));
        await assertFails(setDoc(at, wrappedKey({ wrapped: bytes(60) }))); // immutable
        for (const [name, bad] of Object.entries({
            'an extra field': wrappedKey({ hint: 'my recovery key is…' }),
            'another version': wrappedKey({ v: 2 }),
            'a short salt': wrappedKey({ salt: bytes(8) }),
            'a wrapped key of the wrong length': wrappedKey({ wrapped: bytes(61) }),
            'text where bytes belong': wrappedKey({ wrapped: 'c2VjcmV0' }),
            'a missing salt': { v: 1, wrapped: bytes(60) },
        })) await refused(name, setDoc(doc(db, `vaults/${ALICE}/keys/k9zzzzzz`), bad));
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/keys/Readable Name`), wrappedKey()));
    });
});

describe('device entries', () => {
    it('hold only a key id and ciphertext; nothing readable can be stored about a device', async () => {
        const db = as(ALICE);
        const at = doc(db, `vaults/${ALICE}/devices/${DEVICE}`);
        await assertSucceeds(setDoc(at, device()));
        await assertSucceeds(setDoc(at, device({ payload: bytes(2064) }))); // updated as the device syncs
        for (const [name, bad] of Object.entries({
            'a readable name': device({ name: 'Mete’s laptop' }),
            'a last-seen time': device({ lastSeenAt: serverTimestamp() }),
            'a user agent': device({ userAgent: 'Chrome' }),
            'an oversized entry': device({ payload: bytes(5 * 1024 + 16) }),
            'a payload that is not ciphertext-shaped': device({ payload: bytes(100) }),
            'no key id': { nonce: bytes(12), payload: bytes(SMALLEST_PAYLOAD) },
        })) await refused(name, setDoc(at, bad));
        await assertFails(setDoc(doc(db, `vaults/${ALICE}/devices/Living room PC`), device()));
    });
});

describe('deletion', () => {
    beforeEach(() => seed({
        [`vaults/${ALICE}/workspace/current`]: seededEnvelope(5),
        [`vaults/${ALICE}/history/4`]: seededEnvelope(4),
        [`vaults/${ALICE}/keys/${KEY}`]: wrappedKey(),
        [`vaults/${ALICE}/devices/${DEVICE}`]: device(),
    }));
    const paths = ['workspace/current', 'history/4', `keys/${KEY}`, `devices/${DEVICE}`];

    it('the owner can delete every document of their vault, and it is then gone', async () => {
        const db = as(ALICE);
        for (const path of paths) {
            await assertSucceeds(deleteDoc(doc(db, `vaults/${ALICE}/${path}`)));
            expect((await getDoc(doc(db, `vaults/${ALICE}/${path}`))).exists()).toBe(false);
        }
    });

    it('nobody else can delete anything', async () => {
        for (const path of paths) {
            await assertFails(deleteDoc(doc(as(BOB), `vaults/${ALICE}/${path}`)));
            await assertFails(deleteDoc(doc(anonymous(), `vaults/${ALICE}/${path}`)));
            await assertFails(deleteDoc(doc(as(ALICE, { firebase: { sign_in_provider: 'password' } }), `vaults/${ALICE}/${path}`)));
        }
    });

    it('deleting one account’s vault leaves another’s untouched', async () => {
        await seed({ [`vaults/${BOB}/workspace/current`]: seededEnvelope(2) });
        await assertSucceeds(deleteDoc(current(as(ALICE))));
        expect((await getDoc(current(as(BOB), BOB))).data()!.revision).toBe(2);
    });
});

/**
 * The encryption, tested as its threat model states it: what someone holding the stored bytes
 * (the storage service, the developer, a leaked database) can and cannot do.
 */
import { describe, expect, it } from 'vitest';
import {
    PAD_STEP, PAYLOAD_LIMIT, SyncSizeError, createVaultKey, formatRecoveryKey, newDeviceId, newKeyId, newRecoverySecret, open, openVaultKey,
    parseRecoveryKey, seal, type SealContext, type Sealed, type WrappedKey,
} from './crypto';
import { workspaceDoc } from './fixtures';

const where: SealContext = { uid: 'user_a', path: 'workspace/current', keyId: 'k1aaaaaa', revision: 3 };
const vault = async (uid = where.uid, keyId = where.keyId) => {
    const secret = newRecoverySecret();
    return { secret, ...(await createVaultKey(secret, uid, keyId)) };
};
const bytes = (hex: string) => new Uint8Array(hex.match(/../g)!.map(pair => parseInt(pair, 16)));
const text = (data: Uint8Array) => Buffer.from(data).toString('latin1');
const flip = (data: Uint8Array<ArrayBuffer>, at: number): Uint8Array<ArrayBuffer> => {
    const copy = data.slice();
    copy[at] = copy[at]! ^ 1;
    return copy;
};

describe('recovery key', () => {
    const fixed = new Uint8Array(Array.from({ length: 20 }, (_, i) => i * 7 + 3));

    it('is 160 random bits, shown as nine groups of four with no ambiguous letters', async () => {
        const secret = newRecoverySecret();
        expect(secret).toHaveLength(20);
        expect(await formatRecoveryKey(secret)).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){8}[0-9A-HJKMNP-TV-Z]{4}$/);
        expect(new Set(await Promise.all(Array.from({ length: 50 }, () => formatRecoveryKey(newRecoverySecret())))).size).toBe(50);
    });

    it('reads back as typed by a person: any case, spaces, O for 0, I or L for 1', async () => {
        const shown = await formatRecoveryKey(fixed);
        expect(shown).toBe('0C51-260Z-4RPK-8ET2-9585-EQK5-DHSQ-N0C8-GC6B');
        for (const typed of [shown, shown.toLowerCase(), shown.replace(/-/g, ' '), shown.replace(/-/g, ''), `  ${shown.replace(/0/g, 'O').replace(/1/g, 'l')}  `]) {
            expect(await parseRecoveryKey(typed)).toEqual(fixed);
        }
    });

    it('rejects every single mistyped character, swapped groups, and anything of the wrong length', async () => {
        const shown = (await formatRecoveryKey(fixed)).replace(/-/g, '');
        for (let at = 0; at < shown.length; at++) {
            for (const other of '0123456789ABCDEFGHJKMNPQRSTVWXYZ') {
                if (other !== shown[at]) expect(await parseRecoveryKey(shown.slice(0, at) + other + shown.slice(at + 1)), `position ${at} → ${other}`).toBeNull();
            }
        }
        const groups = shown.match(/.{4}/g)!;
        expect(await parseRecoveryKey([groups[1], groups[0], ...groups.slice(2)].join('-'))).toBeNull();
        for (const junk of ['', 'hello', shown.slice(0, 35), `${shown}0`, 'U'.repeat(36)]) expect(await parseRecoveryKey(junk)).toBeNull();
    });
});

describe('workspace key', () => {
    it('opens with the recovery key, on any device, to a key that decrypts what the first one encrypted', async () => {
        const { secret, key, record } = await vault();
        const sealed = await seal(key, { a: 1 }, where);
        const typed = await parseRecoveryKey(await formatRecoveryKey(secret));
        const again = await openVaultKey(record, typed!, where.uid, where.keyId);
        expect(await open(again!, sealed, where)).toEqual({ a: 1 });
    });

    it('cannot be exported once made, so page code cannot copy it out', async () => {
        const { key } = await vault();
        expect(key.extractable).toBe(false);
        await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toThrow();
    });

    it('does not open with a wrong recovery key, for another account or key id, or from an altered record', async () => {
        const { secret, record } = await vault();
        expect(await openVaultKey(record, newRecoverySecret(), where.uid, where.keyId)).toBeNull();
        expect(await openVaultKey(record, secret, 'user_b', where.keyId)).toBeNull();
        expect(await openVaultKey(record, secret, where.uid, 'k2bbbbbb')).toBeNull();
        expect(await openVaultKey({ ...record, salt: flip(record.salt, 0) }, secret, where.uid, where.keyId)).toBeNull();
        for (const at of [0, 12, record.wrapped.length - 1]) expect(await openVaultKey({ ...record, wrapped: flip(record.wrapped, at) }, secret, where.uid, where.keyId)).toBeNull();
        expect(await openVaultKey({ ...record, wrapped: record.wrapped.slice(0, 8) }, secret, where.uid, where.keyId)).toBeNull();
        expect(await openVaultKey(record, secret, where.uid, where.keyId)).not.toBeNull();
    });

    it('is different for every vault, and the stored record is different every time', async () => {
        const first = await vault();
        const second = await vault();
        expect(text(first.record.wrapped)).not.toBe(text(second.record.wrapped));
        expect(await open(second.key, await seal(first.key, 'x', where), where)).toBeNull();
    });

    it('still reads a record and a document written by this format before (fixed vector)', async () => {
        const record: WrappedKey = { v: 1, salt: bytes('8ad437f76d654e8721d8a939b6b69fa8'), wrapped: bytes('91a32bf82d6144962c4f7dc94c6adec981e87b962f4607a3bae4ea4dc5d8a5913bdaab961d3436446dde1dd31b7c02fe74a3dae6b313d244b67c96fd') };
        const secret = await parseRecoveryKey('0C51-260Z-4RPK-8ET2-9585-EQK5-DHSQ-N0C8-GC6B');
        const key = await openVaultKey(record, secret!, 'user_fixed', 'k0fixed00');
        expect(key).not.toBeNull();
        const sealed: Sealed = { nonce: bytes('f59b3651c8447d20d0ca26e2'), payload: new Uint8Array(Buffer.from(FIXED_PAYLOAD, 'base64')) };
        expect(await open(key!, sealed, { uid: 'user_fixed', path: 'workspace/current', keyId: 'k0fixed00', revision: 7 })).toEqual({ hello: 'Senuma', list: [1, 2, 3] });
    });
});

describe('what the storage service holds', () => {
    it('contains none of the content: no address, title, Space name or device label', async () => {
        const { key, record } = await vault();
        const doc = workspaceDoc({ links: 40 });
        const sealed = await seal(key, { doc, label: 'Mete’s laptop' }, where);
        const stored = text(sealed.payload) + text(sealed.nonce) + text(record.wrapped) + text(record.salt);
        const secrets = [...Object.values(doc.items).flatMap(item => [item.url, item.title, new URL(item.url).hostname]), ...Object.values(doc.spaces).map(space => space.name), 'laptop', 'https://', '"items"'];
        for (const secret of secrets) expect(stored.includes(secret), secret).toBe(false);
    });

    it('is different every time, even for the same content', async () => {
        const { key } = await vault();
        const [a, b] = await Promise.all([seal(key, { same: true }, where), seal(key, { same: true }, where)]);
        expect(text(a.nonce)).not.toBe(text(b.nonce));
        expect(text(a.payload)).not.toBe(text(b.payload));
        expect(new Set(await Promise.all(Array.from({ length: 200 }, async () => text((await seal(key, 1, where)).nonce)))).size).toBe(200);
    });

    it('has a size that moves only in 1 kB steps', async () => {
        const { key } = await vault();
        for (const links of [0, 1, 7, 40, 200]) {
            const { payload } = await seal(key, workspaceDoc({ links }), where);
            expect(payload.length % PAD_STEP).toBe(16); // 16 bytes of authentication tag after the padded content
        }
        const small = await Promise.all(['a', 'ab', 'a much longer title than before'].map(title => seal(key, { title }, where)));
        expect(new Set(small.map(sealed => sealed.payload.length)).size).toBe(1);
    });
});

describe('what the storage service cannot do', () => {
    it('cannot change a single bit without the document being rejected whole', async () => {
        const { key } = await vault();
        const sealed = await seal(key, workspaceDoc({ links: 10 }), where);
        for (const at of [0, 1, Math.floor(sealed.payload.length / 2), sealed.payload.length - 17, sealed.payload.length - 1]) {
            expect(await open(key, { ...sealed, payload: flip(sealed.payload, at) }, where), `byte ${at}`).toBeNull();
        }
        expect(await open(key, { ...sealed, nonce: flip(sealed.nonce, 0) }, where)).toBeNull();
        expect(await open(key, { ...sealed, payload: sealed.payload.slice(0, -1) }, where)).toBeNull();
        expect(await open(key, { ...sealed, payload: new Uint8Array(0) }, where)).toBeNull();
        expect(await open(key, sealed, where)).not.toBeNull();
    });

    it('cannot move a document to another account, another place, another key id or another revision', async () => {
        const { key } = await vault();
        const sealed = await seal(key, { n: 1 }, where);
        const moved: SealContext[] = [
            { ...where, uid: 'user_b' },
            { ...where, path: 'history/3' },
            { ...where, keyId: 'k2bbbbbb' },
            { ...where, revision: 4 }, // an old copy presented as a newer one
            { ...where, revision: 2 },
        ];
        for (const elsewhere of moved) expect(await open(key, sealed, elsewhere), JSON.stringify(elsewhere)).toBeNull();
    });

    it('cannot smuggle a second field into where a document belongs', async () => {
        const { key } = await vault();
        for (const bad of [{ ...where, uid: 'user_a\nworkspace/current' }, { ...where, path: 'a b' }, { ...where, keyId: '' }, { ...where, revision: 1.5 }, { ...where, revision: -1 }]) {
            await expect(seal(key, 1, bad)).rejects.toThrow();
            expect(await open(key, { nonce: new Uint8Array(12), payload: new Uint8Array(32) }, bad)).toBeNull();
        }
    });

    it('cannot exhaust memory with a document that inflates enormously', async () => {
        const { key } = await vault();
        const bomb = await seal(key, 'a'.repeat(17 * 1024 * 1024), where);
        expect(bomb.payload.length).toBeLessThan(64 * 1024);
        expect(await open(key, bomb, where)).toBeNull();
    });

    it('cannot make a device accept garbage as a setup', async () => {
        const { key } = await vault();
        const garbage = globalThis.crypto.getRandomValues(new Uint8Array(2048));
        expect(await open(key, { nonce: new Uint8Array(12), payload: garbage }, where)).toBeNull();
        expect(await open(key, { nonce: new Uint8Array(5), payload: garbage }, where)).toBeNull();
    });
});

describe('limits', () => {
    it('refuses to produce a document larger than the limit instead of truncating it', async () => {
        const { key } = await vault();
        const incompressible = Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(60_000))).toString('base64').repeat(1);
        const big = Array.from({ length: 9 }, (_, i) => incompressible + i + Buffer.from(globalThis.crypto.getRandomValues(new Uint8Array(45_000))).toString('base64'));
        await expect(seal(key, big, where)).rejects.toBeInstanceOf(SyncSizeError);
        expect(PAYLOAD_LIMIT).toBe(512 * 1024);
    });

    it('makes identifiers that say nothing about the person or the machine', () => {
        expect(newKeyId()).toMatch(/^[0-9a-z]{16}$/);
        expect(newDeviceId()).toMatch(/^[0-9a-z]{26}$/);
        expect(new Set(Array.from({ length: 100 }, newDeviceId)).size).toBe(100);
    });
});

const FIXED_PAYLOAD = 'dWfEX0t+nOxmjSUT4SJE0Us5o5WEwZKJDL644/j/jkr9jaZaD1wE+nrMGQeLt4LnXOembsH3+QrjP8gjALjw5gyP3l5fdWf76Bf+xx42iin0beHfQCwJqWxVX9pDWFbXPGvu65v273qiXtEGbU9625BBeAZQ84SfsIKgELttxbYajL7zF3/5lCjWSF0h0d0Sbtlt0HGlOhIbmUqmpJvKJ27Z4T5f9ajyBd5KUdnzw3A2+0yqyf4cRUB7BuIvk/IaSOwagg/vKtJg9q/bwN//v6TUOYJnRJI7Ry45MqFCLct9KpGIxgGWvCEXTTrAmHyPPr/URLg9zuKmLRMAOglwNZlo+SltzU4Vv/+gA2nRJ9GPIJ+yVTZQf72Jcz8qByiQp6RsJ1mLS3j3bmO4N55Iyaj91jMgZRl0/pKtVCQELIhuGj+qLtMlVfM42gAXUN/MolK45q9NN1J15rdO+yd//qz9r9Y2SGt/t0jAEwaunTY6RwT+ULBhVmsQeFhSVfqTmy33R1QrgDQLHFEwZud6zKj6jp8vKZHkBBFTvllwhAbMZpXTg5kEORgZeLQF6EbvLwhWntwLB0GWkxCtJROMD80gaFPc/z+mBn3JntfbJ9KUV1U61JgOgtYgPyAH8yOzBjOki4ILTIRD/mzEZ7faL9Uald2i48vw9DRJBqisJRG7NtmH3vKgHIElYH6w3IxV87u4XMbfxElxniUvY5SWoKjQW1uPFSn3WhfQXmyEZVmBFPQwUPLnPEI1DzG7HImUsgjjmCNQ+4qpzqr9T0fp3BgLHJd/DnWYkuN4i30nUSfFiTqDlnIEw6cG3018Kdeb7zA1GHlrDn8ScKTkcE8s7jfGmcnY6M7+SP4OSDmo+4xFmkJa69gnLmBfZ2fJhXsOwFHP9jcyU0rzTvDKyfnV/ps/Gts2KsA1OvMREVawUyJlcqA/8SbRhFCJw2+qk91VUa2NacGSU9DJUlavbJmPQLupjwMlLpQNbaDzzwI8nZbM9Rif2Ht4aoc102zp0Zuln6qJAucTuucU+vpb0KQ7Q9wn0MZ4485To5z6KAzpsysgYQDrLnxFI+9POzl71t5emEG6dvcLsabUg0notzi6yYIRXSbopVSpHXtA30ncTCfj0MHPGXKnetAXwd24aWd0amdMPqjzxurKm+NJiAcS61cKXwbqGGC7DPEhsvTqcTwIo2l66qsSilzpWQPBjzujgCTaGzekgNwsW/cWTbfFQP+FFbxRkQd+9zcTov1KFToPguOJSZk8hBeLh+G5BoJXzEuCx+DCtcZe0RskNiLrUmkLCgA/4FCJZCSWngXihw8WqWuUyIEl1TZcvndzQ1+zWDxJX7wYHQo2miem8T5Ogx/XGyicxwq4AsRUsFInn9s=';

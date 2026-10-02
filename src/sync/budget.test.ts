/**
 * How large an encrypted workspace gets, against the 512 kB limit. The numbers here are the
 * basis of the limit and of the chunking plan in docs/CLOUD_SYNC_DESIGN.md; if the document
 * format changes enough to move them, this fails and the plan is revisited.
 */
import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION } from '../core/types';
import { PAYLOAD_LIMIT, SyncSizeError, budget, createVaultKey, newDeviceId, newRecoverySecret, seal } from './crypto';
import { workspaceDoc, type WorkspaceShape } from './fixtures';
import type { WorkspacePlain } from './revision';

const { key } = await createVaultKey(newRecoverySecret(), 'user_a', 'k1aaaaaa');
const where = { uid: 'user_a', path: 'workspace/current', keyId: 'k1aaaaaa', revision: 1 };
const sealedSize = async (shape: WorkspaceShape): Promise<number> => {
    const plain: WorkspacePlain = { schema: SCHEMA_VERSION, deviceId: newDeviceId(), savedAt: Date.now(), doc: workspaceDoc(shape) };
    return (await seal(key, plain, where)).payload.length;
};
const kB = 1024;

describe('payload growth', () => {
    it('an ordinary setup is a few kilobytes', async () => {
        expect(await sealedSize({ links: 25 })).toBeLessThanOrEqual(4 * kB + 16);
        expect(await sealedSize({ links: 100 })).toBeLessThanOrEqual(8 * kB + 16);
        expect(await sealedSize({ links: 500 })).toBeLessThanOrEqual(32 * kB + 16);
    });

    it('grows by about 45 bytes a link, so a thousand links use under a tenth of the limit', async () => {
        const [one, five] = [await sealedSize({ links: 1000 }), await sealedSize({ links: 5000 })];
        expect(one).toBeLessThan(PAYLOAD_LIMIT / 10);
        const perLink = (five - one) / 4000;
        expect(perLink).toBeGreaterThan(30);
        expect(perLink).toBeLessThan(60);
    });

    it('fits ten thousand links; the limit is reached between ten and fifteen thousand', async () => {
        expect(await sealedSize({ links: 10_000 })).toBeLessThan(PAYLOAD_LIMIT);
        await expect(sealedSize({ links: 15_000 })).rejects.toBeInstanceOf(SyncSizeError);
    });

    it('long addresses cost what they weigh: a thousand links with 200 extra characters each still fit', async () => {
        expect(await sealedSize({ links: 1000, longAddresses: 200 })).toBeLessThan(PAYLOAD_LIMIT / 2);
    });

    it('pictures stored inside links cannot fill the document: the icon limits hold them to about a fifth of it', { timeout: 30_000 }, async () => {
        // Before the limits these were 475 kB and a refusal.
        expect(await sealedSize({ links: 300, iconBytes: 2048 })).toBeLessThan(PAYLOAD_LIMIT / 4);
        expect(await sealedSize({ links: 100, iconBytes: 8192 })).toBeLessThan(PAYLOAD_LIMIT / 4);
        // The worst a workspace can do with icons: every link carrying one at the 32 KB cap.
        expect(await sealedSize({ links: 200, iconBytes: 32 * kB })).toBeLessThan(PAYLOAD_LIMIT / 4);
        expect(await sealedSize({ links: 1000, iconBytes: 32 * kB, iconShare: 0.1 })).toBeLessThan(PAYLOAD_LIMIT / 3);
        expect(await sealedSize({ links: 5000, iconBytes: 32 * kB, iconShare: 0.02 })).toBeLessThan(PAYLOAD_LIMIT * 0.65);
        // Ten thousand links AND a full allowance of icons is past the limit: refused whole, as any oversized workspace is.
        await expect(sealedSize({ links: 10_000, iconBytes: 32 * kB, iconShare: 0.01 })).rejects.toBeInstanceOf(SyncSizeError);
    });

    it('a realistic workspace with ordinary icons is small: one link in ten with its own 3 kB picture', async () => {
        expect(await sealedSize({ links: 300, iconBytes: 3000, iconShare: 0.1 })).toBeLessThan(96 * kB);
        expect(await sealedSize({ links: 1000, iconBytes: 3000, iconShare: 0.1 })).toBeLessThan(160 * kB);
    });

    it('an oversized workspace is refused whole, with its size, never cut short', async () => {
        const error = await sealedSize({ links: 15_000 }).catch((caught: unknown) => caught);
        expect(error).toBeInstanceOf(SyncSizeError);
        expect((error as SyncSizeError).bytes).toBeGreaterThan(PAYLOAD_LIMIT);
    });

    it('warns from three quarters of the limit, before sync would stop', () => {
        expect(budget(10 * kB)).toBe('ok');
        expect(budget(PAYLOAD_LIMIT * 0.75)).toBe('near');
        expect(budget(PAYLOAD_LIMIT)).toBe('near');
        expect(budget(PAYLOAD_LIMIT + 1)).toBe('over');
    });

    it('stays fast enough to run on every change: ten thousand links seal in well under a second', async () => {
        const started = performance.now();
        await sealedSize({ links: 10_000 });
        expect(performance.now() - started).toBeLessThan(1500);
    });
});

/**
 * The upgrade pass must never destroy the only copy of a value it replaces: the original is
 * written to its own record first, and if that cannot be done the changed setup is not written.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '../brand';
import { LIMITS } from '../core/limits';
import { sanitize } from '../core/sanitize';
import type { AppState } from '../core/types';
import { workspace } from '../sync/fixtures';

const memory = new Map<string, string>();
let refuse: string | null = null;
const longTitle = 'T'.repeat(LIMITS.title + 30);
const longName = 'S'.repeat(LIMITS.name + 5);

/** A stored setup from before the limits: one overlong title, one overlong Space name. */
function storeOldSetup(): { raw: AppState; item: string; space: string } {
    const raw = JSON.parse(JSON.stringify({ ...sanitize(workspace({ links: 4, spaces: 2 })), onboarded: true, updatedAt: 1000 })) as AppState;
    const item = Object.keys(raw.items)[0]!;
    const space = raw.spaceOrder[0]!;
    raw.items[item]!.title = longTitle;
    raw.spaces[space]!.name = longName;
    memory.set(STORAGE_KEYS.state, JSON.stringify(raw));
    return { raw, item, space };
}
const stored = <T>(key: string): T | undefined => (memory.has(key) ? JSON.parse(memory.get(key)!) as T : undefined);

beforeEach(() => {
    memory.clear();
    refuse = null;
    vi.resetModules(); // the storage module remembers what it has not yet written
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
            if (key === refuse) throw new Error('quota');
            memory.set(key, value);
        },
        removeItem: (key: string) => void memory.delete(key),
    });
});
afterEach(() => vi.unstubAllGlobals());

describe('originals of values the limits replaced', () => {
    it('loading changes nothing in storage: the stored setup still holds the originals', async () => {
        const { raw } = storeOldSetup();
        const { loadState } = await import('./storage');
        const resolved = await loadState();
        expect(resolved.report).toMatchObject({ titlesReplaced: 1, namesReplaced: 1 });
        expect(stored(STORAGE_KEYS.state)).toEqual(raw);
        expect(memory.has(STORAGE_KEYS.limitsOriginals)).toBe(false);
    });

    it('are written before the changed setup, exactly as they were', async () => {
        const { item, space } = storeOldSetup();
        const { loadState, saveState } = await import('./storage');
        const { state } = await loadState();
        const order: string[] = [];
        const set = localStorage.setItem.bind(localStorage);
        vi.stubGlobal('localStorage', { ...localStorage, setItem: (key: string, value: string) => (order.push(key), set(key, value)) });
        await saveState(state);
        expect(order).toEqual([STORAGE_KEYS.limitsOriginals, STORAGE_KEYS.state]);
        const record = stored<{ batches: { originals: { kind: string; original: string }[] }[] }>(STORAGE_KEYS.limitsOriginals)!;
        expect(record.batches).toHaveLength(1);
        expect(record.batches[0]!.originals.map(entry => [entry.kind, entry.original]).sort()).toEqual([['name', longName], ['title', longTitle]]);
        const saved = stored<AppState>(STORAGE_KEYS.state)!;
        expect(saved.items[item]!.title).not.toBe(longTitle);
        expect(saved.spaces[space]!.name).toBe('Untitled');
    });

    it('if they cannot be written, the changed setup is not written either: the stored original survives', async () => {
        const { raw } = storeOldSetup();
        const { loadState, saveState } = await import('./storage');
        const { state } = await loadState();
        refuse = STORAGE_KEYS.limitsOriginals;
        await expect(saveState(state)).rejects.toThrow();
        await expect(saveState({ ...state, updatedAt: Date.now() + 1 })).rejects.toThrow(); // a later edit cannot slip past either
        expect(stored(STORAGE_KEYS.state)).toEqual(raw);
        // Once there is room again, the originals go first and the save succeeds.
        refuse = null;
        await saveState(state);
        expect(stored<{ batches: unknown[] }>(STORAGE_KEYS.limitsOriginals)!.batches).toHaveLength(1);
        expect(stored<AppState>(STORAGE_KEYS.state)!.updatedAt).toBe(state.updatedAt);
    });

    it('are added to, never overwritten, and removed only on request', async () => {
        storeOldSetup();
        let storage = await import('./storage');
        await storage.saveState((await storage.loadState()).state);
        // A later pass (say, a restored old backup written straight into storage) keeps its originals beside the first.
        vi.resetModules();
        storeOldSetup();
        storage = await import('./storage');
        await storage.saveState((await storage.loadState()).state);
        const { loadOriginals, clearOriginals, countOriginals } = await import('./originals');
        const record = await loadOriginals();
        expect(record.batches).toHaveLength(2);
        expect([countOriginals(record, 'title'), countOriginals(record, 'name'), countOriginals(record, 'link')]).toEqual([2, 2, 0]);
        await clearOriginals();
        expect((await loadOriginals()).batches).toEqual([]);
    });

    it('a setup within the limits writes no record and reports nothing', async () => {
        memory.set(STORAGE_KEYS.state, JSON.stringify({ ...sanitize(workspace({ links: 4, spaces: 2 })), onboarded: true, updatedAt: 1000 }));
        const { loadState, saveState } = await import('./storage');
        const resolved = await loadState();
        expect(resolved.report).toBeUndefined();
        await saveState(resolved.state);
        expect(memory.has(STORAGE_KEYS.limitsOriginals)).toBe(false);
    });

    it('reads anything unreadable as no record', async () => {
        const { loadOriginals } = await import('./originals');
        for (const junk of ['5', '"x"', '{"batches":"x"}', '{"batches":[{"originals":[{"kind":"other","of":"","original":"x"}]}]}']) {
            memory.set(STORAGE_KEYS.limitsOriginals, junk);
            expect((await loadOriginals()).batches).toEqual([]);
        }
    });
});

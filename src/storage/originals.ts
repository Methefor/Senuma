/**
 * The record of text values the size limits replaced or left out, kept exactly as they were
 * until the person removes it. Loaded only when a pass has something to keep, or when Settings
 * shows the record.
 */
import { STORAGE_KEYS } from '../brand';
import { kv } from '../browser/kv';
import type { Original, OriginalsRecord } from '../core/limits';

/** Reads a stored record of originals; anything unreadable counts as none. */
export function readOriginals(raw: unknown): OriginalsRecord {
    const batches = raw && typeof raw === 'object' && Array.isArray((raw as OriginalsRecord).batches) ? (raw as OriginalsRecord).batches : [];
    return {
        v: 1,
        batches: batches.flatMap(batch => {
            const originals = (Array.isArray(batch?.originals) ? batch.originals : []).filter((entry): entry is Original =>
                !!entry && ['link', 'title', 'name'].includes(entry.kind) && typeof entry.of === 'string' && typeof entry.original === 'string');
            return originals.length ? [{ at: typeof batch.at === 'number' ? batch.at : 0, originals }] : [];
        }),
    };
}

export const countOriginals = (record: OriginalsRecord, kind: Original['kind']): number =>
    record.batches.reduce((sum, batch) => sum + batch.originals.filter(entry => entry.kind === kind).length, 0);

/** The originals set aside so far, oldest pass first. */
export async function loadOriginals(): Promise<OriginalsRecord> {
    return readOriginals((await kv.get([STORAGE_KEYS.limitsOriginals]))[STORAGE_KEYS.limitsOriginals]);
}

/** Adds one pass's originals to the record. Rejects when they cannot be written. */
export async function keepOriginals(originals: Original[]): Promise<void> {
    const record = await loadOriginals();
    await kv.set({ [STORAGE_KEYS.limitsOriginals]: { v: 1, batches: [...record.batches, { at: Date.now(), originals }] } });
}

/** Removes the record. Only ever at the person's request. */
export async function clearOriginals(): Promise<void> {
    await kv.set({ [STORAGE_KEYS.limitsOriginals]: { v: 1, batches: [] } });
}

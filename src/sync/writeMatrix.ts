/**
 * Writes to the workspace document, and whether each must be accepted. One list, used twice:
 * against the pure reference rule (`writeAllowed`, in the unit tests) and against the real
 * Firestore Security Rules (in the emulator tests). The two must agree on every row; where the
 * rules language makes them differ, the row says so with `rulesOnly` or `referenceOnly`.
 *
 * Plain data, so that neither side's types leak into the other. Test material; not shipped.
 */

/** What is on the server before the write. Null: no document. */
export interface Before {
    revision: number;
    /** How long ago it was written, in milliseconds. */
    ageMs: number;
}

/** The document being written, described rather than built. */
export interface Attempt {
    format?: unknown;
    keyId?: unknown;
    revision?: unknown;
    /** `server`: the server's own time (the only valid choice). `client`: a time the client picked. `text`: not a time at all. */
    time?: 'server' | 'client' | 'text';
    /** Bytes of nonce, or `text` for a string where bytes belong. */
    nonce?: number | 'text';
    /** Bytes of ciphertext, or `text`. */
    payload?: number | 'text';
    /** Fields beyond the six. */
    extra?: Record<string, unknown>;
    /** One of the six, left out. */
    omit?: 'format' | 'keyId' | 'revision' | 'updatedAt' | 'nonce' | 'payload';
}

export interface WriteCase {
    group: 'shape' | 'revision' | 'rate';
    name: string;
    before: Before | null;
    attempt: Attempt;
    allowed: boolean;
}

/** Smallest and largest ciphertext format 1 can produce: 1 KiB steps plus a 16-byte tag, at most 512 KiB. */
export const SMALLEST_PAYLOAD = 1040;
export const LARGEST_PAYLOAD = 511 * 1024 + 16;

const settled: Before = { revision: 5, ageMs: 60_000 };

export const WRITE_CASES: WriteCase[] = [
    // ---- shape ----
    { group: 'shape', name: 'a valid first document', before: null, attempt: { revision: 1 }, allowed: true },
    { group: 'shape', name: 'a valid next revision', before: settled, attempt: { revision: 6 }, allowed: true },
    { group: 'shape', name: 'the largest ciphertext the format allows', before: settled, attempt: { revision: 6, payload: LARGEST_PAYLOAD }, allowed: true },
    { group: 'shape', name: 'an unknown field beside the ciphertext', before: settled, attempt: { revision: 6, extra: { deviceName: 'Laptop' } }, allowed: false },
    { group: 'shape', name: 'a schema version field (it belongs inside the ciphertext)', before: settled, attempt: { revision: 6, extra: { schemaVersion: 4 } }, allowed: false },
    { group: 'shape', name: 'a device id field (it belongs inside the ciphertext)', before: settled, attempt: { revision: 6, extra: { deviceId: 'abcdefghijklmnopqrstuvwxyz' } }, allowed: false },
    { group: 'shape', name: 'no format', before: settled, attempt: { revision: 6, omit: 'format' }, allowed: false },
    { group: 'shape', name: 'no key id', before: settled, attempt: { revision: 6, omit: 'keyId' }, allowed: false },
    { group: 'shape', name: 'no revision', before: settled, attempt: { omit: 'revision' }, allowed: false },
    { group: 'shape', name: 'no time', before: settled, attempt: { revision: 6, omit: 'updatedAt' }, allowed: false },
    { group: 'shape', name: 'no nonce', before: settled, attempt: { revision: 6, omit: 'nonce' }, allowed: false },
    { group: 'shape', name: 'no ciphertext', before: settled, attempt: { revision: 6, omit: 'payload' }, allowed: false },
    { group: 'shape', name: 'a newer format number', before: settled, attempt: { revision: 6, format: 2 }, allowed: false },
    { group: 'shape', name: 'format as text', before: settled, attempt: { revision: 6, format: '1' }, allowed: false },
    { group: 'shape', name: 'a readable key id', before: settled, attempt: { revision: 6, keyId: 'Mete’s laptop key' }, allowed: false },
    { group: 'shape', name: 'a key id that is too short', before: settled, attempt: { revision: 6, keyId: 'abc' }, allowed: false },
    { group: 'shape', name: 'a key id that is a number', before: settled, attempt: { revision: 6, keyId: 12345678 }, allowed: false },
    { group: 'shape', name: 'revision as text', before: settled, attempt: { revision: '6' }, allowed: false },
    { group: 'shape', name: 'revision with a fraction', before: settled, attempt: { revision: 6.5 }, allowed: false },
    { group: 'shape', name: 'a time chosen by the client', before: settled, attempt: { revision: 6, time: 'client' }, allowed: false },
    { group: 'shape', name: 'a time that is not a time', before: settled, attempt: { revision: 6, time: 'text' }, allowed: false },
    { group: 'shape', name: 'a nonce one byte short', before: settled, attempt: { revision: 6, nonce: 11 }, allowed: false },
    { group: 'shape', name: 'a nonce one byte long', before: settled, attempt: { revision: 6, nonce: 13 }, allowed: false },
    { group: 'shape', name: 'a nonce that is text', before: settled, attempt: { revision: 6, nonce: 'text' }, allowed: false },
    { group: 'shape', name: 'ciphertext that is text', before: settled, attempt: { revision: 6, payload: 'text' }, allowed: false },
    { group: 'shape', name: 'empty ciphertext', before: settled, attempt: { revision: 6, payload: 0 }, allowed: false },
    { group: 'shape', name: 'ciphertext shorter than one padded block', before: settled, attempt: { revision: 6, payload: 512 }, allowed: false },
    { group: 'shape', name: 'ciphertext that is not a whole number of blocks plus the tag', before: settled, attempt: { revision: 6, payload: 2000 }, allowed: false },
    { group: 'shape', name: 'ciphertext one block over the limit', before: settled, attempt: { revision: 6, payload: LARGEST_PAYLOAD + 1024 }, allowed: false },

    // ---- revision ----
    { group: 'revision', name: 'a first document that does not start at 1', before: null, attempt: { revision: 2 }, allowed: false },
    { group: 'revision', name: 'a first document at 0', before: null, attempt: { revision: 0 }, allowed: false },
    { group: 'revision', name: 'the same revision again', before: settled, attempt: { revision: 5 }, allowed: false },
    { group: 'revision', name: 'a skipped revision', before: settled, attempt: { revision: 7 }, allowed: false },
    { group: 'revision', name: 'a far-ahead revision', before: settled, attempt: { revision: 5000 }, allowed: false },
    { group: 'revision', name: 'a rollback by one', before: settled, attempt: { revision: 4 }, allowed: false },
    { group: 'revision', name: 'a rollback to 1', before: settled, attempt: { revision: 1 }, allowed: false },
    { group: 'revision', name: 'a negative revision', before: settled, attempt: { revision: -1 }, allowed: false },

    // ---- rate ----
    { group: 'rate', name: 'the next revision half a second after the last', before: { revision: 5, ageMs: 500 }, attempt: { revision: 6 }, allowed: false },
    { group: 'rate', name: 'the next revision ten seconds after the last', before: { revision: 5, ageMs: 10_000 }, attempt: { revision: 6 }, allowed: true },
];

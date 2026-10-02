/** Schema upgrades for stored states of the current model. (1.x conversion lives in legacyConvert.ts.) */
import { isDict, sanitize } from './sanitize';
import { SCHEMA_VERSION, type AppState } from './types';

type Dict = Record<string, unknown>;

// ---------- Schema upgrades for the new model ----------

/** MIGRATIONS[n] turns a stored state of schema n into schema n + 1. */
const MIGRATIONS: Record<number, (raw: Dict) => Dict> = {
    // v2 → v3: pinned flags became an ordered dock; providers and recents gained fields.
    2: raw => {
        const items = isDict(raw.items) ? raw.items : {};
        const spaces = isDict(raw.spaces) ? raw.spaces : {};
        const order = Array.isArray(raw.spaceOrder) ? raw.spaceOrder : Object.keys(spaces);
        const dock: unknown[] = [];
        for (const spaceId of order) {
            const space = spaces[String(spaceId)];
            if (!isDict(space) || !Array.isArray(space.groups)) continue;
            for (const group of space.groups) {
                for (const itemId of isDict(group) && Array.isArray(group.itemIds) ? group.itemIds : []) {
                    const item = items[String(itemId)];
                    if (isDict(item) && item.pinned === true) dock.push({ kind: 'item', id: itemId });
                }
            }
        }
        const providers = (Array.isArray(raw.providers) ? raw.providers : []).map(p =>
            isDict(p) ? { ...p, urlTemplate: p.url || undefined, browserDefault: p.id === 'default' || undefined } : p,
        );
        const recents = (Array.isArray(raw.recents) ? raw.recents : []).map(r => (isDict(r) ? { count: 1, ...r } : r));
        const prefs = isDict(raw.prefs) ? { ...raw.prefs, iconSource: raw.prefs.iconSource === 'none' ? 'none' : 'service' } : raw.prefs;
        const legacy = isDict(raw.legacy) ? { acknowledged: true, ...raw.legacy } : raw.legacy;
        return { ...raw, dock, providers, recents, prefs, legacy, schema: 3 };
    },
    // v3 → v4: backgrounds, atmosphere and the wallpaper library arrive. Every new field has
    // a default that sanitize fills in, so the step only has to move the version on.
    3: raw => ({ ...raw, schema: 4 }),
};

/** Brings a stored or imported state up to the current schema and validates it. Null if unusable. */
export function upgrade(raw: unknown): AppState | null {
    if (!isDict(raw)) return null;
    let current = raw;
    let version = typeof current.schema === 'number' ? current.schema : SCHEMA_VERSION;
    // A file from a newer release is read best-effort; unknown fields are ignored by sanitize.
    while (version < SCHEMA_VERSION) {
        const step = MIGRATIONS[version];
        if (!step) return null;
        current = step(current);
        version++;
    }
    return sanitize(current);
}

export interface Resolved {
    state: AppState;
    source: 'stored' | 'legacy' | 'fresh';
}

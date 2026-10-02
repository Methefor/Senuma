/**
 * Three-way merge of two copies of a setup against the copy both started from (Senuma 2.1,
 * phase 1: not used by the product yet). Pure: no clocks, no randomness, no storage.
 *
 * Rules:
 *   - A change made on one side only is taken.
 *   - The same change on both sides is taken once.
 *   - Two different changes to the same thing, an edit against a deletion, or two different
 *     reorderings of the same list are CONFLICTS. They are reported, never decided here: the
 *     result keeps this device's version provisionally and must not be applied until every
 *     conflict has a resolution.
 *   - Nothing is decided by comparing timestamps.
 *
 * Deletions need no tombstones: something present in the base and absent on one side was
 * deleted there.
 */
import { MAX_DOCK } from '../core/defaults';
import type { DockEntry, ID, Item, Mode, SearchProvider, Space } from '../core/types';
import type { SyncDoc } from './scope';

export type Side = 'local' | 'remote';

export interface Conflict {
    /** Stable name of the decision; a resolution is given under the same key. */
    key: string;
    kind: 'item' | 'group' | 'space' | 'mode' | 'provider' | 'pref' | 'dock';
    id: string;
    /** A field name, `exists` (edited on one side, deleted on the other) or `order`. */
    field: string;
    base: unknown;
    local: unknown;
    remote: unknown;
}

export type Resolutions = Record<string, Side>;

export interface MergeResult {
    doc: SyncDoc;
    /** Empty when the result may be applied. */
    conflicts: Conflict[];
}

/** Stable text form: equal values give equal text, whatever the order of their keys. */
export function canonical(value: unknown): string {
    return value === undefined ? '' : JSON.stringify(value, (_key, inner: unknown) =>
        inner && typeof inner === 'object' && !Array.isArray(inner)
            ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
            : inner);
}

const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);

type SpaceFields = Omit<Space, 'groups'>;

/** A setup taken apart, so that every thing that can change independently has its own entry. */
interface Flat {
    items: Record<ID, Item>;
    /** Which group holds each link. */
    itemGroup: Record<ID, ID>;
    groups: Record<ID, { name: string }>;
    groupSpace: Record<ID, ID>;
    groupItems: Record<ID, ID[]>;
    spaces: Record<ID, SpaceFields>;
    spaceGroups: Record<ID, ID[]>;
    providers: Record<ID, SearchProvider>;
}

function flatten(doc: SyncDoc): Flat {
    const flat: Flat = { items: doc.items, itemGroup: {}, groups: {}, groupSpace: {}, groupItems: {}, spaces: {}, spaceGroups: {}, providers: {} };
    for (const space of Object.values(doc.spaces)) {
        const { groups, ...fields } = space;
        flat.spaces[space.id] = fields;
        flat.spaceGroups[space.id] = groups.map(group => group.id);
        for (const group of groups) {
            flat.groups[group.id] = { name: group.name };
            flat.groupSpace[group.id] = space.id;
            flat.groupItems[group.id] = group.itemIds.filter(id => id in doc.items);
            for (const id of flat.groupItems[group.id]!) flat.itemGroup[id] = group.id;
        }
    }
    for (const provider of doc.providers) flat.providers[provider.id] = provider;
    return flat;
}

const union = (...records: object[]): string[] => [...new Set(records.flatMap(record => Object.keys(record)))];
const dockKey = (entry: DockEntry): string => `${entry.kind}:${entry.id}`;

export function mergeDocs(base: SyncDoc, local: SyncDoc, remote: SyncDoc, resolutions: Resolutions = {}): MergeResult {
    if (base.schema !== local.schema || local.schema !== remote.schema) throw new Error('mergeDocs: the three copies must be of one schema');
    const conflicts: Conflict[] = [];
    const B = flatten(base);
    const L = flatten(local);
    const R = flatten(remote);

    /** One value changed on both sides. */
    const decide = <T>(kind: Conflict['kind'], id: string, field: string, b: T | undefined, l: T, r: T): T => {
        if (same(l, r)) return l;
        if (same(l, b)) return r;
        if (same(r, b)) return l;
        const key = `${kind}:${id}:${field}`;
        const side = resolutions[key];
        if (!side) conflicts.push({ key, kind, id, field, base: b ?? null, local: l ?? null, remote: r ?? null });
        return side === 'remote' ? r : l;
    };

    /**
     * Which things still exist. `touched` says whether the side that kept a thing also changed
     * it; `follows` names a parent whose fate the thing shares when the other side removed both.
     */
    const survivors = <T>(
        kind: Conflict['kind'], b: Record<ID, T>, l: Record<ID, T>, r: Record<ID, T>,
        touched: (id: ID, keeper: Flat) => boolean,
        follows?: (id: ID, keeper: Flat, other: Flat) => boolean | undefined,
    ): Set<ID> => {
        const kept = new Set<ID>();
        for (const id of union(l, r)) {
            const inL = id in l;
            const inR = id in r;
            if ((inL && inR) || !(id in b)) {
                kept.add(id);
                continue;
            }
            // In the base, and now on one side only: the other side deleted it.
            const keeper: Side = inL ? 'local' : 'remote';
            const inherited = follows?.(id, inL ? L : R, inL ? R : L);
            if (inherited !== undefined) {
                if (inherited) kept.add(id);
                continue;
            }
            if (!touched(id, inL ? L : R)) continue;
            const key = `${kind}:${id}:exists`;
            const side = resolutions[key];
            if (!side) conflicts.push({ key, kind, id, field: 'exists', base: b[id] ?? null, local: inL ? l[id] : null, remote: inR ? r[id] : null });
            if ((side ?? 'local') === keeper) kept.add(id);
        }
        return kept;
    };

    /** The order of `members`, given three orderings of (mostly) the same things. */
    const order = (kind: Conflict['kind'], id: string, b: ID[], l: ID[], r: ID[], members: Set<ID>): ID[] => {
        const everywhere = new Set(b.filter(x => members.has(x) && l.includes(x) && r.includes(x)));
        const shared = (list: ID[]) => list.filter(x => everywhere.has(x));
        const localMoved = !same(shared(l), shared(b));
        const remoteMoved = !same(shared(r), shared(b));
        let lead: Side = localMoved ? 'local' : 'remote';
        if (localMoved && remoteMoved && !same(shared(l), shared(r))) {
            const key = `${kind}:${id}:order`;
            const side = resolutions[key];
            if (!side) conflicts.push({ key, kind, id, field: 'order', base: shared(b), local: shared(l), remote: shared(r) });
            lead = side ?? 'local';
        }
        const [first, second] = lead === 'local' ? [l, r] : [r, l];
        const out = [...new Set(first.filter(x => members.has(x)))];
        // What only the other side has goes in after the neighbour it followed there; what it had at the end stays at the end.
        second.forEach((x, index) => {
            if (!members.has(x) || out.includes(x)) return;
            if (!second.slice(index + 1).some(later => out.includes(later))) return void out.push(x);
            let at = 0;
            for (let i = index - 1; i >= 0; i--) {
                const found = out.indexOf(second[i]!);
                if (found >= 0) {
                    at = found + 1;
                    break;
                }
            }
            out.splice(at, 0, x);
        });
        for (const x of [...members].sort()) if (!out.includes(x)) out.push(x);
        return out;
    };

    /** Membership of a plain list of references: added by either side, removed by either side. */
    const members = (b: string[], l: string[], r: string[]): Set<string> =>
        new Set([...l, ...r].filter(x => (l.includes(x) && r.includes(x)) || !b.includes(x)));

    // ---------- Spaces, groups, links: what exists ----------

    const itemsOf = (flat: Flat, groupIds: ID[]) => groupIds.flatMap(group => flat.groupItems[group] ?? []);
    const groupTouched = (id: ID, keeper: Flat) =>
        !same(keeper.groups[id], B.groups[id]) || !same(keeper.groupItems[id], B.groupItems[id])
        || (keeper.groupItems[id] ?? []).some(item => !same(keeper.items[item], B.items[item]));
    const spaces = survivors('space', B.spaces, L.spaces, R.spaces, (id, keeper) =>
        !same(keeper.spaces[id], B.spaces[id]) || !same(keeper.spaceGroups[id], B.spaceGroups[id])
        || (keeper.spaceGroups[id] ?? []).some(group => groupTouched(group, keeper))
        || itemsOf(keeper, keeper.spaceGroups[id] ?? []).some(item => keeper.itemGroup[item] !== B.itemGroup[item]));
    const groups = survivors('group', B.groups, L.groups, R.groups, groupTouched, (id, keeper, other) => {
        const space = keeper.groupSpace[id]!;
        return space in other.spaces ? undefined : spaces.has(space);
    });
    const items = survivors('item', B.items, L.items, R.items,
        (id, keeper) => !same(keeper.items[id], B.items[id]) || keeper.itemGroup[id] !== B.itemGroup[id],
        (id, keeper, other) => {
            const group = keeper.itemGroup[id];
            return group === undefined || group in other.groups ? undefined : groups.has(group);
        });

    // ---------- Their contents ----------

    const field = <T extends object, K extends keyof T & string>(kind: Conflict['kind'], id: ID, key: K, b: T | undefined, l: T | undefined, r: T | undefined): T[K] =>
        l && r ? decide(kind, id, key, b?.[key], l[key], r[key]) : (l ?? r)![key];

    const groupSpace: Record<ID, ID> = {};
    for (const id of [...groups]) {
        const l = L.groupSpace[id];
        const r = R.groupSpace[id];
        const space = l !== undefined && r !== undefined ? decide('group', id, 'space', B.groupSpace[id], l, r) : (l ?? r)!;
        if (spaces.has(space)) groupSpace[id] = space;
        else groups.delete(id);
    }

    const outItems: Record<ID, Item> = {};
    const itemGroup: Record<ID, ID> = {};
    for (const id of items) {
        const l = id in L.items ? L.itemGroup[id] : undefined;
        const r = id in R.items ? R.itemGroup[id] : undefined;
        let group = id in L.items && id in R.items ? decide('item', id, 'group', B.itemGroup[id], l, r) : (l ?? r);
        // The group chosen was removed: fall back to the other side's place, if that still exists.
        if (group !== undefined && !groups.has(group)) group = [l, r].find(candidate => candidate !== undefined && groups.has(candidate));
        if (group === undefined && (l !== undefined || r !== undefined)) continue; // its place is gone everywhere
        if (group !== undefined) itemGroup[id] = group;
        const [b, li, ri] = [B.items[id], L.items[id], R.items[id]];
        outItems[id] = {
            id,
            title: field('item', id, 'title', b, li, ri),
            url: field('item', id, 'url', b, li, ri),
            icon: field('item', id, 'icon', b, li, ri),
            createdAt: field('item', id, 'createdAt', b, li, ri),
        };
    }

    const outSpaces: Record<ID, Space> = {};
    for (const id of spaces) {
        const [b, l, r] = [B.spaces[id], L.spaces[id], R.spaces[id]];
        const mine = new Set([...groups].filter(group => groupSpace[group] === id));
        const groupOrder = order('space', id, B.spaceGroups[id] ?? [], L.spaceGroups[id] ?? [], R.spaceGroups[id] ?? [], mine);
        const built = groupOrder.map(group => ({
            id: group,
            name: field('group', group, 'name', B.groups[group], L.groups[group], R.groups[group]),
            itemIds: order('group', group, B.groupItems[group] ?? [], L.groupItems[group] ?? [], R.groupItems[group] ?? [],
                new Set(Object.keys(itemGroup).filter(item => itemGroup[item] === group))),
        }));
        outSpaces[id] = {
            id,
            name: field('space', id, 'name', b, l, r),
            note: field('space', id, 'note', b, l, r),
            glyph: field('space', id, 'glyph', b, l, r),
            accent: field('space', id, 'accent', b, l, r),
            // A Space always has a group; the id is derived so that every device makes the same one.
            groups: built.length ? built : [{ id: `${id}g`, name: '', itemIds: [] }],
            templateId: field('space', id, 'templateId', b, l, r),
            createdAt: field('space', id, 'createdAt', b, l, r),
        };
    }
    const spaceOrder = order('space', 'all', base.spaceOrder, local.spaceOrder, remote.spaceOrder, spaces);

    // ---------- Search providers ----------

    const providers = survivors('provider', B.providers, L.providers, R.providers, (id, keeper) => !same(keeper.providers[id], B.providers[id]));
    const providerOrder = order('provider', 'all', base.providers.map(p => p.id), local.providers.map(p => p.id), remote.providers.map(p => p.id), providers);
    const outProviders = providerOrder.map(id => (L.providers[id] && R.providers[id] ? decide('provider', id, 'value', B.providers[id], L.providers[id], R.providers[id]) : (L.providers[id] ?? R.providers[id])!));

    // ---------- Dock ----------

    const mergeDock = (kind: Conflict['kind'], id: string, b: DockEntry[], l: DockEntry[], r: DockEntry[]): DockEntry[] => {
        const [bk, lk, rk] = [b.map(dockKey), l.map(dockKey), r.map(dockKey)];
        const alive = new Set([...members(bk, lk, rk)].filter(key => {
            const target = key.slice(key.indexOf(':') + 1);
            return key.startsWith('item:') ? target in outItems : spaces.has(target);
        }));
        return order(kind, id, bk, lk, rk, alive).slice(0, MAX_DOCK).map(key => ({ kind: key.startsWith('item:') ? 'item' : 'space', id: key.slice(key.indexOf(':') + 1) }));
    };
    const dock = mergeDock('dock', 'shared', base.dock, local.dock, remote.dock);

    // ---------- Modes ----------

    const modes = survivors('mode', base.modes, local.modes, remote.modes, (id, keeper) => !same((keeper === L ? local : remote).modes[id], base.modes[id]));
    const outModes: Record<ID, Mode> = {};
    for (const id of modes) {
        const [b, l, r] = [base.modes[id], local.modes[id], remote.modes[id]];
        const shown = new Set([...members(b?.spaceIds ?? [], l?.spaceIds ?? (r?.spaceIds ?? []), r?.spaceIds ?? (l?.spaceIds ?? []))].filter(space => spaces.has(space)));
        const provider = field('mode', id, 'providerId', b, l, r);
        const ownDock = l && r
            ? (l.dock && r.dock ? mergeDock('mode', `${id}:dock`, b?.dock ?? [], l.dock, r.dock) : decide('mode', id, 'dock', b?.dock, l.dock, r.dock))
            : (l ?? r)!.dock;
        outModes[id] = {
            id,
            name: field('mode', id, 'name', b, l, r),
            glyph: field('mode', id, 'glyph', b, l, r),
            spaceIds: order('mode', `${id}:spaces`, b?.spaceIds ?? [], l?.spaceIds ?? (r?.spaceIds ?? []), r?.spaceIds ?? (l?.spaceIds ?? []), shown),
            themeId: field('mode', id, 'themeId', b, l, r),
            background: field('mode', id, 'background', b, l, r),
            providerId: provider !== undefined && !providers.has(provider) ? undefined : provider,
            dock: ownDock,
        };
    }
    const modeOrder = order('mode', 'all', base.modeOrder, local.modeOrder, remote.modeOrder, modes);

    // ---------- Preferences ----------

    const prefs: Record<string, unknown> = {};
    for (const key of union(local.prefs, remote.prefs)) {
        prefs[key] = decide('pref', key, 'value', (base.prefs as Record<string, unknown>)[key], (local.prefs as Record<string, unknown>)[key], (remote.prefs as Record<string, unknown>)[key]);
    }
    if (typeof prefs.defaultProviderId === 'string' && !providers.has(prefs.defaultProviderId) && outProviders[0]) prefs.defaultProviderId = outProviders[0].id;

    const doc = { schema: local.schema, spaces: outSpaces, spaceOrder, items: outItems, modes: outModes, modeOrder, dock, providers: outProviders, prefs };
    // Dropping `undefined` members keeps the result identical to what storage would hand back.
    return { doc: JSON.parse(JSON.stringify(doc)) as SyncDoc, conflicts };
}

/** Resolutions that settle every listed conflict in favour of one side. */
export function keepSide(conflicts: Conflict[], side: Side): Resolutions {
    return Object.fromEntries(conflicts.map(conflict => [conflict.key, side]));
}

/** Test data for the sync core: repeatable workspaces of any size. Not shipped. */
import { BUILTIN_PROVIDERS, DEFAULT_PREFS, emptyState } from '../core/defaults';
import type { AppState, Item, Space } from '../core/types';
import { toSyncable, type SyncDoc } from './scope';

/** Small repeatable generator (mulberry32), so sizes measured today are the sizes measured tomorrow. */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const WORDS = ['mail', 'docs', 'board', 'status', 'cloud', 'notes', 'design', 'billing', 'admin', 'wiki', 'metrics', 'deploy', 'inbox', 'calendar', 'tasks', 'reports', 'review', 'music', 'video', 'news', 'forum', 'shop', 'bank', 'travel', 'photos', 'learn', 'radio', 'maps', 'jobs', 'code'];
const TLDS = ['com', 'io', 'app', 'dev', 'org', 'net', 'co', 'com.tr'];

export interface WorkspaceShape {
    links: number;
    spaces?: number;
    /** Characters of (incompressible) embedded icon; 0 for none. */
    iconBytes?: number;
    /** Share of links that carry such an icon. 1 when not given. */
    iconShare?: number;
    /** Extra characters of path on every address, as deep links and query strings have. */
    longAddresses?: number;
}

/** A setup shaped like a real one: named Spaces, two groups each, links with mixed titles and addresses. */
export function workspace({ links, spaces = Math.max(1, Math.ceil(links / 25)), iconBytes = 0, iconShare = 1, longAddresses = 0 }: WorkspaceShape, seed = 1): AppState {
    const next = seededRandom(seed);
    const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
    const hex = (length: number) => Array.from({ length }, () => Math.floor(next() * 16).toString(16)).join('');
    const noise = (length: number) => Array.from({ length }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'[Math.floor(next() * 64)]).join('');
    const state = emptyState();
    state.providers = BUILTIN_PROVIDERS.map(provider => ({ ...provider }));
    state.prefs = { ...DEFAULT_PREFS };
    const created: Space[] = [];
    for (let i = 0; i < spaces; i++) {
        const id = hex(12);
        const space: Space = { id, name: `${pick(WORDS)} ${pick(WORDS)}`, glyph: pick(WORDS)[0]!.toUpperCase(), accent: `#${hex(6)}`, groups: [{ id: hex(12), name: '', itemIds: [] }, { id: hex(12), name: pick(WORDS), itemIds: [] }], createdAt: 1_700_000_000_000 + i };
        state.spaces[id] = space;
        state.spaceOrder.push(id);
        created.push(space);
    }
    for (let i = 0; i < links; i++) {
        const host = `${pick(WORDS)}${next() < 0.4 ? `-${pick(WORDS)}` : ''}.${pick(WORDS)}${Math.floor(next() * 90)}.${pick(TLDS)}`;
        const path = next() < 0.5 ? '' : `/${pick(WORDS)}/${hex(6)}`;
        const item: Item = {
            id: hex(12),
            title: `${pick(WORDS)} ${pick(WORDS)}${next() < 0.3 ? ` — ${pick(WORDS)}` : ''}`.replace(/^./, c => c.toUpperCase()),
            url: `https://${host}${path}${longAddresses ? `?ref=${noise(longAddresses)}` : ''}`,
            createdAt: 1_700_000_000_000 + Math.floor(next() * 50_000_000_000),
            ...(iconBytes && next() < iconShare ? { icon: `data:image/webp;base64,${noise(Math.max(0, iconBytes - 23))}` } : next() < 0.15 ? { icon: pick(['📁', '⭐', '🔥', '💼', '🎧']) } : {}),
        };
        state.items[item.id] = item;
        created[i % spaces]!.groups[i % 2]!.itemIds.push(item.id);
    }
    state.dock = Object.keys(state.items).slice(0, 8).map(id => ({ kind: 'item' as const, id }));
    return state;
}

export const workspaceDoc = (shape: WorkspaceShape, seed = 1): SyncDoc => toSyncable(workspace(shape, seed));

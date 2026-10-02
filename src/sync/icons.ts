/**
 * Size policy for icons stored inside links (Senuma 2.1, phase 1: not used by the product yet).
 *
 * A link's icon may be an image embedded as a `data:` URL. Such data barely compresses, so
 * without a limit a few of them would fill the synced workspace. The policy:
 *
 *   - one embedded icon is at most ICON_CAP characters;
 *   - all embedded icons together are at most ICON_TOTAL characters;
 *   - an icon over a limit is re-encoded smaller when a re-encoder is available, and otherwise
 *     dropped, which means the link shows its site's own icon like any other link;
 *   - nothing is ever cut short: an icon is kept whole, replaced by a complete smaller image,
 *     or removed.
 *
 * `settleIcon` is for the moment a link is saved, `settleIcons` for data coming in (an import, a
 * backup, an older setup), and `capIcons` is the guard on what sync uploads: it needs no
 * re-encoder, so the limits hold even where pictures cannot be decoded.
 */
import type { ID, Item } from '../core/types';

/** Largest embedded icon, as stored (the whole `data:` URL). */
export const ICON_CAP = 32 * 1024;
/** Largest sum of all embedded icons in one workspace: a quarter of the 512 kB document limit before encryption. */
export const ICON_TOTAL = 128 * 1024;
/** Longest icon that is not an embedded image (an emoji or an image address). */
export const ICON_REFERENCE_MAX = 2048;

/**
 * Produces a complete, smaller image of at most `maxLength` characters as a `data:` URL, or null
 * when it cannot. The browser implementation is in iconEncode.ts.
 */
export type Reencode = (dataUrl: string, maxLength: number) => Promise<string | null>;

export const isEmbedded = (icon: string | undefined): boolean => !!icon && /^data:/i.test(icon);
const embeddedLength = (icon: string | undefined): number => (icon && isEmbedded(icon) ? icon.length : 0);
const isEmbeddedImage = (icon: string): boolean => /^data:image\/[a-z0-9.+-]+[;,]/i.test(icon);

/** Characters of embedded image data held by a set of links. */
export function embeddedTotal(items: Record<ID, Item>): number {
    return Object.values(items).reduce((sum, item) => sum + embeddedLength(item.icon), 0);
}

/** Whether an icon may be stored as it is, given how much room for embedded images is left. */
export function iconFits(icon: string | undefined, room = ICON_CAP): boolean {
    if (!icon) return true;
    if (!isEmbedded(icon)) return icon.length <= ICON_REFERENCE_MAX;
    return isEmbeddedImage(icon) && icon.length <= Math.min(ICON_CAP, room);
}

/**
 * The icon to store when a link is saved. Returns the icon unchanged when it fits, a re-encoded
 * one when that fits, and otherwise undefined (the link then uses its site's icon).
 */
export async function settleIcon(icon: string | undefined, options: { reencode?: Reencode; room?: number } = {}): Promise<string | undefined> {
    const value = icon?.trim();
    if (!value) return undefined;
    const limit = Math.max(0, Math.min(ICON_CAP, options.room ?? ICON_CAP));
    if (iconFits(value, limit)) return value;
    if (!isEmbedded(value) || !isEmbeddedImage(value) || !options.reencode) return undefined;
    const smaller = await options.reencode(value, limit).catch(() => null);
    // A re-encoder is not trusted to keep its promise: its result is checked like any other icon.
    return smaller && isEmbedded(smaller) && iconFits(smaller, limit) ? smaller : undefined;
}

/** Oldest links first, so that adding a link never takes an icon away from an earlier one. */
const byAge = (a: Item, b: Item) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export interface IconReport {
    /** Links whose icon was replaced by a smaller image. */
    reencoded: ID[];
    /** Links whose icon was removed; they show their site's icon. */
    dropped: ID[];
}

/** Applies the policy to data that already exists: an import, a restored backup, a setup from before the policy. */
export async function settleIcons<T extends { items: Record<ID, Item> }>(holder: T, reencode?: Reencode): Promise<{ value: T; report: IconReport }> {
    const items: Record<ID, Item> = { ...holder.items };
    const report: IconReport = { reencoded: [], dropped: [] };
    let room = ICON_TOTAL;
    for (const item of Object.values(holder.items).sort(byAge)) {
        if (!item.icon) continue;
        const settled = await settleIcon(item.icon, { reencode, room });
        room -= embeddedLength(settled);
        if (settled === item.icon) continue;
        const rest = { ...item };
        delete rest.icon;
        items[item.id] = settled ? { ...rest, icon: settled } : rest;
        (settled ? report.reencoded : report.dropped).push(item.id);
    }
    return { value: report.reencoded.length || report.dropped.length ? { ...holder, items } : holder, report };
}

/**
 * The same limits without re-encoding: anything over them is removed. This is what sync applies
 * to every copy it uploads, so no state, however it came to exist, can exceed the policy there.
 */
export function capIcons<T extends { items: Record<ID, Item> }>(holder: T): { value: T; dropped: ID[] } {
    const items: Record<ID, Item> = { ...holder.items };
    const dropped: ID[] = [];
    let room = ICON_TOTAL;
    for (const item of Object.values(holder.items).sort(byAge)) {
        if (!item.icon) continue;
        if (iconFits(item.icon, room)) {
            room -= embeddedLength(item.icon);
            continue;
        }
        const rest = { ...item };
        delete rest.icon;
        items[item.id] = rest;
        dropped.push(item.id);
    }
    return { value: dropped.length ? { ...holder, items } : holder, dropped };
}

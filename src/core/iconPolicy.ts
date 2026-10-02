/**
 * Size policy for icons stored inside links.
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
 * This file is the part every page load needs: the limits, the checks, and `capIcons`, which
 * enforces them without decoding pictures. Re-encoding (`settleIcon` when a link is saved,
 * `settleIcons` for data coming in) is in iconSettle.ts and is loaded only where it is used.
 */
import type { ID, Item } from './types';

/** Largest embedded icon, as stored (the whole `data:` URL). */
export const ICON_CAP = 32 * 1024;
/** Largest sum of all embedded icons in one workspace: a quarter of the 512 kB document limit before encryption. */
export const ICON_TOTAL = 128 * 1024;
/** Longest icon that is not an embedded image (an emoji or an image address). */
export const ICON_REFERENCE_MAX = 2048;

/**
 * Produces a complete, smaller image of at most `maxLength` characters as a `data:` URL, or null
 * when it cannot. The browser implementation is in browser/iconEncode.ts.
 */
export type Reencode = (dataUrl: string, maxLength: number) => Promise<string | null>;

export const isEmbedded = (icon: string | undefined): boolean => !!icon && /^data:/i.test(icon);
export const embeddedLength = (icon: string | undefined): number => (icon && isEmbedded(icon) ? icon.length : 0);
export const isEmbeddedImage = (icon: string): boolean => /^data:image\/[a-z0-9.+-]+[;,]/i.test(icon);

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

/** Oldest links first, so that adding a link never takes an icon away from an earlier one. */
export const byAge = (a: Item, b: Item) => a.createdAt - b.createdAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

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

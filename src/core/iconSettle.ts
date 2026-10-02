/**
 * The icon limits with re-encoding: an icon over a limit is replaced by a complete smaller image
 * when one can be made, and removed otherwise. Loaded only where that can happen (the link
 * editor, imports, the pass over an older setup); the limits themselves are in iconPolicy.ts.
 */
import { ICON_CAP, ICON_TOTAL, byAge, embeddedLength, iconFits, isEmbedded, isEmbeddedImage, type Reencode } from './iconPolicy';
import type { ID, Item } from './types';

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

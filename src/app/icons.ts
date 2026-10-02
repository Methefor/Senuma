/**
 * The icon limits where a page is available to re-encode pictures: saving a link, importing
 * data, and loading a setup from before the limits. The service worker never does this.
 * The encoder is loaded only when a picture actually has to be made smaller.
 */
import { ICON_TOTAL, capIcons, embeddedTotal, iconFits, isEmbedded, settleIcon, settleIcons } from '../core/iconPolicy';
import type { ValidationReport } from '../core/limits';
import type { AppState, ID } from '../core/types';

const encoder = () => import('../browser/iconEncode').then(module => module.reencodeIcon);

/** The icon to save for a link being added or edited. `fellBack` means it could not be kept and the site's icon will be used. */
export async function prepareIcon(icon: string, state: AppState, editingId?: ID): Promise<{ icon: string; fellBack: boolean }> {
    const value = icon.trim();
    const current = editingId ? state.items[editingId]?.icon : undefined;
    // The icon being replaced gives its room back.
    const room = ICON_TOTAL - embeddedTotal(state.items) + (current && isEmbedded(current) ? current.length : 0);
    if (iconFits(value, room)) return { icon: value, fellBack: false };
    const settled = await settleIcon(value, { reencode: await encoder(), room });
    return { icon: settled ?? '', fellBack: !settled };
}

/** Brings a whole setup within the icon limits, re-encoding where that helps. Counts into `report`. */
export async function settleSetup(state: AppState, report?: ValidationReport): Promise<AppState> {
    if (capIcons(state).dropped.length === 0) return state;
    const settled = await settleIcons(state, await encoder().catch(() => undefined));
    if (report) {
        report.iconsReencoded += settled.report.reencoded.length;
        report.iconsDropped += settled.report.dropped.length;
    }
    return settled.value;
}

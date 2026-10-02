/**
 * Carries a picture that 1.x kept inside its own data over to the wallpaper library, once,
 * right after the upgrade. The 1.x data is only read. If anything fails (an unreadable
 * picture, no room in storage) the theme background simply stays; nothing is lost, because
 * the original is still where 1.x left it.
 */
import { STORAGE_KEYS } from '../brand';
import { putWallpaper } from '../browser/assets';
import { inExtension } from '../browser/result';
import { DEFAULT_BACKGROUND } from '../core/background';
import { newId } from '../core/defaults';
import { legacyBackground } from '../core/legacy';
import { addWallpaper, setPrefs } from '../core/ops';
import { processImage } from '../features/background/processImage';
import { update } from '../storage/store';

export async function migrateLegacyPicture(): Promise<boolean> {
    if (!inExtension) return false;
    try {
        const stored = await chrome.storage.local.get(STORAGE_KEYS.legacyData);
        const plan = legacyBackground((stored[STORAGE_KEYS.legacyData] as { background?: unknown } | undefined)?.background);
        if (plan?.kind !== 'image') return false;
        const blob = await (await fetch(plan.dataUrl)).blob();
        const processed = await processImage(new File([blob], 'New Tab Folders', { type: blob.type }));
        if (!processed.ok) return false;
        const id = newId();
        if (!(await putWallpaper(id, processed.full, processed.thumb)).ok) return false;
        update(state => setPrefs(addWallpaper(state, { ...processed.meta, id, createdAt: Date.now() }), {
            background: { ...DEFAULT_BACKGROUND, source: { kind: 'upload', assetId: id }, dim: plan.dim, blur: plan.blur },
        }));
        return true;
    } catch {
        return false;
    }
}

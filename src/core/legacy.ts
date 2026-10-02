/**
 * What is carried over from New Tab Folders 1.x beyond Spaces and links: the background.
 * Pure; nothing here touches storage or network.
 */
import { BACKGROUND_LIMITS, DEFAULT_BACKGROUND, type Background } from './background';
import { isDict } from './sanitize';

// ---------- Background ----------

const HEX = /^#[\da-f]{6}$/i;
const GRADIENT = /^linear-gradient\(\s*(\d{1,3})deg\s*,\s*(#[\da-f]{6})[^,]*,(?:.*,)?\s*(#[\da-f]{6})[^,)]*\)$/i;
const RASTER_DATA_URL = /^data:image\/(png|jpeg|webp|avif);base64,/i;

export type LegacyBackground =
    /** Can be applied as it is. */
    | { kind: 'ready'; background: Background }
    /** A picture stored inside the 1.x data; it has to be decoded and saved before use. */
    | { kind: 'image'; dataUrl: string; dim: number; blur: number }
    /** A picture at a web address. Senuma does not load backgrounds from the web, so it is not carried over. */
    | { kind: 'remote' }
    | null;

/** Reads the 1.8 `background` field ({ type, value, overlay 0–80, blur 0–10 }). */
export function legacyBackground(raw: unknown): LegacyBackground {
    if (!isDict(raw) || typeof raw.value !== 'string') return null;
    const dim = Math.min(BACKGROUND_LIMITS.dim, Math.max(0, (typeof raw.overlay === 'number' ? raw.overlay : 0) / 100));
    const blur = Math.min(BACKGROUND_LIMITS.blur, Math.max(0, typeof raw.blur === 'number' ? raw.blur : 0));
    const tuned = { ...DEFAULT_BACKGROUND, dim, blur };
    if (raw.type === 'color' && HEX.test(raw.value)) return { kind: 'ready', background: { ...tuned, source: { kind: 'solid', color: raw.value } } };
    if (raw.type === 'gradient') {
        const match = GRADIENT.exec(raw.value.trim());
        return match ? { kind: 'ready', background: { ...tuned, source: { kind: 'gradient', from: match[2]!, to: match[3]!, angle: Math.min(360, Number(match[1])) } } } : null;
    }
    if (raw.type === 'image') return RASTER_DATA_URL.test(raw.value) ? { kind: 'image', dataUrl: raw.value, dim, blur } : { kind: 'remote' };
    return null;
}

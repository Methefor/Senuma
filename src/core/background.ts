/**
 * Background model. A background is a source (where the picture comes from) plus a few
 * adjustments (how it is placed and toned). Rendering lives in features/background; this
 * file is the data, its validation, and the curated presets.
 *
 * Adding a source kind later (video, cinemagraph, animated ambient) means one more member
 * of `BackgroundSource` and one more renderer. Nothing that stores or validates has to change.
 */
import type { ID } from './types';

export type BackgroundSource =
    /** The active theme's own backdrop. */
    | { kind: 'theme' }
    | { kind: 'solid'; color: string }
    | { kind: 'gradient'; from: string; to: string; angle: number }
    /** A curated wallpaper shipped with the product. */
    | { kind: 'preset'; id: string }
    /** An image the user added; the pixels live in local browser storage, keyed by `assetId`. */
    | { kind: 'upload'; assetId: ID };

export type BackgroundFit = 'cover' | 'contain';

export interface Background {
    source: BackgroundSource;
    fit: BackgroundFit;
    /** Focal point in percent; which part of the picture stays visible when it is cropped. */
    x: number;
    y: number;
    /** Pixels of blur applied to the picture. */
    blur: number;
    /** 0–1: how strongly the theme's wash covers the picture. Higher is calmer and more readable. */
    dim: number;
    /** 0–2, 1 = unchanged. */
    saturation: number;
}

export const DEFAULT_BACKGROUND: Background = { source: { kind: 'theme' }, fit: 'cover', x: 50, y: 50, blur: 0, dim: 0.38, saturation: 1 };

export const BACKGROUND_LIMITS = { blur: 40, dim: 0.9, saturation: 2 } as const;

/** What is kept in saved state about an uploaded image. The pixels are stored separately. */
export interface WallpaperAsset {
    id: ID;
    name: string;
    width: number;
    height: number;
    bytes: number;
    /** Average colour, painted instantly while the picture decodes. */
    color: string;
    /** 0 (black) – 1 (white): average brightness, used to choose a sensible default dim. */
    luminance: number;
    /** A few hundred bytes of blurred preview (data URL), shown before the full picture. */
    lqip: string;
    createdAt: number;
}

export const MAX_WALLPAPERS = 8;

export type AtmosphereLevel = 'off' | 'subtle' | 'cinematic';
export const ATMOSPHERE_LEVELS: readonly AtmosphereLevel[] = ['off', 'subtle', 'cinematic'];
/** Multiplier applied to every theme atmosphere token. */
export const ATMOSPHERE_STRENGTH: Record<AtmosphereLevel, number> = { off: 0, subtle: 0.55, cinematic: 1 };

// ---------- Curated presets ----------

export type WallpaperCategory = 'cinematic' | 'nature' | 'architecture' | 'abstract' | 'minimal' | 'dark' | 'light';

export interface WallpaperPreset {
    id: string;
    name: string;
    categories: WallpaperCategory[];
    /** Painted first and used as the fallback colour. */
    color: string;
    luminance: number;
    /** A CSS background (zero bytes shipped) … */
    css?: string;
    /** … or a bundled image file. Photographic sets (nature, architecture) will use this. */
    src?: string;
}

/**
 * The starter set is drawn entirely in CSS, so it adds nothing to the package and nothing to
 * decode. Photographic categories exist in the model but ship empty for now.
 */
export const WALLPAPER_PRESETS: readonly WallpaperPreset[] = [
    {
        id: 'aurora', name: 'Aurora', categories: ['cinematic', 'dark'], color: '#07101c', luminance: 0.08,
        css: 'radial-gradient(60% 50% at 22% 28%, rgba(64,224,196,.42) 0%, transparent 70%), radial-gradient(55% 60% at 78% 18%, rgba(124,92,255,.42) 0%, transparent 70%), radial-gradient(90% 60% at 50% 110%, rgba(30,120,160,.5) 0%, transparent 70%), linear-gradient(180deg, #050a14 0%, #0a1524 100%)',
    },
    {
        id: 'ember', name: 'Ember', categories: ['cinematic', 'dark'], color: '#160c0a', luminance: 0.09,
        css: 'radial-gradient(120% 60% at 50% 112%, rgba(255,120,60,.62) 0%, rgba(190,50,60,.34) 32%, transparent 68%), radial-gradient(40% 30% at 80% 12%, rgba(255,190,120,.16) 0%, transparent 70%), linear-gradient(180deg, #0c0808 0%, #1a0f0d 100%)',
    },
    {
        id: 'signal', name: 'Signal', categories: ['abstract', 'dark'], color: '#0d0a1e', luminance: 0.1,
        css: 'conic-gradient(from 210deg at 68% 42%, rgba(255,70,160,.42), rgba(70,110,255,.42), rgba(20,200,220,.22), rgba(255,70,160,.42)), linear-gradient(180deg, #0a0818 0%, #120c26 100%)',
    },
    {
        id: 'ink', name: 'Ink', categories: ['minimal', 'dark'], color: '#0a0b0f', luminance: 0.05,
        css: 'radial-gradient(80% 70% at 50% 0%, rgba(90,110,160,.22) 0%, transparent 70%), linear-gradient(180deg, #08090c 0%, #0d0f14 100%)',
    },
    {
        id: 'tide', name: 'Tide', categories: ['abstract', 'dark'], color: '#0b2233', luminance: 0.16,
        css: 'radial-gradient(100% 80% at 0% 100%, rgba(40,160,170,.55) 0%, transparent 60%), radial-gradient(80% 70% at 100% 0%, rgba(40,90,170,.6) 0%, transparent 65%), linear-gradient(135deg, #0a1a2b 0%, #0f3140 100%)',
    },
    {
        id: 'dune', name: 'Dune', categories: ['minimal', 'light'], color: '#e7d9c4', luminance: 0.84,
        css: 'radial-gradient(120% 70% at 30% 110%, rgba(196,150,104,.55) 0%, transparent 62%), radial-gradient(90% 60% at 90% 0%, rgba(255,246,230,.9) 0%, transparent 70%), linear-gradient(180deg, #efe4d2 0%, #dccab0 100%)',
    },
    {
        id: 'mist', name: 'Mist', categories: ['minimal', 'light'], color: '#dfe6ea', luminance: 0.88,
        css: 'radial-gradient(100% 60% at 50% 100%, rgba(255,255,255,.95) 0%, transparent 70%), radial-gradient(70% 50% at 15% 10%, rgba(170,196,214,.6) 0%, transparent 70%), linear-gradient(180deg, #cfdbe2 0%, #eceff0 100%)',
    },
    {
        id: 'bloom', name: 'Bloom', categories: ['abstract', 'light'], color: '#f0d9d6', luminance: 0.86,
        css: 'radial-gradient(60% 55% at 20% 30%, rgba(255,170,150,.6) 0%, transparent 70%), radial-gradient(60% 60% at 82% 70%, rgba(190,170,255,.55) 0%, transparent 70%), linear-gradient(180deg, #f6e9e2 0%, #ecdfe8 100%)',
    },
];

export function presetById(id: string): WallpaperPreset | undefined {
    return WALLPAPER_PRESETS.find(p => p.id === id);
}

// ---------- Validation ----------

const HEX = /^#[\da-f]{6}$/i;
const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

function sanitizeSource(raw: unknown, assets: Record<ID, unknown>): BackgroundSource {
    if (typeof raw !== 'object' || raw === null) return { kind: 'theme' };
    const s = raw as Record<string, unknown>;
    switch (s.kind) {
        case 'solid':
            return typeof s.color === 'string' && HEX.test(s.color) ? { kind: 'solid', color: s.color } : { kind: 'theme' };
        case 'gradient':
            return typeof s.from === 'string' && HEX.test(s.from) && typeof s.to === 'string' && HEX.test(s.to)
                ? { kind: 'gradient', from: s.from, to: s.to, angle: clamp(s.angle, 0, 360, 180) }
                : { kind: 'theme' };
        case 'preset':
            return typeof s.id === 'string' && presetById(s.id) ? { kind: 'preset', id: s.id } : { kind: 'theme' };
        case 'upload':
            // A reference to an image that is not in the library can never be shown.
            return typeof s.assetId === 'string' && s.assetId in assets ? { kind: 'upload', assetId: s.assetId } : { kind: 'theme' };
        default:
            return { kind: 'theme' };
    }
}

export function sanitizeBackground(raw: unknown, assets: Record<ID, unknown>): Background {
    const b = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    return {
        source: sanitizeSource(b.source, assets),
        fit: b.fit === 'contain' ? 'contain' : 'cover',
        x: clamp(b.x, 0, 100, DEFAULT_BACKGROUND.x),
        y: clamp(b.y, 0, 100, DEFAULT_BACKGROUND.y),
        blur: clamp(b.blur, 0, BACKGROUND_LIMITS.blur, DEFAULT_BACKGROUND.blur),
        dim: clamp(b.dim, 0, BACKGROUND_LIMITS.dim, DEFAULT_BACKGROUND.dim),
        saturation: clamp(b.saturation, 0, BACKGROUND_LIMITS.saturation, DEFAULT_BACKGROUND.saturation),
    };
}

export function sanitizeWallpapers(raw: unknown): Record<ID, WallpaperAsset> {
    const assets: Record<ID, WallpaperAsset> = {};
    if (typeof raw !== 'object' || raw === null) return assets;
    for (const [id, value] of Object.entries(raw as Record<string, unknown>).slice(0, MAX_WALLPAPERS)) {
        if (!/^[\w-]{1,64}$/.test(id) || typeof value !== 'object' || value === null) continue;
        const a = value as Record<string, unknown>;
        // The preview is rendered as an image source, so only an inline raster image is accepted.
        const lqip = typeof a.lqip === 'string' && /^data:image\/(jpeg|webp|png);base64,[\w+/=]+$/.test(a.lqip) && a.lqip.length < 8000 ? a.lqip : '';
        assets[id] = {
            id,
            name: typeof a.name === 'string' ? a.name.slice(0, 80) : 'Image',
            width: clamp(a.width, 1, 20000, 1),
            height: clamp(a.height, 1, 20000, 1),
            bytes: clamp(a.bytes, 0, Number.MAX_SAFE_INTEGER, 0),
            color: typeof a.color === 'string' && HEX.test(a.color) ? a.color : '#101014',
            luminance: clamp(a.luminance, 0, 1, 0.2),
            lqip,
            createdAt: clamp(a.createdAt, 0, Number.MAX_SAFE_INTEGER, 0),
        };
    }
    return assets;
}

/** Identifies what is being shown, so the renderer can tell a new picture from a re-tune. */
export function sourceKey(source: BackgroundSource): string {
    switch (source.kind) {
        case 'theme': return 'theme';
        case 'solid': return `solid:${source.color}`;
        case 'gradient': return `gradient:${source.from}:${source.to}:${source.angle}`;
        case 'preset': return `preset:${source.id}`;
        case 'upload': return `upload:${source.assetId}`;
    }
}

/**
 * A dim that keeps text readable for a picture of the given brightness under a theme of the
 * given scheme: a bright photo under a dark theme needs more wash than a dark one.
 */
export function suggestedDim(luminance: number, scheme: 'dark' | 'light', curated = false): number {
    const mismatch = scheme === 'dark' ? luminance : 1 - luminance;
    // Curated presets are drawn to be read over, so only a mismatch with the theme needs wash.
    const base = curated ? 0.04 : 0.25;
    return Math.round((base + mismatch * 0.45) * 100) / 100;
}

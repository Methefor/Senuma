/**
 * Turns a file the user picked into a wallpaper: validated, resized to what a screen can
 * show, re-encoded, and summarised. Runs entirely in the page; nothing is uploaded.
 */
import type { WallpaperAsset } from '../../core/background';

/** Raster formats only. SVG is excluded: it is a document, not a picture. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
/** Larger files are refused before decoding, which is what actually costs memory. */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
/** Longest edge kept. Enough for a 2560-wide display; a 6000 px photo gains nothing here. */
const MAX_EDGE = 2560;
const THUMB_EDGE = 360;
const LQIP_EDGE = 24;
const SAMPLE_EDGE = 16;

export type ImageFailure = 'type' | 'size' | 'decode' | 'encode';

export type ProcessedImage =
    | { ok: true; full: Blob; thumb: Blob; meta: Omit<WallpaperAsset, 'id' | 'createdAt'> }
    | { ok: false; reason: ImageFailure };

function draw(bitmap: ImageBitmap, edge: number): OffscreenCanvas {
    const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
    const context = canvas.getContext('2d')!;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas;
}

function toDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}

const hex = (value: number) => Math.round(value).toString(16).padStart(2, '0');

export async function processImage(file: File): Promise<ProcessedImage> {
    if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) return { ok: false, reason: 'type' };
    if (file.size > MAX_INPUT_BYTES) return { ok: false, reason: 'size' };

    let bitmap: ImageBitmap;
    try {
        // Decoding is the real validation: a renamed or corrupt file fails here, whatever its type says.
        bitmap = await createImageBitmap(file);
    } catch {
        return { ok: false, reason: 'decode' };
    }

    try {
        const fullCanvas = draw(bitmap, MAX_EDGE);
        const [full, thumb, lqipBlob] = await Promise.all([
            fullCanvas.convertToBlob({ type: 'image/webp', quality: 0.86 }),
            draw(bitmap, THUMB_EDGE).convertToBlob({ type: 'image/webp', quality: 0.8 }),
            draw(bitmap, LQIP_EDGE).convertToBlob({ type: 'image/jpeg', quality: 0.5 }),
        ]);

        const sample = draw(bitmap, SAMPLE_EDGE);
        const pixels = sample.getContext('2d')!.getImageData(0, 0, sample.width, sample.height).data;
        let r = 0;
        let g = 0;
        let b = 0;
        const count = pixels.length / 4;
        for (let i = 0; i < pixels.length; i += 4) {
            r += pixels[i]!;
            g += pixels[i + 1]!;
            b += pixels[i + 2]!;
        }
        r /= count;
        g /= count;
        b /= count;

        return {
            ok: true,
            full,
            thumb,
            meta: {
                name: file.name.replace(/\.[^.]+$/, '').slice(0, 80) || 'Image',
                width: fullCanvas.width,
                height: fullCanvas.height,
                bytes: full.size,
                color: `#${hex(r)}${hex(g)}${hex(b)}`,
                luminance: Math.round(((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100) / 100,
                lqip: await toDataUrl(lqipBlob),
            },
        };
    } catch {
        return { ok: false, reason: 'encode' };
    } finally {
        bitmap.close();
    }
}

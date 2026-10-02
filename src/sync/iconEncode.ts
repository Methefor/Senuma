/**
 * Re-encodes an embedded icon smaller, in the browser (Senuma 2.1, phase 1: not used by the
 * product yet). Icons are shown at 64 CSS pixels at most, so 128 pixels keeps them sharp on
 * dense screens; smaller sizes are tried only when that does not fit. Nothing leaves the page.
 */
import type { Reencode } from './icons';

/** Largest edge, then quality: the first combination that fits is used, so quality falls only as far as it must. */
const SIZES = [128, 96, 64, 48] as const;
const ENCODINGS: readonly [type: string, quality?: number][] = [['image/webp', 0.9], ['image/webp', 0.7], ['image/png']];

async function decode(dataUrl: string): Promise<ImageBitmap | HTMLImageElement> {
    const comma = dataUrl.indexOf(',');
    const head = dataUrl.slice(5, comma);
    const body = dataUrl.slice(comma + 1);
    const bytes = /;base64/i.test(head) ? Uint8Array.from(atob(body), char => char.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(body));
    const blob = new Blob([bytes], { type: head.split(';')[0] });
    try {
        return await createImageBitmap(blob);
    } catch (error) {
        // Vector images cannot be decoded that way; an image element can, where one exists.
        if (typeof Image === 'undefined') throw error;
        const image = new Image();
        const url = URL.createObjectURL(blob);
        try {
            image.src = url;
            await image.decode();
            return image;
        } finally {
            URL.revokeObjectURL(url);
        }
    }
}

async function toDataUrl(blob: Blob): Promise<string> {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    return `data:${blob.type};base64,${btoa(binary)}`;
}

export const reencodeIcon: Reencode = async (dataUrl, maxLength) => {
    const picture = await decode(dataUrl);
    const width = picture.width || 128;
    const height = picture.height || 128;
    for (const edge of SIZES) {
        // Never enlarged: a small picture that is merely stored wastefully keeps its own size.
        const scale = Math.min(1, edge / Math.max(width, height));
        const canvas = new OffscreenCanvas(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)));
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.imageSmoothingQuality = 'high';
        context.drawImage(picture, 0, 0, canvas.width, canvas.height);
        for (const [type, quality] of ENCODINGS) {
            const encoded = await toDataUrl(await canvas.convertToBlob({ type, quality }));
            if (encoded.length <= maxLength) return encoded;
        }
    }
    return null;
};

// One-off content pipeline, step 2 of 2: turn the fetched photographs into production assets.
//
// Each image is decoded and re-encoded in a real browser engine (the same one that will
// display it), which strips all metadata. Nothing is cropped, nothing is upscaled. Output:
//   src/assets/wallpapers/<id>.webp        full picture, at most 2560 px wide
//   src/assets/wallpapers/<id>.thumb.webp  gallery preview, 480 px wide
//   docs/wallpapers.json                    provenance + sizes, the source for ASSET_LICENSES.md
//
//   node scripts/wallpapers-encode.mjs <scratch-dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const FULL_MAX_WIDTH = 2560;
const THUMB_WIDTH = 480;
/** High enough that fog and night-sky gradients do not band; not so high that size doubles. */
const FULL_QUALITY = 0.86;
const THUMB_QUALITY = 0.78;
const OUT = 'src/assets/wallpapers';

const scratch = process.argv[2];
if (!scratch) throw new Error('usage: node scripts/wallpapers-encode.mjs <scratch-dir>');
const provenance = JSON.parse(readFileSync(join(scratch, 'provenance.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
const results = [];
for (const asset of provenance) {
    const source = readFileSync(join(scratch, `${asset.id}.jpg`));
    const encoded = await page.evaluate(async ({ base64, fullMax, thumbWidth, fullQuality, thumbQuality }) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${base64}`)).blob());
        const render = async (width, quality) => {
            const scale = Math.min(1, width / bitmap.width); // never upscale
            const canvas = new OffscreenCanvas(Math.round(bitmap.width * scale), Math.round(bitmap.height * scale));
            const context = canvas.getContext('2d');
            context.imageSmoothingQuality = 'high';
            context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            const blob = await canvas.convertToBlob({ type: 'image/webp', quality });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = '';
            for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
            return { width: canvas.width, height: canvas.height, base64: btoa(binary) };
        };
        // Same summary the app computes for uploads: average colour and brightness.
        const sample = new OffscreenCanvas(16, Math.max(1, Math.round((16 * bitmap.height) / bitmap.width)));
        sample.getContext('2d').drawImage(bitmap, 0, 0, sample.width, sample.height);
        const pixels = sample.getContext('2d').getImageData(0, 0, sample.width, sample.height).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < pixels.length; i += 4) { r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; }
        const n = pixels.length / 4;
        r /= n; g /= n; b /= n;
        const hex = v => Math.round(v).toString(16).padStart(2, '0');
        return {
            full: await render(fullMax, fullQuality),
            thumb: await render(thumbWidth, thumbQuality),
            color: `#${hex(r)}${hex(g)}${hex(b)}`,
            luminance: Math.round(((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) * 100) / 100,
            sourceWidth: bitmap.width,
            sourceHeight: bitmap.height,
        };
    }, { base64: source.toString('base64'), fullMax: FULL_MAX_WIDTH, thumbWidth: THUMB_WIDTH, fullQuality: FULL_QUALITY, thumbQuality: THUMB_QUALITY });

    const full = Buffer.from(encoded.full.base64, 'base64');
    const thumb = Buffer.from(encoded.thumb.base64, 'base64');
    writeFileSync(join(OUT, `${asset.id}.webp`), full);
    writeFileSync(join(OUT, `${asset.id}.thumb.webp`), thumb);
    results.push({
        ...asset,
        color: encoded.color,
        luminance: encoded.luminance,
        production: { file: `${asset.id}.webp`, width: encoded.full.width, height: encoded.full.height, bytes: full.length, format: 'WebP', quality: FULL_QUALITY },
        preview: { file: `${asset.id}.thumb.webp`, width: encoded.thumb.width, height: encoded.thumb.height, bytes: thumb.length },
        modifications: `Resized from the ${encoded.sourceWidth}×${encoded.sourceHeight} rendition to ${encoded.full.width}×${encoded.full.height} (aspect ratio kept, no crop, no upscale); re-encoded as WebP at quality ${FULL_QUALITY}; metadata removed.`,
    });
    console.log(`${asset.id.padEnd(16)} ${encoded.full.width}×${encoded.full.height}  full ${(full.length / 1024).toFixed(0).padStart(4)} kB  thumb ${(thumb.length / 1024).toFixed(0).padStart(3)} kB  colour ${encoded.color}  luminance ${encoded.luminance}`);
}
await browser.close();
writeFileSync('docs/wallpapers.json', JSON.stringify(results, null, 2));
const total = results.reduce((sum, r) => sum + r.production.bytes + r.preview.bytes, 0);
console.log(`\npack total: ${(total / 1024 / 1024).toFixed(2)} MB (full + previews)`);

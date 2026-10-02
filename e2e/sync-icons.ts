/**
 * The icon re-encoder (src/sync/iconEncode.ts) in a real browser engine: it needs canvas and
 * image decoding, which the unit tests cannot provide.
 *
 *   npx vite-node e2e/sync-icons.ts
 *
 * Senuma 2.1 work; the 2.0 product does not load this code.
 */
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { ICON_CAP } from '../src/sync/icons';
import { check, expect, report } from './harness';

const bundle = await build({ entryPoints: ['src/sync/iconEncode.ts'], bundle: true, format: 'iife', globalName: 'iconEncode', write: false, target: 'chrome120' });
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><title>icons</title>');
await page.addScriptTag({ content: bundle.outputFiles[0]!.text });

interface Result { original: number; encoded: number | null; type: string; width: number; height: number; difference: number }

/** Draws a picture in the page, re-encodes it, and measures the result against the original at icon size. */
const run = (kind: 'logo' | 'noise' | 'wide' | 'vector', max: number): Promise<Result> => page.evaluate(async ({ kind, max }) => {
    const reencode = (window as unknown as { iconEncode: { reencodeIcon(url: string, max: number): Promise<string | null> } }).iconEncode.reencodeIcon;
    let original: string;
    if (kind === 'vector') {
        const shapes = Array.from({ length: 900 }, (_, i) => `<rect x="${(i * 37) % 500}" y="${(i * 91) % 500}" width="40" height="40" fill="hsl(${i * 7},70%,50%)"/>`).join('');
        original = `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">${shapes}</svg>`)}`;
    } else {
        const canvas = document.createElement('canvas');
        canvas.width = kind === 'wide' ? 1600 : 1024;
        canvas.height = kind === 'wide' ? 800 : 1024;
        const context = canvas.getContext('2d')!;
        if (kind === 'noise') {
            const data = context.createImageData(canvas.width, canvas.height);
            for (let i = 0; i < data.data.length; i++) data.data[i] = i % 4 === 3 ? 255 : Math.floor(Math.random() * 256);
            context.putImageData(data, 0, 0);
        } else {
            const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
            gradient.addColorStop(0, '#1d3557');
            gradient.addColorStop(1, '#e63946');
            context.fillStyle = gradient;
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.fillStyle = '#f1faee';
            context.beginPath();
            context.arc(canvas.width / 2, canvas.height / 2, canvas.height / 3, 0, Math.PI * 2);
            context.fill();
            context.fillStyle = '#1d3557';
            context.font = `bold ${canvas.height / 3}px sans-serif`;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText('S', canvas.width / 2, canvas.height / 2);
            // Fine grain, as a photograph or a scanned logo has: this is what makes the stored file large.
            const data = context.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < data.data.length; i += 4) data.data[i] = Math.min(255, data.data[i]! + Math.floor(Math.random() * 6));
            context.putImageData(data, 0, 0);
        }
        original = canvas.toDataURL('image/png');
    }
    const encoded = await reencode(original, max);
    const load = async (url: string) => {
        const image = new Image();
        image.src = url;
        await image.decode();
        return image;
    };
    const at64 = (image: HTMLImageElement) => {
        const small = document.createElement('canvas');
        small.width = small.height = 64;
        const context = small.getContext('2d')!;
        context.drawImage(image, 0, 0, 64, 64);
        return context.getImageData(0, 0, 64, 64).data;
    };
    if (!encoded) return { original: original.length, encoded: null, type: '', width: 0, height: 0, difference: 0 };
    const [before, after] = [await load(original), await load(encoded)];
    const [a, b] = [at64(before), at64(after)];
    let total = 0;
    for (let i = 0; i < a.length; i++) total += Math.abs(a[i]! - b[i]!);
    return { original: original.length, encoded: encoded.length, type: encoded.slice(5, encoded.indexOf(';')), width: after.naturalWidth, height: after.naturalHeight, difference: total / a.length };
}, { kind, max });

const describe = (r: Result) => `${(r.original / 1024).toFixed(0)} kB → ${((r.encoded ?? 0) / 1024).toFixed(1)} kB ${r.type} ${r.width}×${r.height}, mean difference at 64 px ${r.difference.toFixed(1)} of 255`;

await check('Re-encoding', 'a large logo-like picture becomes a complete icon under the cap that looks the same at icon size', async () => {
    const r = await run('logo', ICON_CAP);
    expect(r.original > ICON_CAP, `the test picture is only ${r.original} characters`);
    expect(r.encoded !== null && r.encoded <= ICON_CAP, `result ${r.encoded}`);
    expect(Math.max(r.width, r.height) === 128, `size ${r.width}×${r.height}`);
    expect(r.difference < 6, `visibly different at icon size: ${r.difference}`);
    return describe(r);
});

await check('Re-encoding', 'a wide picture keeps its proportions', async () => {
    const r = await run('wide', ICON_CAP);
    expect(r.encoded !== null && r.encoded <= ICON_CAP && r.width === 128 && r.height === 64, describe(r));
    return describe(r);
});

await check('Re-encoding', 'the hardest case, pure noise, still ends under the cap or is refused whole', async () => {
    const r = await run('noise', ICON_CAP);
    expect(r.encoded === null || r.encoded <= ICON_CAP, `result ${r.encoded}`);
    return r.encoded === null ? 'refused (the link would use its site icon)' : describe(r);
});

await check('Re-encoding', 'a large vector picture is turned into a small raster icon', async () => {
    const r = await run('vector', ICON_CAP);
    expect(r.original > ICON_CAP && r.encoded !== null && r.encoded <= ICON_CAP, describe(r));
    expect(r.difference < 12, `visibly different at icon size: ${r.difference}`);
    return describe(r);
});

await check('Re-encoding', 'with little room left it goes smaller rather than over, and gives up rather than truncate', async () => {
    const small = await run('logo', 2500);
    expect(small.encoded !== null && small.encoded <= 2500, describe(small));
    const none = await run('noise', 300);
    expect(none.encoded === null, `something was produced for 300 characters: ${none.encoded}`);
    return `2 500 allowed: ${describe(small)}; 300 allowed for noise: refused`;
});

await check('Re-encoding', 'data that is not a picture is an error, not an icon', async () => {
    const failed = await page.evaluate(async () => {
        const reencode = (window as unknown as { iconEncode: { reencodeIcon(url: string, max: number): Promise<string | null> } }).iconEncode.reencodeIcon;
        return reencode(`data:image/png;base64,${btoa('this is not a picture at all')}`, 32768).then(() => false, () => true);
    });
    expect(failed, 'garbage was accepted');
    return 'rejected; saving a link then falls back to the site icon';
});

await browser.close();
process.exit(report() ? 1 : 0);

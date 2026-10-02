// Renders the extension icons from src/assets/brand/icon.svg.
//   node scripts/brand-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync('src/assets/brand/icon.svg', 'utf8');
const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [16, 32, 48, 128]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent"><img src="${uri}" width="${size}" height="${size}" style="display:block">`);
    await page.screenshot({ path: `src/assets/brand/icon${size}.png`, omitBackground: true });
    console.log(`icon${size}.png`);
}
await browser.close();

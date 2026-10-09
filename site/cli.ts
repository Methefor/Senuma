// Writes the landing page to dist-site/. Local only: nothing is deployed.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { buildSite } from './build';

const OUT = 'dist-site';
for (const [path, text] of Object.entries(buildSite())) {
    mkdirSync(dirname(join(OUT, path)), { recursive: true });
    writeFileSync(join(OUT, path), text);
    process.stdout.write(`${(Buffer.byteLength(text) / 1024).toFixed(1).padStart(7)} kB  ${path}
`);
}
process.stdout.write(`
Written to ${OUT}/ (local only; nothing was deployed). Media: npm run site:media
`);

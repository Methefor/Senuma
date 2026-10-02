// Bundle budget: fails the build check when the shipped page grows past what was agreed.
// Sizes are gzip, which is what the browser parses the cost of.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

/** [label, file pattern, budget in kB gzip]. Raise a budget deliberately, in review, or not at all. */
const BUDGETS = [
    // What every new tab parses before Home appears.
    ['startup JS (newtab-*.js)', /^newtab-.*\.js$/, 44],
    ['CSS (newtab-*.css)', /^newtab-.*\.css$/, 9.5],
    // Screens loaded on demand (Space view, settings, customize, onboarding), language packs and sync excluded.
    // 22 → 23.5 with 2.1 sync: see docs/CLOUD_SYNC_DESIGN.md 12 (the words about the size limits moved here from
    // the startup file, and a build with sync splits the backup reader into a chunk both screens share).
    ['on-demand JS', /^(?!newtab-|tr-|sync|Sync).*\.js$/, 23.5],
    // Sync: the engine, encryption, merge, transport and the Account & Sync screen. Loaded only by someone who
    // opens that screen or has sync turned on; absent from a build without sync.
    ['sync JS (only when sync is used)', /^(sync|Sync).*\.js$/, 20],
    ['language packs (tr)', /^tr-.*\.js$/, 8],
];

// `node scripts/size.mjs dist-sync` measures the build that has sync.
const out = process.argv[2] ?? 'dist';
const dir = `${out}/assets`;
const files = readdirSync(dir).map(name => ({ name, kb: gzipSync(readFileSync(`${dir}/${name}`)).length / 1024 }));
let failed = false;
for (const [label, pattern, budget] of BUDGETS) {
    const total = files.filter(f => pattern.test(f.name)).reduce((sum, f) => sum + f.kb, 0);
    const over = total > budget;
    failed ||= over;
    console.log(`${over ? 'OVER ' : 'ok   '} ${label.padEnd(34)} ${total.toFixed(2).padStart(6)} kB  (budget ${budget} kB)`);
}
// Packaged content outside the bundle: [label, folder, budget in kB on disk].
const ASSET_BUDGETS = [
    ['photographs (wallpapers/)', `${out}/wallpapers`, 3584],
    ['brand marks (marks/)', `${out}/marks`, 64],
];
for (const [label, folder, budget] of ASSET_BUDGETS) {
    const total = readdirSync(folder).reduce((sum, name) => sum + readFileSync(`${folder}/${name}`).length, 0) / 1024;
    const over = total > budget;
    failed ||= over;
    console.log(`${over ? 'OVER ' : 'ok   '} ${label.padEnd(34)} ${total.toFixed(0).padStart(6)} kB  (budget ${budget} kB, on disk)`);
}
const fonts = files.filter(f => /\.(woff2?|ttf|otf)$/.test(f.name));
const media = files.filter(f => /\.(png|jpe?g|webp|avif|mp4|webm)$/.test(f.name));
console.log(`     fonts shipped: ${fonts.length}   theme media shipped: ${media.length}`);
process.exit(failed ? 1 : 0);

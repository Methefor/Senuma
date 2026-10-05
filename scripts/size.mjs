// Bundle budget: fails the build check when the shipped page grows past what was agreed.
// Sizes are gzip, which is what the browser parses the cost of.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

/** [label, file pattern, budget in kB gzip]. Raise a budget deliberately, in review, or not at all. */
const BUDGETS = [
    // What every new tab parses before Home appears. Not to be raised (owner, 2026-10-05): trim before adding.
    ['startup JS (newtab-*.js)', /^newtab-.*\.js$/, 44],
    ['CSS (newtab-*.css)', /^newtab-.*\.css$/, 9.5],
    // Screens loaded on demand (Space view, settings, customize, onboarding), language packs excluded.
    ['on-demand JS', /^(?!newtab-|tr-|help).*\.js$/, 22],
    // Help & Feedback and the review card (2.0.2): lazy chunks and stylesheet, Turkish text apart. Approved 2026-10-05.
    ['help & feedback (help-*)', /^help-(?!tr-).*\.(js|css)$/, 6],
    ['help text, Turkish (help-tr-*)', /^help-tr-.*\.js$/, 2.5],
    ['language pack (tr)', /^tr-.*\.js$/, 8],
];

const dir = 'dist/assets';
const files = readdirSync(dir).map(name => ({ name, kb: gzipSync(readFileSync(`${dir}/${name}`)).length / 1024 }));
let failed = false;
for (const [label, pattern, budget] of BUDGETS) {
    const total = files.filter(f => pattern.test(f.name)).reduce((sum, f) => sum + f.kb, 0);
    const over = total > budget;
    failed ||= over;
    console.log(`${over ? 'OVER ' : 'ok   '} ${label.padEnd(34)} ${total.toFixed(1).padStart(6)} kB  (budget ${budget} kB)`);
}
// Packaged content outside the bundle: [label, folder, budget in kB on disk].
const ASSET_BUDGETS = [
    ['photographs (wallpapers/)', 'dist/wallpapers', 3584],
    ['brand marks (marks/)', 'dist/marks', 64],
    ['user guide pages (help/)', 'dist/help', 96],
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

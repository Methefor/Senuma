// Bundle budget: fails the build check when the shipped page grows past what was agreed.
// Sizes are gzip, which is what the browser parses the cost of.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

/** [label, file pattern, budget in kB gzip]. Raise a budget deliberately, in review, or not at all. */
const BUDGETS = [
    ['startup JS (newtab-*.js)', /^newtab-.*\.js$/, 44],
    ['CSS (newtab-*.css)', /^newtab-.*\.css$/, 9],
    ['all JS, including lazy screens', /\.js$/, 60],
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
const fonts = files.filter(f => /\.(woff2?|ttf|otf)$/.test(f.name));
const media = files.filter(f => /\.(png|jpe?g|webp|avif|mp4|webm)$/.test(f.name));
console.log(`     fonts shipped: ${fonts.length}   theme media shipped: ${media.length}`);
process.exit(failed ? 1 : 0);

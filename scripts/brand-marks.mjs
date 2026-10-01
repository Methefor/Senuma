// Content pipeline: extract the few brand marks the starter apps need from Simple Icons.
//
// `simple-icons` is a dev dependency only. Nothing from the package is imported by the app;
// this script copies the approved subset into src/assets/marks/ as small local SVG files and
// writes the record used by docs/ASSET_LICENSES.md.
//
// The Simple Icons project is CC0, but that says nothing about each mark. So every entry is
// checked on its own metadata, and the script stops rather than bundle anything when:
//   - the icon is not in the package (brands that asked to be removed stay removed), or
//   - the icon carries a licence that is not on the permissive list below.
// Marks stay trademarks of their owners either way; see docs/ASSET_LICENSES.md.
//
//   node scripts/brand-marks.mjs
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGE = 'node_modules/simple-icons';
const OUT = 'src/assets/marks';

/** Licences that allow redistribution of an unmodified shape with no extra obligation on us. */
const PERMISSIVE = new Set(['CC0-1.0', 'MIT', 'Apache-2.0', 'BSD-3-Clause', 'Unlicense']);

/** Starter apps with a mark to bundle: [Simple Icons slug, starter app]. */
const APPROVED = [
    ['claude', 'Claude'], ['perplexity', 'Perplexity'], ['huggingface', 'Hugging Face'], ['openrouter', 'OpenRouter'],
    ['github', 'GitHub'], ['stackoverflow', 'Stack Overflow'], ['npm', 'npm'], ['vercel', 'Vercel'],
    ['cloudflare', 'Cloudflare'], ['supabase', 'Supabase'], ['neon', 'Neon'], ['docker', 'Docker Hub'], ['figma', 'Figma'],
    ['arxiv', 'arXiv'], ['medium', 'Medium'], ['substack', 'Substack'],
    ['notion', 'Notion'], ['framer', 'Framer'], ['dribbble', 'Dribbble'], ['behance', 'Behance'], ['pinterest', 'Pinterest'],
    ['netflix', 'Netflix'], ['spotify', 'Spotify'], ['imdb', 'IMDb'], ['letterboxd', 'Letterboxd'],
    ['steam', 'Steam'], ['epicgames', 'Epic Games'], ['steamdb', 'SteamDB'], ['twitch', 'Twitch'],
    ['tradingview', 'TradingView'], ['coinmarketcap', 'CoinMarketCap'],
    ['x', 'X'], ['reddit', 'Reddit'], ['instagram', 'Instagram'], ['whatsapp', 'WhatsApp'],
    ['ebay', 'eBay'], ['etsy', 'Etsy'],
    ['coursera', 'Coursera'], ['khanacademy', 'Khan Academy'], ['duolingo', 'Duolingo'], ['quizlet', 'Quizlet'],
];

/**
 * Starter apps deliberately left on the site-icon / letter fallback, with the reason.
 * Kept here so the decision is recorded next to the list it belongs to.
 */
const EXCLUDED = [
    ['ChatGPT', 'not in Simple Icons'],
    ['Runway', 'not in Simple Icons'],
    ['Higgsfield', 'not in Simple Icons'],
    ['Slack', 'not in Simple Icons (removed)'],
    ['Teams', 'not in Simple Icons (removed)'],
    ['Canva', 'not in Simple Icons (removed)'],
    ['Prime Video', 'not in Simple Icons'],
    ['Disney+', 'not in Simple Icons (removed)'],
    ['Xbox', 'not in Simple Icons (removed)'],
    ['GeForce NOW', 'not in Simple Icons'],
    ['HowLongToBeat', 'not in Simple Icons'],
    ['Yahoo Finance', 'not in Simple Icons (removed)'],
    ['LinkedIn', 'not in Simple Icons (removed)'],
    ['Amazon', 'not in Simple Icons (removed)'],
    ['Anki', 'icon licence is AGPL-3.0-only'],
    ['Wikipedia', 'Wikimedia logo is separately licensed (CC BY-SA) and trademark-restricted'],
    ['Wolfram Alpha', 'only the Wolfram corporate mark is available, which is a different product'],
    ['Hacker News', 'only the Y Combinator mark is available, which is a different brand'],
    ['Gmail, Calendar, Drive, Docs, Sheets, Gemini, NotebookLM, Google Scholar, Google Finance, YouTube, YouTube Music',
        'Google brand rules require permission; these keep the icon served by Google itself'],
];

const data = JSON.parse(readFileSync(join(PACKAGE, 'data/simple-icons.json'), 'utf8'));
const version = JSON.parse(readFileSync(join(PACKAGE, 'package.json'), 'utf8')).version;
const bySlug = new Map(data.map(icon => [icon.slug, icon]));

const problems = [];
const records = [];
for (const [slug, app] of APPROVED) {
    const icon = bySlug.get(slug);
    if (!icon) { problems.push(`${slug}: not in simple-icons ${version}`); continue; }
    if (icon.license && !PERMISSIVE.has(icon.license.type)) { problems.push(`${slug}: licence ${icon.license.type} is not on the permissive list`); continue; }
    const svg = readFileSync(join(PACKAGE, 'icons', `${slug}.svg`), 'utf8');
    const path = /<path d="([^"]+)"\/>/.exec(svg)?.[1];
    if (!path || /<(script|style|image|use|foreignObject)|\son\w+=|href=/i.test(svg)) { problems.push(`${slug}: unexpected SVG content`); continue; }
    records.push({
        slug, app, title: icon.title, path,
        license: icon.license?.type ?? null,
        licenseUrl: icon.license?.url ?? null,
        guidelines: icon.guidelines ?? null,
        source: icon.source,
    });
}
if (problems.length) {
    console.error(`Nothing written. Resolve first:\n  ${problems.join('\n  ')}`);
    process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const { slug, path } of records) {
    // Shape only: no title, no colour. The page paints it through a mask.
    const file = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${path}"/></svg>\n`;
    writeFileSync(join(OUT, `${slug}.svg`), file);
    bytes += file.length;
}
writeFileSync('docs/brand-marks.json', `${JSON.stringify({
    package: `simple-icons@${version}`,
    packageLicense: 'CC0-1.0 (the collection; individual marks are checked separately)',
    generated: new Date().toISOString().slice(0, 10),
    bundled: records.map(({ path: _path, ...rest }) => rest),
    excluded: EXCLUDED.map(([app, reason]) => ({ app, reason })),
}, null, 2)}\n`);
console.log(`${readdirSync(OUT).length} marks written to ${OUT} (${(bytes / 1024).toFixed(1)} kB) from simple-icons@${version}`);
console.log(`with a licence entry: ${records.filter(r => r.license).map(r => `${r.slug} (${r.license})`).join(', ') || 'none'}`);
console.log(`with brand guidelines recorded: ${records.filter(r => r.guidelines).length} of ${records.length}`);

// One-off content pipeline, step 1 of 2: fetch the approved CC0 photographs.
//
// For each approved file this script (a) reads the file's own Wikimedia Commons page and
// refuses to continue unless it states the CC0 1.0 public-domain dedication, (b) downloads
// the ~2560 px rendition into a scratch folder OUTSIDE the repository, and (c) writes the
// provenance record used by docs/ASSET_LICENSES.md. Originals are never committed.
//
//   node scripts/wallpapers-fetch.mjs <scratch-dir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const APPROVED = [
    { id: 'toronto-night', name: 'Toronto Night', title: 'Night skyline of Toronto, Canada 374759.jpg' },
    { id: 'glass-facade', name: 'Glass Facade', title: 'Futuristic facade (Unsplash).jpg' },
    { id: 'forest-fog', name: 'Forest Fog', title: 'Heavy fog above a forest (Unsplash).jpg' },
    { id: 'evergreen-mist', name: 'Evergreen Mist', title: 'Evergreen forest wreathed in fog (Unsplash).jpg' },
    { id: 'desert-dunes', name: 'Desert Dunes', title: 'Desert Dunes (Unsplash).jpg' },
    { id: 'mountain-mirror', name: 'Mountain Mirror', title: 'Beautiful mountain reflection (Unsplash).jpg' },
    { id: 'bokeh', name: 'Bokeh', title: 'Bokeh effect (Unsplash).jpg' },
    { id: 'milky-way', name: 'Milky Way', title: 'Milky Way Glacier Point (Unsplash).jpg' },
];
const RENDITION_WIDTH = 2560;
const HEADERS = { 'User-Agent': 'browser-os-wallpaper-pipeline/1.0 (one-off licensed asset fetch)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const strip = s => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const out = process.argv[2];
if (!out) throw new Error('usage: node scripts/wallpapers-fetch.mjs <scratch-dir>');
mkdirSync(out, { recursive: true });

const records = [];
for (const asset of APPROVED) {
    const params = new URLSearchParams({
        action: 'query', format: 'json', titles: `File:${asset.title}`, prop: 'imageinfo',
        iiprop: 'url|size|extmetadata', iiurlwidth: String(RENDITION_WIDTH),
    });
    const info = await (await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: HEADERS })).json();
    const ii = Object.values(info.query.pages)[0]?.imageinfo?.[0];
    if (!ii) throw new Error(`no image info for ${asset.title}`);
    await sleep(2500);

    // The licence check is made against the file's own page, not only the API summary.
    const pageHtml = await (await fetch(ii.descriptionurl, { headers: HEADERS })).text();
    const pageSaysCc0 = /CC0 1\.0 Universal/i.test(pageHtml) && /Public Domain Dedication/i.test(pageHtml);
    const apiSaysCc0 = strip(ii.extmetadata?.LicenseShortName?.value) === 'CC0';
    if (!pageSaysCc0 || !apiSaysCc0) throw new Error(`LICENCE NOT CONFIRMED for ${asset.title}: page=${pageSaysCc0} api=${apiSaysCc0}. Nothing downloaded.`);
    await sleep(2500);

    // Never upscale: if the original is narrower than the rendition width, take the original.
    const url = ii.width > RENDITION_WIDTH ? ii.thumburl : ii.url;
    const bytes = Buffer.from(await (await fetch(url, { headers: HEADERS })).arrayBuffer());
    writeFileSync(join(out, `${asset.id}.jpg`), bytes);
    await sleep(2500);

    records.push({
        ...asset,
        creator: strip(ii.extmetadata?.Artist?.value),
        source: ii.descriptionurl,
        license: 'CC0 1.0 Universal (Public Domain Dedication)',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        licenseVerified: 'file page and API metadata both state CC0 1.0',
        original: { width: ii.width, height: ii.height, bytes: ii.size },
        download: { url, bytes: bytes.length },
        acquired: new Date().toISOString().slice(0, 10),
    });
    console.log(`${asset.id}: CC0 confirmed on file page · downloaded ${(bytes.length / 1024).toFixed(0)} kB (original ${ii.width}×${ii.height}, ${(ii.size / 1e6).toFixed(1)} MB)`);
}
writeFileSync(join(out, 'provenance.json'), JSON.stringify(records, null, 2));
console.log(`\n${records.length} assets fetched; provenance written to ${join(out, 'provenance.json')}`);

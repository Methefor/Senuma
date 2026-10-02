/**
 * The size limits in the running extension: the one-time pass over a setup saved before them,
 * saving a link with a large picture as its icon, and importing a file that breaks them.
 * Re-encoding happens in the page, so only a real browser can show it.
 *
 *   npm run build && npx vite-node e2e/limits.e2e.ts
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crc32, deflateSync } from 'node:zlib';
import { ICON_CAP, ICON_TOTAL, embeddedTotal } from '../src/core/iconPolicy';
import { LIMITS } from '../src/core/limits';
import { sanitize } from '../src/core/sanitize';
import type { AppState } from '../src/core/types';
import { workspace } from '../src/sync/fixtures';
import { DIST, check, expect, launch, newProfile, openNewTab, readStorage, removeProfile, report, waitForState, writeStorage } from './harness';

/** A real, decodable PNG of random pixels: large as stored, and the hardest kind to compress. */
function noisePng(size: number): string {
    const chunk = (type: string, data: Buffer) => {
        const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
        const out = Buffer.alloc(8 + data.length + 4);
        out.writeUInt32BE(data.length, 0);
        body.copy(out, 4);
        out.writeUInt32BE(crc32(body) >>> 0, 8 + data.length);
        return out;
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
    const rows = Buffer.alloc(size * (size * 3 + 1));
    for (let i = 0; i < rows.length; i++) rows[i] = i % (size * 3 + 1) === 0 ? 0 : Math.floor(Math.random() * 256);
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
    return `data:image/png;base64,${png.toString('base64')}`;
}

const picture = noisePng(256);
const notAPicture = `data:image/png;base64,${'A'.repeat(40_000)}`;
const longTitle = 'T'.repeat(LIMITS.title + 40);

// A setup as a build without limits could have saved it.
const before = sanitize(workspace({ links: 6, spaces: 2 })) as AppState;
const [withPicture, withJunk, withLongTitle] = Object.keys(before.items);
const old: AppState = JSON.parse(JSON.stringify({ ...before, onboarded: true, updatedAt: 1000 })) as AppState;
old.items[withPicture!]!.icon = picture;
old.items[withJunk!]!.icon = notAPicture;
old.items[withLongTitle!]!.title = longTitle;

const profile = newProfile();
const session = await launch(DIST, profile);
await writeStorage(session, { 'bos.state': old });
const stored = () => readStorage<AppState>(session, 'bos.state');

let page = await openNewTab(session);

await check('Existing setup', 'the first open after the limits arrive brings it within them and says what changed', async () => {
    expect(picture.length > ICON_CAP * 4, `the test picture is only ${picture.length} characters`);
    const toast = page.locator('.toast', { hasText: 'size limits' });
    await toast.waitFor({ timeout: 10_000 });
    const said = (await toast.innerText()).replace(/\s+/g, ' ');
    const state = await waitForState(session, (s: AppState) => (s.updatedAt > 1000 ? s : null));
    const icon = state.items[withPicture!]!.icon!;
    expect(icon.startsWith('data:image/webp;base64,') && icon.length <= ICON_CAP, `picture icon is ${icon.slice(0, 30)}… (${icon.length})`);
    expect(!('icon' in state.items[withJunk!]!), 'the undecodable icon was kept');
    expect(state.items[withLongTitle!]!.title.length <= LIMITS.title && state.items[withLongTitle!]!.title !== longTitle.slice(0, state.items[withLongTitle!]!.title.length), 'the long title was cut instead of replaced');
    expect(Object.keys(state.items).length === 6, 'a link was lost');
    expect(embeddedTotal(state.items) <= ICON_TOTAL, 'icons over the total');
    return `${(picture.length / 1024).toFixed(0)} KB picture → ${(icon.length / 1024).toFixed(1)} KB WebP; said: “${said.slice(0, 230)}”`;
});

await check('Existing setup', 'the replaced title is kept exactly as it was, and Settings offers it back with a count', async () => {
    const record = await readStorage<{ batches: { originals: { kind: string; of: string; original: string }[] }[] }>(session, 'bos.limits.originals');
    const originals = record?.batches.flatMap(batch => batch.originals) ?? [];
    expect(originals.length === 1 && originals[0]!.kind === 'title' && originals[0]!.original === longTitle, `record: ${JSON.stringify(originals).slice(0, 200)}`);
    await page.locator('.topbar button').last().click();
    await page.locator('.settings-nav button', { hasText: 'Data' }).click();
    const row = page.locator('.row', { hasText: 'Original values kept' });
    await row.waitFor({ timeout: 5000 });
    const said = (await row.innerText()).replace(/\s+/g, ' ');
    expect(/1 titles, 0 names, 0 links/.test(said), `row: ${said}`);
    const [download] = await Promise.all([page.waitForEvent('download'), row.locator('.button').first().click()]);
    expect(download.suggestedFilename() === 'senuma-original-values.json', download.suggestedFilename());
    await page.keyboard.press('Escape');
    return said.slice(0, 200);
});

await check('Existing setup', 'the pass happens once: reopening changes nothing and says nothing', async () => {
    const first = await stored();
    await page.close();
    page = await openNewTab(session);
    await page.waitForTimeout(1500);
    expect((await page.locator('.toast').count()) === 0, 'a notice was shown again');
    const second = await stored();
    expect(second!.updatedAt === first!.updatedAt && JSON.stringify(second!.items) === JSON.stringify(first!.items), 'the setup was rewritten');
});

const openEditor = async () => {
    await page.locator('.plate').first().click();
    await page.locator('.tile.tile-add').first().click();
    await page.locator('.overlay-form input').first().waitFor();
};

await check('Saving a link', 'a large picture pasted as the icon is stored as a small complete image', async () => {
    await openEditor();
    await page.locator('.overlay-form input').nth(0).fill('picture-icon.example');
    await page.locator('.overlay-form input').nth(2).fill(noisePng(200));
    await page.locator('.overlay-form button[type=submit]').click();
    const icon = await waitForState(session, (s: AppState) => Object.values(s.items).find(item => item.url.includes('picture-icon.example'))?.icon);
    expect(icon.startsWith('data:image/webp;base64,') && icon.length <= ICON_CAP, `saved icon: ${icon.slice(0, 30)}… (${icon.length})`);
    const shown = await page.evaluate(async url => {
        const image = new Image();
        image.src = url;
        await image.decode();
        return `${image.naturalWidth}×${image.naturalHeight}`;
    }, icon);
    return `stored ${(icon.length / 1024).toFixed(1)} KB, decodes as ${shown}`;
});

await check('Saving a link', 'something that cannot be made to fit is not stored: the link is saved, uses its site icon, and the person is told', async () => {
    await page.locator('.tile.tile-add').first().click();
    await page.locator('.overlay-form input').first().waitFor();
    await page.locator('.overlay-form input').nth(0).fill('broken-icon.example');
    await page.locator('.overlay-form input').nth(2).fill(notAPicture);
    await page.locator('.overlay-form button[type=submit]').click();
    await page.locator('.toast', { hasText: 'too large for an icon' }).waitFor({ timeout: 8000 });
    const item = await waitForState(session, (s: AppState) => Object.values(s.items).find(entry => entry.url.includes('broken-icon.example')));
    expect(!('icon' in item), 'an icon was stored');
});

await check('Saving a link', 'the address and name fields do not accept more than the limits', async () => {
    await page.locator('.tile.tile-add').first().click();
    const [address, name] = [page.locator('.overlay-form input').nth(0), page.locator('.overlay-form input').nth(1)];
    await address.waitFor();
    expect((await address.getAttribute('maxlength')) === String(LIMITS.url) && (await name.getAttribute('maxlength')) === String(LIMITS.title), 'field limits missing');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
});

await check('Import', 'a backup that breaks the limits is brought within them before anything is chosen, and reported', async () => {
    const source = sanitize(workspace({ links: 4, spaces: 1 }, 77)) as AppState;
    const [first, second] = Object.keys(source.items);
    const file = JSON.parse(JSON.stringify({ kind: 'senuma-backup', schema: source.schema, state: source })) as { state: AppState };
    file.state.items[first!]!.icon = noisePng(220);
    file.state.items[second!]!.url = `https://example.com/${'p'.repeat(LIMITS.url)}`;
    const path = join(tmpdir(), `senuma-limits-${Date.now()}.json`);
    writeFileSync(path, JSON.stringify(file));
    await page.locator('.topbar button').last().click();
    await page.locator('.settings-nav button', { hasText: 'Data' }).click();
    await page.locator('.settings-body input[type=file]').setInputFiles(path);
    const toast = page.locator('.toast', { hasText: 'size limits' });
    await toast.waitFor({ timeout: 10_000 });
    const said = (await toast.innerText()).replace(/\s+/g, ' ');
    expect(/too long\): 1\./.test(said) && /made smaller: 1\./.test(said) && !/Settings/.test(said), `notice: ${said}`);
    await page.locator('.choice').nth(1).click(); // replace
    const state = await waitForState(session, (s: AppState) => (s.items[first!] ? s : null));
    expect(!state.items[second!], 'the link with the overlong address was imported');
    expect(state.items[first!]!.icon!.startsWith('data:image/webp') && state.items[first!]!.icon!.length <= ICON_CAP, 'the imported icon was not re-encoded');
    return `said: “${said.slice(0, 200)}”`;
});

await check('Console', 'no errors on any page', async () => {
    expect(session.errors.length === 0, session.errors.slice(0, 4).join(' || '));
});

await session.context.close();
removeProfile(profile);
process.exit(report() ? 1 : 0);

/**
 * 2.0.1 checks in the real extension: names that follow the language, the person's names left
 * alone, suggestions added one at a time without icon requests, the search-shortcut tip, the
 * import field's wording, backup round trip, and an uploaded background across a browser restart.
 *
 *   npm run build && vite-node e2e/qa-201.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { emptyState } from '../src/core/defaults';
import { DIST, check, expect, launch, newProfile, openNewTab, readStorage, removeProfile, report, waitForState, writeStorage, type Session } from './harness';

mkdirSync('e2e/.out', { recursive: true });
const profile = newProfile();
const session = await launch(DIST, profile);
const page: Page = await openNewTab(session);
const requests: string[] = [];
session.context.on('request', request => requests.push(request.url()));
const names = async () => Object.values((await readStorage<any>(session, 'bos.state'))!.spaces as Record<string, { name: string; nameKey?: string; groups: { name: string }[] }>);
/** Back to a plain Home: no panel, menu or overlay left open. */
const home = async (on: Page = page) => {
    for (let i = 0; i < 4 && (await on.locator('.overlay, .menu').count()); i++) {
        await on.keyboard.press('Escape');
        await on.waitForTimeout(250);
    }
    await on.screenshot({ path: 'e2e/.out/qa201-last-home.png' });
};
const setLanguage = async (value: 'en' | 'tr') => {
    await page.locator('.topbar .icon-button[aria-label]').last().click();
    await page.locator('.settings-nav button').first().click();
    await page.locator('.settings-body select').first().selectOption(value);
    await page.keyboard.press('Escape');
};

try {
    await check('Localization', 'onboarding in Turkish names Spaces in Turkish, with keys', async () => {
        // A new person whose interface is Turkish (onboarding covers Settings, so the preference is seeded).
        const fresh = emptyState();
        await writeStorage(session, { 'bos.state': { ...fresh, prefs: { ...fresh.prefs, language: 'tr' }, updatedAt: Date.now() } });
        await page.reload();
        await page.waitForSelector('.onboarding');
        expect((await page.locator('.interest').count()) === 11, 'expected 11 interest choices (Shopping added)');
        for (const name of ['Finans', 'Medya', 'İş']) await page.locator('.interest', { hasText: name }).first().click();
        await page.locator('.onboarding .button.is-primary').click();
        await page.locator('.onboarding .button.is-primary').click();
        await page.locator('.onboarding .choice').last().click();
        await page.waitForSelector('.onboarding', { state: 'detached' });
        // Saving is debounced: wait for the three Spaces to reach storage.
        await waitForState(session, s => Object.keys(s.spaces).length === 3, 8000);
        const spaces = await names();
        expect(spaces.some(s => s.name === 'Finans' && s.nameKey === 'cat.finance'), JSON.stringify(spaces.map(s => [s.name, s.nameKey])));
        return spaces.map(s => s.name).join(', ');
    });

    await check('Localization', 'a renamed Space keeps its name; default names switch to English with the interface', async () => {
        const state = (await readStorage<any>(session, 'bos.state'))!;
        const work = Object.values<any>(state.spaces).find(s => s.name === 'İş');
        // Rename through the editor, as a person does.
        await page.locator('.plate', { hasText: 'İş' }).first().click({ button: 'right' });
        await page.locator('.menu [role=menuitem]', { hasText: 'Düzenle' }).first().click();
        await page.locator('.overlay-form input').first().fill('Ofis');
        await page.locator('.overlay-form .button.is-primary').click();
        await waitForState(session, s => s.spaces[work.id]?.name === 'Ofis');
        await setLanguage('en');
        const after = await waitForState(session, s => (Object.values<any>(s.spaces).some(x => x.name === 'Finance') ? s : null), 8000);
        const list = Object.values<any>(after.spaces).map(s => s.name);
        expect(list.includes('Finance') && list.includes('Media') && list.includes('Ofis') && !list.includes('Finans'), list.join(', '));
        const media = Object.values<any>(after.spaces).find(s => s.name === 'Media');
        expect(media.groups.map((g: any) => g.name).join() === 'Watch,Listen,Discover', media.groups.map((g: any) => g.name).join());
        const modes = Object.values<any>(after.modes).map(m => m.name).sort().join();
        expect(modes === 'Chill,Work', `modes: ${modes}`);
        await page.screenshot({ path: 'e2e/.out/qa201-home-en.png' });
        return list.join(', ');
    });

    await check('Catalog', 'suggestions are offered inside a Space, shown as letters, and added one at a time', async () => {
        requests.length = 0;
        await page.locator('.plate', { hasText: 'Media' }).first().click();
        await page.waitForSelector('.overlay-space');
        const summary = page.locator('.suggestions summary');
        expect(await summary.count() === 1, 'no suggestions in a starter Space');
        await summary.click();
        const picks = page.locator('.suggestions .pick');
        const offered = await picks.allInnerTexts();
        expect(offered.some(t => t.includes('Apple Music')) && offered.some(t => t.includes('HBO Max')), offered.join(' | '));
        await page.waitForTimeout(500);
        const iconRequests = requests.filter(url => /music\.apple|soundcloud|hbomax/.test(url));
        expect(iconRequests.length === 0, `icon requests while browsing suggestions: ${iconRequests.join(', ')}`);
        await page.locator('.overlay-space').screenshot({ path: 'e2e/.out/qa201-suggestions.png' });
        const before = Object.keys((await readStorage<any>(session, 'bos.state'))!.items).length;
        await page.locator('.suggestions .pick', { hasText: 'SoundCloud' }).click();
        const state = await waitForState(session, s => (Object.keys(s.items).length === before + 1 ? s : null));
        const media = Object.values<any>(state.spaces).find(s => s.name === 'Media');
        const listen = media.groups.find((g: any) => g.name === 'Listen');
        expect(listen.itemIds.some((id: string) => state.items[id].title === 'SoundCloud'), 'SoundCloud did not land in Listen');
        expect((await page.locator('.suggestions .pick', { hasText: 'SoundCloud' }).count()) === 0, 'an added suggestion is still offered');
        await page.keyboard.press('Escape');
        return `${offered.length} offered; one added, into “Listen”`;
    });

    await check('Search shortcuts', 'the empty search box teaches “y lofi mix”; the shortcut still searches YouTube; the tip then goes away', async () => {
        await home();
        const box = page.locator('#home-search');
        await box.click();
        const tip = await box.getAttribute('placeholder');
        expect(tip === 'Try “y lofi mix” to search YouTube', `placeholder: ${tip}`);
        await page.locator('.launcher-home').screenshot({ path: 'e2e/.out/qa201-search-tip.png' });
        await box.fill('y lofi mix');
        const chip = await page.locator('.route-chip').innerText();
        expect(chip === 'YouTube', `route chip: ${chip}`);
        const [popup] = await Promise.all([
            session.context.waitForEvent('page', { timeout: 8000 }).catch(() => null),
            box.press('Enter'),
        ]);
        const target = popup ? popup.url() : page.url();
        expect(/youtube\.com\/results\?search_query=lofi(\+|%20)mix/.test(target), `went to ${target}`);
        if (popup) await popup.close();
        else await page.goBack();
        const fresh = await openNewTab(session);
        await fresh.locator('#home-search').click();
        const after = await fresh.locator('#home-search').getAttribute('placeholder');
        expect(after === 'Search the web or your Spaces', `tip still shown: ${after}`);
        await fresh.close();
        return target;
    });

    await check('Import field', 'the paste field says it takes a list of links, and does that', async () => {
        await page.bringToFront();
        await home();
        await page.locator('.topbar .icon-button[aria-label]').last().click();
        await page.locator('.settings-nav button', { hasText: 'Data' }).click();
        const label = await page.locator('.field', { hasText: 'Paste a list of links' }).count();
        expect(label === 1, 'label not found');
        await page.locator('.field textarea').fill('github.com\nDocs | https://devdocs.io');
        await page.locator('.button', { hasText: 'Sort into Spaces' }).click();
        await page.waitForSelector('.review', { timeout: 8000 });
        const review = (await page.locator('.review-list').innerText()).replace(/\s+/g, ' ');
        expect(/coding/i.test(review) && /2 links/i.test(review), `review: ${review}`);
        await page.locator('.review .button.is-primary').click();
        await waitForState(session, st => Object.values<any>(st.items).some(i => /devdocs\.io/.test(i.url)) && Object.values<any>(st.items).some(i => /github\.com/.test(i.url)), 8000);
        await home();
        return `label “Paste a list of links”; review: ${review}; both added`;
    });

    await check('Storage', 'default names (including a Space the import created) are stored with their key; the renamed one has none', async () => {
        const state = (await readStorage<any>(session, 'bos.state'))!;
        const spaces = Object.values<any>(state.spaces);
        const keyed = spaces.filter(x => x.nameKey).map(x => x.name).sort().join();
        expect(keyed === 'Coding,Finance,Media' && !spaces.find(x => x.name === 'Ofis').nameKey, JSON.stringify(spaces.map(x => [x.name, x.nameKey ?? null])));
        return 'backup export/import of the keys is covered by the unit tests';
    });
    await check('Brand', 'the browser tab reads “Senuma”: fresh tab, reload, language change, Mode switch', async () => {
        const tab = await openNewTab(session);
        const cdp = await session.context.newCDPSession(tab);
        // What the browser shows on the tab itself, not only document.title.
        const shown = async () => {
            const { targetInfo } = (await cdp.send('Target.getTargetInfo')) as { targetInfo: { title: string } };
            return `${targetInfo.title}|${await tab.title()}`;
        };
        const seen: string[] = [await shown()];
        await tab.reload();
        await tab.waitForSelector('.home');
        seen.push(await shown());
        await tab.locator('.topbar .icon-button[aria-label]').last().click();
        await tab.locator('.settings-nav button').first().click();
        await tab.locator('.settings-body select').first().selectOption('tr');
        await tab.waitForTimeout(500);
        seen.push(await shown());
        await tab.locator('.settings-body select').first().selectOption('en');
        await tab.keyboard.press('Escape');
        await tab.locator('#mode-switch').click();
        await tab.locator('.menu button', { hasText: 'Work' }).click();
        await tab.waitForTimeout(400);
        seen.push(await shown());
        await tab.locator('#mode-switch').click();
        await tab.locator('.menu button', { hasText: 'All Spaces' }).click();
        await tab.close();
        expect(seen.every(title => title === 'Senuma|Senuma'), seen.join(' · '));
        return seen.join(' · ');
    });
} finally {
    await session.context.close();
    removeProfile(profile);
}

// An uploaded background must come back after the whole browser is quit and started again (hands-on
// QA report, 2026-10-05). Quit straight after Apply, with a Mode active, as a person might.
const photoProfile = newProfile();
let photoSession: Session | undefined;
try {
    photoSession = await launch(DIST, photoProfile);
    let tab = await openNewTab(photoSession);
    await tab.waitForSelector('.onboarding');
    for (const name of ['Finance', 'Media', 'Work']) await tab.locator('.interest', { hasText: name }).first().click();
    await tab.locator('.onboarding .button.is-primary').click();
    await tab.locator('.onboarding .button.is-primary').click();
    await tab.locator('.onboarding .choice').last().click();
    await tab.waitForSelector('.onboarding', { state: 'detached' });
    await tab.locator('#mode-switch').click();
    await tab.locator('.menu button', { hasText: 'Work' }).click();
    const file = join(photoProfile, 'my-photo.jpg');
    writeFileSync(file, Buffer.from((await tab.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 2400;
        canvas.height = 1500;
        const context = canvas.getContext('2d')!;
        const gradient = context.createLinearGradient(0, 0, 2400, 1500);
        gradient.addColorStop(0, '#2a4f7a');
        gradient.addColorStop(1, '#d9824b');
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2400, 1500);
        return canvas.toDataURL('image/jpeg', 0.9);
    })).split(',')[1]!, 'base64'));
    await tab.locator('.topbar button[aria-label="Customize"]').click();
    await tab.locator('.overlay-customize input[type=file]').setInputFiles(file);
    await tab.locator('.backdrop-photo.is-ready').waitFor({ timeout: 15_000 });
    await tab.locator('.customize-foot .button.is-primary').click();
    // No waiting for the debounced save: the browser is quit at once.
    await photoSession.context.close();

    const restored = async (round: string) => {
        tab = await openNewTab(photoSession!);
        await tab.locator('.backdrop-photo.is-ready').waitFor({ timeout: 10_000 });
        expect((await tab.title()) === 'Senuma', `${round}: tab title “${await tab.title()}”`);
        const state = (await readStorage<any>(photoSession!, 'bos.state'))!;
        const source = state.prefs.background.source;
        const stored = await tab.evaluate(() => new Promise<string[]>(resolve => {
            const open = indexedDB.open('bos-assets', 1);
            open.onsuccess = () => {
                const request = open.result.transaction('wallpapers').objectStore('wallpapers').getAllKeys();
                request.onsuccess = () => resolve(request.result.map(String));
            };
        }));
        expect(source.kind === 'upload' && Object.hasOwn(state.wallpapers, source.assetId), `${round}: saved background ${JSON.stringify(source)}`);
        expect(stored.length === 1 && stored[0] === source.assetId, `${round}: image store holds ${JSON.stringify(stored)}`);
        expect((await tab.locator('.toast', { hasText: 'could not be loaded' }).count()) === 0, `${round}: “could not be loaded” shown`);
        return source.assetId as string;
    };

    await check('Background', 'an uploaded background is shown again after quitting and restarting the browser', async () => {
        photoSession = await launch(DIST, photoProfile);
        const id = await restored('first start');
        // Opening Customize tidies the image library; it must keep the image in use.
        await tab.locator('.topbar button[aria-label="Customize"]').click();
        await tab.waitForSelector('.overlay-customize');
        await tab.waitForTimeout(1500);
        await tab.keyboard.press('Escape');
        await tab.waitForTimeout(500);
        await photoSession.context.close();
        photoSession = await launch(DIST, photoProfile);
        expect((await restored('second start')) === id, 'a different image after the second start');
        return `image ${id} on screen after two full restarts`;
    });
} finally {
    await photoSession?.context.close().catch(() => undefined);
    removeProfile(photoProfile);
}
process.exit(report());

/**
 * Help & Feedback in the real extension: the Settings section, the packaged guide (offline, both
 * languages), contextual links, the feedback message (shown before anything leaves, technical
 * lines only with consent, nothing sent by Senuma) and the review card's rules.
 *
 *   npm run build && vite-node e2e/help-feedback.ts
 */
import { mkdirSync } from 'node:fs';
import type { Page } from 'playwright';
import { BRAND } from '../src/brand';
import { DIST, check, expect, launch, newProfile, openNewTab, readStorage, removeProfile, report, writeStorage } from './harness';

mkdirSync('e2e/.out', { recursive: true });
const DAY = 24 * 60 * 60 * 1000;
const VERSION = BRAND.displayVersion.replace(/\./g, '\\.');
const profile = newProfile();
const session = await launch(DIST, profile);
const requests: string[] = [];
session.context.on('request', request => requests.push(request.url()));
const outside = () => requests.filter(url => !/^(chrome-extension|chrome|data|blob):/.test(url));
let page: Page = await openNewTab(session);

const openHelp = async (on: Page = page) => {
    await on.locator('.topbar button[aria-label="Settings"], .topbar button[aria-label="Ayarlar"]').first().click();
    await on.locator('.settings-nav button', { hasText: /Help & Feedback|Yardım ve Geri Bildirim/ }).click();
    await on.waitForSelector('.help-list');
};
const closeAll = async (on: Page = page) => {
    for (let i = 0; i < 4 && (await on.locator('.overlay, .menu').count()); i++) {
        await on.keyboard.press('Escape');
        await on.waitForTimeout(200);
    }
};

try {
    await check('First tab', 'no review card on a new install; its record waits a week', async () => {
        await page.waitForSelector('.onboarding');
        for (const name of ['Coding', 'Media', 'Work']) await page.locator('.interest', { hasText: name }).first().click();
        await page.locator('.onboarding .button.is-primary').click();
        await page.locator('.onboarding .button.is-primary').click();
        await page.locator('.onboarding .choice').last().click();
        await page.waitForSelector('.onboarding', { state: 'detached' });
        await page.waitForTimeout(800);
        const record = await page.evaluate(() => JSON.parse(localStorage.getItem('bos.review') ?? 'null'));
        expect(record && record.next - record.firstSeen === 7 * 24 * 60 * 60 * 1000, `record ${JSON.stringify(record)}`);
        expect((await page.locator('.review-card').count()) === 0, 'review card shown on the first day');
    });

    await check('Help', 'Settings has Help & Feedback: guide topics, three feedback cards, About', async () => {
        requests.length = 0;
        await openHelp();
        const rows = (await page.locator('.help-row strong').allInnerTexts()).join(' | ');
        expect(rows === 'User Guide | Getting Started | Privacy & Permissions | Import & Backup | Keyboard Shortcuts | About Senuma', rows);
        const cards = (await page.locator('.choice strong').allInnerTexts()).join(' | ');
        expect(cards === 'Report a problem | Suggest an idea | Share feedback', cards);
        await page.locator('.overlay-settings').screenshot({ path: 'e2e/.out/help-section-en.png' });
        return rows;
    });

    await check('Help', 'the guide opens from the extension itself in a new tab, at the right section, with no request out', async () => {
        const [guide] = await Promise.all([session.context.waitForEvent('page'), page.locator('.help-row', { hasText: 'Getting Started' }).click()]);
        await guide.waitForLoadState('domcontentloaded');
        expect(/^chrome-extension:\/\/[a-p]{32}\/help\/en\.html#getting-started$/.test(guide.url()), guide.url());
        const title = await guide.locator('h2#getting-started').innerText();
        expect(title === '1. Getting Started', title);
        expect((await guide.locator('h2[id]').count()) === 27, 'not 27 sections');
        const link = await guide.locator('a[hreflang="tr"]').getAttribute('href');
        expect(link === 'tr.html', `language link ${link}`);
        await guide.screenshot({ path: 'e2e/.out/help-guide-en.png' });
        await guide.close();
        expect(outside().length === 0, `requests: ${outside().join(', ')}`);
    });

    await check('Help', 'contextual links point at their guide sections', async () => {
        await page.locator('.settings-nav button', { hasText: 'Search' }).click();
        const search = await page.locator('.help-link').getAttribute('href');
        await page.locator('.settings-nav button', { hasText: 'Data' }).click();
        const backup = await page.locator('.help-link').getAttribute('href');
        await page.locator('.settings-nav button', { hasText: 'Privacy' }).click();
        const privacy = await page.locator('.help-link').innerText();
        const privacyHref = await page.locator('.help-link').getAttribute('href');
        expect(search === 'help/en.html#search-shortcuts' && backup === 'help/en.html#import-export' && privacyHref === 'help/en.html#privacy', `${search} ${backup} ${privacyHref}`);
        expect(privacy.startsWith('Why does Senuma need this permission?'), privacy);
        await closeAll();
        await page.locator('.topbar button[aria-label="Customize"]').click();
        await page.locator('.swatch-tile[aria-label="Milky Way"]').click();
        const look = await page.locator('.overlay-customize .help-link').getAttribute('href');
        expect(look === 'help/en.html#backgrounds', `customize ${look}`);
        await closeAll();
    });

    await check('Help', 'Keyboard Shortcuts and About Senuma open their sections; Ctrl+K “help” opens Help & Feedback', async () => {
        await openHelp();
        await page.locator('.help-row', { hasText: 'Keyboard Shortcuts' }).click();
        expect((await page.locator('.settings-nav [aria-current=page]').innerText()).trim() === 'Keyboard' && (await page.locator('.settings-body kbd').count()) > 5, 'Keyboard section not shown');
        await page.locator('.settings-nav button', { hasText: 'Help & Feedback' }).click();
        await page.locator('.help-row', { hasText: 'About Senuma' }).click();
        const about = (await page.locator('.settings-body').innerText()).replace(/\s+/g, ' ');
        expect((await page.locator('.settings-nav [aria-current=page]').innerText()).trim() === 'About' && about.includes(BRAND.displayVersion), about);
        await closeAll();
        await page.mouse.click(8, 300);
        await page.keyboard.press('Control+k');
        await page.keyboard.type('help');
        const first = (await page.locator('.result').first().innerText()).replace(/\s+/g, ' ');
        expect(/Open Settings: Help & Feedback/.test(first), `first result: ${first}`);
        await page.keyboard.press('Enter');
        await page.waitForSelector('.help-list');
        await closeAll();
        return first;
    });

    await check('Feedback', 'a problem report is shown in full first; technical lines only with the box ticked; Senuma sends nothing', async () => {
        requests.length = 0;
        await openHelp();
        await page.locator('.choice', { hasText: 'Report a problem' }).click();
        const email = page.locator('.feedback-actions a.button');
        expect((await email.getAttribute('href')) === null, 'email offered before anything was written');
        await page.locator('.feedback-form textarea').first().fill('The dock hides a Space at 200% zoom');
        await page.locator('.feedback-form textarea').nth(1).fill('1. Zoom to 200%\n2. Open Home');
        await page.waitForTimeout(300);
        const preview = await page.locator('.feedback-preview').innerText();
        expect(new RegExp(`^\\[Senuma ${VERSION}\\] Problem report: The dock hides a Space at 200% zoom`).test(preview), preview);
        expect(new RegExp(`Senuma version: ${VERSION}`).test(preview) && /Browser: \S+/.test(preview) && /Operating system: \S+/.test(preview), preview);
        const href = (await email.getAttribute('href'))!;
        expect(href.startsWith('mailto:rumeliskelesi+senuma@gmail.com?subject=') && decodeURIComponent(href).includes('Zoom to 200%'), href);
        await page.locator('.overlay-settings').screenshot({ path: 'e2e/.out/help-feedback-problem.png' });
        await page.locator('.feedback-check input').uncheck();
        const bare = await page.locator('.feedback-preview').innerText();
        const bareHref = decodeURIComponent((await email.getAttribute('href'))!);
        expect(!/Browser|Operating system|Senuma version/.test(bare) && !/Browser|Operating system/.test(bareHref), bare);
        expect(outside().length === 0, `requests: ${outside().join(', ')}`);
        return preview.split('\n').filter(line => /:/.test(line)).slice(-4).join(' · ');
    });

    await check('Mail fallback', 'without a mail app the flow still makes sense: the address is shown and selectable, Copy works, the form stays', async () => {
        await session.context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => undefined);
        const line = page.locator('.feedback-address');
        const text = await line.innerText();
        expect(text === 'If no email app opens, copy the message and send it to rumeliskelesi+senuma@gmail.com', text);
        expect((await line.evaluate(node => getComputedStyle(node).userSelect)) === 'text', 'the address cannot be selected');
        const pagesBefore = session.context.pages().length;
        // No mail app answers in this browser: the click must leave everything as it was.
        await page.locator('.feedback-actions a.button').click();
        await page.waitForTimeout(1200);
        expect((await page.locator('.feedback-form textarea').first().inputValue()) === 'The dock hides a Space at 200% zoom', 'the message was lost after the email button');
        expect(session.context.pages().length === pagesBefore && (await page.locator('.feedback-form').count()) === 1, 'the page changed after the email button');
        await page.locator('.feedback-actions button.button').click();
        await page.locator('.toast', { hasText: 'Message copied' }).waitFor();
        const copied = await page.evaluate(() => navigator.clipboard.readText()).catch(() => '');
        expect(copied === '' || (copied.includes('The dock hides a Space at 200% zoom') && copied.includes('1. Zoom to 200%')), `clipboard: ${copied.slice(0, 80)}`);
        await page.locator('.overlay-settings').evaluate(node => node.querySelector('.settings-body')!.scrollTo(0, 9999));
        await page.locator('.overlay-settings').screenshot({ path: 'e2e/.out/help-feedback-fallback.png' });
        return `${text}; clipboard ${copied ? 'holds the message' : 'not readable in this run (toast shown)'}`;
    });

    await check('Feedback', 'ideas and general feedback: own question, no steps field, technical details off until ticked', async () => {
        const seen: string[] = [];
        for (const [card, question] of [['Suggest an idea', 'What would you like Senuma to do?'], ['Share feedback', 'Your feedback']] as const) {
            await page.locator('.feedback-actions .text-button').click();
            await page.locator('.choice', { hasText: card }).click();
            const label = await page.locator('.feedback-form .field span').first().innerText();
            expect(label === question && (await page.locator('.feedback-form textarea').count()) === 1, `${card}: ${label}`);
            expect((await page.locator('.feedback-check input').isChecked()) === false, `${card}: technical details pre-ticked`);
            await page.locator('.feedback-form textarea').fill('A calmer default theme');
            const preview = await page.locator('.feedback-preview').innerText();
            expect(!/Browser|Operating system/.test(preview) && preview.includes('A calmer default theme'), preview);
            await page.locator('.feedback-check input').check();
            expect(/Browser: \S+/.test(await page.locator('.feedback-preview').innerText()), 'ticking the box did not add the technical lines');
            seen.push(card);
        }
        await closeAll();
        return seen.join(', ');
    });

    await check('Localization', 'in Turkish the section, cards, feedback form and guide are Turkish; the guide anchors stay the same', async () => {
        await closeAll();
        await page.locator('.topbar .icon-button[aria-label]').last().click();
        await page.locator('.settings-nav button').first().click();
        await page.locator('.settings-body select').first().selectOption('tr');
        await page.locator('.settings-nav button', { hasText: 'Yardım ve Geri Bildirim' }).click();
        await page.waitForSelector('.help-list');
        await page.waitForTimeout(300);
        const rows = (await page.locator('.help-row strong').allInnerTexts()).join(' | ');
        const cards = (await page.locator('.choice strong').allInnerTexts()).join(' | ');
        expect(rows === 'Kullanım Kılavuzu | Başlarken | Gizlilik ve İzinler | İçe Aktarma ve Yedekleme | Klavye Kısayolları | Senuma Hakkında', rows);
        expect(cards === 'Sorun bildir | Fikir öner | Geri bildirim gönder', cards);
        const href = await page.locator('.help-row', { hasText: 'Gizlilik ve İzinler' }).getAttribute('href');
        expect(href === 'help/tr.html#privacy', `${href}`);
        await page.locator('.overlay-settings').screenshot({ path: 'e2e/.out/help-section-tr.png' });
        const [guide] = await Promise.all([session.context.waitForEvent('page'), page.locator('.help-row', { hasText: 'Gizlilik ve İzinler' }).click()]);
        await guide.waitForLoadState('domcontentloaded');
        const title = await guide.locator('h2#privacy').innerText();
        expect(title === '23. Gizlilik ve İzinler', title);
        await guide.close();
        await page.locator('.choice', { hasText: 'Fikir öner' }).click();
        const label = await page.locator('.feedback-form .field span').first().innerText();
        expect(label === 'Senuma’nın ne yapmasını isterdin?', label);
        expect((await page.locator('.feedback-check input').isChecked()) === false, 'technical details ticked for an idea');
        const fallback = await page.locator('.feedback-address').innerText();
        expect(fallback === 'E-posta uygulaması açılmazsa mesajı kopyalayıp şu adrese gönder: rumeliskelesi+senuma@gmail.com', fallback);
        await page.locator('.overlay-settings').screenshot({ path: 'e2e/.out/help-feedback-idea-tr.png' });
        const links: string[] = [];
        for (const [section, text, href] of [
            ['Arama', 'Arama kısayolları hakkında daha fazlası', 'help/tr.html#search-shortcuts'],
            ['Veriler', 'Yedekler ve geri yükleme noktaları nasıl çalışır', 'help/tr.html#import-export'],
            ['Gizlilik', 'Senuma bu izne neden ihtiyaç duyar?', 'help/tr.html#privacy'],
        ] as const) {
            await page.locator('.settings-nav button', { hasText: section }).first().click();
            const link = page.locator('.settings-body .help-link');
            expect((await link.innerText()).startsWith(text) && (await link.getAttribute('href')) === href, `${section}: ${await link.innerText()} ${await link.getAttribute('href')}`);
            links.push(section);
        }
        await closeAll();
        return `${rows}; ${cards}; contextual links in ${links.join(', ')}`;
    });

    await check('Review', 'after a week and real use the neutral card appears, with review and feedback side by side', async () => {
        const state = (await readStorage<any>(session, 'bos.state'))!;
        const now = Date.now();
        const recents = Array.from({ length: 14 }, (_, i) => ({ url: `https://example.com/${i}`, title: `Site ${i}`, at: now - (i % 5) * DAY, count: 1 }));
        await writeStorage(session, { 'bos.state': { ...state, prefs: { ...state.prefs, language: 'en' }, recents, updatedAt: now } });
        await page.evaluate(day => localStorage.setItem('bos.review', JSON.stringify({ firstSeen: Date.now() - 8 * day, next: Date.now() - 1000, shown: 0, dismissed: 0 })), DAY);
        await page.close();
        page = await openNewTab(session);
        const card = page.locator('.review-card');
        await card.waitFor({ timeout: 8000 });
        const text = (await card.innerText()).replace(/\s+/g, ' ');
        expect(/Enjoying Senuma\? A short Chrome Web Store review helps Senuma grow\. Leave a review Send feedback Not now/.test(text), text);
        const store = await card.locator('a.button').getAttribute('href');
        expect(store === 'https://chromewebstore.google.com/detail/oghlifenjhpbebcdeboejbmemelkfobe/reviews', `${store}`);
        expect(!(await page.evaluate(() => document.activeElement?.closest('.review-card'))), 'the card took focus');
        await page.screenshot({ path: 'e2e/.out/help-review-card.png' });
        return text;
    });

    await check('Review', '"Not now" is remembered: the card goes and does not come back on the next tabs', async () => {
        await page.locator('.review-card .text-button').click();
        expect((await page.locator('.review-card').count()) === 0, 'card still shown');
        const record = await page.evaluate(() => JSON.parse(localStorage.getItem('bos.review')!));
        expect(record.dismissed === 1 && record.next > Date.now() + 59 * DAY && record.shown === 1, JSON.stringify(record));
        const next = await openNewTab(session);
        await next.waitForTimeout(1500);
        expect((await next.locator('.review-card').count()) === 0, 'card came back');
        await next.close();
    });

    await check('Review', '"Send feedback" opens the feedback form', async () => {
        await page.evaluate(() => {
            const record = JSON.parse(localStorage.getItem('bos.review')!);
            localStorage.setItem('bos.review', JSON.stringify({ ...record, next: Date.now() - 1000 }));
        });
        const tab = await openNewTab(session);
        await tab.locator('.review-card').waitFor({ timeout: 8000 });
        await tab.locator('.review-card button.button').click();
        await tab.waitForSelector('.feedback-form');
        const heading = await tab.locator('.feedback-form h3').textContent();
        expect(heading === 'Share feedback', heading);
        await tab.close();
    });

    await check('Review', '"Leave a review" opens the store review page and the card never returns', async () => {
        await page.evaluate(() => {
            const record = JSON.parse(localStorage.getItem('bos.review')!);
            localStorage.setItem('bos.review', JSON.stringify({ ...record, next: Date.now() - 1000 }));
        });
        const tab = await openNewTab(session);
        await tab.locator('.review-card').waitFor({ timeout: 8000 });
        // Chrome hides Chrome Web Store tabs from page-level automation, so the new tab is looked up in the browser's own target list.
        const cdp = await session.context.newCDPSession(tab);
        const storeTabs = async () => ((await cdp.send('Target.getTargets')).targetInfos as { type: string; url: string }[]).filter(target => target.type === 'page' && target.url.startsWith('https://chromewebstore.google.com/'));
        expect((await storeTabs()).length === 0, 'a store tab was already open');
        await tab.locator('.review-card a.button').click();
        let opened: { url: string }[] = [];
        for (let i = 0; i < 40 && !opened.length; i++) {
            await tab.waitForTimeout(250);
            opened = await storeTabs();
        }
        // The store may add the listing's name to the address.
        expect(opened.length === 1 && /\/detail\/(.+\/)?oghlifenjhpbebcdeboejbmemelkfobe\/reviews/.test(opened[0]!.url), `store tabs: ${JSON.stringify(opened.map(target => target.url))}`);
        expect((await tab.locator('.review-card').count()) === 0, 'card still shown after choosing to review');
        const record = await tab.evaluate(() => JSON.parse(localStorage.getItem('bos.review')!));
        expect(record.done === true, JSON.stringify(record));
        await tab.close();
        const next = await openNewTab(session);
        await next.waitForTimeout(1500);
        expect((await next.locator('.review-card').count()) === 0, 'card came back after a review');
        await next.close();
    });
} finally {
    await session.context.close();
    removeProfile(profile);
}
process.exit(report());

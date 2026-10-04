import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import { tr } from '../i18n/tr';
import { exportBackup } from './backup';
import { importBackup } from './backupImport';
import { CATEGORIES } from './catalog';
import { emptyState } from './defaults';
import { NAME_KEY, relocalize, type NameTexts } from './names';
import { addSpace, renameGroup, updateMode, updateSpace } from './ops';
import { MORE } from './recommendations';
import { sanitize } from './sanitize';
import { addService, applyProposals, applyStarter, fillFromCategory, type SetupNames } from './setup';
import type { AppState } from './types';
import { normalizeUrl } from './url';

type Dict = Partial<Record<string, string>>;
const texts = (lang: Dict): NameTexts => ({
    text: key => lang[key] ?? (en as Dict)[key] ?? key,
    known: key => [(en as Dict)[key], (tr as Dict)[key]].filter((x): x is string => !!x),
});
const setupIn = (lang: Dict): SetupNames => ({
    category: id => lang[`cat.${id}`] ?? (en as Dict)[`cat.${id}`]!,
    group: key => lang[`catgroup.${key}`] ?? (en as Dict)[`catgroup.${key}`]!,
    mode: key => lang[`modePreset.${key}`] ?? (en as Dict)[`modePreset.${key}`]!,
    otherSpace: lang['import.otherSpace'] ?? en['import.otherSpace'],
    importedGroup: lang['import.importedGroup'] ?? en['import.importedGroup'],
});
const EN = en as Dict;
const TR = tr as Dict;
const spaceNamed = (s: AppState, name: string) => Object.values(s.spaces).find(space => space.name === name);

describe('names Senuma gives follow the language', () => {
    it('a Space made in Turkish reads in English after switching, and back', () => {
        const turkish = applyStarter(emptyState(), ['finance', 'work', 'entertainment'], setupIn(TR));
        expect(spaceNamed(turkish, 'Finans')?.nameKey).toBe('cat.finance');
        const english = relocalize(turkish, texts(EN));
        expect(spaceNamed(english, 'Finance')).toBeTruthy();
        expect(spaceNamed(english, 'Finans')).toBeUndefined();
        expect(spaceNamed(relocalize(english, texts(TR)), 'Finans')).toBeTruthy();
    });

    it('catalog groups and starter Modes follow too', () => {
        const turkish = applyStarter(emptyState(), ['work', 'entertainment'], setupIn(TR));
        const media = spaceNamed(turkish, 'Medya')!;
        expect(media.groups.map(g => g.name)).toEqual(['İzle', 'Dinle', 'Keşfet']);
        const english = relocalize(turkish, texts(EN));
        expect(Object.values(english.spaces).find(s => s.id === media.id)!.groups.map(g => g.name)).toEqual(['Watch', 'Listen', 'Discover']);
        expect(Object.values(english.modes).map(m => m.name).sort()).toEqual(['Chill', 'Work']);
    });

    it('a name the person typed is never changed, for Spaces, groups and Modes', () => {
        let s = applyStarter(emptyState(), ['finance', 'work', 'entertainment'], setupIn(TR));
        const finance = spaceNamed(s, 'Finans')!;
        s = updateSpace(s, finance.id, { name: 'Para işleri' });
        expect(s.spaces[finance.id]!.nameKey).toBeUndefined();
        const media = spaceNamed(s, 'Medya')!;
        s = renameGroup(s, media.id, media.groups[0]!.id, 'Diziler');
        const mode = Object.values(s.modes)[0]!;
        s = updateMode(s, mode.id, { name: 'Odak' });
        const english = relocalize(s, texts(EN));
        expect(english.spaces[finance.id]!.name).toBe('Para işleri');
        expect(english.spaces[media.id]!.groups[0]!.name).toBe('Diziler');
        expect(english.spaces[media.id]!.groups[1]!.name).toBe('Listen');
        expect(english.modes[mode.id]!.name).toBe('Odak');
    });

    it('changing only the icon or colour keeps the name following the language', () => {
        let s = applyStarter(emptyState(), ['finance'], setupIn(TR));
        const id = spaceNamed(s, 'Finans')!.id;
        s = updateSpace(s, id, { glyph: 'star', name: 'Finans' });
        expect(relocalize(s, texts(EN)).spaces[id]!.name).toBe('Finance');
    });

    it('a setup from before keys were stored is recognised by exact default names only', () => {
        const legacy = sanitize({
            ...emptyState(),
            spaces: {
                a: { id: 'a', name: 'Finans', glyph: 'chart', accent: '#5CC2A0', templateId: 'finance', createdAt: 1, groups: [{ id: 'g1', name: '', itemIds: [] }] },
                b: { id: 'b', name: 'Medya', glyph: 'film', accent: '#E98B7A', templateId: 'entertainment', createdAt: 1, groups: [{ id: 'g2', name: 'Watch', itemIds: [] }, { id: 'g3', name: 'Filmlerim', itemIds: [] }] },
                c: { id: 'c', name: 'Borsa', glyph: 'chart', accent: '#5CC2A0', templateId: 'finance', createdAt: 1, groups: [{ id: 'g4', name: '', itemIds: [] }] },
                d: { id: 'd', name: 'Finans', glyph: 'chart', accent: '#5CC2A0', createdAt: 1, groups: [{ id: 'g5', name: '', itemIds: [] }] },
            },
            spaceOrder: ['a', 'b', 'c', 'd'],
        });
        const english = relocalize(legacy, texts(EN));
        expect(english.spaces.a!.name).toBe('Finance');
        expect(english.spaces.b!.name).toBe('Media');
        expect(english.spaces.b!.groups.map(g => g.name)).toEqual(['Watch', 'Filmlerim']);
        expect(english.spaces.c!.name).toBe('Borsa'); // renamed long ago: not a default name
        expect(english.spaces.d!.name).toBe('Finans'); // typed by the person: no catalog origin
    });

    it('the Bookmarks Space follows, its folder-named groups never do', () => {
        const s = applyProposals(emptyState(), [{ categoryId: null, links: [{ url: 'https://example.com', title: 'Example', folder: 'Watch' }] }], setupIn(TR)).state;
        const bookmarks = spaceNamed(s, 'Yer imleri')!;
        const english = relocalize(s, texts(EN));
        expect(english.spaces[bookmarks.id]!.name).toBe('Bookmarks');
        expect(english.spaces[bookmarks.id]!.groups.map(g => g.name)).toContain('Watch');
        expect(english.spaces[bookmarks.id]!.groups.every(g => !g.nameKey)).toBe(true);
    });

    it('returns the same object when nothing changes, so nothing is saved', () => {
        const s = relocalize(applyStarter(emptyState(), ['finance'], setupIn(EN)), texts(EN));
        expect(relocalize(s, texts(EN))).toBe(s);
    });

    it('keys survive saving, backup and import; anything else is dropped', () => {
        const s = applyStarter(emptyState(), ['finance', 'work', 'dev'], setupIn(TR));
        const back = importBackup(exportBackup(s))!;
        expect(spaceNamed(back, 'Finans')!.nameKey).toBe('cat.finance');
        expect(Object.values(back.modes).every(m => m.nameKey?.startsWith('modePreset.'))).toBe(true);
        const tampered = sanitize({ ...s, spaces: { ...s.spaces, x: { id: 'x', name: 'X', glyph: 'folder', accent: '#7C9CF0', createdAt: 1, nameKey: 'javascript:alert(1)', groups: [] } }, spaceOrder: [...s.spaceOrder, 'x'] });
        expect(tampered.spaces.x!.nameKey).toBeUndefined();
        expect(NAME_KEY.test('cat.finance') && NAME_KEY.test('import.otherSpace') && !NAME_KEY.test('cat.Finance')).toBe(true);
    });
});

describe('catalog and suggestions', () => {
    it('every group key and category has English and Turkish names', () => {
        for (const category of CATEGORIES) {
            expect(EN[`cat.${category.id}`] && TR[`cat.${category.id}`], category.id).toBeTruthy();
            for (const group of [...category.groups, ...(MORE[category.id] ?? [])]) {
                if (group.key) expect(EN[`catgroup.${group.key}`] && TR[`catgroup.${group.key}`], group.key).toBeTruthy();
            }
        }
        for (const id of Object.keys(MORE)) expect(CATEGORIES.some(c => c.id === id), id).toBe(true);
    });

    it('no category offers the same address or title twice, and every address is a valid https one', () => {
        for (const category of CATEGORIES) {
            const services = [...category.groups, ...(MORE[category.id] ?? [])].flatMap(g => g.services);
            const urls = services.map(([, url]) => normalizeUrl(url));
            expect(urls.every(url => url?.startsWith('https://')), category.id).toBe(true);
            expect(new Set(urls).size, `${category.id} addresses`).toBe(urls.length);
            expect(new Set(services.map(([title]) => title)).size, `${category.id} titles`).toBe(services.length);
        }
    });

    it('covers the services asked for in QA', () => {
        const all = new Set(CATEGORIES.flatMap(c => [...c.groups, ...(MORE[c.id] ?? [])].flatMap(g => g.services.map(([title]) => title))));
        const wanted = [
            'Instagram', 'TikTok', 'Threads', 'X', 'Reddit', 'Discord', 'Bluesky', 'Snapchat', 'Pinterest', 'LinkedIn', 'Telegram', 'Facebook',
            'ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'Copilot', 'Grok', 'Hugging Face', 'Runway',
            'GitHub', 'Vercel', 'Stack Overflow', 'npm', 'Docker Hub', 'Cloudflare', 'Supabase', 'Firebase', 'Neon', 'MDN',
            'Gmail', 'Google Drive', 'Google Calendar', 'Notion', 'Slack', 'Microsoft Teams', 'Linear', 'Trello', 'Asana', 'Figma',
            'YouTube', 'Netflix', 'Prime Video', 'Disney+', 'HBO Max', 'Letterboxd',
            'Twitch', 'Kick', 'YouTube Gaming', 'Steam', 'Epic Games', 'Xbox', 'PlayStation',
            'Spotify', 'Apple Music', 'YouTube Music', 'SoundCloud',
            'Google News', 'Reuters', 'AP News', 'BBC News', 'Wikipedia', 'Medium', 'Hacker News',
            'Amazon', 'Trendyol', 'Hepsiburada', 'AliExpress', 'Etsy',
            'TradingView', 'Investing.com', 'Yahoo Finance', 'CoinMarketCap', 'Binance',
        ];
        expect(wanted.filter(title => !all.has(title))).toEqual([]);
    });

    it('starting a Space adds only the short starter set, never the suggestions', () => {
        const s = applyStarter(emptyState(), ['social'], setupIn(EN));
        const titles = Object.values(s.items).map(i => i.title);
        expect(titles).toContain('Instagram');
        expect(titles).not.toContain('TikTok');
    });

    it('a suggestion goes into its own group, once', () => {
        let s = applyStarter(emptyState(), ['research'], setupIn(TR));
        const id = spaceNamed(s, 'Araştırma')!.id;
        const news = MORE.research!.find(g => g.key === 'news')!;
        s = addService(s, id, 'news', news.services[0]!, setupIn(TR));
        s = addService(s, id, 'news', news.services[0]!, setupIn(TR));
        const group = s.spaces[id]!.groups.find(g => g.nameKey === 'catgroup.news')!;
        expect(group.name).toBe('Haberler');
        expect(group.itemIds.length).toBe(1);
        // A starter group found again by key, not a second copy.
        const before = s.spaces[id]!.groups.length;
        s = fillFromCategory(s, id, 'research', setupIn(TR));
        expect(s.spaces[id]!.groups.length).toBe(before);
    });

    it('a Space the person made keeps its own name when a set is added to it', () => {
        const created = addSpace(emptyState(), { name: 'My money' });
        const s = fillFromCategory(created.state, created.id, 'finance', setupIn(EN));
        expect(relocalize(s, texts(TR)).spaces[created.id]!.name).toBe('My money');
    });
});

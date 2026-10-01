/** Side effects shared across features: launching, searching, running command Actions. */
import { BRAND } from '../brand';
import { exportBackup } from '../core/backup';
import type { Action, CommandLabels } from '../core/commands';
import { recordRecent, setActiveMode, setPrefs } from '../core/ops';
import { FALLBACK_SEARCH_URL, findProvider, searchUrl } from '../core/search';
import type { SetupNames } from '../core/setup';
import { THEMES } from '../core/themes';
import type { ID, LooseLink } from '../core/types';
import { t, type MessageKey } from '../i18n';
import { app, setUi, update } from '../storage/store';

function navigate(url: string, newTab = app.get().prefs.openInNewTab): void {
    if (newTab) window.open(url, '_blank', 'noopener');
    else location.assign(url);
}

/** Remembers a destination the user chose to open, for Continue. */
export function remember(url: string, title: string): void {
    update(s => recordRecent(s, { url, title }));
}

export function launch(url: string, title: string, newTab?: boolean): void {
    remember(url, title);
    navigate(url, newTab);
}

export function runSearch(providerId: ID, query: string): void {
    const provider = findProvider(app.get().providers, providerId);
    const url = searchUrl(provider, query);
    if (url) return navigate(url);
    // The default search goes through the browser so the user's chosen engine is respected.
    if (typeof chrome !== 'undefined' && chrome.search?.query) {
        void chrome.search.query({ text: query, disposition: app.get().prefs.openInNewTab ? 'NEW_TAB' : 'CURRENT_TAB' });
    } else {
        navigate(FALLBACK_SEARCH_URL.replace('%s', encodeURIComponent(query)));
    }
}

export function runAction(action: Action): void {
    switch (action.type) {
        case 'open':
            return launch(action.url, action.title);
        case 'search':
            return runSearch(action.providerId, action.query);
        case 'space':
            return setUi({ palette: false, spaceId: action.id });
        case 'mode':
            setUi({ palette: false });
            return update(s => setActiveMode(s, action.id));
        case 'theme':
            setUi({ palette: false });
            return update(s => setPrefs(s, { themeId: action.id }));
        case 'settings':
            return setUi({ palette: false, settings: action.section ?? 'appearance' });
        case 'new-space':
            return setUi({ palette: false, editor: { kind: 'space' } });
    }
}

export const SETTINGS_SECTIONS = ['appearance', 'spaces', 'modes', 'search', 'data', 'privacy', 'keyboard', 'about'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function setupNames(): SetupNames {
    return {
        category: id => t(`cat.${id}` as MessageKey),
        mode: key => t(`modePreset.${key}` as MessageKey),
        otherSpace: t('import.otherSpace'),
        importedGroup: t('import.importedGroup'),
    };
}

export function commandLabels(): CommandLabels {
    return {
        allSpaces: t('mode.all'),
        modeHint: t('hint.mode'),
        spaceHint: t('hint.space'),
        themeHint: t('hint.theme'),
        recentHint: t('hint.recent'),
        newSpace: t('space.new'),
        settings: t('settings.title'),
        settingsSections: SETTINGS_SECTIONS.map(id => ({ id, label: t(`settings.${id}` as MessageKey) })),
        searchWith: (provider, query) =>
            provider === 'Browser default' ? t('search.web', { query }) : t('search.with', { provider, query }),
        openUrl: host => t('search.openUrl', { host }),
        themes: THEMES.map(theme => ({ id: theme.id, name: theme.name })),
    };
}

export function downloadBackup(): void {
    const blob = new Blob([exportBackup(app.get())], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${BRAND.backupFilePrefix}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}

export type BookmarkRead = { ok: true; links: LooseLink[] } | { ok: false; reason: 'unavailable' | 'denied' };

/** Asks for bookmark access (only now, only when the user starts an import) and reads them. */
export async function readBrowserBookmarks(): Promise<BookmarkRead> {
    if (typeof chrome === 'undefined' || !chrome.permissions) return { ok: false, reason: 'unavailable' };
    const granted = await chrome.permissions.request({ permissions: ['bookmarks'] });
    if (!granted) return { ok: false, reason: 'denied' };
    const links: LooseLink[] = [];
    const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], folder: string) => {
        for (const node of nodes) {
            if (node.url) links.push({ title: node.title, url: node.url, folder });
            if (node.children) walk(node.children, node.title || folder);
        }
    };
    walk(await chrome.bookmarks.getTree(), '');
    return { ok: true, links };
}

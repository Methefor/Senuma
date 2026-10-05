/** Side effects shared across features: launching, searching, undoable removals, backups. */
import { BRAND } from '../brand';
import { searchWithBrowserDefault } from '../browser/search';
import { addSnapshot, exportBackup } from '../core/backup';
import type { Action, CommandLabels } from '../core/commands';
import {
    captureGroup, captureItem, captureSpace, recordRecent, removeGroup, removeItem, removeSpace, restoreGroup, restoreItem, restoreSpace,
    setActiveMode, setPrefs,
} from '../core/ops';
import { findProvider, searchUrl } from '../core/search';
import type { SetupNames } from '../core/setup';
import { THEMES } from '../core/themes';
import type { AppState, ID, Snapshot } from '../core/types';
import { t, type MessageKey } from '../i18n';
import { loadSnapshots, saveSnapshots } from '../storage/storage';
import { app, setUi, snapshots, toast, update } from '../storage/store';

/** Used only where the browser search API does not exist (the development preview). */
const PREVIEW_SEARCH_URL = 'https://www.google.com/search?q=';

function navigate(url: string, newTab = app.get().prefs.openInNewTab): void {
    if (newTab) window.open(url, '_blank', 'noopener');
    else location.assign(url);
}

/** Remembers a destination the user chose to open, for Continue. */
export function remember(url: string, title: string, spaceId?: ID): void {
    update(s => recordRecent(s, { url, title, ...(spaceId ? { spaceId } : {}) }));
}

export function launch(url: string, title: string, options: { newTab?: boolean; spaceId?: ID } = {}): void {
    remember(url, title, options.spaceId);
    navigate(url, options.newTab);
}

export async function runSearch(providerId: ID, query: string): Promise<void> {
    const provider = findProvider(app.get().providers, providerId);
    const url = searchUrl(provider, query);
    if (url) return navigate(url);
    const result = await searchWithBrowserDefault(query, app.get().prefs.openInNewTab);
    if (result.ok) return;
    if (result.reason === 'unavailable') navigate(PREVIEW_SEARCH_URL + encodeURIComponent(query));
    else toast(t('error.search'));
}

/** Runs a command Action. `prefill` is handled by the launcher itself and is ignored here. */
export function runAction(action: Action): void {
    switch (action.type) {
        case 'open':
            return launch(action.url, action.title, { spaceId: action.spaceId });
        case 'search':
            return void runSearch(action.providerId, action.query);
        case 'space':
            return setUi({ palette: false, spaceId: action.id, origin: null });
        case 'mode':
            setUi({ palette: false });
            return update(s => setActiveMode(s, action.id));
        case 'theme':
            setUi({ palette: false });
            return update(s => setPrefs(s, { themeId: action.id }));
        case 'settings':
            return setUi({ palette: false, settings: action.section ?? 'appearance' });
        case 'customize':
            return setUi({ palette: false, customize: true });
        case 'new-space':
            return setUi({ palette: false, editor: { kind: 'space' } });
        case 'prefill':
            return;
    }
}

// ---------- Undoable removals ----------

export function removeItemWithUndo(itemId: ID): void {
    const removed = captureItem(app.get(), itemId);
    if (!removed) return;
    update(s => removeItem(s, itemId));
    toast(t('item.removed', { name: removed.item.title }), s => restoreItem(s, removed));
}

export function removeSpaceWithUndo(spaceId: ID): void {
    const removed = captureSpace(app.get(), spaceId);
    if (!removed) return;
    update(s => removeSpace(s, spaceId));
    setUi({ spaceId: null });
    toast(t('space.deleted', { name: removed.space.name }), s => restoreSpace(s, removed));
}

export function removeGroupWithUndo(spaceId: ID, groupId: ID): void {
    const removed = captureGroup(app.get(), spaceId, groupId);
    if (!removed) return;
    update(s => removeGroup(s, spaceId, groupId));
    toast(t('group.deleted'), s => restoreGroup(s, removed));
}

// ---------- Restore points ----------

export async function ensureSnapshots(): Promise<Snapshot[]> {
    const current = snapshots.get();
    if (current) return current;
    const loaded = await loadSnapshots().catch(() => []);
    snapshots.set(loaded);
    return loaded;
}

/**
 * Replaces the whole setup, first saving the current one as a local restore point.
 * If the restore point cannot be written the replacement does not happen.
 */
export async function replaceSetup(next: AppState, reason: Snapshot['reason']): Promise<boolean> {
    const list = addSnapshot(await ensureSnapshots(), app.get(), reason);
    try {
        await saveSnapshots(list);
    } catch {
        toast(t('error.snapshot'));
        return false;
    }
    snapshots.set(list);
    update(() => ({ ...next }));
    return true;
}

export async function deleteSnapshot(id: ID): Promise<void> {
    const list = (await ensureSnapshots()).filter(s => s.id !== id);
    snapshots.set(list);
    await saveSnapshots(list).catch(() => toast(t('error.save')));
}

// ---------- Labels and files ----------

export const SETTINGS_SECTIONS = ['appearance', 'spaces', 'modes', 'search', 'data', 'privacy', 'keyboard', 'help', 'about'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function setupNames(): SetupNames {
    return {
        category: id => t(`cat.${id}` as MessageKey),
        group: key => t(`catgroup.${key}` as MessageKey),
        mode: key => t(`modePreset.${key}` as MessageKey),
        otherSpace: t('import.otherSpace'),
        importedGroup: t('import.importedGroup'),
    };
}

export function providerLabel(provider: { name: string; browserDefault?: boolean }): string {
    return provider.browserDefault ? t('search.browserDefault') : provider.name;
}

export function commandLabels(): CommandLabels {
    return {
        openSpace: name => t('command.openSpace', { name }),
        switchMode: name => t('command.switchMode', { name }),
        showAllSpaces: t('command.showAll'),
        useTheme: name => t('command.useTheme', { name }),
        createSpace: t('command.createSpace'),
        customize: t('command.customize'),
        openSettings: t('command.openSettings'),
        openSettingsSection: label => t('command.openSettingsSection', { label }),
        settingsSections: SETTINGS_SECTIONS.map(id => ({ id, label: t(`settings.${id}` as MessageKey) })),
        providerName: (_id, name) => name,
        searchWith: (provider, query) => t('search.with', { provider, query }),
        searchWeb: query => t('search.web', { query }),
        searchPrompt: provider => t('search.prompt', { provider }),
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

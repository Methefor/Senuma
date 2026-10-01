/** Shared test fixtures. */
import type { CommandContext, CommandLabels } from './commands';
import { emptyState } from './defaults';
import * as ops from './ops';
import type { SetupNames } from './setup';
import type { AppState } from './types';

export const names: SetupNames = {
    category: id => id.toUpperCase(),
    mode: key => `${key} mode`,
    otherSpace: 'Other',
    importedGroup: 'Imported',
};

export const labels: CommandLabels = {
    openSpace: name => `Open ${name}`,
    switchMode: name => `Switch to ${name} Mode`,
    showAllSpaces: 'Show all Spaces',
    useTheme: name => `Use ${name} theme`,
    createSpace: 'Create Space',
    customize: 'Customize appearance',
    openSettings: 'Open Settings',
    openSettingsSection: label => `Open Settings: ${label}`,
    settingsSections: [{ id: 'search', label: 'Search' }, { id: 'privacy', label: 'Privacy' }],
    providerName: (_id, name) => name,
    searchWith: (p, q) => `Search ${p} for ${q}`,
    searchWeb: q => `Search the web for ${q}`,
    searchPrompt: p => `Search ${p}…`,
    openUrl: host => `Open ${host}`,
    themes: [{ id: 'noir', name: 'Noir' }],
};

export const context = (surface: CommandContext['surface'] = 'palette'): CommandContext =>
    ({ surface, defaultProviderId: 'default', labels, now: 1_000_000_000_000 });

/** One Space "Dev" holding GitHub and Claude. */
export function seeded(): { state: AppState; spaceId: string; github: string; claude: string } {
    const created = ops.addSpace(emptyState(), { name: 'Dev' });
    const a = ops.addItem(created.state, created.id, null, { url: 'github.com', title: 'GitHub' });
    const b = ops.addItem(a.state, created.id, null, { url: 'https://claude.ai', title: 'Claude' });
    return { state: b.state, spaceId: created.id, github: a.id!, claude: b.id! };
}

/** A realistic 1.x `ntf_data` value, including the kinds of damage seen in the wild. */
export const LEGACY = {
    theme: 'light',
    language: 'TR',
    isPro: true,
    proExpiresAt: 123,
    folders: [
        {
            id: 'f2', name: 'Ai Tools', color: 'blue',
            links: [
                { id: 'l0', title: 'Loose', url: 'https://example.com', icon: '📁' },
                { id: 'h1', title: 'Works', type: 'header' },
                { id: 'l6', title: 'GitHub', url: 'https://github.com', icon: 'https://www.google.com/s2/favicons?domain=github.com&sz=128' },
                { id: 'h2', title: 'Ai Chat', type: 'header' },
                { id: 'l9', title: 'Claude', url: 'claude.ai' },
                { id: 'l9', title: 'Gemini', url: 'https://gemini.google.com' },
                { id: 'bad', title: 'My Portfolio', url: '#' },
                { id: 'note', title: 'A sticky note', type: 'note', url: 'https://example.org' },
                null,
            ],
        },
        'garbage',
        { id: 'f2', name: 'Ai Tools', links: [{ id: 'l6c', title: 'GitHub', url: 'https://github.com' }] },
        { id: 'f3', name: '', links: 'not-an-array' },
    ],
};

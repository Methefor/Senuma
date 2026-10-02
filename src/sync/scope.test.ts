import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, emptyState } from '../core/defaults';
import * as ops from '../core/ops';
import type { AppState } from '../core/types';
import { workspace } from './fixtures';
import { canonical } from './merge';
import { PREF_SCOPE, STATE_SCOPE, applySyncable, toSyncable } from './scope';

/** A setup with something in every part that must stay on the device. */
function lived(): AppState {
    let state = workspace({ links: 10, spaces: 2 });
    state = ops.recordRecent(state, { url: 'https://private-visit.example/page', title: 'Private visit' });
    state = ops.recordUsage(state, 'usage-marker');
    state = ops.addWallpaper(state, { id: 'wall1', name: 'holiday-photo.jpg', width: 10, height: 10, bytes: 100, color: '#000000', luminance: 0, lqip: 'data:image/webp;base64,LQIPMARKER', createdAt: 1 });
    const mode = ops.addMode(state, { name: 'Evening', glyph: 'E', spaceIds: [...state.spaceOrder] });
    return {
        ...mode.state,
        activeModeId: mode.id,
        onboarded: true,
        updatedAt: 123456,
        prefs: { ...mode.state.prefs, motion: 'off', iconSource: 'service', showClosedTabs: true },
        legacy: { isPro: true, proExpiresAt: null, licenseKey: 'LICENCE-MARKER', migratedAt: 1, acknowledged: true, summary: { spaces: 1, links: 1, groups: 0, skipped: 0 } },
    };
}

describe('what is uploaded', () => {
    it('classifies every field of the saved state and every preference', () => {
        expect(Object.keys(STATE_SCOPE).sort()).toEqual([...Object.keys(emptyState()), 'legacy'].sort());
        expect(Object.keys(PREF_SCOPE).sort()).toEqual(Object.keys(DEFAULT_PREFS).sort());
    });

    it('never includes activity, wallpaper files or their names, the 1.x record, or device-bound switches', () => {
        const text = JSON.stringify(toSyncable(lived()));
        for (const marker of ['private-visit', 'Private visit', 'usage-marker', 'holiday-photo', 'LQIPMARKER', 'LICENCE-MARKER', 'recents', 'usage', 'wallpapers', 'legacy', 'onboarded', 'updatedAt', 'activeModeId', 'motion', 'iconSource', 'showClosedTabs']) {
            expect(text.includes(marker), marker).toBe(false);
        }
    });

    it('includes Spaces, groups, links, Modes, dock, search providers and appearance', () => {
        const state = lived();
        const doc = toSyncable(state);
        expect(doc.spaces).toEqual(state.spaces);
        expect(doc.items).toEqual(state.items);
        expect(doc.modes).toEqual(state.modes);
        expect(doc.dock).toEqual(state.dock);
        expect(doc.providers).toEqual(state.providers);
        expect(Object.keys(doc.prefs).sort()).toEqual(['atmosphere', 'background', 'defaultProviderId', 'dockLabels', 'language', 'openInNewTab', 'showContinue', 'showDock', 'themeId']);
    });

    it('carries an uploaded picture only as a reference, never its pixels or preview', () => {
        const state = ops.setPrefs(lived(), { background: { ...DEFAULT_PREFS.background, source: { kind: 'upload', assetId: 'wall1' } } });
        const doc = toSyncable(state);
        expect(doc.prefs.background.source).toEqual({ kind: 'upload', assetId: 'wall1' });
        expect(JSON.stringify(doc).includes('LQIPMARKER')).toBe(false);
    });
});

describe('applying a synced copy', () => {
    it('leaves everything local exactly as it was', () => {
        const mine = lived();
        const applied = applySyncable(mine, toSyncable(workspace({ links: 5, spaces: 1 }, 9)))!;
        for (const key of ['recents', 'usage', 'wallpapers', 'legacy', 'onboarded', 'updatedAt'] as const) expect(applied[key]).toEqual(mine[key]);
        expect(applied.prefs).toMatchObject({ motion: 'off', iconSource: 'service', showClosedTabs: true });
    });

    it('then looks unchanged: a device that applied a copy has nothing to send back', () => {
        for (let seed = 1; seed <= 25; seed++) {
            const doc = toSyncable(workspace({ links: seed * 3, spaces: 1 + (seed % 4) }, seed));
            expect(canonical(toSyncable(applySyncable(lived(), doc)!)), `seed ${seed}`).toBe(canonical(doc));
        }
    });

    it('turns off a Mode that no longer exists, and keeps one that does', () => {
        const mine = lived();
        expect(applySyncable(mine, toSyncable(workspace({ links: 2 })))!.activeModeId).toBeNull();
        expect(applySyncable(mine, toSyncable(mine))!.activeModeId).toBe(mine.activeModeId);
    });

    it('refuses a copy of another schema', () => {
        const mine = lived();
        expect(applySyncable(mine, { ...toSyncable(mine), schema: mine.schema + 1 })).toBeNull();
        expect(applySyncable(mine, { ...toSyncable(mine), schema: mine.schema - 1 })).toBeNull();
    });

    it('does not share memory with the copy it was given', () => {
        const mine = lived();
        const doc = toSyncable(workspace({ links: 3 }));
        const applied = applySyncable(mine, doc)!;
        Object.values(doc.items)[0]!.title = 'changed afterwards';
        expect(Object.values(applied.items)[0]!.title).not.toBe('changed afterwards');
    });
});

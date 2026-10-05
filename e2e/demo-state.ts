/**
 * The demo setup every marketing capture starts from (docs/MEDIA_PLAN.md §0): the five starter
 * Spaces in English, three dock entries opened a few minutes apart, Dusk with the Mountain Mirror
 * photograph, real site icons, and Mode looks so switching Modes is visible.
 */
import { DEFAULT_BACKGROUND } from '../src/core/background';
import { emptyState } from '../src/core/defaults';
import * as ops from '../src/core/ops';
import { applyStarter, type SetupNames } from '../src/core/setup';
import type { AppState } from '../src/core/types';
import { en } from '../src/i18n/en';

/** Captures read as an evening session: “Good evening”, a 7:15 PM clock. */
export const CAPTURE_TIME = new Date(2026, 9, 5, 19, 15, 0);

let written = 0;
/**
 * The page clock is pinned at CAPTURE_TIME, so every change the page makes is stamped with that
 * same moment. A tab adopts stored state only when it is strictly newer than its own fast-start
 * copy, so each state a capture writes is stamped a minute later than the last.
 */
export const nextStamp = (): number => CAPTURE_TIME.getTime() + ++written * 60_000;

const names: SetupNames = {
    category: id => en[`cat.${id}` as keyof typeof en] as string,
    group: key => en[`catgroup.${key}` as keyof typeof en] as string,
    mode: key => en[`modePreset.${key}` as keyof typeof en] as string,
    otherSpace: en['import.otherSpace'], importedGroup: en['import.importedGroup'],
};

export function demo(options: { modeLooks?: boolean } = {}): AppState {
    let state = applyStarter(emptyState(), ['ai', 'dev', 'work', 'entertainment', 'design'], names);
    const now = CAPTURE_TIME.getTime();
    ['GitHub', 'Vercel', 'Letterboxd'].forEach((title, index) => {
        const item = Object.values(state.items).find(i => i.title === title);
        if (!item) return;
        state = ops.toggleDock(state, { kind: 'item', id: item.id });
        state = ops.recordRecent(state, { url: item.url, title: item.title });
        state = { ...state, recents: state.recents.map(r => (r.url === item.url ? { ...r, at: now - (index * 47 + 3) * 60_000 } : r)) };
    });
    for (const id of state.modeOrder) {
        const mode = state.modes[id]!;
        if (mode.name === 'Dev') state = ops.updateMode(state, id, { themeId: 'phosphor', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'ink' }, dim: 0.06 } });
        if (!options.modeLooks) continue;
        if (mode.name === 'Work') state = ops.updateMode(state, id, { themeId: 'atelier' });
        if (mode.name === 'Chill') state = ops.updateMode(state, id, { background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'toronto-night' }, dim: 0.35 } });
    }
    return {
        ...state, onboarded: true, updatedAt: now,
        prefs: { ...state.prefs, iconSource: 'site', themeId: 'dusk', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'mountain-mirror' }, dim: 0.43 } },
    };
}

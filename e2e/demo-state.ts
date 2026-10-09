/**
 * The demo setup every marketing capture starts from (docs/MEDIA_PLAN.md §0): starter Spaces in
 * the capture's language, three dock entries opened a few minutes apart, Dusk with the Mountain
 * Mirror photograph, real site icons, and Mode looks so switching Modes is visible.
 */
import { DEFAULT_BACKGROUND } from '../src/core/background';
import { emptyState } from '../src/core/defaults';
import * as ops from '../src/core/ops';
import { applyStarter, type SetupNames } from '../src/core/setup';
import type { AppState, Language } from '../src/core/types';
import { en } from '../src/i18n/en';
import { tr } from '../src/i18n/tr';

/** Captures read as an evening session: “Good evening”, a 7:15 PM clock. */
export const CAPTURE_TIME = new Date(2026, 9, 5, 19, 15, 0);

let written = 0;
/**
 * The page clock is pinned at CAPTURE_TIME, so every change the page makes is stamped with that
 * same moment. A tab adopts stored state only when it is strictly newer than its own fast-start
 * copy, so each state a capture writes is stamped a minute later than the last.
 */
export const nextStamp = (): number => CAPTURE_TIME.getTime() + ++written * 60_000;

type Words = Record<keyof typeof en, string>;
const WORDS: Record<Language, Words> = { en, tr: { ...en, ...tr } };

/** The interface's own words in a capture's language, so scripts click what is really on screen. */
export function words(language: Language): (key: keyof typeof en, params?: Record<string, string | number>) => string {
    return (key, params = {}) => WORDS[language][key].replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export interface DemoOptions {
    modeLooks?: boolean;
    language?: Language;
    /** Catalog ids of the starter Spaces. Portrait captures use four, with Gaming. */
    interests?: string[];
}

/** A Mode by the key Senuma gave it, whatever language its name is in. */
export const modeId = (state: AppState, key: 'work' | 'dev' | 'chill' | 'gaming'): string =>
    state.modeOrder.find(id => state.modes[id]!.nameKey === `modePreset.${key}`)!;

export function demo(options: DemoOptions = {}): AppState {
    const language = options.language ?? 'en';
    const t = WORDS[language];
    const names: SetupNames = {
        category: id => t[`cat.${id}` as keyof typeof en],
        group: key => t[`catgroup.${key}` as keyof typeof en],
        mode: key => t[`modePreset.${key}` as keyof typeof en],
        otherSpace: t['import.otherSpace'], importedGroup: t['import.importedGroup'],
    };
    let state = applyStarter(emptyState(), options.interests ?? ['ai', 'dev', 'work', 'entertainment', 'design'], names);
    const now = CAPTURE_TIME.getTime();
    ['GitHub', 'Vercel', 'Letterboxd'].forEach((title, index) => {
        const item = Object.values(state.items).find(i => i.title === title);
        if (!item) return;
        state = ops.toggleDock(state, { kind: 'item', id: item.id });
        state = ops.recordRecent(state, { url: item.url, title: item.title });
        state = { ...state, recents: state.recents.map(r => (r.url === item.url ? { ...r, at: now - (index * 47 + 3) * 60_000 } : r)) };
    });
    for (const id of state.modeOrder) {
        const key = state.modes[id]!.nameKey;
        if (key === 'modePreset.dev') state = ops.updateMode(state, id, { themeId: 'phosphor', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'ink' }, dim: 0.06 } });
        if (!options.modeLooks) continue;
        if (key === 'modePreset.work') state = ops.updateMode(state, id, { themeId: 'atelier' });
        if (key === 'modePreset.chill') state = ops.updateMode(state, id, { background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'toronto-night' }, dim: 0.35 } });
        if (key === 'modePreset.gaming') state = ops.updateMode(state, id, { themeId: 'noir', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'bokeh' }, dim: 0.4 } });
    }
    return {
        ...state, onboarded: true, updatedAt: now,
        prefs: { ...state.prefs, language, iconSource: 'site', themeId: 'dusk', background: { ...DEFAULT_BACKGROUND, source: { kind: 'preset', id: 'mountain-mirror' }, dim: 0.43 } },
    };
}

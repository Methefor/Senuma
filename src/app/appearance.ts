/**
 * The look in effect: theme, background, atmosphere and motion. It is what is saved, unless
 * the Customize panel is open, in which case it is the draft being tried out. Nothing is
 * written until the user applies it.
 */
import { ATMOSPHERE_STRENGTH, type AtmosphereLevel, type Background } from '../core/background';
import { activeMode, effectiveBackground, effectiveThemeId, setPrefs, updateMode } from '../core/ops';
import { applyTheme, themeById } from '../core/themes';
import type { AppState, MotionLevel } from '../core/types';

export interface Appearance {
    themeId: string;
    background: Background;
    atmosphere: AtmosphereLevel;
    motion: MotionLevel;
}

export function savedAppearance(state: AppState): Appearance {
    return {
        themeId: effectiveThemeId(state),
        background: effectiveBackground(state),
        atmosphere: state.prefs.atmosphere,
        motion: state.prefs.motion,
    };
}

/** Writes the non-picture parts of a look onto the document. The picture is rendered by Backdrop. */
export function applyAppearance(appearance: Appearance, language: string): void {
    const root = document.documentElement;
    applyTheme(themeById(appearance.themeId), root);
    root.dataset.motion = appearance.motion;
    root.dataset.atmosphere = appearance.atmosphere;
    root.style.setProperty('--atmo', String(ATMOSPHERE_STRENGTH[appearance.atmosphere]));
    // Surfaces get more body over a picture than over the theme's own calm backdrop.
    root.dataset.backdrop = appearance.background.source.kind === 'theme' ? 'theme' : 'picture';
    root.lang = language;
}

/**
 * Saves a look. Atmosphere and motion are personal comfort settings and are always global.
 * Theme and background go to the active Mode when `forMode` is set, else to the defaults.
 */
export function commitAppearance(state: AppState, appearance: Appearance, forMode: boolean): AppState {
    const mode = forMode ? activeMode(state) : undefined;
    const comfort = setPrefs(state, { atmosphere: appearance.atmosphere, motion: appearance.motion });
    if (mode) return updateMode(comfort, mode.id, { themeId: appearance.themeId, background: appearance.background });
    return setPrefs(comfort, { themeId: appearance.themeId, background: appearance.background });
}

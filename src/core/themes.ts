/**
 * Theme engine. A theme is data: one value for every design token. Components read tokens
 * and never know which theme is active, so a new theme (or a shared one, later) is new data
 * and no new code. The `TokenName` type makes a theme with a missing token a compile error.
 */

export type TokenName =
    // Background: what the page is painted on when no wallpaper is chosen
    | '--bg-color' | '--bg-image' | '--bg-glow'
    /** RGB triplet laid over a wallpaper so it takes on the theme mood and text stays readable. */
    | '--bg-wash'
    // Atmosphere: strengths are 0–1 and are scaled by the chosen atmosphere level
    | '--atmo-grain' | '--atmo-vignette' | '--atmo-scan' | '--atmo-bloom' | '--atmo-fog'
    // Text
    | '--text-primary' | '--text-secondary' | '--text-tertiary'
    // Surfaces: primary = resting, secondary = raised or hovered, glass = floating panels
    | '--surface-primary' | '--surface-secondary' | '--surface-glass'
    | '--border-subtle' | '--border-strong'
    | '--accent' | '--accent-contrast' | '--danger'
    // Shape and depth
    | '--radius-control' | '--radius-card' | '--blur-surface' | '--shadow-card'
    // Typography
    | '--font-ui' | '--font-display' | '--display-weight' | '--display-tracking' | '--greeting-size'
    | '--label-font' | '--label-style' | '--label-transform' | '--label-tracking' | '--label-size'
    // Icons and Space colour
    | '--tint-strength' | '--icon-filter'
    // Motion feel: multiplies every duration (below 1 is snappier)
    | '--motion-scale'
    // Composition
    | '--hero-justify' | '--hero-text'
    // Components
    | '--space-surface' | '--space-outline'
    | '--dock-surface' | '--dock-border' | '--dock-radius'
    | '--palette-surface' | '--palette-border';

export type ThemeTokens = Record<TokenName, string>;

export interface Theme {
    id: string;
    name: string;
    scheme: 'dark' | 'light';
    tokens: ThemeTokens;
}

const SANS = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif';
const SANS_DISPLAY = '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif';
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const MONO = '"Cascadia Code", "Cascadia Mono", "SF Mono", Consolas, "Liberation Mono", monospace';

/** No-op filter. `none` cannot be combined with other filter functions; this can. */
const NO_FILTER = 'opacity(1)';

// DUSK — a late-night creative workspace: deep navy, the last light on the horizon.
const dusk: Theme = {
    id: 'dusk',
    name: 'Dusk',
    scheme: 'dark',
    tokens: {
        '--bg-color': '#080a17',
        '--bg-image': 'linear-gradient(180deg, #06081a 0%, #0b0f24 46%, #161634 100%)',
        '--bg-glow': 'radial-gradient(140% 56% at 50% 112%, rgba(244,170,112,.52) 0%, rgba(206,96,118,.30) 28%, rgba(96,62,140,.16) 52%, transparent 72%)',
        '--bg-wash': '8 10 23',
        '--atmo-grain': '.07',
        '--atmo-vignette': '.45',
        '--atmo-scan': '0',
        '--atmo-bloom': '.55',
        '--atmo-fog': '22 18 52',
        '--text-primary': '#EEF0F7',
        '--text-secondary': 'rgba(238,240,247,.68)',
        '--text-tertiary': 'rgba(238,240,247,.46)',
        '--surface-primary': 'rgba(255,255,255,.055)',
        '--surface-secondary': 'rgba(255,255,255,.105)',
        '--surface-glass': 'rgba(16,18,38,.74)',
        '--border-subtle': 'rgba(255,255,255,.10)',
        '--border-strong': 'rgba(255,255,255,.22)',
        '--accent': '#F4BE8A',
        '--accent-contrast': '#1a1208',
        '--danger': '#F08A7B',
        '--radius-control': '14px',
        '--radius-card': '22px',
        '--blur-surface': '22px',
        '--shadow-card': '0 24px 60px -20px rgba(0,0,0,.65)',
        '--font-ui': SANS,
        '--font-display': SANS_DISPLAY,
        '--display-weight': '600',
        '--display-tracking': '-.02em',
        '--greeting-size': 'clamp(26px, 3.2vw, 38px)',
        '--label-font': SANS,
        '--label-style': 'normal',
        '--label-transform': 'uppercase',
        '--label-tracking': '.14em',
        '--label-size': '11px',
        '--tint-strength': '1',
        '--icon-filter': NO_FILTER,
        '--motion-scale': '1',
        '--hero-justify': 'center',
        '--hero-text': 'center',
        '--space-surface': 'rgba(255,255,255,.055)',
        '--space-outline': 'rgba(255,255,255,.06)',
        '--dock-surface': 'rgba(16,18,38,.66)',
        '--dock-border': 'rgba(255,255,255,.10)',
        '--dock-radius': '24px',
        '--palette-surface': 'rgba(14,16,34,.88)',
        '--palette-border': 'rgba(255,255,255,.20)',
    },
};

function derive(id: string, name: string, scheme: Theme['scheme'], tokens: Partial<ThemeTokens>): Theme {
    return { id, name, scheme, tokens: { ...dusk.tokens, ...tokens } };
}

export const THEMES: readonly Theme[] = [
    dusk,

    // NOIR — OLED black, monochrome, nothing decorative. Colour appears only under the pointer.
    derive('noir', 'Noir', 'dark', {
        '--bg-color': '#000000',
        '--bg-image': 'linear-gradient(180deg, #000 0%, #000 100%)',
        '--bg-glow': 'none',
        '--bg-wash': '0 0 0',
        '--atmo-grain': '.03',
        '--atmo-vignette': '0',
        '--atmo-bloom': '0',
        '--atmo-fog': '0 0 0',
        '--text-primary': '#F4F4F4',
        '--text-secondary': 'rgba(244,244,244,.66)',
        '--text-tertiary': 'rgba(244,244,244,.46)',
        '--surface-primary': 'rgba(255,255,255,.04)',
        '--surface-secondary': 'rgba(255,255,255,.095)',
        '--surface-glass': 'rgba(9,9,9,.94)',
        '--border-subtle': 'rgba(255,255,255,.10)',
        '--border-strong': 'rgba(255,255,255,.30)',
        '--accent': '#FFFFFF',
        '--accent-contrast': '#000000',
        '--radius-control': '10px',
        '--radius-card': '14px',
        '--blur-surface': '0px',
        '--shadow-card': '0 0 0 1px rgba(255,255,255,.10)',
        '--display-weight': '500',
        '--display-tracking': '-.03em',
        '--tint-strength': '0',
        '--icon-filter': 'grayscale(1) contrast(1.1)',
        '--motion-scale': '.8',
        '--space-surface': 'rgba(255,255,255,.035)',
        '--space-outline': 'rgba(255,255,255,.09)',
        '--dock-surface': 'rgba(0,0,0,.9)',
        '--dock-border': 'rgba(255,255,255,.16)',
        '--dock-radius': '16px',
        '--palette-surface': 'rgba(6,6,6,.97)',
        '--palette-border': 'rgba(255,255,255,.28)',
    }),

    // ATELIER — a warm studio: stone, beige and warm charcoal, a serif for the display type.
    derive('atelier', 'Atelier', 'dark', {
        '--bg-color': '#1c1a17',
        '--bg-image': 'radial-gradient(70% 60% at 100% 100%, rgba(120,92,70,.24) 0%, transparent 65%), linear-gradient(160deg, #1a1815 0%, #221e1a 55%, #2c2620 100%)',
        '--bg-glow': 'radial-gradient(90% 70% at 12% -10%, rgba(214,180,128,.24) 0%, transparent 60%)',
        '--bg-wash': '28 26 23',
        '--atmo-grain': '.10',
        '--atmo-vignette': '.32',
        '--atmo-bloom': '.4',
        '--atmo-fog': '44 36 28',
        '--text-primary': '#EFE8DC',
        '--text-secondary': 'rgba(239,232,220,.68)',
        '--text-tertiary': 'rgba(239,232,220,.46)',
        '--surface-primary': 'rgba(239,226,204,.05)',
        '--surface-secondary': 'rgba(239,226,204,.105)',
        '--surface-glass': 'rgba(34,30,26,.86)',
        '--border-subtle': 'rgba(239,226,204,.11)',
        '--border-strong': 'rgba(239,226,204,.26)',
        '--accent': '#D2B48C',
        '--accent-contrast': '#1d1710',
        '--radius-control': '8px',
        '--radius-card': '12px',
        '--font-display': SERIF,
        '--display-weight': '500',
        '--display-tracking': '0',
        '--greeting-size': 'clamp(28px, 3.4vw, 42px)',
        '--tint-strength': '.55',
        '--space-surface': 'rgba(239,226,204,.05)',
        '--space-outline': 'rgba(239,226,204,.07)',
        '--dock-surface': 'rgba(34,30,26,.78)',
        '--dock-border': 'rgba(239,226,204,.12)',
        '--dock-radius': '14px',
        '--palette-surface': 'rgba(30,27,23,.93)',
        '--palette-border': 'rgba(239,226,204,.24)',
    }),

    // FJORD — daylight: cool, airy and calm. The one theme meant for a bright room.
    derive('fjord', 'Fjord', 'light', {
        '--bg-color': '#dbe4ea',
        '--bg-image': 'linear-gradient(180deg, #cbd8e4 0%, #dde6eb 46%, #f0f1ee 100%)',
        '--bg-glow': 'radial-gradient(120% 60% at 50% 115%, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 60%)',
        '--bg-wash': '226 233 238',
        '--atmo-grain': '.04',
        '--atmo-vignette': '0',
        '--atmo-bloom': '.5',
        '--atmo-fog': '255 255 255',
        '--text-primary': '#15202B',
        '--text-secondary': 'rgba(21,32,43,.74)',
        '--text-tertiary': 'rgba(21,32,43,.60)',
        '--surface-primary': 'rgba(255,255,255,.52)',
        '--surface-secondary': 'rgba(255,255,255,.86)',
        '--surface-glass': 'rgba(246,249,251,.88)',
        '--border-subtle': 'rgba(21,32,43,.10)',
        '--border-strong': 'rgba(21,32,43,.28)',
        '--accent': '#23567D',
        '--accent-contrast': '#FFFFFF',
        '--danger': '#B4412F',
        '--shadow-card': '0 24px 50px -24px rgba(40,60,80,.35)',
        '--space-surface': 'rgba(255,255,255,.5)',
        '--space-outline': 'rgba(21,32,43,.07)',
        '--dock-surface': 'rgba(250,252,253,.78)',
        '--dock-border': 'rgba(21,32,43,.10)',
        '--palette-surface': 'rgba(248,250,252,.95)',
        '--palette-border': 'rgba(21,32,43,.24)',
    }),

    // EDITORIAL — a magazine page: type leads, everything else is a hairline. Set flush left.
    derive('editorial', 'Editorial', 'light', {
        '--bg-color': '#f2f2ee',
        '--bg-image': 'linear-gradient(180deg, #f4f4f1 0%, #ededea 100%)',
        '--bg-glow': 'none',
        '--bg-wash': '242 242 238',
        '--atmo-grain': '.09',
        '--atmo-vignette': '0',
        '--atmo-bloom': '0',
        '--atmo-fog': '242 242 238',
        '--text-primary': '#111214',
        '--text-secondary': 'rgba(17,18,20,.74)',
        '--text-tertiary': 'rgba(17,18,20,.60)',
        '--surface-primary': 'rgba(17,18,20,.03)',
        '--surface-secondary': 'rgba(17,18,20,.075)',
        '--surface-glass': 'rgba(250,250,248,.96)',
        '--border-subtle': 'rgba(17,18,20,.14)',
        '--border-strong': 'rgba(17,18,20,.46)',
        '--accent': '#2141C9',
        '--accent-contrast': '#FFFFFF',
        '--danger': '#B4412F',
        '--radius-control': '3px',
        '--radius-card': '4px',
        '--blur-surface': '0px',
        '--shadow-card': '0 18px 40px -22px rgba(17,18,20,.35)',
        '--font-display': SERIF,
        '--display-weight': '400',
        '--display-tracking': '-.015em',
        '--greeting-size': 'clamp(34px, 4.6vw, 60px)',
        '--label-font': SERIF,
        '--label-style': 'italic',
        '--label-transform': 'none',
        '--label-tracking': '0',
        '--label-size': '14px',
        '--tint-strength': '.35',
        '--motion-scale': '.9',
        '--hero-justify': 'flex-start',
        '--hero-text': 'left',
        '--space-surface': 'transparent',
        '--space-outline': 'rgba(17,18,20,.16)',
        '--dock-surface': 'rgba(250,250,248,.96)',
        '--dock-border': 'rgba(17,18,20,.40)',
        '--dock-radius': '4px',
        '--palette-surface': 'rgba(252,252,250,.98)',
        '--palette-border': 'rgba(17,18,20,.5)',
    }),

    // PHOSPHOR — an instrument, not a costume: soft green phosphor text, amber for what is live.
    derive('phosphor', 'Phosphor', 'dark', {
        '--bg-color': '#050a07',
        '--bg-image': 'linear-gradient(180deg, #040806 0%, #07110c 100%)',
        '--bg-glow': 'radial-gradient(100% 70% at 50% 0%, rgba(70,200,130,.10) 0%, transparent 70%)',
        '--bg-wash': '5 10 7',
        '--atmo-grain': '.06',
        '--atmo-vignette': '.5',
        '--atmo-scan': '.4',
        '--atmo-bloom': '.3',
        '--atmo-fog': '8 26 16',
        '--text-primary': '#BFE8CC',
        '--text-secondary': 'rgba(191,232,204,.70)',
        '--text-tertiary': 'rgba(191,232,204,.48)',
        '--surface-primary': 'rgba(120,230,170,.04)',
        '--surface-secondary': 'rgba(120,230,170,.095)',
        '--surface-glass': 'rgba(6,16,11,.93)',
        '--border-subtle': 'rgba(120,230,170,.15)',
        '--border-strong': 'rgba(120,230,170,.38)',
        '--accent': '#E6B450',
        '--accent-contrast': '#171003',
        '--radius-control': '3px',
        '--radius-card': '4px',
        '--blur-surface': '0px',
        '--font-ui': MONO,
        '--font-display': MONO,
        '--display-weight': '500',
        '--display-tracking': '0',
        '--greeting-size': 'clamp(22px, 2.6vw, 32px)',
        '--label-font': MONO,
        '--label-tracking': '.08em',
        '--tint-strength': '0',
        '--icon-filter': 'grayscale(1) sepia(1) hue-rotate(75deg) saturate(1.8) brightness(.95)',
        '--motion-scale': '.75',
        '--hero-justify': 'flex-start',
        '--hero-text': 'left',
        '--space-surface': 'rgba(120,230,170,.035)',
        '--space-outline': 'rgba(120,230,170,.16)',
        '--dock-surface': 'rgba(6,16,11,.93)',
        '--dock-border': 'rgba(120,230,170,.28)',
        '--dock-radius': '4px',
        '--palette-surface': 'rgba(5,13,9,.97)',
        '--palette-border': 'rgba(230,180,80,.5)',
    }),
];

export const DEFAULT_THEME_ID = dusk.id;

export function themeById(id: string): Theme {
    return THEMES.find(t => t.id === id) ?? dusk;
}

/** Writes a theme's tokens onto an element (the document root, or a preview). */
export function applyTheme(theme: Theme, target: HTMLElement): void {
    for (const [token, value] of Object.entries(theme.tokens)) target.style.setProperty(token, value);
    target.dataset.scheme = theme.scheme;
    target.style.colorScheme = theme.scheme;
}

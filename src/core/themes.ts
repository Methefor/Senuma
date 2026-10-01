/**
 * Theme engine. A theme is data: a set of design tokens covering the backdrop, atmosphere
 * and interface layers. Components only ever read tokens, so adding a theme (or loading a
 * shared one later) needs no component changes.
 */

export interface Theme {
    id: string;
    name: string;
    scheme: 'dark' | 'light';
    tokens: Record<string, string>;
}

const SANS = '"Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif';
const SANS_DISPLAY = '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif';
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
const MONO = '"Cascadia Code", "Cascadia Mono", "SF Mono", Consolas, "Liberation Mono", monospace';

/** Tokens every theme must define; `dusk` doubles as the reference set. */
const dusk: Theme = {
    id: 'dusk',
    name: 'Dusk',
    scheme: 'dark',
    tokens: {
        // Backdrop: a night sky with the last light on the horizon.
        '--backdrop': 'linear-gradient(180deg, #070916 0%, #0c1024 48%, #151634 100%)',
        // The horizon is its own layer so it can breathe slowly.
        '--glow': 'radial-gradient(140% 55% at 50% 112%, rgba(244,170,112,.50) 0%, rgba(206,96,118,.30) 28%, rgba(96,62,140,.16) 52%, transparent 72%)',
        '--backdrop-color': '#090b16',
        // Atmosphere
        '--grain': '.07',
        '--vignette': '.45',
        '--scan': '0',
        // Interface
        '--ink': '#EEF0F7',
        '--ink-2': 'rgba(238,240,247,.66)',
        '--ink-3': 'rgba(238,240,247,.40)',
        '--surface': 'rgba(255,255,255,.055)',
        '--surface-hi': 'rgba(255,255,255,.10)',
        '--panel': 'rgba(18,20,40,.78)',
        '--line': 'rgba(255,255,255,.10)',
        '--line-hi': 'rgba(255,255,255,.22)',
        '--accent': '#F4BE8A',
        '--on-accent': '#1a1208',
        '--danger': '#F08A7B',
        '--radius': '14px',
        '--radius-lg': '22px',
        '--blur': '22px',
        '--shadow': '0 24px 60px -20px rgba(0,0,0,.65)',
        '--font-ui': SANS,
        '--font-display': SANS_DISPLAY,
        '--display-weight': '600',
        '--display-tracking': '-.02em',
        // Small labels (section names, group names)
        '--label-font': SANS,
        '--label-style': 'normal',
        '--label-transform': 'uppercase',
        '--label-tracking': '.14em',
        '--label-size': '11px',
        // How strongly a Space tints its own surfaces, and how site icons are rendered
        '--tint-strength': '1',
        '--icon-filter': 'none',
    },
};

function derive(id: string, name: string, scheme: Theme['scheme'], tokens: Record<string, string>): Theme {
    return { id, name, scheme, tokens: { ...dusk.tokens, ...tokens } };
}

export const THEMES: readonly Theme[] = [
    dusk,
    derive('noir', 'Noir', 'dark', {
        '--backdrop': 'linear-gradient(180deg, #000 0%, #000 100%)',
        '--glow': 'none',
        '--tint-strength': '0',
        '--icon-filter': 'grayscale(1) contrast(1.1)',
        '--backdrop-color': '#000000',
        '--grain': '0',
        '--vignette': '0',
        '--ink': '#F2F2F2',
        '--ink-2': 'rgba(242,242,242,.62)',
        '--ink-3': 'rgba(242,242,242,.36)',
        '--surface': 'rgba(255,255,255,.04)',
        '--surface-hi': 'rgba(255,255,255,.09)',
        '--panel': 'rgba(10,10,10,.96)',
        '--line': 'rgba(255,255,255,.09)',
        '--line-hi': 'rgba(255,255,255,.26)',
        '--accent': '#FFFFFF',
        '--on-accent': '#000000',
        '--blur': '0px',
        '--radius': '10px',
        '--radius-lg': '16px',
        '--shadow': '0 0 0 1px rgba(255,255,255,.08)',
    }),
    derive('atelier', 'Atelier', 'dark', {
        '--backdrop': 'radial-gradient(70% 60% at 100% 100%, rgba(120,92,70,.22) 0%, transparent 65%), linear-gradient(160deg, #191715 0%, #211d19 55%, #2a241e 100%)',
        '--glow': 'radial-gradient(90% 70% at 12% -10%, rgba(214,180,128,.22) 0%, transparent 60%)',
        '--tint-strength': '.6',
        '--backdrop-color': '#1b1917',
        '--grain': '.10',
        '--vignette': '.35',
        '--ink': '#EFE8DC',
        '--ink-2': 'rgba(239,232,220,.64)',
        '--ink-3': 'rgba(239,232,220,.38)',
        '--surface': 'rgba(239,226,204,.05)',
        '--surface-hi': 'rgba(239,226,204,.10)',
        '--panel': 'rgba(34,30,26,.86)',
        '--line': 'rgba(239,226,204,.11)',
        '--line-hi': 'rgba(239,226,204,.26)',
        '--accent': '#CFAE7C',
        '--on-accent': '#1d1710',
        '--radius': '6px',
        '--radius-lg': '10px',
        '--font-display': SERIF,
        '--display-weight': '500',
        '--display-tracking': '0',
    }),
    derive('fjord', 'Fjord', 'light', {
        '--backdrop': 'linear-gradient(180deg, #c9d6e2 0%, #dbe4ea 45%, #eef0ee 100%)',
        '--glow': 'radial-gradient(120% 60% at 50% 115%, rgba(255,255,255,.95) 0%, rgba(255,255,255,0) 60%)',
        '--backdrop-color': '#d6dfe7',
        '--grain': '.05',
        '--vignette': '0',
        '--ink': '#17222D',
        '--ink-2': 'rgba(23,34,45,.68)',
        '--ink-3': 'rgba(23,34,45,.46)',
        '--surface': 'rgba(255,255,255,.50)',
        '--surface-hi': 'rgba(255,255,255,.82)',
        '--panel': 'rgba(244,247,249,.88)',
        '--line': 'rgba(23,34,45,.10)',
        '--line-hi': 'rgba(23,34,45,.28)',
        '--accent': '#28567A',
        '--on-accent': '#FFFFFF',
        '--danger': '#B4412F',
        '--shadow': '0 24px 50px -24px rgba(40,60,80,.35)',
    }),
    derive('editorial', 'Editorial', 'light', {
        '--backdrop': 'linear-gradient(180deg, #f3f3f0 0%, #ecece8 100%)',
        '--glow': 'none',
        '--tint-strength': '.35',
        '--label-font': SERIF,
        '--label-style': 'italic',
        '--label-transform': 'none',
        '--label-tracking': '0',
        '--label-size': '14px',
        '--backdrop-color': '#f1f1ee',
        '--grain': '.09',
        '--vignette': '0',
        '--ink': '#111214',
        '--ink-2': 'rgba(17,18,20,.68)',
        '--ink-3': 'rgba(17,18,20,.46)',
        '--surface': 'rgba(17,18,20,.035)',
        '--surface-hi': 'rgba(17,18,20,.075)',
        '--panel': 'rgba(250,250,248,.96)',
        '--line': 'rgba(17,18,20,.14)',
        '--line-hi': 'rgba(17,18,20,.42)',
        '--accent': '#2141C9',
        '--on-accent': '#FFFFFF',
        '--danger': '#B4412F',
        '--radius': '3px',
        '--radius-lg': '4px',
        '--blur': '0px',
        '--shadow': '0 18px 40px -22px rgba(17,18,20,.35)',
        '--font-display': SERIF,
        '--display-weight': '500',
        '--display-tracking': '-.01em',
    }),
    derive('phosphor', 'Phosphor', 'dark', {
        '--backdrop': 'linear-gradient(180deg, #040806 0%, #06100b 100%)',
        '--glow': 'radial-gradient(100% 70% at 50% 0%, rgba(60,220,130,.12) 0%, transparent 70%)',
        '--scan': '.5',
        '--tint-strength': '0',
        '--icon-filter': 'grayscale(1) sepia(1) hue-rotate(75deg) saturate(2.4) brightness(.95)',
        '--label-font': MONO,
        '--label-tracking': '.08em',
        '--backdrop-color': '#050a07',
        '--grain': '.08',
        '--vignette': '.5',
        '--ink': '#C4F5D3',
        '--ink-2': 'rgba(196,245,211,.66)',
        '--ink-3': 'rgba(196,245,211,.40)',
        '--surface': 'rgba(110,255,170,.045)',
        '--surface-hi': 'rgba(110,255,170,.10)',
        '--panel': 'rgba(6,16,11,.92)',
        '--line': 'rgba(110,255,170,.16)',
        '--line-hi': 'rgba(110,255,170,.42)',
        '--accent': '#6CF5A2',
        '--on-accent': '#03140a',
        '--radius': '4px',
        '--radius-lg': '6px',
        '--blur': '0px',
        '--font-ui': MONO,
        '--font-display': MONO,
        '--display-weight': '500',
        '--display-tracking': '0',
    }),
];

export const DEFAULT_THEME_ID = dusk.id;

export function themeById(id: string): Theme {
    return THEMES.find(t => t.id === id) ?? dusk;
}

/** Writes a theme's tokens onto an element (the document root, or a preview swatch). */
export function applyTheme(theme: Theme, target: HTMLElement): void {
    for (const [token, value] of Object.entries(theme.tokens)) target.style.setProperty(token, value);
    target.dataset.scheme = theme.scheme;
    target.style.colorScheme = theme.scheme;
}

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { betterThemesFor, pictureMood, WALLPAPER_PHOTOS, WALLPAPER_PRESETS } from './background';
import { THEMES, themeById } from './themes';

type RGB = [number, number, number];

function parse(color: string): { rgb: RGB; alpha: number } {
    const hex = /^#([\da-f]{6})$/i.exec(color.trim());
    if (hex) {
        const n = parseInt(hex[1]!, 16);
        return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 };
    }
    const rgba = /^rgba?\(([^)]+)\)$/.exec(color.trim());
    if (!rgba) throw new Error(`cannot parse colour: ${color}`);
    const parts = rgba[1]!.split(/[,\s/]+/).filter(Boolean).map(Number);
    return { rgb: [parts[0]!, parts[1]!, parts[2]!], alpha: parts[3] ?? 1 };
}

/** The colour actually seen when `color` is painted over an opaque `under`. */
function over(color: string, under: RGB): RGB {
    const { rgb, alpha } = parse(color);
    return rgb.map((c, i) => c * alpha + under[i]! * (1 - alpha)) as RGB;
}

function luminance([r, g, b]: RGB): number {
    const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: RGB, b: RGB): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
    return (hi + 0.05) / (lo + 0.05);
}

describe('theme readability (WCAG contrast on the plain theme background)', () => {
    for (const theme of THEMES) {
        const bg = parse(theme.tokens['--bg-color']).rgb;
        const on = (token: keyof typeof theme.tokens) => contrast(over(theme.tokens[token], bg), bg);

        it(`${theme.name}: text, labels and controls are readable`, () => {
            expect(on('--text-primary'), 'primary text').toBeGreaterThanOrEqual(7);
            expect(on('--text-secondary'), 'secondary text').toBeGreaterThanOrEqual(4.5);
            // Tertiary is used for small labels and placeholders, so it is held to body-text contrast.
            expect(on('--text-tertiary'), 'tertiary text').toBeGreaterThanOrEqual(4.5);
            // The accent draws focus rings and selection: a UI component needs 3:1.
            expect(on('--accent'), 'accent / focus ring').toBeGreaterThanOrEqual(3);
            // Text on a filled accent button.
            const accent = parse(theme.tokens['--accent']).rgb;
            expect(contrast(parse(theme.tokens['--accent-contrast']).rgb, accent), 'text on accent').toBeGreaterThanOrEqual(4.5);
        });

        it(`${theme.name}: text stays readable on floating panels and on a picture's wash`, () => {
            // Panels (menus, command center, dock) are near-opaque glass over the background.
            for (const surface of ['--surface-glass', '--palette-surface', '--dock-surface'] as const) {
                const panel = over(theme.tokens[surface], bg);
                expect(contrast(over(theme.tokens['--text-primary'], panel), panel), `primary on ${surface}`).toBeGreaterThanOrEqual(7);
                expect(contrast(over(theme.tokens['--text-secondary'], panel), panel), `secondary on ${surface}`).toBeGreaterThanOrEqual(4.5);
            }
            // The wash colour is what a fully dimmed picture becomes; text must read on it.
            const wash = theme.tokens['--bg-wash'].split(' ').map(Number) as RGB;
            expect(contrast(over(theme.tokens['--text-primary'], wash), wash), 'primary on wash').toBeGreaterThanOrEqual(7);
        });
    }
});

describe('picture mood', () => {
    it('reads a picture as dark, balanced or bright from its brightness', () => {
        expect([0.05, 0.33, 0.34, 0.5, 0.6, 0.61, 0.95].map(pictureMood)).toEqual(['dark', 'dark', 'balanced', 'balanced', 'balanced', 'bright', 'bright']);
    });

    it('suggests themes only when the picture fights the current one', () => {
        expect(betterThemesFor(0.85, 'dark')).toEqual(['fjord', 'editorial']);
        expect(betterThemesFor(0.1, 'light')).toEqual(['dusk', 'atelier']);
        for (const [luminance, scheme] of [[0.85, 'light'], [0.1, 'dark'], [0.5, 'dark'], [0.5, 'light']] as const) {
            expect(betterThemesFor(luminance, scheme)).toEqual([]);
        }
        // Every suggestion is a real theme of the opposite scheme.
        expect(betterThemesFor(0.9, 'dark').every(id => themeById(id).id === id && themeById(id).scheme === 'light')).toBe(true);
        expect(betterThemesFor(0.1, 'light').every(id => themeById(id).id === id && themeById(id).scheme === 'dark')).toBe(true);
    });

    it('every curated wallpaper declares a mood the suggestion logic can use', () => {
        for (const preset of [...WALLPAPER_PRESETS, ...WALLPAPER_PHOTOS]) {
            expect(preset.luminance, preset.id).toBeGreaterThanOrEqual(0);
            expect(preset.luminance, preset.id).toBeLessThanOrEqual(1);
            expect(!!preset.css !== !!preset.file, `${preset.id} must be CSS or an image, not both`).toBe(true);
        }
    });

    it('every packaged photograph has its picture, its preview and a unique id', () => {
        expect(WALLPAPER_PHOTOS).toHaveLength(8);
        const ids = [...WALLPAPER_PRESETS, ...WALLPAPER_PHOTOS].map(p => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const photo of WALLPAPER_PHOTOS) {
            expect(existsSync(`src/assets/wallpapers/${photo.file}.webp`), photo.id).toBe(true);
            expect(existsSync(`src/assets/wallpapers/${photo.file}.thumb.webp`), photo.id).toBe(true);
        }
    });
});

/** Interface glyphs: one small hand-kept set, drawn on a 24px grid with a shared stroke. */
const PATHS: Record<string, string> = {
    search: 'M11 4a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM21 21l-4.5-4.5',
    sliders: 'M4 7h10M18 7h2M4 17h2M10 17h10M16 5a2 2 0 1 0 0 4a2 2 0 0 0 0-4zM8 15a2 2 0 1 0 0 4a2 2 0 0 0 0-4z',
    plus: 'M12 5v14M5 12h14',
    x: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    more: 'M6 12h.01M12 12h.01M18 12h.01',
    enter: 'M19 6v6a3 3 0 0 1-3 3H6M9.5 11.5L6 15l3.5 3.5',
    spark: 'M12 3l1.8 5.2a3 3 0 0 0 2 2L21 12l-5.2 1.8a3 3 0 0 0-2 2L12 21l-1.8-5.2a3 3 0 0 0-2-2L3 12l5.2-1.8a3 3 0 0 0 2-2z',
    code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 5l-3 14',
    book: 'M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
    briefcase: 'M4 8h16v11H4zM9 8V5.5h6V8M4 13h16',
    pen: 'M4 20l1-4.5L16.5 4a2.1 2.1 0 0 1 3 3L8 18.5zM14.5 6l3 3',
    film: 'M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M4 14.5h4M16 9.5h4M16 14.5h4',
    gamepad: 'M7 8h10a4 4 0 0 1 4 4v1a3.5 3.5 0 0 1-6.3 2.1L14 14h-4l-.7 1.1A3.5 3.5 0 0 1 3 13v-1a4 4 0 0 1 4-4zM7.5 10.5v3M6 12h3M16.5 12h.01',
    music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0zM19 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 0 1 5 0z',
    chart: 'M4 19h16M7 16v-5M12 16V6M17 16v-8',
    users: 'M9 11a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7zM3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14.5a6 6 0 0 1 3 5.5',
    bag: 'M5 8h14l-1 12H6zM9 8V7a3 3 0 0 1 6 0v1',
    cap: 'M2.5 9.5L12 5l9.5 4.5L12 14zM6.5 11.5V16c1.5 1.5 3.5 2 5.5 2s4-.5 5.5-2v-4.5M21.5 9.5V15',
    folder: 'M3.5 6.5h6l2 2.5h9v9.5h-17z',
    clock: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
    pin: 'M9 4h6l-1 6 3 3H7l3-3zM12 13v7',
    trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7',
    copy: 'M9 9h10v11H9zM5 15V4h10',
    external: 'M14 5h5v5M19 5l-8 8M11 6H5v13h13v-6',
    layers: 'M12 4l9 4.5-9 4.5-9-4.5zM3 13l9 4.5 9-4.5',
    swatch: 'M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2-1 2-2s-.5-1.5 0-2.5 1.5-1 3-1a3.5 3.5 0 0 0 3.5-3.5c0-4.4-3.8-8-8.5-8zM8 11h.01M11 7.5h.01M15.5 8.5h.01',
    download: 'M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19.5h14',
    upload: 'M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19.5h14',
    shield: 'M12 3.5l7 2.5v5.5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z',
    keyboard: 'M3 7h18v10H3zM7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17.5 10.5h.01M8 13.5h8',
    info: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17zM12 11v5.5M12 7.5h.01',
    globe: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.5 2.5 3.5 5.5 3.5 8.5s-1 6-3.5 8.5c-2.5-2.5-3.5-5.5-3.5-8.5s1-6 3.5-8.5z',
    moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z',
    grid: 'M4.5 4.5h6v6h-6zM13.5 4.5h6v6h-6zM4.5 13.5h6v6h-6zM13.5 13.5h6v6h-6z',
};

/** Glyphs a user can pick for a Space or Mode. */
export const SPACE_GLYPHS = ['folder', 'spark', 'code', 'book', 'briefcase', 'pen', 'film', 'music', 'gamepad', 'chart', 'users', 'bag', 'cap', 'globe', 'moon', 'layers'] as const;

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
    const path = PATHS[name];
    // Unknown names are user-chosen emoji from older data; show them as text.
    if (!path) return <span class="glyph-text" style={{ fontSize: `${size * 0.9}px` }} aria-hidden="true">{name}</span>;
    return (
        <svg class="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width={name === 'more' ? 2.6 : 1.6} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d={path} />
        </svg>
    );
}

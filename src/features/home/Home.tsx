import { useEffect, useRef, useState } from 'preact/hooks';
import { launch, remember, setupNames } from '../../app/actions';
import { recentlyClosed, restoreClosed, type ClosedTab } from '../../browser/sessions';
import { CATEGORIES } from '../../core/catalog';
import {
    activeDock, activeMode, itemsOf, locateItem, removeRecent, reorderDock, reorderSpace, setActiveMode, setPrefs, shiftSpace, toggleDock, visibleSpaces,
} from '../../core/ops';
import { applyStarter } from '../../core/setup';
import type { AppState, DockEntry, ID, Space } from '../../core/types';
import { hostOf, normalizeUrl } from '../../core/url';
import { t, type MessageKey } from '../../i18n';
import { app, openMenu, openMenuBelow, setUi, toast, update, type MenuItem } from '../../storage/store';
import { AppIcon } from '../../ui/AppIcon';
import { Icon } from '../../ui/Icon';
import { useFlip } from '../../ui/useFlip';
import { Launcher } from '../command/Launcher';
import { spaceMenu } from '../spaces/menus';

/** Continue shows a few high-value items; the rest are one click away, not always on screen. */
const CONTINUE_SHOWN = 4;
const CONTINUE_MORE = 8;
const PLATE_PREVIEW = 5;
/** Above this many Spaces the deck switches to compact rows so Home stays calm. */
const ROOMY_LIMIT = 8;
const CLOCK_TICK_MS = 15_000;
const SPACE_DRAG = 'application/x-space';
const DOCK_DRAG = 'application/x-dock-entry';

function linkTarget(state: AppState) {
    return state.prefs.openInNewTab ? { target: '_blank', rel: 'noopener' } : {};
}

/** Opens a Space so that it grows out of the control that was used. */
function openSpaceFrom(element: Element, spaceId: ID): void {
    const rect = element.getBoundingClientRect();
    setUi({ spaceId, origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } });
}

// ---------- Top bar ----------

function Clock() {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
        return () => clearInterval(timer);
    }, []);
    const locale = app.get().prefs.language;
    return (
        <time class="clock" dateTime={now.toISOString()}>
            <span class="clock-time">{now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="clock-date">{now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
        </time>
    );
}

export function modeMenu(state: AppState): MenuItem[] {
    const choose = (id: ID | null) => () => update(s => setActiveMode(s, id));
    return [
        { label: t('mode.all'), glyph: 'grid', checked: !state.activeModeId, run: choose(null) },
        ...state.modeOrder.map(id => ({ label: state.modes[id]!.name, glyph: state.modes[id]!.glyph, checked: state.activeModeId === id, run: choose(id) })),
        { label: t('mode.edit'), glyph: 'sliders', separatorBefore: true, run: () => setUi({ settings: 'modes' }) },
    ];
}

/** One compact control instead of a permanent row of Mode tabs. */
function ModeSwitch({ state }: { state: AppState }) {
    const mode = activeMode(state);
    if (!state.modeOrder.length) return <span />;
    return (
        <button type="button" id="mode-switch" class="mode-switch" aria-haspopup="menu" title={t('mode.switch')}
            onClick={event => openMenuBelow(event.currentTarget, modeMenu(state))}>
            <Icon name={mode?.glyph ?? 'grid'} size={15} />
            <span>{mode?.name ?? t('mode.all')}</span>
            <Icon name="down" size={13} />
        </button>
    );
}

// ---------- Continue ----------

interface ContinueEntry {
    url: string;
    title: string;
    at?: number;
    spaceId?: ID;
    /** Present for a recently closed tab, which is restored rather than re-opened. */
    sessionId?: string;
}

/** "now", "32m", "3h", "2d": short enough to sit beside a title without becoming a label. */
function ago(at: number, now = Date.now()): string {
    const minutes = Math.floor((now - at) / 60_000);
    if (minutes < 1) return t('continue.now');
    if (minutes < 60) return `${minutes}${t('unit.minute')}`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}${t('unit.hour')}`;
    return `${Math.floor(hours / 24)}${t('unit.day')}`;
}

function useClosedTabs(enabled: boolean): ClosedTab[] {
    const [closed, setClosed] = useState<ClosedTab[]>([]);
    useEffect(() => {
        if (!enabled) return setClosed([]);
        let live = true;
        // Deliberately after first paint: Home never waits for an optional browser API.
        void recentlyClosed().then(result => {
            if (live) setClosed(result.ok ? result.value.filter(tab => normalizeUrl(tab.url)) : []);
        });
        return () => {
            live = false;
        };
    }, [enabled]);
    return closed;
}

function Continue({ state }: { state: AppState }) {
    const closed = useClosedTabs(state.prefs.showContinue && state.prefs.showClosedTabs);
    const [expanded, setExpanded] = useState(false);
    if (!state.prefs.showContinue) return null;

    const seen = new Set<string>();
    const all = [...state.recents, ...closed].filter((entry: ContinueEntry) => !seen.has(entry.url) && !!seen.add(entry.url)).slice(0, CONTINUE_MORE);
    if (!all.length) return null;
    const entries = expanded ? all : all.slice(0, CONTINUE_SHOWN);

    return (
        <nav class="continue" aria-label={t('continue.title')}>
            <span class="eyebrow">{t('continue.title')}</span>
            {entries.map((entry: ContinueEntry) => (
                <a key={entry.url} class="continue-link" href={entry.url} {...linkTarget(state)} title={hostOf(entry.url)}
                    onClick={event => {
                        if (!entry.sessionId) return remember(entry.url, entry.title, entry.spaceId);
                        event.preventDefault();
                        void restoreClosed(entry.sessionId).then(result => !result.ok && toast(t('error.restore')));
                    }}
                    onContextMenu={event => {
                        if (entry.sessionId) return;
                        openMenu(event, [{ label: t('continue.remove'), glyph: 'x', run: () => update(s => removeRecent(s, entry.url)) }]);
                    }}>
                    <AppIcon url={entry.url} title={entry.title} size={20} />
                    <span class="continue-title">{entry.title}</span>
                    <span class="continue-when">{entry.sessionId ? t('continue.closed') : entry.at ? ago(entry.at) : ''}</span>
                </a>
            ))}
            {all.length > CONTINUE_SHOWN && (
                <button type="button" class="quiet-button continue-more" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>
                    {expanded ? t('continue.less') : t('continue.more', { n: all.length - CONTINUE_SHOWN })}
                </button>
            )}
        </nav>
    );
}

// ---------- Spaces ----------

interface Drop {
    overId: ID;
    after: boolean;
}

function Plate({ state, space, index, compact, drop, dragging, onDrag, onHover }: {
    state: AppState;
    space: Space;
    index: number;
    compact: boolean;
    drop: Drop | null;
    dragging: boolean;
    /** Start (id) or end (null) of dragging this plate. */
    onDrag: (id: ID | null) => void;
    onHover: (drop: Drop) => void;
}) {
    const items = itemsOf(state, space);
    const dropClass = drop?.overId === space.id ? (drop.after ? 'is-drop-after' : 'is-drop-before') : '';
    // A Space says what it is for (its note) when it has one; a count only where there is no preview.
    const detail = space.note ?? (compact ? t('space.count', { n: items.length }) : '');

    const move = (delta: -1 | 1) => {
        update(s => shiftSpace(s, space.id, delta));
        // The node is re-inserted when it moves; give it the focus back.
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-flip="${space.id}"]`)?.focus());
    };

    return (
        <button type="button" class={`plate ${dropClass} ${dragging ? 'is-dragging' : ''}`} data-flip={space.id}
            style={{ '--tint': space.accent, '--i': index }} draggable
            aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
            onClick={event => openSpaceFrom(event.currentTarget, space.id)}
            onContextMenu={event => openMenu(event, spaceMenu(state, space, true))}
            onKeyDown={event => {
                if (!event.altKey || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
                event.preventDefault();
                move(event.key === 'ArrowLeft' ? -1 : 1);
            }}
            onDragStart={event => {
                event.dataTransfer!.setData(SPACE_DRAG, space.id);
                event.dataTransfer!.effectAllowed = 'move';
                onDrag(space.id);
            }}
            onDragOver={event => {
                if (!event.dataTransfer!.types.includes(SPACE_DRAG)) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                // Rows stack in the compact layout, so the split is vertical there.
                const after = compact
                    ? event.clientY > rect.top + rect.height / 2
                    : event.clientX > rect.left + rect.width / 2;
                if (drop?.overId !== space.id || drop.after !== after) onHover({ overId: space.id, after });
            }}
            onDragEnd={() => onDrag(null)}>
            <span class="plate-top">
                <span class="plate-glyph"><Icon name={space.glyph} size={compact ? 18 : 21} /></span>
                {index < 9 && <kbd class="plate-key" aria-hidden="true">{index + 1}</kbd>}
            </span>
            <span class="plate-text">
                <span class="plate-name">{space.name}</span>
                {detail && <span class="plate-detail">{detail}</span>}
            </span>
            {!compact && (
                <span class="plate-icons">
                    {items.slice(0, PLATE_PREVIEW).map(item => <AppIcon key={item.id} url={item.url} title={item.title} icon={item.icon} size={24} />)}
                    {items.length > PLATE_PREVIEW && <span class="plate-more">+{items.length - PLATE_PREVIEW}</span>}
                </span>
            )}
        </button>
    );
}

function Deck({ state }: { state: AppState }) {
    const spaces = visibleSpaces(state);
    const mode = activeMode(state);
    const ref = useRef<HTMLDivElement>(null);
    const [dragId, setDragId] = useState<ID | null>(null);
    const [drop, setDrop] = useState<Drop | null>(null);
    useFlip(ref, spaces.map(s => s.id).join());

    if (state.spaceOrder.length === 0) {
        return (
            <section class="empty">
                <h2>{t('empty.firstSpace')}</h2>
                <p>{t('empty.firstSpaceHint')}</p>
                <div class="pick-row">
                    {CATEGORIES.filter(c => c.onboarding !== false).map(category => (
                        <button type="button" class="pick" key={category.id} style={{ '--tint': category.accent }}
                            onClick={() => update(s => applyStarter(s, [category.id], setupNames()))}>
                            <Icon name={category.glyph} size={16} />
                            {t(`cat.${category.id}` as MessageKey)}
                        </button>
                    ))}
                </div>
            </section>
        );
    }

    const compact = spaces.length > ROOMY_LIMIT;

    const commit = () => {
        if (dragId && drop && drop.overId !== dragId) {
            const at = spaces.findIndex(s => s.id === drop.overId);
            const beforeId = drop.after ? (spaces[at + 1]?.id ?? null) : drop.overId;
            update(s => reorderSpace(s, dragId, beforeId));
        }
        setDragId(null);
        setDrop(null);
    };

    return (
        <section class="deck-section scene" aria-labelledby="deck-title">
            <header class="deck-head">
                <h2 id="deck-title" class="eyebrow">{mode ? mode.name : t('spaces.title')}</h2>
                <button type="button" class="quiet-button" onClick={() => setUi({ editor: { kind: 'space' } })}>
                    <Icon name="plus" size={14} />{t('space.new')}
                </button>
            </header>
            <div ref={ref} class={`deck ${compact ? 'is-compact' : ''}`}
                onDragOver={event => event.dataTransfer!.types.includes(SPACE_DRAG) && event.preventDefault()}
                onDrop={event => {
                    event.preventDefault();
                    commit();
                }}>
                {spaces.map((space, index) => (
                    <Plate key={space.id} state={state} space={space} index={index} compact={compact}
                        drop={dragId && dragId !== space.id ? drop : null} dragging={dragId === space.id}
                        onHover={next => setDrop(current => (current?.overId === next.overId && current.after === next.after ? current : next))}
                        onDrag={id => {
                            setDragId(id);
                            setDrop(null);
                        }} />
                ))}
            </div>
            {mode && spaces.length === 0 && (
                <p class="deck-note">
                    {t('empty.mode', { name: mode.name })}{' '}
                    <button type="button" class="text-button" onClick={() => setUi({ settings: 'modes' })}>{t('empty.modeAction')}</button>
                </p>
            )}
        </section>
    );
}

// ---------- Dock ----------

const entryKey = (entry: DockEntry) => `${entry.kind}:${entry.id}`;

/**
 * A small shelf of the shortcuts that matter most: links and whole Spaces. Each item names
 * itself on hover or focus (or always, if the user prefers); a long dock scrolls sideways
 * with faded edges rather than shrinking or wrapping.
 */
function Dock({ state }: { state: AppState }) {
    const ref = useRef<HTMLDivElement>(null);
    const entries = activeDock(state).filter(e => (e.kind === 'item' ? state.items[e.id] : state.spaces[e.id]));
    const [over, setOver] = useState<string | null>(null);
    useFlip(ref, entries.map(entryKey).join());
    if (!state.prefs.showDock || !entries.length) return null;
    const labels = state.prefs.dockLabels;

    const dragProps = (entry: DockEntry) => ({
        draggable: true,
        'data-flip': entryKey(entry),
        onDragStart: (event: DragEvent) => {
            event.dataTransfer!.setData(DOCK_DRAG, JSON.stringify(entry));
            event.dataTransfer!.effectAllowed = 'move';
        },
        onDragOver: (event: DragEvent) => {
            if (!event.dataTransfer!.types.includes(DOCK_DRAG)) return;
            event.preventDefault();
            setOver(entryKey(entry));
        },
        onDragLeave: () => setOver(null),
        onDragEnd: () => setOver(null),
        onDrop: (event: DragEvent) => {
            event.preventDefault();
            setOver(null);
            try {
                const dragged = JSON.parse(event.dataTransfer!.getData(DOCK_DRAG)) as DockEntry;
                update(s => reorderDock(s, dragged, entry));
            } catch {
                // Not one of our drags; ignore it.
            }
        },
    });
    const dockItems = (entry: DockEntry): MenuItem[] => [
        { label: t('dock.remove'), glyph: 'pin', run: () => update(s => toggleDock(s, entry)) },
        { label: labels ? t('dock.hideNames') : t('dock.showNames'), glyph: 'info', separatorBefore: true, run: () => update(s => setPrefs(s, { dockLabels: !labels })) },
    ];

    return (
        <nav class={`dock scene ${labels ? 'has-labels' : ''}`} aria-label={t('dock.title')}>
            <div class="dock-rail" ref={ref}>
                {entries.map(entry => {
                    const dropClass = over === entryKey(entry) ? 'is-drop' : '';
                    if (entry.kind === 'space') {
                        const space = state.spaces[entry.id]!;
                        return (
                            <button type="button" key={entryKey(entry)} class={`dock-item ${dropClass}`} style={{ '--tint': space.accent }}
                                data-label={space.name} aria-label={space.name} {...dragProps(entry)}
                                onClick={event => openSpaceFrom(event.currentTarget, space.id)}
                                onContextMenu={event => openMenu(event, dockItems(entry))}>
                                <span class="dock-space"><Icon name={space.glyph} size={19} /></span>
                                {labels && <span class="dock-name">{space.name}</span>}
                            </button>
                        );
                    }
                    const item = state.items[entry.id]!;
                    const spaceId = locateItem(state, item.id)?.spaceId;
                    return (
                        <a key={entryKey(entry)} href={item.url} {...linkTarget(state)} class={`dock-item ${dropClass}`}
                            data-label={item.title} aria-label={item.title} {...dragProps(entry)}
                            onClick={() => remember(item.url, item.title, spaceId)}
                            onContextMenu={event => openMenu(event, [
                                { label: t('item.openNewTab'), glyph: 'external', run: () => launch(item.url, item.title, { newTab: true, spaceId }) },
                                ...dockItems(entry),
                            ])}>
                            <AppIcon url={item.url} title={item.title} icon={item.icon} size={38} />
                            {labels && <span class="dock-name">{item.title}</span>}
                        </a>
                    );
                })}
            </div>
        </nav>
    );
}

// ---------- Home ----------

function greeting(): string {
    const hour = new Date().getHours();
    if (hour < 5) return t('greeting.night');
    if (hour < 12) return t('greeting.morning');
    if (hour < 18) return t('greeting.afternoon');
    return t('greeting.evening');
}

/**
 * Composition, top to bottom: utilities, search, Continue, Spaces, dock. The search is the
 * one strongly drawn object; everything else earns its place with spacing rather than boxes.
 */
export function Home({ state, covered, previewing }: { state: AppState; covered: boolean; previewing: boolean }) {
    // Deck and dock are keyed by Mode: a switch replays one shared entrance, so the Spaces,
    // the dock and the backdrop arrive together as a single change of scene.
    const scene = state.activeModeId ?? 'all';
    return (
        <div class={`home ${previewing ? 'is-previewing' : ''}`} inert={covered}>
            <header class="topbar">
                <ModeSwitch state={state} />
                <div class="topbar-end">
                    <Clock />
                    <button type="button" class="icon-button" title={t('customize.title')} aria-label={t('customize.title')}
                        onClick={() => setUi({ customize: true })}>
                        <Icon name="swatch" />
                    </button>
                    <button type="button" class="icon-button" title={t('settings.title')} aria-label={t('settings.title')}
                        onClick={() => setUi({ settings: 'appearance' })}>
                        <Icon name="sliders" />
                    </button>
                </div>
            </header>
            <div class="stage-scroll">
                <main class="stage">
                    <div class="hero">
                        <h1 class="greeting">{greeting()}</h1>
                        <Launcher variant="home" />
                        <Continue state={state} />
                    </div>
                    <Deck key={scene} state={state} />
                </main>
            </div>
            <Dock key={scene} state={state} />
        </div>
    );
}

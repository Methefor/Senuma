import { useEffect, useRef, useState } from 'preact/hooks';
import { launch, remember, setupNames } from '../../app/actions';
import { recentlyClosed, restoreClosed, type ClosedTab } from '../../browser/sessions';
import { CATEGORIES } from '../../core/catalog';
import {
    activeDock, activeMode, itemsOf, locateItem, removeRecent, reorderDock, reorderSpace, setActiveMode, shiftSpace, toggleDock, visibleSpaces,
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

const MAX_CONTINUE = 6;
const PLATE_PREVIEW = 5;
/** Above this many Spaces the deck switches to compact rows so Home stays calm. */
const ROOMY_LIMIT = 8;
const CLOCK_TICK_MS = 15_000;
const SPACE_DRAG = 'application/x-space';
const DOCK_DRAG = 'application/x-dock-entry';

function linkTarget(state: AppState) {
    return state.prefs.openInNewTab ? { target: '_blank', rel: 'noopener' } : {};
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
    spaceId?: ID;
    /** Present for a recently closed tab, which is restored rather than re-opened. */
    sessionId?: string;
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
    if (!state.prefs.showContinue) return null;

    const seen = new Set<string>();
    const entries = [...state.recents, ...closed]
        .filter((entry: ContinueEntry) => !seen.has(entry.url) && !!seen.add(entry.url))
        .slice(0, MAX_CONTINUE);
    if (!entries.length) return null;

    return (
        <nav class="continue" aria-label={t('continue.title')}>
            <span class="eyebrow">{t('continue.title')}</span>
            {entries.map((entry: ContinueEntry) => (
                <a key={entry.url} class="continue-link" href={entry.url} {...linkTarget(state)}
                    title={entry.sessionId ? `${t('continue.closed')} · ${hostOf(entry.url)}` : hostOf(entry.url)}
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
                    <span>{entry.title}</span>
                </a>
            ))}
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

    const move = (delta: -1 | 1) => {
        update(s => shiftSpace(s, space.id, delta));
        // The node is re-inserted when it moves; give it the focus back.
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-flip="${space.id}"]`)?.focus());
    };

    return (
        <button type="button" class={`plate ${dropClass} ${dragging ? 'is-dragging' : ''}`} data-flip={space.id}
            style={{ '--tint': space.accent, '--i': index }} draggable
            aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
            onClick={() => setUi({ spaceId: space.id })}
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
                <span class="plate-glyph"><Icon name={space.glyph} size={compact ? 18 : 22} /></span>
                {index < 9 && <kbd class="plate-key" aria-hidden="true">{index + 1}</kbd>}
            </span>
            <span class="plate-text">
                <span class="plate-name">{space.name}</span>
                <span class="plate-count">{space.note ?? t('space.count', { n: items.length })}</span>
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
        <section class="deck-section" aria-labelledby="deck-title">
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

function Dock({ state }: { state: AppState }) {
    const ref = useRef<HTMLElement>(null);
    const entries = activeDock(state).filter(e => (e.kind === 'item' ? state.items[e.id] : state.spaces[e.id]));
    const [over, setOver] = useState<string | null>(null);
    useFlip(ref, entries.map(entryKey).join());
    if (!state.prefs.showDock || !entries.length) return null;

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
    const unpin = (entry: DockEntry): MenuItem => ({ label: t('dock.remove'), glyph: 'pin', run: () => update(s => toggleDock(s, entry)) });

    return (
        <nav ref={ref} class="dock" aria-label={t('dock.title')}>
            {entries.map(entry => {
                const dropClass = over === entryKey(entry) ? 'is-drop' : '';
                if (entry.kind === 'space') {
                    const space = state.spaces[entry.id]!;
                    return (
                        <button type="button" key={entryKey(entry)} class={`dock-item dock-space ${dropClass}`} style={{ '--tint': space.accent }}
                            title={space.name} aria-label={space.name} {...dragProps(entry)}
                            onClick={() => setUi({ spaceId: space.id })}
                            onContextMenu={event => openMenu(event, [unpin(entry)])}>
                            <Icon name={space.glyph} size={19} />
                        </button>
                    );
                }
                const item = state.items[entry.id]!;
                const spaceId = locateItem(state, item.id)?.spaceId;
                return (
                    <a key={entryKey(entry)} href={item.url} {...linkTarget(state)} class={`dock-item ${dropClass}`}
                        title={item.title} aria-label={item.title} {...dragProps(entry)}
                        onClick={() => remember(item.url, item.title, spaceId)}
                        onContextMenu={event => openMenu(event, [
                            { label: t('item.openNewTab'), glyph: 'external', run: () => launch(item.url, item.title, { newTab: true, spaceId }) },
                            unpin(entry),
                        ])}>
                        <AppIcon url={item.url} title={item.title} icon={item.icon} size={38} />
                    </a>
                );
            })}
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

export function Home({ state, covered }: { state: AppState; covered: boolean }) {
    // Keyed by Mode: switching replays the entrance, so the change of context is felt.
    const modeKey = state.activeModeId ?? 'all';
    return (
        <div class="home" inert={covered}>
            <header class="topbar">
                <ModeSwitch state={state} />
                <div class="topbar-end">
                    <Clock />
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
                    <Deck key={modeKey} state={state} />
                </main>
            </div>
            <Dock key={modeKey} state={state} />
        </div>
    );
}

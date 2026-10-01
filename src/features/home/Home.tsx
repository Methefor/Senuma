import { useEffect, useState } from 'preact/hooks';
import { launch, remember, setupNames } from '../../app/actions';
import { CATEGORIES } from '../../core/catalog';
import { duplicateSpace, itemsOf, pinnedItems, removeRecent, removeSpace, setActiveMode, togglePin, visibleSpaces } from '../../core/ops';
import { applyStarter } from '../../core/setup';
import type { AppState, Item, Space } from '../../core/types';
import { hostOf, normalizeUrl } from '../../core/url';
import { t, type MessageKey } from '../../i18n';
import { app, openMenu, setUi, toast, update } from '../../storage/store';
import { AppIcon } from '../../ui/AppIcon';
import { Icon } from '../../ui/Icon';
import { Launcher } from '../command/Launcher';

const MAX_CONTINUE = 6;
const PLATE_PREVIEW = 5;
const CLOCK_TICK_MS = 15_000;

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

function TopBar({ state }: { state: AppState }) {
    return (
        <header class="topbar">
            {state.modeOrder.length > 0 ? (
                <nav class="modes" aria-label={t('settings.modes')}>
                    <button type="button" aria-pressed={!state.activeModeId} onClick={() => update(s => setActiveMode(s, null))}>
                        {t('mode.all')}
                    </button>
                    {state.modeOrder.map(id => {
                        const mode = state.modes[id]!;
                        return (
                            <button type="button" key={id} aria-pressed={state.activeModeId === id}
                                onClick={() => update(s => setActiveMode(s, id))}>
                                <Icon name={mode.glyph} size={14} />
                                {mode.name}
                            </button>
                        );
                    })}
                </nav>
            ) : <span />}
            <div class="topbar-end">
                <Clock />
                <button type="button" class="icon-button" title={t('settings.title')} aria-label={t('settings.title')}
                    onClick={() => setUi({ settings: 'appearance' })}>
                    <Icon name="sliders" />
                </button>
            </div>
        </header>
    );
}

// ---------- Continue ----------

interface ContinueEntry {
    url: string;
    title: string;
    /** Present for a recently closed tab, which is restored rather than re-opened. */
    sessionId?: string;
}

function useClosedTabs(enabled: boolean): ContinueEntry[] {
    const [closed, setClosed] = useState<ContinueEntry[]>([]);
    useEffect(() => {
        if (!enabled || typeof chrome === 'undefined' || !chrome.sessions) return setClosed([]);
        chrome.sessions.getRecentlyClosed({ maxResults: 10 }).then(sessions => {
            const tabs = sessions.flatMap(session => (session.tab ? [session.tab] : (session.window?.tabs ?? [])));
            setClosed(tabs.flatMap(tab => {
                const url = normalizeUrl(tab.url);
                return url && tab.sessionId ? [{ url, title: tab.title || hostOf(url), sessionId: tab.sessionId }] : [];
            }));
        }).catch(() => setClosed([]));
    }, [enabled]);
    return closed;
}

function Continue({ state }: { state: AppState }) {
    const closed = useClosedTabs(state.prefs.showContinue && state.prefs.showClosedTabs);
    if (!state.prefs.showContinue) return null;

    const seen = new Set<string>();
    const entries = [...state.recents, ...closed].filter(entry => !seen.has(entry.url) && !!seen.add(entry.url)).slice(0, MAX_CONTINUE);
    if (!entries.length) return null;

    return (
        <section class="continue" aria-labelledby="continue-title">
            <h2 id="continue-title" class="eyebrow">{t('continue.title')}</h2>
            <div class="continue-row">
                {entries.map((entry: ContinueEntry) => (
                    <a key={entry.url} class="chip" href={entry.url} {...linkTarget(state)} title={entry.url}
                        onClick={event => {
                            if (entry.sessionId) {
                                event.preventDefault();
                                void chrome.sessions.restore(entry.sessionId);
                            } else remember(entry.url, entry.title);
                        }}
                        onContextMenu={event => {
                            if (entry.sessionId) return;
                            openMenu(event, [{ label: t('continue.remove'), glyph: 'x', run: () => update(s => removeRecent(s, entry.url)) }]);
                        }}>
                        <AppIcon url={entry.url} title={entry.title} size={22} />
                        <span class="chip-text">
                            <span class="chip-title">{entry.title}</span>
                            <span class="chip-sub">{entry.sessionId ? t('continue.closed') : hostOf(entry.url)}</span>
                        </span>
                    </a>
                ))}
            </div>
        </section>
    );
}

// ---------- Spaces ----------

export function spaceMenu(space: Space) {
    return [
        { label: t('open'), glyph: 'enter', run: () => setUi({ spaceId: space.id }) },
        { label: t('space.openAll'), glyph: 'external', run: () => openAll(space) },
        { label: t('edit'), glyph: 'pen', separatorBefore: true, run: () => setUi({ editor: { kind: 'space', spaceId: space.id } }) },
        { label: t('duplicate'), glyph: 'copy', run: () => update(s => duplicateSpace(s, space.id, t('space.copyOf', { name: space.name })).state) },
        {
            label: t('delete'), glyph: 'trash', danger: true, separatorBefore: true,
            run: () => {
                const before = app.get();
                update(s => removeSpace(s, space.id));
                setUi({ spaceId: null });
                toast(t('space.deleted', { name: space.name }), before);
            },
        },
    ];
}

export function openAll(space: Space): void {
    for (const item of itemsOf(app.get(), space)) window.open(item.url, '_blank', 'noopener');
}

function Plate({ state, space, index }: { state: AppState; space: Space; index: number }) {
    const items = itemsOf(state, space);
    return (
        <button type="button" class="plate" style={{ '--tint': space.accent, '--i': index }}
            onClick={() => setUi({ spaceId: space.id })}
            onContextMenu={event => openMenu(event, spaceMenu(space))}>
            <span class="plate-top">
                <span class="plate-glyph"><Icon name={space.glyph} size={22} /></span>
                {index < 9 && <kbd class="plate-key" aria-hidden="true">{index + 1}</kbd>}
            </span>
            <span class="plate-name">{space.name}</span>
            <span class="plate-count">{t('space.count', { n: items.length })}</span>
            <span class="plate-icons">
                {items.slice(0, PLATE_PREVIEW).map(item => <AppIcon key={item.id} url={item.url} title={item.title} icon={item.icon} size={24} />)}
                {items.length > PLATE_PREVIEW && <span class="plate-more">+{items.length - PLATE_PREVIEW}</span>}
            </span>
        </button>
    );
}

function Deck({ state }: { state: AppState }) {
    const spaces = visibleSpaces(state);
    const mode = state.activeModeId ? state.modes[state.activeModeId] : undefined;

    if (state.spaceOrder.length === 0) {
        return (
            <section class="empty">
                <h2>{t('empty.firstSpace')}</h2>
                <p>{t('empty.firstSpaceHint')}</p>
                <div class="pick-row">
                    {CATEGORIES.map(category => (
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

    return (
        <section class="deck-section" aria-labelledby="deck-title">
            <h2 id="deck-title" class="eyebrow">{mode ? mode.name : t('spaces.title')}</h2>
            <div class="deck">
                {spaces.map((space, index) => <Plate key={space.id} state={state} space={space} index={index} />)}
                <button type="button" class="plate plate-new" onClick={() => setUi({ editor: { kind: 'space' } })}>
                    <Icon name="plus" size={22} />
                    <span>{t('space.new')}</span>
                </button>
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

function Dock({ state }: { state: AppState }) {
    const pinned = pinnedItems(state);
    if (!state.prefs.showDock || !pinned.length) return null;
    return (
        <nav class="dock" aria-label={t('dock.title')}>
            {pinned.map((item: Item) => (
                <a key={item.id} href={item.url} {...linkTarget(state)} class="dock-item" title={item.title} aria-label={item.title}
                    onClick={() => remember(item.url, item.title)}
                    onContextMenu={event => openMenu(event, [
                        { label: t('item.openNewTab'), glyph: 'external', run: () => launch(item.url, item.title, true) },
                        { label: t('item.unpin'), glyph: 'pin', run: () => update(s => togglePin(s, item.id)) },
                    ])}>
                    <AppIcon url={item.url} title={item.title} icon={item.icon} size={38} />
                </a>
            ))}
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
    return (
        <div class="home" inert={covered}>
            <TopBar state={state} />
            <main class="stage">
                <div class="hero">
                    <h1 class="greeting">{greeting()}</h1>
                    <Launcher variant="home" />
                </div>
                <Continue state={state} />
                <Deck state={state} />
            </main>
            <Dock state={state} />
        </div>
    );
}

import type { ComponentType } from 'preact';
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { readLocal } from '../browser/kv';
import { sourceKey } from '../core/background';
import { relocalize } from '../core/names';
import { visibleSpaces } from '../core/ops';
import { Backdrop } from '../features/background/Backdrop';
import { CommandPalette } from '../features/command/Launcher';
import { Home } from '../features/home/Home';
import { ensureLanguage, setLanguage, t, translations, type MessageKey } from '../i18n';
import { app, setUi, ui, update, useStore } from '../storage/store';
import { ContextMenu, Toasts } from '../ui/Layers';
import { applyAppearance, savedAppearance } from './appearance';

/** Names Senuma gave follow the language; a name the person typed is never touched (core/names.ts). */
async function localizeNames(): Promise<void> {
    // A setup from before names carried keys may hold Turkish defaults: have both languages to recognise them.
    if (Object.values(app.get().spaces).some(space => space.templateId && !space.nameKey)) await ensureLanguage('tr');
    update(s => relocalize(s, { text: key => t(key as MessageKey), known: translations }));
}

/** Loads a secondary screen only when it is first shown, keeping it out of the startup path. */
function useLazy<P>(wanted: boolean, loader: () => Promise<ComponentType<P>>): ComponentType<P> | null {
    const [component, setComponent] = useState<ComponentType<P> | null>(null);
    useEffect(() => {
        if (wanted && !component) void loader().then(loaded => setComponent(() => loaded));
    }, [wanted]);
    return component;
}

const loadSettings = () => import('../features/settings/Settings').then(m => m.Settings);
const loadOnboarding = () => import('../features/onboarding/Onboarding').then(m => m.Onboarding);
const loadCustomize = () => import('../features/customize/Customize').then(m => m.Customize);
// Opening a Space and editing are one chunk: they are needed a moment after Home, not for it.
const loadSpaces = () => import('../features/spaces/SpaceView');
const loadSpaceView = () => loadSpaces().then(m => m.SpaceView);
const loadReview = () => import('../features/help/ReviewPrompt').then(m => m.ReviewPrompt);

/** Whether the review card may be considered yet; its full rules load only then (features/help/review.ts). */
function reviewDue(): boolean {
    const record = readLocal('bos.review') as { next?: number; done?: boolean } | undefined;
    return !record || (!record.done && (record.next ?? 0) <= Date.now());
}
const loadEditor = () => loadSpaces().then(m => m.Editor);

/** Fetches the Space view while the browser is idle, so the first click on a Space is instant. */
function usePrefetch(loader: () => Promise<unknown>): void {
    useEffect(() => {
        const handle = requestIdleCallback(() => void loader(), { timeout: 2000 });
        return () => cancelIdleCallback(handle);
    }, []);
}

function isTyping(target: EventTarget | null): boolean {
    const node = target as HTMLElement | null;
    return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable);
}

/**
 * Shortcuts work as soon as the page has keyboard focus. On a brand-new tab the browser
 * puts focus in its address bar, as it does for every new tab; this page leaves that alone
 * and does not redirect, reopen or otherwise pull focus away. One click or Tab into the
 * page and every shortcut below is live.
 */
function useShortcuts(): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const state = ui.get();
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (app.get().onboarded && !state.customize) setUi({ palette: !state.palette, menu: null });
                return;
            }
            // Single-key shortcuts belong to Home only: never while typing, never with a
            // modifier (those are the browser's), never while a panel or menu is open.
            const busy = state.palette || state.spaceId || state.settings || state.editor || state.menu || state.customize || !app.get().onboarded;
            if (busy || isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === '/') {
                event.preventDefault();
                document.getElementById('home-search')?.focus();
            } else if (event.key.toLowerCase() === 'm') {
                document.getElementById('mode-switch')?.click();
            } else if (/^[1-9]$/.test(event.key)) {
                const space = visibleSpaces(app.get())[Number(event.key) - 1];
                if (space) setUi({ spaceId: space.id, origin: null });
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}

export function App() {
    const state = useStore(app);
    const view = useStore(ui);
    setLanguage(state.prefs.language);
    useShortcuts();

    // Switching language may need its strings fetched; render again once they are here.
    const [, setStringsReady] = useState(0);
    useEffect(() => {
        void ensureLanguage(state.prefs.language).then(() => {
            setStringsReady(n => n + 1);
            void localizeNames();
        });
    }, [state.prefs.language]);

    // What is shown is the saved look, unless Customize is trying one out.
    const look = view.preview ?? savedAppearance(state);
    useLayoutEffect(
        () => applyAppearance(look, state.prefs.language),
        [look.themeId, look.atmosphere, look.motion, sourceKey(look.background.source), state.prefs.language],
    );

    // Only people upgrading from 1.x ever see this, once.
    const MigrationSummary = useLazy(!!state.legacy && !state.legacy.acknowledged, () => import('../features/onboarding/MigrationSummary').then(module => module.MigrationSummary));
    const Settings = useLazy(view.settings !== null, loadSettings);
    const Onboarding = useLazy(!state.onboarded, loadOnboarding);
    const Customize = useLazy(view.customize, loadCustomize);
    const SpaceView = useLazy(view.spaceId !== null, loadSpaceView);
    const Editor = useLazy(view.editor !== null, loadEditor);
    usePrefetch(loadSpaces);

    const space = view.spaceId ? state.spaces[view.spaceId] : undefined;
    const covered = !!(space || view.palette || view.settings !== null || view.editor || view.customize || !state.onboarded);
    const showSummary = state.onboarded && state.legacy && !state.legacy.acknowledged && !covered;
    const [reviewWanted] = useState(reviewDue);
    const showReview = reviewWanted && state.onboarded && !covered && !showSummary;
    const ReviewPrompt = useLazy(showReview, loadReview);

    return (
        <>
            <Backdrop themeId={look.themeId} background={look.background} assets={state.wallpapers} />
            {/* While customizing, the page stays fully visible: it is the preview. */}
            <Home state={state} covered={covered} previewing={view.customize} />
            {space && SpaceView && <SpaceView key={space.id} state={state} space={space} origin={view.origin} />}
            {view.settings !== null && Settings && <Settings state={state} section={view.settings} />}
            {view.customize && Customize && <Customize state={state} />}
            {view.editor && Editor && <Editor state={state} target={view.editor} />}
            {view.palette && <CommandPalette />}
            {!state.onboarded && Onboarding && <Onboarding state={state} />}
            {showSummary && MigrationSummary && <MigrationSummary legacy={state.legacy!} />}
            {showReview && ReviewPrompt && <ReviewPrompt />}
            <ContextMenu />
            <Toasts />
        </>
    );
}

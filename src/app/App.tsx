import type { ComponentType } from 'preact';
import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { effectiveThemeId, visibleSpaces } from '../core/ops';
import { applyTheme, themeById } from '../core/themes';
import type { AppState } from '../core/types';
import { CommandPalette } from '../features/command/Launcher';
import { Home } from '../features/home/Home';
import { MigrationSummary } from '../features/onboarding/MigrationSummary';
import { Editor } from '../features/spaces/Editors';
import { SpaceView } from '../features/spaces/SpaceView';
import { ensureLanguage, setLanguage } from '../i18n';
import { app, setUi, ui, useStore } from '../storage/store';
import { ContextMenu, Toasts } from '../ui/Layers';

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

function isTyping(target: EventTarget | null): boolean {
    const node = target as HTMLElement | null;
    return !!node && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.tagName === 'SELECT' || node.isContentEditable);
}

function useShortcuts(): void {
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const state = ui.get();
            if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                if (app.get().onboarded) setUi({ palette: !state.palette, menu: null });
                return;
            }
            // Single-key shortcuts belong to Home only: never while typing, never with a
            // modifier (those are the browser's), never while a panel or menu is open.
            const busy = state.palette || state.spaceId || state.settings || state.editor || state.menu || !app.get().onboarded;
            if (busy || isTyping(event.target) || event.ctrlKey || event.metaKey || event.altKey) return;
            if (event.key === '/') {
                event.preventDefault();
                document.getElementById('home-search')?.focus();
            } else if (event.key.toLowerCase() === 'm') {
                document.getElementById('mode-switch')?.click();
            } else if (/^[1-9]$/.test(event.key)) {
                const space = visibleSpaces(app.get())[Number(event.key) - 1];
                if (space) setUi({ spaceId: space.id });
            }
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}

export function applyAppearance(state: AppState): void {
    const root = document.documentElement;
    applyTheme(themeById(effectiveThemeId(state)), root);
    root.dataset.motion = state.prefs.motion;
    root.lang = state.prefs.language;
}

export function App() {
    const state = useStore(app);
    const view = useStore(ui);
    setLanguage(state.prefs.language);
    useShortcuts();

    // Switching language may need its strings fetched; render again once they are here.
    const [, setStringsReady] = useState(0);
    useEffect(() => {
        void ensureLanguage(state.prefs.language).then(() => setStringsReady(n => n + 1));
    }, [state.prefs.language]);

    const themeId = effectiveThemeId(state);
    useLayoutEffect(() => applyAppearance(state), [themeId, state.prefs.motion, state.prefs.language]);

    const Settings = useLazy(view.settings !== null, loadSettings);
    const Onboarding = useLazy(!state.onboarded, loadOnboarding);

    const space = view.spaceId ? state.spaces[view.spaceId] : undefined;
    const covered = !!(space || view.palette || view.settings !== null || view.editor || !state.onboarded);
    const showSummary = state.onboarded && state.legacy && !state.legacy.acknowledged && !covered;

    return (
        <>
            {/* Keyed by theme so a new backdrop fades in over the old colour instead of snapping. */}
            <div class="backdrop" key={themeId} aria-hidden="true"><i class="backdrop-glow" /></div>
            <Home state={state} covered={covered} />
            {space && <SpaceView key={space.id} state={state} space={space} />}
            {view.settings !== null && Settings && <Settings state={state} section={view.settings} />}
            {view.editor && <Editor state={state} target={view.editor} />}
            {view.palette && <CommandPalette />}
            {!state.onboarded && Onboarding && <Onboarding state={state} />}
            {showSummary && <MigrationSummary legacy={state.legacy!} />}
            <ContextMenu />
            <Toasts />
        </>
    );
}

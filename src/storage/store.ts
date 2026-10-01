/**
 * State containers. `app` holds persistent user data (saved, debounced); `ui` holds
 * session-only interface state (never saved). Everything else is derived at render time.
 */
import { useEffect, useState } from 'preact/hooks';
import { emptyState } from '../core/defaults';
import type { AppState, ID, Snapshot } from '../core/types';
import { saveState } from './storage';

export interface Store<T> {
    get(): T;
    set(next: T): void;
    subscribe(listener: () => void): () => void;
}

function createStore<T>(initial: T): Store<T> {
    let value = initial;
    const listeners = new Set<() => void>();
    return {
        get: () => value,
        set(next) {
            if (next === value) return;
            value = next;
            listeners.forEach(l => l());
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    };
}

export function useStore<T>(store: Store<T>): T {
    const [value, setValue] = useState(store.get());
    useEffect(() => {
        setValue(store.get());
        return store.subscribe(() => setValue(store.get()));
    }, [store]);
    return value;
}

// ---------- Persistent ----------

const SAVE_DELAY_MS = 250;

export const app = createStore<AppState>(emptyState());

let saveTimer: number | undefined;
let persistErrorHandler: (() => void) | undefined;

function flush(): void {
    if (saveTimer === undefined) return;
    clearTimeout(saveTimer);
    saveTimer = undefined;
    saveState(app.get()).catch(() => persistErrorHandler?.());
}

/** Applies a pure transition, stamps it, and schedules one coalesced write. */
export function update(transition: (state: AppState) => AppState): void {
    const current = app.get();
    const next = transition(current);
    if (next === current) return;
    app.set({ ...next, updatedAt: Date.now() });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, SAVE_DELAY_MS) as unknown as number;
}

/** Replaces the state without saving (boot, or a newer state arriving from another tab). */
export function hydrate(state: AppState): void {
    app.set(state);
}

export function onPersistError(handler: () => void): void {
    persistErrorHandler = handler;
}

// A new tab is often closed within a second of an edit; make sure the write still happens.
if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
    });
}

/** Local restore points; loaded on demand, kept in their own storage key. */
export const snapshots = createStore<Snapshot[] | null>(null);

// ---------- Session UI ----------

export interface MenuItem {
    label: string;
    glyph?: string;
    danger?: boolean;
    disabled?: boolean;
    /** Shows a tick: the current choice in a list of alternatives. */
    checked?: boolean;
    /** A non-interactive section label. */
    heading?: boolean;
    separatorBefore?: boolean;
    run?: () => void;
}

export interface Toast {
    id: number;
    message: string;
    /** Reverses exactly the change this toast announces; later edits are kept. */
    undo?: (state: AppState) => AppState;
}

export type EditorTarget =
    | { kind: 'item'; spaceId: ID; groupId?: ID; itemId?: ID }
    | { kind: 'space'; spaceId?: ID };

export interface UiState {
    palette: boolean;
    spaceId: ID | null;
    /** Open settings section, or null when closed. */
    settings: string | null;
    editor: EditorTarget | null;
    menu: { x: number; y: number; items: MenuItem[] } | null;
    toasts: Toast[];
}

export const ui = createStore<UiState>({ palette: false, spaceId: null, settings: null, editor: null, menu: null, toasts: [] });

export function setUi(patch: Partial<UiState>): void {
    ui.set({ ...ui.get(), ...patch });
}

/** How long a toast, and with it the chance to undo, stays available. */
const TOAST_MS = 7000;
let toastSeq = 0;

export function toast(message: string, undo?: Toast['undo']): void {
    const id = ++toastSeq;
    setUi({ toasts: [...ui.get().toasts.slice(-2), { id, message, ...(undo ? { undo } : {}) }] });
    setTimeout(() => dismissToast(id), TOAST_MS);
}

export function dismissToast(id: number): void {
    setUi({ toasts: ui.get().toasts.filter(t => t.id !== id) });
}

export function openMenu(event: MouseEvent, items: MenuItem[]): void {
    event.preventDefault();
    event.stopPropagation();
    setUi({ menu: { x: event.clientX, y: event.clientY, items } });
}

/** Opens a menu hanging from a control (a dropdown) rather than at the pointer. */
export function openMenuBelow(anchor: HTMLElement, items: MenuItem[]): void {
    const rect = anchor.getBoundingClientRect();
    setUi({ menu: { x: rect.left, y: rect.bottom + 6, items } });
}

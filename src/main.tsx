import { render } from 'preact';
import { App, applyAppearance } from './app/App';
import { setLanguage, t } from './i18n';
import { loadState, onExternalChange, readCachedState, saveState } from './storage/storage';
import { app, hydrate, onPersistError, toast } from './storage/store';
import './styles/base.css';
import './styles/home.css';
import './styles/overlays.css';

function mount(): void {
    render(<App />, document.getElementById('app')!);
}

async function boot(): Promise<void> {
    // 1. Paint immediately from the synchronous mirror when there is one.
    const cached = readCachedState();
    if (cached) {
        hydrate(cached);
        applyAppearance(cached);
        mount();
    }

    // 2. Reconcile with the real store (and migrate a legacy install on first run).
    let resolved;
    try {
        resolved = await loadState();
    } catch {
        if (!cached) mount();
        return;
    }
    const { source, dropped } = resolved;
    // A brand-new install starts in the browser's language when we speak it.
    const state = source === 'fresh' && navigator.language.toLowerCase().startsWith('tr')
        ? { ...resolved.state, prefs: { ...resolved.state.prefs, language: 'tr' as const } }
        : resolved.state;
    const current = app.get();
    if (!cached || state.updatedAt > current.updatedAt) {
        hydrate(state);
        applyAppearance(state);
    }
    if (!cached) mount();

    // A migrated state exists only in memory until now; the mirror may also be ahead of the
    // store if the last tab closed mid-write. Either way, make the store current.
    if (source === 'legacy' || app.get().updatedAt > state.updatedAt) {
        saveState(app.get()).catch(() => toast(t('error.save')));
    }
    if (source === 'legacy') {
        setLanguage(app.get().prefs.language);
        toast(dropped ? t('migrate.doneDropped', { n: dropped }) : t('migrate.done'));
    }

    onPersistError(() => toast(t('error.save')));
    onExternalChange(incoming => {
        if (incoming.updatedAt > app.get().updatedAt) hydrate(incoming);
    });
}

void boot();

import { render } from 'preact';
import { App } from './app/App';
import { applyAppearance, savedAppearance } from './app/appearance';
import { ensureLanguage, setLanguage, t } from './i18n';
import { loadState, onExternalChange, readCachedState, saveState } from './storage/storage';
import { app, hydrate, onPersistError, toast } from './storage/store';
import { SYNC, SYNC_ON_FLAG } from './sync/config';
import './styles/base.css';
import './styles/home.css';
import './styles/overlays.css';

let mounted = false;

/** Critical path: state → theme → Home shell. Everything optional loads after this. */
function mount(): void {
    if (mounted) return;
    mounted = true;
    render(<App />, document.getElementById('app')!);
    performance.mark('app:mounted');
}

async function boot(): Promise<void> {
    // 1. Paint immediately from the synchronous mirror when there is one.
    const cached = readCachedState();
    if (cached) {
        hydrate(cached);
        // A packaged file, read from disk: this does not delay the first paint noticeably.
        await ensureLanguage(cached.prefs.language);
        setLanguage(cached.prefs.language);
        applyAppearance(savedAppearance(cached), cached.prefs.language);
        mount();
    }

    onPersistError(() => toast(t('error.save')));

    // 2. Reconcile with the real store (and convert a legacy install on first run).
    let resolved;
    try {
        resolved = await loadState();
    } catch {
        // Storage is unreadable. Show what we have rather than a blank page, and say so.
        mount();
        toast(t('error.load'));
        return;
    }
    const { source } = resolved;
    // A brand-new install starts in the browser language when we speak it.
    const state = source === 'fresh' && navigator.language.toLowerCase().startsWith('tr')
        ? { ...resolved.state, prefs: { ...resolved.state.prefs, language: 'tr' as const } }
        : resolved.state;
    if (!cached || state.updatedAt > app.get().updatedAt) {
        hydrate(state);
        await ensureLanguage(state.prefs.language);
        setLanguage(state.prefs.language);
        applyAppearance(savedAppearance(state), state.prefs.language);
    }
    mount();

    // A converted legacy setup exists only in memory until now; the mirror may also be ahead
    // of the store if the last tab closed mid-write. Either way, make the store current.
    if (source === 'legacy' || resolved.report || app.get().updatedAt > state.updatedAt) {
        saveState(app.get()).catch(() => toast(t('error.save')));
    }
    // The size limits changed something in a setup saved before them: say what, once.
    if (resolved.report) void import('./app/limitsNotice').then(async module => toast(await module.limitsNotice(resolved.report!, true)));
    // Only on the upgrade itself: bring a picture 1.x stored over to the wallpaper library.
    if (source === 'legacy') void import('./app/legacyBackground').then(module => module.migrateLegacyPicture());

    // Sync is loaded only on a device that has it turned on.
    if (SYNC && localStorage.getItem(SYNC_ON_FLAG)) void import('./sync/syncRuntime').then(module => module.syncRuntime());

    onExternalChange(incoming => {
        if (incoming.updatedAt > app.get().updatedAt) hydrate(incoming);
    });
}

void boot();

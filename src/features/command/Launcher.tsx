import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { commandLabels, providerLabel, runAction } from '../../app/actions';
import { buildResults, defaultResults, groupResults, type Result, type ResultGroup } from '../../core/commands';
import { activeMode, effectiveProviderId, recordUsage, setPrefs, updateMode } from '../../core/ops';
import { findProvider, routeQuery } from '../../core/search';
import type { AppState, SearchProvider } from '../../core/types';
import { t, type MessageKey } from '../../i18n';
import { app, openMenuBelow, setUi, update, useStore } from '../../storage/store';
import { AppIcon } from '../../ui/AppIcon';
import { Icon } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';

/** Results that are a destination in themselves are worth remembering; a web search is not. */
const REMEMBERED: ReadonlySet<Result['kind']> = new Set(['item', 'space', 'mode', 'command', 'theme']);

export const MODIFIER_KEY = navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl';

function ProviderIcon({ provider, size }: { provider: SearchProvider; size: number }) {
    // The browser's own engine is not ours to name; every other engine shows its site icon.
    if (!provider.urlTemplate) return <Icon name="search" size={size - 2} />;
    return <AppIcon url={provider.urlTemplate.replace('%s', '')} title={provider.name} size={size} />;
}

/** The engine a plain search goes to. Click to change it; aliases are shown as a reminder. */
function ProviderButton({ state, provider }: { state: AppState; provider: SearchProvider }) {
    const mode = activeMode(state);
    const choose = (id: string) => () =>
        // A Mode that sets its own engine keeps that choice to itself.
        update(s => (mode?.providerId ? updateMode(s, mode.id, { providerId: id }) : setPrefs(s, { defaultProviderId: id })));
    return (
        <button type="button" class="provider-button" aria-haspopup="menu" tabIndex={-1}
            title={t('search.engine', { name: providerLabel(provider) })} aria-label={t('search.engine', { name: providerLabel(provider) })}
            onClick={event => {
                event.preventDefault();
                openMenuBelow(event.currentTarget, [
                    { label: t('search.searchWith'), heading: true },
                    ...state.providers.map(p => ({ label: providerLabel(p), checked: p.id === provider.id, shortcut: p.aliases[0], run: choose(p.id) })),
                    { label: t('search.manage'), glyph: 'sliders', separatorBefore: true, run: () => setUi({ settings: 'search' }) },
                ]);
            }}>
            <ProviderIcon provider={provider} size={22} />
        </button>
    );
}

interface Props {
    /** `home` is the search box on the page; `palette` is the command center. */
    variant: 'home' | 'palette';
}

/** One input for everything: saved apps, Spaces, Modes, commands, addresses and web search. */
export function Launcher({ variant }: Props) {
    const state = useStore(app);
    const [query, setQuery] = useState('');
    const [index, setIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const listId = `launcher-${variant}`;
    const providerId = effectiveProviderId(state);

    const results = useMemo<Result[]>(() => {
        const labels = commandLabels();
        const found = query.trim()
            ? buildResults(query, state, { surface: variant, defaultProviderId: providerId, labels })
            : variant === 'palette' ? defaultResults(state, labels) : [];
        // The command center shows results under headings; the order shown is the order run.
        return variant === 'palette' ? groupResults(found).flatMap(g => g.results) : found;
    }, [query, state, variant, providerId]);

    const active = Math.min(index, Math.max(0, results.length - 1));

    // Keep the highlighted row in view while arrowing through a long list.
    useEffect(() => {
        listRef.current?.querySelector('.result.is-active')?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const run = (result: Result | undefined) => {
        if (!result) return;
        if (result.action.type === 'prefill') {
            setQuery(result.action.text);
            setIndex(0);
            inputRef.current?.focus();
            return;
        }
        if (REMEMBERED.has(result.kind)) update(s => recordUsage(s, result.key));
        setQuery('');
        setIndex(0);
        runAction(result.action);
    };

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!results.length) return;
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setIndex((active + step + results.length) % results.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            run(results[active]);
        } else if (event.key === 'Escape' && variant === 'home') {
            if (query) setQuery('');
            else inputRef.current?.blur();
        }
    };

    const open = results.length > 0;
    const placeholder = t(variant === 'home' ? 'search.placeholder' : 'palette.placeholder');
    const provider = findProvider(state.providers, providerId);
    // While typing, say where Enter will send a search: "y lofi" shows YouTube before you commit.
    const route = routeQuery(query, state.providers, providerId);
    const routed = route?.kind === 'search' && route.via === 'alias' ? route.provider : null;

    const row = (result: Result, i: number) => (
        <div key={result.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}
            class={`result ${i === active ? 'is-active' : ''}`}
            onMouseMove={() => i !== active && setIndex(i)}
            onMouseDown={event => event.preventDefault()}
            onClick={() => run(result)}>
            <span class="result-icon" style={result.accent ? { '--tint': result.accent } : undefined}>
                {result.iconUrl
                    ? <AppIcon url={result.iconUrl} title={result.title} icon={result.iconOverride} size={24} />
                    : <Icon name={result.glyph ?? 'globe'} size={17} />}
            </span>
            <span class="result-title">{result.title}</span>
            {result.hint && <span class="result-hint">{result.hint}</span>}
            {result.shortcut && <kbd class="result-key">{result.shortcut}</kbd>}
            <span class="result-enter"><Icon name="enter" size={14} /></span>
        </div>
    );

    let groupStart: ResultGroup | null = null;

    return (
        <div class={`launcher launcher-${variant} ${open ? 'is-open' : ''}`}>
            <label class="launcher-field">
                {variant === 'home' ? <ProviderButton state={state} provider={routed ?? provider} /> : <Icon name="search" size={20} />}
                <input ref={inputRef} id={variant === 'home' ? 'home-search' : undefined} type="text" value={query}
                    autofocus={variant === 'palette'} autocomplete="off" spellcheck={false}
                    placeholder={placeholder} aria-label={placeholder}
                    role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
                    aria-activedescendant={open ? `${listId}-${active}` : undefined}
                    onInput={event => {
                        setQuery(event.currentTarget.value);
                        setIndex(0);
                    }}
                    onKeyDown={onKeyDown} />
                {routed && <span class="route-chip">{routed.name}</span>}
                {variant === 'home' && !query && (
                    <button type="button" class="kbd-hint" tabIndex={-1} onClick={() => setUi({ palette: true })} aria-label={t('palette.open')}>
                        <kbd>{MODIFIER_KEY}</kbd><kbd>K</kbd>
                    </button>
                )}
            </label>
            {open && (
                <div class="results" id={listId} ref={listRef} role="listbox">
                    {results.map((result, i) => {
                        const heading = variant === 'palette' && result.group !== groupStart;
                        groupStart = result.group;
                        return heading
                            ? [<div class="result-group" role="presentation" key={`group-${result.group}`}>{t(`results.${result.group}` as MessageKey)}</div>, row(result, i)]
                            : row(result, i);
                    })}
                </div>
            )}
            {variant === 'palette' && (
                <div class="palette-foot">
                    <span><kbd>↑</kbd><kbd>↓</kbd> {t('palette.navigate')}</span>
                    <span><kbd>↵</kbd> {t('palette.run')}</span>
                    <span><kbd>Esc</kbd> {t('close')}</span>
                    <span class="palette-tip">{t('palette.tip')}</span>
                </div>
            )}
        </div>
    );
}

export function CommandPalette() {
    return (
        <Overlay label={t('palette.title')} class="overlay-palette" onClose={() => setUi({ palette: false })}>
            <Launcher variant="palette" />
        </Overlay>
    );
}

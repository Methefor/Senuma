import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { commandLabels, runAction } from '../../app/actions';
import { buildResults, defaultResults, type Result } from '../../core/commands';
import { effectiveProviderId, recordUsage } from '../../core/ops';
import { t } from '../../i18n';
import { app, setUi, update, useStore } from '../../storage/store';
import { AppIcon } from '../../ui/AppIcon';
import { Icon } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';

/** Results that are a destination in themselves are worth remembering; a web search is not. */
const REMEMBERED: ReadonlySet<Result['kind']> = new Set(['item', 'space', 'mode', 'command', 'theme']);

export const MODIFIER_KEY = navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl';

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
    const listRef = useRef<HTMLUListElement>(null);
    const listId = `launcher-${variant}`;

    const results = useMemo<Result[]>(() => {
        const labels = commandLabels();
        if (query.trim()) return buildResults(query, state, { surface: variant, defaultProviderId: effectiveProviderId(state), labels });
        return variant === 'palette' ? defaultResults(state, labels) : [];
    }, [query, state, variant]);

    const active = Math.min(index, Math.max(0, results.length - 1));

    // Keep the highlighted row in view while arrowing through a long list.
    useEffect(() => {
        listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
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

    return (
        <div class={`launcher launcher-${variant} ${open ? 'is-open' : ''}`}>
            <label class="launcher-field">
                <Icon name="search" size={20} />
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
                {variant === 'home' && !query && (
                    <button type="button" class="kbd-hint" tabIndex={-1} onClick={() => setUi({ palette: true })} aria-label={t('palette.open')}>
                        <kbd>{MODIFIER_KEY}</kbd><kbd>K</kbd>
                    </button>
                )}
            </label>
            {open && (
                <ul class="results" id={listId} ref={listRef} role="listbox">
                    {results.map((result, i) => (
                        <li key={result.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                            class={`result ${i === active ? 'is-active' : ''}`}
                            onMouseMove={() => i !== active && setIndex(i)}
                            onMouseDown={event => event.preventDefault()}
                            onClick={() => run(result)}>
                            <span class="result-icon" style={result.accent ? { color: result.accent } : undefined}>
                                {result.iconUrl
                                    ? <AppIcon url={result.iconUrl} title={result.title} icon={result.iconOverride} size={24} />
                                    : <Icon name={result.glyph ?? 'globe'} size={17} />}
                            </span>
                            <span class="result-title">{result.title}</span>
                            {result.hint && <span class="result-hint">{result.hint}</span>}
                            {result.shortcut && <kbd class="result-key">{result.shortcut}</kbd>}
                            <span class="result-enter"><Icon name="enter" size={14} /></span>
                        </li>
                    ))}
                </ul>
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

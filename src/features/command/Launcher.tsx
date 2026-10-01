import { useMemo, useRef, useState } from 'preact/hooks';
import { commandLabels, runAction } from '../../app/actions';
import { buildResults, defaultResults, type Result } from '../../core/commands';
import { effectiveProviderId } from '../../core/ops';
import { t } from '../../i18n';
import { app, setUi, useStore } from '../../storage/store';
import { AppIcon } from '../../ui/AppIcon';
import { Icon } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';

const LIST_ID = 'launcher-results';

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

    const results = useMemo<Result[]>(() => {
        const labels = commandLabels();
        if (query.trim()) return buildResults(query, state, effectiveProviderId(state), labels);
        return variant === 'palette' ? defaultResults(state, labels) : [];
    }, [query, state, variant]);

    const active = Math.min(index, Math.max(0, results.length - 1));

    const run = (result: Result | undefined) => {
        if (!result) return;
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

    return (
        <div class={`launcher launcher-${variant} ${open ? 'is-open' : ''}`}>
            <label class="launcher-field">
                <Icon name="search" size={20} />
                <input ref={inputRef} id={variant === 'home' ? 'home-search' : undefined} type="text" value={query}
                    autofocus={variant === 'palette'} autocomplete="off" spellcheck={false}
                    placeholder={t(variant === 'home' ? 'search.placeholder' : 'palette.placeholder')}
                    role="combobox" aria-expanded={open} aria-controls={LIST_ID} aria-autocomplete="list"
                    aria-activedescendant={open ? `${LIST_ID}-${active}` : undefined}
                    aria-label={t(variant === 'home' ? 'search.placeholder' : 'palette.placeholder')}
                    onInput={event => {
                        setQuery(event.currentTarget.value);
                        setIndex(0);
                    }}
                    onKeyDown={onKeyDown} />
                {variant === 'home' && !query && (
                    <button type="button" class="kbd-hint" tabIndex={-1} onClick={() => setUi({ palette: true })} aria-label={t('palette.open')}>
                        <kbd>{navigator.platform.startsWith('Mac') ? '⌘' : 'Ctrl'}</kbd><kbd>K</kbd>
                    </button>
                )}
            </label>
            {open && (
                <ul class="results" id={LIST_ID} role="listbox">
                    {results.map((result, i) => (
                        <li key={result.key} id={`${LIST_ID}-${i}`} role="option" aria-selected={i === active}
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
                            <span class="result-enter"><Icon name="enter" size={14} /></span>
                        </li>
                    ))}
                </ul>
            )}
            {variant === 'palette' && (
                <div class="palette-foot">
                    <span><kbd>↑</kbd><kbd>↓</kbd> {t('palette.navigate')}</span>
                    <span><kbd>↵</kbd> {t('palette.run')}</span>
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

import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { SETTINGS_SECTIONS, downloadBackup, readBrowserBookmarks, type SettingsSection } from '../../app/actions';
import { BRAND } from '../../brand';
import { importBackup } from '../../core/backup';
import { emptyState, newId } from '../../core/defaults';
import {
    addMode, moveSpace, parseAliases, removeMode, removeProvider, removeSpace, setPrefs, updateMode, upsertProvider,
} from '../../core/ops';
import { organize, parseUrlList, type Proposal } from '../../core/setup';
import { THEMES, type Theme } from '../../core/themes';
import type { AppState, Language, MotionLevel, Prefs } from '../../core/types';
import { normalizeUrl } from '../../core/url';
import { t, type MessageKey } from '../../i18n';
import { app, setUi, toast, update } from '../../storage/store';
import { Icon, SPACE_GLYPHS } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';
import { ImportReview } from './ImportReview';

const SECTION_GLYPHS: Record<SettingsSection, string> = {
    appearance: 'swatch', spaces: 'grid', modes: 'layers', search: 'search', data: 'download', privacy: 'shield', keyboard: 'keyboard', about: 'info',
};

// ---------- Small building blocks ----------

function Row({ label, hint, children }: { label: string; hint?: string; children: ComponentChildren }) {
    return (
        <div class="row">
            <div class="row-text">
                <span class="row-label">{label}</span>
                {hint && <span class="row-hint">{hint}</span>}
            </div>
            <div class="row-control">{children}</div>
        </div>
    );
}

type BooleanPref = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

function Toggle({ state, pref, label, hint }: { state: AppState; pref: BooleanPref; label: string; hint?: string }) {
    return (
        <Row label={label} hint={hint}>
            <button type="button" class="switch" role="switch" aria-checked={state.prefs[pref]} aria-label={label}
                onClick={() => update(s => setPrefs(s, { [pref]: !s.prefs[pref] }))} />
        </Row>
    );
}

export function ThemePicker({ themeId, onPick }: { themeId: string; onPick: (id: string) => void }) {
    return (
        <div class="theme-grid">
            {THEMES.map((theme: Theme) => (
                <button type="button" key={theme.id} class="theme-card" aria-pressed={theme.id === themeId} onClick={() => onPick(theme.id)}>
                    <span class="theme-preview" style={theme.tokens} data-scheme={theme.scheme}>
                        <span class="theme-preview-bar" />
                        <span class="theme-preview-plates"><i /><i /><i /></span>
                    </span>
                    <span class="theme-name">{theme.name}</span>
                </button>
            ))}
        </div>
    );
}

// ---------- Sections ----------

function Appearance({ state }: { state: AppState }) {
    return (
        <>
            <h3>{t('settings.theme')}</h3>
            <ThemePicker themeId={state.prefs.themeId} onPick={id => update(s => setPrefs(s, { themeId: id }))} />
            <h3>{t('settings.behaviour')}</h3>
            <Row label={t('settings.motion')} hint={t('settings.motionHint')}>
                <select value={state.prefs.motion} onChange={event => update(s => setPrefs(s, { motion: event.currentTarget.value as MotionLevel }))}>
                    <option value="full">{t('motion.full')}</option>
                    <option value="reduced">{t('motion.reduced')}</option>
                    <option value="off">{t('motion.off')}</option>
                </select>
            </Row>
            <Row label={t('settings.language')}>
                <select value={state.prefs.language} onChange={event => update(s => setPrefs(s, { language: event.currentTarget.value as Language }))}>
                    <option value="en">English</option>
                    <option value="tr">Türkçe</option>
                </select>
            </Row>
            <Toggle state={state} pref="openInNewTab" label={t('settings.newTab')} hint={t('settings.newTabHint')} />
            <Toggle state={state} pref="showDock" label={t('settings.dock')} hint={t('settings.dockHint')} />
        </>
    );
}

function Spaces({ state }: { state: AppState }) {
    return (
        <>
            <h3>{t('spaces.title')}</h3>
            {state.spaceOrder.length === 0 && <p class="note">{t('empty.firstSpaceHint')}</p>}
            <ul class="list">
                {state.spaceOrder.map((id, index) => {
                    const space = state.spaces[id]!;
                    return (
                        <li key={id} class="list-row" style={{ '--tint': space.accent }}>
                            <span class="check-glyph"><Icon name={space.glyph} size={16} /></span>
                            <span class="list-name">{space.name}</span>
                            <button type="button" class="icon-button is-small" aria-label={t('moveUp')} title={t('moveUp')} disabled={index === 0}
                                onClick={() => update(s => moveSpace(s, id, -1))}><Icon name="up" size={15} /></button>
                            <button type="button" class="icon-button is-small" aria-label={t('moveDown')} title={t('moveDown')}
                                disabled={index === state.spaceOrder.length - 1}
                                onClick={() => update(s => moveSpace(s, id, 1))}><Icon name="down" size={15} /></button>
                            <button type="button" class="icon-button is-small" aria-label={t('edit')} title={t('edit')}
                                onClick={() => setUi({ editor: { kind: 'space', spaceId: id } })}><Icon name="pen" size={15} /></button>
                            <button type="button" class="icon-button is-small" aria-label={t('delete')} title={t('delete')}
                                onClick={() => {
                                    const before = app.get();
                                    update(s => removeSpace(s, id));
                                    toast(t('space.deleted', { name: space.name }), before);
                                }}><Icon name="trash" size={15} /></button>
                        </li>
                    );
                })}
            </ul>
            <button type="button" class="button" onClick={() => setUi({ editor: { kind: 'space' } })}>{t('space.new')}</button>
        </>
    );
}

function Modes({ state }: { state: AppState }) {
    return (
        <>
            <h3>{t('settings.modes')}</h3>
            <p class="note">{t('modes.intro')}</p>
            {state.modeOrder.map(id => {
                const mode = state.modes[id]!;
                return (
                    <div class="card" key={id}>
                        <div class="card-head">
                            <select class="glyph-select" value={mode.glyph} aria-label={t('field.icon')}
                                onChange={event => update(s => updateMode(s, id, { glyph: event.currentTarget.value }))}>
                                {SPACE_GLYPHS.map(glyph => <option key={glyph} value={glyph}>{glyph}</option>)}
                            </select>
                            <input type="text" value={mode.name} aria-label={t('field.name')}
                                onChange={event => update(s => updateMode(s, id, { name: event.currentTarget.value.trim() || mode.name }))} />
                            <button type="button" class="icon-button is-small" aria-label={t('delete')} title={t('delete')}
                                onClick={() => {
                                    const before = app.get();
                                    update(s => removeMode(s, id));
                                    toast(t('modes.deleted', { name: mode.name }), before);
                                }}><Icon name="trash" size={15} /></button>
                        </div>
                        <div class="chip-checks">
                            {state.spaceOrder.map(spaceId => {
                                const on = mode.spaceIds.includes(spaceId);
                                return (
                                    <button type="button" key={spaceId} aria-pressed={on}
                                        onClick={() => update(s => updateMode(s, id, {
                                            spaceIds: on ? mode.spaceIds.filter(x => x !== spaceId) : [...mode.spaceIds, spaceId],
                                        }))}>
                                        {state.spaces[spaceId]!.name}
                                    </button>
                                );
                            })}
                        </div>
                        <Row label={t('settings.theme')}>
                            <select value={mode.themeId ?? ''} onChange={event => update(s => updateMode(s, id, { themeId: event.currentTarget.value }))}>
                                <option value="">{t('modes.keep')}</option>
                                {THEMES.map(theme => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                            </select>
                        </Row>
                        <Row label={t('search.default')}>
                            <select value={mode.providerId ?? ''} onChange={event => update(s => updateMode(s, id, { providerId: event.currentTarget.value }))}>
                                <option value="">{t('modes.keep')}</option>
                                {state.providers.map(p => <option key={p.id} value={p.id}>{providerName(p.id, p.name)}</option>)}
                            </select>
                        </Row>
                    </div>
                );
            })}
            <button type="button" class="button"
                onClick={() => update(s => addMode(s, { name: t('modes.newName'), glyph: 'layers', spaceIds: [...s.spaceOrder] }).state)}>
                {t('modes.add')}
            </button>
        </>
    );
}

function providerName(id: string, name: string): string {
    return id === 'default' ? t('search.browserDefault') : name;
}

function Search({ state }: { state: AppState }) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [alias, setAlias] = useState('');
    const [invalid, setInvalid] = useState(false);

    const add = (event: Event) => {
        event.preventDefault();
        if (!name.trim() || !url.includes('%s') || !normalizeUrl(url.replace('%s', 'q'))) return setInvalid(true);
        update(s => upsertProvider(s, { id: newId(), name: name.trim(), url: url.trim(), aliases: parseAliases(alias) }));
        setName('');
        setUrl('');
        setAlias('');
        setInvalid(false);
    };

    return (
        <>
            <h3>{t('settings.search')}</h3>
            <Row label={t('search.default')} hint={t('search.defaultHint')}>
                <select value={state.prefs.defaultProviderId} onChange={event => update(s => setPrefs(s, { defaultProviderId: event.currentTarget.value }))}>
                    {state.providers.map(p => <option key={p.id} value={p.id}>{providerName(p.id, p.name)}</option>)}
                </select>
            </Row>
            <h3>{t('search.shortcuts')}</h3>
            <p class="note">{t('search.shortcutsHint')}</p>
            <ul class="list">
                {state.providers.filter(p => p.id !== 'default').map(provider => (
                    <li class="list-row" key={provider.id}>
                        <span class="list-name">{provider.name}</span>
                        <input type="text" class="alias-input" value={provider.aliases.join(', ')} aria-label={t('search.aliasFor', { name: provider.name })}
                            spellcheck={false}
                            onChange={event => update(s => upsertProvider(s, { ...provider, aliases: parseAliases(event.currentTarget.value) }))} />
                        {!provider.builtin && (
                            <button type="button" class="icon-button is-small" aria-label={t('delete')} title={t('delete')}
                                onClick={() => update(s => removeProvider(s, provider.id))}><Icon name="trash" size={15} /></button>
                        )}
                    </li>
                ))}
            </ul>
            <h3>{t('search.addTitle')}</h3>
            <form class="inline-form" onSubmit={add}>
                <input type="text" value={name} placeholder={t('field.name')} aria-label={t('field.name')} onInput={e => setName(e.currentTarget.value)} />
                <input type="text" value={url} placeholder="https://example.com/search?q=%s" aria-label={t('field.url')} aria-invalid={invalid}
                    spellcheck={false} onInput={e => setUrl(e.currentTarget.value)} />
                <input type="text" class="alias-input" value={alias} placeholder={t('search.alias')} aria-label={t('search.alias')}
                    spellcheck={false} onInput={e => setAlias(e.currentTarget.value)} />
                <button type="submit" class="button">{t('add')}</button>
            </form>
            {invalid && <p class="field-error" role="alert">{t('search.invalid')}</p>}
        </>
    );
}

function Data() {
    const fileRef = useRef<HTMLInputElement>(null);
    const [proposals, setProposals] = useState<Proposal[] | null>(null);
    const [pasted, setPasted] = useState('');

    const restore = async (file: File | undefined) => {
        if (!file) return;
        const imported = importBackup(await file.text());
        if (!imported) return toast(t('data.restoreFailed'));
        const before = app.get();
        update(() => imported);
        toast(t('data.restored'), before);
    };

    const fromBookmarks = async () => {
        const result = await readBrowserBookmarks();
        if (!result.ok) return toast(t(result.reason === 'denied' ? 'import.denied' : 'import.unavailable'));
        setProposals(organize(result.links));
    };

    if (proposals) {
        return (
            <>
                <h3>{t('import.review')}</h3>
                <ImportReview proposals={proposals} onDone={() => setProposals(null)} />
                <button type="button" class="text-button" onClick={() => setProposals(null)}>{t('cancel')}</button>
            </>
        );
    }

    return (
        <>
            <h3>{t('data.backup')}</h3>
            <Row label={t('data.export')} hint={t('data.exportHint')}>
                <button type="button" class="button" onClick={downloadBackup}><Icon name="download" size={15} />{t('data.exportAction')}</button>
            </Row>
            <Row label={t('data.restore')} hint={t('data.restoreHint')}>
                <button type="button" class="button" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} />{t('data.restoreAction')}</button>
                <input ref={fileRef} type="file" accept=".json,application/json" hidden
                    onChange={event => {
                        void restore(event.currentTarget.files?.[0]);
                        event.currentTarget.value = '';
                    }} />
            </Row>
            <h3>{t('import.title')}</h3>
            <Row label={t('import.bookmarks')} hint={t('import.bookmarksHint')}>
                <button type="button" class="button" onClick={() => void fromBookmarks()}>{t('import.action')}</button>
            </Row>
            <div class="stack">
                <label class="field">
                    <span>{t('import.paste')} <em>{t('import.pasteHint')}</em></span>
                    <textarea rows={4} value={pasted} spellcheck={false} placeholder={'github.com\nDocs | https://devdocs.io'}
                        onInput={event => setPasted(event.currentTarget.value)} />
                </label>
                <button type="button" class="button" disabled={!pasted.trim()}
                    onClick={() => {
                        setProposals(organize(parseUrlList(pasted)));
                        setPasted('');
                    }}>
                    {t('import.sort')}
                </button>
            </div>
        </>
    );
}

function Privacy({ state }: { state: AppState }) {
    const [armed, setArmed] = useState(false);
    return (
        <>
            <h3>{t('settings.privacy')}</h3>
            <p class="note">{t('privacy.statement')}</p>
            <Row label={t('privacy.icons')} hint={t('privacy.iconsHint')}>
                <button type="button" class="switch" role="switch" aria-checked={state.prefs.iconSource === 'remote'} aria-label={t('privacy.icons')}
                    onClick={() => update(s => setPrefs(s, { iconSource: s.prefs.iconSource === 'remote' ? 'none' : 'remote' }))} />
            </Row>
            <Toggle state={state} pref="showContinue" label={t('privacy.continue')} hint={t('privacy.continueHint')} />
            <Toggle state={state} pref="showClosedTabs" label={t('privacy.closedTabs')} hint={t('privacy.closedTabsHint')} />
            <Row label={t('privacy.clearRecents')} hint={t('privacy.clearRecentsHint', { n: state.recents.length })}>
                <button type="button" class="button" disabled={!state.recents.length} onClick={() => update(s => ({ ...s, recents: [] }))}>{t('clear')}</button>
            </Row>
            <h3>{t('privacy.reset')}</h3>
            <Row label={t('privacy.resetLabel')} hint={t('privacy.resetHint')}>
                {armed ? (
                    <button type="button" class="button is-danger"
                        onClick={() => {
                            const before = app.get();
                            update(() => emptyState());
                            setUi({ settings: null, spaceId: null });
                            toast(t('privacy.resetDone'), before);
                        }}>
                        {t('privacy.resetConfirm')}
                    </button>
                ) : (
                    <button type="button" class="button" onClick={() => setArmed(true)}>{t('privacy.resetAction')}</button>
                )}
            </Row>
        </>
    );
}

const SHORTCUTS: [keys: string[], label: MessageKey][] = [
    [['Ctrl', 'K'], 'keys.palette'],
    [['/'], 'keys.search'],
    [['1', '–', '9'], 'keys.space'],
    [['↑', '↓', '↵'], 'keys.results'],
    [['Esc'], 'keys.close'],
];

function Keyboard() {
    return (
        <>
            <h3>{t('settings.keyboard')}</h3>
            <ul class="list">
                {SHORTCUTS.map(([keys, label]) => (
                    <li class="list-row" key={label}>
                        <span class="list-name">{t(label)}</span>
                        <span class="keys">{keys.map(key => (key === '–' ? ' – ' : <kbd>{key}</kbd>))}</span>
                    </li>
                ))}
            </ul>
            <p class="note">{t('keys.prefixHint')}</p>
        </>
    );
}

function About({ state }: { state: AppState }) {
    return (
        <>
            <h3>{t('settings.about')}</h3>
            <p class="about-name">{BRAND.extensionName} <span>{BRAND.version}</span></p>
            <p class="note">{t('about.body')}</p>
            {state.legacy?.isPro && <p class="note">{t('about.legacyPro')}</p>}
        </>
    );
}

// ---------- Shell ----------

export function Settings({ state, section }: { state: AppState; section: string }) {
    const current = (SETTINGS_SECTIONS as readonly string[]).includes(section) ? (section as SettingsSection) : 'appearance';
    const close = () => setUi({ settings: null });
    return (
        <Overlay label={t('settings.title')} class="overlay-settings" onClose={close}>
            <nav class="settings-nav" aria-label={t('settings.title')}>
                <h2>{t('settings.title')}</h2>
                {SETTINGS_SECTIONS.map(id => (
                    <button type="button" key={id} aria-current={id === current ? 'page' : undefined} onClick={() => setUi({ settings: id })}>
                        <Icon name={SECTION_GLYPHS[id]} size={16} />
                        <span>{t(`settings.${id}` as MessageKey)}</span>
                    </button>
                ))}
            </nav>
            <div class="settings-body">
                <button type="button" class="icon-button settings-close" title={t('close')} aria-label={t('close')} onClick={close}>
                    <Icon name="x" />
                </button>
                {current === 'appearance' && <Appearance state={state} />}
                {current === 'spaces' && <Spaces state={state} />}
                {current === 'modes' && <Modes state={state} />}
                {current === 'search' && <Search state={state} />}
                {current === 'data' && <Data />}
                {current === 'privacy' && <Privacy state={state} />}
                {current === 'keyboard' && <Keyboard />}
                {current === 'about' && <About state={state} />}
            </div>
        </Overlay>
    );
}

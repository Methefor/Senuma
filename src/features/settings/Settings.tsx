import { BrandLockup } from '../../ui/BrandMark';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import {
    SETTINGS_SECTIONS, deleteSnapshot, downloadBackup, ensureSnapshots, providerLabel, removeSpaceWithUndo, replaceSetup, type SettingsSection,
} from '../../app/actions';
import { BRAND } from '../../brand';
import { readBookmarks } from '../../browser/bookmarks';
import { releaseClosedTabsAccess, requestClosedTabsAccess } from '../../browser/sessions';
import { importBackup, mergeBackup } from '../../core/backupImport';
import { emptyState, newId } from '../../core/defaults';
import {
    addMode, captureMode, isValidTemplate, parseAliases, removeMode, removeProvider, restoreMode, setActiveMode, setModeDock, setPrefs, shiftSpace,
    updateMode, updateModeDock, upsertProvider,
} from '../../core/ops';
import { organize, parseUrlList, type Proposal } from '../../core/setup';
import { presetById, type Background } from '../../core/background';
import { themeById } from '../../core/themes';
import type { AppState, IconSource, Language, Mode, Prefs } from '../../core/types';
import { t, type MessageKey } from '../../i18n';
import { MODIFIER_KEY } from '../command/Launcher';
import { app, openMenuBelow, setUi, snapshots, toast, update, useStore } from '../../storage/store';
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

function Switch({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
    return <button type="button" class="switch" role="switch" aria-checked={on} aria-label={label} onClick={onToggle} />;
}

type BooleanPref = { [K in keyof Prefs]: Prefs[K] extends boolean ? K : never }[keyof Prefs];

function Toggle({ state, pref, label, hint }: { state: AppState; pref: BooleanPref; label: string; hint?: string }) {
    return (
        <Row label={label} hint={hint}>
            <Switch on={state.prefs[pref]} label={label} onToggle={() => update(s => setPrefs(s, { [pref]: !s.prefs[pref] }))} />
        </Row>
    );
}

// ---------- Sections ----------

function Appearance({ state }: { state: AppState }) {
    return (
        <>
            <h3>{t('settings.look')}</h3>
            <Row label={t('customize.title')} hint={t('settings.lookHint')}>
                <button type="button" class="button is-primary" onClick={() => setUi({ settings: null, customize: true })}>
                    <Icon name="swatch" size={15} />{t('settings.openCustomize')}
                </button>
            </Row>
            <h3>{t('settings.behaviour')}</h3>
            <Row label={t('settings.language')}>
                <select value={state.prefs.language} onChange={event => update(s => setPrefs(s, { language: event.currentTarget.value as Language }))}>
                    <option value="en">English</option>
                    <option value="tr">Türkçe</option>
                </select>
            </Row>
            <Toggle state={state} pref="openInNewTab" label={t('settings.newTab')} hint={t('settings.newTabHint')} />
            <Toggle state={state} pref="showDock" label={t('settings.dock')} hint={t('settings.dockHint')} />
            <Toggle state={state} pref="dockLabels" label={t('settings.dockLabels')} />
        </>
    );
}

function Spaces({ state }: { state: AppState }) {
    return (
        <>
            <h3>{t('spaces.title')}</h3>
            <p class="note">{t('spaces.orderHint')}</p>
            <ul class="list">
                {state.spaceOrder.map((id, index) => {
                    const space = state.spaces[id]!;
                    return (
                        <li key={id} class="list-row" style={{ '--tint': space.accent }}>
                            <span class="check-glyph"><Icon name={space.glyph} size={16} /></span>
                            <span class="list-name">{space.name}</span>
                            <button type="button" class="icon-button is-small" aria-label={t('moveUp')} title={t('moveUp')} disabled={index === 0}
                                onClick={() => update(s => shiftSpace(s, id, -1, 'all'))}><Icon name="up" size={15} /></button>
                            <button type="button" class="icon-button is-small" aria-label={t('moveDown')} title={t('moveDown')}
                                disabled={index === state.spaceOrder.length - 1}
                                onClick={() => update(s => shiftSpace(s, id, 1, 'all'))}><Icon name="down" size={15} /></button>
                            <button type="button" class="icon-button is-small" aria-label={t('edit')} title={t('edit')}
                                onClick={() => setUi({ editor: { kind: 'space', spaceId: id } })}><Icon name="pen" size={15} /></button>
                            <button type="button" class="icon-button is-small" aria-label={t('delete')} title={t('delete')}
                                onClick={() => removeSpaceWithUndo(id)}><Icon name="trash" size={15} /></button>
                        </li>
                    );
                })}
            </ul>
            <button type="button" class="button" onClick={() => setUi({ editor: { kind: 'space' } })}>{t('space.new')}</button>
        </>
    );
}

function backgroundName(state: AppState, background: Background | undefined): string {
    const source = background?.source;
    if (!source || source.kind === 'theme') return t('background.theme');
    if (source.kind === 'preset') return presetById(source.id)?.name ?? t('background.theme');
    if (source.kind === 'upload') return state.wallpapers[source.assetId]?.name ?? t('background.theme');
    return t(source.kind === 'solid' ? 'background.solid' : 'background.gradient');
}

/**
 * One Mode, described the way the user thinks about it: "when I switch to this, what
 * changes?" — the look, the Spaces, the dock and the search engine.
 */
function ModeCard({ state, mode, open, onToggle }: { state: AppState; mode: Mode; open: boolean; onToggle: () => void }) {
    const id = mode.id;
    const ownLook = !!mode.themeId || !!mode.background;
    const provider = mode.providerId ? state.providers.find(p => p.id === mode.providerId) : undefined;
    const summary = [
        t('spaces.count', { n: mode.spaceIds.length }),
        ownLook ? `${themeById(mode.themeId ?? state.prefs.themeId).name}${mode.background ? ` · ${backgroundName(state, mode.background)}` : ''}` : t('modes.sum.look'),
        mode.dock ? t('modes.sum.ownDock') : t('modes.sum.sharedDock'),
        provider ? providerLabel(provider) : t('modes.sum.search'),
    ].join(' · ');

    /** Switches to the Mode and opens Customize on it: the look is edited where it is seen. */
    const editLook = () => {
        update(s => setActiveMode(s, id));
        setUi({ settings: null, customize: true });
    };
    const dockEntries = (mode.dock ?? []).flatMap(entry => {
        const name = entry.kind === 'space' ? state.spaces[entry.id]?.name : state.items[entry.id]?.title;
        return name ? [{ entry, name }] : [];
    });

    return (
        <div class={`card mode-card ${open ? 'is-open' : ''}`}>
            <button type="button" class="mode-summary" aria-expanded={open} onClick={onToggle}>
                <span class="mode-glyph"><Icon name={mode.glyph} size={17} /></span>
                <span class="mode-summary-text">
                    <strong>{mode.name}{state.activeModeId === id && <em>{t('modes.active')}</em>}</strong>
                    <span>{summary}</span>
                </span>
                <Icon name={open ? 'up' : 'down'} size={15} />
            </button>
            {open && (
                <div class="mode-body">
                    <div class="card-head">
                        <button type="button" class="icon-button glyph-button" aria-label={t('field.icon')} title={t('field.icon')} aria-haspopup="menu"
                            onClick={event => openMenuBelow(event.currentTarget, SPACE_GLYPHS.map(glyph => ({
                                label: glyph, glyph, checked: glyph === mode.glyph, run: () => update(s => updateMode(s, id, { glyph })),
                            })))}>
                            <Icon name={mode.glyph} size={17} />
                        </button>
                        <input type="text" value={mode.name} aria-label={t('field.name')}
                            onChange={event => update(s => updateMode(s, id, { name: event.currentTarget.value }))} />
                    </div>

                    <h4>{t('modes.look')}</h4>
                    <Row label={ownLook ? t('modes.lookOwn', { theme: themeById(mode.themeId ?? state.prefs.themeId).name, background: backgroundName(state, mode.background) }) : t('modes.lookDefault')}
                        hint={t('modes.lookHint')}>
                        {ownLook && (
                            <button type="button" class="button" onClick={() => update(s => updateMode(s, id, { themeId: '', background: null }))}>{t('customize.useDefault')}</button>
                        )}
                        <button type="button" class="button" onClick={editLook}><Icon name="swatch" size={15} />{t('modes.changeLook')}</button>
                    </Row>

                    <h4>{t('modes.spaces')}</h4>
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

                    <h4>{t('dock.title')}</h4>
                    <Row label={t('modes.ownDock')} hint={t('modes.ownDockHint')}>
                        <Switch on={!!mode.dock} label={t('modes.ownDock')} onToggle={() => update(s => setModeDock(s, id, !mode.dock))} />
                    </Row>
                    {mode.dock && (
                        <div class="chip-checks">
                            {dockEntries.map(({ entry, name }) => (
                                <button type="button" key={`${entry.kind}:${entry.id}`} class="is-removable" title={t('dock.remove')}
                                    onClick={() => update(s => updateModeDock(s, id, mode.dock!.filter(e => !(e.kind === entry.kind && e.id === entry.id))))}>
                                    {name}<Icon name="x" size={11} />
                                </button>
                            ))}
                            {dockEntries.length === 0 && <span class="note">{t('modes.dockEmpty')}</span>}
                        </div>
                    )}

                    <h4>{t('settings.search')}</h4>
                    <Row label={t('search.default')}>
                        <select value={mode.providerId ?? ''} onChange={event => update(s => updateMode(s, id, { providerId: event.currentTarget.value }))}>
                            <option value="">{t('modes.keep')}</option>
                            {state.providers.map(p => <option key={p.id} value={p.id}>{providerLabel(p)}</option>)}
                        </select>
                    </Row>

                    <div class="mode-foot">
                        <button type="button" class="button"
                            onClick={() => {
                                const removed = captureMode(app.get(), id);
                                if (!removed) return;
                                update(s => removeMode(s, id));
                                toast(t('modes.deleted', { name: mode.name }), s => restoreMode(s, removed));
                            }}>
                            <Icon name="trash" size={15} />{t('modes.delete')}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function Modes({ state }: { state: AppState }) {
    const [openId, setOpenId] = useState<string | null>(state.activeModeId ?? state.modeOrder[0] ?? null);
    return (
        <>
            <h3>{t('settings.modes')}</h3>
            <p class="note">{t('modes.intro')}</p>
            {state.modeOrder.map(id => (
                <ModeCard key={id} state={state} mode={state.modes[id]!} open={openId === id} onToggle={() => setOpenId(openId === id ? null : id)} />
            ))}
            <button type="button" class="button"
                onClick={() => {
                    let created: string | null = null;
                    update(s => {
                        const result = addMode(s, { name: t('modes.newName'), glyph: 'layers', spaceIds: [...s.spaceOrder] });
                        created = result.id;
                        return result.state;
                    });
                    setOpenId(created);
                }}>
                {t('modes.add')}
            </button>
        </>
    );
}

function Search({ state }: { state: AppState }) {
    const [name, setName] = useState('');
    const [template, setTemplate] = useState('');
    const [alias, setAlias] = useState('');
    const [invalid, setInvalid] = useState(false);

    const add = (event: Event) => {
        event.preventDefault();
        if (!name.trim() || !isValidTemplate(template)) return setInvalid(true);
        update(s => upsertProvider(s, { id: newId(), name: name.trim(), urlTemplate: template.trim(), aliases: parseAliases(alias) }));
        setName('');
        setTemplate('');
        setAlias('');
        setInvalid(false);
    };

    return (
        <>
            <h3>{t('settings.search')}</h3>
            <Row label={t('search.default')} hint={t('search.defaultHint')}>
                <select value={state.prefs.defaultProviderId} onChange={event => update(s => setPrefs(s, { defaultProviderId: event.currentTarget.value }))}>
                    {state.providers.map(p => <option key={p.id} value={p.id}>{providerLabel(p)}</option>)}
                </select>
            </Row>
            <h3>{t('search.shortcuts')}</h3>
            <p class="note">{t('search.shortcutsHint')}</p>
            <ul class="list">
                {state.providers.filter(p => !p.browserDefault).map(provider => (
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
                <input type="text" value={template} placeholder="https://example.com/search?q=%s" aria-label={t('field.url')} aria-invalid={invalid}
                    spellcheck={false} onInput={e => setTemplate(e.currentTarget.value)} />
                <input type="text" class="alias-input" value={alias} placeholder={t('search.alias')} aria-label={t('search.alias')}
                    spellcheck={false} onInput={e => setAlias(e.currentTarget.value)} />
                <button type="submit" class="button">{t('add')}</button>
            </form>
            {invalid && <p class="field-error" role="alert">{t('search.invalid')}</p>}
        </>
    );
}

function Backups() {
    const list = useStore(snapshots);
    useEffect(() => {
        void ensureSnapshots();
    }, []);
    if (!list?.length) return <p class="note">{t('data.noSnapshots')}</p>;
    const locale = app.get().prefs.language;
    return (
        <ul class="list">
            {list.map(snapshot => (
                <li class="list-row" key={snapshot.id}>
                    <span class="list-name">
                        {new Date(snapshot.at).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}
                        <span class="list-sub">
                            {t(`data.reason.${snapshot.reason}` as MessageKey)} · {t('spaces.count', { n: snapshot.state.spaceOrder.length })}
                        </span>
                    </span>
                    <button type="button" class="button"
                        onClick={async () => (await replaceSetup({ ...snapshot.state, onboarded: true }, 'restore')) && toast(t('data.restored'))}>
                        {t('data.restoreAction')}
                    </button>
                    <button type="button" class="icon-button is-small" aria-label={t('delete')} title={t('delete')}
                        onClick={() => void deleteSnapshot(snapshot.id)}><Icon name="trash" size={15} /></button>
                </li>
            ))}
        </ul>
    );
}

function Data({ state }: { state: AppState }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [proposals, setProposals] = useState<Proposal[] | null>(null);
    const [incoming, setIncoming] = useState<AppState | null>(null);
    const [pasted, setPasted] = useState('');

    const read = async (file: File | undefined) => {
        if (!file) return;
        const imported = importBackup(await file.text());
        if (!imported) return toast(t('data.fileUnreadable'));
        // An empty setup has nothing to protect, so there is nothing to choose.
        if (state.spaceOrder.length === 0) {
            if (await replaceSetup(imported, 'import')) toast(t('data.restored'));
            return;
        }
        setIncoming(imported);
    };

    const fromBookmarks = async () => {
        const result = await readBookmarks();
        if (!result.ok) return toast(t(`import.${result.reason}` as MessageKey));
        setProposals(organize(result.value));
    };

    if (incoming) {
        const links = Object.keys(incoming.items).length;
        return (
            <>
                <h3>{t('data.importTitle')}</h3>
                <p class="note">{t('data.importFound', { spaces: incoming.spaceOrder.length, links })}</p>
                <div class="choice-row">
                    <button type="button" class="choice"
                        onClick={async () => {
                            // A restore point first, so a merge can be undone like a replace.
                            const merged = mergeBackup(app.get(), incoming);
                            if (await replaceSetup(merged.state, 'import')) toast(t('data.merged', { spaces: merged.spaces, links: merged.links }));
                            setIncoming(null);
                        }}>
                        <Icon name="plus" size={18} />
                        <strong>{t('data.merge')}</strong>
                        <span>{t('data.mergeHint')}</span>
                    </button>
                    <button type="button" class="choice"
                        onClick={async () => {
                            if (await replaceSetup(incoming, 'import')) toast(t('data.replaced'));
                            setIncoming(null);
                        }}>
                        <Icon name="copy" size={18} />
                        <strong>{t('data.replace')}</strong>
                        <span>{t('data.replaceHint')}</span>
                    </button>
                </div>
                <button type="button" class="text-button" onClick={() => setIncoming(null)}>{t('cancel')}</button>
            </>
        );
    }

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
            <Row label={t('data.import')} hint={t('data.importHint')}>
                <button type="button" class="button" onClick={() => fileRef.current?.click()}><Icon name="upload" size={15} />{t('data.chooseFile')}</button>
                <input ref={fileRef} type="file" accept=".json,application/json" hidden
                    onChange={event => {
                        void read(event.currentTarget.files?.[0]);
                        event.currentTarget.value = '';
                    }} />
            </Row>
            <h3>{t('data.snapshots')}</h3>
            <p class="note">{t('data.snapshotsHint')}</p>
            <Backups />
            <h3>{t('import.title')}</h3>
            <Row label={t('import.bookmarks')} hint={t('import.bookmarksHint')}>
                <button type="button" class="button" onClick={() => void fromBookmarks()}>{t('import.action')}</button>
            </Row>
            <div class="stack">
                <label class="field">
                    <span>{t('import.paste')} <em>{t('import.pasteHint')}</em></span>
                    <textarea rows={3} value={pasted} spellcheck={false} placeholder={'github.com\nDocs | https://devdocs.io'}
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

    const toggleClosedTabs = async () => {
        if (state.prefs.showClosedTabs) {
            update(s => setPrefs(s, { showClosedTabs: false }));
            return void releaseClosedTabsAccess();
        }
        const result = await requestClosedTabsAccess();
        if (result.ok) update(s => setPrefs(s, { showClosedTabs: true }));
        else toast(t(`closedTabs.${result.reason}` as MessageKey));
    };

    return (
        <>
            <h3>{t('settings.privacy')}</h3>
            <ul class="fact-list">
                {(['local', 'none', 'search', 'images', 'optional'] as const).map(fact => <li key={fact}>{t(`privacy.fact.${fact}`)}</li>)}
            </ul>
            <Row label={t('privacy.icons')} hint={t(`privacy.icons.${state.prefs.iconSource}` as MessageKey)}>
                <select value={state.prefs.iconSource} aria-label={t('privacy.icons')}
                    onChange={event => update(s => setPrefs(s, { iconSource: event.currentTarget.value as IconSource }))}>
                    <option value="site">{t('icons.site')}</option>
                    <option value="service">{t('icons.service')}</option>
                    <option value="none">{t('icons.none')}</option>
                </select>
            </Row>
            <Toggle state={state} pref="showContinue" label={t('privacy.continue')} hint={t('privacy.continueHint')} />
            <Row label={t('privacy.closedTabs')} hint={t('privacy.closedTabsHint')}>
                <Switch on={state.prefs.showClosedTabs} label={t('privacy.closedTabs')} onToggle={() => void toggleClosedTabs()} />
            </Row>
            <Row label={t('privacy.clearRecents')} hint={t('privacy.clearRecentsHint', { n: state.recents.length })}>
                <button type="button" class="button" disabled={!state.recents.length && !Object.keys(state.usage).length}
                    onClick={() => update(s => ({ ...s, recents: [], usage: {} }))}>{t('clear')}</button>
            </Row>
            <h3>{t('privacy.reset')}</h3>
            <Row label={t('privacy.resetLabel')} hint={t('privacy.resetHint')}>
                {armed ? (
                    <button type="button" class="button is-danger"
                        onClick={async () => {
                            if (!(await replaceSetup(emptyState(), 'reset'))) return;
                            setUi({ settings: null, spaceId: null });
                            toast(t('privacy.resetDone'));
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
    [[MODIFIER_KEY, 'K'], 'keys.palette'],
    [['/'], 'keys.search'],
    [['1', '–', '9'], 'keys.space'],
    [['M'], 'keys.mode'],
    [['Alt', '←', '→'], 'keys.reorder'],
    [['←', '↑', '↓', '→'], 'keys.tiles'],
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
            <div class="about-name"><BrandLockup size={30} /><span>{BRAND.displayVersion}</span></div>
            <p class="about-descriptor">{BRAND.descriptor} · {t('brand.tagline')}</p>
            <p class="note">{t('about.body')}</p>
            {state.legacy && (
                <p class="note">
                    {t('about.migrated', { date: new Date(state.legacy.migratedAt).toLocaleDateString(state.prefs.language) })}
                </p>
            )}
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
            <div class="settings-body" key={current}>
                <button type="button" class="icon-button settings-close" title={t('close')} aria-label={t('close')} onClick={close}>
                    <Icon name="x" />
                </button>
                {current === 'appearance' && <Appearance state={state} />}
                {current === 'spaces' && <Spaces state={state} />}
                {current === 'modes' && <Modes state={state} />}
                {current === 'search' && <Search state={state} />}
                {current === 'data' && <Data state={state} />}
                {current === 'privacy' && <Privacy state={state} />}
                {current === 'keyboard' && <Keyboard />}
                {current === 'about' && <About state={state} />}
            </div>
        </Overlay>
    );
}

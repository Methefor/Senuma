import { useState } from 'preact/hooks';
import { prepareIcon } from '../../app/icons';
import { ACCENTS } from '../../core/defaults';
import { LIMITS } from '../../core/limits';
import { addItem, addSpace, locateItem, moveItem, updateItem, updateSpace } from '../../core/ops';
import type { AppState, ID } from '../../core/types';
import { normalizeUrl } from '../../core/url';
import { t } from '../../i18n';
import { app, setUi, toast, update, type EditorTarget } from '../../storage/store';
import { Icon, SPACE_GLYPHS } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';

const close = () => setUi({ editor: null });

function ItemEditor({ state, target }: { state: AppState; target: Extract<EditorTarget, { kind: 'item' }> }) {
    const item = target.itemId ? state.items[target.itemId] : undefined;
    const [title, setTitle] = useState(item?.title ?? '');
    const [url, setUrl] = useState(item?.url ?? '');
    const [icon, setIcon] = useState(item?.icon ?? '');
    const [spaceId, setSpaceId] = useState<ID>(target.spaceId);
    const [invalid, setInvalid] = useState(false);

    const submit = async (event: Event) => {
        event.preventDefault();
        if (!normalizeUrl(url)) return setInvalid(true);
        // A picture pasted as the icon is made small enough to store, here in the page; if it cannot be, the site's icon is used.
        const prepared = await prepareIcon(icon, app.get(), item?.id);
        if (prepared.fellBack) void import('../../app/limitsText').then(async module => {
            await module.loadLimitsText();
            toast(module.lt('iconTooLarge'));
        });
        update(s => {
            if (!item) return addItem(s, spaceId, target.groupId ?? null, { title, url, icon: prepared.icon }).state;
            const edited = updateItem(s, item.id, { title, url, icon: prepared.icon });
            return locateItem(edited, item.id)?.spaceId === spaceId ? edited : moveItem(edited, item.id, spaceId, null);
        });
        close();
    };

    return (
        <Overlay label={item ? t('item.edit') : t('item.add')} class="overlay-form" onClose={close}>
            <form class="form" onSubmit={event => void submit(event)}>
                <h2>{item ? t('item.edit') : t('item.add')}</h2>
                <label class="field">
                    <span>{t('field.url')}</span>
                    <input type="text" value={url} autofocus placeholder="github.com" autocomplete="off" spellcheck={false} aria-invalid={invalid} maxLength={LIMITS.url}
                        onInput={event => {
                            setUrl(event.currentTarget.value);
                            setInvalid(false);
                        }} />
                    {invalid && <span class="field-error" role="alert">{t('item.invalidUrl')}</span>}
                </label>
                <label class="field">
                    <span>{t('field.name')} <em>{t('field.optional')}</em></span>
                    <input type="text" value={title} autocomplete="off" maxLength={LIMITS.title} onInput={event => setTitle(event.currentTarget.value)} />
                </label>
                <label class="field">
                    <span>{t('field.icon')} <em>{t('field.iconHint')}</em></span>
                    <input type="text" value={icon} autocomplete="off" spellcheck={false} onInput={event => setIcon(event.currentTarget.value)} />
                </label>
                {state.spaceOrder.length > 1 && (
                    <label class="field">
                        <span>{t('field.space')}</span>
                        <select value={spaceId} onChange={event => setSpaceId(event.currentTarget.value)}>
                            {state.spaceOrder.map(id => <option key={id} value={id}>{state.spaces[id]!.name}</option>)}
                        </select>
                    </label>
                )}
                <div class="form-actions">
                    <button type="button" class="button" onClick={close}>{t('cancel')}</button>
                    <button type="submit" class="button is-primary">{item ? t('save') : t('item.add')}</button>
                </div>
            </form>
        </Overlay>
    );
}

function SpaceEditor({ state, spaceId }: { state: AppState; spaceId?: ID }) {
    const space = spaceId ? state.spaces[spaceId] : undefined;
    const [name, setName] = useState(space?.name ?? '');
    const [note, setNote] = useState(space?.note ?? '');
    const [glyph, setGlyph] = useState(space?.glyph ?? 'folder');
    const [accent, setAccent] = useState(space?.accent ?? ACCENTS[state.spaceOrder.length % ACCENTS.length]!);

    const submit = (event: Event) => {
        event.preventDefault();
        if (!name.trim()) return;
        if (space) {
            update(s => updateSpace(s, space.id, { name, glyph, accent, note }));
            return close();
        }
        let createdId: ID | null = null;
        update(s => {
            const created = addSpace(s, { name, glyph, accent, note });
            createdId = created.id;
            return created.state;
        });
        // Land inside the new Space so the next step (adding links) is one keystroke away.
        setUi({ editor: null, spaceId: createdId });
    };

    return (
        <Overlay label={space ? t('space.edit') : t('space.new')} class="overlay-form" onClose={close}>
            <form class="form" onSubmit={submit} style={{ '--tint': accent }}>
                <h2>{space ? t('space.edit') : t('space.new')}</h2>
                <label class="field">
                    <span>{t('field.name')}</span>
                    <input type="text" value={name} autofocus required autocomplete="off" maxLength={LIMITS.name} placeholder={t('space.namePlaceholder')}
                        onInput={event => setName(event.currentTarget.value)} />
                </label>
                <label class="field">
                    <span>{t('field.note')} <em>{t('field.optional')}</em></span>
                    <input type="text" value={note} autocomplete="off" maxLength={60} placeholder={t('space.notePlaceholder')}
                        onInput={event => setNote(event.currentTarget.value)} />
                </label>
                <fieldset class="field">
                    <legend>{t('field.icon')}</legend>
                    <div class="glyph-grid">
                        {SPACE_GLYPHS.map(option => (
                            <button type="button" key={option} aria-pressed={glyph === option} aria-label={option} onClick={() => setGlyph(option)}>
                                <Icon name={option} size={18} />
                            </button>
                        ))}
                    </div>
                </fieldset>
                <fieldset class="field">
                    <legend>{t('field.color')}</legend>
                    <div class="swatch-row">
                        {ACCENTS.map(color => (
                            <button type="button" key={color} class="swatch" style={{ '--swatch': color }} aria-pressed={accent === color}
                                aria-label={color} onClick={() => setAccent(color)} />
                        ))}
                    </div>
                </fieldset>
                <div class="form-actions">
                    <button type="button" class="button" onClick={close}>{t('cancel')}</button>
                    <button type="submit" class="button is-primary">{space ? t('save') : t('space.create')}</button>
                </div>
            </form>
        </Overlay>
    );
}

export function Editor({ state, target }: { state: AppState; target: EditorTarget }) {
    return target.kind === 'item'
        ? <ItemEditor state={state} target={target} />
        : <SpaceEditor state={state} spaceId={target.spaceId} />;
}

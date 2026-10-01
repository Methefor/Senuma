import { useState } from 'preact/hooks';
import { launch, remember } from '../../app/actions';
import { addGroup, addItem, itemsOf, moveItem, removeGroup, removeItem, renameGroup, togglePin } from '../../core/ops';
import type { AppState, ID, Item, Space, SpaceGroup } from '../../core/types';
import { t } from '../../i18n';
import { app, openMenu, setUi, toast, update, type MenuItem } from '../../storage/store';
import { AppIcon } from '../../ui/AppIcon';
import { Icon } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';
import { openAll, spaceMenu } from '../home/Home';

const DRAG_TYPE = 'application/x-space-item';

function itemMenu(state: AppState, space: Space, item: Item): MenuItem[] {
    const others = state.spaceOrder.filter(id => id !== space.id).map(id => state.spaces[id]!);
    return [
        { label: t('item.openNewTab'), glyph: 'external', run: () => launch(item.url, item.title, true) },
        { label: item.pinned ? t('item.unpin') : t('item.pin'), glyph: 'pin', run: () => update(s => togglePin(s, item.id)) },
        { label: t('edit'), glyph: 'pen', separatorBefore: true, run: () => setUi({ editor: { kind: 'item', spaceId: space.id, itemId: item.id } }) },
        {
            label: t('duplicate'), glyph: 'copy',
            run: () => update(s => addItem(s, space.id, null, { title: item.title, url: item.url, icon: item.icon }).state),
        },
        ...(others.length ? [{ label: t('item.moveTo'), heading: true, separatorBefore: true }] : []),
        ...others.map(other => ({ label: other.name, glyph: other.glyph, run: () => update(s => moveItem(s, item.id, other.id, null)) })),
        {
            label: t('remove'), glyph: 'trash', danger: true, separatorBefore: true,
            run: () => {
                const before = app.get();
                update(s => removeItem(s, item.id));
                toast(t('item.removed', { name: item.title }), before);
            },
        },
    ];
}

function Tile({ state, space, item }: { state: AppState; space: Space; item: Item }) {
    const [over, setOver] = useState(false);
    return (
        <a class={`tile ${over ? 'is-drop' : ''}`} href={item.url} title={item.url} draggable
            {...(state.prefs.openInNewTab ? { target: '_blank', rel: 'noopener' } : {})}
            onClick={() => remember(item.url, item.title)}
            onContextMenu={event => openMenu(event, itemMenu(state, space, item))}
            onDragStart={event => {
                event.dataTransfer!.setData(DRAG_TYPE, item.id);
                event.dataTransfer!.effectAllowed = 'move';
            }}
            onDragOver={event => {
                if (!event.dataTransfer!.types.includes(DRAG_TYPE)) return;
                event.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={event => {
                const id = event.dataTransfer!.getData(DRAG_TYPE);
                setOver(false);
                if (!id) return;
                event.preventDefault();
                event.stopPropagation();
                const groupId = space.groups.find(g => g.itemIds.includes(item.id))?.id ?? null;
                update(s => moveItem(s, id, space.id, groupId, item.id));
            }}>
            <AppIcon url={item.url} title={item.title} icon={item.icon} size={46} />
            <span class="tile-title">{item.title}</span>
            {item.pinned && <span class="tile-pin" title={t('item.pinned')}><Icon name="pin" size={11} /></span>}
        </a>
    );
}

function Group({ state, space, group }: { state: AppState; space: Space; group: SpaceGroup }) {
    const single = space.groups.length === 1;
    return (
        <section class="group"
            onDragOver={event => event.dataTransfer!.types.includes(DRAG_TYPE) && event.preventDefault()}
            onDrop={event => {
                const id = event.dataTransfer!.getData(DRAG_TYPE);
                if (!id) return;
                event.preventDefault();
                update(s => moveItem(s, id, space.id, group.id));
            }}>
            {!(single && !group.name) && (
                <header class="group-head">
                    <input class="group-name" value={group.name} placeholder={t('group.untitled')} aria-label={t('group.name')}
                        onChange={event => update(s => renameGroup(s, space.id, group.id, event.currentTarget.value))}
                        onKeyDown={event => event.key === 'Enter' && event.currentTarget.blur()} />
                    {!single && (
                        <button type="button" class="icon-button is-small" title={t('group.delete')} aria-label={t('group.delete')}
                            onClick={() => {
                                const before = app.get();
                                update(s => removeGroup(s, space.id, group.id));
                                toast(t('group.deleted'), before);
                            }}>
                            <Icon name="x" size={14} />
                        </button>
                    )}
                </header>
            )}
            <div class="tiles">
                {group.itemIds.map(id => {
                    const item = state.items[id];
                    return item ? <Tile key={id} state={state} space={space} item={item} /> : null;
                })}
                <button type="button" class="tile tile-add" onClick={() => setUi({ editor: { kind: 'item', spaceId: space.id, groupId: group.id } })}>
                    <span class="tile-add-box"><Icon name="plus" size={20} /></span>
                    <span class="tile-title">{t('item.add')}</span>
                </button>
            </div>
        </section>
    );
}

function QuickAdd({ spaceId }: { spaceId: ID }) {
    const [value, setValue] = useState('');
    const [invalid, setInvalid] = useState(false);
    return (
        <form class="quick-add" onSubmit={event => {
            event.preventDefault();
            if (!value.trim()) return;
            let added = false;
            update(s => {
                const result = addItem(s, spaceId, null, { url: value });
                added = !!result.id;
                return result.state;
            });
            setInvalid(!added);
            if (added) setValue('');
        }}>
            <Icon name="plus" size={16} />
            <input type="text" value={value} placeholder={t('item.quickAdd')} aria-label={t('item.quickAdd')} aria-invalid={invalid}
                autocomplete="off" spellcheck={false}
                onInput={event => {
                    setValue(event.currentTarget.value);
                    setInvalid(false);
                }} />
            {invalid && <span class="field-error" role="alert">{t('item.invalidUrl')}</span>}
        </form>
    );
}

export function SpaceView({ state, space }: { state: AppState; space: Space }) {
    const count = itemsOf(state, space).length;
    const close = () => setUi({ spaceId: null });
    return (
        <Overlay label={space.name} class="overlay-space" onClose={close}>
            <div class="space" style={{ '--tint': space.accent }}>
                <header class="space-head">
                    <span class="space-glyph"><Icon name={space.glyph} size={26} /></span>
                    <div class="space-title">
                        <h2>{space.name}</h2>
                        <p>{t('space.count', { n: count })}</p>
                    </div>
                    <div class="space-actions">
                        {count > 0 && <button type="button" class="button" onClick={() => openAll(space)}>{t('space.openAll')}</button>}
                        <button type="button" class="button" onClick={() => update(s => addGroup(s, space.id, t('group.new')))}>{t('group.add')}</button>
                        <button type="button" class="icon-button" title={t('more')} aria-label={t('more')}
                            onClick={event => openMenu(event, spaceMenu(space).slice(2))}>
                            <Icon name="more" />
                        </button>
                        <button type="button" class="icon-button" title={t('close')} aria-label={t('close')} onClick={close}>
                            <Icon name="x" />
                        </button>
                    </div>
                </header>
                <QuickAdd spaceId={space.id} />
                <div class="space-body">
                    {count === 0 && <p class="space-empty">{t('space.emptyHint')}</p>}
                    {space.groups.map(group => <Group key={group.id} state={state} space={space} group={group} />)}
                </div>
            </div>
        </Overlay>
    );
}

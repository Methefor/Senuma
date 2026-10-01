import { useRef, useState } from 'preact/hooks';
import { remember, removeGroupWithUndo } from '../../app/actions';
import { CATEGORIES, type Category } from '../../core/catalog';
import { addGroup, addItem, isDocked, itemsOf, moveItem, renameGroup, shiftGroup } from '../../core/ops';
import { fillFromCategory } from '../../core/setup';
import type { AppState, ID, Item, Space, SpaceGroup } from '../../core/types';
import { hostOf, normalizeUrl } from '../../core/url';
import { t, type MessageKey } from '../../i18n';
import { openMenu, openMenuBelow, setUi, update } from '../../storage/store';
import { AppIcon } from '../../ui/AppIcon';
import { Icon } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';
import { itemMenu, openAll, spaceMenu } from './menus';

export { Editor } from './Editors';

const DRAG_TYPE = 'application/x-space-item';
const RECENT_TILES = 4;
/** "Recent" only earns its row once a Space is big enough to need a shortcut into it. */
const RECENT_MIN_ITEMS = 12;
const RECENT_MIN_ENTRIES = 2;
const ROW_TOLERANCE_PX = 6;

function matches(item: Item, filter: string): boolean {
    return !filter || item.title.toLowerCase().includes(filter) || hostOf(item.url).includes(filter);
}

function Tile({ state, space, item, sortable = true }: { state: AppState; space: Space; item: Item; sortable?: boolean }) {
    const [over, setOver] = useState(false);
    const drag = sortable
        ? {
            draggable: true,
            onDragStart: (event: DragEvent) => {
                event.dataTransfer!.setData(DRAG_TYPE, item.id);
                event.dataTransfer!.effectAllowed = 'move';
            },
            onDragOver: (event: DragEvent) => {
                if (!event.dataTransfer!.types.includes(DRAG_TYPE)) return;
                event.preventDefault();
                setOver(true);
            },
            onDragLeave: () => setOver(false),
            onDrop: (event: DragEvent) => {
                const id = event.dataTransfer!.getData(DRAG_TYPE);
                setOver(false);
                if (!id) return;
                event.preventDefault();
                event.stopPropagation();
                const groupId = space.groups.find(g => g.itemIds.includes(item.id))?.id ?? null;
                update(s => moveItem(s, id, space.id, groupId, item.id));
            },
        }
        : { draggable: false };
    return (
        <a class={`tile ${over ? 'is-drop' : ''}`} href={item.url} title={item.url} {...drag}
            {...(state.prefs.openInNewTab ? { target: '_blank', rel: 'noopener' } : {})}
            onClick={() => remember(item.url, item.title, space.id)}
            onContextMenu={event => openMenu(event, itemMenu(state, space, item))}>
            <AppIcon url={item.url} title={item.title} icon={item.icon} size={46} />
            <span class="tile-title">{item.title}</span>
            {isDocked(state, { kind: 'item', id: item.id }) && <span class="tile-pin" title={t('dock.inDock')}><Icon name="pin" size={11} /></span>}
        </a>
    );
}

function Group({ state, space, group, index, filter }: { state: AppState; space: Space; group: SpaceGroup; index: number; filter: string }) {
    const single = space.groups.length === 1;
    const items = group.itemIds.map(id => state.items[id]).filter((i): i is Item => !!i && matches(i, filter));
    if (filter && !items.length) return null;
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
                        <button type="button" class="icon-button is-small" title={t('group.options')} aria-label={t('group.options')} aria-haspopup="menu"
                            onClick={event => openMenuBelow(event.currentTarget, [
                                { label: t('moveUp'), glyph: 'up', disabled: index === 0, run: () => update(s => shiftGroup(s, space.id, group.id, -1)) },
                                { label: t('moveDown'), glyph: 'down', disabled: index === space.groups.length - 1, run: () => update(s => shiftGroup(s, space.id, group.id, 1)) },
                                { label: t('group.delete'), glyph: 'trash', danger: true, separatorBefore: true, run: () => removeGroupWithUndo(space.id, group.id) },
                            ])}>
                            <Icon name="more" size={15} />
                        </button>
                    )}
                </header>
            )}
            <div class="tiles">
                {items.map(item => <Tile key={item.id} state={state} space={space} item={item} sortable={!filter} />)}
                {!filter && (
                    <button type="button" class="tile tile-add" onClick={() => setUi({ editor: { kind: 'item', spaceId: space.id, groupId: group.id } })}>
                        <span class="tile-add-box"><Icon name="plus" size={20} /></span>
                        <span class="tile-title">{t('item.add')}</span>
                    </button>
                )}
            </div>
        </section>
    );
}

/** One field, two jobs: typing narrows the Space; an address can be added with Enter. */
function FilterAdd({ spaceId, value, onChange }: { spaceId: ID; value: string; onChange: (value: string) => void }) {
    const url = normalizeUrl(value);
    return (
        <form class="quick-add" onSubmit={event => {
            event.preventDefault();
            if (!url) return;
            update(s => addItem(s, spaceId, null, { url }).state);
            onChange('');
        }}>
            <Icon name="search" size={16} />
            <input id="space-filter" type="text" value={value} placeholder={t('space.filterOrAdd')} aria-label={t('space.filterOrAdd')}
                autocomplete="off" spellcheck={false} onInput={event => onChange(event.currentTarget.value)} />
            {url && <button type="submit" class="quick-add-hint"><kbd>↵</kbd>{t('item.addThis', { host: hostOf(url) })}</button>}
        </form>
    );
}

/** Arrow keys move between tiles the way they look on screen, across groups. */
function moveFocus(body: HTMLElement, key: string): boolean {
    const tiles = [...body.querySelectorAll<HTMLElement>('.tile')];
    const current = tiles.indexOf(document.activeElement as HTMLElement);
    if (current < 0) {
        tiles[0]?.focus();
        return true;
    }
    let target: HTMLElement | undefined;
    if (key === 'ArrowRight') target = tiles[current + 1];
    else if (key === 'ArrowLeft') target = tiles[current - 1];
    else {
        const here = tiles[current]!.getBoundingClientRect();
        const down = key === 'ArrowDown';
        const others = tiles
            .map(tile => ({ tile, rect: tile.getBoundingClientRect() }))
            .filter(({ rect }) => (down ? rect.top > here.top + ROW_TOLERANCE_PX : rect.top < here.top - ROW_TOLERANCE_PX));
        if (!others.length) return true;
        // The nearest row in that direction, then the tile closest horizontally within it.
        const rowTop = down ? Math.min(...others.map(o => o.rect.top)) : Math.max(...others.map(o => o.rect.top));
        target = others
            .filter(o => Math.abs(o.rect.top - rowTop) <= ROW_TOLERANCE_PX)
            .sort((a, b) => Math.abs(a.rect.left - here.left) - Math.abs(b.rect.left - here.left))[0]?.tile;
    }
    target?.focus();
    return true;
}

/**
 * Which starter set an empty Space most likely wants: the category it was made from, or one
 * whose name it shares ("Design", "Gaming"). Null when the name says nothing we recognise.
 */
function categoryFor(space: Space): Category | null {
    const name = space.name.trim().toLowerCase();
    return (
        CATEGORIES.find(c => c.id === space.templateId) ??
        CATEGORIES.find(c => c.id === name || t(`cat.${c.id}` as MessageKey).toLowerCase() === name) ??
        null
    );
}

/** How far the entrance leans toward where the Space was opened from (0 = none). */
const ORIGIN_PULL = 0.16;

export function SpaceView({ state, space, origin }: { state: AppState; space: Space; origin: { x: number; y: number } | null }) {
    const [filterText, setFilterText] = useState('');
    const suggested = categoryFor(space);
    // The panel arrives from the direction of the plate or dock icon that opened it.
    const entrance = {
        '--from-x': `${origin ? Math.round((origin.x - innerWidth / 2) * ORIGIN_PULL) : 0}px`,
        '--from-y': `${origin ? Math.round((origin.y - innerHeight / 2) * ORIGIN_PULL) : 0}px`,
    };
    const bodyRef = useRef<HTMLDivElement>(null);
    const items = itemsOf(state, space);
    const count = items.length;
    const close = () => setUi({ spaceId: null });
    // An address being typed is not a filter; keep everything visible while adding.
    const filter = normalizeUrl(filterText) ? '' : filterText.trim().toLowerCase();

    const byUrl = new Map(items.map(item => [item.url, item]));
    const recent = count >= RECENT_MIN_ITEMS && !filter
        ? state.recents.filter(r => r.spaceId === space.id).map(r => byUrl.get(r.url)).filter((i): i is Item => !!i).slice(0, RECENT_TILES)
        : [];
    const nothingMatches = !!filter && !items.some(item => matches(item, filter));

    return (
        <Overlay label={space.name} class="overlay-space" style={entrance} onClose={close}>
            <div class="space" style={{ '--tint': space.accent }}
                onKeyDown={event => {
                    const typing = (event.target as HTMLElement).tagName === 'INPUT';
                    if (event.key === '/' && !typing) {
                        event.preventDefault();
                        document.getElementById('space-filter')?.focus();
                    } else if (event.key === 'ArrowDown' && (event.target as HTMLElement).id === 'space-filter') {
                        event.preventDefault();
                        bodyRef.current?.querySelector<HTMLElement>('.tile')?.focus();
                    } else if (event.key.startsWith('Arrow') && !typing && bodyRef.current && moveFocus(bodyRef.current, event.key)) {
                        event.preventDefault();
                    }
                }}>
                <header class="space-head">
                    <span class="space-glyph"><Icon name={space.glyph} size={26} /></span>
                    <div class="space-title">
                        <h2>{space.name}</h2>
                        <p>{space.note ? `${space.note} · ` : ''}{t('space.count', { n: count })}</p>
                    </div>
                    <div class="space-actions">
                        {count > 0 && <button type="button" class="button" onClick={() => openAll(space)}>{t('space.openAll')}</button>}
                        <button type="button" class="icon-button" title={t('more')} aria-label={t('more')} aria-haspopup="menu"
                            onClick={event => openMenuBelow(event.currentTarget, [
                                { label: t('group.add'), glyph: 'plus', run: () => update(s => addGroup(s, space.id, t('group.new'))) },
                                ...spaceMenu(state, space).slice(2),
                            ])}>
                            <Icon name="more" />
                        </button>
                        <button type="button" class="icon-button" title={t('close')} aria-label={t('close')} onClick={close}>
                            <Icon name="x" />
                        </button>
                    </div>
                </header>
                <FilterAdd spaceId={space.id} value={filterText} onChange={setFilterText} />
                <div class="space-body" ref={bodyRef}>
                    {count === 0 && (
                        <div class="space-empty">
                            <h3>{t('space.emptyTitle', { name: space.name })}</h3>
                            {suggested ? (
                                <>
                                    <p>{t('space.emptyAdd')}</p>
                                    <div class="pick-row">
                                        {suggested.groups.flatMap(group => group.services).map(([title, url]) => (
                                            <button type="button" class="pick" key={url} onClick={() => update(s => addItem(s, space.id, null, { title, url }).state)}>
                                                <AppIcon url={url} title={title} size={20} />
                                                {title}
                                            </button>
                                        ))}
                                    </div>
                                    <button type="button" class="button" onClick={() => update(s => fillFromCategory(s, space.id, suggested.id))}>
                                        {t('space.addAll')}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <p>{t('space.emptyHint')}</p>
                                    <p class="eyebrow">{t('space.startWith')}</p>
                                    <div class="pick-row">
                                        {CATEGORIES.filter(c => c.onboarding !== false).map(category => (
                                            <button type="button" class="pick" key={category.id} style={{ '--tint': category.accent }}
                                                onClick={() => update(s => fillFromCategory(s, space.id, category.id))}>
                                                <Icon name={category.glyph} size={16} />
                                                {t(`cat.${category.id}` as MessageKey)}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                    {recent.length >= RECENT_MIN_ENTRIES && (
                        <section class="group">
                            <header class="group-head"><span class="group-label">{t('space.recent')}</span></header>
                            <div class="tiles">
                                {recent.map(item => <Tile key={item.id} state={state} space={space} item={item} sortable={false} />)}
                            </div>
                        </section>
                    )}
                    {space.groups.map((group, index) => <Group key={group.id} state={state} space={space} group={group} index={index} filter={filter} />)}
                    {nothingMatches && <p class="space-empty">{t('space.noMatch', { query: filterText.trim() })}</p>}
                </div>
            </div>
        </Overlay>
    );
}

/** Context menus shared by Home, the dock and the Space view. */
import { launch, removeItemWithUndo, removeSpaceWithUndo } from '../../app/actions';
import { addItem, duplicateSpace, isDocked, itemsOf, moveItem, shiftSpace, toggleDock, visibleSpaces } from '../../core/ops';
import type { AppState, Item, Space } from '../../core/types';
import { t } from '../../i18n';
import { app, setUi, update, type MenuItem } from '../../storage/store';

export function openAll(space: Space): void {
    for (const item of itemsOf(app.get(), space)) window.open(item.url, '_blank', 'noopener');
}

function dockItem(state: AppState, entry: { kind: 'item' | 'space'; id: string }): MenuItem {
    return {
        label: isDocked(state, entry) ? t('dock.remove') : t('dock.add'),
        glyph: 'pin',
        run: () => update(s => toggleDock(s, entry)),
    };
}

/** `onHome` adds reordering, which only means something where Spaces are laid out in order. */
export function spaceMenu(state: AppState, space: Space, onHome = false): MenuItem[] {
    const visible = visibleSpaces(state);
    const index = visible.findIndex(s => s.id === space.id);
    return [
        { label: t('open'), glyph: 'enter', run: () => setUi({ spaceId: space.id }) },
        { label: t('space.openAll'), glyph: 'external', run: () => openAll(space) },
        dockItem(state, { kind: 'space', id: space.id }),
        ...(onHome && visible.length > 1
            ? [
                { label: t('space.moveEarlier'), glyph: 'up', separatorBefore: true, disabled: index <= 0, run: () => update(s => shiftSpace(s, space.id, -1)) },
                { label: t('space.moveLater'), glyph: 'down', disabled: index >= visible.length - 1, run: () => update(s => shiftSpace(s, space.id, 1)) },
            ]
            : []),
        { label: t('edit'), glyph: 'pen', separatorBefore: true, run: () => setUi({ editor: { kind: 'space', spaceId: space.id } }) },
        { label: t('duplicate'), glyph: 'copy', run: () => update(s => duplicateSpace(s, space.id, t('space.copyOf', { name: space.name })).state) },
        { label: t('delete'), glyph: 'trash', danger: true, separatorBefore: true, run: () => removeSpaceWithUndo(space.id) },
    ];
}

export function itemMenu(state: AppState, space: Space, item: Item): MenuItem[] {
    const others = state.spaceOrder.filter(id => id !== space.id).map(id => state.spaces[id]!);
    return [
        { label: t('item.openNewTab'), glyph: 'external', run: () => launch(item.url, item.title, { newTab: true, spaceId: space.id }) },
        dockItem(state, { kind: 'item', id: item.id }),
        { label: t('edit'), glyph: 'pen', separatorBefore: true, run: () => setUi({ editor: { kind: 'item', spaceId: space.id, itemId: item.id } }) },
        {
            label: t('duplicate'), glyph: 'copy',
            run: () => update(s => addItem(s, space.id, null, { title: item.title, url: item.url, icon: item.icon }).state),
        },
        ...(others.length ? [{ label: t('item.moveTo'), heading: true, separatorBefore: true }] : []),
        ...others.map(other => ({ label: other.name, glyph: other.glyph, run: () => update(s => moveItem(s, item.id, other.id, null)) })),
        { label: t('remove'), glyph: 'trash', danger: true, separatorBefore: true, run: () => removeItemWithUndo(item.id) },
    ];
}

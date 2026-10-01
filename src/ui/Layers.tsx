/** Top-most transient layers: the context menu and toasts. */
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { t } from '../i18n';
import { dismissToast, setUi, ui, update, useStore } from '../storage/store';
import { Icon } from './Icon';

const EDGE_GAP = 8;

export function ContextMenu() {
    const { menu } = useStore(ui);
    const ref = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
        const node = ref.current;
        if (!node || !menu) return;
        // Keep the menu inside the viewport whichever corner it was opened near.
        const { width, height } = node.getBoundingClientRect();
        node.style.left = `${Math.max(EDGE_GAP, Math.min(menu.x, innerWidth - width - EDGE_GAP))}px`;
        node.style.top = `${Math.max(EDGE_GAP, Math.min(menu.y, innerHeight - height - EDGE_GAP))}px`;
        const opener = document.activeElement as HTMLElement | null;
        node.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
        return () => opener?.focus?.();
    }, [menu]);

    useEffect(() => {
        if (!menu) return;
        const close = () => setUi({ menu: null });
        const onPointer = (event: Event) => {
            if (!ref.current?.contains(event.target as Node)) close();
        };
        window.addEventListener('pointerdown', onPointer, true);
        window.addEventListener('blur', close);
        window.addEventListener('resize', close);
        return () => {
            window.removeEventListener('pointerdown', onPointer, true);
            window.removeEventListener('blur', close);
            window.removeEventListener('resize', close);
        };
    }, [menu]);

    if (!menu) return null;

    const onKeyDown = (event: KeyboardEvent) => {
        event.stopPropagation();
        if (event.key === 'Escape' || event.key === 'Tab') {
            event.preventDefault();
            setUi({ menu: null });
            return;
        }
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const buttons = [...ref.current!.querySelectorAll<HTMLElement>('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement as HTMLElement);
        const next = (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
    };

    return (
        <div ref={ref} class="menu" role="menu" style={{ left: `${menu.x}px`, top: `${menu.y}px` }} onKeyDown={onKeyDown}
            onContextMenu={event => event.preventDefault()}>
            {menu.items.map(item => (
                <>
                    {item.separatorBefore && <div class="menu-sep" role="separator" />}
                    {item.heading ? (
                        <div class="menu-heading">{item.label}</div>
                    ) : (
                        <button type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={item.checked}
                            disabled={item.disabled} class={item.danger ? 'is-danger' : ''}
                            onClick={() => {
                                setUi({ menu: null });
                                item.run?.();
                            }}>
                            {item.glyph && <Icon name={item.glyph} size={15} />}
                            <span>{item.label}</span>
                            {item.checked && <Icon name="check" size={14} />}
                        </button>
                    )}
                </>
            ))}
        </div>
    );
}

export function Toasts() {
    const { toasts } = useStore(ui);
    return (
        <div class="toasts" role="status" aria-live="polite">
            {toasts.map(item => (
                <div class="toast" key={item.id}>
                    <span>{item.message}</span>
                    {item.undo && (
                        <button type="button" class="toast-action"
                            onClick={() => {
                                update(item.undo!);
                                dismissToast(item.id);
                            }}>
                            {t('undo')}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}

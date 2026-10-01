import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface Props {
    label: string;
    class?: string;
    /** Omit to make the overlay non-dismissable (onboarding). */
    onClose?: () => void;
    children: ComponentChildren;
}

/**
 * Modal surface: traps Tab, closes on Escape or a click on the scrim, and returns focus to
 * whatever opened it. Overlays may stack; the one holding focus handles the keys.
 */
export function Overlay({ label, class: className = '', onClose, children }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const opener = document.activeElement as HTMLElement | null;
        const node = ref.current!;
        // Focus the field a panel asks for; otherwise the panel itself, so no control looks pre-selected.
        (node.querySelector<HTMLElement>('[autofocus]') ?? node).focus();
        return () => opener?.focus?.();
    }, []);

    const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && onClose) {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== 'Tab') return;
        const nodes = [...ref.current!.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(n => n.offsetParent !== null);
        const first = nodes[0];
        const last = nodes.at(-1);
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <div class="scrim" onMouseDown={event => event.target === event.currentTarget && onClose?.()}>
            <div ref={ref} class={`overlay ${className}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}>
                {children}
            </div>
        </div>
    );
}

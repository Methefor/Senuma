import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

interface Props {
    label: string;
    class?: string;
    /** Custom properties for the panel, e.g. where its entrance should come from. */
    style?: Record<string, string>;
    /** Omit to make the overlay non-dismissable (onboarding). */
    onClose?: () => void;
    children: ComponentChildren;
}

/**
 * Modal surface: traps Tab, closes on Escape or a click on the scrim, and returns focus to
 * whatever opened it. Overlays may stack; the one holding focus handles the keys.
 */
export function Overlay({ label, class: className = '', style, onClose, children }: Props) {
    const ref = useRef<HTMLDivElement>(null);

    // Focus moves in the same task the panel appears in, so a key pressed right away (Escape,
    // Tab) already reaches the panel rather than the page behind it.
    useLayoutEffect(() => {
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
        // A closed <details> hides its content without taking it out of layout, so skip that content by hand.
        const nodes = [...ref.current!.querySelectorAll<HTMLElement>(FOCUSABLE)]
            .filter(n => n.offsetParent !== null && (n.tagName === 'SUMMARY' || !n.closest('details:not([open])')));
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
            <div ref={ref} class={`overlay ${className}`} style={style} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onKeyDown={onKeyDown}>
                {children}
            </div>
        </div>
    );
}

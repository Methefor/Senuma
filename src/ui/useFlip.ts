import type { RefObject } from 'preact';
import { useLayoutEffect, useRef } from 'preact/hooks';

const DURATION_MS = 240;
const EASING = 'cubic-bezier(.2, .7, .2, 1)';

function motionAllowed(): boolean {
    return document.documentElement.dataset.motion === 'full' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animates children of `container` that carry `data-flip` from their previous position to
 * their new one whenever `order` changes, so reordering reads as movement rather than a jump.
 */
export function useFlip(container: RefObject<HTMLElement>, order: string): void {
    const previous = useRef(new Map<string, DOMRect>());

    useLayoutEffect(() => {
        const node = container.current;
        if (!node) return;
        const next = new Map<string, DOMRect>();
        for (const child of node.querySelectorAll<HTMLElement>('[data-flip]')) {
            const key = child.dataset.flip!;
            const rect = child.getBoundingClientRect();
            next.set(key, rect);
            const before = previous.current.get(key);
            if (!before || !motionAllowed()) continue;
            const dx = before.left - rect.left;
            const dy = before.top - rect.top;
            if (dx || dy) child.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: DURATION_MS, easing: EASING });
        }
        previous.current = next;
    }, [order]);
}

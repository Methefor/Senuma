import { useState } from 'preact/hooks';
import { iconFailed, markIconFailed } from '../browser/iconCache';
import { iconCandidates } from '../core/icons';
import { hostOf, isImageUrl } from '../core/url';
import { app } from '../storage/store';

/** Some servers answer a missing icon with a 1×1 placeholder; treat anything this small as absent. */
const MIN_ICON_PX = 8;

function hueOf(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 360;
    return hash;
}

/** Walks the candidate addresses until one loads; shows the monogram until then (or for good). */
function IconImage({ candidates, letter }: { candidates: string[]; letter: string }) {
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const src = candidates[attempt];
    const giveUp = () => {
        if (src) markIconFailed(src);
        setAttempt(attempt + 1);
    };
    return (
        <>
            {!loaded && <span class="app-icon-mono">{letter}</span>}
            {src && (
                <img key={src} src={src} alt="" loading="lazy" decoding="async" draggable={false} referrerpolicy="no-referrer"
                    class={loaded ? 'is-loaded' : ''}
                    onLoad={event => (event.currentTarget.naturalWidth < MIN_ICON_PX ? giveUp() : setLoaded(true))}
                    onError={giveUp} />
            )}
        </>
    );
}

interface Props {
    url: string;
    title: string;
    /** User override: emoji or image URL. */
    icon?: string;
    size?: number;
}

/**
 * One icon treatment everywhere: a fixed rounded container holding the first image that
 * loads from the candidate list, over a monogram that needs no network at all.
 */
export function AppIcon({ url, title, icon, size = 40 }: Props) {
    const emoji = icon && !isImageUrl(icon) ? icon : undefined;
    const candidates = emoji ? [] : iconCandidates(url, app.get().prefs.iconSource, icon).filter(candidate => !iconFailed(candidate));
    const host = hostOf(url);
    const letter = (title.trim() || host || '?').charAt(0).toUpperCase();

    return (
        <span class="app-icon" style={{ '--size': `${size}px`, '--hue': hueOf(host || title) }} aria-hidden="true">
            {emoji
                ? <span class="app-icon-emoji">{emoji}</span>
                // Keyed by the candidates: a different link or icon source starts a fresh attempt.
                : <IconImage key={candidates.join('|')} candidates={candidates} letter={letter} />}
        </span>
    );
}

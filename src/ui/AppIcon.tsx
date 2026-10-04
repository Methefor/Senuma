import { useState } from 'preact/hooks';
import { iconFailed, markIconFailed } from '../browser/iconCache';
import { iconCandidates, localMark } from '../core/icons';
import { hostOf, isImageUrl } from '../core/url';
import { app } from '../storage/store';

/** Some servers answer a missing icon with a 1×1 placeholder; treat anything this small as absent. */
const MIN_ICON_PX = 8;
/** Packaged brand marks: files inside the extension, so showing one makes no request. */
const MARK_DIR = import.meta.env.DEV ? '/src/assets/marks/' : 'marks/';

/** Shape only; painted in a neutral ink through a mask so it reads on every theme. */
function Mark({ name }: { name: string }) {
    return <span class="app-icon-mark" style={{ maskImage: `url("${MARK_DIR}${name}.svg")` }} />;
}

function hueOf(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 360;
    return hash;
}

/**
 * Walks the candidate addresses until one loads. Until then, and for good when none does,
 * shows the packaged mark if the app has one, otherwise the monogram.
 */
function IconImage({ candidates, letter, mark }: { candidates: string[]; letter: string; mark?: string }) {
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const src = candidates[attempt];
    const giveUp = () => {
        if (src) markIconFailed(src);
        setAttempt(attempt + 1);
    };
    return (
        <>
            {!loaded && (mark ? <Mark name={mark} /> : <span class="app-icon-mono">{letter}</span>)}
            {src && (
                <img key={src} src={src} alt="" loading="lazy" decoding="async" draggable={false} referrerpolicy="no-referrer"
                    class={loaded ? 'is-loaded' : ''}
                    onLoad={event => (event.currentTarget.naturalWidth < MIN_ICON_PX ? giveUp() : setLoaded(true))}
                    onError={giveUp} />
            )}
        </>
    );
}

/** The letter alone, never a request: for things shown before they are saved (suggestions). */
export function Monogram({ url, title, size = 20 }: { url: string; title: string; size?: number }) {
    return (
        <span class="app-icon" style={{ '--size': `${size}px`, '--hue': hueOf(hostOf(url) || title) }} aria-hidden="true">
            <span class="app-icon-mono">{(title.trim() || '?').charAt(0).toUpperCase()}</span>
        </span>
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
    const source = app.get().prefs.iconSource;
    // "Letters only" means exactly that; a user's own image always wins over a packaged mark.
    const mark = source === 'none' || isImageUrl(icon) ? undefined : localMark(url);
    // With the private default a packaged mark is the answer: nothing is requested at all.
    // Someone who chose the icon service keeps its pictures and gets the mark when it fails.
    const candidates = emoji || (mark && source === 'site') ? []
        : iconCandidates(url, source, icon).filter(candidate => !iconFailed(candidate));
    const host = hostOf(url);
    const letter = (title.trim() || host || '?').charAt(0).toUpperCase();

    return (
        <span class="app-icon" style={{ '--size': `${size}px`, '--hue': hueOf(host || title) }} aria-hidden="true">
            {emoji
                ? <span class="app-icon-emoji">{emoji}</span>
                // Keyed by the candidates: a different link or icon source starts a fresh attempt.
                : <IconImage key={`${mark}|${candidates.join('|')}`} candidates={candidates} letter={letter} mark={mark} />}
        </span>
    );
}

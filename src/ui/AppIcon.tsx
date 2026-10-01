import { useEffect, useState } from 'preact/hooks';
import { iconFailed, markIconFailed } from '../browser/iconCache';
import { iconCandidates } from '../core/icons';
import { hostOf, isImageUrl } from '../core/url';
import { app } from '../storage/store';

function hueOf(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 360;
    return hash;
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
    const source = app.get().prefs.iconSource;
    const emoji = icon && !isImageUrl(icon) ? icon : undefined;
    const candidates = emoji ? [] : iconCandidates(url, source, icon).filter(candidate => !iconFailed(candidate));
    const key = candidates.join('|');
    const [attempt, setAttempt] = useState(0);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setAttempt(0);
        setLoaded(false);
    }, [key]);

    const host = hostOf(url);
    const src = candidates[attempt];
    const letter = (title.trim() || host || '?').charAt(0).toUpperCase();

    return (
        <span class="app-icon" style={{ '--size': `${size}px`, '--hue': hueOf(host || title) }} aria-hidden="true">
            {emoji ? (
                <span class="app-icon-emoji">{emoji}</span>
            ) : (
                <>
                    {!loaded && <span class="app-icon-mono">{letter}</span>}
                    {src && (
                        <img key={src} src={src} alt="" loading="lazy" decoding="async" draggable={false} referrerpolicy="no-referrer"
                            class={loaded ? 'is-loaded' : ''}
                            onLoad={event => {
                                // Some servers answer a missing icon with a 1×1 placeholder.
                                if (event.currentTarget.naturalWidth < 8) {
                                    markIconFailed(src);
                                    setAttempt(attempt + 1);
                                } else setLoaded(true);
                            }}
                            onError={() => {
                                markIconFailed(src);
                                setAttempt(attempt + 1);
                            }} />
                    )}
                </>
            )}
        </span>
    );
}

import { useState } from 'preact/hooks';
import { hostOf, isImageUrl } from '../core/url';
import { app } from '../storage/store';

const FAVICON_SERVICE = 'https://www.google.com/s2/favicons?sz=64&domain=';

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
 * One icon treatment everywhere: a fixed rounded container holding, in order of preference,
 * the user's own icon, the site favicon, or a monogram that needs no network at all.
 */
export function AppIcon({ url, title, icon, size = 40 }: Props) {
    const [status, setStatus] = useState<'pending' | 'loaded' | 'failed'>('pending');
    const host = hostOf(url);
    const custom = isImageUrl(icon) ? icon : undefined;
    const emoji = icon && !custom ? icon : undefined;
    const remote = app.get().prefs.iconSource === 'remote' && host ? FAVICON_SERVICE + encodeURIComponent(host) : undefined;
    const src = custom ?? remote;
    const letter = (title.trim() || host || '?').charAt(0).toUpperCase();

    return (
        <span class="app-icon" style={{ '--size': `${size}px`, '--hue': hueOf(host || title) }} aria-hidden="true">
            {emoji ? (
                <span class="app-icon-emoji">{emoji}</span>
            ) : (
                <>
                    {status !== 'loaded' && <span class="app-icon-mono">{letter}</span>}
                    {src && status !== 'failed' && (
                        <img src={src} alt="" loading="lazy" decoding="async" draggable={false}
                            class={status === 'loaded' ? 'is-loaded' : ''}
                            onLoad={() => setStatus('loaded')} onError={() => setStatus('failed')} />
                    )}
                </>
            )}
        </span>
    );
}

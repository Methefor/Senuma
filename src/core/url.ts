const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'file:']);
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[::1\]|[\w-]+\.(localhost|test|local))(:\d+)?(\/|$)/i;
const BARE_DOMAIN = /^[\w-]+(\.[\w-]+)*\.[a-z]{2,}(:\d+)?([/?#].*)?$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}(:\d+)?([/?#].*)?$/;

/** Turns user input into a safe absolute URL, or null when it is not one. */
export function normalizeUrl(input: unknown): string | null {
    if (typeof input !== 'string') return null;
    const text = input.trim();
    if (!text || /\s/.test(text)) return null;
    let candidate = text;
    if (!/^[a-z][a-z\d+.-]*:\/\//i.test(text)) {
        if (LOCAL_HOST.test(text) || IPV4.test(text)) candidate = `http://${text}`;
        else if (BARE_DOMAIN.test(text)) candidate = `https://${text}`;
        else return null;
    }
    try {
        const url = new URL(candidate);
        return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

export function hostOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

/** A readable default title for a URL: "github.com" → "Github". */
export function titleFromUrl(url: string): string {
    const host = hostOf(url);
    if (!host) return url;
    const parts = host.split('.');
    const name = (parts.length > 1 ? parts[parts.length - 2] : parts[0]) ?? host;
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export function isImageUrl(value: string | undefined): boolean {
    return !!value && /^(https?:|data:image\/)/i.test(value);
}

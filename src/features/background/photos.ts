/**
 * Addresses of the packaged photographs. They are plain files inside the extension (see
 * vite.config.ts), so choosing one makes no network request.
 */
const DIR = import.meta.env.DEV ? '/src/assets/wallpapers/' : 'wallpapers/';

export function photoUrl(file: string, size: 'full' | 'thumb'): string {
    return `${DIR}${file}${size === 'thumb' ? '.thumb' : ''}.webp`;
}

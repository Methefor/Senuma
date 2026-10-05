import type { Language } from '../../core/types';

/**
 * Sections of the user guide (docs/guide/*.md), in order. The id is the anchor in the packaged
 * help page and is the same in every language, so a "Learn more" link needs no translation.
 */
export const GUIDE_TOPICS = [
    'getting-started', 'home', 'spaces', 'links-groups', 'search', 'search-shortcuts', 'command-center', 'modes', 'dock',
    'continue', 'themes', 'backgrounds', 'image-upload', 'fill-fit', 'position', 'dim', 'blur', 'atmosphere', 'motion',
    'import-links', 'import-export', 'bookmarks', 'privacy', 'keyboard', 'advanced', 'faq', 'help-feedback',
] as const;

export type GuideTopic = (typeof GUIDE_TOPICS)[number];

/** The packaged guide per language. A language without its own guide uses the English one. */
const GUIDE_PAGES: Partial<Record<Language, string>> = { en: 'help/en.html', tr: 'help/tr.html' };

export function guideUrl(language: Language, topic?: GuideTopic): string {
    return `${GUIDE_PAGES[language] ?? GUIDE_PAGES.en}${topic ? `#${topic}` : ''}`;
}

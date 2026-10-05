import { useEffect, useState } from 'preact/hooks';
import type { Language } from '../../core/types';
import { currentLanguage } from '../../i18n';
import { HELP_EN, type HelpKey, type HelpStrings } from './strings-en';

/** One loader per language besides English. A new language is one line here and one strings file. */
const LOADERS: Partial<Record<Language, () => Promise<HelpStrings>>> = {
    tr: () => import('./strings-tr').then(module => module.HELP_TR),
};

const loaded: Partial<Record<Language, HelpStrings>> = { en: HELP_EN };

export type HelpText = (key: HelpKey, params?: Record<string, string | number>) => string;

/** A help string in `language`, English when that language has none, with {params} filled in. */
export function helpText(language: Language, key: HelpKey, params: Record<string, string | number> = {}): string {
    const text = loaded[language]?.[key] ?? HELP_EN[key];
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Resolves once the help strings for `language` are in memory. */
export async function ensureHelpLanguage(language: Language): Promise<void> {
    if (loaded[language] || !LOADERS[language]) return;
    loaded[language] = await LOADERS[language]!();
}

/** The translator for the interface language. Renders again once that language's strings arrive. */
export function useHelpText(): HelpText {
    const language = currentLanguage();
    const [, setReady] = useState(0);
    useEffect(() => {
        if (!loaded[language]) void ensureHelpLanguage(language).then(() => setReady(n => n + 1));
    }, [language]);
    return (key, params) => helpText(language, key, params);
}

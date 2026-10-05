import type { Language } from '../core/types';
import { en } from './en';

export type MessageKey = keyof typeof en;
type Dictionary = Partial<Record<MessageKey, string>>;

/** English ships in the main bundle; other languages load only for the people who use them. */
const LOADERS: Record<Exclude<Language, 'en'>, () => Promise<Dictionary>> = {
    tr: () => import('./tr').then(m => m.tr),
};

const dictionaries: Partial<Record<Language, Dictionary>> = { en };
let language: Language = 'en';

export function setLanguage(next: Language): void {
    language = next;
}

export function currentLanguage(): Language {
    return language;
}

/** Resolves once the strings for `lang` are in memory. Until then English is shown. */
export async function ensureLanguage(lang: Language): Promise<void> {
    if (lang === 'en' || dictionaries[lang]) return;
    dictionaries[lang] = await LOADERS[lang]();
}

/** Every loaded translation of a key: English always, others once fetched. */
export function translations(key: string): string[] {
    return Object.values(dictionaries).flatMap(d => (d?.[key as MessageKey] ? [d[key as MessageKey]!] : []));
}

/** Looks up a message, falls back to English, picks the "one|many" form by `n`, fills {params}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
    let text: string = dictionaries[language]?.[key] ?? en[key] ?? key;
    if (text.includes('|')) {
        const [one, many] = text.split('|') as [string, string];
        text = params.n === 1 ? one : many;
    }
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

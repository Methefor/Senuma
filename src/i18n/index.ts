import type { Language } from '../core/types';
import { en } from './en';
import { tr } from './tr';

export type MessageKey = keyof typeof en;

const DICTIONARIES: Record<Language, Partial<Record<MessageKey, string>>> = { en, tr };

let language: Language = 'en';

export function setLanguage(next: Language): void {
    language = next;
}

/** Looks up a message, falls back to English, picks the "one|many" form by `n`, fills {params}. */
export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
    let text: string = DICTIONARIES[language][key] ?? en[key] ?? key;
    if (text.includes('|')) {
        const [one, many] = text.split('|') as [string, string];
        text = params.n === 1 ? one : many;
    }
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/**
 * Names Senuma gives — a catalog Space (“Finance”), a starter Mode (“Work”), a catalog group
 * (“Watch”), the “Bookmarks” Space and “Imported” groups an import makes — carry the
 * dictionary key they came from, so they follow the interface language. A name the person
 * typed carries no key and is never changed: renaming drops the key.
 */
import { CATEGORIES, MODE_PRESETS } from './catalog';
import type { AppState, Mode, Space, SpaceGroup } from './types';

/** What a stored key may look like; anything else is dropped when data is read. */
export const NAME_KEY = /^((cat|catgroup|modePreset)\.[a-z]{1,32}|import\.(otherSpace|importedGroup))$/;

const GROUP_KEYS = [...new Set(CATEGORIES.flatMap(c => c.groups.map(g => g.key)).filter(Boolean))].map(key => `catgroup.${key}`).concat('import.importedGroup');

export interface NameTexts {
    /** The key's text in the current language. */
    text: (key: string) => string;
    /**
     * Every known translation of a key (English, and Turkish once loaded). Used once, to
     * recognise names given before keys were stored: only an exact match is taken over.
     */
    known: (key: string) => readonly string[];
}

function keyFor(name: string, candidates: readonly string[], texts: NameTexts): string | undefined {
    return candidates.find(key => texts.known(key).includes(name));
}

function named<T extends { name: string; nameKey?: string }>(thing: T, candidates: readonly string[], texts: NameTexts): T {
    const key = thing.nameKey ?? keyFor(thing.name, candidates, texts);
    if (!key) return thing;
    const name = texts.text(key);
    return name === thing.name && key === thing.nameKey ? thing : { ...thing, name, nameKey: key };
}

/** The setup with every Senuma-given name in the current language. The same object when nothing changes. */
export function relocalize(s: AppState, texts: NameTexts): AppState {
    let changed = false;
    const spaces: Record<string, Space> = {};
    for (const [id, space] of Object.entries(s.spaces)) {
        const own = !space.templateId ? [] : space.templateId === 'imported' ? ['import.otherSpace'] : [`cat.${space.templateId}`];
        let next = named(space, own, texts);
        // Only groups in a catalog Space can be Senuma's. The Bookmarks Space's groups are the person's folder names.
        if (space.templateId && space.templateId !== 'imported') {
            const groups = next.groups.map((group): SpaceGroup => (group.name || group.nameKey ? named(group, GROUP_KEYS, texts) : group));
            if (groups.some((group, i) => group !== next.groups[i])) next = { ...next, groups };
        }
        if (next !== space) changed = true;
        spaces[id] = next;
    }
    const modes: Record<string, Mode> = {};
    for (const [id, mode] of Object.entries(s.modes)) {
        const next = named(mode, MODE_PRESETS.map(p => `modePreset.${p.key}`), texts);
        if (next !== mode) changed = true;
        modes[id] = next;
    }
    return changed ? { ...s, spaces, modes } : s;
}

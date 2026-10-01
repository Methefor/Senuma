import { THEMES, type Theme } from '../../core/themes';
import { t, type MessageKey } from '../../i18n';

/**
 * Each card is a miniature of the page painted with that theme's real tokens: backdrop and
 * glow, greeting type, the search field, Space plates and the dock. Choosing a theme is
 * choosing a place, not a colour.
 */
export function ThemePicker({ themeId, onPick, large = false }: { themeId: string; onPick: (id: string) => void; large?: boolean }) {
    return (
        <div class={`theme-grid ${large ? 'is-large' : ''}`} role="radiogroup">
            {THEMES.map((theme: Theme) => (
                <button type="button" key={theme.id} class="theme-card" role="radio" aria-checked={theme.id === themeId} onClick={() => onPick(theme.id)}>
                    <span class="theme-preview" style={theme.tokens} data-scheme={theme.scheme} aria-hidden="true">
                        <span class="theme-preview-title">Aa</span>
                        <span class="theme-preview-bar" />
                        <span class="theme-preview-plates"><i /><i /><i /></span>
                        <span class="theme-preview-dock"><i /><i /><i /></span>
                    </span>
                    <span class="theme-name">{theme.name}</span>
                    <span class="theme-mood">{t(`theme.${theme.id}` as MessageKey)}</span>
                </button>
            ))}
        </div>
    );
}

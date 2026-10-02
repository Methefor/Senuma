import type { AppState, LegacyRecord } from '../../core/types';
import { t } from '../../i18n';
import { setUi, update } from '../../storage/store';
import { Icon } from '../../ui/Icon';

function acknowledge(): void {
    update((s: AppState) => (s.legacy ? { ...s, legacy: { ...s.legacy, acknowledged: true } } : s));
}

/**
 * Shown once to people upgrading from New Tab Folders: that the product has a new name, and
 * what became of their setup, in numbers. It sits in a corner and blocks nothing — their page is already usable behind it.
 */
export function MigrationSummary({ legacy }: { legacy: LegacyRecord }) {
    const { spaces, links, groups, skipped } = legacy.summary;
    return (
        <aside class="migration" role="status" aria-label={t('migrate.title')}>
            <button type="button" class="icon-button is-small migration-close" aria-label={t('close')} title={t('close')} onClick={acknowledge}>
                <Icon name="x" size={14} />
            </button>
            <h2>{t('migrate.title')}</h2>
            <p class="migration-lede">{t('migrate.body')}</p>
            <ul>
                <li><Icon name="check" size={14} />{t('migrate.spaces', { n: spaces })}</li>
                <li><Icon name="check" size={14} />{t('migrate.links', { n: links })}</li>
                {groups > 0 && <li><Icon name="check" size={14} />{t('migrate.groups', { n: groups })}</li>}
                {skipped > 0 && <li class="is-muted"><Icon name="info" size={14} />{t('migrate.skipped', { n: skipped })}</li>}
            </ul>
            <p>{t('migrate.safe')}</p>
            <div class="migration-actions">
                <button type="button" class="button is-primary"
                    onClick={() => {
                        acknowledge();
                        setUi({ settings: 'spaces' });
                    }}>
                    {t('migrate.review')}
                </button>
                <button type="button" class="button" onClick={acknowledge}>{t('migrate.dismiss')}</button>
            </div>
        </aside>
    );
}

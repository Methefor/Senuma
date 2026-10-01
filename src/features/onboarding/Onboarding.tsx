import { useState } from 'preact/hooks';
import { setupNames } from '../../app/actions';
import { readBookmarks } from '../../browser/bookmarks';
import { CATEGORIES } from '../../core/catalog';
import { setPrefs } from '../../core/ops';
import { applyStarter, organize, type Proposal } from '../../core/setup';
import type { AppState, Language } from '../../core/types';
import { t, type MessageKey } from '../../i18n';
import { toast, update } from '../../storage/store';
import { Icon } from '../../ui/Icon';
import { Overlay } from '../../ui/Overlay';
import { ImportReview } from '../settings/ImportReview';
import { ThemePicker } from '../settings/Settings';

const STEPS = ['web', 'look', 'bring'] as const;

/** First run for new users: three short steps that end on a populated, personal Home. */
export function Onboarding({ state }: { state: AppState }) {
    const [step, setStep] = useState(0);
    const [picked, setPicked] = useState<string[]>([]);
    const [proposals, setProposals] = useState<Proposal[] | null>(null);

    const finish = () => update(s => ({ ...s, onboarded: true }));

    const toLook = () => {
        // Spaces are created as soon as interests are chosen, so the page behind fills in live.
        update(s => applyStarter(s, picked, setupNames()));
        setStep(1);
    };

    const importBookmarks = async () => {
        const result = await readBookmarks();
        if (!result.ok) return toast(t(`import.${result.reason}` as MessageKey));
        setProposals(organize(result.value));
    };

    const service = state.prefs.iconSource === 'service';

    return (
        <Overlay label={t('onboarding.title')} class="overlay-onboarding">
            <div class="onboarding">
                <div class="onboarding-top">
                    <ol class="steps" aria-label={t('onboarding.progress', { n: step + 1, total: STEPS.length })}>
                        {STEPS.map((id, index) => <li key={id} class={index <= step ? 'is-done' : ''} />)}
                    </ol>
                    <select class="quiet-select" aria-label={t('settings.language')} value={state.prefs.language}
                        onChange={event => update(s => setPrefs(s, { language: event.currentTarget.value as Language }))}>
                        <option value="en">English</option>
                        <option value="tr">Türkçe</option>
                    </select>
                </div>

                {step === 0 && (
                    <>
                        <p class="eyebrow">{t('onboarding.step.web')}</p>
                        <h2>{t('onboarding.interestsTitle')}</h2>
                        <p class="lede">{t('onboarding.interestsBody')}</p>
                        <div class="interest-grid">
                            {CATEGORIES.filter(c => c.onboarding !== false).map(category => {
                                const on = picked.includes(category.id);
                                return (
                                    <button type="button" key={category.id} class="interest" aria-pressed={on} style={{ '--tint': category.accent }}
                                        onClick={() => setPicked(on ? picked.filter(id => id !== category.id) : [...picked, category.id])}>
                                        <Icon name={category.glyph} size={20} />
                                        <span>{t(`cat.${category.id}` as MessageKey)}</span>
                                        {on && <span class="interest-check"><Icon name="check" size={14} /></span>}
                                    </button>
                                );
                            })}
                        </div>
                        <div class="form-actions">
                            <span class="note">{t('onboarding.editable')}</span>
                            <button type="button" class="button is-primary" disabled={!picked.length} onClick={toLook}>
                                {picked.length ? t('onboarding.createSpaces', { n: picked.length }) : t('onboarding.pickOne')}
                            </button>
                        </div>
                    </>
                )}

                {step === 1 && (
                    <>
                        <p class="eyebrow">{t('onboarding.step.look')}</p>
                        <h2>{t('onboarding.lookTitle')}</h2>
                        <p class="lede">{t('onboarding.lookBody')}</p>
                        <ThemePicker large themeId={state.prefs.themeId} onPick={id => update(s => setPrefs(s, { themeId: id }))} />
                        <label class="consent">
                            <input type="checkbox" checked={service}
                                onChange={() => update(s => setPrefs(s, { iconSource: service ? 'site' : 'service' }))} />
                            <span>
                                <strong>{t('onboarding.iconsTitle')}</strong>
                                <span>{t('onboarding.iconsBody')}</span>
                            </span>
                        </label>
                        <div class="form-actions">
                            <button type="button" class="button" onClick={() => setStep(0)}>{t('back')}</button>
                            <button type="button" class="button is-primary" autofocus onClick={() => setStep(2)}>{t('continue')}</button>
                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <p class="eyebrow">{t('onboarding.step.bring')}</p>
                        <h2>{t('onboarding.bringTitle')}</h2>
                        {proposals ? (
                            <>
                                <ImportReview proposals={proposals} onDone={finish} />
                                <div class="form-actions">
                                    <span class="note">{t('onboarding.privacy')}</span>
                                    <button type="button" class="button" onClick={finish}>{t('onboarding.skipImport')}</button>
                                </div>
                            </>
                        ) : (
                            <>
                                <p class="lede">{t('onboarding.bringBody')}</p>
                                <div class="choice-row">
                                    <button type="button" class="choice" onClick={() => void importBookmarks()}>
                                        <Icon name="download" size={18} />
                                        <strong>{t('import.bookmarks')}</strong>
                                        <span>{t('onboarding.importWhy')}</span>
                                    </button>
                                    <button type="button" class="choice" autofocus onClick={finish}>
                                        <Icon name="spark" size={18} />
                                        <strong>{t('onboarding.fresh')}</strong>
                                        <span>{t('onboarding.freshBody')}</span>
                                    </button>
                                </div>
                                <div class="form-actions">
                                    <button type="button" class="button" onClick={() => setStep(1)}>{t('back')}</button>
                                    <span class="note">{t('onboarding.privacy')}</span>
                                </div>
                            </>
                        )}
                    </>
                )}
            </div>
        </Overlay>
    );
}

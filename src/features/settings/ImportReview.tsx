import { useState } from 'preact/hooks';
import { setupNames } from '../../app/actions';
import { categoryById } from '../../core/catalog';
import { applyProposals, type Proposal } from '../../core/setup';
import { t, type MessageKey } from '../../i18n';
import { toast, update } from '../../storage/store';
import { Icon } from '../../ui/Icon';

const keyOf = (proposal: Proposal) => proposal.categoryId ?? 'other';

/** Shows what an import would create, lets the user choose, then applies it. */
export function ImportReview({ proposals, onDone }: { proposals: Proposal[]; onDone: () => void }) {
    const [chosen, setChosen] = useState(() => new Set(proposals.map(keyOf)));
    const selected = proposals.filter(p => chosen.has(keyOf(p)));
    const total = selected.reduce((sum, p) => sum + p.links.length, 0);

    if (!proposals.length) return <p class="note">{t('import.nothing')}</p>;

    return (
        <div class="review">
            <p class="note">{t('import.found')}</p>
            <ul class="review-list">
                {proposals.map(proposal => {
                    const key = keyOf(proposal);
                    const category = proposal.categoryId ? categoryById(proposal.categoryId) : undefined;
                    return (
                        <li key={key}>
                            <label class="check-row" style={{ '--tint': category?.accent }}>
                                <input type="checkbox" checked={chosen.has(key)}
                                    onChange={() => {
                                        const next = new Set(chosen);
                                        if (!next.delete(key)) next.add(key);
                                        setChosen(next);
                                    }} />
                                <span class="check-glyph"><Icon name={category?.glyph ?? 'folder'} size={16} /></span>
                                <span class="check-name">{proposal.categoryId ? t(`cat.${proposal.categoryId}` as MessageKey) : t('import.otherSpace')}</span>
                                <span class="check-count">{t('space.count', { n: proposal.links.length })}</span>
                            </label>
                        </li>
                    );
                })}
            </ul>
            <button type="button" class="button is-primary" disabled={!total}
                onClick={() => {
                    let added = 0;
                    update(s => {
                        const result = applyProposals(s, selected, setupNames());
                        added = result.added;
                        return result.state;
                    });
                    toast(t('import.done', { n: added }));
                    onDone();
                }}>
                {t('import.apply', { n: total })}
            </button>
        </div>
    );
}

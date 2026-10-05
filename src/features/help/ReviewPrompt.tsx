import { useState } from 'preact/hooks';
import { readLocal, writeLocal } from '../../browser/kv';
import { app } from '../../storage/store';
import { openFeedback } from './HelpSection';
import { answer, decide, REVIEW_KEY, REVIEW_URL, type ReviewAnswer, type ReviewRecord } from './review';
import { useHelpText } from './text';
import './help.css';

/** Decided once per tab: the card is either shown in this tab or not at all. */
let decision: boolean | undefined;

function decideOnce(): boolean {
    if (decision === undefined) {
        const { show, record } = decide(readLocal(REVIEW_KEY) as ReviewRecord | undefined, app.get(), Date.now());
        writeLocal(REVIEW_KEY, record);
        decision = show;
    }
    return decision;
}

/**
 * A quiet card on Home asking for a store review, with feedback offered beside it on equal
 * terms. It never covers anything, never takes focus, and remembers every answer.
 */
export function ReviewPrompt() {
    const text = useHelpText();
    const [open, setOpen] = useState(decideOnce);
    if (!open) return null;

    const close = (choice: ReviewAnswer) => {
        const record = readLocal(REVIEW_KEY) as ReviewRecord | undefined;
        if (record) writeLocal(REVIEW_KEY, answer(record, choice, Date.now()));
        decision = false;
        setOpen(false);
    };

    return (
        <aside class="review-card" aria-label={text('review.label')}>
            <strong>{text('review.title')}</strong>
            <p>{text('review.body')}</p>
            <div class="review-actions">
                <a class="button" href={REVIEW_URL} target="_blank" rel="noopener" onClick={() => close('review')}>{text('review.rate')}</a>
                <button type="button" class="button" onClick={() => {
                    close('feedback');
                    openFeedback('general');
                }}>{text('review.feedback')}</button>
                <button type="button" class="text-button" onClick={() => close('later')}>{text('review.later')}</button>
            </div>
        </aside>
    );
}

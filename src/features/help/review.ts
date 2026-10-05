/**
 * When to ask for a Chrome Web Store review. Rules (docs/HELP_FEEDBACK_SYSTEM.md):
 *
 * - never in the first week (counted from the first new tab that carries this code);
 * - only after real use: links opened from Senuma on several different days;
 * - the same neutral question for everyone: "Leave a review" and "Send feedback" side by side,
 *   no rating first, nobody filtered towards or away from the store;
 * - at most three times ever; "Not now" twice, or "Leave a review" once, and it never returns.
 *
 * No analytics or server-side tracking. Eligibility is calculated locally from existing on-device
 * activity: the list of recently opened links kept for Continue. No usage counter was added. The
 * card's own record (first seen, next date, times shown, times dismissed) only schedules it and
 * stays in this browser's local storage.
 */
import type { AppState } from '../../core/types';

export const REVIEW_KEY = 'bos.review';
export const DAY = 24 * 60 * 60 * 1000;

export const REVIEW_RULES = {
    firstAfterDays: 7,
    minOpens: 10,
    minActiveDays: 4,
    /** When the person has not used Senuma enough yet, look again after this long. */
    recheckDays: 2,
    /** After the card was shown (whatever happened next), wait at least this long. */
    afterShownDays: 30,
    afterDismissDays: 60,
    maxShown: 3,
    maxDismissed: 2,
} as const;

export interface ReviewRecord {
    firstSeen: number;
    next: number;
    shown: number;
    dismissed: number;
    done?: boolean;
}

export type ReviewAnswer = 'review' | 'feedback' | 'later';

/** Enough real use to have an opinion: links opened from Senuma, on several different days. */
export function meaningfulUse(state: AppState): boolean {
    const opens = state.recents.reduce((sum, recent) => sum + recent.count, 0);
    const days = new Set(state.recents.map(recent => new Date(recent.at).toDateString())).size;
    return opens >= REVIEW_RULES.minOpens && days >= REVIEW_RULES.minActiveDays && state.spaceOrder.length > 0;
}

/** Whether to show the card now, and the record to store either way. */
export function decide(record: ReviewRecord | undefined, state: AppState, now: number): { show: boolean; record: ReviewRecord } {
    if (!record || typeof record.next !== 'number') {
        return { show: false, record: { firstSeen: now, next: now + REVIEW_RULES.firstAfterDays * DAY, shown: 0, dismissed: 0 } };
    }
    if (record.done || now < record.next) return { show: false, record };
    if (!state.onboarded || !meaningfulUse(state)) return { show: false, record: { ...record, next: now + REVIEW_RULES.recheckDays * DAY } };
    const shown = record.shown + 1;
    return { show: true, record: { ...record, shown, next: now + REVIEW_RULES.afterShownDays * DAY, ...(shown >= REVIEW_RULES.maxShown ? { done: true } : {}) } };
}

export function answer(record: ReviewRecord, choice: ReviewAnswer, now: number): ReviewRecord {
    if (choice === 'review') return { ...record, done: true };
    const dismissed = record.dismissed + (choice === 'later' ? 1 : 0);
    return {
        ...record,
        dismissed,
        next: Math.max(record.next, now + REVIEW_RULES.afterDismissDays * DAY),
        ...(dismissed >= REVIEW_RULES.maxDismissed ? { done: true } : {}),
    };
}

/** The store page's review tab for the published extension. */
export const REVIEW_URL = 'https://chromewebstore.google.com/detail/oghlifenjhpbebcdeboejbmemelkfobe/reviews';

import { describe, expect, it } from 'vitest';
import { emptyState } from '../../core/defaults';
import type { AppState } from '../../core/types';
import { composeReport, describeBrowser, describeOs, mailtoUrl, type ReportInput } from './report';
import { answer, DAY, decide, REVIEW_RULES, type ReviewRecord } from './review';
import { HELP_EN, type HelpKey } from './strings-en';
import { HELP_TR } from './strings-tr';
import { helpText } from './text';

const NOW = Date.UTC(2026, 9, 20, 12);

/** A setup that has been used: `opens` link opens spread over `days` different days. */
function used(opens: number, days: number): AppState {
    const base = emptyState();
    const recents = Array.from({ length: opens }, (_, i) => ({ url: `https://example.com/${i}`, title: `x${i}`, at: NOW - (i % days) * DAY, count: 1 }));
    return { ...base, onboarded: true, spaceOrder: ['s'], recents };
}

describe('help strings', () => {
    it('Turkish has every key, nothing empty, the same {placeholders}', () => {
        for (const key of Object.keys(HELP_EN) as HelpKey[]) {
            expect(HELP_TR[key].trim()).not.toBe('');
            expect(HELP_TR[key].match(/\{\w+\}/g)).toEqual(HELP_EN[key].match(/\{\w+\}/g));
        }
        expect(Object.keys(HELP_TR).sort()).toEqual(Object.keys(HELP_EN).sort());
    });

    it('falls back to English for a language that has no help strings yet', () => {
        expect(helpText('fr' as never, 'review.rate')).toBe('Leave a review');
        expect(helpText('en', 'feedback.address', { email: 'a@b.c' })).toBe('Address: a@b.c');
    });
});

describe('review request', () => {
    const first = decide(undefined, used(30, 6), NOW).record;

    it('never asks in the first week, even with plenty of use', () => {
        expect(decide(undefined, used(30, 6), NOW).show).toBe(false);
        expect(decide(first, used(30, 6), NOW + 6 * DAY).show).toBe(false);
        expect(decide(first, used(30, 6), NOW + REVIEW_RULES.firstAfterDays * DAY).show).toBe(true);
    });

    it('asks only after real use on several days, then looks again later', () => {
        const at = NOW + 8 * DAY;
        const few = decide(first, used(4, 4), at);
        expect(few.show).toBe(false);
        expect(few.record.next).toBe(at + REVIEW_RULES.recheckDays * DAY);
        expect(decide(first, used(30, 1), at).show).toBe(false);
        expect(decide(first, { ...used(30, 6), onboarded: false }, at).show).toBe(false);
    });

    it('respects "Not now": waits, and after the second time never asks again', () => {
        let record: ReviewRecord = decide(first, used(30, 6), NOW + 8 * DAY).record;
        record = answer(record, 'later', NOW + 8 * DAY);
        expect(decide(record, used(30, 6), NOW + 30 * DAY).show).toBe(false);
        const again = decide(record, used(30, 6), NOW + 8 * DAY + REVIEW_RULES.afterDismissDays * DAY);
        expect(again.show).toBe(true);
        record = answer(again.record, 'later', NOW + 70 * DAY);
        expect(record.done).toBe(true);
        expect(decide(record, used(30, 6), NOW + 400 * DAY).show).toBe(false);
    });

    it('stops for good after a review, and after three showings at most', () => {
        const shown = decide(first, used(30, 6), NOW + 8 * DAY).record;
        expect(answer(shown, 'review', NOW).done).toBe(true);
        let record = first;
        let count = 0;
        for (let day = 8; day < 1000; day++) {
            const step = decide(record, used(30, 6), NOW + day * DAY);
            if (step.show) count++;
            record = step.record;
        }
        expect(count).toBe(REVIEW_RULES.maxShown);
    });
});

describe('feedback message', () => {
    const input: ReportInput = {
        kind: 'problem', description: 'Search goes to the wrong site\nmore detail', steps: '', includeTech: true,
        version: '2.0.1', language: 'tr', environment: { browser: 'Google Chrome 154.0', os: 'Windows 11' },
    };
    const text = (key: HelpKey) => HELP_EN[key];

    it('holds what the person wrote and, only if they agree, the technical lines', () => {
        const { subject, body } = composeReport(input, text);
        expect(subject).toBe('[Senuma 2.0.1] Problem report: Search goes to the wrong site');
        expect(body).toContain('Steps to reproduce:\n1. ');
        expect(body).toContain('Browser: Google Chrome 154.0');
        const without = composeReport({ ...input, includeTech: false }, text).body;
        expect(without).not.toMatch(/Chrome|Windows|2\.0\.1|Interface language/);
    });

    it('asks no reproduction steps for ideas and comments', () => {
        expect(composeReport({ ...input, kind: 'idea' }, text).body).not.toContain('Steps');
    });

    it('builds a mailto link with the text encoded and CRLF line breaks', () => {
        const url = mailtoUrl('x@y.z', 'A & B', 'line 1\nline 2');
        expect(url).toBe('mailto:x@y.z?subject=A%20%26%20B&body=line%201%0D%0Aline%202');
    });

    it('names the browser and system from what the browser reports', () => {
        const brands = [{ brand: 'Not)A;Brand', version: '8' }, { brand: 'Chromium', version: '154' }, { brand: 'Google Chrome', version: '154.0.1' }];
        expect(describeBrowser(brands, '')).toBe('Google Chrome 154.0.1');
        expect(describeBrowser(undefined, 'Mozilla/5.0 Chrome/150.0.1 Safari')).toBe('Chromium-based 150.0.1');
        expect(describeOs('Windows', '19.0.0', '')).toBe('Windows 11');
        expect(describeOs('Windows', '10.0.0', '')).toBe('Windows 10');
        expect(describeOs('macOS', '15.1.0', '')).toBe('macOS 15.1');
    });
});

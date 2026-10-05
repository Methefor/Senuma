import { useEffect, useState } from 'preact/hooks';
import { BRAND } from '../../brand';
import type { AppState } from '../../core/types';
import { currentLanguage, t } from '../../i18n';
import { setUi, toast } from '../../storage/store';
import { Icon } from '../../ui/Icon';
import { composeReport, detectEnvironment, FEEDBACK_ADDRESS, mailtoUrl, type Environment, type FeedbackKind } from './report';
import type { HelpKey } from './strings-en';
import { useHelpText, type HelpText } from './text';
import { guideUrl, type GuideTopic } from './topics';
import './help.css';

/** A feedback form asked for from elsewhere (the review card), opened when this section mounts. */
let requested: FeedbackKind | null = null;

/** Opens Settings → Help & Feedback, straight at a feedback form. */
export function openFeedback(kind: FeedbackKind): void {
    requested = kind;
    setUi({ settings: 'help', palette: false, menu: null });
}

const GUIDE_ROWS: [label: HelpKey, hint: HelpKey, topic?: GuideTopic][] = [
    ['help.guide', 'help.guideHint'],
    ['help.start', 'help.startHint', 'getting-started'],
    ['help.privacy', 'help.privacyHint', 'privacy'],
    ['help.backup', 'help.backupHint', 'import-export'],
];

const KINDS: [kind: FeedbackKind, glyph: string][] = [['problem', 'info'], ['idea', 'spark'], ['general', 'pen']];

function Feedback({ kind, state, text, onBack }: { kind: FeedbackKind; state: AppState; text: HelpText; onBack: () => void }) {
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState('');
    // Technical details help most with problems; for ideas and comments they start switched off.
    const [includeTech, setIncludeTech] = useState(kind === 'problem');
    const [environment, setEnvironment] = useState<Environment>({ browser: '…', os: '…' });
    useEffect(() => {
        void detectEnvironment().then(setEnvironment);
    }, []);

    const { subject, body } = composeReport(
        { kind, description, steps, includeTech, version: BRAND.displayVersion, language: state.prefs.language, environment },
        key => text(key),
    );
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(`${subject}\n\n${body}`);
            toast(text('feedback.copied'));
        } catch {
            // Without clipboard access the preview stays selectable.
        }
    };

    return (
        <form class="feedback-form" onSubmit={event => event.preventDefault()}>
            <h3>{text(`feedback.${kind}`)}</h3>
            <label class="field">
                <span>{text(`feedback.describe.${kind}`)}</span>
                <textarea rows={4} maxLength={1500} value={description} autofocus onInput={event => setDescription(event.currentTarget.value)} />
            </label>
            {kind === 'problem' && (
                <label class="field">
                    <span>{text('feedback.steps')}</span>
                    <textarea rows={3} maxLength={1000} value={steps} placeholder={'1. …\n2. …'} onInput={event => setSteps(event.currentTarget.value)} />
                </label>
            )}
            <label class="feedback-check">
                <input type="checkbox" checked={includeTech} onChange={event => setIncludeTech(event.currentTarget.checked)} />
                <span>{text('feedback.tech')}<em>{text('feedback.techHint')}</em></span>
            </label>
            <p class="note">{text('feedback.preview')}</p>
            <pre class="feedback-preview" tabIndex={0} aria-label={text('feedback.preview')}>{`${subject}\n\n${body}`}</pre>
            <p class="note">{text('feedback.private')}</p>
            <div class="feedback-actions">
                <a class={`button is-primary${description.trim() ? '' : ' is-disabled'}`} href={description.trim() ? mailtoUrl(FEEDBACK_ADDRESS, subject, body) : undefined}
                    aria-disabled={!description.trim()}>
                    <Icon name="external" size={15} />{text('feedback.email')}
                </a>
                <button type="button" class="button" disabled={!description.trim()} onClick={() => void copy()}>
                    <Icon name="copy" size={15} />{text('feedback.copy')}
                </button>
                <button type="button" class="text-button" onClick={onBack}>{t('back')}</button>
            </div>
            <p class="note feedback-address">{text('feedback.address', { email: FEEDBACK_ADDRESS })}</p>
        </form>
    );
}

/** Settings → Help & Feedback: the guide, a way to write to us, and About. */
export function HelpSection({ state }: { state: AppState }) {
    const text = useHelpText();
    const [kind, setKind] = useState<FeedbackKind | null>(requested);
    useEffect(() => {
        requested = null;
    }, []);
    const language = currentLanguage();

    if (kind) return <Feedback key={kind} kind={kind} state={state} text={text} onBack={() => setKind(null)} />;

    return (
        <>
            <h3>{text('section.help')}</h3>
            <p class="note">{text('help.intro')}</p>
            <ul class="help-list">
                {GUIDE_ROWS.map(([label, hint, topic]) => (
                    <li key={label}>
                        <a class="help-row" href={guideUrl(language, topic)} target="_blank" rel="noopener">
                            <span class="help-row-text"><strong>{text(label)}</strong><span>{text(hint)}</span></span>
                            <Icon name="external" size={15} /><span class="help-hidden">{text('help.newTab')}</span>
                        </a>
                    </li>
                ))}
                <li>
                    <button type="button" class="help-row" onClick={() => setUi({ settings: 'keyboard' })}>
                        <span class="help-row-text"><strong>{text('help.keys')}</strong><span>{text('help.keysHint')}</span></span>
                        <Icon name="keyboard" size={15} />
                    </button>
                </li>
            </ul>
            <h3>{text('section.feedback')}</h3>
            <div class="choice-row">
                {KINDS.map(([id, glyph]) => (
                    <button type="button" class="choice" key={id} onClick={() => setKind(id)}>
                        <Icon name={glyph} size={18} />
                        <strong>{text(`feedback.${id}`)}</strong>
                        <span>{text(`feedback.${id}Hint`)}</span>
                    </button>
                ))}
            </div>
            <ul class="help-list">
                <li>
                    <button type="button" class="help-row" onClick={() => setUi({ settings: 'about' })}>
                        <span class="help-row-text"><strong>{text('help.about')}</strong><span>{text('help.aboutHint')}</span></span>
                        <Icon name="globe" size={15} />
                    </button>
                </li>
            </ul>
        </>
    );
}

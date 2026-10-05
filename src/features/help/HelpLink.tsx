import { currentLanguage } from '../../i18n';
import type { HelpKey } from './strings-en';
import { useHelpText } from './text';
import { guideUrl, type GuideTopic } from './topics';
import './help.css';

/** A quiet "learn more" link to one section of the packaged guide, opened in a new tab. */
export function HelpLink({ topic, label }: { topic: GuideTopic; label: HelpKey }) {
    const text = useHelpText();
    return (
        <a class="help-link" href={guideUrl(currentLanguage(), topic)} target="_blank" rel="noopener">
            {text(label)}<span aria-hidden="true"> →</span><span class="help-hidden"> {text('help.newTab')}</span>
        </a>
    );
}

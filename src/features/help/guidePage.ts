/**
 * Build-time only (vite.config.ts): turns docs/guide/<lang>.md into the help page packaged with
 * the extension, so the guide works offline, needs no website and sends no request.
 *
 * Handles exactly the Markdown the guides use: headings, paragraphs, bold/italic/code, links,
 * lists with continuation lines, tables, fenced code and rules. Text is escaped first, so the
 * output is plain markup from the repository's own files; the page carries no script.
 */
import { GUIDE_TOPICS } from './topics';

export interface GuideChrome {
    lang: string;
    title: string;
    /** Link to the same guide in the other language. */
    other: { href: string; label: string; lang: string };
    top: string;
}

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** GitHub's heading anchor, which the guides' own table of contents links to. */
export function githubSlug(heading: string): string {
    return heading.trim().toLowerCase().replace(/̇/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
}

function inline(text: string, anchors: Map<string, string>): string {
    const codes: string[] = [];
    let out = escape(text).replace(/`([^`]+)`/g, (_, code: string) => `\u0000${codes.push(code) - 1}\u0000`);
    out = out
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
            if (href.startsWith('#')) {
                const target = anchors.get(decodeURIComponent(href.slice(1)));
                if (!target) throw new Error(`guide link to a missing section: ${href}`);
                return `<a href="#${target}">${label}</a>`;
            }
            if (!/^https:\/\//.test(href)) throw new Error(`guide link is not https: ${href}`);
            return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
        });
    return out.replace(/\u0000(\d+)\u0000/g, (_, n: string) => `<code>${codes[Number(n)]}</code>`);
}

/** The page body. Every `## n. Title` becomes a section whose id is GUIDE_TOPICS[n - 1]. */
export function guideBody(markdown: string): { html: string; sections: string[] } {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const anchors = new Map<string, string>();
    for (const line of lines) {
        const heading = /^## (\d+)\. (.+)$/.exec(line);
        if (!heading) continue;
        const topic = GUIDE_TOPICS[Number(heading[1]) - 1];
        if (!topic) throw new Error(`guide section ${heading[1]} has no topic id`);
        anchors.set(githubSlug(`${heading[1]}. ${heading[2]}`), topic);
    }

    const html: string[] = [];
    const sections: string[] = [];
    let paragraph: string[] = [];
    let list: { tag: 'ol' | 'ul'; items: string[] } | null = null;
    const endParagraph = () => {
        if (paragraph.length) html.push(`<p>${inline(paragraph.join(' '), anchors)}</p>`);
        paragraph = [];
    };
    const endList = () => {
        if (list) html.push(`<${list.tag}>${list.items.map(item => `<li>${inline(item, anchors)}</li>`).join('')}</${list.tag}>`);
        list = null;
    };
    const end = () => {
        endParagraph();
        endList();
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        if (!line.trim()) {
            end();
            continue;
        }
        if (line.startsWith('```')) {
            end();
            const code: string[] = [];
            while (++i < lines.length && !lines[i]!.startsWith('```')) code.push(lines[i]!);
            html.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
            continue;
        }
        const h2 = /^## (\d+)\. (.+)$/.exec(line);
        if (h2) {
            end();
            const topic = GUIDE_TOPICS[Number(h2[1]) - 1]!;
            sections.push(topic);
            html.push(`<h2 id="${topic}">${inline(`${h2[1]}. ${h2[2]}`, anchors)}</h2>`);
            continue;
        }
        if (/^#{1,3} /.test(line)) {
            end();
            const level = line.indexOf(' ');
            html.push(`<h${level}>${inline(line.slice(level + 1), anchors)}</h${level}>`);
            continue;
        }
        if (/^---+$/.test(line.trim())) {
            end();
            html.push('<hr>');
            continue;
        }
        if (line.startsWith('|')) {
            end();
            const rows: string[][] = [];
            for (; i < lines.length && lines[i]!.startsWith('|'); i++) rows.push(lines[i]!.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim()));
            i--;
            const [head, , ...body] = rows;
            html.push(`<table><thead><tr>${head!.map(cell => `<th>${inline(cell, anchors)}</th>`).join('')}</tr></thead><tbody>${
                body.map(row => `<tr>${row.map(cell => `<td>${inline(cell, anchors)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
            continue;
        }
        const item = /^(\d+\.|-) (.*)$/.exec(line);
        if (item) {
            endParagraph();
            const tag = item[1] === '-' ? 'ul' : 'ol';
            if (list && list.tag !== tag) endList();
            list ??= { tag, items: [] };
            list.items.push(item[2]!);
            continue;
        }
        if (list && /^\s+\S/.test(line)) {
            list.items[list.items.length - 1] += ` ${line.trim()}`;
            continue;
        }
        endList();
        // A line that is only a bold label ("**What it does**", an FAQ question) stands on its own.
        if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
            endParagraph();
            html.push(`<p class="label">${inline(line.trim(), anchors)}</p>`);
            continue;
        }
        paragraph.push(line.trim());
    }
    end();
    return { html: html.join('\n'), sections };
}

const STYLE = `
:root { color-scheme: light dark; --bg: #f7f7f5; --text: #1d1d22; --muted: #5d6070; --line: #dcdce2; --accent: #4b54d6; --code: #ececf0; }
@media (prefers-color-scheme: dark) { :root { --bg: #0e0f16; --text: #e9e9f0; --muted: #a2a5b8; --line: #2a2c3a; --accent: #9aa2ff; --code: #1d1f2b; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 32px 20px 96px; }
header { display: flex; justify-content: space-between; align-items: center; gap: 16px; max-width: 760px; margin: 0 auto; padding: 20px 20px 0; color: var(--muted); font-size: 14px; }
header strong { color: var(--text); font-size: 15px; }
h1 { font-size: 30px; line-height: 1.2; margin: 8px 0 12px; }
h2 { font-size: 22px; margin: 48px 0 8px; padding-top: 16px; border-top: 1px solid var(--line); scroll-margin-top: 12px; }
h2:target { color: var(--accent); }
p.label { margin: 18px 0 2px; }
a { color: var(--accent); text-underline-offset: 3px; }
code { background: var(--code); padding: 1px 5px; border-radius: 5px; font-size: .92em; }
pre { background: var(--code); padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
pre code { padding: 0; }
table { border-collapse: collapse; margin: 12px 0; font-size: 14.5px; display: block; overflow-x: auto; }
th, td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; vertical-align: top; }
hr { border: 0; border-top: 1px solid var(--line); margin: 28px 0; }
li { margin: 3px 0; }
.top { display: inline-block; margin-top: 40px; font-size: 14px; }
@media (max-width: 520px) { body { font-size: 15px; } h1 { font-size: 25px; } }
`;

export function guidePage(markdown: string, chrome: GuideChrome): string {
    const { html } = guideBody(markdown);
    return `<!doctype html>
<html lang="${chrome.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(chrome.title)}</title>
<style>${STYLE}</style>
</head>
<body id="top">
<header><strong>Senuma</strong><a href="${chrome.other.href}" lang="${chrome.other.lang}" hreflang="${chrome.other.lang}">${escape(chrome.other.label)}</a></header>
<main>
${html}
<a class="top" href="#top">${escape(chrome.top)}</a>
</main>
</body>
</html>
`;
}

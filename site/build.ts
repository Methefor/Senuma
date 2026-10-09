/**
 * The landing page: a static site in English and Turkish, built from site/content/<lang>.json,
 * one template and the same user guide the extension packages. No framework, no analytics, no
 * third-party request. Nothing here deploys anything.
 *
 *   npm run site:media   (once, or when the media changes: stills, loops, video → dist-site/assets)
 *   npm run site:build   (HTML, CSS, guide pages → dist-site/; the writing is done by site/cli.ts)
 *
 * Plan and copy rules: docs/LANDING_PLAN.md, docs/MESSAGING_SYSTEM.md (“Privacy claims”).
 */
import { readFileSync } from 'node:fs';
import { guidePage } from '../src/features/help/guidePage';

export const SITE_LANGUAGES = ['en', 'tr'] as const;
export type SiteLanguage = (typeof SITE_LANGUAGES)[number];
/** English lives at the root; every other language in its own folder. */
const DEFAULT_LANGUAGE: SiteLanguage = 'en';

export const STORE_URL = 'https://chromewebstore.google.com/detail/oghlifenjhpbebcdeboejbmemelkfobe';
export const PRIVACY_URL = 'https://methefor.github.io/Senuma/privacy.html';
/** The temporary support contact (docs/STORE_LISTING.md), the same address the product shows. */
export const FEEDBACK_ADDRESS = 'rumeliskelesi+senuma@gmail.com';

interface Feature {
    id: string; kicker: string; title: string; body: string; points: string[]; media: string; still: string; alt: string;
    example?: { code: string; text: string };
}
export interface Content {
    lang: SiteLanguage; langName: string; title: string; metaDescription: string;
    nav: Record<'features' | 'privacy' | 'guide' | 'faq' | 'cta' | 'skip' | 'menu', string>;
    hero: { eyebrow: string; title: string; sub: string; cta: string; trust: string[]; alt: string };
    demo: { title: string; sub: string; play: string; description: string };
    features: Feature[];
    privacy: { kicker: string; title: string; body: string; facts: { title: string; text: string }[]; alt: string; policy: string };
    guide: { kicker: string; title: string; body: string; cards: { title: string; text: string; anchor: string }[]; all: string };
    feedback: { kicker: string; title: string; body: string; cards: { title: string; text: string; subject: string }[]; address: string };
    faq: { kicker: string; title: string; items: { q: string; a: string }[] };
    final: { title: string; sub: string; cta: string };
    footer: Record<'privacy' | 'guide' | 'feedback' | 'previously' | 'note', string>;
}

/** The sections, in page order. Their ids are the anchors and are the same in every language. */
export const SECTIONS = ['top', 'demo', 'spaces', 'search', 'command', 'modes', 'customization', 'privacy', 'guide', 'feedback', 'faq', 'get'] as const;

const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const e = escape;

export function loadContent(lang: SiteLanguage): Content {
    return JSON.parse(readFileSync(`site/content/${lang}.json`, 'utf8')) as Content;
}

/** Where a language's pages live, and how they reach the shared files. */
const folder = (lang: SiteLanguage) => (lang === DEFAULT_LANGUAGE ? '' : `${lang}/`);
const up = (lang: SiteLanguage) => (lang === DEFAULT_LANGUAGE ? '' : '../');
const storeLink = (lang: SiteLanguage, place: string) => `${STORE_URL}?utm_source=landing&amp;utm_medium=${lang}&amp;utm_campaign=${place}`;

/** A looping clip of the real product; people who ask for less motion get the still instead. */
function media(feature: Feature, root: string): string {
    return `<picture>
          <source media="(prefers-reduced-motion: reduce)" srcset="${root}assets/${feature.still}.webp">
          <img src="${root}assets/${feature.media}.webp" width="960" height="600" loading="lazy" decoding="async" alt="${e(feature.alt)}">
        </picture>`;
}

export function landingPage(c: Content): string {
    const root = up(c.lang);
    const others = SITE_LANGUAGES.filter(lang => lang !== c.lang);
    const guide = `${root}${folder(c.lang)}guide/`;
    const cta = (place: string, label: string) => `<a class="cta" href="${storeLink(c.lang, place)}" rel="noopener">${e(label)}</a>`;
    const names: Record<SiteLanguage, string> = { en: 'English', tr: 'Türkçe' };

    return `<!doctype html>
<html lang="${c.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(c.title)}</title>
<meta name="description" content="${e(c.metaDescription)}">
<meta name="color-scheme" content="dark">
<meta property="og:type" content="website">
<meta property="og:title" content="${e(c.title)}">
<meta property="og:description" content="${e(c.metaDescription)}">
<meta property="og:image" content="${root}assets/og.png">
<meta name="twitter:card" content="summary_large_image">
${SITE_LANGUAGES.map(lang => `<link rel="alternate" hreflang="${lang}" href="${root}${folder(lang)}">`).join('\n')}
<link rel="icon" href="${root}assets/icon.png">
<link rel="stylesheet" href="${root}styles.css">
</head>
<body>
<a class="skip" href="#main">${e(c.nav.skip)}</a>
<header class="bar">
  <a class="brand" href="#top"><img src="${root}assets/icon.png" width="28" height="28" alt=""><span>Senuma</span></a>
  <nav aria-label="${e(c.nav.menu)}">
    <a href="#spaces">${e(c.nav.features)}</a>
    <a href="#privacy">${e(c.nav.privacy)}</a>
    <a href="#guide">${e(c.nav.guide)}</a>
    <a href="#faq">${e(c.nav.faq)}</a>
  </nav>
  <div class="bar-end">
    ${others.map(lang => `<a class="lang" href="${root}${folder(lang)}" lang="${lang}" hreflang="${lang}">${names[lang]}</a>`).join('')}
    ${cta('header', c.nav.cta)}
  </div>
</header>

<main id="main">
<section class="hero" id="top">
  <p class="eyebrow">${e(c.hero.eyebrow)}</p>
  <h1>${e(c.hero.title)}</h1>
  <p class="lede">${e(c.hero.sub)}</p>
  <div class="actions">${cta('hero', c.hero.cta)}</div>
  <ul class="trust">${c.hero.trust.map(item => `<li>${e(item)}</li>`).join('')}</ul>
  <figure class="frame frame-hero"><img src="${root}assets/home.webp" width="1280" height="800" fetchpriority="high" alt="${e(c.hero.alt)}"></figure>
</section>

<section class="band" id="demo">
  <div class="head">
    <h2>${e(c.demo.title)}</h2>
    <p>${e(c.demo.sub)}</p>
  </div>
  <figure class="frame">
    <video controls muted playsinline preload="none" width="1920" height="1080" poster="${root}assets/poster-home.webp" aria-label="${e(c.demo.play)}">
      <source src="${root}assets/senuma-demo.webm" type="video/webm">
      <source src="${root}assets/senuma-demo.mp4" type="video/mp4">
    </video>
    <figcaption>${e(c.demo.description)}</figcaption>
  </figure>
</section>

${c.features.map((feature, index) => `<section class="feature${index % 2 ? ' is-flipped' : ''}" id="${feature.id}">
  <div class="copy">
    <p class="kicker">${e(feature.kicker)}</p>
    <h2>${e(feature.title)}</h2>
    <p>${e(feature.body)}</p>
    ${feature.example ? `<p class="example"><code>${e(feature.example.code)}</code> ${e(feature.example.text)}</p>` : ''}
    <ul class="points">${feature.points.map(point => `<li>${e(point)}</li>`).join('')}</ul>
  </div>
  <figure class="frame">
        ${media(feature, root)}
  </figure>
</section>`).join('\n\n')}

<section class="band privacy" id="privacy">
  <div class="head">
    <p class="kicker">${e(c.privacy.kicker)}</p>
    <h2>${e(c.privacy.title)}</h2>
    <p>${e(c.privacy.body)}</p>
  </div>
  <div class="privacy-grid">
    <dl class="facts">${c.privacy.facts.map(fact => `<div><dt>${e(fact.title)}</dt><dd>${e(fact.text)}</dd></div>`).join('')}</dl>
    <figure class="frame"><img src="${root}assets/privacy.webp" width="1280" height="800" loading="lazy" decoding="async" alt="${e(c.privacy.alt)}"></figure>
  </div>
  <p class="more"><a href="${PRIVACY_URL}" rel="noopener">${e(c.privacy.policy)} →</a></p>
</section>

<section class="band" id="guide">
  <div class="head">
    <p class="kicker">${e(c.guide.kicker)}</p>
    <h2>${e(c.guide.title)}</h2>
    <p>${e(c.guide.body)}</p>
  </div>
  <div class="cards">${c.guide.cards.map(card => `<a class="card" href="${guide}#${card.anchor}"><strong>${e(card.title)}</strong><span>${e(card.text)}</span></a>`).join('')}</div>
  <p class="more"><a href="${guide}">${e(c.guide.all)} →</a></p>
</section>

<section class="band" id="feedback">
  <div class="head">
    <p class="kicker">${e(c.feedback.kicker)}</p>
    <h2>${e(c.feedback.title)}</h2>
    <p>${e(c.feedback.body)}</p>
  </div>
  <div class="cards">${c.feedback.cards.map(card => `<a class="card" href="mailto:${FEEDBACK_ADDRESS}?subject=${encodeURIComponent(card.subject)}"><strong>${e(card.title)}</strong><span>${e(card.text)}</span></a>`).join('')}</div>
  <p class="more">${e(c.feedback.address)} <a href="mailto:${FEEDBACK_ADDRESS}">${FEEDBACK_ADDRESS}</a></p>
</section>

<section class="band" id="faq">
  <div class="head">
    <p class="kicker">${e(c.faq.kicker)}</p>
    <h2>${e(c.faq.title)}</h2>
  </div>
  <div class="faq">${c.faq.items.map(item => `<details><summary>${e(item.q)}</summary><p>${e(item.a)}</p></details>`).join('')}</div>
</section>

<section class="final" id="get">
  <h2>${e(c.final.title)}</h2>
  <p>${e(c.final.sub)}</p>
  <div class="actions">${cta('final', c.final.cta)}</div>
  <ul class="trust">${c.hero.trust.map(item => `<li>${e(item)}</li>`).join('')}</ul>
</section>
</main>

<footer class="foot">
  <div class="foot-links">
    <a href="${PRIVACY_URL}" rel="noopener">${e(c.footer.privacy)}</a>
    <a href="${guide}">${e(c.footer.guide)}</a>
    <a href="#feedback">${e(c.footer.feedback)}</a>
    ${others.map(lang => `<a href="${root}${folder(lang)}" lang="${lang}" hreflang="${lang}">${names[lang]}</a>`).join('')}
  </div>
  <p>${e(c.footer.previously)} ${e(c.footer.note)}</p>
</footer>
<script src="${root}site.js" defer></script>
</body>
</html>
`;
}

/** The guide on the site: the packaged guide's own page, with links home and to the other language. */
function siteGuide(lang: SiteLanguage, title: string, top: string): string {
    const other = SITE_LANGUAGES.find(candidate => candidate !== lang)!;
    const names: Record<SiteLanguage, string> = { en: 'English', tr: 'Türkçe' };
    // From <lang>/guide/ to the other language's guide.
    const toRoot = lang === DEFAULT_LANGUAGE ? '../' : '../../';
    const page = guidePage(readFileSync(`docs/guide/${lang}.md`, 'utf8'), {
        lang, title, top, other: { href: `${toRoot}${folder(other)}guide/`, label: names[other], lang: other },
    });
    return page.replace('<header><strong>Senuma</strong>', `<header><a href="${toRoot}${folder(lang)}" style="color:inherit;text-decoration:none"><strong>Senuma</strong></a>`);
}

const GUIDE_WORDS: Record<SiteLanguage, { title: string; top: string }> = {
    en: { title: 'Senuma User Guide', top: 'Back to top' },
    tr: { title: 'Senuma Kullanım Kılavuzu', top: 'Başa dön' },
};

/** Plays the demo video only while it is on screen. The only script on the site. */
const SITE_JS = `(() => {
  const video = document.querySelector('video');
  if (!video || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(entries => {
    for (const entry of entries) if (!entry.isIntersecting && !video.paused) video.pause();
  }, { threshold: 0.2 }).observe(video);
})();
`;

/** Every generated text file, keyed by its path inside dist-site/. Media files come from site/media.py. */
export function buildSite(): Record<string, string> {
    const files: Record<string, string> = {
        'styles.css': readFileSync('site/styles.css', 'utf8'),
        'site.js': SITE_JS,
        // Never indexed from a local or preview copy; the real robots file is written at deploy time, by a person.
        'robots.txt': 'User-agent: *\nDisallow: /\n',
    };
    for (const lang of SITE_LANGUAGES) {
        files[`${folder(lang)}index.html`] = landingPage(loadContent(lang));
        files[`${folder(lang)}guide/index.html`] = siteGuide(lang, GUIDE_WORDS[lang].title, GUIDE_WORDS[lang].top);
    }
    return files;
}

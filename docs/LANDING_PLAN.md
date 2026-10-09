# Landing page plan

Plan and copy deck. **Built locally on 2026-10-09 (`site/`, § 8); not deployed, nothing bought.** Copy comes from
MESSAGING_SYSTEM.md (change a line there first); assets from MEDIA_PLAN.md; privacy claims only
as allowed in MESSAGING_SYSTEM.md (“Privacy claims”).

Positioning: **Senuma — Personal Browser Workspace.**
Core combination: Organization + Search + Modes + Customization + Privacy.

## 1. Page architecture

One long page per language plus the guide. Each section: one headline, one or two sentences, one
real visual. Order follows “reason to try → reason to stay → reason to trust → how to start”.

| # | Section | Job | Headline (EN) | Başlık (TR) | Visual |
|---|---|---|---|---|---|
| 1 | Hero | say what it is in 5 seconds | Make the browser yours. | Tarayıcını kendine göre yap. | screenshot-1-home (still), CTA |
| 2 | Product demo | show it is real | See it in 30 seconds. | 30 saniyede gör. | senuma-28s-silent (mp4 + webm), poster-home |
| 3 | Spaces | organization | Everything you use, organized. | Kullandığın her şey, düzenli. | gif-1 / screenshot-2-spaces |
| 4 | Search + shortcuts | speed | One search bar. Your rules. | Tek arama çubuğu. Senin kuralların. | gif-3 / screenshot-3-search |
| 5 | Command center | keyboard | Everything, one shortcut away. | Her şey tek kısayol uzağında. | gif-2 |
| 6 | Modes | contexts | A workspace for every mode. | Her hâl için bir çalışma alanı. | gif-5 / screenshot-5-modes |
| 7 | Customization | make it yours | Make every new tab feel like yours. | Her yeni sekme sana ait hissettirsin. | gif-4 / screenshot-4-customize |
| 8 | Privacy | trust | Personal by design. | Doğası gereği kişisel. | extra-privacy (real Settings → Privacy) |
| 9 | Guide / Help | lower the first-use barrier | Learn it in five minutes. | Beş dakikada öğren. | three guide cards (text) |
| 10 | Feedback | open door | Tell us what to fix or build. | Neyi düzeltelim, neyi ekleyelim? | three cards (text) |
| 11 | FAQ | objections | Questions | Sorular | text |
| 12 | Final CTA | install | Your place on the web. | Web’deki yerin. | poster-endcard style, CTA |

Sticky header: wordmark · Features · Privacy · Guide · EN/TR · **Add to Chrome**.
Footer: privacy policy, guide, feedback address, “Previously New Tab Folders”, language switch.

## 2. Copy deck (EN / TR)

**Hero**

| | English | Türkçe |
|---|---|---|
| Eyebrow | Senuma — Personal Browser Workspace | Senuma — Kişisel Tarayıcı Çalışma Alanı |
| H1 | Make the browser yours. | Tarayıcını kendine göre yap. |
| Sub | Senuma turns every new tab into your own workspace: the sites you use, gathered into Spaces, with one search bar and a look that is yours. | Senuma her yeni sekmeyi kendi çalışma alanına çevirir: kullandığın siteler Alanlarda toplanır; tek bir arama çubuğu ve sana ait bir görünüm. |
| CTA | Add to Chrome — free | Chrome’a ekle — ücretsiz |
| Under CTA | Free. No Senuma account. No analytics. | Ücretsiz. Senuma hesabı yok. Analitik yok. |

**Sections 3–7:** the “Medium” line of each feature in MESSAGING_SYSTEM.md § 2 as the paragraph, the
“Short” line as the headline, both languages already written there. Section 4 adds the literal
example `y lofi mix`.

**Privacy (section 8)**

| English | Türkçe |
|---|---|
| No Senuma account. | Senuma hesabı yok. |
| No analytics. | Analitik yok. |
| No Senuma cloud required in this release: your workspace stays in your browser. | Bu sürümde Senuma bulutu gerekmez: çalışma alanın tarayıcında kalır. |
| Searches go to the search engine you choose. Site icons come from the sites themselves, or from Google’s icon service if you pick it, or not at all with Letters only. | Aramalar seçtiğin arama motoruna gider. Site simgeleri sitelerin kendisinden, seçersen Google’ın simge servisinden gelir; “Yalnızca harfler” ile hiç istenmez. |
| Bookmarks and recently closed pages are read only if you turn those features on. | Yer imleri ve az önce kapatılan sayfalar yalnızca o özellikleri açarsan okunur. |
| Read the privacy policy → | Gizlilik politikasını oku → |

No sentence on the page says or implies that Senuma makes no network requests.

**Guide (section 9):** three cards: Getting Started · Search shortcuts · Backgrounds & Modes
(TR: Başlarken · Arama kısayolları · Arka planlar ve Modlar), then “Read the full guide →”.

**Feedback (section 10):** Report a problem · Suggest an idea · Share feedback (TR: Sorun bildir ·
Fikir öner · Geri bildirim gönder). Each is a `mailto:` link with a prepared subject, plus the
address in text. No form, no backend.

**FAQ (section 11)** — answers reuse guide § 26:

| Question (EN / TR) | Answer source |
|---|---|
| Is Senuma free? / Senuma ücretsiz mi? | Yes; nothing is gated. |
| Do I need an account? / Hesap gerekiyor mu? | No. |
| Where is my data? / Verilerim nerede? | In your browser; export a backup file to move it (guide § 21). |
| Does it sync between computers? / Bilgisayarlar arasında eşitleniyor mu? | Not in this release; use Export and Import. |
| What does Senuma send over the network? / Senuma ağ üzerinden ne gönderir? | Your searches to the engine you choose; icon requests to sites (or Google’s icon service if selected). Nothing about your workspace is sent to us. |
| Why does it ask for permissions? / Neden izin istiyor? | storage and search only; bookmarks and recently closed tabs are optional and asked when you use them (guide § 23). |
| Which browsers? / Hangi tarayıcılar? | Chrome; also loads in Edge and Brave (Chromium). State only what was tested. |
| Is it in Turkish? / Türkçe mi? | Yes, interface and guide. |
| I used New Tab Folders. / New Tab Folders kullanıyordum. | Same extension; your folders became Spaces and your data is kept. |
| How do I report a problem? / Sorunu nasıl bildiririm? | Settings → Help & Feedback, or the address below. |

**Final CTA:** “Your place on the web.” + Add to Chrome + the three trust facts.

## 3. Visual direction

Premium, cinematic, product-led. The page should feel like the product: dark, warm, calm.

- **Palette:** from the product's own themes (the default dark base `#090b16`, warm accent from the
  Atelier theme); one accent colour; no rainbow or generic SaaS gradients. A light variant via
  `prefers-color-scheme` only if it stays as considered as the dark one.
- **Typography:** one family (the system UI stack the product uses, or one self-hosted variable
  font); large, tight headlines; body 17–18 px; generous line height. No more than three sizes
  per screen.
- **Imagery:** only real Senuma UI: the store screenshots at full width inside a quiet browser
  frame (no fake chrome with fake addresses), GIF/video loops that start when in view and pause
  when out; `prefers-reduced-motion` shows stills.
- **Layout:** strong whitespace; max content width ~1120 px; alternating text/visual rows for
  sections 3–7; the visual is always larger than the text block.
- **Motion:** fade/slide of 200–300 ms on entry, nothing looping except product footage.
- **No:** stock photos, giant logo blocks, invented UI, counters, testimonials, ratings, “trusted
  by” rows, competitor names, speed claims.
- **Responsive:** single column under 820 px; videos become posters with a play button; tap targets
  ≥ 44 px; the CTA stays reachable (sticky bottom bar on phones saying “Send to my computer” is
  **not** built; phones just get the store link).
- **Performance:** hero is a still image (WebP/AVIF from screenshot-1-home, ≤ 200 kB); video and
  GIFs lazy-loaded; target < 1.5 MB before any video plays; no analytics, no third-party scripts,
  no web fonts from a CDN.
- **Accessibility:** contrast AA, real headings, alt text describing the UI shown, captions not
  needed (silent video) but a text description under it.

## 4. Asset map

| Asset (release/Senuma-2.0.1-media, release/Senuma-launch-media) | Section | Status |
|---|---|---|
| screenshot-1-home.png | 1 Hero | ready; export a WebP/AVIF copy at build |
| senuma-28s-silent.mp4 / .webm + poster-home.png | 2 Demo | ready (MP4 made 2026-10-05; a lighter web encode is worth making at build) |
| gif-1 create Space / screenshot-2-spaces | 3 Spaces | ready; convert the GIF to a short MP4/WebM loop for weight |
| gif-3 / screenshot-3-search | 4 Search | ready |
| gif-2 | 5 Command center | ready |
| gif-5 / screenshot-5-modes | 6 Modes | ready |
| gif-4 / screenshot-4-customize | 7 Customization | ready (3.6 MB GIF → video loop) |
| extra-privacy.png | 8 Privacy | ready |
| extra-themes, extra-customize-pickers, extra-command-center, extra-search-box | supporting stills | ready |
| icon-128, wordmark | header, favicon | ready (SVG wordmark from src/ui/BrandMark) |
| hero-1400x560, tile-440x280 | social preview (Open Graph) | ready; OG image 1200×630 must be cropped from the hero |
| poster-endcard.png | 12 Final CTA backdrop | ready |

**Needs new capture (genuinely):**

1. Turkish screenshots for the `/tr/` page (Home, Spaces, Search, Customize, Modes): the existing
   set is English. `npm run store:assets` with the Turkish interface.
2. Help & Feedback (2.0.2) screenshot for section 9/10, once 2.0.2 is the public version.
3. Open Graph image 1200×630 (a crop, not a capture).

Nothing else: the existing set covers every section.

## 5. Turkish mirror and future locales

- URLs: `/` (English, default), `/tr/`. Same sections, same order, same assets except the Turkish
  screenshots. `<html lang>`, `hreflang` alternates and a visible EN/TR switch that keeps the
  section anchor.
- One content file per language (`content/en.json`, `content/tr.json`) feeding one template; the
  keys are the section ids above. A new locale (`es`, `fr`, then `de`, `pt`) is one more content
  file, one guide file and, if wanted, its screenshots. No Spanish/French/German/Portuguese copy
  is written now (LOCALIZATION_ROADMAP.md).
- The store button always points at the same listing with `?utm_source=landing&utm_medium=<lang>`.

## 6. Guide on the site

`/guide/` and `/tr/guide/` are generated from the same `docs/guide/<lang>.md` that the extension
packages (the converter in src/features/help/guidePage.ts already produces a standalone page with
stable anchors). Deep links used by the landing page: `#getting-started`, `#search-shortcuts`,
`#backgrounds`, `#modes`, `#privacy`, `#import-export`. One source, three outputs (extension,
site, GitHub). Details: HELP_FEEDBACK_SYSTEM.md § 8.

## 7. Implementation plan (when approved)

| Step | What | Notes |
|---|---|---|
| 1 | Static site in `site/` (plain HTML + CSS, one small script for lazy video and language switch) | no framework, no build service; Vite can emit it from the content files |
| 2 | Content files EN/TR from this deck | copy stays traceable to MESSAGING_SYSTEM.md |
| 3 | Guide pages from `docs/guide` | reuse `guidePage()` |
| 4 | Asset pipeline: WebP/AVIF stills, MP4+WebM loops, OG image | scripts/media-mp4.mjs for MP4 |
| 5 | Checks: links, alt text, no third-party requests, weight budget, both languages have every key | a small test like the help strings parity test |
| 6 | Host | GitHub Pages on the existing repo (`methefor.github.io/Senuma`, where the privacy policy already is): free. A domain is a later, separate decision |
| 7 | Launch gate | owner approval; 2.0.x live in the store so the CTA works; privacy-claims review of every line |

Open decisions for the owner: approve building it; GitHub Pages vs waiting for a domain; whether
the page goes live before or after 2.0.2 is public.

## 8. Built (2026-10-09, local only)

| | |
|---|---|
| Source | `site/content/en.json`, `site/content/tr.json` (copy), `site/build.ts` (template), `site/styles.css`, `site/media.py` (media), `site/site.test.ts` (checks) |
| Build | `npm run site:media` (once; needs the hand-off media folder and Pillow), then `npm run site:build` → `dist-site/` (git-ignored) |
| Pages | `/`, `/tr/`, `/guide/`, `/tr/guide/` (the guide pages come from `docs/guide/*.md` through the extension's own converter) |
| Weight | HTML 13–14 kB per language, CSS 8 kB, script 0.3 kB; hero image 47 kB; loops 61–519 kB each (animated WebP made from the product GIFs, caption bar removed); demo video 11.5 MB WebM / 9.6 MB MP4, loaded only when played |
| Requests to other hosts | none (checked in the browser and by test); no analytics, no web fonts |
| Indexing | `robots.txt` disallows everything until someone deploys on purpose |

What differs from the plan above: stills are the uncaptioned raw captures (the store screenshots
carry their own captions and frame, which repeated the page's headlines); GIFs became animated
WebP instead of video loops (one tool, about 85 % smaller than the GIFs).

Known gaps before it can go live: the screenshots, loops and video show the **English** interface
on the Turkish page too (Turkish captures are still to be made; the Turkish page says so under
the video); the FAQ and guide mention Help & Feedback, which is public only from 2.0.2; the store
button leads to a listing that serves the previous version until 2.0.0 passes review; the real
`robots.txt`, canonical URLs and an absolute link-preview image URL need the final address.

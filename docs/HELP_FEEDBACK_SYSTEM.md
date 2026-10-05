# Help, feedback and review request

Built on branch `senuma-help-growth` (from the frozen 2.0.1 release candidate `5ed7cec`, which is
unchanged). Not released, not submitted. The next store update carries it once the owner approves.

Companion documents: HELP_CENTER.md (a future help website), MESSAGING_SYSTEM.md (wording),
GROWTH_STRATEGY.md (how help and feedback feed growth).

## 1. In-product help

### 1.1 Where help lives

The user guide (guide/en.md, guide/tr.md) is packaged with the extension as two static pages,
`help/en.html` and `help/tr.html`, generated at build time (src/features/help/guidePage.ts).

- Opens in a new tab from the extension itself: works offline, no website, no domain, no request.
- No script on the page; the text is escaped from the repository's own Markdown.
- One anchor per guide section, **the same id in every language** (src/features/help/topics.ts:
  `search-shortcuts`, `privacy`, …), so a contextual link is never translated.
- A language without its own guide falls back to the English page.
- The build fails if a guide link points at a section that does not exist (unit test).
- Size: 67 kB on disk for both pages (own budget line, 96 kB).

The future help website (HELP_CENTER.md) can be cut from the same Markdown later. Nothing in the
product depends on it.

### 1.2 Settings → Help & Feedback

| English | Türkçe | Opens |
|---|---|---|
| User Guide | Kullanım Kılavuzu | the guide, top |
| Getting Started | Başlarken | guide § 1 `#getting-started` |
| Privacy & Permissions | Gizlilik ve İzinler | guide § 23 `#privacy` |
| Import & Backup | İçe Aktarma ve Yedekleme | guide § 21 `#import-export` |
| Keyboard Shortcuts | Klavye Kısayolları | Settings → Keyboard (in place) |
| Report a problem | Sorun bildir | feedback form (problem) |
| Suggest an idea | Fikir öner | feedback form (idea) |
| Share feedback | Geri bildirim gönder | feedback form (general) |
| About Senuma | Senuma Hakkında | Settings → About (in place) |

The section is also reachable from the command center: Ctrl+K → “help” → **Open Settings: Help &
Feedback**, because every Settings section is a command.

### 1.3 Contextual help (implemented)

One quiet link where the question arises, never a tooltip, never a pop-up:

| Place | Link text (EN / TR) | Guide section |
|---|---|---|
| Settings → Search, under the Shortcuts hint | Learn more about search shortcuts → / Arama kısayolları hakkında daha fazlası → | `#search-shortcuts` |
| Customize → Background, under the picture adjustments | Learn about Fill, Fit, Position, Blur and Atmosphere → / Doldur, Sığdır, Konum, Bulanıklık ve Atmosfer hakkında → | `#backgrounds` |
| Settings → Privacy, under “Include recently closed tabs” | Why does Senuma need this permission? → / Senuma bu izne neden ihtiyaç duyar? → | `#privacy` |
| Settings → Data, under Restore points | How backups and restore points work → / Yedekler ve geri yükleme noktaları nasıl çalışır → | `#import-export` |

Deliberately not added: a link in the search box (its placeholder already teaches “y lofi mix”
once, and a link there would clutter Home), help icons on Home, an onboarding tour.

Candidates for later, only if feedback shows the question: Settings → Modes intro (`#modes`),
Data → Paste a list of links (`#import-links`), Space suggestions (`#spaces`).

## 2. Localization architecture

Languages now: English, Turkish. Planned: French, Spanish, German, Portuguese, then others.
Nothing beyond EN/TR is translated now.

### 2.1 How text is organised

| Layer | Where | Loaded | Adding a language |
|---|---|---|---|
| Core interface | src/i18n/en.ts (startup), tr.ts (lazy pack) | English always, others on demand | one file `<lang>.ts` + one loader line in i18n/index.ts + `Language` type |
| Help, feedback, review | src/features/help/strings-en.ts, strings-tr.ts | with the help chunk; Turkish only for Turkish | one `strings-<lang>.ts` typed `HelpStrings` + one loader line in help/text.ts |
| Guide pages | docs/guide/<lang>.md → help/<lang>.html | opened on demand | one Markdown file + one entry in vite.config.ts `GUIDE_CHROME` + topics.ts `GUIDE_PAGES` |
| Store listing | STORE_LISTING.md (English only) | — | needs `_locales` (§ 2.3) |

Rules (enforced where possible):

- Every new user-facing string has a stable key; the English file is the source of truth for keys.
- A translation file must have every key (the compiler checks `HelpStrings`; a unit test checks
  that placeholders such as `{email}` match and nothing is empty).
- Missing language → English, never a key name on screen.
- Feature-scoped dictionaries for features that load on demand, so their words load with them
  (the startup bundle is at 43.8 of 44 kB).
- Guide anchors are language-neutral ids, so links survive translation.
- **Content people create is never translated.** Only names Senuma gave (they carry a `nameKey`,
  2.0.1) follow the language; anything typed by a person stays exactly as typed.
- Command phrases (“switch to work mode”) are English in every language today; a new language
  should add its own phrases rather than translate the English ones word for word.

Known gaps before a third language: `Language` is a closed union `'en' | 'tr'` used by settings,
the language select and backups (`sanitize` keeps unknown codes out); date formats already follow
the language code; plural rules are the simple `one|many` form, enough for EN/TR/FR/ES/DE/PT but
not for languages with more plural categories (Polish, Arabic), which would need `Intl.PluralRules`.

### 2.2 Translation workflow (for later)

1. Freeze English keys for a release.
2. Export the key/English table (en.ts, strings-en.ts, guide headings and labels).
3. Translate with a native reviewer; the guide's **bold** labels must equal the translated UI
   labels (the label check done for EN/TR before 2.0.1, repeated per language).
4. Screenshot pass at 125–200 % zoom: German and French run 20–35 % longer than English.

### 2.3 Chrome Web Store listing in more languages (evaluation only; 2.0.1 unchanged)

The store offers translated descriptions, screenshots and video only for locales the package
declares: “Each locale corresponds to one of the `_locales/LOCALE_CODE` directories included in the
extension” ([Chrome docs](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)). The
small tile and marquee cannot be localized.

What it would take:

- `default_locale: "en"` in the manifest (required as soon as `_locales` exists).
- `_locales/en/messages.json` and `_locales/tr/messages.json` with at least `extName`,
  `extShortName`, `extDescription` (≤ 132 characters per language); manifest `name`,
  `short_name`, `description`, `action.default_title` become `__MSG_…__`.
- src/manifest.ts builds those from brand.ts plus a per-language table; package-rc.mjs checks
  that every locale has every message and that descriptions stay within 132 characters.
- Store dashboard: one description, screenshot set and (optionally) video per language.

Consequences to weigh:

- The extension's name in Chrome (extension list, the “Change back to Google?” bubble) then
  follows the browser language. The name stays “Senuma” in every language; only the descriptor
  could change (“Senuma — Yeni Sekme Çalışma Alanı”). Recommendation: keep the full name English
  everywhere and translate only the description.
- It is a manifest change, so it belongs in a normal update with its own review, never in a
  rebuild of a frozen package.
- Turkish copy already exists (MESSAGING_SYSTEM.md, STORE_LISTING.md wording), so EN + TR is a
  small step; each further language needs the description, 5 screenshots and the guide.

## 3. Feedback v1

### 3.1 Design

One entry point (Settings → Help & Feedback, and **Send feedback** on the review card), three cards:

| Card | When | Form |
|---|---|---|
| Report a problem / Sorun bildir | something does not work correctly | What went wrong? · Steps to reproduce (optional) · technical details **on** by default |
| Suggest an idea / Fikir öner | features or improvements | What would you like Senuma to do? · technical details off |
| Share feedback / Geri bildirim gönder | general comments | Your feedback · technical details off |

Delivery: a prepared email (`mailto:`) to the support address, or **Copy message**. Senuma has no
backend, sends nothing itself and stores nothing about the message.

- Technical details are exactly four lines: Senuma version, browser and version, operating
  system, interface language. They come from the browser itself (`navigator.userAgentData`), read
  locally. Nothing about Spaces, links, history or settings is ever included.
- They appear in the preview before anything leaves; unticking the box removes them from the
  preview and the email alike (tested end to end).
- The email opens in the person's own mail app, where they can change it or not send it at all.
- Address: `rumeliskelesi+senuma@gmail.com`, the temporary support contact already listed in the
  store (STORE_LISTING.md). **Owner decision:** replace with a Senuma address before release if the
  personal address should not appear inside the product (src/features/help/report.ts,
  `FEEDBACK_ADDRESS`, one line).

Why not a form service or GitHub Issues: a form service is a SaaS dependency that receives data;
GitHub Issues makes every report public and needs an account. Email is free, private and already
the published contact. GitHub Discussions can be added later as a public idea board (§ 4.4).

### 3.2 Inbox handling

- Gmail filter on `+senuma` → label `Senuma/Inbox`; sub-labels by subject prefix
  (`Problem report`, `Idea`, `Feedback`; Turkish: `Sorun bildirimi`, `Fikir`, `Geri bildirim`).
- Reply within 3 working days to every message that asks something; a short thank-you otherwise.
- Never ask for screenshots of a person's Spaces; ask for steps instead.
- Store reviews are read weekly and answered in the dashboard when they report a problem.

## 4. Feedback → roadmap

### 4.1 Flow

Feedback (email, store reviews, public replies) → **classify** → **deduplicate** (one card per
underlying problem or idea; every report adds one to its count) → **frequency** → **score** →
**backlog** → **shipped** → **changelog** (the store's “What's new” and the README) → reply to the
people who asked (“Shipped in 2.0.x”).

Tool: one private spreadsheet or a GitHub Project board in the private repo (free). One row per
card: title, category, first seen, count, sources (links to emails/reviews, no personal data
copied), scores, status, release.

### 4.2 Categories

Bug · UX · Feature request · Content/catalog · Localization · Performance · Privacy · Browser
compatibility.

### 4.3 Scoring (no paid tools)

`priority = severity × reach × confidence ÷ effort`, each on a small fixed scale:

| Factor | 1 | 2 | 3 | 5 |
|---|---|---|---|---|
| Severity / value | cosmetic | annoying, has a workaround | blocks a main path or confuses many | data loss, privacy or security (P0: fix now, skip scoring) |
| Reach | one person | 2–4 reports | 5–9 reports, or a store review | 10+ reports, or any store review that names it repeatedly |
| Confidence | a guess | plausible | reproduced or clearly described | reproduced and measured |
| Effort | — | under a day = 1 · a few days = 2 · a week = 3 · more = 5 | | |

Rules: P0/P1 from RELEASE_STATUS.md's severity model bypass the score. A feature request also needs
a yes to “Does it fit the single purpose (organize + search + personalize the new tab)?” — the store
policy and the product both depend on it. Review the board every two weeks; ship small.

### 4.4 Public side (later, free)

When there are enough ideas to vote on: GitHub Discussions (Ideas category) or a pinned issue
list; link from Help & Feedback as “See what others asked for”. Not before there is traffic.

## 5. Review request

### 5.1 The card

| | English | Türkçe |
|---|---|---|
| Title | Enjoying Senuma? | Senuma işine yarıyor mu? |
| Body | A short Chrome Web Store review helps Senuma grow. | Chrome Web Store’da bırakacağın kısa bir yorum Senuma’nın gelişmesine yardımcı olur. |
| Actions | Leave a review · Send feedback · Not now | Yorum bırak · Geri bildirim gönder · Şimdi değil |

A small card at the bottom left of Home (above the dock on narrow windows). It never covers a
panel, never takes keyboard focus, is not shown during onboarding or the 1.x upgrade message.

**No review gating.** Everyone sees the same question with both actions side by side. There is no
“Are you happy?” step and nobody is routed to the store or away from it by their answer. This also
keeps within the store policy against manipulating ratings (incentivized or filtered reviews).

### 5.2 When (src/features/help/review.ts)

| Rule | Value |
|---|---|
| Not before | 7 days after the first new tab with this version |
| Meaningful use | ≥ 10 links opened from Senuma, on ≥ 4 different days, with at least one Space |
| Not enough use yet | look again in 2 days |
| After it was shown | at least 30 days before it can return |
| “Not now” | 60 days; the second “Not now” ends it for good |
| “Leave a review” | ends it for good |
| “Send feedback” | opens the feedback form; 60 days |
| Ever | at most 3 times |

Evidence of use comes from data already on the device (the Continue list); no counter, no
analytics, nothing sent. If the person cleared their activity or turned Continue off, the card
simply does not appear. Its own record (`bos.review` in this browser's local storage) holds four
numbers: first seen, next possible date, times shown, times dismissed.

Cost: one localStorage read per new tab; the card's code loads only when it is due (at most once
a day otherwise).

## 6. Budgets and checks

| Line | Size | Budget |
|---|---|---|
| startup JS | 43.8 kB | 44 (was 43.5: the review trigger and the new chunks' preload list) |
| on-demand JS | 20.2 kB | 22 |
| help & feedback (help-*.js/css) | 5.5 kB | 6 (new line) |
| help text, Turkish (help-tr-*) | 1.2 kB | 2.5 (new line) |
| user guide pages (help/) | 67 kB on disk | 96 (new line) |

New lines need owner sign-off like any budget. Tests: unit (guide build, strings parity, review
rules, feedback message), `npm run test:help` (Settings section, guide pages offline in both
languages, contextual links, Turkish UI, feedback preview and consent, review card timing and
dismissal).

## 7. Before this ships

- Owner: support address in the product (§ 3.1).
- Owner: new budget lines (§ 6).
- Version and release notes (“Help & Feedback in Settings”), STORE_LISTING.md update notes.
- Update the review URL if the store ID ever changes (`REVIEW_URL`).
- Hands-on check: mailto on a machine with no mail app (Chrome shows nothing; **Copy message** is
  the fallback, and the address is printed under the buttons).

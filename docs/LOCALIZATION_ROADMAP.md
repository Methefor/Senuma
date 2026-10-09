# Localization roadmap

Now: **English, Turkish.** Next: **1. Spanish, 2. French.** Then: **3. German, 4. Portuguese.**
Nothing beyond English and Turkish is translated yet; this is the plan for when it is.

The mechanics already in the code are described in HELP_FEEDBACK_SYSTEM.md § 2; this document is
the roadmap and the checklist per language.

## 1. Where text lives (source of truth)

| Surface | Source of truth | Per-language file | Loaded |
|---|---|---|---|
| Core interface | `src/i18n/en.ts` (keys) | `src/i18n/<lang>.ts` | English at startup; others as a lazy pack |
| Help, feedback, review card | `src/features/help/strings-en.ts` | `strings-<lang>.ts` (typed `HelpStrings`) | with the help chunk |
| User guide | `docs/guide/en.md` | `docs/guide/<lang>.md` → packaged `help/<lang>.html`, site `/<lang>/guide/`, GitHub | on demand |
| Names Senuma gives (Spaces, groups, Modes) | `cat.*`, `catgroup.*`, `modePreset.*` keys in the core files | same files | follow the language via `nameKey`; names typed by a person never change |
| Landing page | `content/en.json` (LANDING_PLAN.md § 5) | `content/<lang>.json` | static |
| Store listing | STORE_LISTING.md / STORE_CONVERSION.md (English) | `_locales/<lang>/messages.json` + dashboard fields | § 4 |
| Marketing lines | MESSAGING_SYSTEM.md (EN/TR tables) | add a column per language | — |

English is always the source. A translation never invents a key and never drops one (compiler
for help strings; the i18n test for core strings; a parity test for the landing content).

## 2. Code changes a third language needs (once, small)

1. `Language` type in `src/core/types.ts` becomes `'en' | 'tr' | 'es' | 'fr' | …`; `sanitize`
   accepts the new codes; the language select lists them by their own names (Español, Français).
2. One loader line per language in `src/i18n/index.ts` and in `src/features/help/text.ts`.
3. `GUIDE_PAGES` (topics.ts) and `GUIDE_CHROME` (vite.config.ts) get the language; until its
   guide exists the English guide is used automatically.
4. First-run language: today a new install starts in Turkish when the browser language is
   Turkish, English otherwise. Extend that rule to each shipped language.
5. Budgets: each language pack has its own line (Turkish: 6.8 of 8 kB; help text 1.3 of 2.5 kB).
   Packs are lazy, so **startup does not grow** (44 kB ceiling, not to be raised). The guide pages
   budget (96 kB for two) rises by about 35 kB per language and needs approval when it does.
6. Plurals: the simple `one|many` form covers es/fr/de/pt. Languages with more plural categories
   would need `Intl.PluralRules` first.
7. Command phrases (“switch to work mode”) are English only today; each language should get its
   own natural phrases rather than literal translations.

## 3. Workflow per language

| Step | What | Who |
|---|---|---|
| 1 | Freeze English for the release that will carry the language | developer |
| 2 | Export keys + English + context notes (where it appears, length limit) | script from en.ts / strings-en.ts |
| 3 | Glossary first: Spaces, Modes, Dock, Command center, Continue, Space names | translator + owner; recorded in MESSAGING_SYSTEM.md |
| 4 | Translate interface and help strings | native speaker (not machine-only) |
| 5 | Translate the guide; **bold labels must equal the translated interface labels** | same translator |
| 6 | Automated checks: every key present, placeholders match, nothing empty, guide anchors resolve, guide labels match the dictionaries | tests |
| 7 | Review in the product at 100–200 % zoom: German/French run 20–35 % longer than English; check buttons, the Settings nav, the review card | second native reader |
| 8 | Screenshots for that language (5) if the store listing is localized | `npm run store:assets` with the language |
| 9 | Ship behind nothing: a language is either complete or absent | — |

Turkish went through this path (2.0.1: default names; 2.0.2: help strings and guide), so the
tooling exists; what is missing for new languages is people, not code.

## 4. Chrome Web Store: `_locales` and translated listings

Requirement (Chrome docs): a listing can be translated only for locales the package declares,
one `_locales/<code>/` directory each; the small tile and marquee cannot be localized.

**Implemented on `senuma-2.0.3` (2026-10-09), not packaged:**

- `default_locale: "en"`; `description: "__MSG_extDescription__"`; `_locales/en/messages.json`
  and `_locales/tr/messages.json`, generated from `STORE_DESCRIPTIONS` in `src/manifest.ts`.
- **Only the description is localized.** `name`, `short_name` and the toolbar title stay literal
  (“Senuma — New Tab Workspace”, “Senuma”): the brand is the same in every language, and nothing
  in the tooling has to resolve a message to know the product's name.
- Build-time only: no bytes in the page's bundle, no permission change. It is independent of the
  interface language chosen in Settings and never touches anything a person typed.
- Tests: `src/manifest.test.ts` (one complete file per language, 132-character limit, the
  description is the only message, permissions unchanged); `npm run test:locales` (a Turkish
  browser shows the Turkish description, an English one the English, a German one falls back to
  English; a typed Space name survives a language switch). `scripts/package-rc.mjs` checks every
  locale and lists them.
- Adding Spanish, French, German or Portuguese later: one line each in `STORE_DESCRIPTIONS`
  (`es`, `fr`, `de`, `pt_BR` and/or `pt_PT`), written by a native speaker. None is added now.

What the store then needs, in the dashboard (a person's step, with the 2.0.3 package): choose
Turkish in the listing's language picker and enter the Turkish description and screenshots.

Listing strategy:

| Phase | Listing languages | Needs |
|---|---|---|
| A (with or after 2.0.3) | English + **Turkish** | `_locales/en`, `_locales/tr`; Turkish description (from MESSAGING_SYSTEM.md), 5 Turkish screenshots |
| B | + Spanish, French | interface + guide in those languages first; never a translated listing for an untranslated product |
| C | + German, Portuguese | same |

Decisions for the owner when phase A starts: keep the product name “Senuma — New Tab Workspace”
in every language (recommended: the name is the brand; translate only the description), and
whether Portuguese means Brazil first (larger Chrome audience) — to be checked against store
install geography then, not assumed now.

## 5. Order and triggers

1. **Turkish store listing (phase A)** — cheap, copy exists; do it with the next manifest-changing
   update.
2. **Spanish, then French** — start when either (a) store analytics show a meaningful share of
   page views from those languages/regions, or (b) feedback asks for them; whichever comes first.
   Until then the time goes to the launch.
3. **German, Portuguese** — after Spanish and French have shipped and been maintained through one
   release (to learn the real upkeep cost).

Each language is a standing cost: every new string and every guide change must be translated
before a release. That is the real reason to add them one at a time.

## 6. Not doing

- Machine-translated interface without a native reader.
- Translating content people created (never; `nameKey` only marks names Senuma gave).
- Localizing the brand name or taglines without the owner choosing them (“Make the browser
  yours.” needs a human decision in each language).

# GitHub presence — README strategy

A proposal. **README.md is not changed by this document**: the README on `main` belongs to the
repository-presentation workstream, and the release branches have diverged from `main`. Apply the
proposal there when the owner approves.

Repository: `github.com/Methefor/Senuma` (public). Read on 2026-10-05.

## 1. What the README must do in ten seconds

1. Say what Senuma is (one sentence) and show it (one real image).
2. Give the install link.
3. State the privacy facts plainly.
4. Point to the guide and to feedback.

It should read like a product's front page written by its engineer, not like a startup landing
page: no slogans stacked on slogans, no feature grid of adjectives, no badges wall.

## 2. Findings on the current README (`main`)

| Item | Finding | Action |
|---|---|---|
| Opening | name, tagline, hero image, product-tour GIF | keep |
| Install link | none | add the Chrome Web Store link at the top (once 2.0.x is public) |
| Status section | says the active line is “2.1.0 dev 1” and that 2.0 “has not been uploaded” | out of date: 2.0.0 is in store review; 2.0.1 and 2.0.2 are frozen release candidates. Rewrite as a short “Status” table |
| Privacy | one principle line (“Private by design”) | replace with the concrete facts (§ 3) and link PRIVACY_FACTS.md and the policy |
| Guide | not linked | link docs/guide/en.md and tr.md |
| Feedback | none | add the address and the three kinds of feedback |
| Changelog | none | add “What's new” (the store update notes) or link RELEASE_STATUS.md |
| Licence | **no LICENSE file** | the code is publicly readable but not open source. Say so in one honest line; do not use the words “open source” unless a licence is added (owner decision) |
| “Local-first foundations … encrypted sync is developed” | mentions unreleased work | keep sync out of the product description; mention it only under Roadmap as “explored, no date” |
| Internal docs linked from the top (Brand, Architecture) | fine for contributors, noise for visitors | move below the fold |

## 3. Proposed README structure

```
# Senuma
**Make the browser yours.**  A personal workspace on every new tab.

[Add to Chrome](store link) · [Guide](docs/guide/en.md) · [Kılavuz (TR)](docs/guide/tr.md) · [Privacy](privacy policy link)

[hero image: real Home screenshot]

## What it does
- **Spaces**: the sites you use, grouped by what you use them for.
- **Search**: one bar for the web and your own links; shortcuts like `y lofi mix`, `gh`, `w`, and your own engines.
- **Command center**: Ctrl+K opens links and Spaces, switches Mode, changes theme.
- **Modes**: one key changes Spaces, look, search engine and dock.
- **Your look**: six themes, built-in photographs or your own image, with fit, position, dim, blur and atmosphere.
- **Backup**: your setup in one JSON file, with restore points.

[product-tour GIF, or gif-2 command center + gif-5 Modes side by side]

## Privacy facts
- Free. No Senuma account. No analytics.
- Your workspace is stored in your browser; this release needs no Senuma cloud.
- What does go out: your searches, to the search engine you choose; icon requests to the sites
  you saved (or to Google's icon service if you select it, or none with “Letters only”).
- Required permissions: `storage`, `search`. Optional, asked only when used: `bookmarks`,
  `tabs` + `sessions` (recently closed tabs).
Details: docs/PRIVACY_FACTS.md · privacy policy.

## Guide and help
The full user guide is in docs/guide (English, Türkçe) and, from 2.0.2, inside the extension:
Settings → Help & Feedback.

## Feedback
Report a problem, suggest an idea or share feedback: Settings → Help & Feedback in the extension,
or write to rumeliskelesi+senuma@gmail.com. (Issues: say here whether GitHub Issues are welcome.)

## Status
| Version | State |
|---|---|
| 2.0.0 | in Chrome Web Store review |
| 2.0.2 | release candidate (Help & Feedback, packaged guide) |
What's new: docs/STORE_LISTING.md · Release record: docs/RELEASE_STATUS.md

## Build it yourself
npm ci · npm run build → load dist/ unpacked · npm run check · npm run test:e2e
(The build is reproducible; docs/RELEASE_STATUS.md lists package hashes.)

## Source and licence
The source is published so that anyone can see what the extension does. It is not released under
an open-source licence; all rights reserved unless a LICENSE file says otherwise.

## For contributors / internals
Architecture · Brand · Release process · Repository map (as today)
```

Turkish: a short `README.tr.md` (what it is, install, privacy facts, guide link) linked from the
top, not a full mirror.

## 4. Media for the README

Existing `docs/media/readme/` images on `main` are kept. Additions worth making there: gif-3
(`y lofi mix`) and gif-5 (Modes), each under 3 MB. GitHub renders MP4 only when uploaded through
the web editor, so GIFs stay the practical choice. Caption every image as real UI with
demonstration data (the current README already does).

## 5. Repository settings (owner, free)

- About box: “A personal workspace on every new tab. Spaces, search shortcuts, Modes, your own
  look. Free, no account.” · website = store listing (later the landing page) · topics:
  `chrome-extension`, `new-tab`, `productivity`, `browser`, `preact`.
- Social preview image: the 1280×640 crop of the hero.
- Releases: none are created by this plan. When the owner wants them, one GitHub Release per store
  version with the update notes and the package hash (no binary needed).
- Issues/Discussions: decide whether to accept public issues. If yes, add three issue templates
  mirroring the three feedback cards and link them from the README; if not, say “feedback by
  email” so people are not left guessing.

## 6. Honesty checks

- No “open source” wording without a licence.
- No “zero network requests”, “nothing leaves your device”, “anonymous”, “zero knowledge”.
- Nothing about the name being legally cleared (SENUMA_BRAND.md).
- No install or user counts until the store shows them, and then quoted with a date.
- Branch reality: `main` and the release branches (`senuma-2.0.1`, `senuma-help-growth`,
  `senuma-2.0.3`) have diverged; the README must not claim `main` is what ships until they are
  reconciled (a separate, approved step).

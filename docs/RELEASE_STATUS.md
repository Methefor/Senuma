# Release status — 2.0.0 RC 1

Branch `rebuild/browser-os`, not pushed, not published. Date: 2026-10-02.

## Severity model

| Level | Meaning | Rule |
|---|---|---|
| P0 | Data loss, security hole, the page does not open, policy violation | Blocks any release, including a test build |
| P1 | A main path is broken or misleading for many people | Blocks the public release |
| P2 | Wrong or rough, with a workaround | Fix in the next update |
| P3 | Polish | Backlog |

## Blockers (P0)

**None known.**

Found and fixed during this phase:
- A stored state containing keys such as `constructor` or `__proto__` crashed the page
  (`in` checks matched inherited properties). Fixed with own-property checks; unit and
  real-browser tests added.
- A state written by a newer release would be overwritten by an older build on the first
  edit. The original is now set aside under `bos.state.newer` first.
- `file:` and other non-web addresses were accepted for saved links. Now http/https only.

## High — must be settled before the public release (P1)

| # | Item | Kind |
|---|---|---|
| H1 | Chrome shows “Change back to Google?” on the first new tab, with **“Change back” as the default button**. New users can switch the page off with one Enter. It is not known whether existing users see it again after the update. | Product/communication; needs a staged rollout to observe |
| H2 | Chrome's prompt for recently closed pages says “browsing history **on all your signed-in devices**”; our explanation says only “browsing history”. Make the explanation match. | Copy (en + tr), small |
| H3 | Brand marks: Simple Icons records no licence conflict for the 41 bundled marks, but each owner's brand guideline was recorded, **not reviewed**. Netflix, Spotify, Steam, Epic, Twitch, Instagram, WhatsApp, X and Figma publish strict guidelines (colour, clear space, no alteration). Decide: review each, or ship without marks. Removing one is a two-line change. | Legal decision |
| H4 | 1.x PRO customers: V2 has no paid features and no cloud sync. What they are told, and whether anything is refunded, is undecided. | Business decision |
| H5 | Name, icon, store text, privacy policy page, landing and pricing pages are still 1.x. | See BRAND_DIRECTION.md, STORE_LISTING.md |
| H6 | The final version number. The manifest says 1.99.10 on purpose. | Decision at release preparation |
| H7 | A person has not used the build by hand. The headed pass is automated. | One sitting with docs/MANUAL_QA.md |

## Follow-up (P2/P3)

- P2: the “Bokeh” photograph is busy behind text; readable with the suggested dim, the weakest of the eight. “Glass Facade” needs a light theme (the hint says so). Both kept, as agreed.
- P2: two tabs editing inside the same quarter second: the later save wins, the earlier edit is dropped (whole record). Documented below; a field-level merge is a later project.
- P2: the Turkish browser gets Turkish onboarding but starter Space names follow the chosen language only at creation.
- P2: Windows only for the headed pass; macOS `Cmd+K` not exercised.
- P3: a toast can sit over the lower part of Settings for a few seconds.
- P3: startup JS is at 43.8 of 44 kB; the next feature needs a lazy chunk or a budget decision.

## Schema 4 — freeze candidate

`AppState` schema 4 is proposed as the release schema. From here on: fields may be added with
defaults in `sanitize`; nothing is renamed or removed without a `MIGRATIONS[4]` step and a test.
Covered: 1.x → 4, 2 → 4, 3 → 4, damaged data, newer-than-known data.

## Several tabs — how it behaves

One record holds the whole setup. A tab saves about 250 ms after a change; other tabs adopt
any record newer than their own, without reloading (seen with three real tabs). The active
Mode is part of that record, so it is the same in every tab. Two edits in different tabs
within the same ~250 ms: last write wins, the other edit is lost, nothing is corrupted (tested).

## Addresses the product will open

`http:` and `https:` only. `javascript:`, `vbscript:`, `data:`, `file:`, `chrome:` and custom
schemes are refused when typed, pasted, imported from bookmarks or a backup, migrated from 1.x,
or found in stored data. Links that open a new tab carry `rel="noopener"`.

## RC build

| | |
|---|---|
| Package | `release/NewTabFolders-2.0.0-RC-1-1.99.10.zip` (local, git-ignored), 3.4 MB |
| Manifest version / display | 1.99.10 / “2.0.0 RC 1” |
| Permissions | `storage`, `search`; optional `bookmarks`, `tabs`, `sessions` |
| Schema | 4 |
| JavaScript | 186 kB (65 kB gzip), 10 files; 43.8 kB gzip parsed at startup |
| CSS | 45 kB (8.9 kB gzip) |
| Photographs | 3.28 MB (8 pictures + 8 previews) |
| Brand marks | 40 kB (41 files) |
| Inspection | no source maps, tests, dev config, local paths, secrets, debug logging, remote code or manifest key; strict CSP; no host permissions |

## Checks and how to run them

| Command | What | Last result |
|---|---|---|
| `npm run check` | types, lint, 95 unit tests, build, budgets | pass |
| `npm run test:e2e` | everyday paths in real Chromium | 65 pass |
| `npm run test:rc` | edge data, damage, offline, several tabs, keyboard, names, reduced motion | 33 pass |
| `npm run rehearse` | real 1.x → V2 in place, restart, rollback, forward | 13 pass |
| `npm run headed` | visible Google Chrome, native prompts | 22 recorded, 0 failed |
| `npm run visual` | 31 captures | all reviewed |
| `npm run package` | package inspection + zip | clean |

## Deliberately not in this release

AI features, accounts, cloud sync, paid plans, any backend, a wallpaper service or
marketplace, community features, a widget library, automation.

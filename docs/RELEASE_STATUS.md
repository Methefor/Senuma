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

## Decisions locked on 2026-10-02

| # | Decision | State |
|---|---|---|
| H1 | Chrome's “Change back to Google?” bubble is accepted as it is. Nothing suppresses, bypasses or steers it. | Observed locally (below); **staged-rollout observation item** |
| H2 | The recently-closed explanation now quotes Chrome's wording, “on all your signed-in devices”, in English and Turkish. | Done |
| H3 | Every bundled mark was reviewed against its owner's guidance. 3 kept (GitHub, Letterboxd, Vercel), 38 removed. | Done; see ASSET_LICENSES.md |
| H4 | Legacy PRO is history, not an entitlement (below). | Done |
| H5 | Name, icon, store text, screenshots, privacy policy, landing and pricing are replaced together in the brand phase. Production is untouched. | Next milestone |
| H6 | Public version will be `2.0.0`. RC stays `2.0.0 RC 1` / manifest `1.99.10`. | Rule enforced by a test |
| H7 | One hands-on session with docs/MANUAL_QA.md is required before publishing. | **Open — release gate** |

### H1 — what was observed (`npm run headed:update`, visible Google Chrome 154)

1.x and V2 loaded from one folder under one extension ID, so Chrome sees an update.

| Case | First 1.x tab | After updating to V2, same session |
|---|---|---|
| User had pressed “Keep changes” in 1.x | bubble shown, kept; not shown again in 1.x | **not shown** |
| User had never answered it in 1.x | bubble shown, and again on the next tab | **shown again** (it was still pending) |

After quitting and restarting Chrome the bubble appeared in both cases, but that result is
**not usable**: an extension loaded unpacked this way is installed afresh at each start, which
Chrome treats as a new extension. So: an in-place update did not re-ask people who had already
answered. Whether a Chrome Web Store update behaves the same cannot be reproduced outside the
store. **Staged-rollout item:** release to a small percentage first and check, on a profile
that had 1.x, whether the bubble returns after the update and after a restart.

### H4 — legacy PRO

- In 1.x, `isPro` was a local flag in `ntf_data`. The audit found no working payment system
  and no purchase record behind it.
- V2 has no paid plan and no gated feature. Everything is available to everyone.
- The flag is copied into `state.legacy` during migration and kept only as history. No code
  reads it and the interface no longer mentions it (the About line “Your earlier PRO status is
  kept on record” was removed).
- No migrated user is told they own a paid V2 plan.
- **Separate commercial task, not guessed at here:** if payment-provider or store records of
  real 1.x purchases exist outside this repository, they need their own decision.

### H6 — version

- Target: `2.0.0`. One source: `src/brand.ts` (`version`, `displayVersion`, `manifestVersion`);
  `package.json` must match. A unit test fails the build if they disagree, if a pre-release
  uses a manifest number outside `1.99.x`, or if a release's manifest number differs from its
  version.
- **Published version, as read from the public store page on 2026-10-02:** “New Tab Folders”,
  version **1.8.0**, updated 10 July 2026, 17 users, ID `oghlifenjhpbebcdeboejbmemelkfobe`.
  A search-engine snippet says 1.54; the repository's own manifest says 1.55.
  Chrome compares versions number by number, so 1.55 > 1.8.0, and `2.0.0` is newer than all
  three. **To verify in the developer dashboard before final packaging:** the exact published
  version, and that the repository's 1.x files are the published build (the rehearsals used
  the repository's files).

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
| Brand marks | 1.5 kB (3 files) |
| Inspection | no source maps, tests, dev config, local paths, secrets, debug logging, remote code or manifest key; strict CSP; no host permissions |

## Checks and how to run them

| Command | What | Last result |
|---|---|---|
| `npm run check` | types, lint, 96 unit tests, build, budgets | pass |
| `npm run test:e2e` | everyday paths in real Chromium | 65 pass |
| `npm run test:rc` | edge data, damage, offline, several tabs, keyboard, names, reduced motion | 33 pass |
| `npm run rehearse` | real 1.x → V2 in place, restart, rollback, forward | 13 pass |
| `npm run headed` | visible Google Chrome, native prompts | 22 recorded, 0 failed |
| `npm run headed:update` | 1.x → V2 in visible Chrome: does the bubble return? | recorded |
| `npm run visual` | 31 captures | all reviewed |
| `npm run package` | package inspection + zip | clean |

## Deliberately not in this release

AI features, accounts, cloud sync, paid plans, any backend, a wallpaper service or
marketplace, community features, a widget library, automation.

# Release status — Senuma 2.0.1 release candidate (frozen, not uploaded)

The one status document. Nothing pushed, nothing published. Last updated 2026-10-05.

## Senuma 2.0.1 — release candidate, FROZEN (2026-10-05)

Waiting for the result of the 2.0.0 Chrome Web Store review. Not submitted; the 2.0.0 review
is untouched. Branch `senuma-2.0.1`; the release-candidate commit is tagged `senuma-2.0.1-rc`
(local tag).

| | |
|---|---|
| File | `release/Senuma-2.0.1.zip` (41 files, 3374.1 kB; unpacked 3537.6 kB) |
| SHA-256 | `172c4a8cf2efd6015f6a200267a38dbb91576c6e52692d4b0218f5c603bc7a11` |
| Built from | `senuma-2.0.1`, last package-input commit `efd96fb` (version 2.0.1); later docs-only commits do not change the zip |
| Reproduced | two fresh worktrees of `efd96fb`, each `npm ci` + `npm run package`, and the working tree: the same SHA-256 three times |
| Version | manifest `version` 2.0.1, `version_name` 2.0.1, package.json 2.0.1 (single source `src/brand.ts`, test-enforced) |
| Name / description | unchanged from 2.0.0 |
| Permissions | required `storage`, `search`; optional `bookmarks`, `tabs`, `sessions`; no host permissions, no content scripts |

**Building it again.** Check out with LF line endings (`git -c core.autocrlf=false worktree add …`):
the build copies `background.js` and `marks/*.svg` byte for byte, so a CRLF checkout (Windows'
`core.autocrlf=true`) gives a different zip. The 2.0.0 package and the QA build were LF builds.

**Against the QA build that passed hands-on QA** (`release/Senuma-2.0.1-qa/`, `8523e01`): the
same 41 files. Only `manifest.json`, `newtab.html` and the 12 JS chunks differ, and each is
identical once the version string (2.0.0 → 2.0.1) and the chunk file names it changes are
accounted for. No product code changed after QA; `8523e01..efd96fb` adds a test, docs and the
version.

**Package inspection.** `npm run package` checks pass: no source maps, no tests or fixtures,
no dev configuration, no local paths, no secrets or keys, no debug logging, no remote code, no
unsafe HTML sinks, no manifest `key`, MV3 with a strict CSP, exactly the permissions above, no
unused files. Also checked by hand in the zip: no Senuma 2.1 sync code, no Firebase SDK or
config (the only “Firebase” is the console link in the catalog), no OAuth client or
`chrome.identity`, no `.env` or `import.meta.env`, no dotfiles. Contents: `manifest.json`,
`newtab.html`, `background.js`, 15 JS/CSS files in `assets/`, 4 icons, 3 brand marks,
16 photograph files.

**Gates on `efd96fb`** (clean worktree):

| Command | Result |
|---|---|
| `npm run check` (types, lint, unit, build, budgets) | pass; unit 225 |
| `vite-node e2e/qa-201.ts` | 7 pass (incl. uploaded background across two browser restarts) |
| `npm run test:e2e` | 65 pass |
| `npm run test:rc` | 33 pass |
| `vite-node e2e/rehearsal.ts` (published 1.80 → Senuma) | 16 pass |
| `npm run package` | clean |

Budgets: startup JS 43.5 kB gzip (44), CSS 9.2 (9.5), on-demand JS 20.0 (22), Turkish pack
6.8 (8), photographs 3284 kB (3584), brand marks 2 kB (64).

**Hands-on QA: passed** (MANUAL_QA_2.0.1.md, Result). The reported loss of an uploaded
background after a restart is closed: not reproducible; the picture had been previewed and not
applied; the repeat with Apply passed.

**Release assets** (`release/Senuma-2.0.1-media/`, git-ignored): 5 screenshots and 5 extras
(1280×800), icon 128, tile 440×280, hero 1400×560, six GIFs, `senuma-28s-silent.webm`
(1920×1080, 28.9 s). Not produced, not blockers: MP4, music and voice-over versions, square
and vertical cuts. The store listing stays English only (no `_locales` in the package).

**Documentation:** guide/en.md and guide/tr.md (26 sections each), HELP_CENTER.md (no domain
chosen), MESSAGING_SYSTEM.md, MEDIA_PLAN.md, STORE_LISTING.md (2.0.1 notes), MANUAL_QA_2.0.1.md.

---

# Senuma 2.0.0 (submitted for review)

Branch `rebuild/browser-os`. Record as of 2026-10-03.

## READY

| Area | State |
|---|---|
| Product (Spaces, Modes, search, command center, Continue, dock, Customize) | Built and tested |
| Local identity | Senuma: name, descriptor, tagline, icon, wordmark in onboarding and About only (never on Home) |
| Upgrade from New Tab Folders 1.x | In-place, data kept, 1.x data untouched, never converts twice; message “New Tab Folders is now Senuma” |
| Data continuity | Storage keys, IndexedDB name and extension ID unchanged by the rename (test-enforced) |
| Backups | New files are `senuma-backup`; earlier `browser-os-backup` files and 1.x exports still import (tested) |
| Permissions | Required: `storage`, `search`. Optional: `bookmarks` (released after use), `tabs` + `sessions` |
| Privacy | No analytics, no account, no server. Facts: PRIVACY_FACTS.md |
| Third-party assets | 8 CC0 photographs; 3 brand marks kept after review. ASSET_LICENSES.md |
| Legacy PRO | History only; nothing gated; no paid plan in this release |
| Store and site drafts | STORE_LISTING.md, `drafts/store/`, `drafts/site/index.html` (all local) |
| Version rule | One source (`src/brand.ts`); a test fails if package, manifest and display versions disagree |

Checks (last run 2026-10-02 on the Senuma build):

| Command | Result |
|---|---|
| `npm run check` (types, lint, 104 unit tests, build, budgets) | pass |
| `npm run test:e2e` | 65 pass |
| `npm run test:rc` | 33 pass (a several-tabs timing check has failed intermittently in earlier runs; unexplained) |
| `npm run rehearse` (published 1.80 → Senuma, real ID, two restarts, old sign-in ignored, rollback) | 16 pass |
| `npm run headed` (visible Google Chrome) | 22 recorded, 0 failed |
| `npm run headed:update` | recorded, see below |
| `npm run visual` | 31 captures regenerated; brand-affected ones reviewed |
| `npm run store:assets` | 8 screenshots, hero and tile regenerated |
| `npm run package` | clean; `release/Senuma-2.0.0.zip` |

Build: manifest 2.0.0, display 2.0.0, package 2.0.0 (published: 1.80), schema 4 (frozen: add fields with defaults only).
Startup JS 42.8 kB gzip (budget 44), CSS 9.1 kB (9.5), unpacked 3.53 MB.

### Canonical package (2026-10-03) — RELEASE SAFE

| | |
|---|---|
| File | `release/Senuma-2.0.0.zip` (41 files) |
| SHA-256 | `c39cd5723256833f913e168bcfcc159dcedc16225fa70a6fb99f35035d511b1d` |
| Built from | this branch, last package-input commit `0418b69`; `npm run package` reproduces it byte for byte (a docs-only commit does not change it) |
| Name / short name | Senuma — New Tab Workspace / Senuma (toolbar title: Senuma) |
| Description | Turn every new tab into a personal workspace with Spaces, Modes, search, themes and fast access to the web. |

Approved by the owner on 2026-10-03. Against the earlier frozen build (`5680f0e8…`, from `0389fd0`)
only the manifest `name` and `description` differ; all other 40 files are byte-identical, and
permissions, background worker, new-tab override, icons and runtime JS/CSS are unchanged. No
sync or Firebase code, no keys, no source maps, no tests. It replaces a hand-edited zip
(`42962ca3…`, same values, kept in `release/legacy/`) that no source could reproduce.

## NOT UPLOADED — migration from the published 1.80 build

The published build is 1.80, which differs from the repository's 1.x (licence keys, cloud
sync, quick bar, weather, eight languages). Details and design: LEGACY_MIGRATION.md.

| Area | State |
|---|---|
| Paid plans | Owner: no known purchases. No entitlement system, no gating, no LemonSqueezy. A stored licence key is kept as inert history. |
| Cloud copy | Not migrated (owner decision: no user base to migrate). No cloud import in 2.0; the 1.x sign-in record is ignored and no request goes to the old backend. Old Firebase project untouched. |
| Uploaded background | Migrated into the local wallpaper library with its dim and blur. A background at a web address is not carried over. |
| Quick bar, pinned folders, language, theme, colour and gradient backgrounds | Migrated |
| Store privacy declarations | The live listing declares personal, authentication, location and website-content data; all must be cleared with the update. Exact values: STORE_PRIVACY_CHANGES.md. |
| Dropped from 1.80 | Sync itself, weather, clock, quotes, most-visited, six languages |

Rehearsal (published 1.80 → this build, real extension ID): 16 of 16 pass.

## HOLD (documented, owner chose to proceed)

SENUMA beside SENUMAC (EUIPO no. 019237140, classes 7, 9, 42). Not legally cleared; no
document or listing may say otherwise. Record: SENUMA_BRAND.md. Fallback: AVLUNA_CLEARANCE.md.

## MANUAL

One hands-on session by a person with MANUAL_QA.md before any public release. The headed
pass is automated and does not judge feel. macOS and Linux are untested.

## PUBLIC — each needs explicit approval

- Chrome Web Store update (title, description, screenshots, package). Before uploading: confirm the published version in the
  developer dashboard (store page read 1.8.0; repository's 1.x manifest says 1.55; 2.0.0 is
  newer than both) and that the repository's 1.x files are the published build.
- Staged rollout, to observe Chrome's “Change back to Google?” bubble on real updates.
- Website deployment; removal of the 1.x landing and pricing pages; new privacy policy page.
- Domain purchase (none bought; `senuma.app`, `usesenuma.com`, `getsenuma.com` were unregistered on 2026-10-02).
- Social account creation (none reserved).
- Public announcement.
- Any decision about real 1.x purchase records, if such records exist outside this repository.

## Known behaviour worth knowing

- **Chrome's bubble.** On the first new tab Chrome asks “Change back to Google?” and names the
  extension, now “Senuma”. In a local 1.x → Senuma update, people who had already pressed
  “Keep changes” were not asked again; a person who had never answered was asked again after
  restart. An existing user who sees it will read an unfamiliar name, which is why the first
  tab says “New Tab Folders is now Senuma”. Store-delivered updates can only be observed in a rollout.
- **Fresh tab focus.** Keyboard focus starts in Chrome's address bar; page shortcuts work
  after a click. No focus stealing.
- **Several tabs.** One record; last write wins within ~250 ms; nothing is corrupted.
- **Addresses.** http and https only, everywhere a link can enter.

## Severity model

P0 data loss, security, page does not open, policy violation: blocks any release.
P1 a main path broken or misleading: blocks the public release.
P2 wrong or rough with a workaround. P3 polish.

Open P0/P1: none known. P2: the intermittent several-tabs test timing; “Bokeh” photograph is
busy behind text; with “letters only” icons a Space shows initials, which can spell words.

## Not in this release

AI features, accounts, cloud sync (designed for 2.1: CLOUD_SYNC_DESIGN.md), paid plans, any backend, wallpaper service, marketplace,
community features, widget library, automation.

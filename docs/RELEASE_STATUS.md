# Release status — Senuma 2.0.0 (final package built, not uploaded)

Release status: RC2, nothing pushed or published. Repository reorganization branch: `chore/senuma-product-repository`. Original product baseline: `rebuild/browser-os`. Latest local validation and paths: WORKLOG.md.
Last updated 2026-10-02.

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
| Store and site drafts | STORE_LISTING.md, `assets/store/`, `drafts/site/index.html` (all local) |
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

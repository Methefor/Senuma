# Architecture (V2 rebuild)

Internal codename: **Browser OS**. Names and versions live in one file, `src/brand.ts`:
`productName` is what the interface calls itself (a placeholder), `extensionName` is what
Chrome and the store show (unchanged until a rename is approved).

## Two products in one repository

| | Legacy 1.x | V2 rebuild |
|---|---|---|
| Status | **Production today** (Chrome Web Store) | Release candidate in development |
| Entry point | `index.html` (repo root) | `newtab.html` → `src/main.tsx` |
| Code | `js/`, `css/`, root `*.html` | `src/` |
| Manifest | `manifest.json` (repo root) | generated from `src/manifest.ts` |
| Build | none — load the repo root unpacked | `npm run build` → load `dist/` unpacked |
| Tests | none | `npm test`, `npm run test:e2e` |

Nothing in `src/` imports from the legacy files, and the legacy files are not linted, built or
shipped by the V2 build. They stay until the relaunch (see `RELAUNCH_CHECKLIST.md`).

## Layout

```
src/
  brand.ts             names, versions, storage keys
  manifest.ts          permissions policy; manifest.json is generated from this
  core/                pure logic: no DOM, no chrome.*, fully unit-tested
    types.ts             data model
    ops.ts               state transitions (state, args) => state, plus undo capture/restore
    migrate.ts           legacy 1.x conversion and schema upgrades
    sanitize.ts          rebuilds a valid state from anything on disk or in a file
    backup.ts            backup files, merge, local restore points
    search.ts            search router
    commands.ts          command engine: query → ranked results → Action
    icons.ts             which icon addresses to try, in privacy order
    catalog.ts, setup.ts starter categories, onboarding, import organizer
    themes.ts            themes as token sets
  browser/             the only place chrome.* is used
    kv.ts                key-value storage (chrome.storage.local, or localStorage in preview)
    search.ts, bookmarks.ts, sessions.ts, permissions.ts, iconCache.ts
    result.ts            BrowserResult<T>: ok | unavailable | denied | failed
  storage/             state persistence and the two stores
  app/                 App shell, shortcuts, shared side effects
  features/            home, spaces, command, settings, onboarding
  ui/                  primitives: Icon, AppIcon, Overlay, menu, toasts, useFlip
  i18n/                en (source of truth), tr (loaded on demand)
  styles/              base (tokens, motion, primitives), home, overlays
e2e/                   real-Chromium runtime test and visual review
scripts/size.mjs       bundle budget
```

## Data model (schema 3)

One normalized `AppState` (`core/types.ts`). `spaces` and `items` are id-keyed maps; order
lives in arrays. IDs are random and stable; `updatedAt` stamps every change (last write wins
between tabs today, and between devices later).

- **Space** — name, optional note, glyph, accent, ordered groups of item IDs.
- **Mode** — a working environment. It may override: visible Spaces and their order
  (`spaceIds`), theme (`themeId`), default search (`providerId`), and the dock (`dock`).
  Anything absent falls through to the user's defaults. No other inheritance.
- **Dock** — ordered `DockEntry[]` of links and Spaces; shared, unless a Mode has its own.
- **SearchProvider** — `{ id, name, aliases, urlTemplate? , browserDefault? }`. Engines are
  data; no code path knows an engine by name.
- **RecentItem** — `{ url, title, at, count, spaceId? }`. Written only when a link is opened
  from this page. Bounded to 30.
- **usage** — command-result key → last used, bounded to 40; used only to rank results.

## State

- **Persistent** — `app` store. Changed only through `update(transition)` with a pure function
  from `core/ops.ts`. Writes are coalesced (250 ms) and flushed on `pagehide`.
- **Session UI** — `ui` store (open panel, menu, toasts). Never saved.
- **Derived** — computed at render (`visibleSpaces`, `activeDock`, `effectiveThemeId`).

## Storage, migration, data safety

`chrome.storage.local` is the source of truth (`bos.state`); a `localStorage` mirror lets the
page paint synchronously. On boot the newer of the two wins.

Boot (`resolveState`): stored state → legacy `ntf_data` → fresh.

- **Idempotent.** Legacy data is converted only when no V2 state exists. Once one does —
  even a damaged one — legacy data is never read again, so the conversion cannot run twice,
  duplicate anything or overwrite later edits.
- **Legacy data is read-only.** `ntf_data` and `app_version` are never written or removed.
- **Schema upgrades** run through `MIGRATIONS[n]` (n → n+1), then `sanitize`, which drops
  damaged records one by one instead of failing the page.
- **Restore points.** Before a setup is replaced (import → replace, restoring a restore
  point, reset) the current one is saved under `bos.snapshots`, newest five kept. If that
  save fails, the replacement does not happen.
- **Undo** is a targeted inverse, not a state rollback: deleting a link, group, Space or Mode
  captures exactly what was removed and restores it in place, keeping later edits. It is
  available while the toast is shown (7 s).
- **Import** validates everything, then offers merge (adds, never removes) or replace.

## Permissions

Warnings below were read from Chrome's own permission-warning API.

| Permission | Kind | Why | Install warning |
|---|---|---|---|
| `storage` | required | the saved setup | none |
| `search` | required | default search through the browser's own engine | none |
| `bookmarks` | optional | bookmark import, asked on click | "Read and change your bookmarks" |
| `tabs` + `sessions` | optional | recently closed tabs in Continue, asked on toggle | "Read your browsing history" |

Not used: `history`, `topSites`, `favicon`, host permissions. The service worker exists only
so the toolbar button can open a new tab. No web-accessible resources. CSP is
`script-src 'self'; object-src 'self'; base-uri 'self'`.

1.x required `tabs` + `sessions` ("Read your browsing history on all your signed-in devices").
V2 requires nothing that warns, so an update does not ask existing users to re-approve.

## Icons and privacy

`core/icons.ts` returns addresses to try, in this order:

1. the user's own icon;
2. a vendor-hosted icon for well-known apps whose favicon is generic (Gmail, Drive, Docs…);
3. the site's own `/favicon.ico` — no third party learns what is saved;
4. only if the user opted in: Google's icon service.

Failures are remembered for a week so a missing icon is not re-requested on every tab.
`favicon` permission (`_favicon/` API) was evaluated and not adopted: it adds an install
warning and returns a placeholder for unvisited sites that cannot be told from a real icon.

Measured in Chromium against the 58 starter apps: step 3 alone finds an icon for 35 (60%);
the rest show a monogram. With the icon service the figure is close to 100%.

## Search and commands

`routeQuery`: address → open it; `alias query` → that engine; otherwise the default engine.
"Browser default" goes through `chrome.search.query`. Queries are URL-encoded with a replacer
function, so no character in a query can alter the template.

`buildResults` ranks links, Spaces, Modes, commands, settings pages, themes and engines:
exact > prefix > word start > substring > fuzzy, plus a boost for results chosen before.
Results carry a plain-data `Action`. The same engine serves the Home search box and the
command center; in the search box a fuzzy guess or an engine-by-name match never takes Enter
away from the web search.

## Themes and motion

A theme is a flat map of tokens over three layers: backdrop (`--backdrop`, `--glow`),
atmosphere (`--grain`, `--vignette`, `--scan`) and interface (ink, surfaces, accent, radius,
blur, fonts, label style, `--tint-strength`, `--icon-filter`). Components read tokens only.

Motion uses one scale (`styles/base.css`): `--t-feedback` 120 ms, `--t-ui` 200 ms,
`--t-panel` 300 ms, `--t-scene` 520 ms, with two easing curves. `prefers-reduced-motion`
removes all animation and transitions; hover and focus colour changes remain.

## Performance

Critical path: read mirror → apply theme → render Home. Deferred until needed: settings,
onboarding, Turkish strings (separate chunks), recently closed tabs, icons.

Budgets are enforced by `npm run size` (gzip): startup JS ≤ 44 kB, CSS ≤ 9 kB, all JS
≤ 60 kB. No fonts or media are shipped. Measured: Home is mounted about 60 ms after
navigation (median of 7 new tabs, headless Chromium).

## Develop

```
npm install
npm run dev         # preview at http://localhost:5173/newtab.html (localStorage, no chrome.*)
npm run check       # typecheck + lint + unit tests + build + bundle budget
npm run build       # → dist/ : load this folder unpacked in chrome://extensions
npm run test:e2e    # builds, then runs the extension in real Chromium (needs: npx playwright install chromium)
npm run visual      # screenshots at the supported sizes → e2e/.out/
```

`npm run build:e2e` writes `dist-e2e/`, identical except that optional permissions are
declared as required, because a test cannot click the browser's permission prompt.

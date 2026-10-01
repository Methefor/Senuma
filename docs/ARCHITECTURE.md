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
    background.ts        background model, curated presets, validation
    themes.ts            themes as typed token sets
    search.ts            search router
    commands.ts          command engine: query → ranked, grouped results → Action
    icons.ts             which icon addresses to try, in privacy order
    catalog.ts, setup.ts starter categories, onboarding, import organizer
  browser/             the only place chrome.* and IndexedDB are used
    kv.ts                key-value storage (chrome.storage.local, or localStorage in preview)
    assets.ts            uploaded wallpapers (IndexedDB blobs)
    search.ts, bookmarks.ts, sessions.ts, permissions.ts, iconCache.ts
    result.ts            BrowserResult<T>: ok | unavailable | denied | failed
  storage/             state persistence and the stores
  app/                 App shell, shortcuts, appearance, shared side effects
  features/
    home/                Home: search, Continue, Spaces, dock
    background/          Backdrop renderer, image processing
    customize/           Customize panel, theme picker
    spaces/, command/, settings/, onboarding/
  ui/                  primitives: Icon, AppIcon, Overlay, menu, toasts, useFlip
  i18n/                en (source of truth), tr (loaded on demand)
  styles/              base (tokens, backdrop, motion, primitives), home, overlays
e2e/                   real-Chromium runtime test and visual review
scripts/size.mjs       bundle budget
```

## Data model (schema 4)

One normalized `AppState` (`core/types.ts`). `spaces` and `items` are id-keyed maps; order
lives in arrays. IDs are random and stable; `updatedAt` stamps every change (last write wins
between tabs today, and between devices later).

- **Space** — name, optional note, glyph, accent, ordered groups of item IDs.
- **Mode** — a working environment. It may override: visible Spaces and their order
  (`spaceIds`), theme (`themeId`), background (`background`), default search (`providerId`)
  and the dock (`dock`). Anything absent falls through to the user's defaults. No other
  inheritance.
- **Dock** — ordered `DockEntry[]` of links and Spaces; shared, unless a Mode has its own.
- **Background** — `{ source, fit, x, y, blur, dim, saturation }`, where `source` is one of
  `theme | solid | gradient | preset | upload`. See "Backgrounds" below.
- **wallpapers** — metadata for uploaded images: size, average colour, brightness, and a
  few hundred bytes of preview. The pixels are not in the state.
- **SearchProvider** — `{ id, name, aliases, urlTemplate?, browserDefault? }`. Engines are data.
- **RecentItem** — `{ url, title, at, count, spaceId? }`, written only when a link is opened
  from this page. Bounded to 30.
- **usage** — command-result key → last used, bounded to 40; used only to rank results.

## State

- **Persistent** — `app` store. Changed only through `update(transition)` with a pure function
  from `core/ops.ts`. Writes are coalesced (250 ms) and flushed on `pagehide`.
- **Session UI** — `ui` store (open panel, menu, toasts, and the look being previewed in
  Customize). Never saved.
- **Derived** — computed at render (`visibleSpaces`, `activeDock`, `savedAppearance`).

## Storage, migration, data safety

| What | Where | Why |
|---|---|---|
| Setup (`bos.state`) | `chrome.storage.local` | source of truth; survives everything short of uninstall |
| Paint cache | `localStorage` mirror of the same | synchronous, so the first frame is the real page |
| Restore points (`bos.snapshots`) | `chrome.storage.local` | newest five |
| Uploaded wallpapers | IndexedDB (`bos-assets`) | stores Blobs natively and off the main thread; `chrome.storage` would need base64 in JSON (a third larger, 10 MB total) |
| Icon failures | `localStorage` | small, disposable |

Boot (`resolveState`): stored state → legacy `ntf_data` → fresh.

- **Idempotent.** Legacy data is converted only when no V2 state exists. Once one does —
  even a damaged one — legacy data is never read again.
- **Legacy data is read-only.** `ntf_data` and `app_version` are never written or removed.
- **Schema upgrades** run through `MIGRATIONS[n]` (n → n+1), then `sanitize`, which drops
  damaged records one by one instead of failing the page.
- **Restore points.** Before a setup is replaced (import → replace, restore, reset) the
  current one is saved. If that save fails, the replacement does not happen.
- **Undo** is a targeted inverse, not a state rollback: it restores exactly what a deletion
  removed and keeps later edits. Available while the toast is shown (7 s).
- **Import** validates everything, then offers merge (adds, never removes) or replace.

## Themes and tokens

A theme is one value for every token in `TokenName` (`core/themes.ts`); a theme that misses
a token does not compile. Tokens are semantic and grouped:

| Group | Tokens |
|---|---|
| Background | `--bg-color`, `--bg-image`, `--bg-glow`, `--bg-wash` |
| Atmosphere | `--atmo-grain`, `--atmo-vignette`, `--atmo-scan`, `--atmo-bloom`, `--atmo-fog` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary` |
| Surface | `--surface-primary`, `--surface-secondary`, `--surface-glass`, `--border-subtle`, `--border-strong` |
| Accent | `--accent`, `--accent-contrast`, `--danger` |
| Shape, depth | `--radius-control`, `--radius-card`, `--blur-surface`, `--shadow-card` |
| Type | `--font-ui`, `--font-display`, `--display-*`, `--greeting-size`, `--label-*` |
| Icons, colour | `--tint-strength`, `--icon-filter` |
| Motion | `--motion-scale` (multiplies `--motion-fast/standard/panel/scene`) |
| Composition | `--hero-justify`, `--hero-text` |
| Components | `--space-*`, `--dock-*`, `--palette-*` |

Components read tokens only; no stylesheet names a theme. Fonts are system stacks: no
webfont is shipped. Monochrome themes tint icons on Home; where an app is being chosen
(hover, selected result, inside a Space, the search engine) its true colours return.

## Backgrounds

`features/background/Backdrop.tsx` paints, bottom to top: the theme's own background → the
picture (if any) → the theme's wash → fog → glow → bloom → vignette/scanlines → grain. The
theme layer is always there, so a picture that is missing, corrupt or still decoding never
leaves a blank page.

- **Sources**: one renderer per `source.kind`. A new kind (video, cinemagraph, animated
  ambient) is one more union member and one more renderer; storage and validation are untouched.
  Video is deliberately not built yet.
- **Curated presets** are drawn in CSS (0 bytes shipped). The model also accepts bundled
  image files and has categories for photographic sets, which ship empty for now.
- **Uploads** are validated (JPEG/PNG/WebP/AVIF, ≤ 25 MB, must decode), resized to at most
  2560 px on the long edge, re-encoded as WebP, and stored in IndexedDB with a thumbnail.
  Up to eight are kept.
- **No flash, no shift**: the image's average colour and a ~1 kB blurred preview live in the
  settings and are painted in the first frame; the full picture fades in once decoded. The
  IndexedDB module is loaded only when an upload is actually in use.
- **Readability**: the wash takes the theme's colour (dark themes darken, light themes veil),
  resting surfaces become glass over a picture, and text on the backdrop gets a soft halo.
  Picking a picture suggests a wash from its brightness.
- **Privacy**: images never leave the browser profile. Nothing is fetched from the network
  for wallpapers; there is no online gallery.
- **Backup files hold no pixels.** A background that points at an upload is exported as the
  theme default; theme, presets, colours and adjustments are exported. Restore points are
  local, so they keep the reference; if the image is gone, the theme background is shown and
  the reference is removed the next time Customize opens.

## Atmosphere and motion

Atmosphere strengths are theme tokens (0–1) multiplied by one user choice: Off (0),
Subtle (0.55), Cinematic (1). All effects are CSS gradients, one inline noise tile and one
compositor-only animation (the glow "breathing"); there is no canvas.

Motion uses four durations (`--motion-fast` 120 ms, `-standard` 200, `-panel` 280, `-scene` 480)
and two curves. A Mode or theme change is one coordinated transition: the backdrop cross-fades
while Spaces and dock replay a single shared entrance. A Space opens from the direction of
whatever launched it. `prefers-reduced-motion` removes all animation and transitions; hover and
focus colour changes remain.

## Customize

One panel (`features/customize`) holds theme, background, atmosphere and motion. Changes are
a draft in the `ui` store shown live on the page beside the panel; nothing is written until
Apply, and Cancel or Escape restores the saved look. With a Mode active, the look can be
applied to that Mode only. The Mode editor (Settings → Modes) describes each Mode by what
changes when you switch to it and hands look changes to this same panel.

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

## Icons and privacy (decided)

New installs are private by default. `core/icons.ts` tries, in order: the user's own icon →
a vendor-hosted icon for well-known apps whose favicon is generic → the site's own
`/favicon.ico` → a letter. A third-party icon service is used only if the user turns it on,
and the setting says that it sends saved site names to that provider. Users upgraded from 1.x
keep the service they already had, so their page does not change under them.

Measured in Chromium against the starter apps, the private path finds an icon for about 60%.

## Keyboard focus on a new tab (decided)

Chrome puts keyboard focus in the address bar when a new tab opens. This page leaves that
alone: no redirects, no tab recreation, no focus tricks. Once the page has focus (a click or
Tab), every shortcut works immediately: Ctrl/Cmd+K, `/`, `1`–`9`, `M`.

## Search and commands

`routeQuery`: address → open it; `alias query` → that engine; otherwise the default engine.
"Browser default" goes through `chrome.search.query`. The search field shows the engine in
use, switches it from a compact menu, and names the engine an alias will use while typing.

`buildResults` ranks links, Spaces, Modes, commands, settings pages, themes and engines:
exact > prefix > word start > substring > fuzzy, plus a boost for results chosen before.
Every action result starts with a verb used consistently (Open, Switch to, Search, Create,
Use, Customize). The command center shows results under group headings; the first result is
always what Enter runs.

## Performance

Critical path: read mirror → apply theme → render Home. Everything else is deferred: Space
view and editors (prefetched when idle), settings, customize, onboarding, Turkish strings,
wallpaper pixels, recently closed tabs, icons.

Budgets, enforced by `npm run size` (gzip): startup JS ≤ 44 kB, CSS ≤ 9.5 kB, on-demand JS
≤ 22 kB, language pack ≤ 8 kB. No fonts or media are shipped.

## Develop

```
npm install
npm run dev         # preview at http://localhost:5173/newtab.html (localStorage, no chrome.*)
npm run check       # typecheck + lint + unit tests + build + bundle budget
npm run build       # → dist/ : load this folder unpacked in chrome://extensions
npm run test:e2e    # builds, then runs the extension in real Chromium (needs: npx playwright install chromium)
npm run visual      # screenshots at the supported sizes and themes → e2e/.out/
```

`npm run build:e2e` writes `dist-e2e/`, identical except that optional permissions are
declared as required, because a test cannot click the browser's permission prompt. What a
person must check by hand is in `MANUAL_QA.md`.

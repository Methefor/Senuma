# Architecture

Internal codename: **Browser OS**. The published extension name is unchanged and lives in one
place (`src/brand.ts`); nothing else hardcodes it.

## Audit of the 1.x extension (what this replaces)

| | Finding |
|---|---|
| Stack | Vanilla JS, no build, no types, no tests, no dependencies. One 1,344-line `App` object, 1,642 lines of CSS, ~500 lines of modal markup. |
| Storage | `chrome.storage.local` key `ntf_data`: folders → links, with section "headers" stored as fake links. `load()` replaced user data with defaults whenever `app_version !== '1.2'`. |
| Manifest | MV3, `storage` + `tabs` + `sessions`, new-tab override, no-op service worker. |
| Pro / payments | None. `isPro` is a local flag; pricing buttons show a "coming soon" toast; Shift+Alt+P grants a demo. Export/import, themes and a 3-folder limit were gated behind it. |
| Analytics | None. |
| Bugs | `addFolder()` threw on an undefined variable; most settings toggles were visual only; `confirm()` ignored its arguments. |

**Keep** storage keys (read-only, for migration) · recently-closed tabs · EN/TR copy.
**Refactor** folders → Spaces · headers → groups · four hardcoded themes → token engine · search → router.
**Remove** the paywall with nothing behind it · the open-tabs sidebar · placeholder sticky notes.
**Migrate** folders, links, section headers, colours, theme, language, the `isPro` flag.

The 1.x files (`index.html`, `js/`, `css/`, marketing pages) are untouched on this branch so the
old build stays loadable. They are deleted in a later, explicit step.

## Layout

```
newtab.html            entry
src/
  brand.ts             names, version, storage keys
  manifest.ts          manifest.json is generated from this at build time
  core/                pure logic, no DOM, fully unit-tested
    types.ts           data model
    ops.ts             state transitions: (state, args) => state
    migrate.ts         legacy import + schema migrations
    sanitize.ts        rebuilds a valid state from anything on disk
    search.ts          universal search router
    commands.ts        command engine (query → ranked results → Action)
    catalog.ts         starter categories + domain → category knowledge
    setup.ts           onboarding starters, import organizer
    themes.ts          theme presets as token sets
    backup.ts          JSON export / import
  storage/             chrome.storage adapter, stores
  i18n/                en (source of truth for keys), tr
  ui/                  primitives: Icon, AppIcon, Overlay, menu, toasts
  features/            home, spaces, command, settings, onboarding
  app/                 App shell, shortcuts, side effects
  styles/              base (tokens, primitives), home, overlays
```

## Data model

One normalized `AppState` (`core/types.ts`): `spaces` and `items` are id-keyed maps, order is
held in arrays (`spaceOrder`, each group's `itemIds`). A Space has groups; a Mode is a list of
Space ids plus optional theme and search overrides. IDs are random and stable, and
`updatedAt` stamps every change, so last-write-wins sync can be added without a schema change.

A backup file is the same state minus recent activity; that file format is also the future
"shareable setup" format (Spaces + Modes + theme).

## State

- **Persistent** — `app` store. Changed only through `update(transition)` with a pure function
  from `core/ops.ts`. Writes are debounced (250 ms) and flushed on `pagehide`.
- **Session UI** — `ui` store (open panel, menu, toasts). Never saved.
- **Derived** — computed at render (`visibleSpaces`, `pinnedItems`, `effectiveThemeId`).

No state library: two ~20-line stores cover it.

## Storage and migration

`chrome.storage.local` key `bos.state` is the source of truth. A `localStorage` mirror of the
same value lets the page paint synchronously; on boot the newer of the two wins.

Boot order (`core/migrate.ts → resolveState`): stored state → legacy `ntf_data` → fresh.
Legacy data is **only read**. It is never rewritten or removed, so it remains a full backup of
the 1.x install. Stored states pass through `MIGRATIONS[n]` (schema n → n+1) and then
`sanitize`, which drops damaged records individually instead of failing the page.

## Themes

A theme is a flat map of CSS custom properties covering three layers: backdrop
(`--backdrop`), atmosphere (`--grain`, `--vignette`) and interface (ink, surfaces, accent,
radius, blur, fonts). Components read tokens only; there is no per-theme CSS. Adding or
loading a theme is adding data.

## Search and commands

`routeQuery` classifies input as an address, an aliased search (`y lofi`), or a default search.
The default goes through `chrome.search.query`, so the user's browser search engine is
respected — a Chrome Web Store requirement for new-tab pages.

`buildResults` returns ranked results whose `Action` is plain data. An AI interpreter can be
added later by producing the same Actions; nothing depends on one.

## Permissions

`storage`, `tabs`, `sessions` (already granted to 1.x installs; needed for recently closed
tabs), `search` (default-engine search). `bookmarks` is optional and requested only when the
user starts an import.

## Privacy

Local only; no account, analytics or network calls except site icons, which come from
Google's favicon service (as in 1.x) and can be turned off in Settings → Privacy. Continue
records only links opened from this page.

## Develop

```
npm install
npm run dev        # preview at http://localhost:5173/newtab.html (uses localStorage)
npm test           # unit tests
npm run build      # typecheck + build to dist/ — load dist/ as an unpacked extension
```

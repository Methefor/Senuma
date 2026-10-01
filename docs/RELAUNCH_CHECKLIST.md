# Relaunch checklist

Everything public-facing that stops being true when V2 ships, and every decision that must be
made before it does. Nothing here has been changed yet: the legacy files are untouched and
nothing has been published.

## Decisions needed

- [ ] **Product name.** UI placeholder is "Browser OS" (`src/brand.ts → productName`). The
      store name is still "NewTabFolders" (`extensionName`).
- [ ] **Release version.** Dev builds use manifest version `1.99.x` with the label
      `2.0.0-alpha.x`. The published number must be higher than the live 1.55.
- [ ] **Free / Pro.** V2 has no paid tier and no limits. 1.x advertised one (below) but never
      had working payments; `legacy.isPro` is carried over in case it should be honoured.
- [x] **Default icon source.** Decided: private by default for new installs (site icons, then
      a letter); the icon service is opt-in with the disclosure shown; users upgraded from 1.x
      keep the service they already had.
- [ ] **Languages.** 1.x offered TR, EN, DE, FR, PT, ES. V2 has EN and TR; other users get English.
- [x] **New-tab keyboard focus.** Decided: normal Chrome behaviour is kept. Focus starts in
      the address bar; no focus-stealing workarounds. Shortcuts work once the page has focus.
- [ ] **Photographic wallpapers.** The curated set is drawn in CSS and ships no image files.
      Photographic categories (nature, architecture) need licensed images and a size budget.

Manual checks to run in a real Chrome window before release are in `MANUAL_QA.md`.

## Public claims that become false

### Pro plan, limits, pricing

| Where | Claim |
|---|---|
| `manifest.json` (legacy) description | "Free plan available. PRO: unlimited folders, themes, cloud sync." |
| `index.html` upgrade modal | Monthly $4.99, Yearly $39.99, Lifetime $99.99; "Secure payment via Stripe"; "30-day money-back guarantee"; "No ads, forever"; "Priority support"; "VIP support" |
| `index.html` header / profile menu | "Add new space — Pro only"; Pro features: unlimited spaces, collapsable folders, cross-device sync, space sharing |
| `index.html` settings | Light / Cyberpunk / Nord themes and JSON export/import marked PRO |
| `pricing.html` (whole page) | Free vs Pro table: unlimited spaces, unlimited bookmarks, cross-device sync, space sharing, priority support |
| `landing.html` pricing + FAQ | "free plan gives you 3 folders"; Unlimited Folders; Cloud Sync; Lifetime plan; Stripe; "30-day money-back on PRO"; meta description "Free plan available" |

None of these exist in V2 (no payments, no sync, no sharing, no limits), and several never
existed in 1.x either (Stripe checkout, cloud sync, space sharing).

### Features that are gone or changed

| Where | Claim | V2 |
|---|---|---|
| `README.md`, `guide.html`, `landing.html` | Sidebar of open tabs; drag a tab into a folder; close duplicates; sort tabs | Removed. V2 does not read open tabs. |
| `README.md` | Themes: Dark, Light, Cyberpunk, Nord | Dusk, Noir, Atelier, Fjord, Editorial, Phosphor |
| `README.md` | Six languages | EN, TR |
| `README.md`, `guide.html` | Folders, "Click to add", right-click to add sticky notes | Spaces, groups, Modes, command center; no sticky notes |
| `README.md` | "tabme-inspired", "Tabme-Style Header" | Remove; V2 has its own identity |
| `README.md` | "Storage: Chrome Storage sync/local & LocalStorage" | `chrome.storage.local` only |
| `changelog.html` | 1.x history only | Needs a V2 entry |
| `landing.html` | "No tracking. No analytics. No account required. Your data lives on your device only." | Still true for data. Add the icon disclosure: icons load from the sites themselves, or from Google's icon service if enabled. |

### Product name

"New Tab Folders" / "NewTabFolders" appears in: both manifests' `name`, `landing.html`,
`pricing.html`, `guide.html`, `changelog.html` (titles and headings), `README.md`,
`index.html`, legacy `js/translations.js`, the backup file name in 1.x, and the repository URL.

### Screenshots

All six in `assets/screenshots/` show the 1.x interface (dashboard, settings menu, help menu,
guide, changelog, pricing). `store-assets/screenshots/` is empty. New captures can start from
`npm run visual`.

## Store listing

- [ ] New description, screenshots and promo tiles.
- [ ] Permission justification text: `storage`, `search`; optional `bookmarks`, `tabs`, `sessions`.
- [ ] Privacy practices form: no data collected or transmitted; remote requests are icons only.
- [ ] Single-purpose statement still fits (new-tab page).
- [ ] Confirm against current Chrome Web Store policy that the default search going through
      `chrome.search` satisfies the new-tab search requirement.

## Before publishing

- [ ] Manual pass in a real Chrome window: permission prompts (bookmarks, recently closed
      tabs), new-tab focus behaviour, icons with a normal browsing profile.
- [ ] Upgrade test on a copy of a real 1.x profile (the automated test uses a fixture).
- [ ] Remove or archive the legacy files; point the build output at the store package.
- [ ] Replace `README.md` product copy; keep the development section.

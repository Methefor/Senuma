# Chrome Web Store submission sheet — Senuma 2.0.0

Everything the developer dashboard asks for, in one place, for the update of the existing item
`oghlifenjhpbebcdeboejbmemelkfobe`. Prepared 2026-10-03. **Nothing has been uploaded or
submitted**; the owner performs and approves each step in the dashboard.

## 1. Package

| | |
|---|---|
| File | `release/Senuma-2.0.0.zip` |
| SHA-256 | `c39cd5723256833f913e168bcfcc159dcedc16225fa70a6fb99f35035d511b1d` |
| Reproduce | `npm run package` on `rebuild/browser-os` gives the same bytes (RELEASE_STATUS.md, “Canonical package”) |
| Manifest | version 2.0.0, MV3; permissions `storage`, `search`; optional `bookmarks`, `tabs`, `sessions`; no host permissions, no content scripts, no remote code |

Check the hash of the file being uploaded matches the one above.

## 2. Store listing tab

| Field | Value |
|---|---|
| Title (from the manifest) | Senuma — New Tab Workspace |
| Summary (from the manifest, 107 characters) | Turn every new tab into a personal workspace with Spaces, Modes, search, themes and fast access to the web. |
| Description | The long description in STORE_LISTING.md, unchanged |
| Category | Productivity |
| Language | English |
| Store icon | `icon-128.png` |
| Screenshots (1280×800) | `screenshot-1-home.png` … `screenshot-8-privacy.png`, in that order |
| Small promo tile (440×280) | `tile-440x280.png` |
| Marquee (1400×560) | `hero-1400x560.png` |
| Official URL / homepage | leave as is until a Senuma site exists |
| Support | rumeliskelesi+senuma@gmail.com (temporary) |

Assets: `release/Senuma-2.0.0-store/` (regenerate with `npm run store:assets`).

## 3. Privacy practices tab

Exact values: STORE_PRIVACY_CHANGES.md. In short:

- Single purpose: *A new tab page that organizes your links into Spaces and lets you search the web.*
- Justifications for `storage`, `search`, `bookmarks`, `tabs`, `sessions` as listed there; remove the ones for `identity`, `tabGroups` and the six host permissions.
- Remote code: **No**.
- Data usage: **every box unticked**; all three certifications ticked.
- Privacy policy URL: `https://methefor.github.io/Senuma/privacy.html` (live, “Last updated: October 3, 2026”, checked 2026-10-03).

## 4. Distribution

- Visibility unchanged (public). Staged rollout if offered, to watch Chrome's “Change back to Google?” bubble on real updates (RELEASE_STATUS.md).

## 5. Before pressing Submit (owner)

1. Dashboard shows the current published version (expected 1.80/1.8.0); 2.0.0 is newer.
2. One hands-on session with MANUAL_QA.md on the canonical package, recorded.
3. The SENUMAC hold (SENUMA_BRAND.md) is acknowledged as the owner's accepted risk; no text claims the name is cleared.
4. Uploaded file's SHA-256 equals section 1.
5. Explicit go-ahead to submit.

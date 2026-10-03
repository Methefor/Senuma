# Chrome Web Store submission sheet — Senuma 2.0.0

This sheet records the values used for the update of the existing Chrome Web Store item
`oghlifenjhpbebcdeboejbmemelkfobe`. The real dashboard wording was inspected on 2026-10-03
before the privacy declaration below was finalized.

## 1. Package

| | |
|---|---|
| File | `release/Senuma-2.0.0.zip` |
| SHA-256 | `c39cd5723256833f913e168bcfcc159dcedc16225fa70a6fb99f35035d511b1d` |
| Manifest | Version 2.0.0, MV3; permissions `storage`, `search`; optional `bookmarks`, `tabs`, `sessions`; no host permissions, content scripts, or remote code |

## 2. Store listing

| Field | Value |
|---|---|
| Title | Senuma — New Tab Workspace |
| Summary | Turn every new tab into a personal workspace with Spaces, Modes, search, themes and fast access to the web. |
| Description | `STORE_LISTING.md` plus the migration note used in the dashboard |
| Category | Workflows and Planning |
| Language | English; the description states that the product UI supports English and Turkish |
| Screenshots | Home, Spaces, Modes, Command Center, Personalization |
| Homepage | `https://github.com/Methefor/Senuma` |
| Support | `https://github.com/Methefor/Senuma/issues` |

## 3. Privacy practices

### Dashboard category wording inspected

The dashboard defines **Web history** as the list of web pages a user has visited together
with associated information such as page title and visit time. Senuma's optional Recently
Closed / Continue feature reads recently closed page entries through Chrome's `tabs` and
`sessions` APIs, so this category must be declared even though Senuma keeps the handling on
the device.

The adjacent **User activity** category covers behavior such as network monitoring, clicks,
mouse position, scrolling, or keystroke logging. Senuma does not perform that behavior and
does not run analytics, so that category remains unticked.

### Values

- **Web history: ticked.** Used only when the user enables Recently Closed / Continue. The
  entries are read live from Chrome so Senuma can display and reopen them. Senuma does not
  store or transmit the list.
- Personally identifiable information, health information, financial/payment information,
  authentication information, personal communications, location, user activity, and website
  content: **unticked**.
- `tabs` and `sessions`: optional; requested only for the user-facing recently closed feature.
- `bookmarks`: optional; requested only when the user chooses bookmark import.
- Remote code: **No**.
- All three limited-use certifications: **ticked**.
- Privacy policy: `https://methefor.github.io/Senuma/privacy.html`.
- Custom wallpapers stay in local browser storage.

Senuma 2.0 has no account, authentication, cloud sync, analytics, payment processing, host
permissions, or Senuma server receiving browsing/session information.

## 4. Distribution and review

- Free, public, and available in the existing regions.
- Automatic publishing after review is disabled. Review approval does not publish the update.
- The published version remains 1.8.0 until a separate publication action.
- The privacy-corrected 2.0.0 update was submitted on 2026-10-03; dashboard status: **Pending review**.

## 5. Release checks

1. The uploaded package is version 2.0.0 and preserves the existing extension identity.
2. Package permissions and the privacy declarations above agree.
3. The public privacy policy describes optional bookmarks and recently closed access.
4. The Senuma naming-clearance hold remains documented in `SENUMA_BRAND.md`.
5. Human QA from `MANUAL_QA.md` remains a gate before public publication.

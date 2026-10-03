# Store listing — Senuma (nothing submitted)

The live listing is untouched. Publishing any of this needs explicit approval. Title and
summary are final (owner, 2026-10-03) and come from the manifest; the field-by-field
submission sheet is STORE_SUBMISSION.md.

## Copy

| Field | Value |
|---|---|
| Title | Senuma — New Tab Workspace (approved 2026-10-03; also the manifest name) |
| Short description (132 max) | Turn every new tab into a personal workspace with Spaces, Modes, search, themes and fast access to the web. (107) |
| Tagline | Make the browser yours. |
| Category | Productivity |
| Support / privacy contact | rumeliskelesi+senuma@gmail.com (temporary, until a Senuma domain exists) |

**Long description**

> Senuma is your personal place on the web.
>
> Open a new tab and see what you actually use, gathered into Spaces: work, code, media,
> whatever your day is made of. Switch Mode and the page changes with you: different Spaces,
> a different look, a different search. Press Ctrl+K (⌘K) and type to open anything.
>
> • Spaces — everything for one kind of activity, together
> • Modes — a different new tab for work, for code, for the evening
> • One search box — the web through your browser's default engine, plus your own links
> • Command center — open, switch and search from the keyboard
> • Continue — pick up the links you opened here
> • Your look — six themes, photographs, or your own images
>
> On your device. No account, no analytics, no tracking.
>
> Previously New Tab Folders. Same extension, same developer; your folders become Spaces and
> everything you saved is kept.

**What's new (for the update)**

> New Tab Folders is now Senuma. Same product, a new name and a completely redesigned experience.
> Your Spaces, links and settings came with you.

**Privacy summary (store privacy tab)**

> Senuma stores your Spaces, links and settings in your browser, on your device. It has no
> account, no analytics and no tracking, and sends nothing to its developer. Searches go to
> your browser's default search engine or to a provider you choose. Bookmarks and recently
> closed pages are read only if you turn those features on. Images you add stay on your device.

Data collected: none. Remote code: none. Details: PRIVACY_FACTS.md.

## Assets (generated locally by `npm run store:assets` into `drafts/store/`)

| File | Use |
|---|---|
| `icon-128.png` | Store icon |
| `screenshot-1-home.png` … `screenshot-8-privacy.png` | Eight captioned 1280×800 screenshots: Home, Spaces, Modes, Search, Command center, Personalization, Themes, Privacy |
| `hero-1400x560.png` | Marquee promo |
| `tile-440x280.png` | Small promo tile |

Screenshots are taken with the “letters only” icon setting and a dock of GitHub, Vercel and
Letterboxd, so no third-party logo is shown larger than the product itself allows.
The landing-page draft is `drafts/site/index.html`. It carries no reviews, ratings or user counts.

## Single purpose

> A new tab page that organizes your links into Spaces and lets you search the web.

Spaces, Modes, the dock, the command center, appearance and backup all serve that. There is
no unrelated feature (no coupons, feeds, weather or notes).

## Search — notes for the reviewer

- The search box sends the query to the browser's default search engine through
  `chrome.search`. The extension does not set, change or read the default engine.
- Other providers are used only when the person picks one or types its shortcut; the
  provider's name is shown first. No partner presets, no affiliate tags.
- `chrome_settings_overrides` is not used.

## Permission justifications

| Permission | Justification |
|---|---|
| `storage` | Saves the user's Spaces, links and settings on the device. |
| `search` | Sends the user's search to their default search engine. |
| `bookmarks` (optional) | Only when the user chooses “Import browser bookmarks”: reads bookmarks once. Never modifies them. Released after the read. |
| `tabs`, `sessions` (optional) | Only when the user turns on recently closed pages: lists and reopens them. Not stored. |

1.x required `tabs` and `sessions` at install; V2 requires neither, so the update asks for fewer permissions.

## 1.x claims that must not be carried over

| Old claim | In V2 |
|---|---|
| “Free plan available”, “PRO: unlimited folders”, “PRO: themes” | Removed. No plans, no limits, nothing gated. A future Senuma Pro is not part of this release. |
| “Cloud Sync”, “in sync across all my machines” | Removed. Not in V2. Replacement: export and import a backup file. |
| “Zero load time” | Removed. If speed is claimed, use a measured figure. |
| Testimonials, “Loved by productivity nerds” | Removed unless each is real, attributable and about V2. |
| Pricing page | Removed. |
| “Organize your bookmarks with beautiful folders” | Replaced: Spaces for everything you do online. |

## Dashboard changes that go with the update

- Privacy practices: the published listing declares personally identifiable information, authentication information, location and website content. Senuma collects none of these; every box must be cleared and the justifications replaced with the table above.
- Remove the Pro, pricing and cloud-sync text from the description.
- Permission justifications for `identity`, `tabGroups` and the six host permissions are no longer needed.

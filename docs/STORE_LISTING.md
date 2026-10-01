# Store listing preparation (draft — nothing submitted)

The live listing is untouched. This is the material for the V2 submission.

## Single purpose

> A new tab page that organizes your links into Spaces and lets you search the web.

Everything in the package serves that: Spaces, Modes (which Spaces show), the dock, the
command center (finds your links, switches Modes, searches), appearance, backup. There is no
unrelated feature (no coupons, no feeds, no weather, no notes).

## Search — notes for the reviewer

- The search box sends the query to **the browser's default search engine** through the
  `chrome.search` API. The extension does not set, change or read the default engine and does
  not replace the address bar's search.
- Other providers (YouTube, GitHub, Wikipedia…) are used only when the person explicitly picks
  one or types its shortcut (`y cats`). The provider's name is shown before the search is sent.
- People can add their own provider by URL template. Nothing is preset by a partner; there is
  no affiliate tag on any provider URL.
- `chrome_settings_overrides` is not used.

## Positioning draft

**Short description (132 max):**
“Your new tab as a launch surface: Spaces for everything you do online, one search box, and a
command center.” (106)

**Long description, first lines:**
“Open a new tab and see what you actually use, grouped into Spaces: work, code, media, whatever
your day is made of. Switch Mode and the page changes with you: different Spaces, a different
look, a different search. Press Ctrl+K and type to open anything.

Everything stays on your device. No account, no analytics.”

## Claim audit: the 1.x listing against V2

| Old claim | Status in V2 | Replacement |
|---|---|---|
| “Organize your bookmarks with beautiful folders” | Changed: Spaces, not folders; links are the user's own, not Chrome's bookmarks | “Spaces for everything you do online” |
| “Free plan available” | **Remove.** There are no plans in V2 | — |
| “PRO: unlimited folders” | **Remove.** No limit and no PRO | “As many Spaces as you like” |
| “PRO: themes” / “Dark, Light, Cyberpunk, Nord” | **Remove/replace.** Six different themes, all included | “Six themes, photographs, your own images” |
| “Cloud Sync” / “in sync across all my machines” | **Remove. Not in V2.** Claiming it would be false | “Export and import a backup file” |
| “Unlimited links” | True | keep, plainly |
| “Zero load time” | **Reword.** Not literally true | “Opens instantly: about 50 ms to a usable page in tests” (re-measure before use) |
| “Instant Search” | True for the user's own links | “Find any saved link as you type” |
| “Export / Import” | True | keep |
| “Privacy First” | True and now specific | “Stored on your device. No account, no analytics.” |
| Testimonials (“Loved by productivity nerds”) | **Remove** unless each one is real, attributable and about V2 | — |
| Pricing page | **Remove or rewrite**; it describes PRO and sync | — |

Legacy PRO: the 1.x flag had no purchase record behind it. V2 has no paid plan, nobody is
told they own one, and nothing is gated (RELEASE_STATUS.md, H4).

## Permission justifications (store form)

| Permission | Justification |
|---|---|
| `storage` | Saves the user's Spaces, links and settings on the device. |
| `search` | Sends the user's search to their default search engine. |
| `bookmarks` (optional) | Only when the user chooses “Import browser bookmarks”: reads bookmarks once to offer them as links. Never modifies them. Released after the read. |
| `tabs`, `sessions` (optional) | Only when the user turns on “recently closed tabs”: lists and reopens recently closed pages. Not stored. |

1.x required `tabs` and `sessions` at install. V2 requires neither, so the update asks for
**fewer** permissions and cannot trigger Chrome's “needs new permissions” disable.

## Screenshot storyboard (1280×800)

| # | Shot | Says |
|---|---|---|
| 1 | Home, Dusk theme, five Spaces, dock | “Everything you use, one calm page” |
| 2 | Command center with “git” typed | “Ctrl+K opens anything” |
| 3 | Dev Mode (Phosphor) beside Chill Mode (Atelier) | “A different new tab for each part of your day” |
| 4 | A Space open: groups and links | “Spaces hold what belongs together” |
| 5 | Customize with the photograph gallery | “Make it yours: themes, photographs, your own images” |
| 6 | Settings → Privacy fact list | “On your device. No account, no analytics.” |

Captions must not show third-party logos larger than icon size, and no shot should imply a
partnership with any service shown. Final shots are taken after the name is decided.

## Before submitting

- Rewrite the privacy policy page for V2.
- Decide the name (BRAND_DIRECTION.md) and the version number (`src/brand.ts`).
- Take down or rewrite `landing.html` and `pricing.html`.

# Store listing — Senuma (nothing submitted)

The live listing is untouched. Publishing any of this needs explicit approval. Wording comes from
MESSAGING_SYSTEM.md; screenshots, GIFs and video from MEDIA_PLAN.md; the field-by-field
submission sheet is STORE_SUBMISSION.md.

2.0.0 was submitted with the shorter description kept in git history (commit 46336e6). The copy
below is for the 2.0.1 update; title and summary are unchanged because they come from the manifest.

## Fields

| Field | Value |
|---|---|
| Title (manifest name) | Senuma — New Tab Workspace |
| Summary (manifest description, 132 max) | Turn every new tab into a personal workspace with Spaces, Modes, search, themes and fast access to the web. (107) |
| Category | Productivity |
| Listing language | English. The package has no `_locales`, so the store offers no Turkish listing; Turkish copy (MESSAGING_SYSTEM.md) is for the landing page. |
| Support / privacy contact | rumeliskelesi+senuma@gmail.com (temporary, until a Senuma domain exists) |
| Privacy policy | https://methefor.github.io/Senuma/privacy.html |

## Description (paste as plain text)

```
Make the browser yours.

Senuma turns every new tab into your own workspace: the sites you use, gathered into Spaces, with one search bar and a look that is yours.

SPACES · Everything you use, organized
A Space holds everything for one kind of activity: work, code, media, research. Start from a ready-made set or from scratch, add only the suggestions you want, and arrange links in groups. Number keys 1–9 open your first nine Spaces.

SEARCH · One search bar. Your rules.
Type a shortcut, a space and your query: "y lofi mix" opens YouTube results for "lofi mix". Shortcuts come ready for Google, YouTube, GitHub, Reddit, ChatGPT, Claude, Wikipedia and more, and you can change them or add any site that has a search page. Plain searches go to your browser's default search engine, or to one you choose, and your own links and Spaces show up as you type.

COMMAND CENTER · Everything, one shortcut away
Press Ctrl+K (⌘K on Mac) to open any link or Space, switch Mode, change theme or search. It understands plain phrases such as "switch to work mode".

MODES · A workspace for every mode
A Mode changes the whole page for what you are doing: its Spaces, and if you like its theme, background, search engine and dock. Keep work, code and evenings apart, and press M to switch.

CUSTOMIZATION · Make every new tab feel like yours
Choose one of six themes, a built-in photograph or your own image. Fill or fit it, pick the part that stays in view, set dim, blur and colour strength, and add a Subtle or Cinematic atmosphere. Every change is previewed live before you apply it.

PRIVACY · Personal by design
Your Spaces, links and settings are stored in your browser, on your device. No account, no analytics, no tracking, and nothing is sent to us. Images you add stay on your device.

BACKUP · Your setup, in one file
Export your setup as a JSON file and bring it back, merged or as a replacement; a restore point is saved first. You can also bring in your browser bookmarks or a pasted list of links.

OPTIONAL PERMISSIONS
Senuma needs only storage and search to work. Two features ask for more, and only when you turn them on:
• Import browser bookmarks: reads your bookmarks once, never changes them, and gives the permission back afterwards.
• Recently closed tabs in Continue: Chrome words this as "read your browsing history on all your signed-in devices". Senuma uses it only to list and reopen pages you recently closed; nothing is stored or sent.

GOOD TO KNOW
• Backgrounds are images stored on your device (built-in photographs or files you upload), not image links.
• Moving to another computer: export your setup and import it there. This version has no cloud sync.
• Site icons come from each site by default. You can switch to Google's icon service or to letters only in Settings → Privacy.

Your place on the web.

Previously New Tab Folders: same extension, same developer. Your folders became Spaces and everything you saved was kept.
```

## What's new in 2.0.1 (update notes)

```
• Spaces made from a ready-made set now offer more services as suggestions: add only the ones you use, one at a time.
• Default names (such as Finance or Media) now follow the interface language; names you choose never change.
• The search bar shows how search shortcuts work: try "y lofi mix".
• Clearer wording for importing a list of links.
```

## Privacy summary (store privacy tab)

> Senuma stores your Spaces, links and settings in your browser, on your device. It has no
> account, no analytics and no tracking, and sends nothing to its developer. Searches go to
> your browser's default search engine or to a provider you choose. Bookmarks and recently
> closed pages are read only if you turn those features on. Images you add stay on your device.

Data collected: none. Remote code: none. Details: PRIVACY_FACTS.md.

## Assets

Selection, captions and recapture instructions: MEDIA_PLAN.md (§1). Current images are generated
by `npm run store:assets` into `drafts/store/` (git-ignored); the 2.0.0 set is kept in
`release/Senuma-2.0.0-store/`. Screenshots use the “letters only” icon setting and a dock of
GitHub, Vercel and Letterboxd, so no third-party logo is shown larger than the product itself
allows. The landing-page draft is `drafts/site/index.html`; it carries no reviews, ratings or
user counts.

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

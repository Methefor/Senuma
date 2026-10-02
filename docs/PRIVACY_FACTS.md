# Privacy facts — Senuma 2.0 (RC 1)

Each line is something the code does, with where to check it. This is the source for the
in-product Privacy section, the store privacy form and the privacy policy.

## What is stored, and where

| Data | Where | Leaves the device? |
|---|---|---|
| Spaces, links, groups, Modes, dock, search providers, preferences | `chrome.storage.local` (`bos.state`) | No |
| Links opened from the page (max 30) and command-center ranking (max 40) | same record | No. Left out of backup files. “Clear activity” removes them. |
| Restore points (max 5) | `chrome.storage.local` (`bos.snapshots`) | No |
| Background images the user adds | IndexedDB (`bos-assets`) | No. Never in backup files. |
| A copy of the state for instant paint; icons that failed to load | `localStorage` | No |
| 1.x data (`ntf_data`) | `chrome.storage.local` | No. Read once, never changed or deleted. |

`chrome.storage.sync` is not used. There is no server.

There is no hidden history database: Senuma does not read the browser's history. “Continue”
holds only links opened from the Senuma page itself (30 at most), and recently closed pages are
read live from the browser, only when that option is on, and never stored.

Storage key names (`bos.*`, `ntf_data`) predate the Senuma name and are kept so that no one's
data is orphaned by the rename.

## Network requests the extension makes

| Request | When | Who sees what |
|---|---|---|
| None | Opening a new tab when every icon shown is packaged, an emoji or a letter | — |
| A site's own `/favicon.ico` | A saved link has no packaged mark | That site sees a request for its icon (no referrer). |
| Google's static host (`gstatic.com`) | A saved link is a Google app (Gmail, Drive, YouTube…) | Google sees a request for that product icon. |
| Google's icon service (`google.com/s2/favicons`) | **Only** if the user chose “icon service” (off for new users; kept on for 1.x users, who already had it) | Google sees the site names of saved links. |
| The default search engine | The user submits a search (`chrome.search.query`) | Whatever engine the browser is set to. |
| A named provider (YouTube, GitHub…) | The user picks it or types its shortcut | That provider. |

No analytics, no error reporting, no remote configuration, no remote code, no fonts or
wallpapers fetched from a third party.

## Permissions

| Permission | Kind | Used for | Chrome's install/prompt text |
|---|---|---|---|
| `storage` | required | Saving the setup | none |
| `search` | required | Sending a search to the browser's default engine | none |
| new tab override | required | Being the new tab page | Chrome's “Change back to Google?” bubble |
| `bookmarks` | optional | One-off import, read only. Given back right after the read. | “Read and change your bookmarks” |
| `tabs` + `sessions` | optional | Listing recently closed pages in Continue. Removed when the setting is turned off. | “Read your browsing history on all your signed-in devices” |

No host permissions, no content scripts, nothing runs on web pages.

## Decisions

- **Analytics: none in this release.** Nothing is measured. If that ever changes it needs its
  own decision, opt-in consent, a policy update and a store disclosure.
- **Accounts, sync, payments:** not present.
- The 1.x PRO flag is copied into the new state as history only. It is not sent anywhere,
  nothing reads it and nothing is unlocked by it.

## For the store privacy form

- Single purpose: a new tab page that organizes the user's links into Spaces and searches the web.
- Data collected: **none** (nothing is transmitted to the developer or third parties by the
  developer's code; icon requests go straight from the browser to the site concerned).
- Remote code: **no**.
- The privacy policy page must be rewritten for V2 before submission (the 1.x one mentions
  cloud sync and payments).

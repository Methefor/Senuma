# Chrome Web Store dashboard — privacy changes for Senuma 2.0

A plan only. Nothing here has been entered, saved or published. Facts behind every value:
PRIVACY_FACTS.md. The “current” column is what the live 1.80 listing is understood to declare;
confirm each against the dashboard before changing it.

## Privacy practices tab

| Field | Current (1.80) | Set to |
|---|---|---|
| Single purpose | bookmark folders on the new tab | A new tab page that organizes your links into Spaces and lets you search the web. |
| `storage` justification | — | Saves the user's Spaces, links and settings on the device. |
| `search` justification | not present | Sends the user's search to the browser's default search engine. |
| `bookmarks` justification (optional permission) | — | Requested only when the user chooses “Import browser bookmarks”. Bookmarks are read once, never modified, and the permission is released after the read. |
| `tabs` justification (optional permission) | required in 1.80 | Requested only when the user turns on recently closed pages, to list and reopen them. Nothing is stored or transmitted. |
| `sessions` justification (optional permission) | required in 1.80 | Same as `tabs`: lists recently closed pages when the user turns that on. |
| `identity` justification | present | **Remove** — permission no longer requested. |
| `tabGroups` justification | present | **Remove** — permission no longer requested. |
| Host permission justification (six hosts) | present | **Remove** — Senuma requests no host permissions. |
| Remote code | — | **No, I am not using remote code.** |

## Data usage checkboxes

| Category | Current | Set to | Why |
|---|---|---|---|
| Personally identifiable information | ticked | **unticked** | No account; no name, address or e-mail is collected. |
| Health information | — | unticked | |
| Financial and payment information | check | **unticked** | No payments, no licence checks. |
| Authentication information | ticked | **see decision below** | |
| Personal communications | — | unticked | |
| Location | ticked | **unticked** | Weather is removed; no location is read. |
| Web history | check | **unticked** | Recently closed pages are read live on the device, only if turned on; never stored or sent. |
| User activity | check | **unticked** | No analytics. |
| Website content | ticked | **unticked** | Nothing is read from web pages; no content scripts. |

**One owner decision — Authentication information.** Senuma itself creates no account and
collects no credentials. But for a person who used 1.x cloud sync and presses “Bring your New
Tab Folders cloud copy”, the sign-in token that 1.80 saved on the device is sent once to
Google's token service so their own copy can be read from the developer's Firebase project.

- Conservative (recommended while the import button ships): leave **Authentication
  information** ticked and say in the policy that it applies only to that one optional,
  user-initiated, read-only import by former sync users.
- Alternative: untick it, on the reading that nothing new is collected. Riskier with a reviewer.

Untick it for good in the release that removes the import button.

## Certifications (all three ticked)

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

## Privacy policy URL

Keep the field, but the page it points to must be rewritten before submission: the 1.x policy
describes cloud sync, accounts, payments and weather. The new text must state:

- everything is stored on the device; no analytics, no tracking, no account;
- custom wallpapers stay on the device and are not in backup files;
- bookmarks and recently closed pages are read only if the user turns those features on;
- searches go to the browser's default engine or a provider the user picks;
- former cloud-sync users: one optional, user-initiated, read-only import of their own copy;
  nothing is uploaded;
- data already held in the 1.x cloud project: how long it is kept and how to ask for deletion
  (owner to decide and state).

## Listing text that goes with it

Remove Pro, pricing, cloud-sync and weather wording from the description (STORE_LISTING.md has
the replacement copy).

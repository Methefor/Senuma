# Manual QA in a real Chrome window

The automated run (`npm run test:e2e`) covers everything a script can do in headless
Chromium. This list is what needs a person, a visible Chrome window and about 20 minutes.

**Setup**: `npm run build`, then `chrome://extensions` → Developer mode → Load unpacked →
`dist/`. Use a fresh Chrome profile unless a step says otherwise.

| # | Check | How | Expected |
|---|---|---|---|
| 1 | Fresh new-tab focus | Open a new tab with Ctrl+T and type at once | Text goes to Chrome's address bar. The page does not grab focus, redirect or reload. |
| 2 | Shortcuts after focus | Click an empty part of the page, then press Ctrl+K, Esc, `/`, `1`, Esc, `M` | Command center, search focus, first Space, Mode menu each respond at once. |
| 3 | Bookmark permission prompt | Onboarding step 3 → "Import browser bookmarks" (or Settings → Data → Import) | Chrome's prompt names bookmarks only. **Deny**: a message says nothing was imported. **Allow**: a review list appears; nothing is added until confirmed. |
| 4 | Recently closed permission prompt | Settings → Privacy → "Include recently closed tabs" | Chrome's prompt mentions browsing history. **Deny**: the switch stays off, with a message. **Allow**: close a tab, open a new tab, it appears in Continue and clicking it restores it. Turning the switch off removes the permission (check `chrome://extensions` → Details). |
| 5 | Default search engine | Chrome settings → Search engine → pick a non-Google engine. Search plain text from the new tab | Results open in the engine chosen in Chrome. |
| 6 | Search engine switch | Click the icon at the left of the search field, choose another engine, search | That engine is used; the icon changes. `y something` still goes to YouTube. |
| 7 | Wallpaper | Customize → Add image → pick a large photo from disk | Preview appears on the page before Apply; Apply keeps it. Open several new tabs: no white flash, no jump, the picture fades in. |
| 8 | Wallpaper rejects | Try a `.txt`, an `.svg`, and a file over 25 MB | Each is refused with a specific message; nothing is added. |
| 9 | Mode switching | Give Dev and Chill different themes and backgrounds (Customize → "… only"), then switch with the top-left control and with `M` | Theme, background, Spaces, dock and search engine change together, in one smooth transition. |
| 10 | Chrome restart | Quit Chrome completely, reopen, open a new tab | Spaces, theme, wallpaper, active Mode and dock are all as left. |
| 11 | Update simulation | Change something visible in `src/`, `npm run build`, press Reload on the extension card, open a new tab | New build runs; all data is intact. |
| 12 | Migration from 1.x | Unpacked builds get different IDs, so storage is not shared. Carry the data across by hand: on a 1.x new tab (a **copy** of a real profile, or the repo root loaded unpacked with some folders made), run in DevTools `chrome.storage.local.get('ntf_data', d => copy(JSON.stringify(d.ntf_data)))`. On a V2 new tab in a fresh profile, run `chrome.storage.local.clear(); chrome.storage.local.set({ ntf_data: <paste> })`, then open a new tab | No onboarding. Folders are Spaces, headers are groups, the summary card shows the counts, "Review setup" opens Spaces. Open more tabs: nothing duplicates. `ntf_data` is unchanged. |
| 13 | Icons with a real profile | Onboarding with several interests, icon service **off** | Note which starter apps show a real icon and which show a letter (headless measured about 60%). Turn the service on in Privacy: nearly all show icons. |
| 14 | Reduced motion | OS setting "reduce motion" on | No animation anywhere; hover and focus still give colour feedback. |
| 15 | Zoom and size | Ctrl + / Ctrl − to 125% and 150%; resize the window small | Nothing clipped; the dock never covers Spaces; many Spaces switch to compact rows. |
| 16 | Two windows | Open new tabs in two windows, change a Space in one | The other updates without reload. |

Record the Chrome version and OS with the results. Anything that differs from "Expected" is a
bug, except #1, which is intended behaviour.

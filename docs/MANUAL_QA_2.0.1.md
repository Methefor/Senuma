# Senuma 2.0.1 — hands-on QA

What a person checks in a real, visible Chrome before 2.0.1 is packaged. The automated suites
(unit 225, extension e2e 65, RC 33, rehearsal 16, `e2e/qa-201.ts` 6) already pass on this build;
this list covers what needs eyes, real OS dialogs and real Chrome behaviour. About 60–75 minutes.

## Build under test

- Folder: `release/Senuma-2.0.1-qa/` (branch `senuma-2.0.1`, commit `8523e01`; file hashes in
  `QA-BUILD.txt`). Rebuild with `npm run build` → `dist/`.
- Manifest version is still **2.0.0** (2.0.1 is not bumped yet). It has no `key`, so loaded
  unpacked it gets its own extension ID and its own storage.
- Use a **new Chrome profile** with no other Senuma or new-tab extension (two new-tab overrides
  conflict). `chrome://extensions` → Developer mode → **Load unpacked** → the folder above.
- Have ready: a large JPEG photo, a PNG, a `.txt` file, an `.svg`, a file over 25 MB, a few
  bookmarks in the profile, and DevTools (F12) for the network checks.
- Record Chrome version, OS, display scaling. Mark each row Pass / Fail / Note.

## Checklist

| # | Area | How | Expected | Result |
|---|---|---|---|---|
| 1 | Onboarding | Open a new tab in the fresh profile. Step 1: pick Finance, Media, Work. Step 2: pick a theme and atmosphere. Step 3: **Start fresh**. | 11 interest choices (Shopping included). The page behind updates while choosing. Three Spaces with short starter sets; Work and Chill Modes are created. Onboarding does not return on the next tab. | |
| 2 | Default Spaces and expanded suggestions | Open Media. Scroll to **Suggestions for this Space**, open it, add **SoundCloud**, then **HBO Max**. With DevTools → Network open, expand suggestions in another Space. | Starters only at first. Each suggestion lands in its group (SoundCloud in **Listen**, HBO Max in **Watch**), disappears from the list, and shows its real icon once added. Suggestions show letters; browsing them makes **no** network requests. An empty Space created from a set offers picks and **Add all of these**. | |
| 3 | Localization TR → EN, EN → TR | Settings → Appearance → Language → Türkçe; look at Home, Settings, Customize, a Space. Switch back to English. | The whole interface switches each way without reload; no mixed-language labels; dates follow the language. | |
| 4 | Default names translate | With the Spaces from #1: switch to Türkçe, then back to English. Also check group names inside Media and the Mode names; import one bookmark so a **Bookmarks** Space exists, switch again. | Finance ↔ Finans, Media ↔ Medya, Work ↔ İş; groups Watch ↔ İzle, Listen ↔ Dinle; Modes Work ↔ İş, Chill ↔ Keyif; Bookmarks ↔ Yer imleri. | |
| 5 | User names never translate | Rename Finance to “Money”, rename the Media group Listen to “Podcasts”, rename Mode Chill to “Evening”, create a Space “Travel”. Switch the language both ways twice. Reload. | All four names stay exactly as typed in both languages, after reload too. Untouched default names still translate. | |
| 6 | Link add / edit / delete / undo | In Travel: **Add link** (`airbnb.com`); paste `booking.com` into the filter field + Enter. Edit a link: change name, set an emoji icon, then an image address as icon. Remove it, then **Undo** in the toast. | Links appear with icons; edits show at once; an invalid address shows “That is not a web address…”. Undo restores the link in the same place. | |
| 7 | Groups | Space **⋯ → Add group**; rename by clicking its name; group **⋯** → Move up/Move down; **Delete group (links are kept)**. | Group order changes; deleting keeps its links in the Space; a toast confirms. | |
| 8 | Drag and reorder | Drag a link within a group, then into another group. On Home drag a Space; focus a Space and press **Alt + ←/→**. Drag dock items. | Every drag lands where dropped and persists after reload; Alt+arrows move the focused Space; Settings → Spaces shows the same order. | |
| 9 | Search | Type plain text + Enter. Type part of a saved link name; type `github.com`. Click the engine icon at the left of the bar and choose DuckDuckGo; search. | Plain text goes to the browser’s default engine (or the chosen one). Saved links/Spaces that match appear beside the web search. An address shows “Go to …”. The engine icon changes with the choice. | |
| 10 | `y lofi mix` | In a fresh tab click into the empty search bar. Type `y lofi mix`, Enter. Open a new tab and click the empty bar again. | First time the placeholder reads “Try ‘y lofi mix’ to search YouTube”. The **YouTube** chip appears while typing; Enter opens YouTube results for “lofi mix”. Afterwards the placeholder is back to normal. | |
| 11 | Custom search shortcut | Settings → Search: change YouTube’s shortcuts to `y, yt, tube`. **Add a search engine**: name “Wiki”, `https://en.wikipedia.org/w/index.php?search=%s`, shortcut `wk`. Try an address without `%s`. Search `tube cats` and `wk tea`. | Comma-separated shortcuts are saved; the missing `%s` is refused with a message; both searches go to the right site; the engine menu lists the new shortcuts. | |
| 12 | Ctrl/⌘+K command center | Click an empty part of the page, press Ctrl+K (⌘K). Empty: recent items. Type `gthb`, `media space`, `switch to work mode`, `use noir theme`, `youtube`. Use ↑/↓, Enter, Esc. | Opens at once; fuzzy matches work; each phrase does what it says; typing an engine name offers “Search YouTube…” and Enter fills its shortcut. Esc closes and returns focus. | |
| 13 | Modes across a new tab | Switch to Chill, then immediately press Ctrl+T and look at the new tab. Switch to Work, wait two seconds, Ctrl+T. | Both new tabs open in the Mode just chosen. (Automated tests cover the storage side; this checks real Chrome.) | |
| 14 | Mode-specific theme / background / search / dock | Settings → Modes → Work: **Change look…** (Customize opens with **Applies to → Work only**) pick Atelier and a photograph, Apply; **Default search** DuckDuckGo; **Its own dock** on, add a link to the dock. Switch Modes with M. | Theme, background, Spaces, dock and search engine change together; other Modes keep the default look; **Use the default look** removes Work’s own look. | |
| 15 | Background upload | Customize → **Add image**: large JPEG, PNG; then `.txt`, `.svg`, the >25 MB file; add until 8 images. With DevTools → Network open, upload once more after removing one. | Preview before **Apply**; Apply keeps it; no white flash on new tabs. Each wrong file gets its own message. At 8 images “You can keep 8 images…”. No network request carries the image. | |
| 16 | Fill / Fit | With a photo: **Fit**, then **Fill**. | Fit shows the whole photo with the backdrop around it; Fill covers the page. | |
| 17 | 3×3 positioning | With Fill, click each of the nine position points. | The visible part of the photo moves to match each point. | |
| 18 | Dim | Move **Dim** from low to high. | The photo darkens smoothly up to 90%; Spaces stay readable; a starting value was set when the photo was chosen. | |
| 19 | Blur | Move **Blur** from 0 to the maximum. | Smooth blur up to 40 px; no jank or stutter while dragging. | |
| 20 | Colour strength | **More adjustments** → **Colour strength** from low to high. | Photo goes from washed out to vivid. | |
| 21 | Atmosphere | **Off**, **Subtle**, **Cinematic**; then switch Modes. | Grain/glow/fog/vignette appear and strengthen; the setting is the same in every Mode. | |
| 22 | Motion | Customize → Motion **Full**, **Reduced**, **Off**; open Spaces and switch Modes each time. | Animations scale down and stop at Off; nothing breaks. | |
| 23 | Link-list paste import | Settings → Data → **Paste a list of links**: paste `github.com`, `Docs | https://devdocs.io`, `not a link`, `github.com` again. **Sort into Spaces** → review → untick one → **Add**. | Label reads “Paste a list of links”. Review groups by Space with counts; the invalid line and the duplicate are skipped; only ticked groups are added; a toast says how many. | |
| 24 | JSON export | Settings → Data → **Export**; open the file in a text editor. | One `.json` file. It holds Spaces, Modes, dock, search engines and preferences; no Continue/activity entries and no image data. | |
| 25 | JSON Merge import | In a second fresh profile with the QA build, import that file → **Merge into my setup**. Import the same file again. | Summary shows Spaces and links found; Merge adds what was missing; the second import adds nothing new. | |
| 26 | JSON Replace + restore point | Change something, import the file → **Replace my setup**. Open **Restore points** → **Restore** the newest. Do six replaces. | The setup is replaced; a restore point “Before an import” appears; Restore brings the previous setup back; only the five newest restore points are kept. | |
| 27 | Bookmark permission | Settings → Data → **Import browser bookmarks**. First **Deny** Chrome’s prompt, then **Allow**. Afterwards open `chrome://extensions` → Details → Permissions. | Prompt names bookmarks. Deny: message, nothing imported. Allow: review list, nothing added until confirmed. After import the bookmarks permission is no longer granted. | |
| 28 | Recently Closed / Continue | Open a few links from Senuma: they appear in **Continue**. Settings → Privacy → **Include recently closed tabs**: Deny once, then Allow. Close a tab, open a new tab, click it in Continue. Turn the switch off. **Clear activity**. | Chrome’s prompt mentions browsing history. Deny keeps it off with a message. Allow shows the closed tab as “Recently closed” and reopens it. Switching off removes the permission; Clear activity empties Continue. Right-click → Remove from Continue works. | |
| 29 | Icon modes | Settings → Privacy → **Site icons**: From each site / Icon service / Letters only, with DevTools → Network open on a new tab. | From each site: requests only to the saved sites (packaged marks need none). Icon service: requests to Google’s icon service. Letters only: no icon requests at all. | |
| 30 | Keyboard and focus trap | From the address bar press Tab into the page; Tab through Home. Open a Space (suggestions collapsed, then expanded), Settings, Customize, the command center; Tab 30 times in each; Shift+Tab; Esc. | Every control shows a visible focus ring. Focus never leaves an open panel (including the suggestions summary and chips); Esc closes and returns focus to what opened it. | |
| 31 | Chrome restart / persistence | Quit Chrome completely (all windows), reopen, open a new tab. | Spaces, renamed names, language, theme, photo, active Mode, dock, custom engines and Continue are as left. | |
| 32 | Zoom 125% / 150% / 200% | Ctrl + to each level on Home, a Space with suggestions, Settings, Customize, the command center; also a narrow window. | Nothing clipped or overlapping; the dock never covers Spaces; panels scroll; text stays readable at 200%. | |
| 33 | Reduced motion | Turn on the OS “reduce motion” setting (Windows: Settings → Accessibility → Visual effects → Animation effects off) with Senuma’s Motion on **Full**. | No animation anywhere; hover and focus still give feedback. | |
| 34 | Guide labels match the UI | Spot-check sections 6, 12, 20, 21 and 23 of `docs/guide/en.md` and `docs/guide/tr.md` against the screen in each language. | Every bold label is what the screen shows. (Automated check on 2026-10-05: all UI labels in both guides match the dictionaries; only keys, icons and service names are not UI text.) | |

Anything that differs from “Expected” is a bug; note the step, the screen and what happened.

## Known non-blockers (do not file as bugs)

- Some sites refuse icon requests (for example ChatGPT, Claude, Notion); they show a letter.
- Discord may not open from Türkiye (access restrictions); it stays a catalog suggestion.
- There is no background image URL; backgrounds are uploaded files or built-in photographs.
- Command center phrases (“switch to work mode”) are English in both languages; names and
  commands themselves are matched in the interface language.
- On a setup from before 2.0.1, the Turkish strings are loaded once (a local file) to recognise
  Turkish default names; only exact default names are taken over.

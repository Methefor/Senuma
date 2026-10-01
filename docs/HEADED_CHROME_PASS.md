# Headed Google Chrome pass — observed behaviour

- **When:** 2026-10-02, against the RC build (`manifest 1.99.10`, “2.0.0 RC 1”).
- **Browser:** Google Chrome 154.0.8037.93, visible window, Windows 11, Chrome UI language Turkish.
- **How:** `npm run headed` (`e2e/headed.ts`). Throw-away profiles; `dist/` loaded unpacked.
- **Result:** 22 steps recorded, 0 failed. Captures: `e2e/.out/headed-*.png` (all 15 reviewed).

What was real and what was driven:

| Input | How it was produced |
|---|---|
| New tabs | A real `Ctrl+T` in the Chrome window |
| `Ctrl+K`, `/`, `M`, `Esc`, typed text | Real key presses sent to the Chrome window |
| The click that moves focus into the page | A real mouse click |
| Chrome's permission prompts and bubbles | Read and answered through Windows UI Automation (their real buttons) |
| Clicks inside the page (buttons, toggles) | Sent by the test driver |

A person did not sit at the keyboard. Everything below is what the browser actually did.

## 1. Loading and the first tab

| Step | Observed |
|---|---|
| Load unpacked | Loads. Required: `storage`, `search`. Optional: `bookmarks`, `tabs`, `sessions`. Granted at install: `newTabPageOverride`, `search`, `storage`. |
| First `Ctrl+T` | The extension page opens (tab title “New Tab”). Onboarding is shown, in Turkish, because the browser language is Turkish. |
| **Chrome's own bubble** | On the first new tab Chrome shows: **“Google'a geri dönmek ister misiniz? — Bu sayfa "NewTabFolders" uzantısı tarafından değiştirildi.”** (“Change back to Google? This page was changed by the NewTabFolders extension.”) Buttons: **“Geri değiştir”** (Change back, the highlighted default) and **“Değişiklikleri koru”** (Keep changes). |
| Onboarding | Completes: 4 Spaces, 36 links, 3 Modes. |

The bubble is Chrome's, not ours, and cannot be suppressed. Its default button turns the
extension's new tab page off. See RELEASE_STATUS.md (H1).

## 2. Keyboard focus on a fresh tab

| Step | Observed |
|---|---|
| Fresh tab, nothing clicked | Keyboard focus is in **Chrome's address bar** (`OmniboxViewViews`). |
| `Ctrl+K` on that tab | Goes to the address bar (Chrome's own “search” shortcut). **The command center does not open.** |
| `/` on that tab | Typed into the address bar. The page does not receive it. |
| Click anywhere on the page, then `Ctrl+K` | Command center opens with its field focused; typing `git` lists GitHub first; `Esc` closes it. |
| …then `/` | Focus moves to the page's search field. |
| …then `M` | Mode menu opens (All Spaces, Work, Dev, Chill, Edit Modes…). |

No attempt is made to take focus from the address bar. On a fresh tab, typing searches from
the address bar (Chrome's behaviour); the page's shortcuts work after one click or `Tab`.

## 3. Permissions

**Bookmarks** (Settings → Data → Import browser bookmarks)

| Step | Observed |
|---|---|
| Before the prompt | The row reads: “Import your existing Chrome bookmarks into Spaces. Chrome will ask for permission to ‘read and change your bookmarks’; this page only reads them…” |
| Prompt | “"NewTabFolders" ek izinler istedi. Şunları yapabilecek: **Yer işaretlerinizi okuma ve değiştirme**” (Read and change your bookmarks). Buttons: İzin ver / Reddet. |
| Decline | Not granted. Message: “Bookmark access was not granted. Nothing was imported.” Settings and Home keep working. |
| Ask again, allow | Prompt shown again; granted; with no bookmarks in the profile: “No usable links found.” |
| With 4 real bookmarks | Review lists Coding 1, Design 1, Bookmarks 1 (the `javascript:` bookmark is dropped). Links 36 → 39. Chrome's bookmarks are unchanged. |
| After the import | The permission is **no longer held** (`newTabPageOverride, search, storage`): access is given back as soon as the read finishes. |
| A later import | Chrome granted access again **without showing the prompt** (it remembers a previous “Allow”), and it was given back again afterwards. |
| Revoke by hand | Works; the rest of the product is unaffected. |

**Recently closed pages** (Settings → Privacy)

| Step | Observed |
|---|---|
| Before the prompt | “Show recently closed pages in Continue. Chrome will ask for permission to ‘read your browsing history’…” |
| Prompt | “Şunları yapabilecek: **Oturum açtığınız tüm cihazlarda göz atma geçmişinizi okuma**” (Read your browsing history **on all your signed-in devices**). |
| Decline | Not granted; setting stays off; message: “Permission was not granted, so recently closed pages stay off. Everything else works the same, and you can turn this on later.” |
| Allow later | Granted (`sessions`, `tabs`); a new tab lists “Example Domain · Recently closed” in Continue. |
| Turn off | `sessions` and `tabs` are removed again. |

Note: Chrome's wording is broader than our explanation (“on all your signed-in devices”).
Listed as H2 in RELEASE_STATUS.md.

## 4. Search

| Step | Observed |
|---|---|
| Default search “weather in izmir” | Handed to the profile's default engine through `chrome.search`; landed on `www.google.com`. Google answered the automated profile with its “unusual traffic” page (`/sorry/`), which is Google's reaction to automation, not a product fault. |
| `y lofi & chill` | `youtube.com/results?search_query=lofi & chill` (query intact). |

## 5. Appearance, data, tabs

| Step | Observed |
|---|---|
| Packaged photograph + a Dev Mode look | Milky Way saved as the default background; Dev Mode saved with Phosphor + Ink. |
| Undo | Deleting a Space, then Undo: it comes back. |
| Export | `browser-os-backup-2026-10-01.json`, schema 4. |
| Import (replace) | Setup replaced; a restore point is saved first. |
| Restore point | Previous setup returns, photograph still set. |
| Three real tabs | A Space created in one appears in the other two without reloading. |

## 6. Reload and restart

| Step | Observed |
|---|---|
| Extension reload (Developer mode on) | Service worker restarts; a new tab opens the extension page; data unchanged. |
| Extension reload (Developer mode off) | Chrome **switches an unpacked extension off** on reload. This is Chrome's rule for unpacked extensions and does not apply to a store install. |
| Quit and restart Chrome, same profile | An extension loaded unpacked for one session has to be loaded again (again specific to this way of loading). After loading: same ID, Spaces 5 → 5… 7 → 7 depending on the run, default photograph kept, Dev Mode look kept, optional permissions as left. Photograph painted on the first tab. |

## 7. An existing 1.x user

With 1.x data in storage before the first tab: no onboarding, Home appears with the converted
setup and the summary “NewTabFolders kurulumun yükseltildi — 3 klasör → 3 Alan, 5 bağlantı
taşındı, başlıklardan 2 grup oluşturuldu, web adresi olmayan 4 öğe atlandı”. The 1.x data is
unchanged. (The full rehearsal with a 9-folder, 57-link setup is `npm run rehearse`.)

## Not covered by this pass

- A person's judgement of feel (animation smoothness, scroll, drag by hand).
- macOS and Linux; `Cmd+K`.
- An update delivered by the Chrome Web Store, and whether Chrome shows the “Change back to
  Google?” bubble again to **existing** users after an update. This cannot be reproduced with
  an unpacked extension.
- Chrome sync between two real signed-in devices.

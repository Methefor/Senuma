# Senuma 2.0.1 media plan: store screenshots, GIFs, product video

Capture plans only; nothing is published. Copy comes from MESSAGING_SYSTEM.md. Everything is real
Senuma UI from a 2.0.1 build: no mock-ups, no fake data panels, no effects that hide the product.

## 0. Common setup (all captures)

- **Build:** `npm run build` on `senuma-2.0.1`, loaded unpacked in a clean Chrome profile
  (no other extensions, no bookmarks bar, no signed-in account).
- **Window:** 1280×800 CSS pixels at device scale 2 (crisp crops). Video: 1920×1080 at scale 1.
- **Setup:** onboarding with AI, Coding, Work, Design, Media → Modes Work, Dev, Chill.
  Theme **Dusk**, photograph **mountain-mirror**, Atmosphere **Subtle**, Motion **Full**.
  Dock: GitHub, Vercel, Letterboxd. A few links opened beforehand so **Continue** is filled.
  Mode looks set beforehand with **Settings → Modes → Change look…** (starter Modes have none):
  Work → Atelier, Dev → Phosphor, Chill → photograph **toronto-night**.
- **Icons:** **Letters only** (Settings → Privacy), as for the 2.0.0 store set: no third-party logo
  becomes the subject of a Senuma image. (Owner decision if this should change; see Open risks.)
- **Never on screen:** real names, e-mail addresses, file paths or user folders, the OS file
  dialog, Chrome’s download bubble, other tabs or extensions, notifications, real personal
  photographs, a clock showing an odd hour (set the time to 19:15 if the greeting matters).

## 1. Store screenshots (1280×800, five)

Review of the current eight (`release/Senuma-2.0.0-store/`):

| Current | Verdict |
|---|---|
| 1 home | **Keep image**, new caption |
| 2 spaces | **Recapture**: no suggestions (2.0.1) |
| 3 modes | **Keep image**, new caption |
| 4 search | Docs/landing only (recapture with `y lofi mix` for consistency) |
| 5 command center | **Recapture**: footer still says “youtube lofi”; becomes the search-shortcut shot |
| 6 personalization | **Recapture**: shows pickers, not the controls QA singled out |
| 7 themes | Docs/landing only |
| 8 privacy | Docs/landing only (privacy is in the description and its own article) |

Recapture means changing the scenes in `e2e/store-assets.ts` (tooling, not product code) and
running `npm run store:assets`. Headline font, layout and backdrop stay as they are.

### Final five

| # | File | Headline | Subline |
|---|---|---|---|
| 1 | screenshot-1-home | Make the browser yours. | Your place on the web. |
| 2 | screenshot-2-spaces | Everything you use, organized. | Add only what you use, one at a time. |
| 3 | screenshot-3-search | One search bar. Your rules. | `y lofi mix` searches YouTube. Make your own shortcuts. |
| 4 | screenshot-4-customize | Make every new tab yours. | Fit, position, dim, blur and add atmosphere. |
| 5 | screenshot-5-modes | A workspace for every mode. | Its own Spaces, look, search and dock. |

**1 · Home** (keep)
- Scene: Home, All Spaces, Dusk + mountain-mirror, Continue filled, dock visible, no panel open.
- Must stay visible: greeting, search bar with the Ctrl K hint, five Space plates, dock.
- Must not appear: an open menu or panel, the search tip placeholder (the box is not focused).
- Crop: full window inside the framed device area, as now.

**2 · Spaces + suggestions** (recapture)
- Scene: open **Media**; scroll the panel so **Watch** and **Listen** sit above an open
  **Suggestions for this Space** showing HBO Max, Apple Music, SoundCloud.
- Must stay visible: the Space header (name, link count, Open all), at least two named groups,
  the open suggestions with the letter chips and their hint line.
- Must not appear: a half-scrolled group cut through its titles; the filter field with text.
- Crop: centre the panel; the Home plates may show faintly behind it.

**3 · Search shortcuts + command center** (recapture)
- Scene: Ctrl+K open, query `y lofi mix`, first result **Search YouTube for “lofi mix”**, footer
  tip **Try “y lofi mix” or “switch to work mode”** visible.
- Must stay visible: the query, the YouTube result with Enter hint, the footer.
- Must not appear: a YouTube page; the browser’s address bar.
- Crop: panel centred, dimmed Home behind.

**4 · Background customization** (recapture)
- Scene: Customize open with **mountain-mirror** selected, panel scrolled so **Fit** (Fill/Fit),
  the **position grid**, **Dim** and **Blur** are in view, Atmosphere **Cinematic** visible if it
  fits; Home behind shows the result live.
- Must stay visible: the tune controls with readable labels; the Apply button.
- Must not appear: the file picker, “Your images” with a real personal photo.
- Crop: Customize panel on the right as in the current shot; Home on the left.

**5 · Modes** (keep)
- Scene: Dev Mode with Phosphor theme, three Spaces, its own dock.
- Must stay visible: the Mode switch reading **Dev**, the different theme.
- Optional recapture: Mode menu open (press M) to show Work / Dev / Chill / All Spaces.

**Extras for docs and landing:** themes (7), privacy (8), search box with the route chip
(`y lofi mix` → YouTube), Settings → Search with the shortcuts list, Settings → Data → Import
links, Customize theme grid (current 6).

**Promo images:** icon-128, tile-440×280 and marquee-1400×560 stay as generated. If the marquee is
regenerated, use “Make the browser yours.” + “Your place on the web.”.

## 2. GIFs (six)

Common: 1280×800 capture, exported at **960×600, 15 fps**, ≤ 8 s, palette-optimized (≤ 3 MB for
GitHub/README). Cursor visible and moved at a human pace; pause 0.6 s before and after each
action. No zoom effects. Each loops back to its first frame, so the last frame must match it.

### GIF 1 — Create a Space, add a link (≈7 s)
- Start: Home, All Spaces, no panel.
- Actions: click **New Space** → type `Travel` → **Create Space** (the empty Space opens) → click
  the filter field → paste `airbnb.com` → Enter → the link appears → Esc.
- Keep on screen: the Space panel with its new link.
- Caption: “New Space, first link: two steps.”
- Loop: after Esc, delete the Space off-camera and cut back to the opening frame.
- Crop: full window.

### GIF 2 — Ctrl/⌘+K command center (≈6 s)
- Start: Home.
- Actions: Ctrl+K (show a small key overlay “Ctrl K”) → type `coding` → **Open Coding** highlighted
  → Enter → the Coding Space opens → Esc.
- Caption: “Everything, one shortcut away.”
- Loop: Home after Esc. Crop: centre 960×600.

### GIF 3 — `y lofi mix` (≈6 s)
- Start: Home; search box empty (shortcut not used yet in this profile, so the tip shows).
- Actions: click the search box (the placeholder shows the tip) → type `y lofi mix` (the
  **YouTube** chip appears) → Enter → cut on the YouTube results page loading.
- Keep on screen: the route chip; the first frame of YouTube’s results (address bar cropped out).
- Caption: “One search bar. Your rules.”
- Loop: cut back to the empty box. Crop: search area and a strip of Home, 960×600.

### GIF 4 — Background customization (≈8 s)
- Start: Customize open, Theme default background.
- Actions: click photograph **forest-fog** → **Fit**, then back to **Fill** (the difference shows) →
  click the top-centre position point →
  drag **Dim** up → drag **Blur** to ~16 px → Atmosphere **Cinematic** → **Apply**.
- Upload is not filmed (it opens the OS file dialog). If an own-image version is wanted, upload a
  neutral stock image beforehand and start from it in **Your images**.
- Caption: “Fit, position, dim, blur, atmosphere.”
- Loop: undo off-camera (Theme default), cut to start. Crop: full window (the result must show).

### GIF 5 — Mode switch (≈5 s)
- Start: Home in **Work** Mode (Atelier).
- Actions: press **M** (menu opens) → choose **Dev** (Phosphor, Coding/AI/Design) → M → **Chill**
  (Media, own photograph) → M → **Work**.
- Caption: “A workspace for every mode.”
- Loop: ends where it began. Crop: full window.

### GIF 6 — JSON export / import (≈8 s)
- Start: Settings → Data.
- Actions: **Export** (cut before Chrome’s download bubble) → hard cut to: **Choose file** done
  off-camera → the import panel “The file holds {n} Spaces and {n} links” (counts from the prepared
  file) → **Merge into my setup** →
  toast “Merged: …” → Restore points list shows the newest entry.
- Never show: the download bubble, the file dialog, the file name if it contains a user name.
- Caption: “Your setup, in one file.”
- Loop: cut to start. Crop: Settings panel, 960×600.

## 3. Product video (28 s)

Format: 1920×1080, 60 fps master; exports 1080×1080 and 1080×1920 (centre crop of the UI, text
re-laid). Real screen recording at 1:1 speed except where stated. Type: the product font
(Senuma wordmark lower-case as in the brand). Text appears over a soft dim, never over controls
being used.

| Time | UI state | Action | Camera / crop | On-screen text | Transition |
|---|---|---|---|---|---|
| 0.0–3.0 | New blank tab | Home appears (Dusk, mountain-mirror, Subtle) | full frame, still | **Make the browser yours.** | fade from black (0.4 s) |
| 3.0–7.0 | Home | open **Media**; open **Suggestions**; click **SoundCloud**; it lands in **Listen** | slow push to the panel (real 1.0→1.15 scale crop, no 3D) | Everything you use, organized. | cut |
| 7.0–11.0 | Home, search focused | type `y lofi mix`, chip **YouTube**, Enter, first frame of results | crop on the search bar | **One search bar. Your rules.** | cut on Enter |
| 11.0–15.0 | Home | Ctrl+K, `switch to dev mode`, Enter → Dev Mode (Phosphor) | centre crop | Everything, one shortcut away. | cut |
| 15.0–22.0 | Customize open | forest-fog → Fit → Fill → position top-centre → Blur 16 → Atmosphere Cinematic → Apply; the page changes live behind | full frame (result must be seen) | Make every new tab feel like yours. | cut |
| 22.0–26.0 | Home | M → Work → M → Chill → M → Dev | full frame | A workspace for every mode. | cut |
| 26.0–28.0 | End card | Senuma icon + wordmark on the Dusk backdrop | still | **Senuma** · Your place on the web. | fade to black (0.6 s) |

Rules: one text line on screen at a time; text holds at least 1.5 s; no fake cursor trails,
particle effects, 3D rotations or speed ramps that make the UI look faster than it is (trim waits
instead).

**Silent version:** as above. Text carries everything; add a small key overlay (“Ctrl K”, “M”)
when keys are pressed.

**Music-only version:** calm, instrumental, ~90–100 BPM, licensed for commercial use (keep the
licence with the project). Cuts on beats; no sound effects except an optional soft click on Enter.
Music down −3 dB under text-heavy shots, out with the fade.

**Voice-over (optional; use only if the silent cut tests unclear):**
> “This is Senuma. Your new tab, made yours. Spaces for everything you use. One search bar with
> your own shortcuts. Every command, one keystroke away. Make every new tab feel like yours, and
> switch the whole page for what you’re doing. Senuma. Your place on the web.”

Turkish voice-over (same timing):
> “Bu Senuma. Yeni sekmen, artık senin. Kullandığın her şey için Alanlar. Kendi kısayollarınla tek
> arama çubuğu. Her komut bir tuş uzağında. Her yeni sekme sana ait hissettirsin; yaptığın işe göre
> tüm sayfayı değiştir. Senuma. Web’deki yerin.”

## 4. Open decisions

- Letters-only icons keep third-party logos out but make Spaces look plain; site icons look
  richer but put other brands’ logos in Senuma marketing. Owner to decide per surface.
- The video and GIFs need a 2.0.1 build; captures from 2.0.0 would miss suggestions and the new tip.

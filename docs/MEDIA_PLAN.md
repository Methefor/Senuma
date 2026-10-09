# Senuma 2.0.1 media plan: store screenshots, GIFs, product video

Plans and the record of what was produced (§5); nothing is published. Copy comes from MESSAGING_SYSTEM.md. Everything is real
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
- **Icons:** real site icons (the product default, **From each site**), loaded live during capture.
  Sites that refuse a script’s request keep their letter, exactly as in the product. The product
  is unchanged: letters remain the fallback and **Letters only** remains a setting. (Changed from
  the 2.0.0 set, which used letters only; owner direction 2026-10-05.)
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

Common: 1280×800 capture, exported at **960×600 plus a 52 px caption bar, 12 fps**, one palette
per GIF, no dithering (≤ 3 MB where possible). The caption and the key being pressed sit in the bar,
never on the product. Pointer moved at a human pace (headless Chrome draws no cursor, so a plain
dot is added for the recording only). No zoom effects. The last frame holds 1.2 s, then loops.

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
- Actions: Ctrl+K (key shown in the bar) → type `coding` → **Open Coding** highlighted
  → Enter → the Coding Space opens → Esc.
- Caption: “Everything, one shortcut away.”
- Loop: Home after Esc. Crop: centre 960×600.

### GIF 3 — `y lofi mix` (≈6 s)
- Start: Home; search box empty (shortcut not used yet in this profile, so the tip shows).
- Actions: click the search box (the placeholder shows the tip) → type `y lofi mix` (the
  **YouTube** chip appears) → Enter, shown in the bar; the GIF cuts as YouTube starts loading
  (no third-party page, no cookie banner).
- Keep on screen: the tip, the route chip, the result row.
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
  (Captured headless: neither the bubble nor a dialog is drawn; the file is handed to the page’s own
  file chooser.) A merge also saves a restore point, which the GIF shows: “Before an import”.
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

- Marketing captures now show other brands’ site icons (YouTube, Netflix, GitHub…) as they appear
  in the product. Nominative use in a real screenshot is normal for the store, but the owner should
  confirm it for paid or social placements.

## 5. Produced (2026-10-05, from `senuma-2.0.1`)

Pipeline, all local: `npm run store:assets` (screenshots), `vite-node e2e/media-capture.ts`
(recordings, Chrome screencast of the real build, fixed 7:15 PM clock, demo setup in
`e2e/demo-state.ts`), `python scripts/media-compose.py` (GIFs and video; Pillow, and the ffmpeg that
Playwright installs). Outputs (git-ignored): `drafts/store/`, `drafts/media/`; copies in
`release/Senuma-2.0.1-media/`.

| Item | Result |
|---|---|
| Store screenshots | 5 final (1-home, 2-spaces, 3-search, 4-customize, 5-modes) + 5 extras, 1280×800; hero 1400×560, tile 440×280, icon 128 |
| GIF 1 create Space | 8.1 s, 1.9 MB |
| GIF 2 command center | 4.4 s, 1.9 MB |
| GIF 3 `y lofi mix` | 5.2 s, 0.5 MB |
| GIF 4 background | 10.5 s, 3.6 MB (seven controls; over the 3 MB aim) |
| GIF 5 Modes | 8.2 s, 2.3 MB |
| GIF 6 backup | 9.4 s, 1.2 MB |
| Video | `senuma-28s-silent.webm`, 1920×1080, 30 fps, VP8, 28.9 s, 11.8 MB: Home 3.0 · Spaces 4.5 · shortcut 3.5 · command 4.0 · background 8.5 · Modes 3.4 · end card 2.0 |

Video notes: real-time footage throughout (the video shots were recorded at a brisker hand; the
product’s animations are not sped up); only the idle hold at the end of a shot is trimmed. Captions
sit in a soft top dim; the key being pressed shows between the top bar and the greeting.

Not produced: an MP4/H.264 file (the available ffmpeg encodes VP8/WebM only; convert with any
full ffmpeg: `ffmpeg -i senuma-28s-silent.webm -c:v libx264 -crf 18 -pix_fmt yuv420p senuma-28s.mp4`),
square and vertical cuts, the music-only version (needs a licensed track) and the voice-over
(needs a recorded voice). The silent version is complete on its own.

## 6. Launch asset gap audit (2026-10-05)

Existing and still good: 5 store screenshots, 5 extras, icon, tile, marquee/hero, six GIFs, the
28.9-second silent WebM. None of these needs regenerating.

| Item | Rank | Why | State |
|---|---|---|---|
| MP4 (H.264) of the 28.9 s video | **Required** | TikTok, Reels, Shorts, X, LinkedIn, Product Hunt (via YouTube) and Safari do not take WebM | **made**: `release/Senuma-launch-media/senuma-28s-silent.mp4`, 1920×1080, 28.9 s, 23 MB |
| Poster / thumbnail frames | **Required** | video poster on the landing page, YouTube thumbnail, link previews | **made**: `poster-home.png`, `poster-customize.png`, `poster-endcard.png` (1920×1080) |
| 9:16 vertical clips | **Required for weeks 1–6, not producible from existing footage** | the three short-video channels are vertical; scaling the 16:9 footage to 1080 px wide makes the interface unreadable | needs a portrait capture per concept (week 0 of LAUNCH_PLAN.md): record the real build in a tall window with `e2e/media-capture.ts` set to a portrait viewport, or by hand; then `scripts/media-mp4.mjs` |
| English overlay text | Required per clip | each clip's hook and overlay (CONTENT_LIBRARY.md) | made with each clip; the 28.9 s video already has English lines |
| Turkish overlay text | High-value | Turkish posts (concepts marked TR) | with each Turkish clip; needs a TR text table in `scripts/media-compose.py` |
| Lighter web encode of the video (~3 Mbit/s) | High-value | landing page weight | one run of `scripts/media-mp4.mjs` with a lower bitrate, when the page is built |
| Optimized background GIF (gif-4, 3.6 MB) | High-value | under 3 MB for GitHub/README; on the site it becomes a video loop instead | re-export at 10 fps or trim to 8 s |
| Turkish screenshots (5) | High-value | `/tr/` landing page and a Turkish store listing | `npm run store:assets` with the Turkish interface |
| Open Graph image 1200×630 | High-value | link previews for the landing page and GitHub | a crop of the hero |
| 1:1 square demo | Nice-to-have | LinkedIn and Instagram feed only | crop from 16:9 only if those channels earn it by week 4 |
| Music-only version | Skip for now | needs a licensed track; platforms' own sound libraries cover Shorts/TikTok/Reels | no paid music |
| Voice-over | Skip | no need shown | — |

How the MP4 was made: `node scripts/media-mp4.mjs <source.webm> <output folder>` plays the finished
WebM in the installed Google Chrome and records it with Chrome's own H.264 encoder (the ffmpeg that
Playwright installs writes VP8 only). Real time, local, nothing downloaded. It re-encodes an
already encoded video, so keep the WebM as the master.

## 7. Vertical capture specs (9:16, English and Turkish)

For YouTube Shorts, TikTok and Instagram Reels. **Captured natively in a portrait window, never
cropped or scaled from the 16:9 footage.** Recorded on 2026-10-09 (§ 7.6).

### 7.1 Frame

Probed on 2026-10-09 with the real build and the demo setup (three window sizes, five screens each):

| Window (CSS px) | Scale | Records as | Result |
|---|---|---|---|
| **432 × 768** | **2.5** | **1080 × 1920** | **chosen**: Home shows the greeting, search, Continue and Spaces in two columns with the dock; text is large enough for a phone |
| 540 × 960 | 2 | 1080 × 1920 | works (three columns) but the interface is 20 % smaller on screen |
| 432 × 576 (a 3:4 “safe” band) | 2.5 | 1080 × 1440 | rejected: the greeting drops out and only two Spaces fit |

- Launch: `launch(DIST, profile, { width: 432, height: 768 }, 2.5)`. The window itself runs at 2.5×
  and is larger than the page; each page is set to exactly 432×768 at 2.5× with
  `Emulation.setDeviceMetricsOverride`. Chrome's screencast records the window's own pixels (an
  emulated scale alone gives small frames), so each frame holds the 1080×1920 page in its top-left
  corner and empty window around it, which the composer trims. That is the page's own pixels,
  not a crop of other footage.
- 30 fps, 6–15 s, H.264 MP4 through `scripts/media-mp4.mjs` (the WebM stays the master).
- Fixed clock 7:15 PM and the demo setup from `e2e/demo-state.ts`, as for every other capture;
  real site icons; pointer dot as in the 16:9 recordings.
- **With five Spaces the fifth sits under the dock** at this size: use four Spaces in the portrait
  demo setup (AI, Coding, Work, Media), or five when the clip is about a Mode that shows fewer.
- **Customize covers the whole page in a portrait window**, so the live preview behind the panel
  is not visible while adjusting. Background clips therefore cut between the panel (the control
  being moved) and Home after **Apply** (the result); see 7.4.

### 7.2 Platform safe areas (inside 1080 × 1920)

| Zone | Pixels | Use |
|---|---|---|
| Top | 0–220 | platform header on some surfaces; Senuma's own top bar sits here: nothing essential |
| Hook, then overlay lines | 230–360, centred, max two lines, on a soft dark plate | the hook for the first 1.5 s; after it, one short line per step (each at most 2.8 s). This is where the greeting is: the only area inside the safe zone that holds nothing a clip is about |
| Action | 380–1580 | the search bar, results, Spaces, panels: never covered by text |
| Keys | 1612–1696, centred | the key being pressed, for under a second, in the gap between the Spaces and the dock |
| Bottom | 1700–1920 | platform caption, buttons and music line; Senuma's dock sits here: fine, no text added |
| Right edge | 920–1080 between 900 and 1500 | platform buttons; text is centred and stays clear of it |

Tried and dropped: overlay lines under the Spaces (they covered the second row of Space cards at
this size).

End card (last 1.3 s): the icon, “senuma”, and “Free on the Chrome Web Store” / “Chrome Web
Store’da ücretsiz”, on the product's dark base.

### 7.3 Languages

| | English version | Turkish version |
|---|---|---|
| Interface | English (`prefs.language: 'en'`) | Turkish (`prefs.language: 'tr'`): default Space, group and Mode names follow it through their name keys; verify on the first frame before recording |
| Hook, overlays, end card | from CONTENT_LIBRARY.md (EN lines) | from CONTENT_LIBRARY.md (TR lines); `scripts/media-compose.py` needs a per-language text table |
| Typed text | `y lofi mix`, `coding`, `switch to work mode` | `y lofi mix`, `kodlama`; command phrases are English in both languages today, so the Turkish Ctrl+K clip opens Spaces and Modes by name instead of typing a phrase |
| File names | `v-<n>-<slug>-en.mp4` | `v-<n>-<slug>-tr.mp4` |

Two recordings per concept (one per interface language), not one recording with swapped overlays:
the interface itself is visible in every shot.

### 7.4 Shot lists (priority order)

Times in seconds. “Hook” and “Overlay” texts are the concept's lines in CONTENT_LIBRARY.md (#).

**V1 — `y lofi mix` (#1), 8 s**

| t | Screen | Action | Text |
|---|---|---|---|
| 0.0–1.5 | Home | hold | Hook |
| 1.5–2.2 | Home | click the search bar (the tip placeholder shows) | — |
| 2.2–4.8 | Search bar | type `y lofi mix`; the **YouTube** chip appears | Overlay 1 |
| 4.8–6.3 | Search bar | hold on the result row, press Enter (keycap) | Overlay 2 |
| 6.3–8.0 | — | cut to the end card as YouTube starts loading (no third-party page shown) | End card |

**V2 — Ctrl+K (#4), 9 s**

| t | Screen | Action | Text |
|---|---|---|---|
| 0.0–1.5 | Home | hold | Hook |
| 1.5–2.0 | Command center | Ctrl+K (keycap) | — |
| 2.0–4.5 | Command center | type `coding` (TR: `kodlama`) → **Open Coding** highlighted → Enter | “open” |
| 4.5–6.0 | Coding Space | the Space opens; Esc | — |
| 6.0–8.0 | Command center → Home | Ctrl+K, type `work` → **Switch to Work Mode**, Enter: the page changes | “switch” |
| 8.0–9.0 | — | end card | End card |

**V3 — Work → Gaming (#6), 8 s** (demo setup needs a Gaming Space and Mode with its own dark look)

| t | Screen | Action | Text |
|---|---|---|---|
| 0.0–2.5 | Home, Work Mode | hold: work Spaces, calm look | “Work” (TR: “İş”) + Hook |
| 2.5–3.5 | Mode menu | press M (keycap), choose Gaming | — |
| 3.5–7.0 | Home, Gaming Mode | Spaces, theme, background and dock have changed; hold | “Gaming” (TR: “Oyun”) → “Same tab.” |
| 7.0–8.0 | — | end card | End card |

**V4 — Customization (#8 + #10), 12 s**

| t | Screen | Action | Text |
|---|---|---|---|
| 0.0–1.5 | Home, theme default | hold | Hook |
| 1.5–3.5 | Customize | open; choose a photograph | — |
| 3.5–4.5 | Home | **Apply** → the photograph behind Home | “Your photo” |
| 4.5–6.5 | Customize | Fit → Fill; a position point | “Fill / Fit · Position” |
| 6.5–8.5 | Customize | Dim, then Blur sliders | “Dim · Blur” |
| 8.5–9.5 | Customize | Atmosphere → Cinematic; **Apply** | “Atmosphere” |
| 9.5–11.0 | Home | hold on the finished look | “Make every new tab feel like yours.” |
| 11.0–12.0 | — | end card | End card |

The “plain Chrome tab” opening of concept #8 is a separate 1.5 s shot of Chrome's own new tab at
the same window size, used only as it is.

**V5 — AI / Dev Space (#12 + #13), 12 s**

| t | Screen | Action | Text |
|---|---|---|---|
| 0.0–1.5 | Home | hold | Hook |
| 1.5–4.0 | AI Space | press `1`: ChatGPT, Claude, Gemini, Perplexity, Copilot | “One Space” |
| 4.0–6.0 | Home | Esc; type `cl explain closures` → **Claude** chip | “cl = Claude” |
| 6.0–8.5 | Coding Space | clear; press `2`: GitHub, Vercel, Supabase, MDN | “Coding” |
| 8.5–10.5 | Home | Esc; type `gh senuma` → **GitHub** chip | “gh = GitHub” |
| 10.5–12.0 | — | end card | End card |

### 7.5 Tools

- `e2e/media-portrait.ts`: the five scenes in each language (`CAPTURE_LANG`, `CAPTURE_SCENE` to
  narrow), demo setup with four Spaces (AI, Coding, Work, Gaming) and Mode looks.
- `scripts/media-portrait.py`: trims to the page, adds hook, lines, keys and end card, writes WebM.
- `scripts/media-mp4.mjs <file.webm> <folder> 6000000 <name>.mp4 noposters`: MP4 (H.264).
- Music: none in the files; the platform's own library at posting time.

### 7.6 Recorded (2026-10-09)

`release/Senuma-launch-media/vertical/<lang>/`, all 1080×1920, 30 fps, MP4 (H.264), silent:

| Clip | English | Turkish |
|---|---|---|
| V1 `y lofi mix` | `v1-y-lofi-mix-en.mp4`, 8.4 s | `v1-y-lofi-mix-tr.mp4`, 8.5 s |
| V2 Ctrl+K | `v2-ctrl-k-en.mp4`, 12.7 s | `v2-ctrl-k-tr.mp4`, 12.0 s |
| V3 Work → Gaming | `v3-work-to-gaming-en.mp4`, 9.1 s | `v3-work-to-gaming-tr.mp4`, 9.3 s |
| V4 Customization | `v4-customization-en.mp4`, 19.1 s | `v4-customization-tr.mp4`, 19.5 s |
| V5 AI / Dev Space | `v5-ai-dev-space-en.mp4`, 16.1 s | `v5-ai-dev-space-tr.mp4`, 16.2 s |

Each language is its own recording of the interface in that language (Turkish: “İyi akşamlar”,
Yapay zekâ, Kodlama, İş, Oyun, “Geliştirme moduna geç”, Özelleştir…). Differences from the shot
lists above: V2 switches to the Dev Mode by typing its name (the first result is checked before
Enter); V4 and V5 run past the 15-second aim because every step is shown at real speed. Trim V4
to its second half (Fill/Fit onwards) if a platform needs it shorter.

Reviewed as contact sheets of five frames per clip in both languages; not yet watched end to end
by a person on a phone.

### 7.7 Turkish stills and loops (2026-10-09)

`release/Senuma-launch-media/tr/`: `store/` (five captioned store screenshots, five extras, hero,
tile, with Turkish captions from MESSAGING_SYSTEM.md), `raw/` (the same screens without captions),
`loops/` (the five landing loops as animated WebP). Made with `CAPTURE_LANG=tr npm run
store:assets`, `CAPTURE_LANG=tr CAPTURE_ONLY=loops vite-node e2e/media-capture.ts` and `python
scripts/media-loops.py`. Every one shows the real Turkish interface.

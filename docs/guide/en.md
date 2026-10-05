# Senuma User Guide

*Make the browser yours.* Senuma turns every new tab into your own workspace: the sites you use,
gathered into Spaces, with one search bar and a look that is yours.

This guide describes the current Senuma release. Every section follows the same pattern: **What it does**,
**How to use it**, **Example**, **Tip**. The Turkish guide (tr.md) has the same sections in the
same order. Names in **bold** are the labels you see on screen.

1. [Getting Started](#1-getting-started)
2. [Home](#2-home)
3. [Spaces](#3-spaces)
4. [Links & Groups](#4-links--groups)
5. [Search](#5-search)
6. [Search Shortcuts](#6-search-shortcuts)
7. [Command Center](#7-command-center)
8. [Modes](#8-modes)
9. [Dock](#9-dock)
10. [Continue / Recently Closed](#10-continue--recently-closed)
11. [Themes](#11-themes)
12. [Backgrounds](#12-backgrounds)
13. [Image Upload](#13-image-upload)
14. [Fill / Fit](#14-fill--fit)
15. [Position](#15-position)
16. [Dim](#16-dim)
17. [Blur](#17-blur)
18. [Atmosphere](#18-atmosphere)
19. [Motion](#19-motion)
20. [Import Links](#20-import-links)
21. [Import / Export](#21-import--export)
22. [Bookmarks](#22-bookmarks)
23. [Privacy & Permissions](#23-privacy--permissions)
24. [Keyboard Shortcuts](#24-keyboard-shortcuts)
25. [Advanced Workflows](#25-advanced-workflows)
26. [FAQ](#26-faq)
27. [Help & Feedback](#27-help--feedback)

---

## 1. Getting Started

**What it does**
The first time you open a new tab, a short setup builds your first Spaces, lets you choose a look,
and offers to bring in your browser bookmarks. It takes about a minute, and everything can be
changed later.

**How to use it**
1. **Your web**: pick what you use the web for (AI, Coding, Research, Work, Design, Media, Gaming,
   Finance, Social, Shopping, Study). Each choice becomes a Space with a few useful starting
   links. When at least two of your choices fit, Senuma also creates starter Modes such as Work
   and Chill.
2. **Your look**: choose a theme and atmosphere; the page behind the panel changes as you pick.
3. **Bring your web**: import your browser bookmarks into Spaces, or **Start fresh**.

**Example**
Pick Coding, Work and Media. You get three Spaces, plus Work, Dev and Chill Modes that each show
the Spaces that belong to them.

**Tip**
Pick only what you really use. Each Space offers more suggestions later, which you add one at a
time (see [Spaces](#3-spaces)).

## 2. Home

**What it does**
Home is the page every new tab opens: a greeting, the search bar, **Continue** (the links you
opened recently), your Spaces, and the dock at the bottom.

**How to use it**
- Click a Space to open it, or press its number key (1–9).
- Top left: the Mode switch. Top right: the time, **Customize** (the swatch icon) and
  **Settings** (the sliders icon).
- Right-click a Space or a link for its menu (open, add to dock, edit, move, remove).

**Example**
Open a new tab, press `2` to open your second Space, then `Esc` to return to Home.

**Tip**
Drag Spaces to reorder them, or focus one and press **Alt + ←/→**. The order is also listed in
**Settings → Spaces**.

## 3. Spaces

**What it does**
A Space gathers everything you use for one kind of activity (work, code, media, research) in
named groups. Spaces made from a template come with a short starter set, and offer more
services as suggestions you can add one at a time.

**How to use it**
- **New Space** above your Spaces (or “Create Space” in the command center). Give it a name, an
  optional note, an icon and a colour.
- Open a Space to see its links. **Open all** opens every link in it.
- In a Space made from a template, open **Suggestions for this Space** at the bottom and click
  any service to add it. It lands in the right group, and disappears from the suggestions.
- An empty Space offers starter sets, or **Add all of these** for the template’s starters.
- Right-click a Space on Home → **Edit** to rename it or change its icon or colour.

**Example**
Your Media Space has YouTube, Netflix and Spotify. Open **Suggestions for this Space**, click
**SoundCloud**, and it appears under **Listen**.

**Tip**
Suggestions are shown as letters, not site icons, so looking through them makes no requests to
those sites. Real icons appear once a link is added.

## 4. Links & Groups

**What it does**
Links live in groups inside a Space, so a Space can stay tidy as it grows.

**How to use it**
- **Add link** at the end of a group, or paste an address into **Filter this Space, or paste an
  address to add it** and press Enter.
- A link has an **Address**, a **Name** and an optional **Icon**: an emoji, or an image address.
  Leave it blank to use the site’s own icon.
- Right-click a link: **Open in new tab**, **Add to dock**, **Edit**, **Duplicate**, **Move to**
  another Space, **Remove** (with Undo).
- Groups: **⋯ → Add group** in the Space header. Click a group’s name to rename it. The group’s
  **⋯** menu moves it up or down, or deletes it; its links are kept.
- Drag links within and between groups.

**Example**
In a Coding Space, add a group named “Docs”, then drag MDN and npm into it.

**Tip**
Type in the filter field to narrow a large Space instantly; press `/` to jump to it and ↓ to reach
the first link. Spaces with many links also show a **Recent** row.

## 5. Search

**What it does**
One search bar searches the web and finds your own links and Spaces as you type.

**How to use it**
- Click the search bar or press `/`, type, and press Enter.
- Plain text goes to your default search: **Browser default** (the engine set in your browser)
  unless you choose another one.
- Results that clearly match your saved links or Spaces appear next to the web search; use ↑/↓
  to choose.
- Paste or type an address (`github.com`) to go straight to it.
- Click the engine icon at the left of the bar to switch engines; the menu also shows each
  engine’s shortcut.

**Example**
Type `figma` and press ↓ then Enter to open your saved Figma link instead of searching for it.

**Tip**
Change the default engine in **Settings → Search → Default search**. A Mode can use its own
engine (see [Modes](#8-modes)).

## 6. Search Shortcuts

**What it does**
*One search bar. Your rules.* A shortcut sends a search straight to one site.

**How to use it**
Type the shortcut, a space, then your query. While you type, the engine’s name appears in the bar
so you can see where Enter will go.

Built-in shortcuts:

| Shortcut | Searches | Shortcut | Searches |
|---|---|---|---|
| `g` | Google | `c`, `gpt` | ChatGPT |
| `d`, `ddg` | DuckDuckGo | `cl` | Claude |
| `y`, `yt` | YouTube | `p` | Perplexity |
| `gh` | GitHub | `a` | Amazon |
| `r` | Reddit | `w` | Wikipedia |
| `so` | Stack Overflow | `npm` | npm |
| `mdn` | MDN | | |

To customize: **Settings → Search → Shortcuts**. Edit any engine’s shortcuts (separate several
with commas), or **Add a search engine** with a name, an `https` address containing `%s` where
the query goes, and a shortcut.

**Example**
`y lofi mix` opens YouTube results for “lofi mix”.
Add your team wiki as **Wiki**, `https://wiki.example.com/search?q=%s`, shortcut `wk`: now
`wk onboarding` searches it.

**Tip**
Clicking into the empty search bar shows a reminder (“Try ‘y lofi mix’…”) until you have used a
shortcut once. In the command center, “search youtube for lofi” also works.

## 7. Command Center

**What it does**
One keyboard shortcut opens everything: links, Spaces, Modes, themes, settings and search.

**How to use it**
- Press **Ctrl+K** (⌘K on Mac), or click the Ctrl K hint in the search bar.
- With nothing typed it shows what you used recently. Type to find links, Spaces, Modes,
  commands (**Create Space**, **Customize appearance**, **Open Settings**), settings sections and
  themes.
- Plain phrases work: “open github”, “dev space”, “switch to work mode”, “use noir theme”.
- ↑/↓ to choose, Enter to run, Esc to close.

**Example**
Ctrl+K → `switch to chill mode` → Enter.

**Tip**
Typing an engine’s name (“youtube”) offers to search it; Enter fills in its shortcut so you only
type the query.

## 8. Modes

**What it does**
*A workspace for every mode.* A Mode changes the whole page for what you are doing: which Spaces
show and in which order, and optionally the theme, background, search engine and dock.

**How to use it**
- Switch with the Mode switch (top left), with **M**, or from the command center. **All Spaces**
  shows everything.
- Manage Modes in **Settings → Modes** (or **Edit Modes…** in the Mode menu): **Add Mode**, name
  it, tick **Spaces in this Mode**, set a **Default search** (or **Keep my default**), turn on
  **Its own dock**.
- Give a Mode its own theme and background with **Change look…**: Customize opens with
  **Applies to → {Mode} only**.

**Example**
A “Focus” Mode shows only Work and Research, uses the Noir theme with a dark photograph, searches
with DuckDuckGo and has a dock of Gmail, Calendar and Notion.

**Tip**
A Mode without its own look uses your default one; in Customize, **Use the default look**
removes a Mode’s own look again.

## 9. Dock

**What it does**
A short shelf of the shortcuts that matter most, at the bottom of every page. It holds links and
whole Spaces (up to 12).

**How to use it**
- Right-click any link or Space → **Add to dock**. Right-click a dock item → **Remove from dock**.
- Drag dock items to reorder them.
- **Settings → Appearance**: **Show the dock** and **Show names under dock icons**.

**Example**
Dock Gmail, Calendar and your Work Space; one click from any new tab.

**Tip**
With **Its own dock** on, a Mode starts from a copy of the shared dock that you can change while
that Mode is active.

## 10. Continue / Recently Closed

**What it does**
**Continue**, under the search bar, lists the links you opened from Senuma, newest first. If you
turn it on, it can also show pages you recently closed in the browser.

**How to use it**
- Click an entry to reopen it; **{n} more** expands the list.
- Right-click an entry → **Remove from Continue**.
- **Settings → Privacy**: **Show Continue**, **Include recently closed tabs** (asks for a
  permission, see [Privacy & Permissions](#23-privacy--permissions)), **Clear activity**.

**Example**
You closed a tab by mistake: with recently closed tabs on, it is in Continue as **Recently
closed**; click to reopen it.

**Tip**
Only links opened from this page are recorded; nothing else you browse is.

## 11. Themes

**What it does**
Six themes set the colours, type and default backdrop: **Dusk**, **Noir**, **Atelier**,
**Fjord**, **Editorial** and **Phosphor**.

**How to use it**
- Open **Customize** (swatch icon, top right; **Settings → Appearance → Customize…**; or the
  command center) and pick a theme. The page previews it live; **Apply** keeps it.
- Or Ctrl+K → `use fjord theme`.

**Example**
Atelier for warm, quiet daytime work; Phosphor for a terminal look in a coding Mode.

**Tip**
With a photograph, Senuma may suggest a theme that suits its brightness (“Try …”).

## 12. Backgrounds

**What it does**
*Make every new tab feel like yours.* The background can be the theme’s own backdrop, a colour, a
gradient, one of the built-in photographs, or an image of your own.

**How to use it**
In **Customize → Background**, choose **Theme default**, **Colour**, **Gradient**,
**Photographs**, or **Your images**. Pictures can then be tuned with Fit, Position, Dim, Blur and
Colour strength (sections 14–17). **Applies to** decides whether the change is for **All Modes**
or the current Mode only. Press **Apply** to keep it.

**Example**
Choose a photograph, set Fill, keep the centre in view, Dim a little, Blur slightly, add Subtle
atmosphere, Apply.

**Tip**
Backgrounds use images stored on your device: a built-in photograph or a file you upload.
**Senuma does not load backgrounds from an image URL.**

## 13. Image Upload

**What it does**
Use your own picture as a background. It is prepared and stored on this device.

**How to use it**
**Customize → Your images → Add image**, then choose a JPEG, PNG, WebP or AVIF file up to 25 MB.
Large images are scaled to 2560 pixels on the long side. You can keep up to 8 images; remove one
with its **×** to add another.

**Example**
Upload a photo from your last trip and use it only in your Chill Mode (**Applies to → Chill only**).

**Tip**
Your images are never uploaded anywhere and are not included in backup files. Keep the originals
if you want them on another computer.

## 14. Fill / Fit

**What it does**
Decides how a picture meets the screen.

**How to use it**
In Customize, with a picture selected: **Fill** covers the whole page (the edges may be cropped);
**Fit** shows the whole picture (the rest of the page shows the backdrop).

**Example**
A panorama: Fill for an immersive page; Fit to see the whole skyline.

**Tip**
Use Fill with [Position](#15-position) to choose which part stays in view.

## 15. Position

**What it does**
Chooses which part of a picture stays in view.

**How to use it**
In Customize, click one of the nine points of the position grid (top/centre/bottom ×
left/centre/right).

**Example**
A portrait photo filled on a wide screen: choose the top centre point so the subject’s face stays
visible.

**Tip**
Position matters most with Fill; with Fit the whole picture is already visible.

## 16. Dim

**What it does**
Darkens a picture so your Spaces and text stay readable on it.

**How to use it**
Drag the **Dim** slider (up to 90%). When you pick a picture, Senuma sets a starting value from its
brightness and your theme.

**Example**
A bright beach photo with the Dusk theme: raise Dim until the Space names read clearly.

**Tip**
If a picture needs a lot of dimming, a lighter theme may suit it better; Senuma suggests one when
it notices.

## 17. Blur

**What it does**
Softens a picture so it becomes a calm backdrop rather than a scene competing with your content.

**How to use it**
Drag the **Blur** slider (up to 40 px). **More adjustments** adds **Colour strength**, from washed
out to vivid.

**Example**
A busy city photo: Blur 12–20 px turns it into soft colour and light.

**Tip**
Blur plus a little Dim is the quickest way to make almost any photo work as a background.

## 18. Atmosphere

**What it does**
Adds grain, glow, fog and vignette around your content, for depth.

**How to use it**
**Customize → Atmosphere**: **Off** (a clean backdrop), **Subtle**, or **Cinematic**.

**Example**
A night photograph with Cinematic atmosphere for a cinema-like evening page.

**Tip**
Atmosphere and Motion are comfort settings: they apply to every Mode, even when a Mode has its
own theme and background.

## 19. Motion

**What it does**
Controls how much the page animates.

**How to use it**
**Customize → Motion**: **Full**, **Reduced** or **Off**.

**Example**
Off on a laptop running on battery, or if you simply prefer a still page.

**Tip**
Your system’s reduced-motion setting is always respected, whatever you choose here.

## 20. Import Links

**What it does**
Turns a pasted list of web addresses into links, sorted into Spaces. This is different from
importing a backup file ([section 21](#21-import--export)).

**How to use it**
1. **Settings → Data → Import links → Paste a list of links**.
2. Put one web address per line. `Name | address` also works.
3. **Sort into Spaces**: Senuma groups the addresses into Spaces by kind (Coding, Media, …).
4. In **Review import**, untick anything you would rather leave out, then **Add {n} links**.

Known sites go to matching Spaces (created if needed); the rest go to a **Bookmarks** Space.
Duplicates and lines that are not web addresses are skipped.

**Example**
```
github.com
Docs | https://devdocs.io
https://www.figma.com
```
becomes three links, reviewed before anything is added.

**Tip**
Copy a list from a note or a colleague’s message; nothing is added until you confirm.

## 21. Import / Export

**What it does**
Saves your whole setup to one JSON file and brings it back, on this or another computer.

**How to use it**
- **Settings → Data → Export your setup → Export**: Spaces, Modes, dock, search and preferences
  in one file. Activity (Continue, recent use) is not included, nor are your own background images.
- **Import a backup file → Choose file**: Senuma shows what the file holds and asks:
  - **Merge into my setup**: adds Spaces and links you do not have; nothing is removed.
  - **Replace my setup**: your current setup is saved as a restore point first.
- **Restore points**: saved before a setup is replaced, restored or reset; the five most recent
  are kept. **Restore** brings one back.

**Example**
Export on your work laptop, import with Merge at home: your work Spaces join your own.

**Tip**
Import also reads earlier Senuma backups and New Tab Folders exports.

## 22. Bookmarks

**What it does**
Brings your existing browser bookmarks into Spaces, sorted by kind and reviewed before anything
is added.

**How to use it**
During setup (**Bring your web**), or later in **Settings → Data → Import browser bookmarks →
Import**. Chrome asks for permission to “read and change your bookmarks”; Senuma only reads them,
once, on this device. Review the proposed Spaces, then add.

**Example**
Two hundred bookmarks become Coding, Media and Work Spaces, with everything unrecognised in a
Bookmarks Space grouped by the folders it came from.

**Tip**
The permission is released right after the import. If you decline it, everything else works the
same.

## 23. Privacy & Permissions

**What it does**
Senuma keeps everything on your device: no account, no analytics, no tracking, and nothing is sent
to us.

**How to use it**
**Settings → Privacy** shows the facts and the controls:

- **Site icons**: **From each site** (default; each icon comes from its own site, and a few are
  packaged so they need no request), **Icon service** (sharper icons from Google’s icon service,
  which sees the site names of your saved links), or **Letters only** (no icon requests at all).
- **Show Continue**, **Include recently closed tabs**, **Clear activity**.
- **Start over**: delete all Spaces and settings; a restore point is saved first.

Permissions:

| Permission | When | Why |
|---|---|---|
| Storage | always | to keep your setup in your browser |
| Search | always | to send searches to your browser’s default engine |
| Bookmarks | only if you import bookmarks | read once; released afterwards |
| Tabs and sessions | only if you turn on recently closed tabs | to list and reopen recently closed pages; Chrome words this as “read your browsing history on all your signed-in devices”; nothing is stored or sent |

**Example**
Choose **Letters only** if you want a new tab that makes no requests at all for icons.

**Tip**
Searches go to the engine you choose, which sees your query as with any search.

## 24. Keyboard Shortcuts

**What it does**
Lets you use the whole page without the mouse.

**How to use it**

| Keys | Action |
|---|---|
| Ctrl+K (⌘K) | Open the command center |
| `/` | Jump to search |
| 1–9 | Open a Space by its number |
| M | Switch Mode |
| Alt + ← / → | Move the focused Space |
| ← ↑ ↓ → | Move between links in a Space |
| ↑ ↓, Enter | Move through results and open one |
| Esc | Close the current panel |

Search shortcuts (`g`, `y`, `gh`…) are set in **Settings → Search**. The list above is also in
**Settings → Keyboard**.

**Example**
Ctrl+K, `work mode`, Enter, `1`: from a blank tab to your first work Space in four keystrokes.

**Tip**
Inside a Space, `/` focuses its filter field.

## 25. Advanced Workflows

**What it does**
Combinations that make Senuma faster than it first looks.

**How to use it / Examples**
- **A Mode per context.** Work Mode: work Spaces, Noir, DuckDuckGo, a dock of daily tools. Evening
  Mode: Media, your own photograph, YouTube as the default search.
- **Your own engines.** Add the search pages you use daily (an internal wiki, a shop, a package
  registry) with short shortcuts. `wiki onboarding` beats three clicks.
- **Keyboard-only start.** `/` then a shortcut search, or Ctrl+K then a Space name.
- **Move between computers.** Export, then import with Merge or Replace. Copy your own background
  images separately; they are not in the file.
- **Clean up an import.** Import bookmarks, then use each Space’s filter and **Move to** to tidy;
  delete a group to lift its links into the Space without losing them.

**Tip**
Before a big change, export a backup. Replacing, restoring and resetting also save a restore
point automatically.

## 26. FAQ

**Can I use an image URL as my background?**
No. Backgrounds are built-in photographs or image files you upload, stored on your device. A link’s
icon can be an image address; backgrounds cannot.

**What is the difference between “Paste a list of links” and “Import a backup file”?**
The first turns a list of addresses into links sorted into Spaces. The second restores a whole
Senuma setup from a JSON file.

**Does Senuma sync between my computers?**
Not in this version. Use Export and Import to move your setup.

**Is my data sent anywhere?**
No. Your setup stays in your browser. Searches go to the engine you choose; site icons come from
each site, or from Google’s icon service if you choose it, or not at all with Letters only.

**Why are suggestions shown as letters?**
So that browsing them makes no requests to those sites. Added links show their real icons.

**I switched the language. Why did some Space names change?**
Names Senuma gave (such as Finance, Media, Work) follow the interface language. Names you typed
yourself never change.

**How do I undo a mistake?**
Removing a link or Space offers Undo. Bigger changes (replace, restore, reset) can be reversed from
**Settings → Data → Restore points**.

**Senuma used to be New Tab Folders?**
Yes. Upgrading keeps your data; your folders became Spaces.

## 27. Help & Feedback

**What it does**
Brings this guide and a way to write to us into Senuma itself. The guide opens in a new tab and
works offline; feedback is an email you read, change and send yourself.

**How to use it**
1. Open **Settings → Help & Feedback**.
2. Choose a guide topic (**User Guide**, **Getting Started**, **Privacy & Permissions**,
   **Import & Backup**) or **Keyboard Shortcuts**.
3. To write to us, choose **Report a problem**, **Suggest an idea** or **Share feedback**, write
   your message, then **Open in email app** or **Copy message**.

Small “learn more” links also sit where questions come up: under search shortcuts, the background
adjustments, recently closed tabs and restore points.

**Example**
Report a problem: describe it, add the steps, leave **Include technical details** ticked, and the
preview shows exactly what will be in the email (Senuma version, browser, operating system,
interface language). Untick it and those lines disappear.

**Tip**
Senuma sends nothing by itself: no report leaves until you press Send in your own email app. After
a week of regular use Senuma may ask once for a short Chrome Web Store review; **Not now** is
remembered.

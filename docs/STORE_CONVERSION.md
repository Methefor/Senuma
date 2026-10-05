# Chrome Web Store conversion — next listing revision

A proposal for the listing revision that goes with the next update (2.0.2 or 2.0.3). **The
listing under review (2.0.0) is not touched**, and nothing here is submitted. The current,
approved copy stays in STORE_LISTING.md until the owner accepts this revision; then it moves there.

## 1. The 5–10 second test

A visitor sees, in this order: icon + title → summary → first screenshot → rating → the first
two lines of the description. Those must answer four questions.

| Question | Answered by | Now | Revision |
|---|---|---|---|
| What is Senuma? | title, summary, screenshot 1 | “New Tab Workspace”; Home screenshot | keep the title; summary says “new tab” and “workspace” in its first six words |
| Why install it? | summary, screenshot captions | lists features | lead with the outcome: your sites one click or one shortcut away, on a page that looks like yours |
| How is it different? | screenshots 2–5, first description lines | one feature per shot | keep; make the *combination* explicit in line 2 of the description: organize + search + Modes + look + privacy |
| Is it trustworthy? | privacy tab, description, reviews | privacy paragraph at the bottom | move “Free. No Senuma account. No analytics.” to line 3; keep the permissions section; answer reviews |

## 2. Fields

| Field | Current | Proposed | Why |
|---|---|---|---|
| Title (manifest `name`) | Senuma — New Tab Workspace | **keep** | “new tab” is what people search; the name stays stable across updates |
| Summary (manifest `description`, ≤ 132) | Turn every new tab into a personal workspace with Spaces, Modes, search, themes and fast access to the web. (107) | **A (recommended):** Your new tab as a personal workspace: Spaces for your sites, search shortcuts, Modes and your own look. Free, no account. (121) · **B:** keep the current one | A adds the two strongest trust words and “search shortcuts”; it is a manifest change, so it ships only inside a package and needs owner approval (the current text was approved 2026-10-03) |
| Category | Productivity | keep | |
| Language | English | English; Turkish once `_locales` ships (LOCALIZATION_ROADMAP.md) | |
| Icon | Ground mark, 128 | keep | reads at 16–128 px; changing it now would cost recognition during the first weeks |
| Small promo tile 440×280 | wordmark + tagline | keep | cannot be localized anyway |
| Marquee 1400×560 | hero | keep | |
| Video | none linked | link the 28.9 s video once it is on YouTube (unlisted is enough) | the store accepts a YouTube URL only; uploading it is a publication step needing approval |

## 3. Five-screenshot narrative

Order = the argument: what it is → stay reasons → try reason → contexts.

| # | Image | Caption (headline · sub) | Answers |
|---|---|---|---|
| 1 | screenshot-1-home | Make the browser yours. · Your sites, your search, your look. | what is it |
| 2 | screenshot-3-search | One search bar. Your rules. · `y lofi mix` searches YouTube. | why install (speed) |
| 3 | screenshot-2-spaces | Everything you use, organized. · Add only what you use. | why install (order) |
| 4 | screenshot-5-modes | A workspace for every mode. · Spaces, look, search and dock change together. | how it differs |
| 5 | screenshot-4-customize | Make every new tab feel like yours. · Your photo: fit, position, dim, blur. | how it differs / delight |

Change from today: search moves to position 2 (it is the most distinctive thing a still can show)
and Modes before Customize. The images themselves do not need recapture; only the order and two
sub-captions change. After 2.0.2 is public, consider swapping #5's sub-caption or adding the Help
& Feedback shot as a sixth only if the store allows it without pushing the others out (max 5).

Privacy is not a screenshot: a wall of settings text converts poorly as an image; it lives in line
3 of the description and in the privacy tab.

## 4. Description (proposed; plain text)

```
Make the browser yours.

Senuma turns every new tab into your own workspace: the sites you use organized into Spaces, one search bar with your shortcuts, Modes for each part of your day, and a look that is yours.

Free. No Senuma account. No analytics.

SEARCH · One search bar. Your rules.
Type a shortcut, a space and your query: "y lofi mix" opens YouTube results for "lofi mix". Shortcuts come ready for Google, YouTube, GitHub, Reddit, ChatGPT, Claude, Wikipedia and more; change them or add any site that has a search page. Your own links and Spaces show up as you type.

SPACES · Everything you use, organized
A Space holds everything for one kind of activity: work, code, media, research. Start from a ready-made set or from scratch, add only the suggestions you want, and arrange links in groups. Keys 1–9 open your first nine Spaces.

COMMAND CENTER · Everything, one shortcut away
Press Ctrl+K (⌘K on Mac) to open any link or Space, switch Mode, change theme or search.

MODES · A workspace for every mode
A Mode changes the whole page for what you are doing: its Spaces and, if you like, its theme, background, search engine and dock. Press M to switch.

CUSTOMIZATION · Make every new tab feel like yours
Six themes, built-in photographs or your own image. Fill or fit it, choose the part that stays in view, set dim, blur and colour strength, add a Subtle or Cinematic atmosphere. Every change is previewed before you apply it.

PRIVACY · Personal by design
Your Spaces, links and settings are stored in your browser. There is no Senuma account and no analytics, and this release needs no Senuma cloud. Your searches go to the search engine you choose. Site icons come from each site by default; you can switch to Google's icon service or to letters only in Settings → Privacy.

HELP · The guide comes with it
Settings → Help & Feedback opens the full user guide (English and Turkish) and lets you report a problem or suggest an idea by email. You see the whole message before you send it.

BACKUP · Your setup, in one file
Export your setup as a JSON file and bring it back, merged or as a replacement; a restore point is saved first. Browser bookmarks or a pasted list of links can be imported too.

OPTIONAL PERMISSIONS
Senuma needs only storage and search. Two features ask for more, and only when you turn them on:
• Import browser bookmarks: reads your bookmarks once, never changes them, and gives the permission back afterwards.
• Recently closed tabs in Continue: Chrome words this as "read your browsing history on all your signed-in devices". Senuma uses it only to list and reopen pages you recently closed.

GOOD TO KNOW
• Backgrounds are images stored on your device (built-in photographs or files you upload), not image links.
• Moving to another computer: export your setup and import it there. This version has no cloud sync.
• Available in English and Turkish.

Your place on the web.

Previously New Tab Folders: same extension, same developer. Your folders became Spaces and everything you saved was kept.
```

Changes against the current text: the combination and the three trust facts are in the first
three lines; Search comes first; the privacy paragraph follows the claims rules (it states what
goes out instead of “nothing is sent”); Help and languages are new. The HELP paragraph is true
only from 2.0.2: do not use this text with a 2.0.0/2.0.1 package.

## 5. What's New

Keep it to four lines, user words, newest first; the text for 2.0.1 and 2.0.2 is in
STORE_LISTING.md. For the update that carries the tab title: “The browser tab now reads Senuma.”

## 6. Trust and help discoverability

- Privacy practices tab: all data boxes cleared, justifications from STORE_LISTING.md (already
  prepared in STORE_PRIVACY_CHANGES.md).
- Privacy policy URL and support email filled in; the same address the product shows.
- Reply to every review; a fix gets a reply saying which version has it.
- The description names Help & Feedback so people know a guide exists before installing.
- No testimonials, counts or rankings in the description (store policy and our own rules).

## 7. Measuring the revision

Before/after, two weeks each, from the developer dashboard: page views → installs (conversion),
impressions → page views. Change one thing at a time where possible: first the screenshot order,
then the description, then (with a package) the summary.

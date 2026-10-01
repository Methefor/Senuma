# Brand direction (for decision — nothing here is chosen)

“Browser OS” is a working codename and “NewTabFolders” is still the extension's name. This
document prepares the naming decision; it does not make it. Changing the name takes one edit
in `src/brand.ts`.

## What the name has to do

1. Say “a place you start from”, not “a folder of bookmarks”.
2. Work in English and Turkish: easy to say, no awkward meaning, no letters that get mangled.
3. Short: two syllables ideally, three at most; readable at 16 px next to the toolbar icon.
4. Not promise what the product is not: no “AI”, no “OS”, no “sync”, no “cloud”.
5. Not lean on someone else's mark: no “Chrome”, “Tab” used the way Google uses it, “Arc”,
   “Notion”, “Raycast”.
6. Survive the store: the Chrome Web Store rejects keyword-stuffed or misleading names, and
   “OS” invites the question “operating system of what?”.
7. Leave room for the listing to keep “new tab” in the subtitle, so search still finds it.

## Shortlist

None of these has had a trademark, domain or store-name search. That search is the first
step after a direction is picked.

| # | Name | Say it | Idea | For | Against |
|---|---|---|---|---|---|
| 1 | **Lumen** | LOO-men | Light you work by | Calm, premium, fits the atmosphere work | Very common product name; hard to own |
| 2 | **Harbor** | HAR-bor | Where you set out from and come back to | Warm, clear metaphor for “start here” | UK spelling differs; crowded in dev tools |
| 3 | **Atrium** | AY-tree-um | The open room every door leads from | Says “Spaces” without saying it | Three syllables; slightly corporate |
| 4 | **Vantage** | VAN-tij | A place to see everything from | Confident | Sounds like finance/SaaS |
| 5 | **Meridian** | muh-RID-ee-un | Your line through the day | Elegant, pairs with Modes | Four syllables; widely used |
| 6 | **Foyer** | FOY-ay | The room you enter first | Exact metaphor | Pronunciation varies; odd in Turkish |
| 7 | **Kiln** | kiln | Where the day is fired | Short, distinctive | Meaning unclear; hard to pronounce in Turkish |
| 8 | **Stillpoint** | STILL-point | The calm centre | Matches “quiet Home” | Long; wellness feel |
| 9 | **Mesa** | MAY-sah | A flat, clear surface | Short; **means “table/desk” in Turkish (masa is close)** | Graphics library of the same name |
| 10 | **Orbit** | OR-bit | Things you return to | Friendly, visual | Overused |
| 11 | **Daybase** | DAY-base | Home base for the day | Plain, descriptive, likely available | Less premium |
| 12 | **Hearth** | harth | The centre of the house | Warm | “th” is hard for non-native speakers |
| 13 | **Sahne** | SAH-neh | Turkish: “stage/scene” | Fits Modes changing the scene; unique abroad | Meaningless to English speakers without help |
| 14 | **Launchpad-free: Liftoff** | LIFT-off | Starting motion | Energetic | Clashes with the calm tone |
| 15 | **Tessera** | TESS-er-ah | One tile of a mosaic | Spaces as tiles; distinctive | Three syllables; spelling |
| 16 | **Nook** | nook | A small place of your own | Short, warm | Known e-reader brand |

Directions, if a recommendation helps the decision: **Harbor**, **Atrium** and **Daybase**
carry the “start from here” idea most directly; **Sahne** is the most ownable but needs a
subtitle everywhere.

## Tagline directions

| Direction | Line |
|---|---|
| What it is | “Your new tab, organized around what you're doing.” |
| Calm | “A quieter place to start.” |
| Modes | “One new tab. A different one for work, for code, for the evening.” |
| Speed | “Everything you open, one keystroke away.” |
| Privacy | “Your web, kept on your device.” |

## If the name changes — what else changes

- Extension name and short name in the store (an existing listing can be renamed; users see
  the new name on their extensions page after the update).
- The Chrome “Change back to Google?” bubble shows the extension name; a rename changes what
  existing users read there.
- Backup file prefix (`browser-os-backup-…`), the upgrade summary text, the landing page.
- Storage keys (`bos.*`) do **not** change; they are internal.

## Open

- The icon (a yellow folder) says “folders”. A new mark is needed with a new name.
- Whether to keep “NewTabFolders” for one release with the new look, then rename.

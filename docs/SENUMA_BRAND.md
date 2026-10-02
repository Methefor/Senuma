# Senuma — brand record (applied locally; public rename on hold)

Date: 2026-10-02. Naming research is closed: Senuma is the brand, Avluna the only fallback.
The development branch carries the Senuma identity; the public rename is on hold until a
professional opinion on the SENUMAC mark (section 1). Status lives in RELEASE_STATUS.md.
Nothing has been published, registered or reserved.

This is preliminary research, not legal advice. Senuma is **not** legally cleared.

Positioning: *Senuma is your personal place on the web.*
Descriptor: New Tab Workspace. Tagline candidates: “Make the browser yours.” / “Your place on the web.”
Fallback name if Senuma is blocked: Avluna, then Yerimo.

## 1. Trademark findings

Source: TMview (EUIPN's search tool), which aggregates the registers of EUIPO, USPTO,
TÜRKPATENT and about seventy other offices. Searched on 2026-10-02: “senuma” (contains and
fuzzy), and the spellings senooma, sennuma, cenuma, zenuma, senoma, restricted to US, EM, TR,
WO, GB, DE. The offices' own portals (USPTO search, EUIPO eSearch, TÜRKPATENT) were not
queried directly; TÜRKPATENT's requires a CAPTCHA.

| Mark | Owner | Office | Status | Classes | Goods/services (relevant part) | Relevance |
|---|---|---|---|---|---|---|
| **SENUMAC** | LLC “SE GROUP”, Odesa, Ukraine | EUIPO, no. 019237140, filed 2025-08-26 | Registered, to 2035 | 7, 9, 42 | Cl. 9: computers; apparatus for data processing; computer interfaces; software for the remote control of office machines; downloadable electronic publications. Cl. 42: computer programming; rental, maintenance and updating of computer software; computer software consultancy; rental of web servers | **HIGH. One letter longer than SENUMA, registered for software goods and services in the EU.** The owner's business appears to be electrical equipment, but the registration is what counts. |
| senumac | same group (“СІ ГРУПП”) | Ukraine, m201116066, 2011 | Registered | 7, 9, 42 | Same family of goods | Same owner, earlier right |
| SENUMAC | Taixing Weirun Machinery | China, 56021782, 2021 | Registered | 7 | Machinery | Low |
| SENUMO | Senumo LLC | USPTO, 90415748, 2020 | Dead | 9 | Thermal and bar-code printers | Low |
| SENUCA | Shenzhen Shengyouchuang | USPTO, 88189542 | Dead | 9 | Electronics | Low |
| SANUMA | Asanuma Corporation | USPTO, 81022532 | Dead | 9 | — | Low |
| Senoma | Dr. Thomas Metterlein | DPMA (DE), 3020172333282 | Registered | 41, 42, 44 | — | Low to medium: similar sound, class 42, Germany only |
| CENUMA | Glaxo Group | USPTO, UKIPO | Dead / expired | 5 | Pharmaceuticals | Low |
| ZENUMA | ZENUMA LLC | USPTO, 99839692 | Pending | 18 | Leather goods | Low |
| 正∞SENUMA | Tensho Kensetsu | JPO, 2002 | Ended | 37 | Construction | Low |

No mark reading exactly SENUMA was found at USPTO, EUIPO or TÜRKPATENT. No live Turkish mark
close to it was found (nearest: “venuma”, clothing; “senomac”, machinery).

## 2. Software and product sweep (2026-10-02)

| Where | Result |
|---|---|
| Chrome Web Store | no results |
| Firefox Add-ons | no add-on named Senuma (search returns unrelated “Sen…” add-ons) |
| Edge Add-ons | could not be read automatically |
| App Store (US, GB, JP, TR, DE) | no same-name app |
| Google Play | no same-name app |
| Microsoft Store | none named Senuma |
| Steam | 0 results |
| GitHub | 10 repositories, all personal or classroom; a personal user account “senuma” (2012, 1 repo); no organisation |
| npm, PyPI, crates.io | no package |
| Docker Hub | lookup inconclusive |
| Product Hunt, Crunchbase | pages blocked to automated reading; web search found nothing |
| LinkedIn company | none |
| CoinGecko | no token |
| openFDA, RxNorm (US only) | no medicine |
| Wikipedia | Japanese surname; people of that name |

## 3. Domains

| Domain | Status |
|---|---|
| senuma.com | Registered 2024-11-12 (to 2026-11-12), nameservers at Afternic: **listed for sale**; asking price not publicly readable |
| senuma.app, .dev, .io, .net | Unregistered |
| senuma.co | Lookup failed; no live site |
| usesenuma.com, getsenuma.com, senumaapp.com, senumahq.com | Unregistered |

Realistic options, in order: `senuma.app` (fits an app, HTTPS-only TLD), `usesenuma.com`,
`getsenuma.com`. The exact `.com` is optional.

## 4. Social handles (public pages only)

| Handle | GitHub | YouTube | TikTok | X | LinkedIn co. | Instagram, Threads |
|---|---|---|---|---|---|---|
| senuma | taken (personal, 2012) | taken | taken | taken | free | not readable without login |
| usesenuma | free | free | free | free | free | not readable |
| getsenuma | free | free | free | free | free | not readable |
| senumaapp | free | free | free | free | free | not readable |

The bare handle is gone on four networks; one variant (`usesenuma` or `senumaapp`) is free
everywhere that could be read. Nothing was created or reserved.

## 5. Brand system (prototype)

- Wordmark: `senuma`, lowercase, system type stack, weight 600, slightly tight. No custom font.
- Icon: **Ground** — a rounded frame with a quarter-round “place” resting in its lower-left
  corner, ink on a warm tile. Source `src/assets/brand/icon.svg`, one-colour `mark.svg`,
  PNGs from `npm run icons`. Alternatives kept in `e2e/senuma-brand.ts`: Shelter (open frame
  with a dot; can read as a C) and Nook (corner and dot; can read as an L).
- Where the brand appears: onboarding, Settings → About, toolbar, store, website. **Not on Home.**
- Script: `e2e/senuma-brand.ts`; output in `proto/senuma/` (git-ignored).

## 6. Rename map (sections A–D applied locally on 2026-10-02; E not started)

**A. One-line switches (already centralised)**

| Location | Now | Then |
|---|---|---|
| `src/brand.ts` `productName` | Browser OS | Senuma |
| `src/brand.ts` `extensionName`, `shortName` | NewTabFolders, NTF | Senuma |
| `src/brand.ts` `tagline`, `description` | launch-surface copy | final copy |
| `src/brand.ts` `backupFilePrefix` | browser-os-backup | senuma-backup |
| Manifest name, short_name, action title | generated from `brand.ts` | follows automatically |

**B. Code and copy**

| Location | Change |
|---|---|
| `assets/icons/icon16/48/128.png` | New icon set |
| `src/i18n/en.ts`, `tr.ts`: `about.migrated`, `migrate.title` | Legacy wording below |
| `src/features/onboarding/Onboarding.tsx` | Add the brand lockup above step one |
| `src/features/settings/Settings.tsx` (About) | Lockup instead of plain name |
| `newtab.html` `<title>` | Stays “New Tab” |
| `package.json` `name` (`browser-os`), lock file | `senuma` |
| `src/core/backup.ts` backup `kind` (`browser-os-backup`) | **Keep reading the old kind**; write the new one. Needs a test. |

**C. Must NOT change**

| Item | Why |
|---|---|
| Storage keys `bos.state`, `bos.snapshots`, `bos.state.newer`, legacy `ntf_data` | Renaming them would orphan every user's data |
| IndexedDB name `bos-assets`, localStorage keys | Same |
| The extension ID / store item | The rebrand is an update of the same item |

**D. Tests, tooling, documents**

`e2e/extension.e2e.ts` (27 mentions, mostly storage keys: unchanged; a few name assertions),
`e2e/rehearsal.ts`, `e2e/rc.e2e.ts`, `e2e/headed*.ts`, `e2e/visual.ts`, `src/core/data-safety.test.ts`,
`scripts/package-rc.mjs` (zip name follows the manifest), `README.md`, `docs/ARCHITECTURE.md`,
`RELAUNCH_CHECKLIST.md`, `RELEASE_STATUS.md`, `PRIVACY_FACTS.md`, `STORE_LISTING.md`,
`HEADED_CHROME_PASS.md`, `MANUAL_QA.md`. All 31 visual captures and the store screenshots are retaken.

**E. Public-facing (separate, approved step)**

Store title, short and full description, screenshots, promo tiles; privacy policy page;
`landing.html`, `pricing.html` (remove), `guide.html`, `changelog.html`; legacy root files
(`index.html`, `js/`, `css/`, root `manifest.json`) are retired with the 1.x build, not renamed.

## 7. Legacy wording (draft, not published)

Upgrade summary title
- EN: “New Tab Folders is now Senuma”
- TR: “New Tab Folders artık Senuma”

Body
- EN: “Same product, new name and a new look. Your Spaces, links and settings came with you.”
- TR: “Aynı ürün; yeni bir ad ve yeni bir görünüm. Alanların, bağlantıların ve ayarların seninle geldi.”

About line
- EN: “Senuma was called New Tab Folders until version 2. Upgraded on {date}; your original data is kept untouched.”
- TR: “Senuma, 2. sürüme kadar New Tab Folders adını taşıyordu. {date} tarihinde yükseltildi; özgün verilerin olduğu gibi duruyor.”

Store “what's new”
- EN: “New Tab Folders is becoming Senuma. It is the same extension from the same developer: your folders become Spaces, and everything you saved is kept.”

Nothing here says or implies an acquisition, a new owner or a separate company.

## 8. What existing users will experience

- The extension updates in place: same store item, same ID, same data.
- Its name changes in the toolbar menu and on `chrome://extensions`, and the icon changes.
- Chrome's own “Change back to Google?” bubble shows the extension's name; anyone who sees it
  after the update will read “Senuma”, a name they have not seen before. The upgrade summary
  must therefore say “New Tab Folders is now Senuma” on the very first tab.
- Fewer permissions than 1.x; no new prompt at update.

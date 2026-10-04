# Senuma Help Center — information architecture

A plan, not a published site. Articles are cut from the user guide (guide/en.md, guide/tr.md),
so the guide stays the single source: an article is one or more guide sections, word for word,
plus the cross-links below. Summaries come from MESSAGING_SYSTEM.md (feature level, medium form).

Principles: six categories, fourteen articles. Each article answers one real question and is long
enough to be worth a page; nothing is split into one-paragraph articles. English and Turkish
share slugs’ structure (`/en/...`, `/tr/...`), titles and order.

## Categories and articles

| # | Category (EN / TR) | Article (EN) | Article (TR) | Slug | Guide sections |
|---|---|---|---|---|---|
| 1 | Get started / Başlarken | Set up Senuma in a minute | Senuma’yı bir dakikada kur | `getting-started` | 1, 2 |
| 2 | | Keyboard shortcuts | Klavye kısayolları | `keyboard-shortcuts` | 24 |
| 3 | Organize / Düzenle | Spaces and suggestions | Alanlar ve öneriler | `spaces` | 3 |
| 4 | | Links and groups | Bağlantılar ve gruplar | `links-and-groups` | 4 |
| 5 | | Dock and Continue | Dock ve Kaldığın yerden | `dock-and-continue` | 9, 10 |
| 6 | Search / Ara | Search and search shortcuts | Arama ve arama kısayolları | `search` | 5, 6 |
| 7 | | Command center | Komut merkezi | `command-center` | 7 |
| 8 | Modes / Modlar | Modes: a workspace for every mode | Modlar: her hâl için bir çalışma alanı | `modes` | 8 |
| 9 | Make it yours / Kişiselleştir | Themes, atmosphere and motion | Temalar, atmosfer ve hareket | `themes` | 11, 18, 19 |
| 10 | | Backgrounds and your own images | Arka planlar ve kendi görsellerin | `backgrounds` | 12, 13, 14, 15, 16, 17 |
| 11 | Your data / Verilerin | Import links and bookmarks | Bağlantıları ve yer imlerini içe aktar | `import-links` | 20, 22 |
| 12 | | Backup, restore and moving computers | Yedek, geri yükleme ve bilgisayar değiştirme | `backup` | 21 |
| 13 | | Privacy and permissions | Gizlilik ve izinler | `privacy` | 23 |
| 14 | — (footer, all categories) | Advanced workflows and FAQ | İleri kullanım ve SSS | `tips-and-faq` | 25, 26 |

URLs: `help.<domain>/<lang>/<slug>`, e.g. `/en/search`, `/tr/search`. Anchors inside an article
reuse the guide’s headings, so `/en/backgrounds#dim` points at Dim. (No domain exists yet; the
privacy policy lives at `methefor.github.io/Senuma/privacy.html` until one does.)

## Cross-links

| From | To | Why |
|---|---|---|
| spaces | links-and-groups, import-links, modes | build a Space, fill it, show it per Mode |
| links-and-groups | dock-and-continue | pin what you use most |
| search | command-center, modes | the same shortcuts work in both; a Mode can change the engine |
| command-center | keyboard-shortcuts, search | |
| modes | backgrounds, search, dock-and-continue | what a Mode can carry |
| backgrounds | themes, modes, backup | theme suggestions; per-Mode look; images are not in backups |
| import-links | backup | the two imports are different things (stated at the top of both) |
| backup | import-links, privacy | |
| privacy | import-links, dock-and-continue | where the optional permissions are asked for |
| tips-and-faq | every article | each answer links to its article |

## Home page

**Getting started path** (in this order): Set up Senuma in a minute → Spaces and suggestions →
Search and search shortcuts → Modes → Backgrounds and your own images.

**Popular articles** (initial guess; replace with real support questions once there are any):
1. Search and search shortcuts
2. Backgrounds and your own images (including “Can I use an image URL?”)
3. Backup, restore and moving computers
4. Privacy and permissions
5. Modes

## Contextual help from inside Senuma (suggestions; not implemented)

Small “Help” links next to existing hints, opening the article in a new tab. They need a
published Help Center first and a decision that the page may link out.

| Place in Senuma | Article |
|---|---|
| Settings → Search, next to the Shortcuts hint | `search#search-shortcuts` |
| Settings → Data → Import links | `import-links` |
| Settings → Data → Backup file | `backup` |
| Settings → Privacy, site icons | `privacy` |
| Settings → Modes intro | `modes` |
| Settings → Keyboard | `keyboard-shortcuts` |
| Customize, under the background picker | `backgrounds` |
| Settings → About | Help Center home |

## Reuse

- **GitHub:** guide/en.md is readable as is; the README links to it.
- **Onboarding help:** the “Tip” of sections 3, 6 and 7 are the three lines worth showing new people.
- **Support replies:** answer with the article link plus the relevant guide section.

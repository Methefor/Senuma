# Senuma personas and target segments

Internal. Evidence comes from public Chrome Web Store listings and reviews of comparable products
(COMPETITOR_POSITIONING.md, figures read 2026-10-05) and from what Senuma 2.0.1 actually does.
There is no Senuma usage data (no analytics, by design), so every segment choice below is a
hypothesis to check against launch signals (GROWTH_STRATEGY.md § 6).

## 1. What the market shows

| Product | Users | Rating | What people come for |
|---|---|---|---|
| Momentum | 2,000,000 | 4.5 (13.7K) | calm, a daily photo, focus, a to-do list |
| Bonjourr | 400,000 | 4.9 (24.3K) | a beautiful, minimal, private new tab |
| Infinity New Tab | ~400,000 | 4.6 (~11.8K) | a grid of site icons (speed dial) |
| Toby | 300,000 | 4.2 (3.3K) | saving and organizing tabs for work |
| Workona | 200,000+ | 4.6 (3.8K) | project workspaces for work |
| Tabliss | ~100,000 | 4.7 (~380) | a simple, private, pretty new tab |
| start.me | ~100,000 | 4.3 (~1.4K) | a dashboard of links and widgets |

Readings:

1. **Looks reach the most people.** The largest products sell calm and beauty (Momentum,
   Bonjourr). Visual customization is the widest door in.
2. **Organization gets the most committed users but they resent paywalls.** Toby's reviews praise
   the organization and complain about the 60-tab free limit and per-workspace billing; Workona is
   $6–7/month for unlimited workspaces. People who organize their browser are willing to change
   tools when pricing changes.
3. **Privacy and openness earn the best ratings.** Bonjourr and Tabliss (no account, no data
   collection, open source) have the highest scores in the category.
4. Nobody combines all three: a workspace (organization + Modes + search) that is also beautiful
   and private, free, without an account.

## 2. Personas

Each persona: who, the problem in their words, the Senuma features that answer it, where they can
be reached, and the first thing to show them.

### A. Developers and AI power users — PRIMARY

- **Who:** engineers, technical founders, people living in ChatGPT, Claude, Perplexity, GitHub,
  Vercel, docs and dashboards; often several browser profiles or windows per context.
- **Problem:** “I open the same ten sites by hand all day; my bookmarks bar is a mess; switching
  between work and side project is a different set of tabs every time.”
- **Senuma answer:** Coding and AI Spaces with the catalog (GitHub, Vercel, Netlify, Supabase,
  MDN, Stack Overflow, ChatGPT, Claude, Gemini, Copilot…), Ctrl+K command center, search shortcuts
  (`gh`, `mdn`, `npm`, `so`, `c`, `cl`, custom `%s` engines), Modes (Work / Dev / Chill), dock,
  keyboard-only use, JSON backup, no Senuma account and no analytics.
- **Why primary:** strongest product fit (the keyboard and search features are built for them),
  reachable through communities that welcome tools when the post is useful (GitHub, dev
  communities, r/SideProject), and they talk about tools they adopt. Privacy is a selling point,
  not a footnote.
- **First thing to show:** Ctrl+K → `gh senuma` / `mdn grid` → Enter. Then Work Mode → Dev Mode.

### B. Knowledge workers — PRIMARY (second wave, same features)

- **Who:** Gmail, Google Drive, Calendar, Slack, Notion, Figma, Teams, Asana/Linear users.
- **Problem:** fragmented browser workflow; the same tools re-opened daily; personal and work
  mixed in one window.
- **Senuma answer:** Work Space and group names, Modes that separate work and evenings, Continue
  (recent links), dock for the five daily tools, search across their own links.
- **Why:** the Toby / Workona audience, frustrated by limits and prices. Senuma is free, needs no
  account, and keeps work organized without a team product's complexity.
- **Note:** Senuma does not save or restore open tabs (Toby's core); position it as “your tools
  one click away”, not as a tab manager.
- **First thing to show:** Work Mode with Gmail/Calendar/Slack/Notion in the dock, then Ctrl+K.

### C. Creators and designers — SECONDARY (the visual door)

- **Who:** designers, video editors, people who care how their screen looks; Momentum and
  Bonjourr users.
- **Problem:** “My new tab is ugly or boring; I want my own photo, not a stock feed.”
- **Senuma answer:** own images (stored on the device), Fill/Fit, 3×3 position, dim, blur,
  colour strength, Subtle/Cinematic atmosphere, six themes, per-Mode looks.
- **Why secondary:** the widest audience and the most shareable content (before/after videos),
  but the most crowded and taste-driven segment; Senuma wins here only together with organization
  (“beautiful *and* useful”).
- **First thing to show:** plain Chrome tab → own photo → Fill → position → blur → Cinematic.

### D. Students and researchers — SECONDARY / LATER

- **Who:** university students, academics, self-learners (Turkish students are a natural first
  group given the Turkish interface).
- **Problem:** sources scattered across Wikipedia, Scholar, YouTube lectures, Reddit, course portals.
- **Senuma answer:** Research and Study Spaces, search shortcuts (`w`, `y`, `r`, custom Scholar
  engine), paste-a-list import, Modes for study vs. leisure, free.
- **Why later:** price-sensitive and reachable, but seasonal (term starts) and less vocal in the
  store. Good for the Turkish launch through student communities.
- **First thing to show:** Study Mode; `w photosynthesis`; a research Space with groups.

### E. Gamers and entertainment users — LATER (content hook, not a target)

- **Who:** Steam, Twitch, Kick, YouTube, Discord, Netflix users.
- **Senuma answer:** Gaming Space and Mode, dark themes and backgrounds.
- **Why later:** the visual “Work Mode → Gaming Mode” switch is great short-form content and
  should be used as a hook; but the segment's need is light, the store category is not where they
  look, and retention is unproven. Revisit if content from this angle converts.

## 3. Segment decision

Confirmed by the owner on 2026-10-05:

| Tier | Segment | Role in launch |
|---|---|---|
| Primary | Developers / AI power users | lead message, communities, GitHub |
| Primary | Knowledge workers | store copy, Modes and Work content |
| Secondary | Creators / designers | short-form visual content, landing hero visuals |
| Secondary | Students / researchers | Turkish launch, term-start content |
| Later | Gamers | content hook only (“Work → Gaming”) |

Check after 4–6 weeks (GROWTH_STRATEGY.md § 6): which channel brought installs that stayed
(weekly users trend), which persona's words appear in reviews and feedback. Move a segment up or
down on that evidence, not on taste.

## 4. Messages per persona (from MESSAGING_SYSTEM.md, no new claims)

| Persona | Hook | Proof in the product |
|---|---|---|
| Developers / AI | Everything, one shortcut away. | Ctrl+K, `gh`, `mdn`, `c`, `cl` |
| Knowledge workers | Everything you use, organized. | Spaces, dock, Work Mode |
| Creators | Make every new tab feel like yours. | Fill/Fit, position, blur, atmosphere |
| Students | One search bar. Your rules. | `w`, `y`, custom engines |
| All | Make the browser yours. · Personal by design. | no Senuma account, no analytics, data stays local |

## 5. Acquisition matrix

Headlines are from MESSAGING_SYSTEM.md; demos are concepts in CONTENT_LIBRARY.md (#).

| | Developers / AI power users | Knowledge workers | Creators / designers | Students / researchers | Gamers (hook only) |
|---|---|---|---|---|---|
| Tier | Primary | Primary | Secondary | Secondary | Later |
| Core pain | the same dev and AI sites opened by hand all day; bookmarks bar chaos; context switches | work scattered over Gmail, Drive, Calendar, Slack, Notion, Figma; work and personal mixed | an ugly or generic new tab; wants their own image without paying | sources spread over Wikipedia, YouTube, Reddit, portals | wants a different space after work |
| Senuma solution | Coding and AI Spaces, Ctrl+K, `gh`/`mdn`/`npm`/`c`/`cl`, custom engines, Dev Mode | Work Space with groups, dock for daily tools, Work/Chill Modes, search over own links | own images, Fill/Fit, position, dim, blur, atmosphere, themes, per-Mode looks | Research/Study Spaces, `w`/`y`/`r` shortcuts, paste-a-list import, backup file | Gaming Space and Mode, dark looks |
| Best demo | #12 developer new tab; #13 AI tools; #4 Ctrl+K | #14 the same ten sites; #7 three lives; #15 paste a list | #8 plain → cinematic; #9 own photo; #10 dim/blur/atmosphere | #16 research setup; #1 `y lofi mix` | #6 Work → Gaming |
| Strongest headline | Everything, one shortcut away. | Everything you use, organized. | Make every new tab feel like yours. | One search bar. Your rules. | A workspace for every mode. |
| Best channel | GitHub, X, Bluesky, DEV.to, r/SideProject, developer and AI communities | Threads, LinkedIn, the store listing itself | Reels, TikTok, Shorts | TikTok, Reels, Turkish student communities | TikTok, Reels |
| Likely objections | “Another new tab?” · “What does it send?” · “Is it open source?” · “No sync?” | “I already use bookmarks/tab groups.” · “Will it slow my browser?” · “Does my company allow it?” | “Is the photo uploaded somewhere?” · “Can I use a video or a URL?” | “Is it free?” · “Do I need an account?” | “Why not just bookmarks?” |
| Honest answers | a workspace, not a feed or a pretty page; Settings → Privacy lists what goes out; source is public, not open-source licensed; backup file today, sync explored separately | Spaces + Modes do what the bookmarks bar cannot; it is the new tab page plus a small service worker, with no content scripts on other sites; two required permissions | images stay on the device; no video or image URLs today | free; no account | one key changes the whole page |
| Ideal CTA | View on GitHub · Add to Chrome | Add to Chrome — free, no account | Add to Chrome and make it yours | Chrome’a ekle — ücretsiz / Add to Chrome — free | Add to Chrome |

Use of the matrix: one persona per post. The hook is that persona's headline or pain; the demo is
its best concept; the CTA is its own. Posts that try to address two personas address none.

Sources: see COMPETITOR_POSITIONING.md.

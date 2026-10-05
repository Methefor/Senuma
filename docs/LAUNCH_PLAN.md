# Launch plan and short-form content system

Internal plan; nothing is posted or scheduled. Every clip is a real screen recording of the real
product (MEDIA_PLAN.md pipeline: `e2e/media-capture.ts` + `scripts/media-compose.py`, or a person
recording). No fake numbers, no competitor names, no claims beyond MESSAGING_SYSTEM.md.

## 1. Content rules

- One idea per clip, shown in the first 2 seconds; the product does the talking.
- 9:16 for TikTok/Reels/Shorts (1080×1920, product centred, captions in the safe area), 16:9 for
  YouTube/X/GitHub, square for LinkedIn if used.
- Captions burned in (most people watch muted); English and Turkish versions of the best clips.
- Each post links the store listing with a channel tag (`?utm_source=tiktok` etc.).
- Disclose being the maker in communities. Never ask for upvotes or reviews in posts.
- Privacy claims (MESSAGING_SYSTEM.md, “Privacy claims”): say no Senuma account, no analytics, no
  Senuma cloud required, workspace data stays local in this release. **Never** say or show that
  Senuma makes no network requests: searches go to the chosen search provider, and site icons
  come from the sites or from Google’s icon service if chosen.
- Music: only tracks the platform licenses for that use (TikTok/Reels libraries); none in files
  we keep (MEDIA_PLAN.md: no licensed track yet).

## 2. Concepts (18)

| # | Concept | Hook (on screen) | What is recorded | Persona | Best platforms |
|---|---|---|---|---|---|
| 1 | Before / after | Your Chrome new tab can do this. | plain Chrome new tab → Senuma Home with a photo, Spaces, dock | all | TikTok, Reels, Shorts |
| 2 | `y lofi mix` | Stop opening YouTube first. | type `y lofi mix` → results | all, students | TikTok, Shorts |
| 3 | Shortcut stack | One search bar. Your rules. | `gh`, `mdn`, `w`, `c` searches back to back | developers | X, Shorts, DEV.to GIF |
| 4 | Ctrl+K | Everything, one shortcut away. | Ctrl+K → `media` → open; `switch to work mode`; `use noir theme` | developers | X, Threads, Shorts |
| 5 | Work → Gaming | Work mode → Gaming mode in one click. | M → Gaming: Spaces, theme, background and dock change together | gamers, all | TikTok, Reels |
| 6 | Same browser, three lives | A workspace for every mode. | Work → Dev → Chill, 2 s each | knowledge workers | Reels, LinkedIn |
| 7 | 10 sites | I stopped opening the same 10 websites manually. | dock + Work Space; one click each | knowledge workers | TikTok, Threads |
| 8 | AI tools | All my AI tools on one page. | AI Space: ChatGPT, Claude, Gemini, Perplexity, Copilot; `c`/`cl` searches | AI users | X, Threads, r/ChatGPT answers |
| 9 | Dev setup | My developer new tab. | Coding Space, dock (GitHub, Vercel), `gh`/`npm`/`mdn` | developers | X, DEV.to, GitHub README |
| 10 | Cinematic | Make every new tab feel like yours. | own photo → Fill → position → dim → blur → Cinematic | creators | TikTok, Reels |
| 11 | Fill vs Fit | Your photo, framed your way. | Fit → Fill → 3×3 positions | creators | Reels, Shorts |
| 12 | Theme roulette | Six themes, one click each. | Customize: Atelier → Noir → Phosphor → Fjord… | creators | TikTok |
| 13 | Suggestions | Add only what you use. | Media Space → suggestions → add SoundCloud, HBO Max | all | Shorts, Threads |
| 14 | Paste a list | 40 links sorted in seconds. | paste a list → Sort into Spaces → review → Add | knowledge workers, students | X, LinkedIn |
| 15 | Backup | Your setup, in one file. | Export → new profile → Import → Merge | developers | X, GitHub |
| 16 | Privacy in 10 s | No Senuma account. No analytics. | Settings → Privacy: the five facts, **Site icons** (From each site / Icon service / Letters only), the optional permissions; then Export shows the setup is one local file | developers, privacy-minded | X, Reddit answers |
| 17 | Keyboard only | No mouse needed. | Tab, 1–9, M, `/`, Ctrl+K, Esc | developers | X, Shorts |
| 18 | Turkish | Tarayıcını kendine göre yap. | the TR interface: onboarding in Turkish, `y lofi mix` | TR users | TikTok TR, Reels TR |

## 3. Platform versions (examples)

The same recording, cut and written differently per audience:

**Concept 5 — Work → Gaming**
- TikTok/Reels (9:16, 8 s): cold open on Work Mode, caption “Work mode →”, press M, Gaming appears,
  caption “→ Gaming mode. Same tab.” Text post: “one key switches my whole new tab”.
- X (16:9 GIF): “Modes in Senuma change Spaces, theme, background, search engine and dock together.
  M to switch. Free, no account.” + store link.
- Threads: question format, “Do you keep work and evenings in separate browsers? I made Modes
  instead.” + clip.

**Concept 9 — Dev setup**
- DEV.to article: “Building a keyboard-first new tab for developers” (what it does, how search
  shortcuts and `%s` engines work, privacy design, what is not there yet); GIFs 2 and 3.
- GitHub README: the GIF and a 3-line “Why”.
- X thread: 4 posts (problem → Spaces → shortcuts → Ctrl+K), one GIF each.

**Concept 1 — Before / after**
- TikTok: 6 s, no voice, hard cut on a beat from Chrome's default page to Senuma; caption
  “Your Chrome new tab can do this.” End frame: “Senuma · free on the Chrome Web Store”.
- Reels: same cut, caption “Turn Chrome into your personal workspace.”
- YouTube Shorts: 15 s version adding Spaces and Ctrl+K after the cut (Shorts viewers stay longer).

**Concept 16 — Privacy**
- Reddit (answer only, in threads asking for private new tabs): one paragraph, maker disclosed,
  the facts including what does go out (searches to the chosen provider, site icons), link to
  the privacy policy, no hype.

## 4. Sequence (6 weeks, after the store update with Help & Feedback is live)

| Week | Store / GitHub | Short video | Communities | Other |
|---|---|---|---|---|
| 0 (prep) | listing polished, README with GIFs, UTM links, Gmail labels | record 1, 2, 4, 5, 10 (EN), 18 (TR) | read rules of each target community | landing page if approved |
| 1 | release notes | 3 clips (1, 2, 5) | r/SideProject post; X/Threads launch thread | Turkish post (18) |
| 2 | answer reviews | 3 clips (4, 10, 7) | DEV.to article (9) | |
| 3 | | 3 clips (8, 11, 6) | Show HN (once) if feedback so far is good | |
| 4 | first review of metrics (GROWTH_STRATEGY § 6) | 3 clips, best format repeated | helpful replies only | keep two best channels |
| 5 | | 2–3 clips | r/chrome_extensions | Product Hunt prep if ≥ 20 reviews |
| 6 | update notes for feedback fixes | 2–3 clips | | Product Hunt launch (if ready) |

Time budget: about 6–8 hours a week. Stop or change anything that has not produced store visits
after two tries.

## 5. Captions and copy bank (EN / TR)

| EN | TR |
|---|---|
| Your Chrome new tab can do this. | Chrome’un yeni sekmesi bunu da yapabiliyor. |
| I stopped opening the same 10 websites manually. | Aynı 10 siteyi elle açmayı bıraktım. |
| Turn Chrome into your personal workspace. | Chrome’u kişisel çalışma alanına çevir. |
| Work mode → Gaming mode in one click. | Tek tıkla iş modundan oyun moduna. |
| One search bar. Your rules. | Tek arama çubuğu. Senin kuralların. |
| Everything, one shortcut away. | Her şey tek kısayol uzağında. |
| Make every new tab feel like yours. | Her yeni sekme sana ait hissettirsin. |
| Free. No Senuma account. No analytics. | Ücretsiz. Senuma hesabı yok. Analitik yok. |

# Growth strategy

Internal plan; nothing here is published, bought or created. Cost rule: **no recurring spend
before a clear traction or monetization signal.** Everything below is organic and free.

Inputs: PERSONAS.md (who), COMPETITOR_POSITIONING.md (against whom), MESSAGING_SYSTEM.md (words),
MEDIA_PLAN.md (assets), LAUNCH_PLAN.md (content and calendar), HELP_FEEDBACK_SYSTEM.md (feedback
and the review request).

## 1. Position

**Personal Browser Workspace.** Organization + Search + Modes + Customization + Privacy, free,
no account.

- Primary line: *Make the browser yours.* Secondary: *Your place on the web.*
- Reason to try: the look (own photo, atmosphere). Reason to stay: Spaces, search shortcuts,
  Ctrl+K, Modes. Reason to trust: no account, and nothing is sent to us.
- Lead audience: developers and AI power users, then knowledge workers (PERSONAS.md § 3).

## 2. Funnel and what moves it

| Stage | Signal (no analytics) | Levers |
|---|---|---|
| Discover | store impressions, post views, referrals | relevant name/description, short-form video, community posts, GitHub |
| Visit store | store page views | thumbnails and hooks that show the real product |
| Install | installs, store conversion | first screenshot, first two lines of description, recent reviews |
| First week | weekly users trend, uninstall feedback | onboarding (1 minute), first Space useful at once, contextual help |
| Habit | weekly users / installs | Modes, search shortcuts, Ctrl+K: things that save time daily |
| Advocate | reviews, feedback, mentions | review card after real use (§ HELP_FEEDBACK_SYSTEM 5), replying to everyone |

The first constraint is **visibility and reviews**: a new listing with no ratings converts poorly.
Weeks 1–6 aim at a steady trickle of real users who leave honest reviews, not a spike.

## 3. Channels

Ranked by expected value per hour for a solo developer with no budget.

| # | Channel | Fit | How (no spam) | Cadence |
|---|---|---|---|---|
| 1 | **Chrome Web Store listing** | everyone | specific description (Spaces, Modes, shortcuts, Ctrl+K, private); first screenshot = real Home; update notes every release; answer reviews | every release |
| 2 | **GitHub** (README, releases, a guide link) | developers | README with GIFs, “why” section, privacy facts; Show-and-tell where welcome | at launch, then per release |
| 3 | **Short video** (YouTube Shorts, TikTok, Instagram Reels) | creators, students, general | the LAUNCH_PLAN concepts; real screen recording, no fake numbers | 3 per week for 6 weeks, then 1–2 |
| 4 | **Developer communities** (DEV.to article, Hacker News “Show HN” once, relevant Discords/Slack where tools are welcome) | developers, AI users | a useful write-up (“how I organized 40 AI and dev tools on my new tab”), product second | one strong post per community, ever; reply to every comment |
| 5 | **Reddit** | by subreddit | r/SideProject (self-promotion welcome); r/chrome_extensions; in r/productivity, r/webdev, r/ChatGPT only answer threads that ask for exactly this, disclosed as the maker; follow each subreddit's rules, ask mods when unsure; Reddit's own guideline: own posts ≤ ~10 % of activity | 1 launch post + helpful replies |
| 6 | **Product Hunt** | early adopters, makers | one launch when there are ≥ 20 reviews and the landing page exists; gallery = the 5 screenshots + video; maker comment telling the story; no upvote begging | once |
| 7 | **X / Threads / Bluesky** | developers, makers | build-in-public notes with GIFs; reply to “what's your new tab?” threads | 2–3 per week |
| 8 | **Turkish communities** (Ekşi-style forums, Turkish dev/student Discords, LinkedIn TR) | TR students, devs | Turkish copy from MESSAGING_SYSTEM.md; Turkish guide | launch week + term start |
| 9 | Newsletters/blogs that list extensions | all | short pitch with the video; never pay for placement | after reviews exist |

Not now: paid ads, influencer payments, giveaways for reviews (store policy forbids incentivized
reviews), cross-posting the same text everywhere.

## 4. Store conversion

- Title stays “Senuma — New Tab Workspace”; summary says what it does in plain words.
- First screenshot: Home with real Spaces and a photo, captioned “Make the browser yours.”
- Order the rest by the reason to stay: Spaces → search shortcuts → Modes → Customize → privacy.
- Description opens with the five-part combination and “Free. No account. Nothing is sent to
  us.” before any feature list.
- Video: the 28-second silent cut (MEDIA_PLAN.md) on YouTube, linked in the listing.
- Respond to every review within a week; fix and say so.
- The “Featured” badge is being retired in 2026 and ratings now weigh recent reviews; recency and
  relevance matter more than badges.
- A Turkish listing needs `_locales` (HELP_FEEDBACK_SYSTEM.md § 2.3); plan it for the update after
  next if Turkish traffic shows up.

## 5. Landing page (plan only; nothing built or deployed)

Domain: none yet; the privacy page lives at methefor.github.io/Senuma. A landing page can live
there too (free) until a domain is bought.

| # | Section | Content | Asset |
|---|---|---|---|
| 1 | Hero | **Make the browser yours.** · *Your place on the web.* · “Add to Chrome — free, no account” | screenshot-1-home, looping |
| 2 | Real UI demo | the 28-second video, muted autoplay with a play button fallback | video |
| 3 | Spaces | Everything you use, organized. (medium + long copy) | gif-1 create Space |
| 4 | Search | One search bar. Your rules. `y lofi mix` | gif-3 search shortcut |
| 5 | Command center | Everything, one shortcut away. | gif-2 command center |
| 6 | Modes | A workspace for every mode. Work → Chill | gif-5 Modes |
| 7 | Customization | Make every new tab feel like yours. | gif-4 background |
| 8 | Privacy | Personal by design. The five privacy facts, the permission table, link to the privacy policy | none (text) |
| 9 | Guide | “Read the guide” (EN/TR), Getting Started first | link |
| 10 | Feedback | Report a problem · Suggest an idea · Share feedback (same three cards as the product) | — |
| 11 | CTA | Add to Chrome · Previously New Tab Folders? Your data is kept. | — |

Rules: no reviews, ratings or user counts until real; no competitor names; Turkish version mirrors
the English one (`/tr/`); page weight under 1.5 MB before the video; no analytics script; fonts
self-hosted or system.

## 6. Measurement without product analytics

Senuma has no analytics and this plan adds none. Any future in-product measurement is a separate
proposal needing explicit approval.

Sources available for free:

| Source | Gives |
|---|---|
| Chrome Web Store developer dashboard | impressions, page views, installs, uninstalls, weekly users, ratings, by country/language |
| Store reviews | rating, themes, recency |
| Feedback inbox (Gmail labels) | volume and themes by category |
| Social / community posts | views, replies, saves; link clicks via the platform's own stats |
| GitHub | stars, traffic, referrers (repo insights) |
| Store listing links with a `utm_source` per channel | which channel sent store visits (the store dashboard reports UTM sources) |

Weekly sheet (one row per week):

| Metric | Definition | Early target (weeks 1–6) |
|---|---|---|
| Store conversion | installs ÷ store page views | ≥ 15 % (category listings with few reviews often sit lower; track the trend) |
| Weekly users trend | dashboard weekly users | growing week over week |
| Retention proxy | weekly users ÷ cumulative installs | ≥ 40 % after week 4 |
| Uninstall rate | uninstalls ÷ installs | falling |
| Review rate | new reviews ÷ new installs | ≥ 1 % |
| Rating | average of last 30 days | ≥ 4.5 |
| Feedback | messages per week by category | read, classified, answered |
| Channel response | views → store visits per channel (UTM) | double down on the best two |

Decision rules: after 4 weeks, keep the two channels with the best store visits per hour spent;
drop the rest. If conversion is low but visits are high, fix the listing first. If retention is low,
look at feedback themes before adding features.

## 7. Monetization (not now)

Nothing is gated and nothing will be taken away. A future paid layer, if any, must add value
(e.g. optional sync in 2.1, extra themes/photo packs) and only after traction; decision belongs to
the owner and is outside this plan.

## Sources

- [Discovery on the Chrome Web Store](https://developer.chrome.com/docs/webstore/discovery)
- [Chrome Web Store updates 2026: badges and ratings](https://developer.chrome.com/blog/cws-review-updates-2026)
- [Chrome Web Store analytics: page views by UTM source](https://developer.chrome.com/blog/cws-analytics-revamp)
- [Chrome Web Store listing localization](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Reddit self-promotion rules overview](https://redship.io/blog/reddit-self-promotion-rules)
- Competitor and audience evidence: COMPETITOR_POSITIONING.md, PERSONAS.md

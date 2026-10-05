# Growth strategy

Internal plan; nothing here is published, bought or created. Cost rule: **no recurring spend
before a clear traction or monetization signal.** Everything below is organic and free.

Inputs: PERSONAS.md (who), COMPETITOR_POSITIONING.md (against whom), MESSAGING_SYSTEM.md (words),
MEDIA_PLAN.md (assets), LAUNCH_PLAN.md (six-week calendar), CONTENT_LIBRARY.md (clips),
STORE_CONVERSION.md (listing), LANDING_PLAN.md (site), PRODUCT_HUNT.md, GITHUB_PRESENCE.md,
LOCALIZATION_ROADMAP.md, HELP_FEEDBACK_SYSTEM.md (feedback and the review request).

## 1. Position

**Personal Browser Workspace.** Organization + Search + Modes + Customization + Privacy, free,
no account.

- Primary line: *Make the browser yours.* Secondary: *Your place on the web.*
- Reason to try: the look (own photo, atmosphere). Reason to stay: Spaces, search shortcuts,
  Ctrl+K, Modes. Reason to trust: no Senuma account, no analytics, no
  Senuma cloud required; workspace data stays local in this release.
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

The next listing revision (the 5–10 second test, summary, screenshot order, description, trust)
is STORE_CONVERSION.md. Nothing about the listing under review changes.

## 5. Landing page

Architecture, copy deck (EN/TR), visual direction, asset map and implementation plan:
LANDING_PLAN.md. Not built, not deployed.

## 6. Measurement without product analytics

Senuma has no analytics and this plan adds none. Any future in-product measurement is a separate
proposal that needs explicit approval. Everything below comes from outside the product.

### 6.1 What the sources really give

**Chrome Web Store developer dashboard** (the fields it has today; all graphs export to CSV):

| Tab | Metrics |
|---|---|
| Installs & Uninstalls | installs and uninstalls over time; installs by region, by language, by operating system |
| Impressions | impressions in store placements; **page views** of the listing; page views by `utm_source`, `utm_medium`, `utm_campaign` |
| Weekly Users | weekly users; by region, language, OS, **item version**; enabled vs disabled |
| Ratings | ratings over time; the reviews themselves |

Not available there: retention cohorts, time in product, feature use, per-user anything. Do not
invent them; the proxies below are the honest substitute.

| Other source | Gives |
|---|---|
| Feedback inbox (Gmail labels) | count per week, per category; themes (the board, HELP_FEEDBACK_SYSTEM.md § 4) |
| GitHub Insights → Traffic | views, unique visitors, referrers, popular content (last 14 days only: copy weekly), stars |
| YouTube Studio / TikTok / Instagram insights | views, watch time, average view duration or completion, likes/saves/shares, link or profile clicks where offered |
| X / Threads / Bluesky | impressions, replies, reposts, link clicks (X analytics); Bluesky gives counts only |
| Reddit / DEV.to / Hacker News | score, comments, article reads (DEV.to) |
| Landing page (later) | **server-side page counts from the host only, if any**; no analytics script. GitHub Pages gives none: the store's UTM page views are the measure |

Every outbound store link carries `utm_source` (channel), `utm_medium` (format) and
`utm_campaign` (`launch-w1`…), so store page views can be split by channel in the dashboard.

### 6.2 The weekly sheet

One spreadsheet, one row per week, filled every Friday (30 minutes):

| Column | Source | Definition |
|---|---|---|
| Impressions | store | store placements |
| Page views | store | listing views |
| Tagged visits by channel | store (UTM) | page views per `utm_source` |
| Installs / Uninstalls | store | in the week |
| Store conversion | computed | installs ÷ page views |
| Weekly users | store | end-of-week value |
| Users per install | computed | weekly users ÷ cumulative installs (a retention proxy) |
| Uninstall ratio | computed | uninstalls ÷ installs in the week |
| New ratings / average | store | count; average of the last 30 days |
| Review rate | computed | new reviews ÷ new installs |
| Feedback count by category | inbox | Bug, UX, Feature, Catalog, Localization, Performance, Privacy, Compatibility |
| Top three feedback themes | board | text |
| GitHub views / unique / stars | GitHub | weekly |
| Video views, average view %, shares | platforms | per clip, best and worst noted |
| Link clicks | platforms / UTM | per channel |
| Hours spent per channel | own log | for “per hour” comparisons |

### 6.3 Baseline, weekly review, decision point

- **Week 0 baseline:** fill one row before the first post (impressions, page views, installs,
  weekly users, rating count), so every later number has something to stand against. For a new
  listing most cells are near zero; record them anyway.
- **Weekly review (Friday):** fill the row; note the best and worst post and why; move feedback
  into the board; pick next week's concept for each kept channel; answer every open review and
  email.
- **Week-4 decision:** rank channels by **tagged store visits per hour spent**, then by installs
  where the dashboard lets you tell. Keep the top two. Continue a channel only if it produced
  store visits in at least two of its posts. Stop a channel that produced none after three posts,
  or that costs replies without visits. Fix order when numbers disagree: low impressions →
  listing relevance and posting; high page views but low conversion → listing (STORE_CONVERSION.md);
  good installs but falling users per install → product and onboarding, read the feedback first.
- **Six-week review:** same sheet; Product Hunt go/no-go against PRODUCT_HUNT.md § 1.

Early targets are directions, not promises: conversion and review rate rising week over week,
users per install holding above roughly 40 % after week 4, a 30-day rating of 4.5 or better.
There is no Senuma history to benchmark against yet; replace these with real baselines after
week 4.

### 6.4 Evidence required before spending any money

No recurring spend until **all** of these hold for four consecutive weeks:

1. weekly users grow week over week without a new post driving them (organic store discovery);
2. users per install stays at or above the week-4 level (people keep it);
3. at least one channel shows a repeatable cost in hours per install, so a paid test has a
   number to beat;
4. the rating is ≥ 4.5 with ≥ 20 reviews;
5. the feedback board has no open P0/P1.

Even then the first spend should be a small, capped, one-off test (a domain; one boosted post
measured through its own UTM tag), decided by the owner. Paid influencers, paid reviews and
giveaways for reviews stay out (store policy and our own rules).

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

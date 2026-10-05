# Product Hunt — preparation (not launched)

Prepared only. **Do not create the launch page or schedule anything** without the owner's
go-ahead. Product Hunt is not the first channel: wait until Senuma has real usage and reviews.

## 1. When

Launch only when all of these are true:

- the public store version is 2.0.2 or later (Help & Feedback is in);
- ≥ 20 honest store reviews and a 30-day rating ≥ 4.5;
- the landing page is live (LANDING_PLAN.md) and the store link works from it;
- weeks 1–4 of LAUNCH_PLAN.md produced at least one channel that brings steady installs;
- a full day is free to answer comments (the maker's replies matter more than the listing).

Earliest sensible slot: week 6 of the launch calendar, more likely later. A Tuesday–Thursday start
at 00:01 Pacific gives the full 24 hours; a weekend gives less competition and less traffic.

## 2. Listing

| Field | Text | Notes |
|---|---|---|
| Name | Senuma | |
| Tagline (≤ 60) | Make every new tab your own workspace | 37 characters; benefit first |
| Alternatives | Your sites, search and look on every new tab · A personal workspace on every new tab | pick after the landing headline test |
| Topics | Chrome Extensions · Productivity · Customization | |
| Link | the Chrome Web Store listing with `?utm_source=producthunt` | |
| Pricing | Free | |

**Description (≤ 260 characters):**

> Senuma turns every new tab into your own workspace: sites organized into Spaces, one search bar
> with your shortcuts (“y lofi mix” → YouTube), Modes for work and evenings, and your own photo
> behind it. Free, no Senuma account, no analytics.

## 3. Gallery order

1. `senuma-28s-silent.mp4` (uploaded to YouTube first: Product Hunt takes a link) — the product
   in 29 seconds.
2. screenshot-1-home — Make the browser yours.
3. screenshot-3-search — One search bar. Your rules.
4. gif-2 command center.
5. screenshot-5-modes or gif-5 — A workspace for every mode.
6. screenshot-4-customize — Make every new tab feel like yours.
7. extra-privacy — the real Settings → Privacy page.

Thumbnail: the icon (240×240 from the 128 source redrawn, not upscaled).

## 4. Maker comment (first comment, posted right after the page goes live)

> Hi Product Hunt, I'm [name], the maker of Senuma.
>
> I kept opening the same sites by hand in every new tab, and every “beautiful new tab” I tried
> was either pretty but useless for work, or useful but behind an account and a subscription.
> Senuma is my attempt at both: a workspace that is also yours to look at.
>
> What it does today:
> • Spaces: your sites grouped by what you use them for
> • One search bar with shortcuts (`y lofi mix`, `gh`, `w`…) and your own engines
> • Ctrl+K for everything
> • Modes: one key switches Spaces, look, search engine and dock (Work → Chill)
> • Your own photo as background, with fit, position, dim, blur and atmosphere
>
> What it does not do yet: sync between computers (there is a backup file instead), save open tab
> sessions, or widgets.
>
> It is free. There is no Senuma account and no analytics; your workspace is stored in your
> browser. Searches go to the engine you choose and site icons come from the sites; the Privacy
> page in Settings spells it out.
>
> I would love to hear what would make it your daily new tab, and what is in the way.

(Adjust the first paragraph to the owner's own voice before posting. No request for upvotes.)

## 5. Likely questions and answers

| Question | Answer |
|---|---|
| How is it different from a pretty new tab? | It organizes and searches: Spaces, shortcuts, Ctrl+K, Modes. The look is on top of that. |
| How is it different from a tab manager? | It does not save tab sessions. It keeps the sites you use one click or one shortcut away. |
| Is it open source? | The source is public on GitHub for transparency; it does not carry an open-source licence today. (Owner to confirm the wording; see GITHUB_PRESENCE.md.) |
| What data does it collect? | None. No account, no analytics. Workspace data stays in the browser in this release. Searches go to your chosen engine; icons are requested from sites or, if you choose, Google's icon service. |
| Why does Chrome mention browsing history? | Only if you turn on “recently closed tabs”: Chrome's standard wording for that permission. It is optional and off by default. |
| Sync? | Not in this release. Export/import a JSON file. Encrypted sync is being explored separately; no date. |
| Firefox / Safari? | Chrome today; it also loads in Edge and Brave. No Firefox build yet. |
| Will it stay free? | Everything in it today stays free. Nothing is gated. |
| Languages? | English and Turkish; Spanish and French are next. |
| Who is behind it? | One independent developer. |
| It was New Tab Folders? | Yes: same extension, rebuilt; existing data is kept. |

## 6. Launch-day checklist

- [ ] Owner go-ahead; date chosen; the day is free.
- [ ] Store listing revision live (STORE_CONVERSION.md); video on YouTube.
- [ ] Landing page live; store link tagged `utm_source=producthunt`.
- [ ] Gallery uploaded in the order above; tagline and description pasted; topics set.
- [ ] Maker comment ready in a text file; FAQ answers ready.
- [ ] One post each on X, Threads, Bluesky, LinkedIn: “We're on Product Hunt today” with the link.
      No “please upvote”; Product Hunt discourages asking for votes.
- [ ] Reply to every comment within the hour during the day.
- [ ] Note the day's store page views and installs by UTM source (GROWTH_STRATEGY.md § 6).
- [ ] Next day: thank-you comment, list of what was learned, issues into the feedback board.

## 7. Claims check before posting

Every line must pass MESSAGING_SYSTEM.md “Privacy claims”: no “zero network requests”, no “nothing
leaves your device”, no “zero knowledge”, no “anonymous”, nothing about the name being legally
cleared, no user counts or rankings.

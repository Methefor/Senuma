/**
 * Starter catalog: the categories offered at onboarding, their starter services, and the
 * domain knowledge used to sort imported links deterministically (no AI, no network).
 *
 * Starter sets are deliberately short: widely used services only, a handful per group.
 * More services are offered as suggestions inside a Space (recommendations.ts, loaded only
 * there), one at a time, so nobody gets them all. Anything else a category should recognise
 * goes in `domains`, which sorts imports without putting the service in front of anyone.
 *
 * A group is named by its `key` (`catgroup.<key>` in the dictionaries), so its name follows
 * the language like a catalog Space's name does. An empty key is an untitled group.
 */
import { hostOf } from './url';

export type Service = readonly [title: string, url: string];

export interface CatalogGroup {
    key: string;
    services: readonly Service[];
}

export interface Category {
    id: string;
    glyph: string;
    accent: string;
    groups: readonly CatalogGroup[];
    /** False keeps a category out of onboarding; it still sorts imported links. */
    onboarding?: false;
    /** Extra domains that belong here without being starter services. */
    domains?: readonly string[];
}

export const CATEGORIES: readonly Category[] = [
    {
        id: 'ai',
        glyph: 'spark',
        accent: '#A98BE8',
        groups: [
            { key: 'general', services: [['ChatGPT', 'https://chatgpt.com'], ['Claude', 'https://claude.ai'], ['Gemini', 'https://gemini.google.com']] },
            { key: 'research', services: [['Perplexity', 'https://www.perplexity.ai'], ['NotebookLM', 'https://notebooklm.google.com']] },
            { key: 'creative', services: [['Runway', 'https://runwayml.com'], ['Higgsfield', 'https://higgsfield.ai']] },
            { key: 'developer', services: [['Hugging Face', 'https://huggingface.co'], ['OpenRouter', 'https://openrouter.ai']] },
        ],
        domains: ['openai.com', 'anthropic.com', 'grok.com', 'x.ai', 'midjourney.com', 'chat.deepseek.com', 'deepseek.com', 'mistral.ai', 'elevenlabs.io', 'suno.com', 'replicate.com', 'poe.com', 'copilot.microsoft.com', 'aistudio.google.com', 'firecrawl.dev', 'cursor.com', 'lovable.dev', 'v0.dev', 'bolt.new'],
    },
    {
        id: 'dev',
        glyph: 'code',
        accent: '#62B8D8',
        groups: [
            { key: 'code', services: [['GitHub', 'https://github.com'], ['Stack Overflow', 'https://stackoverflow.com'], ['npm', 'https://www.npmjs.com']] },
            { key: 'deploy', services: [['Vercel', 'https://vercel.com'], ['Cloudflare', 'https://dash.cloudflare.com']] },
            { key: 'data', services: [['Supabase', 'https://supabase.com'], ['Neon', 'https://neon.com']] },
            { key: 'tools', services: [['Docker Hub', 'https://hub.docker.com'], ['Figma', 'https://www.figma.com']] },
        ],
        domains: ['developer.mozilla.org', 'devdocs.io', 'gitlab.com', 'bitbucket.org', 'netlify.com', 'render.com', 'railway.app', 'fly.io', 'heroku.com', 'aws.amazon.com', 'console.cloud.google.com', 'portal.azure.com', 'firebase.google.com', 'codepen.io', 'codesandbox.io', 'replit.com', 'docker.com', 'cloudflare.com', 'pypi.org', 'crates.io', 'developer.chrome.com', 'postman.com', 'sentry.io', 'linear.app', 'localhost', '127.0.0.1'],
    },
    {
        id: 'research',
        glyph: 'book',
        accent: '#5CC2A0',
        groups: [
            { key: 'lookup', services: [['Wikipedia', 'https://www.wikipedia.org'], ['Google Scholar', 'https://scholar.google.com'], ['arXiv', 'https://arxiv.org']] },
            { key: 'read', services: [['Hacker News', 'https://news.ycombinator.com'], ['Medium', 'https://medium.com'], ['Substack', 'https://substack.com']] },
        ],
        domains: ['news.google.com', 'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'semanticscholar.org', 'researchgate.net', 'jstor.org', 'pubmed.ncbi.nlm.nih.gov', 'ssrn.com', 'archive.org', 'zotero.org', 'readwise.io', 'pocket.com', 'instapaper.com'],
    },
    {
        id: 'work',
        glyph: 'briefcase',
        accent: '#7C9CF0',
        groups: [
            { key: 'communication', services: [['Gmail', 'https://mail.google.com'], ['Slack', 'https://app.slack.com'], ['Microsoft Teams', 'https://teams.microsoft.com']] },
            { key: 'planning', services: [['Google Calendar', 'https://calendar.google.com'], ['Notion', 'https://www.notion.so']] },
            { key: 'files', services: [['Google Drive', 'https://drive.google.com'], ['Google Docs', 'https://docs.google.com/document'], ['Google Sheets', 'https://docs.google.com/spreadsheets']] },
            { key: 'creative', services: [['Figma', 'https://www.figma.com'], ['Canva', 'https://www.canva.com']] },
        ],
        domains: ['docs.google.com', 'meet.google.com', 'zoom.us', 'outlook.live.com', 'outlook.office.com', 'office.com', 'slack.com', 'notion.com', 'trello.com', 'asana.com', 'atlassian.net', 'atlassian.com', 'airtable.com', 'clickup.com', 'monday.com', 'dropbox.com', 'calendly.com', 'linkedin.com'],
    },
    {
        id: 'design',
        glyph: 'pen',
        accent: '#D97BA6',
        groups: [
            { key: 'make', services: [['Figma', 'https://www.figma.com'], ['Canva', 'https://www.canva.com'], ['Framer', 'https://www.framer.com']] },
            { key: 'reference', services: [['Dribbble', 'https://dribbble.com'], ['Behance', 'https://www.behance.net'], ['Pinterest', 'https://www.pinterest.com']] },
        ],
        domains: ['adobe.com', 'mobbin.com', 'awwwards.com', 'fonts.google.com', 'coolors.co', 'unsplash.com', 'pexels.com', 'spline.design', 'webflow.com', 'are.na', 'lottiefiles.com'],
    },
    {
        // Watching and listening: "Media" in the interface.
        id: 'entertainment',
        glyph: 'film',
        accent: '#E98B7A',
        groups: [
            { key: 'watch', services: [['YouTube', 'https://www.youtube.com'], ['Netflix', 'https://www.netflix.com'], ['Prime Video', 'https://www.primevideo.com'], ['Disney+', 'https://www.disneyplus.com']] },
            { key: 'listen', services: [['Spotify', 'https://open.spotify.com'], ['YouTube Music', 'https://music.youtube.com']] },
            { key: 'discover', services: [['IMDb', 'https://www.imdb.com'], ['Letterboxd', 'https://letterboxd.com']] },
        ],
        domains: [
            'max.com', 'hbomax.com', 'hulu.com', 'tv.apple.com', 'mubi.com', 'crunchyroll.com', 'blutv.com', 'exxen.com', 'tabii.com', 'justwatch.com', 'rottentomatoes.com', 'themoviedb.org', 'trakt.tv', 'myanimelist.net',
            'spotify.com', 'soundcloud.com', 'music.apple.com', 'bandcamp.com', 'tidal.com', 'deezer.com', 'last.fm', 'genius.com', 'mixcloud.com', 'beatport.com',
        ],
    },
    {
        id: 'gaming',
        glyph: 'gamepad',
        accent: '#62B8D8',
        groups: [
            { key: 'launch', services: [['Steam', 'https://store.steampowered.com'], ['Epic Games', 'https://store.epicgames.com'], ['Xbox', 'https://www.xbox.com']] },
            { key: 'cloud', services: [['GeForce NOW', 'https://play.geforcenow.com']] },
            { key: 'discover', services: [['SteamDB', 'https://steamdb.info'], ['HowLongToBeat', 'https://howlongtobeat.com']] },
            { key: 'watch', services: [['Twitch', 'https://www.twitch.tv']] },
        ],
        domains: ['kick.com', 'steampowered.com', 'steamcommunity.com', 'epicgames.com', 'playstation.com', 'gog.com', 'itch.io', 'nintendo.com', 'ign.com', 'discord.com', 'nexusmods.com', 'protondb.com', 'isthereanydeal.com', 'riotgames.com', 'battle.net'],
    },
    {
        id: 'finance',
        glyph: 'chart',
        accent: '#5CC2A0',
        groups: [
            { key: '', services: [['TradingView', 'https://www.tradingview.com'], ['Yahoo Finance', 'https://finance.yahoo.com'], ['Google Finance', 'https://www.google.com/finance'], ['CoinMarketCap', 'https://coinmarketcap.com']] },
        ],
        domains: ['investing.com', 'bloomberg.com', 'coingecko.com', 'binance.com', 'coinbase.com', 'paypal.com', 'wise.com', 'stripe.com', 'revolut.com', 'morningstar.com', 'seekingalpha.com'],
    },
    {
        id: 'social',
        glyph: 'users',
        accent: '#7C9CF0',
        groups: [
            { key: '', services: [['X', 'https://x.com'], ['Reddit', 'https://www.reddit.com'], ['Instagram', 'https://www.instagram.com'], ['LinkedIn', 'https://www.linkedin.com'], ['WhatsApp', 'https://web.whatsapp.com']] },
        ],
        domains: ['twitter.com', 'facebook.com', 'threads.net', 'threads.com', 'bsky.app', 'tiktok.com', 'mastodon.social', 'telegram.org', 'web.telegram.org', 'messenger.com', 'snapchat.com'],
    },
    {
        id: 'shopping',
        glyph: 'bag',
        accent: '#F4BE8A',
        groups: [
            { key: '', services: [['Amazon', 'https://www.amazon.com'], ['eBay', 'https://www.ebay.com'], ['Etsy', 'https://www.etsy.com']] },
        ],
        domains: ['aliexpress.com', 'amazon.com.tr', 'amazon.co.uk', 'amazon.de', 'trendyol.com', 'hepsiburada.com', 'n11.com', 'sahibinden.com', 'walmart.com', 'ikea.com', 'zalando.com', 'temu.com'],
    },
    {
        id: 'study',
        glyph: 'cap',
        accent: '#E98B7A',
        groups: [
            { key: 'learn', services: [['Coursera', 'https://www.coursera.org'], ['Khan Academy', 'https://www.khanacademy.org'], ['Duolingo', 'https://www.duolingo.com']] },
            { key: 'tools', services: [['Anki', 'https://ankiweb.net'], ['Quizlet', 'https://quizlet.com'], ['Wolfram Alpha', 'https://www.wolframalpha.com']] },
        ],
        domains: ['udemy.com', 'edx.org', 'udacity.com', 'brilliant.org', 'classroom.google.com', 'freecodecamp.org', 'codecademy.com', 'leetcode.com', 'desmos.com', 'overleaf.com'],
    },
];

export function categoryById(id: string): Category | undefined {
    return CATEGORIES.find(c => c.id === id);
}

const DOMAIN_INDEX: Map<string, string> = (() => {
    const index = new Map<string, string>();
    // Extra domains first so a starter service's exact host always wins a conflict. Where two
    // categories list the same service (Figma, Spotify), the more specific, later one wins.
    for (const category of CATEGORIES) for (const d of category.domains ?? []) index.set(d, category.id);
    for (const category of CATEGORIES) {
        for (const group of category.groups) for (const [, url] of group.services) index.set(hostOf(url), category.id);
    }
    // Hosts that are too generic to imply a category on their own.
    index.delete('google.com');
    return index;
})();

/** Category for a URL, matching the most specific known host suffix. Null when unknown. */
export function categorize(url: string): string | null {
    const labels = hostOf(url).toLowerCase().split('.');
    for (let i = 0; i < labels.length; i++) {
        const match = DOMAIN_INDEX.get(labels.slice(i).join('.'));
        if (match) return match;
    }
    return null;
}

/** Starter Modes offered after onboarding. A preset is created when one of `needs` was chosen. */
export const MODE_PRESETS = [
    { key: 'work', glyph: 'briefcase', needs: ['work', 'research', 'study', 'finance'], includes: ['work', 'research', 'ai', 'finance', 'study'] },
    { key: 'dev', glyph: 'code', needs: ['dev'], includes: ['dev', 'ai', 'design', 'research'] },
    { key: 'chill', glyph: 'moon', needs: ['entertainment'], includes: ['entertainment', 'social'] },
    { key: 'gaming', glyph: 'gamepad', needs: ['gaming'], includes: ['gaming', 'entertainment'] },
] as const;

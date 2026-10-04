/**
 * More services per catalog category, offered as suggestions inside a Space and added one at a
 * time by the person. Nothing here is added on its own. Loaded only with the Space view, so the
 * new-tab page does not carry it.
 *
 * Each list continues a category's starter groups (catalog.ts) under the same group keys; a key
 * the category has no starter group for becomes a new group when its first service is added.
 */
import type { CatalogGroup } from './catalog';

export const MORE: Readonly<Record<string, readonly CatalogGroup[]>> = {
    ai: [
        { key: 'general', services: [['Copilot', 'https://copilot.microsoft.com'], ['Grok', 'https://grok.com']] },
    ],
    dev: [
        { key: 'code', services: [['MDN', 'https://developer.mozilla.org']] },
        { key: 'data', services: [['Firebase', 'https://console.firebase.google.com']] },
    ],
    research: [
        { key: 'news', services: [['Google News', 'https://news.google.com'], ['Reuters', 'https://www.reuters.com'], ['AP News', 'https://apnews.com'], ['BBC News', 'https://www.bbc.com/news']] },
        { key: 'read', services: [['Reddit', 'https://www.reddit.com']] },
    ],
    work: [
        { key: 'planning', services: [['Linear', 'https://linear.app'], ['Trello', 'https://trello.com'], ['Asana', 'https://app.asana.com']] },
    ],
    entertainment: [
        { key: 'watch', services: [['HBO Max', 'https://www.hbomax.com']] },
        { key: 'listen', services: [['Apple Music', 'https://music.apple.com'], ['SoundCloud', 'https://soundcloud.com']] },
    ],
    gaming: [
        { key: 'launch', services: [['PlayStation', 'https://www.playstation.com']] },
        { key: 'watch', services: [['Kick', 'https://kick.com'], ['YouTube Gaming', 'https://www.youtube.com/gaming']] },
        { key: 'community', services: [['Discord', 'https://discord.com/app']] },
    ],
    finance: [
        { key: '', services: [['Investing.com', 'https://www.investing.com'], ['Binance', 'https://www.binance.com']] },
    ],
    social: [
        {
            key: '',
            services: [
                ['TikTok', 'https://www.tiktok.com'], ['Threads', 'https://www.threads.com'], ['Discord', 'https://discord.com/app'], ['Bluesky', 'https://bsky.app'],
                ['Snapchat', 'https://www.snapchat.com'], ['Pinterest', 'https://www.pinterest.com'], ['Telegram', 'https://web.telegram.org'], ['Facebook', 'https://www.facebook.com'],
            ],
        },
    ],
    shopping: [
        { key: '', services: [['Trendyol', 'https://www.trendyol.com'], ['Hepsiburada', 'https://www.hepsiburada.com'], ['AliExpress', 'https://www.aliexpress.com']] },
    ],
};

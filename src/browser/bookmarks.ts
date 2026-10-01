import type { LooseLink } from '../core/types';
import { requestPermissions } from './permissions';
import { fail, ok, type BrowserResult } from './result';

/** Asks for bookmark access (from a click) and reads every bookmark with its folder name. */
export async function readBookmarks(): Promise<BrowserResult<LooseLink[]>> {
    const granted = await requestPermissions(['bookmarks']);
    if (!granted.ok) return granted;
    try {
        const links: LooseLink[] = [];
        const walk = (nodes: chrome.bookmarks.BookmarkTreeNode[], folder: string) => {
            for (const node of nodes) {
                if (node.url) links.push({ title: node.title, url: node.url, folder });
                if (node.children) walk(node.children, node.title || folder);
            }
        };
        walk(await chrome.bookmarks.getTree(), '');
        return ok(links);
    } catch (error) {
        return fail('failed', error);
    }
}

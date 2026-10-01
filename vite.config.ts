import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import { buildManifest } from './src/manifest';

const ICON_DIR = 'assets/icons';
/** Set by `npm run build:e2e`; see src/manifest.ts. */
const E2E_BUILD = process.env.BOS_E2E === '1';

/** Emits the extension manifest (generated from brand constants), icons and service worker. */
function extensionFiles(): Plugin {
    return {
        name: 'extension-files',
        apply: 'build',
        generateBundle() {
            this.emitFile({
                type: 'asset',
                fileName: 'manifest.json',
                source: JSON.stringify(buildManifest({ grantOptional: E2E_BUILD }), null, 2),
            });
            for (const file of readdirSync(ICON_DIR)) {
                if (!file.endsWith('.png')) continue;
                this.emitFile({ type: 'asset', fileName: `icons/${file}`, source: readFileSync(`${ICON_DIR}/${file}`) });
            }
            this.emitFile({ type: 'asset', fileName: 'background.js', source: readFileSync('src/background.js') });
        },
    };
}

export default defineConfig({
    base: '',
    plugins: [extensionFiles()],
    build: {
        outDir: E2E_BUILD ? 'dist-e2e' : 'dist',
        target: 'chrome120',
        modulePreload: { polyfill: false },
        rollupOptions: { input: { newtab: 'newtab.html' } },
    },
    test: { environment: 'node', include: ['src/**/*.test.ts'] },
});

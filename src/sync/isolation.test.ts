/**
 * The emulator and rules-testing packages are tools. Nothing of Firebase may reach the extension:
 * not as a runtime dependency, and not as an import from any file the product is built from.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
});

describe('Firebase stays out of the extension', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { dependencies?: Record<string, string>; devDependencies: Record<string, string> };

    it('is not a runtime dependency; the tools are development dependencies with exact versions', () => {
        expect(Object.keys(pkg.dependencies ?? {}).filter(name => /firebase/i.test(name))).toEqual([]);
        for (const name of ['firebase-tools', '@firebase/rules-unit-testing', 'firebase']) expect(pkg.devDependencies[name], name).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('is imported by no source file, test files included', () => {
        const offenders = walk('src').filter(path => /\.(ts|tsx|js)$/.test(path) && /from ['"](@?firebase|firebase-tools)[/'"]/.test(readFileSync(path, 'utf8')));
        expect(offenders).toEqual([]);
    });

    it('the product imports the sync core nowhere except the limits it shares', () => {
        const product = walk('src').filter(path => /\.(ts|tsx)$/.test(path) && !/\.test\./.test(path) && !path.replace(/\\/g, '/').startsWith('src/sync/'));
        const importers = product.filter(path => /from ['"][./]+\/sync\//.test(readFileSync(path, 'utf8'))).map(path => path.replace(/\\/g, '/'));
        // The device-local store is the one bridge, and nothing in the running product imports it yet.
        expect(importers).toEqual(['src/storage/deviceLocal.ts']);
        expect(product.filter(path => /deviceLocal['"]/.test(readFileSync(path, 'utf8')))).toEqual([]);
    });
});

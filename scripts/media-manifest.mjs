import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const roots = ['assets/store', 'assets/gifs', 'assets/video'];
const allowed = /\.(png|gif|webm|mp4)$/i;
const files = roots.flatMap(root => {
    if (!existsSync(root)) return [];
    return readdirSync(root)
        .map(name => join(root, name))
        .filter(path => statSync(path).isFile() && allowed.test(path));
}).sort((a, b) => a.localeCompare(b));

if (!files.length) {
    console.error('No generated media found. Run npm run store:assets and npm run demo:assets first.');
    process.exit(1);
}

const manifest = {
    generatedBy: ['npm run store:assets', 'npm run demo:assets', 'npm run demo:gif'],
    status: 'local draft, not published',
    files: files.map(path => ({
        path: relative('.', path).replace(/\\/g, '/'),
        bytes: statSync(path).size,
        sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    })),
};

writeFileSync('assets/media-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`assets/media-manifest.json: ${manifest.files.length} files recorded`);

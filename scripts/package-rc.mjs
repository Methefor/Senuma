// Inspects dist/ as a release package and, if it is clean, writes a local RC zip.
// Nothing is uploaded or published; the zip stays in release/ (git-ignored).
//
//   npm run package
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = 'dist';
const walk = dir => readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
});
const files = walk(DIST).map(path => ({ path: relative(DIST, path).replace(/\\/g, '/'), bytes: statSync(path).size, full: path }));
const text = files.filter(f => /\.(js|css|html|json|svg)$/.test(f.path)).map(f => ({ ...f, content: readFileSync(f.full, 'utf8') }));
const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'));

const problems = [];
const check = (label, bad) => {
    const found = bad.filter(Boolean);
    console.log(`${found.length ? 'FAIL ' : 'ok   '} ${label}${found.length ? `: ${found.slice(0, 5).join(', ')}` : ''}`);
    if (found.length) problems.push(label);
};

check('no source maps', [...files.filter(f => f.path.endsWith('.map')).map(f => f.path), ...text.filter(f => /sourceMappingURL=/.test(f.content)).map(f => f.path)]);
check('no tests, fixtures or screenshots', files.filter(f => /\.test\.|fixture|e2e|screenshot|\.png$/.test(f.path) && !f.path.startsWith('icons/')).map(f => f.path));
check('no dev configuration', files.filter(f => /(^|\/)(\.env|tsconfig|vite\.config|package(-lock)?\.json|eslint)/.test(f.path)).map(f => f.path));
check('no local file paths', text.filter(f => /[A-Za-z]:\\\\?(Users|projects)|\/Users\/|\/home\/\w+\//.test(f.content)).map(f => f.path));
check('no secrets or keys', text.filter(f => /(api[_-]?key|secret|password|BEGIN (RSA |EC )?PRIVATE KEY|sk_live|AKIA[0-9A-Z]{16})/i.test(f.content.replace(/passwords?\b(?=[^"']{0,40}(manager|field))/gi, ''))).map(f => f.path));
check('no debug logging', text.filter(f => f.path.endsWith('.js') && /console\.(log|debug|trace)\(|debugger;/.test(f.content)).map(f => f.path));
check('no remote code (scripts, eval, inline handlers)', text.filter(f => /<script[^>]+src=["']https?:|\beval\(|new Function\(|\son\w+=["']/.test(f.content)).map(f => f.path));
// The bundle contains the UI library's own support for raw HTML; what matters is that our code never uses it.
const source = walk('src').filter(path => /\.(ts|tsx|js)$/.test(path) && !/\.test\./.test(path));
check('no unsafe HTML sinks in our source', source.filter(path => /\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|document\.write\(|dangerouslySetInnerHTML|\beval\(|new Function\(/.test(readFileSync(path, 'utf8'))));
check('manifest key not shipped', [manifest.key ? 'manifest.key' : '']);
check('manifest: MV3, strict CSP, no host permissions', [
    manifest.manifest_version !== 3 && 'manifest_version',
    !/script-src 'self'/.test(manifest.content_security_policy?.extension_pages ?? '') && 'CSP',
    /unsafe-(inline|eval)|https?:/.test(manifest.content_security_policy?.extension_pages ?? '') && 'CSP allows remote or inline',
    (manifest.host_permissions?.length ?? 0) > 0 && 'host_permissions',
    manifest.content_scripts && 'content_scripts',
    manifest.externally_connectable && 'externally_connectable',
    manifest.web_accessible_resources && 'web_accessible_resources',
]);
check('manifest: permissions are exactly storage + search; optional bookmarks, tabs, sessions', [
    JSON.stringify(manifest.permissions) !== '["storage","search"]' && `permissions ${manifest.permissions}`,
    JSON.stringify(manifest.optional_permissions) !== '["bookmarks","tabs","sessions"]' && `optional ${manifest.optional_permissions}`,
]);
const referenced = new Set(text.flatMap(f => [...f.content.matchAll(/(?:wallpapers|marks|assets|icons)\/[\w.-]+/g)].map(m => m[0])));
const html = text.find(f => f.path === 'newtab.html')?.content ?? '';
const lazy = text.filter(f => f.path.endsWith('.js')).map(f => f.content).join('\n');
check('no unused bundled files', files.filter(f => {
    if (['manifest.json', 'newtab.html', 'background.js'].includes(f.path)) return false;
    if (f.path.startsWith('marks/') || f.path.startsWith('wallpapers/')) return !lazy.includes(f.path.replace(/^(marks|wallpapers)\//, '').replace(/(\.thumb)?\.(svg|webp)$/, ''));
    const base = f.path.split('/').pop();
    return !referenced.has(f.path) && !html.includes(base) && !lazy.includes(base) && !JSON.stringify(manifest).includes(f.path);
}).map(f => f.path));

const kb = bytes => `${(bytes / 1024).toFixed(1)} kB`;
const sum = filter => files.filter(filter).reduce((total, f) => total + f.bytes, 0);
const gz = filter => files.filter(filter).reduce((total, f) => total + gzipSync(readFileSync(f.full)).length, 0);
const js = f => f.path.endsWith('.js');
console.log(`
manifest version   ${manifest.version}
display version    ${manifest.version_name}
name               ${manifest.name}
permissions        ${manifest.permissions.join(', ')}
optional           ${manifest.optional_permissions.join(', ')}
files              ${files.length}
JavaScript         ${kb(sum(js))} (${kb(gz(js))} gzip) in ${files.filter(js).length} files; startup file ${kb(gz(f => /^assets\/newtab-.*\.js$/.test(f.path)))} gzip
CSS                ${kb(sum(f => f.path.endsWith('.css')))} (${kb(gz(f => f.path.endsWith('.css')))} gzip)
photographs        ${kb(sum(f => f.path.startsWith('wallpapers/')))} (${files.filter(f => f.path.startsWith('wallpapers/')).length} files)
brand marks        ${kb(sum(f => f.path.startsWith('marks/')))} (${files.filter(f => f.path.startsWith('marks/')).length} files)
icons              ${kb(sum(f => f.path.startsWith('icons/')))}
unpacked total     ${kb(sum(() => true))}`);

if (problems.length) {
    console.error(`\nNot packaged: ${problems.length} check(s) failed.`);
    process.exit(1);
}
mkdirSync('release', { recursive: true });
// A release build (display version = manifest version) is named by its version alone.
const label = manifest.version_name === manifest.version ? manifest.version : `${String(manifest.version_name).replace(/\s+/g, '-')}-${manifest.version}`;
// Named by the short name: the full name carries a dash and spaces.
const zip = resolve('release', `${manifest.short_name}-${label}.zip`);
rmSync(zip, { force: true });
// Every file gets the source commit's time, so the same commit always gives a byte-identical zip.
const stamp = new Date(Number(execFileSync('git', ['log', '-1', '--format=%ct'], { encoding: 'utf8' }).trim()) * 1000);
for (const path of [...walk(DIST), ...readdirSync(DIST, { recursive: true }).map(name => join(DIST, name)).filter(path => statSync(path).isDirectory())]) utimesSync(path, stamp, stamp);
// tar also records each file's creation time, which Node cannot set on Windows.
execFileSync('powershell', ['-NoProfile', '-Command', `$t = [DateTime]::Parse('${stamp.toISOString()}'); Get-ChildItem -LiteralPath '${resolve(DIST)}' -Recurse -Force | ForEach-Object { $_.CreationTime = $t }`]);
// Windows' bundled bsdtar writes a standard zip with forward-slash paths (Compress-Archive writes backslashes).
execFileSync(join(process.env.SystemRoot ?? 'C:/Windows', 'System32/tar.exe'), ['-a', '-c', '-f', zip, '-C', resolve(DIST), ...readdirSync(DIST)]);
const listed = execFileSync(join(process.env.SystemRoot ?? 'C:/Windows', 'System32/tar.exe'), ['-t', '-f', zip], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
if (listed.some(name => name.includes('\\')) || !listed.includes('manifest.json')) { console.error('Not packaged: zip paths are wrong.'); process.exit(1); }
console.log(`package            ${relative('.', zip)}  ${kb(statSync(zip).size)}${existsSync(zip) ? '' : ' (missing!)'}\n\nLocal file only. Nothing was uploaded.`);

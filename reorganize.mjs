import fs from 'node:fs';
import cp from 'node:child_process';
import path from 'node:path';
const write=(p,s)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,s+'\n');};
const edit=(p,a,b)=>write(p,fs.readFileSync(p,'utf8').replaceAll(a,b));
const items=['index.html','manifest.json','js','css','assets','landing.html','pricing.html','guide.html','changelog.html'];
write('docs/REPOSITORY_AUDIT.md',`# Repository audit — 2026-10-02

Baseline: local New Tab Folders repository. Senuma RC2 already exists in src/.
Original checkout has an uncommitted manifest version change from 1.0.0 to 1.55; preserved separately, never overwritten.
Synced project brain describes Mutlukent, so it is not authoritative for Senuma.

## Archive plan (implemented after this inventory)
- Root 1.x HTML, js/, css/, assets/ and manifest → archive/legacy/repository-1.x/. This is a repository snapshot, NOT published 1.80.
- Naming experiments and obsolete brand direction → archive/research/. Keep SENUMA_BRAND and fallback clearance active as decision records.
- Published 1.80 folder and ZIP remain at release/legacy/. Copy byte-for-byte from original checkout; retain hashes in archive/legacy/provenance.json.
- RC2 ZIP remains a local release artifact; never publish or overwrite it.
- Runtime src/, storage identifiers, database name, extension identity and backup import formats stay unchanged.
- Keep colocated unit tests and e2e paths; tests/ documents the suite rather than causing unnecessary import churn.

## Release artifacts
Published legacy: NewTabFolders-1.80-published.zip; current candidate: Senuma-2.0.0-RC-2-1.99.20.zip.
Neither implies a final 2.0.0 release. Real cloud import and human QA remain release gates.

## Rollback
Use the pre-reorganization Git parent for source rollback. Archived 1.x remains intact. No browser profile, cloud data or production setting was changed.
`);
cp.execFileSync('git',['add','docs/REPOSITORY_AUDIT.md']);cp.execFileSync('git',['commit','-m','docs: audit Senuma repository and plan non-destructive archive']);
for(const p of items){fs.mkdirSync(path.dirname('archive/legacy/repository-1.x/'+p),{recursive:true});cp.execFileSync('git',['mv',p,'archive/legacy/repository-1.x/'+p]);}
for(const name of ['BRAND_DIRECTION.md','BRAND_NAMING_FINAL_LAB.md','BRAND_NAMING_ROUND2.md','BRAND_NAMING_ROUND3.md','BRAND_NAMING_ROUND4.md']){fs.mkdirSync('archive/research',{recursive:true});cp.execFileSync('git',['mv','docs/'+name,'archive/research/'+name]);}
fs.copyFileSync('C:/projects/New Tab Folders/manifest.json','archive/legacy/original-working-manifest.json');
fs.cpSync('C:/projects/New Tab Folders/release','release',{recursive:true});
const entries=['index.html', 'js', 'css', 'assets/icons', 'changelog.html', 'guide.html'];
for(const p of ['e2e/rehearsal.ts','e2e/headed-update.ts']){
 edit(p,'cpSync(entry, join(',"cpSync(join('archive/legacy/repository-1.x', entry), join(");
 edit(p,"readFileSync('manifest.json', 'utf8')","readFileSync('archive/legacy/repository-1.x/manifest.json', 'utf8')");
 edit(p,"? 'manifest.json' : join(DIST", "? 'archive/legacy/repository-1.x/manifest.json' : join(DIST");
}
edit('e2e/store-assets.ts',"resolve('drafts/store')","resolve('assets/store')");
edit('e2e/store-assets.ts','drafts/store/','assets/store/');
edit('eslint.config.js',"'js/**'","'archive/**'");
edit('docs/ARCHITECTURE.md','`index.html` (repo root)','`archive/legacy/repository-1.x/index.html`');
edit('docs/ARCHITECTURE.md','`js/`, `css/`, root `*.html`','`archive/legacy/repository-1.x/`');
edit('docs/ARCHITECTURE.md','`manifest.json` (repo root)','`archive/legacy/repository-1.x/manifest.json`');
write('README.md',`# Senuma

Your personal place on the web. A local-first New Tab Workspace with Spaces, Modes, search, Command Center and personalization.

Status: **2.0.0 RC2, local only**. Public rename and final release remain on hold; see [release status](docs/RELEASE_STATUS.md).

## Develop and verify
Run npm ci, then npm run dev. Load dist/ after npm run build; never load this repository root.

- npm run check — types, lint, unit tests, build and size budgets.
- npm run test:e2e — real Chromium extension regression.
- npm run test:rc — release candidate regression.
- npm run rehearse — published 1.80 migration and rollback.
- npm run store:assets — eight screenshots, hero, tile and icon, local only.
- npm run package — inspected local RC package; never uploads.

## Repository map
- src/: active product, runtime assets, colocated unit tests.
- assets/: brand delivery references, store captures, screenshots, GIF and video demos.
- docs/: product, brand, architecture, compatibility, privacy and release procedures.
- tests/: suite map and regression requirements; e2e/: browser test implementations.
- scripts/: deterministic asset and local release tooling.
- archive/legacy/: retired repository 1.x and provenance; archive/research/: superseded naming research.
- release/: ignored local packages and published 1.80 fixture; dist/: generated unpacked extension.
- drafts/site/: local website draft.

[Audit](docs/REPOSITORY_AUDIT.md) · [Brand](docs/BRAND.md) · [Motion](docs/MOTION.md) · [Release](docs/RELEASE.md) · [Migration](docs/LEGACY_MIGRATION.md)

Storage keys and IndexedDB names retain their historic spelling. This reorganization does not change the Chrome Web Store item or extension ID.
`);
write('docs/BRAND.md',`# Senuma brand system

Decision authority: SENUMA_BRAND.md. Product name: Senuma; lowercase wordmark: senuma. Descriptor: New Tab Workspace. Tagline: Make the browser yours.
Ground is the selected mark. Canonical files live in src/assets/brand/; 16/32/48/128 PNGs are generated by npm run icons. Do not duplicate runtime masters.

Ink #14172A; warm tile gradient #F8D4AB → #EDA571. UI uses the existing theme tokens, never a parallel marketing palette in runtime components.
System font stack; wordmark weight 600, tracking -0.02em. Minimum clear space: one quarter of icon width. Keep proportions and contrast; no glow, stretching or new symbol variants.
Brand appears in onboarding, About, toolbar and store; keep Home personal and uncluttered.

Store masters: assets/store/. Real screenshots only; artificial demo data, no private links. Eight feature captures, 1400×560 hero, 440×280 tile. All remain local drafts.
Public naming clearance is unresolved in the existing decision record. No new legal, domain or handle claim is made here.
`);
write('docs/MOTION.md',`# Motion guidelines

Source of truth: src/styles/base.css and existing reduced-motion behavior.

| Use | Duration at scale 1 |
|---|---|
| Hover, press, toggle | 120 ms |
| Menus, toast, state | 200 ms |
| Space/panel entry | 280 ms |
| Mode/theme/wallpaper | 480 ms |

Ease out: cubic-bezier(.2,.7,.2,1); ease in/out: cubic-bezier(.6,0,.3,1). Theme motion scale applies throughout. Prefer opacity and transform; preserve focus and avoid layout jumps.
Honor prefers-reduced-motion. Never add essential information only in animation, autoplay sound, strobe or perpetual decorative movement.

Demo capture: 1280×800, synthetic state, clear pointer pauses. Show Space open, mode switch, command search and personalization. Short loop 8–12 seconds; tour 20–30 seconds. Export muted WebM master and GIF derivative; do not invent interface behavior or speed up loading claims.
`);
write('docs/PRODUCT.md',`# Product

Senuma is the next version of New Tab Folders on the same store item. Spaces, Modes, universal search, Command Center, Continue, dock and personalization are the current product scope.
RC2 is local-first, with no new accounts, backend, subscription or ongoing sync. Legacy cloud import is a separate one-time read-only migration path.
See ARCHITECTURE.md, PRIVACY_FACTS.md and LEGACY_MIGRATION.md for verified implementation details.
`);
write('docs/RELEASE.md',`# Local release procedure

1. npm run check
2. npm run test:e2e and npm run test:rc
3. npm run rehearse with the saved published 1.80 fixture. Verify real ID oghlifenjhpbebcdeboejbmemelkfobe; repository 1.x fallback does not prove published compatibility.
4. Complete MANUAL_QA.md and real authenticated legacy cloud check before public release.
5. npm run store:assets; inspect every capture; generate and review demos.
6. npm run package creates an RC ZIP locally. Keep a hash and validation report; do not overwrite a previous candidate.

Only dist/ is packaged. Source, archive, media, fixtures and docs stay out. Version, storage keys, database name, permissions and backup compatibility gates remain active.
No upload, domain, social account, payment or production action is part of this procedure. Final 2.0.0 and public release require the owner's separate approval.
`);
write('tests/README.md',`# Test suite map

Unit tests remain beside source (src/**/*.test.ts). Browser regressions remain in e2e/ to preserve harness paths.

Required gates: npm run check, npm run test:e2e, npm run test:rc, npm run rehearse.
Data safety covers bos.state, bos.snapshots, bos.state.newer, ntf_data and legacy backup formats. Preserve bos-assets IndexedDB and real store identity.
Saved published fixture: release/legacy/NewTabFolders-1.80-published/. Retired repository fixture: archive/legacy/repository-1.x/; never confuse these builds.
Real cloud and human QA results must be recorded separately from simulated migration tests.
`);
for(const folder of ['brand','screenshots','gifs','video'])write('assets/'+folder+'/README.md',`# ${folder}

Local Senuma delivery assets. Canonical brand sources: src/assets/brand/. Store capture generator: e2e/store-assets.ts → assets/store/. Screenshot masters and raw captures stay there to avoid duplicates.
GIF and video outputs must show the built product with synthetic data; follow docs/MOTION.md. Generated files are local review artifacts, never automatically uploaded.
`);
write('archive/legacy/README.md',`# Legacy archive

repository-1.x is the retired tracked source, not the published 1.80 build. original-working-manifest.json preserves the original checkout's uncommitted 1.55 version edit.
Published 1.80 remains under release/legacy/ because migration tooling consumes that exact fixture. No archive file is part of the active package.
`);
fs.appendFileSync('.gitignore','\n# Local generated Senuma media\nassets/store/\nassets/gifs/*.gif\nassets/video/*.webm\nassets/video/*.mp4\n');
cp.execFileSync('git',['add','.']);cp.execFileSync('git',['commit','-m','refactor: isolate legacy product and organize Senuma assets and docs']);

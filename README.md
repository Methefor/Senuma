# Senuma

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


<div align="center">

# Senuma

**Make the browser yours.**

A calm, personal New Tab Workspace for organizing the web around the way you work.

[Product](docs/PRODUCT.md) · [Brand](docs/BRAND.md) · [Architecture](docs/ARCHITECTURE.md) · [Release status](docs/RELEASE_STATUS.md)

</div>

![Senuma — Make the browser yours](docs/media/readme/senuma-hero.png)

## Your web, arranged around you

Senuma turns every new tab into a focused workspace. Group sites into Spaces, move between purpose-built Modes, search the web and your workspace from one place, and shape the interface around your own rhythm.

- **Spaces** keep projects, tools and routines together.
- **Search** reaches the web or your saved destinations without breaking focus.
- **Command Center** makes keyboard-first navigation fast and predictable.
- **Personalization** brings themes, photography and layout controls into one coherent system.
- **Local-first foundations** preserve the historic storage model while encrypted sync is developed and tested.

## See Senuma in motion

<div align="center">
  <img src="docs/media/readme/senuma-product-tour.gif" alt="Animated Senuma product tour showing Spaces, search and personalization" width="800">
</div>

<p align="center"><sub>Real Senuma interface with synthetic demonstration data.</sub></p>

## Designed for the way you move through the web

<table>
  <tr>
    <td width="50%">
      <img src="docs/media/readme/spaces.png" alt="A Senuma Space containing organized shortcuts">
      <br><strong>Spaces</strong><br>
      Keep the tools for each part of your day in a dedicated place.
    </td>
    <td width="50%">
      <img src="docs/media/readme/search.png" alt="Senuma unified search interface">
      <br><strong>Unified search</strong><br>
      Search the web or your Spaces from the same focused surface.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="docs/media/readme/command-center.png" alt="Senuma keyboard command center">
      <br><strong>Command Center</strong><br>
      Navigate and act quickly without leaving the keyboard.
    </td>
    <td width="50%">
      <img src="docs/media/readme/personalization.png" alt="Senuma personalization panel">
      <br><strong>Personal by design</strong><br>
      Choose themes, photography and interface details that feel like yours.
    </td>
  </tr>
</table>

## Current development status

The active line is **2.1.0 dev 1** and is intended for local development. Senuma 2.0 is packaged locally but has not been uploaded. The 2.1 encrypted sync work currently targets the local emulator with mock sign-in. See the [release status](docs/RELEASE_STATUS.md) and [sync design](docs/CLOUD_SYNC_DESIGN.md) for the exact readiness state.

Historic storage keys, IndexedDB names and migration paths intentionally retain their original spelling. The repository reorganization does not change the Chrome Web Store item or extension identity.

## Develop locally

```bash
npm ci
npm run dev
```

For an unpacked extension build, run `npm run build` and load the generated `dist/` directory in Chrome. Do not load the repository root.

### Verification

```bash
npm run check
npm run test:e2e
npm run test:rc
```

Additional suites cover Firestore rules, mutation detection, encrypted sync against the local emulator, and the published 1.80 migration rehearsal. The complete commands and release gates are documented in [Release](docs/RELEASE.md) and [Manual QA](docs/MANUAL_QA.md).

## Repository map

| Path | Purpose |
| --- | --- |
| `src/` | Active extension product, runtime assets and colocated unit tests |
| `docs/` | Product, brand, architecture, compatibility, privacy and release documentation |
| `docs/media/readme/` | Versioned media used by this README |
| `assets/` | Brand delivery references and locally generated store/demo assets |
| `tests/` and `e2e/` | Regression requirements and browser-level test implementations |
| `scripts/` | Deterministic asset, verification and local release tooling |
| `archive/legacy/` | Preserved 1.x material and provenance; never used as active product source |
| `release/` and `dist/` | Ignored local packages, migration fixtures and generated builds |

## Product principles

- **Personal by default:** the workspace adapts to the person using it.
- **Calm and fast:** common actions stay close, clear and responsive.
- **Private by design:** data handling is explicit and compatibility is treated as a release gate.
- **Built to last:** migrations, rollback evidence and generated artefacts remain reproducible.

Read the [repository audit](docs/REPOSITORY_AUDIT.md), [brand system](docs/BRAND.md), [motion guidelines](docs/MOTION.md), [privacy facts](docs/PRIVACY_FACTS.md) and [legacy migration plan](docs/LEGACY_MIGRATION.md).

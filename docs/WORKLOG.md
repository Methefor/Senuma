# Worklog — 2026-10-02

## Chrome Web Store submission — 2026-10-03

Senuma 2.0.0 was uploaded to the existing item `oghlifenjhpbebcdeboejbmemelkfobe`. The first review submission was cancelled after a privacy-declaration audit found that Chrome's **Web history** wording covers recently closed page entries handled by the optional `tabs` and `sessions` feature. The corrected submission ticks Web history and keeps every other data category unticked. Permission explanations state that Recently Closed / Continue reads entries live for the visible feature and that Senuma does not store or transmit the list. The listing, five screenshots, tile, hero, GitHub URLs, privacy policy, free distribution, and existing regions remain saved. The corrected update was resubmitted and the dashboard confirmed **Pending review**. Automatic publishing remains disabled; the live 1.8.0 version is unchanged.

## Integration update — 2026-10-03

The professional repository commits were reapplied on top of `senuma-2.1` as `chore/senuma-professional-repository`; the 2.1 sync engine, rules, REST transport and mock sign-in work were retained. The only cherry-pick conflicts were `.gitignore` and the release package name. Both 2.1 Firebase ignore entries and generated-media entries were preserved. Package naming now retains the 2.1 final/pre-release label and adds a content fingerprint while refusing overwrite.

The former uncommitted root `manifest.json` version change was committed separately on `preserve/legacy-manifest-1.55`. Current product, status, release and backlog documents were updated for 2.1. Validation results for this integrated branch are recorded below when completed.

### Validation on the integrated 2.1 branch

- `npm run check`: typecheck, lint, 292 unit tests, build and all bundle budgets passed after the final merge. Phase 4 contributed eight Google Auth tests. One expensive icon-policy property test initially exceeded Vitest's generic five-second limit by 49 ms before Phase 4 was merged; the final merged test retains Phase 4's explicit 30-second timeout and passes.
- `npm run test:e2e`: second clean run passed 65/65. The first run had one transient failure while opening a second tab immediately after a Mode change; cross-tab propagation and restart persistence passed in that same run.
- `npm run test:rc`: 33/33 passed.
- `npm run rehearse`: 16/16 passed using the saved published 1.80 fixture and real extension ID `oghlifenjhpbebcdeboejbmemelkfobe`.
- `npm run test:rules`: 99/99 passed against the local Firestore emulator, including 28 engine and 71 rules tests. The installed Adoptium JDK 21 was added only to the test process PATH.
- `npm run test:rules:mutations`: 27/27 intentional rule weakenings were caught.
- `npm run test:sync:e2e`: 20/20 passed with mock sign-in and the local emulator.
- `npm run package`: all package inspections passed; local package `Senuma-2.1.0-dev-1-2.0.90-f4099db04068.zip` created. Nothing was uploaded.
- Store assets and demo media were regenerated from the 2.1 build. The current set contains eight screenshots, hero, tile, icon, one canonical WebM and one 76-frame GIF; 14 files are recorded in `assets/media-manifest.json`.
- Repository integration: `senuma-2.1` received the professional structure through merge commit `96091c3`. Phase 4 and the repository branch had independently recorded the same Phase 3 documentation, so a real merge was required. The only merge conflict was `.gitignore`; local project identifiers, Firebase emulator output and generated-media rules were all retained. Commit `531b973` removed the duplicated timeout argument created by combining two independent flaky-test fixes. Both local branches now point to that commit.

### Remaining gates

Manual product QA, real production-service decisions, naming clearance and macOS/Linux coverage remain open. The local-emulator sync result does not imply a production backend exists or is approved.

## Completed
Audited current and ignored release artifacts; recorded plan before archive commit. Archived tracked legacy files without discarding content. Preserved original uncommitted manifest separately. Updated two migration fixture consumers. Added Senuma brand, product, motion and release guidance; test suite map; store/screenshots/GIF/video structure. Runtime src/ is byte-identical to baseline.
Generated eight real 1280×800 store screenshots, 1400×560 hero, 440×280 tile, 128 icon, synthetic product WebM tours and 76-frame 800×500 GIF. Reviewed screenshot contact sheet. Media inventory and SHA256 records: assets/media-manifest.json. Published 1.80 fixture: 26 hashes verified.

## Verification
- npm run check: typecheck, lint, 104 unit tests, build, all size budgets passed.
- npm run test:e2e: 65 passed, 0 failed.
- npm run test:rc: 33 passed, 0 failed.
- npm run rehearse: 16 passed, 0 failed; saved published 1.80, real ID oghlifenjhpbebcdeboejbmemelkfobe. Cloud endpoints are stand-ins; no real authenticated cloud check claimed.
- npm run package: all package checks passed; release/Senuma-2.0.0-RC-2-1.99.20-f54ebe2fa6c4.zip generated. Second invocation rejected overwrite as intended.
- npm run demo:assets: Space, Command Center, Customize and Mode switch recorded successfully in isolated Chromium.
- npm run lint after final script changes: passed.
Windows sandbox blocked Vite ancestor reads on first attempt; authorized local checks passed outside that restriction.

## Open / risks
Human QA, real cloud import and macOS/Linux remain open. Existing Senuma naming clearance hold remains. Store assets require owner review before public use. Current RC multi-tab timing passed; previously documented intermittent behavior is not declared solved.
The original repo checkout remains on its existing branch with its manifest edit intact. The prepared branch is imported locally; active reorganized checkout lives in the project mirror's senuma/ folder. Generated binaries and packages are ignored; scripts and hashes are committed.

## Next step
Review assets and perform human QA, then integrate the prepared branch into the original working folder while preserving its local manifest edit. No production, publish, domain, social or payment action occurred.

# Test suite map

Unit tests remain beside source (src/**/*.test.ts). Browser regressions remain in e2e/ to preserve harness paths.

Required gates: npm run check, npm run test:e2e, npm run test:rc, npm run rehearse.
Data safety covers bos.state, bos.snapshots, bos.state.newer, ntf_data and legacy backup formats. Preserve bos-assets IndexedDB and real store identity.
Saved published fixture: release/legacy/NewTabFolders-1.80-published/. Retired repository fixture: archive/legacy/repository-1.x/; never confuse these builds.
Real cloud and human QA results must be recorded separately from simulated migration tests.


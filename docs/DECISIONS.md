# Decisions

2026-10-02: isolate retired 1.x under archive/legacy, preserve published 1.80 release fixture unchanged, retain existing src/e2e layout and runtime brand masters. Generated store and demo media stay local and reproducible. Package names include a content fingerprint and reject overwrite.

2026-10-03: apply the professional repository structure on top of `senuma-2.1`, preserving the complete 2.1 sync implementation. Preserve the former uncommitted legacy manifest change on `preserve/legacy-manifest-1.55` instead of mixing it into the active product tree.

# Repository audit — 2026-10-02

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


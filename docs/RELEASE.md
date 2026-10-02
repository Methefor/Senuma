# Local release procedure

1. npm run check
2. npm run test:e2e and npm run test:rc
3. npm run rehearse with the saved published 1.80 fixture. Verify real ID oghlifenjhpbebcdeboejbmemelkfobe; repository 1.x fallback does not prove published compatibility.
4. Complete MANUAL_QA.md and real authenticated legacy cloud check before public release.
5. npm run store:assets; inspect every capture; generate and review demos.
6. npm run package creates an RC ZIP locally. Keep a hash and validation report; do not overwrite a previous candidate.

Only dist/ is packaged. Source, archive, media, fixtures and docs stay out. Version, storage keys, database name, permissions and backup compatibility gates remain active.
No upload, domain, social account, payment or production action is part of this procedure. Final 2.0.0 and public release require the owner's separate approval.


# Local release procedure

1. Run `npm run check`, `npm run test:e2e` and `npm run test:rc`.
2. For 2.1, run `npm run test:rules`, `npm run test:rules:mutations` and `npm run test:sync:e2e` against the local emulator.
3. Run `npm run rehearse` with the saved published 1.80 fixture. Verify real ID `oghlifenjhpbebcdeboejbmemelkfobe`; the archived repository snapshot does not prove published compatibility.
4. Complete MANUAL_QA.md and every release-specific manual gate before public release.
5. Run `npm run store:assets`, `npm run demo:assets`, `npm run demo:gif` and `npm run media:manifest`; inspect every capture and demo.
6. Run `npm run package`. The ZIP name includes a content fingerprint and the script refuses to overwrite an identical existing package.

Only dist/ is packaged. Source, archive, media, fixtures and docs stay out. Version, storage keys, database name, permissions and backup compatibility gates remain active.
No upload, domain, social account, payment or production action is part of this procedure. A production sync backend and any public release require the owner's separate approval.


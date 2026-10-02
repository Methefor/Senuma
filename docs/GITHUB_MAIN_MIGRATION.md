# GitHub main migration — 2026-10-03

The public GitHub `main` branch remained on the legacy New Tab Folders v1.6 line while Senuma was developed on local branches.

The last legacy GitHub commit is `185446d` (`privacy: add weather widget location disclosure`). Its six commits after the shared ancestor `977537e` remain part of Git history through the Senuma integration merge. The merge intentionally keeps the verified Senuma tree as the active repository; it does not mix the retired v1.6 runtime into Senuma.

Published New Tab Folders 1.80 is a separate artifact and remains under `release/legacy/NewTabFolders-1.80-published/` for migration rehearsals. The tracked legacy repository snapshot remains under `archive/legacy/repository-1.x/`.

No force-push is required: after the integration merge, legacy GitHub `main` is an ancestor of the new Senuma `main`. Rollback and comparison remain possible with ordinary Git history.

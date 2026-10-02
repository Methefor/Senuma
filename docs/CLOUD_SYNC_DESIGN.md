# Senuma cloud sync — design (for Senuma 2.1)

Status: **design approved; PHASE 1 COMPLETE (2026-10-03); PHASE 2 COMPLETE; PHASE 3 COMPLETE
against the local emulator with mock sign-in (section 13); nothing connected to a real service.** No backend
exists, no Firebase project was created or changed, nothing was published. Work is on the local
branch `senuma-2.1`; the Senuma 2.0 branch (`rebuild/browser-os`) and its package are unchanged. Decided 2026-10-02: the 1.80 Firebase system is not a
Senuma requirement; Senuma's sync is designed from first principles.

Items marked **[verify]** are facts to confirm in a prototype before they are relied on.

## 0. Decisions (approved by the owner, 2026-10-02)

| # | Decision |
|---|---|
| D1 | Sync ships in **2.1**, not 2.0. |
| D2 | The legacy cloud import is **removed** from 2.0 (done). |
| D3 | A **new Firebase project**; `newtabfolders` is not reused. |
| D4 | The recovery key **may be shown again** on a device that is already syncing, after explicit confirmation. |
| D5 | Firestore in an **EU multi-region**. |

Constraints added with the approval: plaintext metadata in Firestore kept to the minimum; no
human-readable device names in plaintext; payload growth validated against the 512 kB limit and
a chunking strategy documented before implementation (section 5); local-first and offline at
all times; no analytics; no payments; no production Firebase changes yet.

## 1. Proposed architecture

```
 New tab page ──edits──▶ chrome.storage.local  (bos.state: the source of truth, as today)
                                 │ change event
                                 ▼
                    Sync engine (service worker, loaded on demand)
        project syncable part → 3-way merge → compress → AES-GCM encrypt (WebCrypto)
                                 │ HTTPS, REST
                                 ▼
          Firebase Auth (who you are)      Firestore (opaque ciphertext + counters)
```

- **Local first.** The page reads and writes local state exactly as it does now. Sync is a
  second writer that only ever applies a merged result through the existing “replace setup”
  path, which saves a restore point first. With sync off, signed out, paused or offline, no
  code path changes.
- **No account needed, no login wall.** The sync code is not loaded until someone opens
  Account & Sync and chooses to sign in.
- **Firebase is transport and identity only.** It stores ciphertext it cannot read and enforces
  ownership, ordering, size and rate. It runs no code of ours (no Cloud Functions → no billing).
- **No Firebase SDK.** Auth and Firestore are called through their REST APIs, as the 1.x code
  and the RC 2 import already do. Reasons: bundle budget (the SDK is larger than the whole
  startup bundle), no remote code, and no host permissions (the endpoints accept cross-origin
  requests from an extension page — already verified for the token and Firestore endpoints;
  the sign-in endpoint **[verify]**).
- **No live listeners.** Sync runs: after a local change (debounced), when a new tab opens (at
  most once every few minutes), and on “Sync now”. No `alarms` permission.
- **Sign-in:** `chrome.identity.launchWebAuthFlow` with Google OpenID Connect (scope
  `openid email` only, nonce-bound ID token), exchanged for a Firebase session at the Identity
  Toolkit REST endpoint. This is the Manifest V3 pattern that works in Chrome and in other
  Chromium browsers; `getAuthToken` is Chrome-only and Firebase's popup sign-in cannot run in an
  MV3 extension page. `identity` is requested as an **optional** permission at the moment the
  person presses “Continue with Google”, so installing or updating Senuma asks for nothing new.

## 2. Threat model

| Adversary | Can | Cannot |
|---|---|---|
| Google/Firebase as operator; the developer with console access; a leaked database dump | See: account e-mail and id, sign-in times, IP addresses (Google), number of devices, document sizes, write times, revision counter, schema version. Delete or withhold data. Replay an old encrypted version. | Read Spaces, links, names, Modes, settings or device labels. Forge content (authenticated encryption). A replay is detected by devices that already saw a newer revision. |
| Someone who takes over the Google account | Sign in, download ciphertext, delete it, overwrite it with garbage | Decrypt without the recovery key. Garbage is rejected by devices; local data is unaffected. |
| Network attacker | Nothing beyond TLS metadata | — |
| Someone with the unlocked browser profile, or malware in it | Everything: local state is plaintext, as today. Sync does not change this. | — |
| Another extension or a website | Nothing (extension storage isolation) | — |
| A removed device | Keep its copy of what it already had. Until a hard reset (3.6) it still holds a valid session. | Read anything encrypted after a key rotation. |
| Abusive client using the public API key | Sign in with its own Google account and fill its own vault up to the rule limits; exhaust the free daily quota (availability only) | Touch anyone else's vault |
| **A malicious or compromised Senuma update** (developer, build machine, store account) | **Read everything**, by shipping code that exfiltrates keys or plaintext | — |

The last row is the honest boundary of any end-to-end encryption delivered inside an
auto-updating extension: the encryption protects against the server and whoever holds the
database, not against the code that performs it. Copy must not claim more than that.

## 3. Encryption model

### 3.1 Keys
- **Workspace key (WK):** random AES-256-GCM key generated on the first device, by WebCrypto.
  Stored on each device as a *non-extractable* `CryptoKey` in IndexedDB.
- **Recovery key:** 160 random bits shown as 8 groups of 4 letters/digits plus a check group.
  Random, not chosen by the person, so no slow password hashing is needed and no weak
  passphrases exist.
- **Wrapping:** KEK = HKDF-SHA-256(recovery key, per-key random salt, context string incl. uid).
  WK is wrapped with the KEK (AES-GCM) and the wrapped blob is stored in Firestore. A wrong
  recovery key fails authentication, so it is detected without storing any verifier.
- The server holds: wrapped WK, salt. It never receives the recovery key or the WK. **Neither
  Firebase nor the developer can reconstruct plaintext from what is stored.** (Subject to the
  last row of the threat model.)

### 3.2 Payload
`plaintext = gzip(JSON(syncable state))` → AES-256-GCM, fresh random 96-bit nonce per write.
Additional authenticated data binds each ciphertext to `uid | document path | keyId |
revision`, so the server cannot move a blob between accounts, documents or revisions, or present
an old copy as a newer one. The schema version, the writing device's id and its clock live
inside the ciphertext.

Still visible: sizes (padded to 1 kB steps), timing, revision count.

### 3.3 Lifecycle
| Event | Behaviour |
|---|---|
| Turn sync on, first device | Generate WK and recovery key. Show the recovery key once with copy / save as file / print, and require confirmation (re-enter the check group) **before** anything is uploaded. |
| New device | Sign in → wrapped key found → ask for the recovery key → unwrap → store non-extractable. Then first-sync choice (4.4). |
| Show recovery key again (D4, approved) | The recovery key is kept in local extension storage on synced devices and can be shown again **after an explicit confirmation step** (“Anyone who sees this key and can sign in to your Google account can read your synced data. Show it?”). That device already holds the plaintext, so this adds no exposure that matters, and lost keys are the main way people lose access. |
| Sign out | Delete session tokens, WK and stored recovery key from this device; remove its device entry. **Local Spaces, links and settings are not touched.** Cloud copy stays. |
| Pause | Stops network activity. Keys and session stay. |
| Lost recovery key, a synced device still exists | Nothing is lost: that device shows the key (D4) or rotates to a new one. |
| Lost recovery key, no synced device | The cloud copy cannot be decrypted by anyone, ever. Offer: delete cloud data and start sync again from this device's local data. Local data on any device is unaffected. This must be said plainly at setup. |
| Rotation (on request, or after removing a device) | New WK + new recovery key; re-encrypt current document and history in one atomic commit; other devices move to “enter new recovery key”. Rotation protects *future* data; it cannot un-share what a removed device already had. |
| Encrypted backup file | Phase 6. Export gets an optional “protect with a password”: PBKDF2-SHA-256 (≥600 000 iterations, WebCrypto has no Argon2) → AES-GCM. Independent of account and sync. A password is weaker than the random recovery key; say so. Plain export stays available. |

### 3.4 Not in v1
Approving a new device from an existing one (key sent encrypted to the new device's public
key). It needs a comparison code on both screens to stop the server swapping keys; without
that it would be fake. Later phase.

### 3.5 What is and is not synced
| Synced (encrypted) | Local only |
|---|---|
| Spaces, groups, links (title, address, icon choice) | Links opened from the page (“Continue”) and command-centre ranking |
| Modes, dock | Recently closed pages, current tabs (never stored at all) |
| Search providers and shortcuts | Anything typed in search |
| Theme, background choice, dim/blur, layout preferences, language | Restore points, the 1.x record, onboarding state, which Mode is active |
| | Per-device switches: recently closed pages on/off (permission-bound), icon-service choice (changes what the browser requests), motion |
| | Session tokens, keys, device id |

Implemented in `src/sync/scope.ts` as an explicit classification of every `AppState` and `Prefs`
field; adding a field without classifying it is a compile error.

A background that is an uploaded picture syncs **only as a reference** (a random asset id): no
pixels, preview, file name or size.

**A reference to a picture this device does not have is a valid state** (`src/sync/wallpaper.ts`):

| Situation | What the device does |
|---|---|
| Picture is here | Applied and shown like any background. |
| Picture is not here | The reference is *held* in the device-local record (below), exactly as received, and is what this device reports as the synced value. The setup itself gets the theme's backdrop, so rendering and validation never see a reference they cannot follow (the 2.0 validator needs no change). `assetMissingLocally` is exposed for the interface; nothing is blocked. |
| Nothing else changed | The device has nothing to send. It cannot overwrite the device that has the picture, however often they sync. |
| The person picks a background here | By default it is this device's own (`deviceChoice`); the synced reference is untouched. “Use on all devices” makes it an ordinary synced change. |
| The person changes it on a device that has the picture | An ordinary synced change; other devices follow, and any device choice made for the old picture ends. |
| The picture arrives later | The device starts using it and the flag clears. A device choice made meanwhile stays until the person goes back to the synced background. |
| Merge between a device with and one without the picture | Both report the same reference: no change, no conflict. |

The same holds for a Mode's own background.

**Device-local storage.** Both records live under their own storage key, `bos.device`, beside
the setup and never inside it (`src/storage/deviceLocal.ts`):

```
deviceLocal.heldSyncedBackgrounds   place → the synced background this device cannot show
deviceLocal.backgroundOverrides     place → the background chosen on this device meanwhile
```

(`place` is `default` or `mode:<id>`.) Tested: it survives a restart; it is validated on
load (a held entry keeps its reference although the picture is absent; an override must be
showable here and exists only beside a held entry); it appears in no synced copy, backup file or
restore point; it creates no conflict; a background change made on another device supersedes
both records. There is no backend for it: it is one key in the browser's local storage.

**Interface copy (for phase 5; factual):**
- Missing, no choice made: “The background chosen on another device is a picture that is not on
  this device. This device is showing the theme's backdrop instead. Nothing was changed on your
  other devices.”
- Missing, choice made here: “This device is using its own background. Your other devices keep
  theirs.” · actions: “Use on all devices”, “Go back to the synced background”.
- Picture present again, choice made here: “This device is using its own background.” · action:
  “Use the synced background”.

**Custom wallpapers: not synced in v1.** Images are megabytes; a Firestore document holds 1 MiB;
Cloud Storage for Firebase needs a billing account on new projects **[verify]**. Other devices
show the theme background and a note. Later options: chunked encrypted blobs in Firestore
(quota-heavy) or Storage once billing is acceptable.

### 3.6 Removing a device
Without server code, one device's session cannot be revoked individually. Two levels:
- **Remove device (soft):** delete its entry and rotate the key. A cooperative device signs
  itself out when it finds its entry gone. A hostile one keeps a session that can read only
  ciphertext it cannot decrypt and write garbage that others reject.
- **Sign out everywhere (hard):** delete cloud data and the Firebase account, sign in again
  (new account id, all old sessions dead), new key, upload from this device. Other devices
  sign in again with the new recovery key.

## 4. Sync engine

### 4.1 Identifiers
- `deviceId`: 128 random bits made on the device; not derived from hardware.
- `schemaVersion`: the `AppState` schema of the plaintext. `format`: envelope version.
- `revision`: integer, +1 per accepted write, enforced by rules.
- Timestamps: server time on the document; client time inside the ciphertext. **Display only.**
  Nothing is decided by comparing clocks.

### 4.2 Each device keeps
`base` (the syncable state as of the last successful sync), `baseRevision`, a `dirty` flag.

### 4.3 Cycle
1. Read `current`. If `revision < baseRevision` → error “cloud copy went backwards” (stop, ask).
2. If remote = base and not dirty → synced.
3. If remote = base and dirty → encrypt local, write with precondition “document unchanged
   since I read it” + rule `revision == previous + 1`. Lost race → back to 1.
4. If remote ≠ base → decrypt, **3-way merge** (base, local, remote) by stable ids:
   - changes to different things, or identical changes → merged automatically;
   - same thing changed differently, edited on one side and deleted on the other, both sides
     reordered the same list → **conflict**.
5. No conflict: save a restore point, apply merged state locally, push it.
6. Conflict: change nothing; state “conflict”. The person sees each item with both versions and
   chooses per item, or “keep this device”, “keep cloud”, “keep both” (the other copy becomes an
   extra Space). Restore point first, then apply and push.

Deletions need no tombstones: something in `base` and missing on one side was deleted there.

### 4.4 First sync on a device that already has data
No base exists, so nothing is assumed: the person chooses **merge** (the existing idempotent
merge: nothing lost, duplicates by address skipped), **use cloud**, or **use this device** — the
dialog RC 2 already has for imports. Restore point first in every case.

### 4.5 Safety rules
- Never overwrite local or remote state that is newer than the base without a merge or a choice.
- Remote schema newer than this build: sync pauses with “update Senuma to sync”; never downgrade.
- Decryption failure: nothing is applied; error state.
- Cloud history: the last 5 revisions stay as encrypted documents; “Restore” lists local restore
  points and these.

## 5. Firestore schema (new project, nothing shared with legacy)

```
vaults/{uid}/keys/{keyId}          v, salt (16 bytes), wrapped (60 bytes: nonce + wrapped key)
vaults/{uid}/workspace/current     format, keyId, revision, updatedAt (server time), nonce (bytes), payload (bytes)
vaults/{uid}/history/{revision}    a verbatim copy of what `current` was at that revision; last 5 kept, pruned by the client
vaults/{uid}/devices/{deviceId}    keyId, nonce (bytes), payload (bytes)
```

### 5.1 What is readable on the server — the whole list

| Field | Why the server needs it |
|---|---|
| `uid` (path) | Ownership rule. Assigned by Firebase Auth. |
| `keyId`, `deviceId` | Random ids made on the device (80 and 128 random bits). `keyId` lets a device find the right wrapped key before it can decrypt anything. Nothing about the person or machine is in them. |
| `format` | Envelope version, so a client knows whether it can parse the document at all. |
| `revision` | Ordering rule: accepted only as previous + 1. |
| `updatedAt` | Server time, for the write-rate rule. Shown to the person; decides nothing. |
| `nonce`, `payload`, `salt`, `wrapped` | Random bytes and ciphertext. |
| document sizes | Unavoidable; padded to 1 kB steps. |

Moved **inside the ciphertext** compared with the first draft: schema version, writing device
id, device clock, and everything about a device (its name, when it was added, when it last
synced, its last revision). The server therefore cannot refuse a schema downgrade; clients do
(a copy written by a newer Senuma is neither applied nor overwritten). There is no device name,
e-mail address, user agent, app version or content-derived value in Firestore. The e-mail
address exists only in Firebase Auth.

No custom indexes: every read is by path; history is listed by document id.

### 5.2 Payload growth (measured, `src/sync/budget.test.ts`)

Encrypted size of the whole workspace document (gzip, padded, AES-GCM), with the icon limits of
5.2.1 in force:

| Workspace | Encrypted size | Share of 512 kB |
|---|---|---|
| 1 000 links, no embedded icons | 46 kB | 9 % |
| 10 000 links, no embedded icons | 444 kB | 87 % |
| 15 000 links, no embedded icons | 665 kB | **over — refused whole** |
| 300 links, 1 in 10 with its own 3 kB icon (realistic) | 76 kB | 15 % |
| 1 000 links, 1 in 10 with its own 3 kB icon (realistic) | 150 kB | 29 % |
| 300 links, every one with a 2 kB icon | 115 kB | 22 % (was 475 kB) |
| 100 links, every one with an 8 kB icon | 104 kB | 20 % (was refused) |
| 200 links, every one with a 32 KB icon — the worst icons can do | 110 kB | 21 % |
| 5 000 links and a full allowance of icons | 329 kB | 64 % |
| 10 000 links and a full allowance of icons | 548 kB | **over — refused whole** |

- Ordinary links cost about **45 bytes each**. Without embedded icons the limit is reached near
  11 500 links; with a full icon allowance, near 9 300.
- The 512 kB limit is a hard refusal: the document is **never truncated**; local data is
  unaffected; the engine reports “near the limit” from 75 %.
- Sealing 10 000 links takes about 0.1 s.
- Free-tier budget (20 000 writes, 50 000 reads per day): a sync writes about 3 documents
  (current, history, device); pushes are debounced and rule-limited; reads are throttled.

#### 5.2.1 Embedded icon limits (`src/sync/icons.ts`, `iconEncode.ts`)

A link's icon may be an image embedded as a `data:` URL; such data barely compresses.

| Rule | Value |
|---|---|
| One embedded icon | at most **32 KB** as stored |
| All embedded icons in a workspace | at most **128 KB** together (≈ 97 kB encrypted, a fifth of the document limit) |
| An emoji or image address | at most 2 048 characters |
| Over a limit, picture can be decoded | Re-encoded: longest edge 128 px (icons are shown at 64 px at most), WebP; smaller sizes only if needed. Measured in a real browser engine: a 1.8 MB picture → 3.1 kB, mean difference at icon size under 1 of 255. |
| Still over, or cannot be decoded | The icon is removed and the link shows its site's own icon, like any link without a stored icon |
| Never | An icon is never cut short. It is kept whole, replaced by a complete smaller image, or removed. |
| Who keeps their icon when the total is exceeded | Older links first, so adding a link never takes an icon from an earlier one |

**Both limits are final (owner, 2026-10-03): 32 KB per icon, 128 KB together.** Embedded icons
are an enhancement, not core workspace data; the site's own icon carries most links. In the
realistic 1 000-link case above, 92 links had their own 3 kB icon and 43 kept it.

**Where the policy runs in 2.1** (policy: `src/core/iconPolicy.ts`; re-encoder:
`src/browser/iconEncode.ts`; page-side helpers: `src/app/icons.ts`):

| Path | What happens |
|---|---|
| Add link, edit link (the editor) | `prepareIcon` in the page: fits → kept; over → re-encoded; cannot fit → saved without a stored icon and the person is told |
| Any other code that adds or edits a link | `ops.addItem` / `updateItem` refuse an icon over the limits (add: link saved without it; edit: the old icon stays) |
| Import of a backup or a 1.x export | Read with oversized icons left in place, then `settleSetup` re-encodes in the page before anything is offered; the result is reported |
| Merging an import into the current setup | Goes through `addItem`, so the 128 KB total holds across both |
| Stored state on every load, other tabs' saves, restore points | `sanitize` enforces the limits (drops what is over) |
| First load of a setup saved before the limits | One-time pass in `loadState`: re-encode in the page, report in a notice. Every text value it replaces or leaves out is first written, exactly as it was, to a record of originals (`bos.limits.originals`); **if that write fails the changed setup is not saved**, so the stored original is never the only copy lost. Settings → Data shows the record with counts and offers it as a file. It needs no marker: a setup within the limits is left alone |
| Merging an import, icons | When the 128 KB total is reached, incoming links are still added and show their site's icon; the notice gives the exact number |
| Preparing the synced copy | `toSyncable` applies `capIcons` to whatever it is given |

Pictures are decoded and re-encoded **only in a page**, never in the service worker; no
permission and no offscreen document were added for it. Where no page is involved the rule is
the plain one: over the limit is not stored.

#### 5.2.2 Text and address limits (`src/core/limits.ts`)

| Value | Limit |
|---|---|
| Link title | 256 characters |
| Address (and a search provider's address template) | 4 096 characters |
| Space, group and Mode names | 128 characters |
| Small labels: a Space's note, a search provider's name | 128 characters |

- An address over the limit is **refused whole**; it is never shortened into a different
  address. Typing: the field stops at the limit. Import and stored data: that link is skipped
  and counted.
- A title or name over the limit is **not kept in part**. Typing: the field stops at the limit;
  an edit that still arrives over the limit is refused and the old value stays. Import and
  stored data: the default takes its place (the site's name for a link, “Untitled” for a Space,
  an untitled section for a group, “Mode”) and it is counted.
- The only change ever made to text that is kept is trimming whitespace at its ends.
- Everything counted is shown to the person in one notice (links left out, titles replaced,
  names replaced, icons made smaller, icons replaced by the site's icon).
- On upgrade the replaced text itself is kept (the record above). On import it is not copied,
  because the imported file still holds it. Original *pictures* of icons are not kept: a
  re-encoded icon is the same picture, smaller, and a dropped one is counted.

### 5.3 Chunking strategy (documented now, built only if needed)

Not needed for 2.1 at the sizes above; format 1 stays a single document. If real workspaces
approach the limit, format 2 is:

1. Encrypt exactly as now — **one** ciphertext, one nonce, one authentication tag over the
   whole workspace. Chunking is storage layout, not cryptography; no chunk is separately
   decryptable or separately forgeable.
2. Cut the ciphertext into slices of at most 512 kB: `vaults/{uid}/workspace/chunks/{revision}-{n}`,
   each holding only `bytes`.
3. `workspace/current` becomes a manifest: `format: 2, keyId, revision, updatedAt, nonce,
   chunks: n, bytes: total`. The authenticated context gains `chunks` and `bytes`, so slices
   cannot be dropped, reordered or mixed across revisions without the whole failing to open.
4. Slices and manifest are written in **one atomic commit**, manifest precondition as today
   (revision + 1). The same commit deletes the previous revision's slices. A reader therefore
   never sees a half-written revision. **[verify]** request-size ceiling of one commit
   (documented as about 10 MiB), which bounds format 2 at roughly 16 slices ≈ 8 MB.
5. Rules: slices are create/delete-only, owner-only, size-checked, and their id must carry the
   manifest's next revision.
6. History keeps manifests only; older slices are deleted with their revision (history of large
   workspaces is then shorter — stated in the UI).
7. Format 1 clients see `format: 2` and stop with “update Senuma to sync” (already implemented
   in the revision model as `format-newer`).

Chunking is the future escape hatch, not the first solution (owner decision). The first
solution is the icon limits of 5.2.1 and the warning at 75 %.

## 6. Security Rules (phase 2)

Files: `firebase/firestore.rules`, `firebase/firebase.json` (emulator only),
`firebase/rules.test.ts`, shared cases in `src/sync/writeMatrix.ts`. **Nothing is deployed; no
project exists.**

### 6.1 What the rules do

Nothing is allowed unless a rule allows it. `owner` means: signed in, the account id equals the
`{uid}` in the path, and the sign-in was through Google.

| Path | get | list | create | update | delete |
|---|---|---|---|---|---|
| `vaults/{uid}/workspace/current` | owner | never | owner; exact six fields; `updatedAt` = server time; revision **1** | owner; exact six fields; `updatedAt` = server time; revision = stored **+ 1**; more than 2 s after the stored `updatedAt` | owner |
| `vaults/{uid}/history/{revision}` | owner | owner, at most 20 per query | owner; data **equal to the current workspace document** as it is on the server; id = that document's revision | never | owner |
| `vaults/{uid}/keys/{keyId}` | owner | owner, at most 20 | owner; exactly `v` = 1, `salt` 16 bytes, `wrapped` 60 bytes; id is a random-looking token | never | owner |
| `vaults/{uid}/devices/{deviceId}` | owner | owner, at most 50 | owner; exactly `keyId`, `nonce` 12 bytes, `payload` ciphertext up to 4 KiB; id is a 26-character token | same as create | owner |
| anything else, including `vaults/{uid}` itself and any other document under `workspace` | never | never | never | never | never |

The six workspace fields, as the rules check them: `format` is the integer 1; `keyId` matches
`^[a-z0-9]{8,40}$`; `revision` is an integer ≥ 1; `updatedAt` is a timestamp; `nonce` is 12
bytes; `payload` is bytes, at least 1 040 and at most 524 288, and a whole number of 1 KiB
blocks plus the 16-byte tag (what format 1 produces; plaintext-sized or odd-sized data is
refused). No other field is accepted, so nothing readable can be stored beside the ciphertext.

History is stricter than the first draft: an entry can only be a verbatim copy of the document
that is on the server at that moment, under its own revision number, and can never be changed.
A client therefore cannot invent or alter history. (A history entry keeps the encryption
context of `workspace/current` at its revision, since it is the same bytes.)

### 6.2 Delete semantics

- The owner may delete any document of their own vault; nobody else may delete anything.
- “Delete cloud data” = delete history, the workspace document, device entries and keys,
  client-side, then read back that each path is empty. There is no server-side cascade.
- After the workspace document is deleted it can be created again **only at revision 1**. The
  server keeps no memory of the old counter. Devices that had synced a higher revision see the
  copy missing, or a lower revision, and stop (phase 1: `missing`, `went-backwards`) rather than
  adopt it. This is deliberate: deletion is a reset the other devices must be told about, not
  something to continue across silently.
- Deleting keys makes existing ciphertext undecryptable for any device that does not already
  hold the key. The client deletes keys last.

### 6.3 What the rules cannot do (not to be claimed)

| Not enforceable in rules | Consequence | Where it is handled instead |
|---|---|---|
| Whether `payload` is real ciphertext, made with the right key, for this account and revision | The owner (or someone with their session) can store well-shaped garbage | Devices reject it: authenticated encryption bound to account, path, key id and revision (phase 1 tests) |
| Copying ciphertext into the copier's **own** vault | Allowed: it is their vault | Useless there: it does not decrypt under another account's context |
| Schema version, device identity, device clock | Not visible to the server at all | Inside the ciphertext; clients refuse a newer schema |
| Continuity of `revision` across delete and re-create | Counter restarts at 1 | Clients stop on `missing` / `went-backwards` |
| Rate limiting beyond “2 s after the stored write” | No limit on the first write, on delete-and-recreate loops, on reads, on key or device documents, or across accounts | Client throttling; free-tier quota is the ceiling. Abuse costs availability, not confidentiality |
| Number of documents (keys, devices) and total storage per account | An account can create many small key or device documents | Sizes are capped per document; no count limit is possible in rules |
| Which device is writing; revoking one device | Any session of the account has full access to its vault | Key rotation and the account reset of 3.6 |
| That history is pruned to 5 | A client may leave more | Client prunes; each entry is at most one workspace document |
| Atomic “delete everything” | Deletion is several client writes | Read-back verification; safe to repeat |
| Server time on documents the rules do not stamp | Key and device documents carry no time | By design: no readable timestamps about devices |

Also outside the rules: Firebase Auth itself (who may create an account), API-key restrictions
and App Check. Those are console settings for the real project, not part of this phase.

### 6.4 The reference validator and the real rules

`writeAllowed` (`src/sync/revision.ts`) restates the workspace write rule as a pure function.
Both are run against the same 42 rows (`src/sync/writeMatrix.ts`), and agree on every one: the reference in the unit
tests, the rules in the emulator tests. Where they necessarily differ:

| | Reference validator | Firestore rules |
|---|---|---|
| Time | a number of milliseconds passed in | `request.time`; the client must send the server-timestamp transform |
| Bytes | `Uint8Array` | Firestore `bytes` |
| Integers | `Number.isSafeInteger` | `is int` (a double such as 6.0 is refused) |
| Ownership, sign-in provider, path | not expressible | checked |
| History, keys, devices, lists, deletes | not covered | checked |
| Authority | a client-side pre-check and a specification | the only thing that actually enforces anything |

### 6.5 Emulator test matrix (`firebase/rules.test.ts`, 71 tests)

| Area | Tests | Covers |
|---|---|---|
| Authorization | 8 | owner read; owner write; stranger read and list denied; stranger write denied; signed-out read denied; signed-out write and delete denied; non-Google sign-in denied; undeclared paths denied for everyone |
| Workspace shape (shared matrix) | 32 | valid first and next document; largest payload; unknown field; schema or device field beside the ciphertext; each required field missing; wrong types; newer format; readable or short key id; client-chosen time; nonce too short, too long, or text; ciphertext as text, empty, tag-only, too small, mis-sized, over the limit; client-chosen or non-time `updatedAt` on a first document |
| Workspace revision (shared matrix) | 8 | first write not at 1; same revision; skipped; far ahead; rollback by one and to 1; zero; negative |
| Workspace rate (shared matrix) | 2 | too soon refused; later accepted |
| Workspace, other | 3 | stored with server time and only six fields; key id may change (rotation); largest payload stored whole |
| Over REST, as the extension will write | 4 | plain commits with the server-time transform accepted; a revision or format sent as a floating-point number refused even when its value is right; no transform, a client timestamp, a stranger, nobody: refused; a failed precondition stops a second device writing “the next” revision |
| Revision across deletion | 2 | re-create only at revision 1; a second “first” write over an existing document refused |
| Identity and ownership | 3 | account/path mismatch in both directions; ciphertext cannot be copied into another account's vault or history; naming an account in the data grants nothing |
| History | 4 | verbatim copy accepted; copy plus next revision as one atomic write; invented, altered, misnumbered or rewritten history refused; list size bounded |
| Keys | 1 (7 refusals) | write-once; exact fields and sizes; readable id refused |
| Devices | 1 (7 refusals) | only key id and ciphertext; readable name, last-seen time, user agent, oversize, wrong shape refused |
| Deletion | 3 | owner deletes everything and it is gone; nobody else deletes anything; one vault's deletion leaves another's untouched |

Commands:

```
npm run emulator       # firebase emulators:start --only firestore --project demo-senuma --config firebase/firebase.json
npm run test:rules     # firebase emulators:exec … "vitest run --config firebase/vitest.config.ts"
```

Local only: the project id is `demo-senuma` (a `demo-` project has no real resources and the
tools make no calls for it), the emulator listens on 127.0.0.1:8085, and the test file refuses
to start unless the emulator address is local. The first run downloads the emulator itself (a
JAR, from Google's public download host) — a tool download, not a call to any project.

**Status: run, all green (2026-10-03).**

| | |
|---|---|
| Java | OpenJDK 21.0.12.1 (Eclipse Temurin 21.0.12.1+1 LTS), installed for development only |
| Tools | firebase-tools 15.32.1, Firestore emulator 1.22.0, @firebase/rules-unit-testing 5.0.2, firebase 12.19.0 |
| Result | 71 of 71 tests pass |
| Time | tests 9.9 s; whole command, including emulator start and stop, 18.7 s |
| Rules changes needed after the first real run | none: the file parsed and behaved as written |

**Do the tests have teeth?** `node scripts/rules-mutations.mjs` (with `npm run emulator` running)
weakens one rule at a time — 27 weakenings, from “any signed-in account may act as owner” to
“history may be rewritten” — and expects the suite to fail each time. First run: 24 of 27
caught. The three misses were gaps in the tests, not in the rules (a tag-only payload, a
client-chosen time on a *first* document, and numbers sent as floating-point, which the SDK
cannot produce); rows and REST-level tests were added for them. Now 27 of 27 are caught.

Still true after a green run: the emulator is Google's local implementation of the rules
engine, not production. Behaviour that only exists in production (quota, real token
verification, propagation delay after a deploy) is not exercised.

## 7. Account & Sync (Settings)

| State | Shown | Actions |
|---|---|---|
| Signed out | What sync does, what is uploaded, what is not | Continue with Google |
| Connecting | Progress; “enter your recovery key” on a new device; recovery-key setup on the first | Cancel |
| Synced | Account e-mail, “Up to date · last synced <time>”, device list | Sync now, Pause, Restore, Sign out |
| Syncing | Progress | — |
| Offline | “Changes are saved on this device and will sync when you are back online” | Sync now |
| Paused | “Sync is paused on this device” | Resume |
| Conflict | Count, then each item side by side | Per-item choice; keep this device; keep cloud; keep both |
| Error | Plain cause: sign-in expired · update Senuma · daily limit reached · cloud copy unreadable · cloud copy went backwards | Sign in again / Retry / Restore |

Also: devices (encrypted label, last sync, “this device”; rename; remove) · recovery key
(show, new key) · sign out everywhere · delete cloud data · delete account.

**Signing out never deletes local data**, and the dialog says so. Every destructive action names
exactly what is removed and where.

## 8. Privacy

**Draft UI copy** (factual; to be used only once the implementation matches it):

- *Signed out:* “Senuma works without an account. Everything is stored on this device.”
- *What sign-in is for:* “Google sign-in is used only to know which encrypted copy is yours.
  Senuma receives your e-mail address from Google and nothing else from your Google account.”
- *What is uploaded:* “Your Spaces, links, Modes, dock, search shortcuts and appearance settings,
  encrypted on this device before they are sent.”
- *What stays here:* “Pages you opened, recently closed pages, what you search for, and images
  you added as wallpapers are not uploaded.”
- *Encryption:* “Your data is encrypted with a key that is created on your device. The service
  that stores it cannot read it, and neither can we. Without your recovery key, nobody can
  restore the cloud copy — including us.”
- *Not hidden:* “We can see your e-mail address, when your devices sync and how large the
  encrypted copy is.”
- *Deletion:* “Delete cloud data removes the encrypted copy and your devices list from the
  service. Your data on this device stays.”
- *Analytics:* “Senuma has no analytics.”

Not to be used: “zero-knowledge”, “nobody can ever access”, “military-grade”, “anonymous”.

**Consequences once sync ships (not for 2.0):** store declarations gain *Personally identifiable
information* (e-mail) and *Authentication information*; the privacy policy names Google/Firebase
as processor, the region, retention and the deletion paths; `identity` appears as an optional
permission with its justification. Until then Senuma 2.0 stays “no account, nothing leaves the
device”.

## 9. The old Firebase system

| Step | When | Needs approval |
|---|---|---|
| Stop all work on legacy cloud migration; the live-Firebase gate is withdrawn | now | done |
| Old project and its data: untouched, treated as deprecated | now | — |
| Remove the legacy cloud import from Senuma 2.0 (D2): `legacyCloud.ts`, the Settings row, the notice line, its strings, the rehearsal's cloud step, `cloud-live.ts`; privacy documents back to “no network access to any developer service”; untick *Authentication information* | before the final 2.0 build | **yes (D2)** |
| `ntf_auth` on devices: left as inert data, never read | 2.0 | — |
| After 2.0 has replaced 1.80 for all installs: set the old project's rules to deny everything, disable its sign-in providers | later | **yes — production change** |
| Delete the old project; close the LemonSqueezy store | later | **yes — irreversible** |

Senuma sync never reads, links to or migrates from the old project.

## 10. Implementation phases (none started)

| Phase | Content | Exit test |
|---|---|---|
| 0 | Owner decisions D1–D5; owner creates the new Firebase project (free plan) and OAuth client | — |
| 1 — **COMPLETE** | Pure sync core (`src/sync/`: scope, merge, revision, crypto, missing-wallpaper model) plus the product-side limits it depends on (icon policy, text and address limits, device-local record) | 231 unit tests in all; merge properties over 600 random edit runs; threat-model tests; payload budget; icon and text limits over 300 random mixes each; browser checks `e2e/icons.ts` (6) and `e2e/limits.e2e.ts` (8) |
| 2 — **COMPLETE** | Security Rules + emulator test suite (section 6) | 71 emulator tests pass; 27 of 27 rule weakenings caught; 42 shared rows agree with the reference validator |
| 3 — **COMPLETE (emulator, mock sign-in)** | REST transport, engine, recovery-key flow, devices, Account & Sync screen and conflict screen (the original phases 3–5, without real Google sign-in) | 28 engine integration tests, 20 browser checks on two profiles plus a stranger, privacy scans; section 13 |
| 4 | Real sign-in: Google through `launchWebAuthFlow`, Firebase token exchange and refresh, optional `identity` permission; production configuration | Needs the real project and OAuth client (owner) |
| 5 | Hands-on QA of sync; copy review | Human QA script |
| 6 | Deletion flows, devices, rotation, sign out everywhere, encrypted backup file | Read-back verification of deletions |
| 7 | Test account against the real project; quota and failure drills; privacy policy and store declarations; release | Full regression + human QA |
| later | Device-to-device approval; wallpaper sync | — |

Startup bundle stays as it is: all of this loads on demand.

## 10a. Phase 1 as built (`src/sync/`, not imported by the product)

| File | What it is |
|---|---|
| `scope.ts` | What is uploaded and what stays local, field by field; `toSyncable` / `applySyncable` |
| `merge.ts` | Three-way merge with reported conflicts and per-conflict resolutions |
| `revision.ts` | The envelope, the next-step decision (`plan`), checks on a decrypted copy, the write rule |
| `crypto.ts` | Recovery key, key wrapping, sealing and opening documents, size limit |
| `wallpaper.ts` | Backgrounds that reference a picture this device lacks; the device-local record |
| (product) `core/iconPolicy.ts`, `core/limits.ts`, `browser/iconEncode.ts`, `app/icons.ts`, `storage/deviceLocal.ts` | The limits and the device-local store, used by the 2.1 product |
| `fixtures.ts` | Repeatable test workspaces of any size |

Verified at phase exit: the Senuma 2.0 branch builds to the same bytes as the 2.0.0 package.
The sync folder itself is still not imported by the product (2.1 imports only the limits).

Tested behaviour, in the tests' own words: a change on one side is taken exactly; changes that
do not collide are both kept; the same link renamed differently, an edit against a deletion, a
link moved to two places and two different reorderings are reported as conflicts and decided by
nobody; a Space deleted on one side while the other added to it is one question; a first sync
is never combined automatically; a copy older than one already seen, a vanished copy, an
unknown key or a newer format stops sync; stored bytes contain no address, title, Space name or
device label; one changed bit, another account, another document path, another key id or
another revision makes a document unreadable; a mistyped recovery key is caught before use.

Settled at phase exit: icon limits wired into save, import and load (5.2.1); text and address
limits (5.2.2); device-local storage for held backgrounds (3.5).

Still to settle before phase 4:
- The first-sync choice should reuse the existing idempotent merge (duplicates by address
  skipped), since two devices with no common past have different ids for the same links.
- Settling one conflict can raise another (keeping a Space brings its own questions); the
  conflict screen must loop until none remain. The core supports this.

## 11. Risks and trade-offs

- **Lost recovery key = unreadable cloud copy.** Softened by local-first (devices keep their
  data) and D4, not removed. This is the price of the server not being able to read the data.
- **Trust in the shipped code** (threat model, last row) cannot be engineered away in an
  extension.
- **No per-device revocation without server code.** Soft removal is cooperative; hard reset is
  disruptive. Real revocation needs a paid plan.
- **Whole-workspace document.** Simple, hides structure, atomic. Cost: every change re-uploads a
  few kB, and two devices editing at once always go through a merge.
- **No live updates.** Another device's change appears on the next new tab or “Sync now”.
- **Free-plan ceiling and a public API key.** Abuse can exhaust the daily quota; sync then stops
  for everyone until the next day, while the product itself keeps working.
- **Manual conflict resolution is real UI work** and the part most likely to be confusing; the
  automatic merge must be conservative.
- **REST instead of the SDK:** small and auditable, but retries, token refresh and error mapping
  are ours to write and test.
- **Sign-in flow differences** between Chrome, Brave and Edge **[verify]** in phase 3.
- **Region and data-protection duties** begin the moment an e-mail address is stored: policy,
  deletion on request, breach handling.
- **Sync changes the product's privacy position** from “nothing leaves the device” to “an
  encrypted copy leaves if you turn it on”. Listing and policy must change with it, not before.

## 13. Phase 3 as built (2026-10-03)

Everything here runs against the local emulator with the emulator's mock sign-in. **No real
Google sign-in, no real project.**

### 13.1 Shape

| Part | File | Loaded |
|---|---|---|
| Build switch | `src/sync/config.ts` | `VITE_SENUMA_SYNC=emulator` at build time (`npm run build:sync` → `dist-sync`). An ordinary build contains no sync code at all (checked: no sync file, no emulator address in `dist`). |
| Transport | `src/sync/transport.ts` | Firestore REST, no SDK. A new revision and the verbatim history copy of the previous one go in **one atomic commit**, guarded by the previous document's version stamp; the server stamps the time. |
| Engine | `src/sync/engine.ts` | With sync on, or when Account & Sync is opened |
| Browser wiring | `src/sync/syncRuntime.ts` | Same chunk as the engine |
| Mock sign-in | `src/sync/mockAuth.ts` | Emulator builds only; unsigned tokens the emulator accepts and no real service does |
| Account & Sync | `src/features/sync/` | When the screen is opened |

Differences from the design:
- **The engine runs in the page, not the service worker.** Only one tab syncs at a time (a
  browser lock); the others see the result through storage. Consequence: sync happens while a
  Senuma tab is open — which is whenever the setup can change — and not in the background.
- **Restore points:** sync keeps **one** restore point, its latest (“Before the last sync”), so
  frequent syncs cannot push the person's own restore points out.
- **Device-local records** under their own keys: `bos.sync` (account, device id and name, the
  wrapped key, the recovery key, the last common copy, paused), `bos.device` (held
  backgrounds, device choices). Neither is ever uploaded or in a backup file.

### 13.2 Engine behaviour

| Situation | What happens |
|---|---|
| Turning sync on, first device | Recovery key generated and shown; **nothing is uploaded** until the person types its last four characters; then the wrapped key, the device entry and revision 1 |
| Second device | Recovery key entered and checked on the device. Wrong key: refused in place, nothing changes. If the device has its own setup: the person chooses merge (by address, nothing doubled), use cloud, or use this device; nothing is written before the choice. An empty device just receives the workspace. |
| Local change | Sent as the next revision after a 3-second quiet period, only if something that syncs changed |
| Remote change, nothing changed here | Applied, after a restore point |
| Both changed | Three-way merge; if anything collides: **conflict**, and nothing changes here or in the cloud until the person chooses |
| Conflict choices | per item; keep this device for all; keep the cloud for all; keep both (offered when every difference is in a link: this device's version stays and the cloud's is added beside it as a second link; an edit against a deletion keeps the edited one) |
| Offline | A state, not an error; edits stay on the device and are merged when the connection is back |
| Paused | Nothing sent or received; resume carries on |
| Sign-in expired | Stops with “Sign in again”; nothing changes; signing in as the same account carries on |
| Cloud copy deleted elsewhere | Stops (`missing`); nothing is re-uploaded unless the person asks (“Upload this device's setup again”) |
| Corrupted ciphertext, wrong format, newer schema | Stops; nothing applied |
| An old revision put back | Stops (`went-backwards`); the same old bytes renumbered are unreadable |
| Over the size limit | Stops; nothing sent, nothing cut; everything stays on the device |
| Written too soon (rules' 2-second spacing) | Waits and retries, up to three times |
| Transient failure | Retried after 15 s, 1 min, then every 5 min, while a tab is open |

### 13.3 Devices and keys

- Device entries are encrypted (name, created, last synced, last revision); the list is
  decrypted on the device. The name defaults to “browser · platform” and can be changed.
- **Remove device** deletes the entry; that device stops syncing at its next attempt and signs
  itself out, keeping its own data. It is **not a revocation**: the device keeps what it has,
  its sign-in is untouched, and with the recovery key it can join again (tested). The screen
  says so.
- **New recovery key** makes a new key, re-encrypts the current copy, deletes history made with
  the old key and the old key record. Other devices stop with “enter the new recovery key”;
  the old key no longer opens anything (tested). It does not take back what a device already
  has; the screen says so.
- **Sign out** stops sync on that device only and leaves its setup exactly as it was; the cloud
  copy stays. **Delete cloud data** removes history, the workspace, device entries, then keys,
  and turns sync off on that device; its setup stays.

### 13.4 Tests

| Suite | Count | What |
|---|---|---|
| `firebase/engine.test.ts` (emulator) | 28 | first sync; second account; second device empty / with its own setup (merge, cloud, device); wrong, mistyped and foreign keys; local edit; remote edit with restore point; concurrent non-conflicting; conflicting (stop, keep cloud, keep this device, keep both, edit against deletion, per-item); offline edit and reconnect; unreachable service; paused and resumed; expired sign-in; corrupted ciphertext; replayed and renumbered old revision; newer format; deleted cloud copy and upload again; oversized workspace; icon limits with no back-and-forth; missing wallpaper reference with no back-and-forth; device list and rename; sign-out keeps local state; removal is not revocation; new recovery key; two privacy scans |
| `firebase/rules.test.ts` (emulator) | 71 | unchanged |
| `e2e/sync.e2e.ts` (emulator, browser) | 20 | lazy loading (nothing of sync loads with a new tab or with Settings, only when Account & Sync is opened; a device with sync on loads it by itself and one without does not); copy check (required statements present; no zero-knowledge, “never”, revocation or anonymity claims); recovery key shown once and confirmed; vault contents scanned; second device with wrong then right key; merge; edit; conflict (both versions shown, nothing changed before the choice, keep both, per-item); pause; offline; expired sign-in; recovery key shown again only after confirmation; device list wording; removal; sign-out; a stranger gets an empty vault; no console errors |

Privacy scans (engine and browser): the stored documents, read with the rules off, contain no
link title or address or host name, no Space, group or Mode name, no search-provider name, no
device name, no picture file name or preview, no opened-page or recently-closed-page data, no
command-centre usage, no e-mail address, and only the approved field names. Searches are not
stored by Senuma at all, so there is nothing to upload.

### 13.5 Bundle

| | Before phase 3 | After |
|---|---|---|
| Startup JS | 44.00 kB | **43.78 kB** ordinary build, **43.94 kB** sync build (budget 44, unchanged) |
| On-demand JS (sync excluded) | 21.92 kB (budget 22) | 22.74 kB ordinary, 23.23 kB sync build (**budget raised to 23.5**) |
| Sync JS (new line) | — | 0 kB ordinary; 18.80 kB sync build (engine and transport 10.54, screen 8.27) (**new budget 20**) |
| Language packs (tr) | 6.73 kB | 6.90 kB |

Why the on-demand raise: startup had to shrink to make room for the switch that loads sync, so
the words about the size limits moved from the startup dictionary into their own small module
(English on demand, Turkish with the Turkish pack); and in a build with sync the backup reader
becomes a chunk shared by Settings and the engine. Trimmed first: an unused startup string was
removed and the limits words were split by language.

### 13.6 Not done, and why

- **Real sign-in** (phase 4): needs the real project and an OAuth client, which are not
  approved yet. The engine's `Auth` interface is what the real sign-in will implement.
- **Background sync** in the service worker: not needed while sync runs whenever a tab is open.
- **Cross-origin access to the real Firestore REST endpoint from the extension page** is
  unverified (the emulator allows it). **[verify]** in phase 4.
- The Turkish sync words travel in the same chunk as the English ones.

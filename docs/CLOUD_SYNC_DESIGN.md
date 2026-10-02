# Senuma cloud sync — design (for Senuma 2.1)

Status: **design approved; phase 1 (pure core) written and tested; nothing connected.** No
backend exists, no Firebase project was created or changed, nothing was published, and none of
this code is in the Senuma 2.0 package. Decided 2026-10-02: the 1.80 Firebase system is not a
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
pixels, preview, file name or size. A device that does not have the picture shows the theme
backdrop and must not rewrite the setting (requirement for phase 4: the state sanitizer must
tolerate a reference to a picture this device lacks, or two devices would overwrite each other).

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
vaults/{uid}/keys/{keyId}          v, salt (bytes), wrapped (bytes: nonce + wrapped key)
vaults/{uid}/workspace/current     format, keyId, revision, updatedAt (server time), nonce (bytes), payload (bytes)
vaults/{uid}/history/{revision}    same six fields; last 5 kept, pruned by the client
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

Encrypted size of the whole workspace document (gzip, padded, AES-GCM):

| Workspace | Encrypted size | Share of 512 kB |
|---|---|---|
| 25 links | 3 kB | 0.6 % |
| 100 links | 6 kB | 1.2 % |
| 500 links | 24 kB | 4.7 % |
| 1 000 links | 46 kB | 9 % |
| 5 000 links | 223 kB | 44 % |
| 10 000 links | 444 kB | 87 % |
| 15 000 links | 665 kB | **over — refused** |
| 1 000 links, each address 200 characters longer | 206 kB | 40 % |
| 300 links, each with a 2 kB picture stored as its icon | 475 kB | 93 % |
| 100 links, each with an 8 kB picture stored as its icon | 613 kB | **over — refused** |

- Ordinary links cost about **45 bytes each**. The limit is reached near 11 500 links.
- **The real risk is pictures stored inside links.** A link's icon may be a `data:` image, and
  the state model puts no limit on its size (nor on title or address length). Such data does not
  compress. A few hundred of them fill the limit.
- Behaviour at the limit (implemented in the core): the document is **refused whole, never
  truncated**; local data is unaffected; the engine reports “near the limit” from 75 %.
- Sealing 10 000 links takes about 0.1 s, so encrypting on every change is affordable.
- Free-tier budget (20 000 writes, 50 000 reads per day): a sync writes about 3 documents
  (current, history, device); pushes are debounced and rule-limited; reads are throttled to one
  every few minutes per device.

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

Before chunking, the cheaper measures are: (a) cap the size of a `data:` icon accepted into a
link at save time (a product decision for all users, not only sync), and (b) warn at 75 %.
Recommendation: do (a) and (b) in 2.1 and keep chunking in reserve.

## 6. Security Rules strategy

Principles: deny by default; a vault is reachable only by its own account, only when signed in
through Google; every write is shape-, size-, order- and rate-checked; no wildcard reads.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    function owner(uid) {
      return request.auth != null && request.auth.uid == uid
          && request.auth.token.firebase.sign_in_provider == 'google.com';
    }
    function envelope(d) {
      return d.keys().hasOnly(['format','keyId','revision','updatedAt','nonce','payload'])
          && d.keys().hasAll(['format','keyId','revision','updatedAt','nonce','payload'])
          && d.format == 1 && d.revision is int
          && d.keyId.matches('^[a-z0-9]{8,40}$')
          && d.updatedAt == request.time
          && d.nonce is bytes && d.nonce.size() == 12
          && d.payload is bytes && d.payload.size() <= 512 * 1024;
    }
    match /vaults/{uid}/workspace/current {
      allow get:    if owner(uid);
      allow create: if owner(uid) && envelope(request.resource.data) && request.resource.data.revision == 1;
      allow update: if owner(uid) && envelope(request.resource.data)
                    && request.resource.data.revision == resource.data.revision + 1
                    && request.time > resource.data.updatedAt + duration.value(2, 's');
      allow delete: if owner(uid);
    }
    // keys: get/list/create/delete by owner, never update; size-checked.
    // history: get/list/create/delete by owner, never update; same envelope check.
    // devices: get/list/create/update/delete by owner; only keyId, nonce, payload; size-checked.
    match /{document=**} { allow read, write: if false; }
  }
}
```

The same write rule exists as a pure function (`writeAllowed` in `src/sync/revision.ts`) with
tests; the emulator suite must agree with it case by case.

**Emulator tests** (local Firestore emulator + rules unit-testing library; development
dependency only, nothing deployed, no billing):
signed-out denied everywhere · another account denied on every path · non-Google sign-in denied ·
create only at revision 1 · update only at +1 · skipped or repeated revision denied · extra or
missing field denied · readable key id denied · oversized payload denied · wrong nonce length denied ·
client-chosen timestamp denied · two writes inside the rate window denied · key and history
documents immutable · owner can delete everything · undeclared paths denied.

Also in the console (owner, later): Google as the only sign-in provider; API key restricted to
the three APIs used; App Check is not usable from an extension **[verify]**, so the rules above
are the whole defence.

**Deletion flows (all client-side, no server code):**
- *Delete cloud data:* delete history, current, devices, keys; stay signed in or sign out; local
  data untouched; sync off.
- *Delete account:* delete cloud data first, then the Firebase account (needs a fresh Google
  sign-in). If the second step fails, an empty account remains and the action can be repeated.
- Both verified by reading back that the paths are empty.

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
| 1 — **done** | Pure core, no network: `src/sync/` scope, merge, revision, crypto | 76 unit tests: fixed vector, merge properties over 600 random edit runs, threat-model tests, payload budget |
| 2 | Security Rules + emulator test suite | All rule tests pass locally |
| 3 | Sign-in (optional `identity`), REST client, against the emulator | Sign in/out; session refresh |
| 4 | Engine in the service worker, state machine, restore points, history | Two browser profiles against the emulator: edit, offline edit, concurrent edit, conflict |
| 5 | Account & Sync UI, recovery-key setup, conflict screen, copy in English and Turkish | Hands-on QA script |
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
| `fixtures.ts` | Repeatable test workspaces of any size |

Verified: the Senuma 2.0 build output is byte-identical with and without this folder.

Tested behaviour, in the tests' own words: a change on one side is taken exactly; changes that
do not collide are both kept; the same link renamed differently, an edit against a deletion, a
link moved to two places and two different reorderings are reported as conflicts and decided by
nobody; a Space deleted on one side while the other added to it is one question; a first sync
is never combined automatically; a copy older than one already seen, a vanished copy, an
unknown key or a newer format stops sync; stored bytes contain no address, title, Space name or
device label; one changed bit, another account, another document path, another key id or
another revision makes a document unreadable; a mistyped recovery key is caught before use.

Found while building, to settle before phase 4:
- Icons stored as `data:` images are unbounded (5.2).
- The state sanitizer's handling of a background that references a picture this device lacks (3.5).
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

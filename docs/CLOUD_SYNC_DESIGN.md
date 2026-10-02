# Senuma cloud sync — design proposal

Status: **proposal, nothing implemented.** No backend exists, no Firebase project was created or
changed, nothing was published. Decided 2026-10-02: the 1.80 Firebase system is not a Senuma
requirement; Senuma's sync is designed from first principles.

Items marked **[verify]** are facts to confirm in a prototype before they are relied on.

## 0. Decisions needed from the owner

| # | Decision | Recommendation |
|---|---|---|
| D1 | Does sync ship in 2.0 or later? | **Later (2.1).** 2.0 is a finished release candidate; sync is new surface, a new permission and new store declarations. |
| D2 | What happens to the legacy cloud import already in RC 2? | **Remove it from 2.0.** With no users to migrate it is dead code that costs a store declaration (“Authentication information”). Removal is a code change, so the regression suite runs again. |
| D3 | New Firebase project, or reuse `newtabfolders`? | **New project.** Clean rules, clean keys, and the old one can later be deleted whole. |
| D4 | Can the recovery key be shown again on a device that is already syncing? | **Yes** (see 3.3). |
| D5 | Database region (permanent once chosen) | An EU multi-region, unless there is a reason otherwise. |

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
revision | schemaVersion`, so the server cannot move a blob between accounts, documents or
revisions. Client timestamps and the writing device's label live inside the ciphertext.

Still visible: sizes (optionally padded to 1 kB steps), timing, revision count.

### 3.3 Lifecycle
| Event | Behaviour |
|---|---|
| Turn sync on, first device | Generate WK and recovery key. Show the recovery key once with copy / save as file / print, and require confirmation (re-enter the check group) **before** anything is uploaded. |
| New device | Sign in → wrapped key found → ask for the recovery key → unwrap → store non-extractable. Then first-sync choice (4.4). |
| Show recovery key again (D4) | Recommended: keep the recovery key in local extension storage on synced devices so it can be shown again. It adds no exposure that matters — that device already holds the plaintext — and lost keys are the main way people lose access. Alternative: never store it; “new recovery key” then means rotation. |
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
| Theme, packaged wallpaper choice, dim/blur, layout preferences, language | Restore points, the 1.x record, onboarding state |
| | Per-device switches tied to a permission (recently closed pages on/off), icon-service choice |
| | Session tokens, keys, device id |

Implemented as an explicit allow-list projection of `AppState`, with a unit test that fails when
a new field is added without being classified.

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
vaults/{uid}/keys/{keyId}          v, salt (bytes), wrapped (bytes), createdAt, createdBy
vaults/{uid}/workspace/current     format, schemaVersion, keyId, revision, deviceId,
                                   updatedAt (server time), nonce (bytes), payload (bytes)
vaults/{uid}/history/{revision}    same fields as current; last 5 kept, pruned by the client
vaults/{uid}/devices/{deviceId}    keyId, createdAt, lastSyncAt, lastRevision,
                                   nonce (bytes), label (bytes, encrypted name)
```

- No plaintext user content anywhere. No e-mail in Firestore (it lives in Firebase Auth only).
- Typical payload: a few kB compressed. Limit 512 kB per document by rule.
- Indexes: none beyond the automatic ones (every read is by path; history is listed by id).
- Free-tier budget (20 000 writes, 50 000 reads per day): a write costs about 3 document
  writes (current + history + device); pushes are debounced and rule-limited; reads are throttled
  to one every few minutes per device. Comfortable for hundreds of active users; beyond that the
  quota, not billing, is the ceiling.

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
      return d.keys().hasOnly(['format','schemaVersion','keyId','revision','deviceId','updatedAt','nonce','payload'])
          && d.format == 1 && d.schemaVersion is int && d.revision is int
          && d.keyId is string && d.keyId.size() <= 40
          && d.deviceId.matches('^[A-Za-z0-9_-]{16,40}$')
          && d.updatedAt == request.time
          && d.nonce is bytes && d.nonce.size() == 12
          && d.payload is bytes && d.payload.size() <= 512 * 1024;
    }
    match /vaults/{uid}/workspace/current {
      allow get:    if owner(uid);
      allow create: if owner(uid) && envelope(request.resource.data) && request.resource.data.revision == 1;
      allow update: if owner(uid) && envelope(request.resource.data)
                    && request.resource.data.revision == resource.data.revision + 1
                    && request.resource.data.schemaVersion >= resource.data.schemaVersion
                    && request.time > resource.data.updatedAt + duration.value(2, 's');
      allow delete: if owner(uid);
    }
    // keys: get/list/create/delete by owner, never update; size-checked.
    // history: get/list/create/delete by owner, never update; same envelope check.
    // devices: get/list/create/update/delete by owner; size-checked.
    match /{document=**} { allow read, write: if false; }
  }
}
```

**Emulator tests** (local Firestore emulator + rules unit-testing library; development
dependency only, nothing deployed, no billing):
signed-out denied everywhere · another account denied on every path · non-Google sign-in denied ·
create only at revision 1 · update only at +1 · skipped or repeated revision denied · schema
downgrade denied · extra field denied · oversized payload denied · wrong nonce length denied ·
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
| 1 | Pure core, no network: syncable projection, 3-way merge, conflict model, envelope encryption, key wrap | Unit tests incl. known-answer vectors and merge properties |
| 2 | Security Rules + emulator test suite | All rule tests pass locally |
| 3 | Sign-in (optional `identity`), REST client, against the emulator | Sign in/out; session refresh |
| 4 | Engine in the service worker, state machine, restore points, history | Two browser profiles against the emulator: edit, offline edit, concurrent edit, conflict |
| 5 | Account & Sync UI, recovery-key setup, conflict screen, copy in English and Turkish | Hands-on QA script |
| 6 | Deletion flows, devices, rotation, sign out everywhere, encrypted backup file | Read-back verification of deletions |
| 7 | Test account against the real project; quota and failure drills; privacy policy and store declarations; release | Full regression + human QA |
| later | Device-to-device approval; wallpaper sync | — |

Startup bundle stays as it is: all of this loads on demand.

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

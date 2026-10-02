# Migrating from the published New Tab Folders 1.80

The published build (manifest 1.80, shown as 1.8.0) is the source of truth for migration, not
the older 1.x files in the repository root. It was read from an installed copy; `npm run
rehearse` runs the real build under the real extension ID and then updates it in place.

## 1. What 1.80 keeps, and what happens to it

| 1.80 data | Where | In Senuma |
|---|---|---|
| Folders, links, headers | `ntf_data.folders` (chrome.storage.local) | Spaces, links, groups. Every valid link kept. |
| Pinned folders | `folder.pinned` | Listed first |
| Quick bar | `ntf_data.quickBarLinks` | Dock. A quick-bar link with no folder copy goes into a “Quick bar” Space. |
| Theme, language | `theme`, `language` | Nearest theme; Turkish stays Turkish, the six other languages become English |
| Background: colour, gradient | `background {type, value, overlay 0–80, blur 0–10}` | Carried over with dim and blur |
| Background: uploaded picture | same field, as a base64 data URL | Decoded once after the upgrade, resized, stored in the local wallpaper library (IndexedDB), applied with the same dim and blur |
| Background: picture at a web address | same field, as a URL | **Not carried over.** Senuma does not load backgrounds from the web. The theme background is used. |
| Pro flag, expiry, licence key, instance id | `isPro`, `proExpiresAt`, `licenseKey`, `licenseInstanceId` | Copied as inert history. Nothing reads them, nothing is gated, no request is made. |
| Cloud sign-in | `ntf_auth` (chrome.storage.local) | Left exactly as it is; read only when the person asks for their cloud copy |
| Weather cache, widget layout, link statistics, column and compact settings, search engine | various | Not used. They stay in `ntf_data`, which is never modified. |

`ntf_data` and `ntf_auth` are never written or removed.

## 2. Paid plans

Owner's statement (2026-10-02): no known completed purchases, no known paying customers.
Therefore there is no entitlement system, no Pro gating and no LemonSqueezy request in Senuma.
A licence key found in 1.x data is preserved as inert history only. If a real purchase is ever
found, that is a separate decision.

Fact worth knowing: 1.80 itself asks LemonSqueezy about a stored key on start and deletes a key
the provider does not recognise, so what reaches Senuma is whatever 1.80 last left.

## 3. Cloud sync in 1.80 — audit

- **Account:** Google sign-in (`chrome.identity`, OAuth scopes: email, profile) exchanged for a
  Firebase account. The Firebase account id is the only identifier of a user's cloud data.
- **On the device:** `ntf_auth` = `{ uid, idToken, refreshToken, expiresAt, email, displayName, photoUrl }`.
- **In the cloud:** one Firestore document per account, `users/{uid}`, with three fields:
  `ntf_data` (the entire 1.x data object as one JSON string: folders, links, quick bar,
  settings, the Pro fields including the licence key, and the background, including an uploaded
  picture as base64), `updatedAt`, `version` (“1.6”). Nothing else is stored remotely.
- **Behaviour:** on every start a signed-in 1.80 pulled the document and replaced the local data
  if the cloud copy was newer; otherwise it pushed. Every save pushed. So a device's `ntf_data`
  already equals the cloud copy as of the last time 1.80 ran there. The cloud can only be
  newer if **another device** saved later.

## 4. Cloud migration path (implemented, migration-only)

Senuma has no sync. One read-only path exists so a newer cloud copy is not stranded:

1. On upgrade, the device's own `ntf_data` is converted as usual. No network request.
2. If `ntf_auth` exists, the upgrade notice says so, and Settings → Data shows
   “Bring your New Tab Folders cloud copy” with the account's address.
3. Only when the person presses it: the saved refresh token is exchanged for a short-lived
   token (securetoken.googleapis.com), and the one document is read (firestore.googleapis.com).
   The token is kept in memory for that request only.
4. The copy is converted and the person sees what it holds, **when the cloud copy was saved and
   when this device's 1.x data was saved**, and chooses: merge, replace, or cancel.
5. A restore point of the current setup is saved **before** a merge and before a replace.
6. Nothing is ever written, updated or deleted in the cloud. `ntf_auth` is not changed.

Failure cases: sign-in no longer accepted → a message, nothing changes; no document → “no
usable cloud copy”; offline → retry message.

No new permission: both Google endpoints answer cross-origin requests from an extension page,
so Senuma still declares no host permissions and does not use `identity`.

Retirement: once enough time has passed, the button and `src/browser/legacyCloud.ts` can be
removed in a later release. The Firebase project and its data are the owner's to keep or
delete; Senuma never deletes them.

**Not tested against the real service.** The rehearsal uses a stand-in for the two Google
endpoints (correct token and account → the document; anything else → refused). One real check
with a real signed-in 1.80 profile is needed before release.

## 5. Other limits

- A person signed in on two devices gets two independent Senuma setups; the button lets each
  device pull the same cloud copy, but they do not stay in step afterwards.
- A very large uploaded background could fail to store if browser storage is full; the theme
  background is then used and the original stays in `ntf_data`.

# Senuma development Firebase project — creation plan (phase 4)

Status: **plan only. Nothing has been created.** Each step names who does it and where to stop.
The legacy `newtabfolders` project is not touched by any step.

Values that must match the design (CLOUD_SYNC_DESIGN.md D3, D5): a new project; Firestore in an
**EU multi-region**; **Google sign-in only**; **no Analytics, no Cloud Functions, no Cloud
Storage, no Hosting, no App Check** in this phase; **free (Spark) plan, no billing account**.

## 1. Project (owner, Firebase console)

1. console.firebase.google.com → **Create a project**.
2. Name: `senuma-dev`. Accept the generated project ID or pick `senuma-dev-<suffix>`; note it.
3. **Google Analytics: off.** (If the console only offers it pre-ticked, untick it.)
4. Create. The project starts on Spark. **Do not** add a billing account or upgrade to Blaze.

STOP if the console requires billing, Analytics, or a Google Cloud organisation choice that is
not “No organisation” for a personal account.

## 2. Firestore (owner, Firebase console) — irreversible location

1. Build → Firestore Database → Create database.
2. Edition: **Standard**.
3. Location: **`eur3` (Europe, multi-region)**. This cannot be changed later.
4. Start in **production mode** (everything denied until our rules are deployed).

STOP if `eur3` is not offered (for example only single regions, or only “Enterprise” edition):
report the options before choosing.

## 3. Authentication (owner, Firebase console)

1. Build → Authentication → Get started → Sign-in method → **Google** → Enable.
2. Project support e-mail: `rumeliskelesi+senuma@gmail.com` (temporary, as for the drafts).
3. Save. **Enable no other provider** (not e-mail, not anonymous). The rules refuse any provider
   but Google anyway.
4. Note the “Web client ID” Firebase shows under the Google provider (an OAuth client it created).

## 4. OAuth consent and client (owner, Google Cloud console for the same project)

1. Google Auth Platform (formerly “OAuth consent screen”): user type **External**; app name
   **Senuma (development)**; support e-mail as above; **no logo** (avoids review).
2. Data access / scopes: **only `openid` and `.../auth/userinfo.email`**. No Gmail, Drive,
   Contacts, Calendar or profile scopes.
3. Audience: publishing status **Testing**; test users: the expendable test accounts only (5).
4. Clients → the “Web client (auto created by Google Service)” → **Authorized redirect URIs** →
   add exactly `https://oghlifenjhpbebcdeboejbmemelkfobe.chromiumapp.org/` → Save.
   (That is the store item's ID; the development build carries the store item's public key so
   that it has this ID. JavaScript origins: none needed.)

## 5. API key (owner, Google Cloud console → Credentials)

Restrict the project's browser key (“Browser key (auto created by Firebase)”) to the APIs sync
uses: **Cloud Firestore API, Identity Toolkit API, Token Service API**. No application
restriction (an extension page sends no usable referrer). Note the key.

## 6. Local configuration (me, after the owner sends the four values)

`.env.senuma-dev.local` (git-ignored), from `.env.senuma-dev.example`:

```
VITE_SENUMA_SYNC=firebase
VITE_FIREBASE_PROJECT=<project id>
VITE_FIREBASE_API_KEY=<browser key>
VITE_GOOGLE_CLIENT_ID=<web client id>
SENUMA_EXTENSION_KEY=<public key from the published 1.80 manifest>
```

Build: `npm run build:sync:firebase` → `dist-sync`. Never packaged.

## 7. Rules deployment (owner signs in to the CLI; I run the deploy after approval)

```
npx firebase login
npx firebase deploy --only firestore:rules --project <project id> --config firebase/firebase.json
```

Deploys exactly `firebase/firestore.rules` (71 emulator tests, 27/27 mutations caught). Nothing
else is deployed. Then the rules checks of section 8 run against the real project.

## 8. Checks against the real project (two expendable test accounts)

- Rules: owner read/write; stranger read and write denied; signed-out denied; revision +1 only;
  delete semantics (owner deletes, nobody else).
- Two isolated Chrome profiles, test account A on both, test account B as the stranger: Google
  sign-in, first sync with recovery-key confirmation, second device join, encrypted push/pull,
  non-conflicting merge, real conflict, offline edit and reconnect, pause/resume, sign-out keeps
  local data, new recovery key, delete cloud data.
- Privacy: read every stored document (Firebase console or REST as the owner) and scan for
  plaintext; list separately what Google/Firebase holds about the accounts themselves.

Google's own sign-in window asks for the account password; **the owner types it**, never me.

## 9. What exists afterwards, and how to remove it

A Spark project with one Firestore database, Google sign-in, an OAuth client in Testing, and the
test accounts' encrypted test data. Removal: delete cloud data from the extension, then delete
the project (Project settings → Delete project; 30-day recovery window).

// Checks that the rules tests have teeth: each run weakens ONE rule and expects the suite to fail.
// Needs the emulator already running:   npm run emulator   (in another terminal), then
//   node scripts/rules-mutations.mjs
// Local only; writes its altered rules to a temporary file and never touches firebase/firestore.rules.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const rules = readFileSync('firebase/firestore.rules', 'utf8').replace(/\r\n/g, '\n');
const dir = mkdtempSync(join(tmpdir(), 'senuma-rules-'));

/** [what is weakened, text to find, replacement] */
const MUTATIONS = [
    ['any signed-in account may act as owner', '&& request.auth.uid == uid\n', '\n'],
    ['sign-in provider not checked', "          && request.auth.token.firebase.sign_in_provider == 'google.com';", ';'],
    ['unknown fields accepted', "      return d.keys().hasOnly(['format', 'keyId', 'revision', 'updatedAt', 'nonce', 'payload'])\n          && d.keys()", '      return d.keys()'],
    ['format not checked', '&& d.format is int && d.format == 1', ''],
    ['readable key id accepted', "value.matches('^[a-z0-9]{8,40}$')", 'value.size() > 0'],
    ['fractional revision accepted', '&& d.revision is int && d.revision >= 1', ''],
    ['nonce length not checked', '&& d.nonce is bytes && d.nonce.size() == 12\n          && isCiphertext', '&& d.nonce is bytes\n          && isCiphertext'],
    ['payload block shape not checked', '          && value.size() % 1024 == 16;', ';'],
    ['payload minimum not checked', '          && value.size() >= 1040\n', ''],
    ['payload maximum not checked', '          && value.size() <= most\n', ''],
    ['first write at any revision', '            && request.resource.data.revision == 1;', ';'],
    ['client-chosen time accepted on create', "            && isEnvelope(request.resource.data)\n            && request.resource.data.updatedAt == request.time\n            && request.resource.data.revision == 1", "            && isEnvelope(request.resource.data)\n            && request.resource.data.revision == 1"],
    ['client-chosen time accepted on update', "            && request.resource.data.updatedAt == request.time\n            && request.resource.data.revision == resource.data.revision + 1", "            && request.resource.data.revision == resource.data.revision + 1"],
    ['revision may skip ahead', 'request.resource.data.revision == resource.data.revision + 1', 'request.resource.data.revision > resource.data.revision'],
    ['revision may repeat or go back', 'request.resource.data.revision == resource.data.revision + 1', 'request.resource.data.revision <= resource.data.revision + 1'],
    ['no rate limit', "\n            && request.time > resource.data.updatedAt + duration.value(2, 's');", ';'],
    ['history need not match the server document', '            && request.resource.data == get(currentPath(uid)).data\n', ''],
    ['history under any number', '\n            && request.resource.data.revision == int(revision);', ';'],
    ['history may be rewritten', "        allow update: if false;\n        allow delete: if owner(uid);\n      }\n\n      // ---- Wrapped", "        allow update: if owner(uid);\n        allow delete: if owner(uid);\n      }\n\n      // ---- Wrapped"],
    ['history listed without a limit', 'allow list: if owner(uid) && request.query.limit <= 20;\n\n        // Only the document', 'allow list: if owner(uid);\n\n        // Only the document'],
    ['keys may be rewritten', "        allow update: if false;\n        allow delete: if owner(uid);\n      }\n\n      // ---- Devices", "        allow update: if owner(uid);\n        allow delete: if owner(uid);\n      }\n\n      // ---- Devices"],
    ['key record takes extra fields', "            && request.resource.data.keys().hasOnly(['v', 'salt', 'wrapped'])\n", ''],
    ['wrapped key of any length', '&& request.resource.data.wrapped.size() == 60', ''],
    ['device entry takes extra fields', "            && request.resource.data.keys().hasOnly(['keyId', 'nonce', 'payload'])\n", ''],
    ['readable device id accepted', "            && deviceId.matches('^[a-z0-9]{26}$')\n", ''],
    ['anyone signed in may delete the workspace', "        // \"Delete cloud data\".\n        allow delete: if owner(uid);", "        allow delete: if request.auth != null;"],
    ['other documents allowed under workspace', 'match /workspace/current {', 'match /workspace/{any} {'],
];

let survived = 0;
for (const [what, find, replacement] of MUTATIONS) {
    if (!rules.includes(find)) {
        console.log(`STALE   ${what}: the text to weaken is no longer in the rules file`);
        survived++;
        continue;
    }
    const file = join(dir, 'mutated.rules');
    writeFileSync(file, rules.replace(find, replacement));
    let failed = false;
    try {
        execFileSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'firebase/vitest.config.ts'], {
            env: { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8085', SENUMA_RULES_FILE: file }, stdio: 'pipe',
        });
    } catch {
        failed = true;
    }
    console.log(`${failed ? 'caught ' : 'MISSED '} ${what}`);
    if (!failed) survived++;
}
console.log(`\n${MUTATIONS.length - survived} of ${MUTATIONS.length} weakened rules were caught by the tests`);
process.exit(survived ? 1 : 0);

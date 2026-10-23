/**
 * PageUp — grant (or revoke) the `staff` custom claim
 * ------------------------------------------------------------------
 * The admin console only works for accounts carrying `staff: true`. That
 * claim can only be set with the Admin SDK — never from the browser — which
 * is exactly what makes it a real permission and not a hidden button.
 *
 *   cd seed && npm install
 *
 *   # grant
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node grant-staff.js you@example.com
 *
 *   # revoke
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
 *     node grant-staff.js you@example.com --revoke
 *
 *   # list everyone who currently has it
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json node grant-staff.js --list
 *
 * The user must sign out and back in (or wait up to an hour for the token to
 * refresh) before the claim takes effect in their browser.
 */
import { initializeApp, applicationDefault, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith('--'));
const email = args.find((a) => !a.startsWith('--'));
const revoke = flags.includes('--revoke');
const list = flags.includes('--list');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const appOptions = { projectId };
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  appOptions.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
} else {
  appOptions.credential = applicationDefault();
}

initializeApp(appOptions);
const auth = getAuth();

async function listStaff() {
  const staff = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      if (user.customClaims?.staff) staff.push(user);
    }
    pageToken = page.pageToken;
  } while (pageToken);

  if (!staff.length) {
    console.log('No accounts carry the staff claim yet.');
    return;
  }
  console.log(`${staff.length} staff account(s):`);
  staff.forEach((u) => console.log(`  ${u.email || u.uid}  (${u.uid})`));
}

async function main() {
  if (list) return listStaff();

  if (!email) {
    console.error('Usage: node grant-staff.js <email> [--revoke]');
    console.error('       node grant-staff.js --list');
    process.exit(1);
  }

  const user = await auth.getUserByEmail(email);
  const claims = { ...(user.customClaims || {}) };

  if (revoke) delete claims.staff;
  else claims.staff = true;

  await auth.setCustomUserClaims(user.uid, claims);

  console.log(revoke
    ? `Revoked staff from ${email}.`
    : `Granted staff to ${email}.`);
  console.log('They must sign out and back in for the claim to apply.');
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  if (/user-not-found/i.test(err.message)) {
    console.error('That account has not signed up yet — create it on the site first.');
  }
  process.exit(1);
});

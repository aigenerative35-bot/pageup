/**
 * PageUp — catalogue seeder
 * ------------------------------------------------------------------
 * Writes seed/books.sample.json into the Firestore `books` collection.
 *
 *   cd seed && npm install
 *
 *   # Against the local emulator (no credentials needed):
 *   npm run seed:emulator
 *
 *   # Against a real project, with a service account key:
 *   GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json npm run seed -- --project my-project-id
 *
 * The service account key is a SECRET. Keep it out of git (see .gitignore)
 * and never paste it into firebase-config.js.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const projectId = value('project') || process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const useEmulator = flag('emulator') || !!process.env.FIRESTORE_EMULATOR_HOST;

if (useEmulator) {
  process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
}

const appOptions = { projectId };
if (!useEmulator && process.env.FIREBASE_SERVICE_ACCOUNT) {
  appOptions.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
} else if (!useEmulator) {
  appOptions.credential = applicationDefault();
}

initializeApp(appOptions);
const db = getFirestore();

/** Lower-cased word list so `array-contains` queries work later. */
function searchTerms(book) {
  const source = [book.title, book.author, book.category, ...(book.tags || [])].join(' ');
  return [...new Set(source.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2))];
}

async function main() {
  const raw = JSON.parse(readFileSync(join(__dirname, 'books.sample.json'), 'utf8'));
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();

  raw.forEach((book) => {
    const { id, ...rest } = book;
    const ref = db.collection('books').doc(id);
    batch.set(ref, {
      ...rest,
      searchTerms: searchTerms(book),
      isNew: true,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });
    console.log(`  + books/${id}  ${book.title}`);
  });

  await batch.commit();
  console.log(`\nSeeded ${raw.length} books into ${useEmulator ? 'the emulator' : `project ${projectId || '(default)'}`}.`);
  console.log('Next: upload PDF/EPUB files to Storage and set each book\'s fileUrl + coverUrl.');
}

main().catch((err) => {
  console.error('\nSeed failed:', err.message);
  process.exit(1);
});

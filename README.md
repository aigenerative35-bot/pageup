# PageUp

A freemium online reading platform — browse a YouTube-style grid of books, read free previews instantly in the browser, then unlock the ones you love with a one-time payment.

Built as a static site (HTML + CSS + vanilla ES modules) on **Firebase** (Auth, Firestore, Storage, Hosting). No build step, no framework, no bundler — clone it, add your Firebase config, deploy.

---

## What is in the box

| Feature | Where |
|---|---|
| YouTube-style responsive book grid with thumbnails, badges and hover overlay | `index.html`, `assets/js/cards.js` |
| Search, category chips, five sort orders, infinite scroll | `assets/js/app.js` |
| 5-star rating (one vote per reader, aggregate kept in a transaction) | `assets/js/data.js` |
| Comments with like + delete, live via Firestore snapshots | `assets/js/book.js` |
| Like button + share (Web Share API with clipboard fallback) | `assets/js/cards.js`, `assets/js/ui.js` |
| Online reader — **EPUB** (epub.js), **PDF** (pdf.js), plus a text fallback | `assets/js/reader.js` |
| Freemium gating: free preview pages, unlock modal, paywall at the limit | `assets/js/book.js` |
| Auth: Google + email/password, password reset, persistent session | `assets/js/ui.js` |
| My Library: continue reading, liked, unlocked | `library.html` |
| Light / dark theme, offline-first Firestore cache | `assets/css/styles.css`, `assets/js/firebase.js` |
| Security rules for Firestore and Storage | `firestore.rules`, `storage.rules` |
| Sample catalogue seeder (Admin SDK) | `seed/` |
| CI: deploy to Firebase Hosting on push to `main` | `.github/workflows/deploy.yml` |

**Preview mode.** Until you paste a real Firebase config, the site runs entirely offline against the bundled public-domain catalogue in `assets/js/demo-data.js`. Every screen works — likes, ratings, comments and previews persist in `localStorage` — so you can review the product before touching Firebase.

---

## Quick start (5 minutes)

### 1. Create the Firebase project

1. Go to <https://console.firebase.google.com> and **Add project**.
2. In the project, **Add app → Web**, and copy the config object.
3. Enable the products you need:
   - **Authentication → Sign-in method** → enable *Google* and *Email/Password*
   - **Firestore Database → Create database** (start in production mode)
   - **Storage → Get started**

### 2. Paste the config

Open `assets/js/firebase-config.js` and replace the placeholders:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
```

While you are there, set `siteConfig.razorpayKeyId` if you want live payments, and `siteConfig.supportEmail`.

> These values are **public** client keys. They are meant to ship in the browser; your data is protected by `firestore.rules` and `storage.rules`, not by hiding them. Never put a service-account JSON in this file.

### 3. Run it locally

Any static server works — ES modules need `http://`, not `file://`:

```bash
npx serve .          # or: python3 -m http.server 5173
```

Open the printed URL. The site will now be in live mode.

### 4. Deploy

```bash
npm i -g firebase-tools
firebase login
firebase use --add            # pick your project, alias it "default"
firebase deploy               # hosting + firestore rules + storage rules
```

Or push to `main` and let `.github/workflows/deploy.yml` do it (set the
`FIREBASE_PROJECT_ID` repository variable and the `FIREBASE_SERVICE_ACCOUNT`
secret).

---

## Adding books

### Option A — the seeder (recommended for bulk)

```bash
cd seed
npm install
npm run seed:emulator                                  # local emulator, no creds
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccount.json \
  npm run seed -- --project your-project-id            # real project
```

Edit `seed/books.sample.json` first, or point the script at your own file.

### Option B — the console

Create documents in the `books` collection with this shape:

```jsonc
{
  "title": "Relativity: The Special and General Theory",
  "author": "Albert Einstein",
  "description": "Einstein explains his own theory to readers who know no mathematics.",
  "category": "Science",                  // drives the filter chips
  "tags": ["physics", "science"],
  "language": "English",
  "format": "pdf",                        // "pdf" | "epub"
  "pages": 168,
  "publisher": "Public Domain Press",
  "publishedYear": 1916,

  "isPremium": true,                      // false = free to read entirely
  "price": 149,                           // in rupees
  "previewPages": 14,                     // free pages before the paywall

  "coverUrl": "https://.../covers/relativity.jpg",
  "fileUrl":  "https://.../books/relativity/original.pdf",

  "views": 0,
  "likes": 0,
  "ratingSum": 0,
  "ratingCount": 0,
  "ratingAvg": 0,
  "trendScore": 0,                        // sort weight for "Trending"
  "createdAt": "<timestamp>"
}
```

### Uploading the files

Put book files in Storage and paste their **download URLs** into `fileUrl`:

```
books/{bookId}/original.pdf
books/{bookId}/original.epub
covers/{bookId}.jpg
```

The reader streams these from the browser, so **enable CORS** on the bucket if
you serve files from a different origin:

```bash
gsutil cors set cors.json gs://your-project.appspot.com
```

```json
[{ "origin": ["*"], "method": ["GET"], "maxAgeSeconds": 3600 }]
```

If `fileUrl` is empty, the reader falls back to a built-in text view — useful
for placeholders and for the offline demo catalogue.

---

## How the freemium model works

```
                 ┌─────────────────────── free for everyone ───────────────────────┐
Book is free  →  read every page
                 └─────────────────────────────────────────────────────────────────┘
                 ┌───────────── free preview ─────────────┐┌──── premium ────┐
Book is paid  →  first `previewPages` pages               → unlock with one payment
                 └───────────────────────────────────────┘└─────────────────┘
```

- The preview limit is clamped inside `assets/js/reader.js` (`limit`), so the
  reader physically cannot page past it — it is not just a hidden button.
- Unlocking writes a row to `users/{uid}/purchases/{bookId}` and the book
  becomes fully readable, forever, on every device.
- `siteConfig.razorpayKeyId` switches the checkout from the demo confirm to a
  real Razorpay popup. Leave it blank and no money moves.

> **Before you take real money:** move `recordPurchase()` into a Cloud Function
> triggered by the gateway webhook, and change the `purchases` rule in
> `firestore.rules` to `allow write: if false;`. A client must never be able to
> grant itself an entitlement. The current permissive rule exists so the demo
> checkout works end to end.

---

## Project layout

```
.
├── index.html              # catalogue, hero, filters, grid
├── book.html               # detail page + reader overlay
├── library.html            # continue reading / liked / unlocked
├── 404.html
├── assets/
│   ├── css/styles.css      # design tokens, components, light + dark
│   └── js/
│       ├── firebase-config.js   ← edit this first
│       ├── firebase.js          # SDK bootstrap + offline cache
│       ├── data.js              # Firestore reads/writes
│       ├── store.js             # facade: Firestore  or  offline demo
│       ├── demo-data.js         # public-domain sample catalogue
│       ├── ui.js                # header, theme, auth modal, share, toasts
│       ├── cards.js             # book card component
│       ├── reader.js            # pdf.js + epub.js + text engine
│       ├── app.js               # home page controller
│       ├── book.js              # detail page controller
│       └── library.js           # my library controller
├── firestore.rules
├── storage.rules
├── firestore.indexes.json
├── firebase.json
├── seed/                   # Admin SDK seeder
└── .github/workflows/deploy.yml
```

---

## Data model

```
books/{bookId}
  ├─ likes/{uid}                → { uid, createdAt }
  ├─ ratings/{uid}              → { uid, value: 1..5, updatedAt }
  └─ comments/{commentId}       → { uid, name, photoURL, text, likes, createdAt }
        └─ likes/{uid}          → { uid, createdAt }

users/{uid}                     → { displayName, email, photoURL, isPremium, plan }
  └─ purchases/{bookId}         → { bookId, uid, amount, currency, method, purchasedAt }
```

Aggregates (`likes`, `views`, `ratingSum`, `ratingCount`, `ratingAvg`) live on
the book document and are updated with `increment()` inside a batch or
transaction, so concurrent readers never clobber each other. Rules allow clients
to touch **only** those counter fields.

---

## Security notes

- `firestore.rules` is default-deny: anything not explicitly matched is
  rejected, including any collection you add later.
- Catalogue writes require the `staff` custom claim. Grant it with the Admin SDK:
  ```js
  await getAuth().setCustomUserClaims(uid, { staff: true });
  ```
- A user can only write rows keyed by their own uid.
- Comments are length-checked (1–2000 chars) and can only be deleted by their
  author or staff.
- `storage.rules` caps uploads at 80 MB and restricts MIME types to PDF, EPUB
  and images.

---

## Scaling notes

- **Search** currently filters client-side over the loaded page so the project
  needs **zero composite indexes**. Past a few thousand titles, point search at
  Algolia / Typesense / Elastic and keep Firestore for the data.
- **Aggregate counters** are per-document increments; Firestore sustains roughly
  one write per second per document. For a hot book, move the counter to a
  sharded-counter pattern or a Cloud Function.
- **Comments** stream the newest 100 per book. Add pagination with
  `startAfter()` when you need more.
- **Pagination** on the grid uses `orderBy` + `startAfter`; only single-field
  indexes are required, which Firestore creates automatically.

---

## Licence

MIT — see `LICENSE`. The bundled sample catalogue is public domain.

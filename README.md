# PageUp

A freemium online reading platform — browse a YouTube-style grid of books, read free previews instantly in the browser, then unlock the ones you love with a one-time payment.

Built as a static site (HTML + CSS + vanilla ES modules) on **Firebase** (Auth, Firestore, Storage, Hosting). No build step, no framework, no bundler — clone it, add your Firebase config, deploy.

---

## What is in the box

| Feature | Where |
|---|---|
| Video-style responsive grid: fixed column counts per breakpoint, staggered entrance, hover overlay | `index.html`, `assets/js/cards.js` |
| Search, category chips, five sort orders, scroll loading with skeletons and a spinner | `assets/js/app.js` |
| 5-star rating (one vote per reader, aggregate kept in a transaction) | `assets/js/data.js` |
| Comments everywhere: write one straight from a grid card, an always-visible review panel on the book page, and a slide-over drawer from the reader | `assets/js/comments.js`, `assets/js/cards.js` |
| Like button + share (Web Share API with clipboard fallback) | `assets/js/cards.js`, `assets/js/ui.js` |
| Online reader — **EPUB** (epub.js), **PDF** (pdf.js), plus a text fallback | `assets/js/reader.js` |
| Freemium gating: free preview pages, unlock modal, paywall at the limit | `assets/js/book.js` |
| Auth: Google + email/password, password reset, persistent session | `assets/js/ui.js` |
| My Library: continue reading, liked, unlocked | `library.html` |
| Ad-style launch banner: 7 slides, auto-advance, arrows, dots, swipe, keyboard | `assets/js/banner.js` |
| Zoho-style design language in blue & white: #226DB4 accent, top bar + left nav rail, flat white panels | `assets/css/styles.css`, `assets/js/ui.js` |
| Motion: content slides in on every route change, cards rise in staggered | `assets/css/styles.css`, `assets/js/ui.js` |
| Lazy cover loading via IntersectionObserver, with fade-in | `assets/js/util.js`, `assets/js/cards.js` |
| Light / dark theme, offline-first Firestore cache | `assets/css/styles.css`, `assets/js/firebase.js` |
| Security rules for Firestore and Storage | `firestore.rules`, `storage.rules` |
| Sample catalogue seeder (Admin SDK) | `seed/` |
| CI: deploy to Firebase Hosting on push to `main` | `.github/workflows/deploy.yml` |
| One-file interactive preview (no server, no Firebase) | `preview.html` |

**Preview mode.** Until you paste a real Firebase config, the site runs entirely offline against the bundled public-domain catalogue in `assets/js/demo-data.js`. Every screen works — likes, ratings, comments and previews persist in `localStorage` — so you can review the product before touching Firebase.

---

## Design language

Zoho's layout system in a **blue and white** palette: `#226DB4` as the accent,
a fixed top bar with a left navigation rail, flat white panels on a cool grey
canvas (`#f5f7fa`), 6-8px corner radii, hairline `#e1e6ec` borders and an 8pt
spacing grid. Deep navy `#0f3355` marks premium, and generated book covers are
constrained to the blue family so a full shelf still reads as one palette.

Two accents sit outside the blue: rating stars (`--star`, blue by default —
flip it to `#f0a500` for the conventional amber) and `--danger` red for errors
and destructive actions only.

All of it lives in design tokens at the top of `assets/css/styles.css`, so
re-theming is a matter of editing that one block.

## The launch banner

`assets/js/banner.js` renders up to 7 slides of featured titles as an
ad-style carousel above the catalogue:

- slides sit in a flex track moved by `transform`, so the transition is
  GPU-composited
- auto-advance every 6s with a progress bar, **paused on hover, focus and
  when the tab is hidden**
- prev/next arrows, clickable dots, a slide counter, swipe (pointer events)
  and ArrowLeft/ArrowRight when focused
- off-screen slides are `aria-hidden` and removed from the tab order
- disabled entirely under `prefers-reduced-motion`

Slides come from `store.listFeatured(7)`: books flagged `featured: true`,
falling back to the newest titles so the banner is never empty on a fresh
install. Flag a book in the console or the seeder with:

```jsonc
{ "featured": true }
```

## Motion, loading and commenting

- **Slide-in transitions.** `renderShell()` calls `enterView()`, which replays a
  `slideInRight` animation on the content pane on every page load. In the
  single-file preview the same animation replays on each hash-route change.
- **Staggered cards.** Each card carries `--i`, its index in the batch, and
  `slideInUp` is delayed by `calc(var(--i) * 28ms)`. The animation uses
  `fill-mode: backwards` so the hover lift still works once it finishes.
- **Lazy covers.** `bookThumb()` ships `data-src` and `activateLazyImages()`
  swaps in the real `src` 400px before the image enters the viewport, then
  fades it in. A failed load falls back to the generated gradient cover.
- **Scroll loading.** An `IntersectionObserver` on `#loadSentinel` pulls the
  next page in ~700px early. The grid shows skeleton cards on first load and a
  spinner while paging, then either a "Load more" button or an end-of-list note.
- **Quick comment.** The comment button on any card opens an inline textarea in
  the overlay — type and post without leaving the grid. The card's footer
  comment count opens the full thread instead. `Cmd/Ctrl + Enter` posts.
- **Reduced motion.** Everything above collapses to instant when the OS asks
  for `prefers-reduced-motion: reduce`.

---

## Look at it first: `preview.html`

One self-contained file. Double-click it — no server, no build, no Firebase,
no network. It inlines the real stylesheet, the real card component and the
public-domain sample catalogue, then runs the whole UX against `localStorage`:

- the grid with search, category chips, sort and the like/share buttons
- the book detail page, including the premium gate and the unlock modal
- the reader with page turning and the paywall at the end of the free sample
- comments (post, like, delete), ratings, light/dark theme

Good for reviewing the design, demoing to someone, or sanity-checking a change.
Rebuild it after editing the real source with:

```bash
python3 tools/build-preview.py     # writes preview.html
```

It is a preview, not the product: there is no auth, nothing is shared between
devices, and no money moves. Everything below is the real thing.

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
├── preview.html            # generated: single-file offline preview
├── 404.html
├── tools/
│   ├── preview-app.js      # controller for the single-file preview
│   └── build-preview.py    # inlines css + js + demo data into preview.html
├── assets/
│   ├── css/styles.css      # design tokens, components, light + dark
│   └── js/
│       ├── firebase-config.js   ← edit this first
│       ├── firebase.js          # SDK bootstrap + offline cache
│       ├── data.js              # Firestore reads/writes
│       ├── store.js             # facade: Firestore  or  offline demo
│       ├── demo-data.js         # public-domain sample catalogue
│       ├── ui.js                # shell (top bar + sidebar), theme, auth, share
│       ├── comments.js          # shared composer, list, drawer
│       ├── cards.js             # book card component
│       ├── banner.js            # launch-banner carousel
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

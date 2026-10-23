/* PageUp — Firestore data access layer
   All reads/writes for books, likes, ratings and comments live here so the
   view code stays free of SDK details. */
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
  query, where, orderBy, limit as fbLimit, startAfter, serverTimestamp,
  onSnapshot, increment, writeBatch, runTransaction,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { db, COLLECTIONS } from "./firebase.js";

const booksCol = () => collection(db, COLLECTIONS.books);
const bookDoc  = (id) => doc(db, COLLECTIONS.books, id);

/* ------------------------------------------------------------------ Books */

/**
 * List books for the home grid.
 * Category + text search are filtered client-side so the project needs
 * NO composite indexes. Sorting is a single-field orderBy.
 * For very large catalogues, swap the search path for a search service.
 */
export async function listBooks({
  sort = 'trending', category = 'all', search = '', pageSize = 24, cursor = null,
} = {}) {
  const orderField =
    sort === 'newest'  ? 'createdAt' :
    sort === 'rating'  ? 'ratingAvg' :
    sort === 'views'   ? 'views' :
    sort === 'likes'   ? 'likes' : 'trendScore';

  const clauses = [orderBy(orderField, 'desc')];
  if (cursor) clauses.push(startAfter(cursor));
  clauses.push(fbLimit(pageSize));

  const snap = await getDocs(query(booksCol(), ...clauses));
  const last = snap.docs[snap.docs.length - 1] || null;

  let items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (category && category !== 'all') {
    items = items.filter((b) => (b.category || '').toLowerCase() === category.toLowerCase());
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((b) =>
      (b.title || '').toLowerCase().includes(q) ||
      (b.author || '').toLowerCase().includes(q) ||
      (b.tags || []).some((t) => String(t).toLowerCase().includes(q)) ||
      (b.searchTerms || []).some((t) => String(t).includes(q)));
  }
  return { items, cursor: last, hasMore: snap.size === pageSize };
}

export async function getBook(id) {
  const snap = await getDoc(bookDoc(id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function subscribeBook(id, cb) {
  return onSnapshot(bookDoc(id), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

/** Fire-and-forget view counter. */
export function registerView(id) {
  const key = `pageup:viewed:${id}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch {}
  updateDoc(bookDoc(id), { views: increment(1) }).catch(() => {});
}

/**
 * Slides for the launch banner: books flagged `featured`, newest first.
 * Falls back to the newest titles when nothing is flagged, so the banner is
 * never empty on a fresh install.
 */
export async function listFeatured(limitCount = 7) {
  try {
    const snap = await getDocs(query(booksCol(), where('featured', '==', true), fbLimit(limitCount)));
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (items.length >= 3) return items.sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0));
  } catch (err) {
    console.warn('featured query failed, falling back to newest', err);
  }
  const { items } = await listBooks({ sort: 'newest', pageSize: limitCount });
  return items;
}

export async function getCategories() {
  const snap = await getDocs(query(booksCol(), orderBy('trendScore', 'desc'), fbLimit(200)));
  const set = new Map();
  snap.docs.forEach((d) => {
    const c = d.data().category;
    if (c) set.set(c, (set.get(c) || 0) + 1);
  });
  return [...set.entries()].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

/* ------------------------------------------------------------------- Likes */

export async function isLiked(bookId, uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, COLLECTIONS.books, bookId, COLLECTIONS.likes, uid));
  return snap.exists();
}

/** Returns the new liked state (true = liked). */
export async function toggleLike(bookId, uid) {
  const likeRef = doc(db, COLLECTIONS.books, bookId, COLLECTIONS.likes, uid);
  const existing = await getDoc(likeRef);
  const batch = writeBatch(db);
  if (existing.exists()) {
    batch.delete(likeRef);
    batch.update(bookDoc(bookId), { likes: increment(-1) });
  } else {
    batch.set(likeRef, { uid, createdAt: serverTimestamp() });
    batch.update(bookDoc(bookId), { likes: increment(1) });
  }
  await batch.commit();
  return !existing.exists();
}

export async function getMyLikes(uid, bookIds) {
  if (!uid) return new Set();
  const checks = await Promise.all(bookIds.map(async (id) => {
    const s = await getDoc(doc(db, COLLECTIONS.books, id, COLLECTIONS.likes, uid));
    return s.exists() ? id : null;
  }));
  return new Set(checks.filter(Boolean));
}

/* ----------------------------------------------------------------- Ratings */

export async function getMyRating(bookId, uid) {
  if (!uid) return 0;
  const snap = await getDoc(doc(db, COLLECTIONS.books, bookId, COLLECTIONS.ratings, uid));
  return snap.exists() ? (snap.data().value || 0) : 0;
}

/** Upsert the user's rating and keep the book aggregate consistent. */
export async function rateBook(bookId, uid, value) {
  const ratingRef = doc(db, COLLECTIONS.books, bookId, COLLECTIONS.ratings, uid);
  const bookRef = bookDoc(bookId);
  await runTransaction(db, async (tx) => {
    const [bookSnap, ratingSnap] = await Promise.all([tx.get(bookRef), tx.get(ratingRef)]);
    if (!bookSnap.exists()) throw new Error('Book not found');
    const book = bookSnap.data();
    const prev = ratingSnap.exists() ? (ratingSnap.data().value || 0) : 0;
    const sum = (book.ratingSum || 0) - prev + value;
    const count = (book.ratingCount || 0) + (ratingSnap.exists() ? 0 : 1);
    tx.set(ratingRef, { uid, value, updatedAt: serverTimestamp() }, { merge: true });
    tx.update(bookRef, {
      ratingSum: sum,
      ratingCount: count,
      ratingAvg: count ? +(sum / count).toFixed(2) : 0,
    });
  });
}

/* ---------------------------------------------------------------- Comments */

export function subscribeComments(bookId, cb) {
  const q = query(
    collection(db, COLLECTIONS.books, bookId, COLLECTIONS.comments),
    orderBy('createdAt', 'desc'),
    fbLimit(100),
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, (err) => { console.warn('comments stream', err); cb([]); });
}

export async function addComment(bookId, user, text) {
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) throw new Error('Comment is empty');
  const ref = doc(collection(db, COLLECTIONS.books, bookId, COLLECTIONS.comments));
  const batch = writeBatch(db);
  batch.set(ref, {
    uid: user.uid,
    name: user.displayName || user.email?.split('@')[0] || 'Reader',
    photoURL: user.photoURL || '',
    text: clean,
    likes: 0,
    createdAt: serverTimestamp(),
  });
  // Keep the denormalised counter on the book in step, so the grid can show
  // a comment count without reading every comment subcollection.
  batch.update(bookDoc(bookId), { commentCount: increment(1) });
  await batch.commit();
  return ref.id;
}

export async function deleteComment(bookId, commentId) {
  const batch = writeBatch(db);
  batch.delete(doc(db, COLLECTIONS.books, bookId, COLLECTIONS.comments, commentId));
  batch.update(bookDoc(bookId), { commentCount: increment(-1) });
  await batch.commit();
}

export async function toggleCommentLike(bookId, commentId, uid) {
  const likeRef = doc(db, COLLECTIONS.books, bookId, COLLECTIONS.comments, commentId, COLLECTIONS.likes, uid);
  const commentRef = doc(db, COLLECTIONS.books, bookId, COLLECTIONS.comments, commentId);
  const existing = await getDoc(likeRef);
  const batch = writeBatch(db);
  if (existing.exists()) {
    batch.delete(likeRef);
    batch.update(commentRef, { likes: increment(-1) });
  } else {
    batch.set(likeRef, { uid, createdAt: serverTimestamp() });
    batch.update(commentRef, { likes: increment(1) });
  }
  await batch.commit();
  return !existing.exists();
}

/* ------------------------------------------------------------------- Users */

export async function ensureUserProfile(user) {
  const ref = doc(db, COLLECTIONS.users, user.uid);
  const snap = await getDoc(ref);
  const base = {
    displayName: user.displayName || user.email?.split('@')[0] || 'Reader',
    email: user.email || '',
    photoURL: user.photoURL || '',
    lastSeen: serverTimestamp(),
  };
  if (!snap.exists()) {
    await setDoc(ref, { ...base, isPremium: false, plan: 'free', createdAt: serverTimestamp() });
    return { isPremium: false, plan: 'free', ...base };
  }
  await setDoc(ref, base, { merge: true });
  return { ...snap.data(), ...base };
}

export function subscribeProfile(uid, cb) {
  return onSnapshot(doc(db, COLLECTIONS.users, uid), (snap) => {
    cb(snap.exists() ? snap.data() : null);
  }, () => cb(null));
}

/* -------------------------------------------------------- Premium unlocks */

export async function isUnlocked(bookId, uid) {
  if (!uid) return false;
  const snap = await getDoc(doc(db, COLLECTIONS.users, uid, 'purchases', bookId));
  return snap.exists();
}

/** Records a purchase. In production this must be written by a Cloud
 *  Function after the payment gateway webhook verifies the signature —
 *  the client should never grant itself entitlements. */
export async function recordPurchase(bookId, uid, meta = {}) {
  await setDoc(doc(db, COLLECTIONS.users, uid, 'purchases', bookId), {
    bookId, uid, ...meta, purchasedAt: serverTimestamp(),
  });
}

export async function subscribeUnlocked(uid, cb) {
  if (!uid) { cb(new Set()); return () => {}; }
  return onSnapshot(collection(db, COLLECTIONS.users, uid, 'purchases'), (snap) => {
    cb(new Set(snap.docs.map((d) => d.id)));
  }, () => cb(new Set()));
}

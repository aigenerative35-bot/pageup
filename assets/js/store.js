/* PageUp — store facade.
   One API for the whole app. When Firebase is configured it talks to
   Firestore; otherwise it runs against the bundled demo catalogue with
   local-only persistence so every screen is still fully interactive. */
import { isConfigured } from './firebase.js';
import * as data from './data.js';
import { DEMO_BOOKS, DEMO_CATEGORIES } from './demo-data.js';

export const DEMO = !isConfigured;
export const mode = DEMO ? 'demo' : 'live';

/* ----------------------------------------------------- demo persistence */
const LS_KEY = 'pageup:demo:state';
const emptyState = () => ({ likes: {}, ratings: {}, comments: {}, purchases: {}, books: {} });
let state = emptyState();
try { state = { ...emptyState(), ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; } catch {}
const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {} };

const DEMO_SEED_COMMENTS = [
  { name: 'Ananya Rao', text: 'Finished this in two sittings. The pacing in the middle chapters is superb.', likes: 24, hoursAgo: 30 },
  { name: 'Vikram Shah', text: 'The annotations in this edition really help if you are reading it for the first time.', likes: 11, hoursAgo: 74 },
  { name: 'Priya Menon', text: 'Read it on the train every morning. Highly recommend the EPUB version for the typography.', likes: 6, hoursAgo: 210 },
];
function seedComments(bookId) {
  return DEMO_SEED_COMMENTS.map((c, i) => ({
    id: `seed-${bookId}-${i}`,
    uid: `seed-${i}`,
    name: c.name,
    photoURL: '',
    text: c.text,
    likes: c.likes,
    createdAt: new Date(Date.now() - c.hoursAgo * 3600 * 1000),
    __seed: true,
  }));
}

function currentUid() {
  if (!DEMO) return window.__pageup_uid || null;
  return window.__pageup_uid || 'guest';
}
export function setUid(uid) { window.__pageup_uid = uid; }

/* ----------------------------------------------------------------- Books */

export async function listBooks(opts = {}) {
  if (!DEMO) return data.listBooks(opts);
  const { sort = 'trending', category = 'all', search = '', pageSize = 24, page = 0 } = opts;
  let items = baseBooks().map((b) => {
    const local = state.books[b.id] || {};
    return {
      ...b, ...local,
      likes: (b.likes || 0) + (local.likesDelta || 0),
      commentCount: demoCommentCount(b.id),
      ...aggFrom(b.id, b),
    };
  });
  if (category && category !== 'all') {
    items = items.filter((b) => b.category.toLowerCase() === category.toLowerCase());
  }
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    items = items.filter((b) =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      (b.tags || []).some((t) => t.toLowerCase().includes(q)));
  }
  if (sort === 'title') {
    items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));
  } else {
    const key = { newest: (b) => -(b.publishedYear || 0), rating: (b) => b.ratingAvg, views: (b) => b.views, likes: (b) => b.likes, trending: (b) => b.trendScore }[sort] || ((b) => b.trendScore);
    items.sort((a, b) => key(b) - key(a));
  }
  const start = page * pageSize;
  return { items: items.slice(start, start + pageSize), cursor: null, hasMore: start + pageSize < items.length };
}

/** Seeded catalogue plus anything added from the admin panel in preview mode. */
function baseBooks() {
  return DEMO_BOOKS.concat(state.customBooks || [])
    .map((b) => ({ ...b, ...((state.edits || {})[b.id] || {}) }));
}

function bookById(id) {
  return baseBooks().find((b) => b.id === id) || null;
}

/* Three seeded sample comments per title, plus anything posted locally. */
function demoCommentCount(bookId) {
  return 3 + (state.comments[bookId] || []).length;
}

function aggFrom(bookId, base) {
  const r = state.ratings[bookId] || {};
  const values = Object.values(r);
  if (!values.length) return { ratingSum: base.ratingSum, ratingCount: base.ratingCount, ratingAvg: base.ratingAvg };
  const sum = (base.ratingSum || 0) + values.reduce((a, v) => a + v, 0);
  const count = (base.ratingCount || 0) + values.length;
  return { ratingSum: sum, ratingCount: count, ratingAvg: +(sum / count).toFixed(2) };
}

export async function getBook(id) {
  if (!DEMO) return data.getBook(id);
  const base = bookById(id);
  if (!base) return null;
  const local = state.books[id] || {};
  return {
    ...base, ...local,
    likes: (base.likes || 0) + (local.likesDelta || 0),
    commentCount: demoCommentCount(id),
    ...aggFrom(id, base),
  };
}

export function subscribeBook(id, cb) {
  if (!DEMO) return data.subscribeBook(id, cb);
  getBook(id).then(cb);
  return () => {};
}

export function registerView(id) {
  if (!DEMO) return data.registerView(id);
  const b = state.books[id] || (state.books[id] = {});
  b.viewsDelta = (b.viewsDelta || 0) + 1;
  save();
}

export async function listFeatured(limitCount = 7) {
  if (!DEMO) return data.listFeatured(limitCount);
  const merged = baseBooks().map((b) => {
    const local = state.books[b.id] || {};
    return {
      ...b, ...local,
      likes: (b.likes || 0) + (local.likesDelta || 0),
      commentCount: demoCommentCount(b.id),
      ...aggFrom(b.id, b),
    };
  });
  const flagged = merged.filter((b) => b.featured);
  const pool = flagged.length >= 3
    ? flagged
    : merged.slice().sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0));
  return pool.slice(0, limitCount);
}

export async function getCategories() {
  if (!DEMO) return data.getCategories();
  const counts = new Map();
  baseBooks().forEach((b) => counts.set(b.category, (counts.get(b.category) || 0) + 1));
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export const demoCategories = DEMO_CATEGORIES;

/* ----------------------------------------------------------------- Likes */

export async function isLiked(bookId, uid) {
  if (!DEMO) return data.isLiked(bookId, uid);
  return !!(state.likes[bookId] || {})[uid];
}

export async function toggleLike(bookId, uid) {
  if (!DEMO) return data.toggleLike(bookId, uid);
  const forBook = state.likes[bookId] || (state.likes[bookId] = {});
  const b = state.books[bookId] || (state.books[bookId] = {});
  if (forBook[uid]) { delete forBook[uid]; b.likesDelta = (b.likesDelta || 0) - 1; }
  else { forBook[uid] = true; b.likesDelta = (b.likesDelta || 0) + 1; }
  save();
  return !!forBook[uid];
}

export async function getMyLikes(uid, bookIds) {
  if (!DEMO) return data.getMyLikes(uid, bookIds);
  const set = new Set();
  bookIds.forEach((id) => { if ((state.likes[id] || {})[uid]) set.add(id); });
  return set;
}

/* --------------------------------------------------------------- Ratings */

export async function getMyRating(bookId, uid) {
  if (!DEMO) return data.getMyRating(bookId, uid);
  return (state.ratings[bookId] || {})[uid] || 0;
}

export async function rateBook(bookId, uid, value) {
  if (!DEMO) return data.rateBook(bookId, uid, value);
  const forBook = state.ratings[bookId] || (state.ratings[bookId] = {});
  forBook[uid] = value;
  save();
  return value;
}

/* -------------------------------------------------------------- Comments */

/* Demo mode has no Firestore snapshots, so keep a tiny pub/sub of our own:
   every mutation below re-emits to whoever is listening for that book. */
const commentSubs = new Map();

function commentLikesFor(bookId, commentId) {
  return Object.keys((state.commentLikes || {})[`${bookId}:${commentId}`] || {}).length;
}

function demoComments(bookId) {
  const userComments = state.comments[bookId] || [];
  return [...userComments.map((c) => ({ ...c, createdAt: new Date(c.createdAt) })),
          ...seedComments(bookId)]
    .map((c) => ({ ...c, likes: (c.likes || 0) + commentLikesFor(bookId, c.id) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function emitComments(bookId) {
  const subs = commentSubs.get(bookId);
  if (!subs || !subs.size) return;
  const all = demoComments(bookId);
  subs.forEach((cb) => { try { cb(all); } catch (e) { console.error(e); } });
}

export function subscribeComments(bookId, cb) {
  if (!DEMO) return data.subscribeComments(bookId, cb);
  let subs = commentSubs.get(bookId);
  if (!subs) { subs = new Set(); commentSubs.set(bookId, subs); }
  subs.add(cb);
  cb(demoComments(bookId));
  return () => { subs.delete(cb); if (!subs.size) commentSubs.delete(bookId); };
}

export async function addComment(bookId, user, text) {
  if (!DEMO) return data.addComment(bookId, user, text);
  const clean = String(text || '').trim().slice(0, 2000);
  if (!clean) throw new Error('Comment is empty');
  const list = state.comments[bookId] || (state.comments[bookId] = []);
  const item = {
    id: `c-${Date.now()}`,
    uid: user.uid, name: user.displayName || user.email?.split('@')[0] || 'Reader',
    photoURL: user.photoURL || '', text: clean, likes: 0,
    createdAt: new Date().toISOString(),
  };
  list.unshift(item);
  save();
  emitComments(bookId);
  return item;
}

export async function deleteComment(bookId, commentId) {
  if (!DEMO) return data.deleteComment(bookId, commentId);
  state.comments[bookId] = (state.comments[bookId] || []).filter((c) => c.id !== commentId);
  save();
  emitComments(bookId);
}

export async function toggleCommentLike(bookId, commentId, uid) {
  if (!DEMO) return data.toggleCommentLike(bookId, commentId, uid);
  state.commentLikes = state.commentLikes || {};
  const key = `${bookId}:${commentId}`;
  const set = state.commentLikes[key] = state.commentLikes[key] || {};
  if (set[uid]) delete set[uid]; else set[uid] = true;
  save();
  emitComments(bookId);
  return !!set[uid];
}

export async function isCommentLiked(bookId, commentId, uid) {
  if (!DEMO) {
    const { getDoc, doc } = await import('https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js');
    const { db, COLLECTIONS } = await import('./firebase.js');
    const snap = await getDoc(doc(db, COLLECTIONS.books, bookId, COLLECTIONS.comments, commentId, COLLECTIONS.likes, uid));
    return snap.exists();
  }
  return !!(state.commentLikes?.[`${bookId}:${commentId}`] || {})[uid];
}

/* --------------------------------------------------------------- Premium */

export async function isUnlocked(bookId, uid) {
  if (!DEMO) return data.isUnlocked(bookId, uid);
  return !!(state.purchases[bookId] || {})[uid];
}

export async function recordPurchase(bookId, uid, meta = {}) {
  if (!DEMO) return data.recordPurchase(bookId, uid, meta);
  const p = state.purchases[bookId] || (state.purchases[bookId] = {});
  p[uid] = { ...meta, purchasedAt: new Date().toISOString() };
  save();
}

export function subscribeUnlocked(uid, cb) {
  if (!DEMO) return data.subscribeUnlocked(uid, cb);
  const set = new Set(Object.keys(state.purchases).filter((b) => (state.purchases[b] || {})[uid]));
  cb(set);
  return () => {};
}

/* ------------------------------------------------------- progress (local) */
const PROGRESS_KEY = 'pageup:progress';
export function saveProgress(bookId, payload) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    all[bookId] = { ...payload, at: Date.now() };
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {}
}
export function getProgress(bookId) {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}')[bookId] || null; } catch { return null; }
}
export function getAllProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { return {}; }
}

/* ==========================================================================
   Admin — preview-mode equivalents
   In preview mode there is no server, so writes land in localStorage. The
   admin UI says so on screen; connect Firebase and the same calls hit
   Firestore and Storage instead.
   ========================================================================== */

function readAsDataURL(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = (e) => { if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100)); };
    reader.onload = () => { onProgress?.(100); resolve(String(reader.result)); };
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

export async function createBook(id, input) {
  if (!DEMO) return data.createBook(id, input);
  const book = data.normalizeBook(input);
  book.id = id || `local-${Date.now().toString(36)}`;
  book.createdAt = new Date().toISOString();
  Object.assign(book, { views: 0, likes: 0, commentCount: 0, ratingSum: 0, ratingCount: 0, ratingAvg: 0, trendScore: 0 });
  state.customBooks = state.customBooks || [];
  state.customBooks.unshift(book);
  save();
  return book.id;
}

export async function updateBook(id, input) {
  if (!DEMO) return data.updateBook(id, input);
  const book = data.normalizeBook(input);
  state.edits = state.edits || {};
  const isCustom = (state.customBooks || []).some((b) => b.id === id);
  if (isCustom) {
    state.customBooks = state.customBooks.map((b) => (b.id === id ? { ...b, ...book } : b));
  } else {
    state.edits[id] = { ...(state.edits[id] || {}), ...book };
  }
  save();
  return id;
}

export async function removeBook(id) {
  if (!DEMO) return data.removeBook(id);
  state.customBooks = (state.customBooks || []).filter((b) => b.id !== id);
  if (state.edits) delete state.edits[id];
  save();
}

export async function uploadAsset(kind, bookId, file, onProgress) {
  if (!DEMO) return data.uploadAsset(kind, bookId, file, onProgress);
  if (kind === 'cover') {
    if (file.size > 400 * 1024) {
      throw new Error('Preview mode stores covers under 400 KB. Connect Firebase for full-size uploads.');
    }
    return { url: await readAsDataURL(file, onProgress), path: '' };
  }
  // Book files can be large; keep them in memory for this session only.
  onProgress?.(100);
  return { url: URL.createObjectURL(file), path: '' };
}

export async function removeAsset() { /* nothing is stored in preview mode */ }

export async function adminStats() {
  const { items } = await listBooks({ sort: 'title', pageSize: 500 });
  return {
    books: items.length,
    premium: items.filter((b) => b.isPremium).length,
    free: items.filter((b) => !b.isPremium).length,
    featured: items.filter((b) => b.featured).length,
    reads: items.reduce((a, b) => a + (b.views || 0), 0),
    likes: items.reduce((a, b) => a + (b.likes || 0), 0),
    comments: items.reduce((a, b) => a + (b.commentCount || 0), 0),
  };
}

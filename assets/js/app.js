/* PageUp — home page controller (catalogue grid, filters, search, likes, comments) */
import {
  renderShell, initAuth, onSession, shareBook, requireAuth, actorId,
  toast, $, el, icon, escapeHtml,
} from './ui.js';
import { openCommentsDrawer } from './comments.js';
import * as store from './store.js';
import { renderBookCard, skeletonCard } from './cards.js';
import { debounce } from './util.js';

const state = {
  sort: 'trending',
  category: 'all',
  search: '',
  page: 0,
  pageSize: 24,
  items: [],
  hasMore: true,
  loading: false,
  liked: new Set(),
};

async function boot() {
  renderShell();
  await initAuth();
  store.setUid(actorId());

  onSession(() => { store.setUid(actorId()); refreshLikes(); });

  const params = new URLSearchParams(location.search);
  state.search = params.get('q') || '';
  if (params.get('sort')) state.sort = params.get('sort');
  if (params.get('cat')) state.category = params.get('cat');

  paintChips();
  await refreshCategories();
  wireControls();

  const searchInput = $('#searchInput');
  if (searchInput) searchInput.addEventListener('input', () => runSearch(searchInput.value.trim()));

  await load(true);
  await loadStats();
}

/* ------------------------------------------------------------- Controls */
function wireControls() {
  const sel = $('#sortSelect');
  if (sel) { sel.value = state.sort; sel.addEventListener('change', (e) => { state.sort = e.target.value; load(true); }); }

  const sentinel = $('#loadSentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && state.hasMore && !state.loading) load(false);
    }, { rootMargin: '600px' }).observe(sentinel);
  }
  $('#loadMore')?.addEventListener('click', () => load(false));
}

function paintChips() {
  const host = $('#chipbar');
  if (!host) return;
  host.innerHTML = '';
  const cats = [{ name: 'all', label: 'All books' }, ...store.demoCategories.map((c) => ({ name: c, label: c }))];
  cats.forEach((c) => {
    const btn = el('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(state.category === c.name),
      text: c.label,
    });
    btn.addEventListener('click', () => {
      state.category = c.name;
      const params = new URLSearchParams();
      if (state.search) params.set('q', state.search);
      if (state.sort !== 'trending') params.set('sort', state.sort);
      if (c.name !== 'all') params.set('cat', c.name);
      const qs = params.toString();
      history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
      paintChips();
      load(true);
    });
    host.append(btn);
  });
}

async function refreshCategories() {
  if (store.DEMO) return;
  try {
    const cats = await store.getCategories();
    if (cats.length) { store.demoCategories.length = 0; cats.forEach((c) => store.demoCategories.push(c.name)); }
    paintChips();
  } catch {}
}

/* ----------------------------------------------------------------- Load */
async function load(reset) {
  if (state.loading) return;
  state.loading = true;
  const grid = $('#bookGrid');

  if (reset) {
    state.page = 0;
    state.items = [];
    state.hasMore = true;
    grid.innerHTML = '';
    for (let i = 0; i < 8; i++) grid.append(skeletonCard());
    $('#loadMoreWrap')?.classList.add('hidden');
  } else {
    $('#loadMore')?.setAttribute('disabled', '');
  }

  try {
    const res = await store.listBooks({
      sort: state.sort, category: state.category, search: state.search,
      pageSize: state.pageSize, page: state.page,
    });
    if (reset) grid.innerHTML = '';
    state.items.push(...res.items);
    state.hasMore = res.hasMore;
    state.page += 1;
    await refreshLikes();
    renderGrid(res.items);
    renderResultMeta();
  } catch (err) {
    console.error(err);
    if (reset) grid.innerHTML = '';
    grid.append(emptyState('Could not load books', err?.message || 'Check your connection and Firebase rules, then reload.'));
  } finally {
    state.loading = false;
    $('#loadMore')?.removeAttribute('disabled');
    $('#loadMoreWrap')?.classList.toggle('hidden', !state.hasMore);
  }
}

function renderGrid(items) {
  const grid = $('#bookGrid');
  items.forEach((book) => {
    grid.append(renderBookCard(book, {
      liked: state.liked.has(book.id),
      unlocked: false,
      onLike: handleLike,
      onComment: handleComment,
      onShare: shareBook,
    }));
  });
}

async function refreshLikes() {
  const uid = actorId();
  if (!uid) { state.liked = new Set(); return; }
  const ids = state.items.map((b) => b.id);
  if (!ids.length) return;
  try {
    state.liked = await store.getMyLikes(uid, ids);
    document.querySelectorAll('.card').forEach((card) => {
      const isLiked = state.liked.has(card.dataset.id);
      const btn = card.querySelector('.overlay-btn[aria-pressed]');
      if (!btn) return;
      btn.setAttribute('aria-pressed', String(isLiked));
      btn.firstElementChild.innerHTML = isLiked ? icon('heartF') : icon('heart');
    });
  } catch {}
}

async function handleLike(book, btn) {
  if (!requireAuth('like books')) return;
  const uid = actorId();
  try {
    const nowLiked = await store.toggleLike(book.id, uid);
    if (nowLiked) state.liked.add(book.id); else state.liked.delete(book.id);
    btn.setAttribute('aria-pressed', String(nowLiked));
    btn.firstElementChild.innerHTML = nowLiked ? icon('heartF') : icon('heart');
    const counter = btn.querySelector('.js-like-count');
    if (counter) {
      const n = (Number(String(counter.textContent).replace(/[^\d]/g, '')) || 0) + (nowLiked ? 1 : -1);
      counter.textContent = String(Math.max(0, n));
    }
    toast(nowLiked ? 'Added to your likes' : 'Removed from likes', nowLiked ? 'success' : 'info', 1800);
  } catch (err) { console.error(err); toast('Could not update like', 'error'); }
}

/** Comments open in a slide-over so the reader never loses their place. */
function handleComment(book) {
  openCommentsDrawer(book, {
    onCount: (n) => {
      document.querySelectorAll(`.card[data-id="${CSS.escape(book.id)}"] .js-comment-count`)
        .forEach((node) => { node.textContent = String(n); });
    },
  });
}

function renderResultMeta() {
  const host = $('#resultMeta');
  if (!host) return;
  const n = state.items.length;
  const bits = [`${n} book${n === 1 ? '' : 's'}`];
  if (state.search) bits.push(`for \u201C${state.search}\u201D`);
  if (state.category !== 'all') bits.push(`in ${state.category}`);
  host.textContent = bits.join(' ');
  host.classList.toggle('hidden', n === 0 && !state.search);
}

function emptyState(title, msg) {
  return el('div', { class: 'empty', html: `
    ${icon('search')}
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(msg || '')}</p>` });
}

async function loadStats() {
  try {
    const { items } = await store.listBooks({ sort: 'trending', pageSize: 200 });
    const set = (id, v) => { const n = document.getElementById(id); if (n) n.textContent = v; };
    const reads = items.reduce((a, b) => a + (b.views || 0), 0);
    const comments = items.reduce((a, b) => a + (b.commentCount || 0), 0);
    set('statBooks', items.length ? String(items.length) : '\u2014');
    set('statReaders', reads ? compact(reads) : '\u2014');
    set('statFree', String(items.filter((b) => !b.isPremium).length || '\u2014'));
    set('statComments', comments ? compact(comments) : '\u2014');
  } catch {}
}
const compact = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n);

/* --------------------------------------------------------------- Search */
const runSearch = debounce((value) => {
  state.search = value;
  load(true);
}, 420);

document.addEventListener('DOMContentLoaded', boot);

export { state };

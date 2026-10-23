/* PageUp — My library: continue reading, liked, unlocked */
import { renderHeader, initAuth, onSession, shareBook, requireAuth, actorId, $, el, icon, escapeHtml } from './ui.js';
import * as store from './store.js';
import { renderBookCard } from './cards.js';

const state = { catalog: [], liked: new Set(), owned: new Set() };

async function boot() {
  renderHeader();
  await initAuth();
  store.setUid(actorId());

  const { items } = await store.listBooks({ sort: 'trending', pageSize: 200 });
  state.catalog = items;

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      ['continue', 'liked', 'owned'].forEach((p) => {
        document.getElementById(`panel-${p}`).classList.toggle('hidden', p !== tab.dataset.panel);
      });
    });
  });

  onSession(() => { store.setUid(actorId()); paint(); });
  paint();
}

async function paint() {
  const uid = actorId();
  if (uid) {
    try { state.liked = await store.getMyLikes(uid, state.catalog.map((b) => b.id)); } catch { state.liked = new Set(); }
  } else {
    state.liked = new Set();
  }

  store.subscribeUnlocked(uid, (set) => { state.owned = set; paintPanels(); });
  paintPanels();
}

function paintPanels() {
  const progress = store.getAllProgress();
  const byId = Object.fromEntries(state.catalog.map((b) => [b.id, b]));

  /* Continue reading */
  const cont = Object.entries(progress)
    .map(([id, p]) => ({ book: byId[id], p }))
    .filter((x) => x.book)
    .sort((a, b) => (b.p.at || 0) - (a.p.at || 0));

  const g1 = $('#gridContinue');
  g1.innerHTML = '';
  if (!cont.length) g1.append(emptyBox('Nothing in progress', 'Open any book and PageUp will remember where you stopped.', './index.html', 'Browse the catalogue'));
  cont.forEach(({ book, p }) => g1.append(withProgress(book, p)));

  /* Liked */
  const liked = state.catalog.filter((b) => state.liked.has(b.id));
  const g2 = $('#gridLiked');
  g2.innerHTML = '';
  if (!liked.length) g2.append(emptyBox('No likes yet', 'Tap the heart on any book to keep it here.', './index.html', 'Find something to read'));
  liked.forEach((b) => g2.append(renderBookCard(b, { liked: true, onLike: onLike, onShare: shareBook })));

  /* Unlocked */
  const owned = state.catalog.filter((b) => state.owned.has(b.id));
  const g3 = $('#gridOwned');
  g3.innerHTML = '';
  if (!owned.length) g3.append(emptyBox('No premium unlocks yet', 'Unlock a premium title and it appears here forever.', './index.html?cat=Fiction', 'See premium books'));
  owned.forEach((b) => g3.append(renderBookCard(b, { liked: state.liked.has(b.id), unlocked: true, onLike: onLike, onShare: shareBook })));
}

function withProgress(book, p) {
  const total = book.pages || 100;
  const pct = Math.min(99, Math.round(((p.page || 1) / total) * 100));
  const card = renderBookCard(book, { liked: state.liked.has(book.id), unlocked: true, onLike: onLike, onShare: shareBook });
  const bar = el('div', { style: 'margin-top:8px' }, [
    el('div', { style: 'height:4px;background:var(--surface-3);border-radius:99px;overflow:hidden' }, [
      el('div', { style: `height:100%;width:${pct}%;background:var(--brand-600)` }),
    ]),
    el('div', { class: 'hint', text: `Page ${p.page || 1} of ${total} · ${pct}%` }),
  ]);
  card.querySelector('.card__body').append(bar);
  return card;
}

async function onLike(book, btn) {
  if (!requireAuth('like books')) return;
  try {
    const nowLiked = await store.toggleLike(book.id, actorId());
    if (nowLiked) state.liked.add(book.id); else state.liked.delete(book.id);
    paintPanels();
  } catch { }
}

function emptyBox(title, msg, href, cta) {
  return el('div', { class: 'empty', html: `
    ${icon('bookmark')}
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(msg)}</p>
    <a class="btn btn--primary mt-16" href="${href}">${escapeHtml(cta)}</a>` });
}

document.addEventListener('DOMContentLoaded', boot);

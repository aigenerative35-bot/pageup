/* PageUp — comments, shared by the grid, the detail page and the reader.
   One implementation of the composer, the list and the like/delete actions so
   every entry point behaves identically. */
import * as store from './store.js';
import { requireAuth, actorId, actorProfile, el, icon, escapeHtml, initials, toast, $ } from './ui.js';
import { timeAgo } from './util.js';

/* --------------------------------------------------------------- pieces */

export function composerNode(book, { onPosted, compact = false } = {}) {
  const me = actorProfile();
  const node = el('div', { class: compact ? 'row gap-12' : 'comment-composer' });

  const avatar = el('div', { class: 'avatar', html: me.photoURL
    ? `<img src="${escapeHtml(me.photoURL)}" alt="">`
    : escapeHtml(initials(me.displayName)) });

  const field = el('div', { style: 'flex:1;min-width:0' });
  const input = el('textarea', {
    class: 'textarea', rows: compact ? '2' : '3',
    placeholder: 'Write a review or ask a question about this book...',
    'aria-label': 'Write a comment',
  });
  const bar = el('div', { class: 'row gap-8 mt-8' }, [
    el('span', { class: 'hint', text: 'Be kind. Reviews are public.' }),
    el('span', { class: 'spacer' }),
  ]);
  const submit = el('button', { class: 'btn btn--primary btn--sm', type: 'button' }, [
    el('span', { html: icon('comment') }), el('span', { text: 'Post comment' }),
  ]);
  bar.append(submit);

  submit.addEventListener('click', async () => {
    if (!requireAuth('comment')) return;
    const text = input.value.trim();
    if (!text) { toast('Write something first', 'info'); input.focus(); return; }
    submit.disabled = true;
    try {
      await store.addComment(book.id, actorProfile(), text);
      input.value = '';
      toast('Comment posted', 'success');
      onPosted?.();
    } catch (err) {
      console.error(err);
      toast('Could not post comment', 'error');
    } finally {
      submit.disabled = false;
    }
  });

  field.append(input, bar);
  node.append(avatar, field);
  return node;
}

export function commentNode(book, c, { onChange } = {}) {
  const mine = actorId() && c.uid === actorId();
  const node = el('div', { class: 'comment' });
  node.append(el('div', { class: 'avatar', html: c.photoURL
    ? `<img src="${escapeHtml(c.photoURL)}" alt="">`
    : escapeHtml(initials(c.name)) }));

  const body = el('div', { class: 'comment__body' });
  body.append(el('div', { class: 'comment__head' }, [
    el('span', { class: 'comment__name', text: c.name || 'Reader' }),
    mine ? el('span', { class: 'badge badge--muted', text: 'You' }) : null,
    el('span', { class: 'comment__time', text: timeAgo(c.createdAt) }),
  ].filter(Boolean)));
  body.append(el('div', { class: 'comment__text', text: c.text }));

  const actions = el('div', { class: 'comment__actions' });

  const likeBtn = el('button', { class: 'link-btn', type: 'button', html: `${icon('heart')}<span>${c.likes || 0}</span>` });
  likeBtn.addEventListener('click', async () => {
    if (!requireAuth('like comments')) return;
    try {
      const on = await store.toggleCommentLike(book.id, c.id, actorId());
      likeBtn.classList.toggle('is-active', on);
      likeBtn.innerHTML = `${icon('heart')}<span>${Math.max(0, (c.likes || 0) + (on ? 1 : -1))}</span>`;
      onChange?.();
    } catch (err) { console.error(err); toast('Could not update', 'error'); }
  });
  actions.append(likeBtn);

  if (mine) {
    const del = el('button', { class: 'link-btn', type: 'button', html: `${icon('trash')}<span>Delete</span>` });
    del.addEventListener('click', async () => {
      try { await store.deleteComment(book.id, c.id); toast('Comment deleted', 'info'); onChange?.(); }
      catch (err) { console.error(err); toast('Could not delete', 'error'); }
    });
    actions.append(del);
  }

  body.append(actions);
  node.append(body);
  return node;
}

export function commentList(items, book, { onChange, emptyText } = {}) {
  const wrap = el('div');
  if (!items.length) {
    wrap.append(el('p', { class: 'muted small text-center', style: 'padding:32px 0',
      text: emptyText || 'No comments yet — be the first to share your thoughts.' }));
    return wrap;
  }
  items.forEach((c) => wrap.append(commentNode(book, c, { onChange })));
  return wrap;
}

/* ------------------------------------------------------- inline section */
/**
 * Renders an always-visible comments section into `host` and keeps it live.
 * @returns {() => void} unsubscribe
 */
export function mountCommentsSection(host, book, { onCount } = {}) {
  host.innerHTML = '';
  const panel = el('section', { class: 'panel' });
  const head = el('div', { class: 'panel__head' }, [
    el('span', { html: icon('comment') }),
    el('div', {}, [
      el('h3', { text: 'Comments & reviews' }),
      el('p', { id: 'commentSub', text: 'Loading...' }),
    ]),
  ]);
  const body = el('div', { class: 'panel__body' });
  const composer = composerNode(book, { onPosted: () => {} });
  const list = el('div', { class: 'mt-16' });
  body.append(composer, list);
  panel.append(head, body);
  host.append(panel);

  let items = [];
  const paint = () => {
    const sub = $('#commentSub');
    if (sub) sub.textContent = items.length
      ? `${items.length} comment${items.length === 1 ? '' : 's'}`
      : 'Be the first to comment';
    list.innerHTML = '';
    list.append(commentList(items, book, { onChange: () => {} }));
    onCount?.(items.length);
  };

  const unsub = store.subscribeComments(book.id, (next) => { items = next; paint(); });
  paint();
  return unsub;
}

/* ------------------------------------------------------------ the drawer */
let openDrawer = null;

export function closeCommentsDrawer() {
  if (openDrawer) { openDrawer.close(); openDrawer = null; }
}

/**
 * Slide-over comments panel. Used from the book card and from the reader,
 * so a reader never has to leave the page to join the discussion.
 */
export function openCommentsDrawer(book, { onCount } = {}) {
  closeCommentsDrawer();
  if ($('.overlay')) $('.overlay').remove();

  const scrim = el('div', { class: 'overlay', style: 'place-items:stretch;padding:0;background:rgba(16,20,26,.42)' });
  const drawer = el('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Comments on ${book.title}` });

  const head = el('div', { class: 'drawer__head' });
  head.append(
    el('span', { html: icon('comment') }),
    el('div', { style: 'flex:1;min-width:0' }, [
      el('h3', { text: 'Comments' }),
      el('p', { class: 'clamp-2', text: book.title }),
    ]),
    el('button', { class: 'icon-btn', id: 'drawerClose', 'aria-label': 'Close comments', html: icon('close') }),
  );

  const body = el('div', { class: 'drawer__body' });
  const foot = el('div', { class: 'drawer__foot' });
  drawer.append(head, body, foot);
  scrim.append(drawer);
  document.body.append(scrim);

  let items = [];
  const paint = () => {
    body.innerHTML = '';
    body.append(commentList(items, book, { onChange: () => {}, emptyText: 'No comments yet — start the conversation.' }));
    onCount?.(items.length);
    head.querySelector('h3').textContent = items.length ? `Comments (${items.length})` : 'Comments';
  };

  const composer = composerNode(book, { onPosted: () => {}, compact: true });
  foot.append(composer);

  const unsub = store.subscribeComments(book.id, (next) => { items = next; paint(); });
  paint();

  const close = () => { unsub?.(); scrim.remove(); document.removeEventListener('keydown', onKey); };
  function onKey(e) { if (e.key === 'Escape') close(); }

  head.querySelector('#drawerClose').addEventListener('click', close);
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  document.addEventListener('keydown', onKey);
  setTimeout(() => body.querySelector('.textarea, .link-btn')?.focus?.(), 80);

  openDrawer = { close };
  return close;
}

/* PageUp — book card component (shared by home grid and library) */
import { el, icon, escapeHtml, formatCount, starRow, coverGradient } from './util.js';

/* Generated cover used when a book has no coverUrl. The top strip is left
   empty on purpose — the Free/Premium and format badges sit there. */
const FALLBACK_COVER = (book) =>
  `<div style="width:100%;height:100%;background:${coverGradient(book.title + (book.author || ''))};
     display:flex;flex-direction:column;justify-content:flex-end;padding:16px;color:#fff;position:relative">
     <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.46),transparent 62%)"></div>
     <div class="cover-fallback__text" style="position:relative">
       <div style="font-size:10px;letter-spacing:.16em;text-transform:uppercase;opacity:.78;margin-bottom:7px">
         ${escapeHtml(book.category || 'General')}
       </div>
       <div style="font-size:16px;font-weight:700;line-height:1.3">${escapeHtml(book.title || 'Untitled')}</div>
       <div style="font-size:12px;opacity:.85;margin-top:5px">${escapeHtml(book.author || 'Unknown author')}</div>
     </div>
   </div>`;

/**
 * Cover image. Real covers are lazily fetched: the element ships with
 * data-src and is only given a src when it nears the viewport
 * (see activateLazyImages in util.js).
 */
export function bookThumb(book, { lazy = true } = {}) {
  if (!book.coverUrl) {
    const wrap = el('div', { html: FALLBACK_COVER(book) });
    return wrap.firstElementChild;
  }
  const img = el('img', {
    alt: `Cover of ${book.title || 'book'}`,
    loading: 'lazy',
    decoding: 'async',
    class: lazy ? 'js-lazy' : '',
    ...(lazy ? { 'data-src': book.coverUrl } : { src: book.coverUrl }),
  });
  img.addEventListener('error', () => {
    img.classList.add('is-loaded');
    const wrap = el('div', { html: FALLBACK_COVER(book) });
    img.replaceWith(wrap.firstElementChild);
  });
  if (!lazy) img.addEventListener('load', () => img.classList.add('is-loaded'), { once: true });
  return img;
}

/**
 * @param {object} book
 * @param {object} opts
 * @param {boolean} opts.liked
 * @param {boolean} opts.unlocked
 * @param {number}  opts.index          position in the grid, drives the stagger
 * @param {(book, btn) => void} opts.onLike
 * @param {(book) => void} opts.onComment      open the full comments panel
 * @param {(book, text) => Promise<void>} opts.onQuickComment
 * @param {(book) => void} opts.onShare
 */
export function renderBookCard(book, {
  liked = false, unlocked = false, index = 0,
  onLike, onComment, onQuickComment, onShare,
} = {}) {
  const rating = book.ratingAvg || 0;
  const format = (book.format || 'pdf').toLowerCase();
  const locked = book.isPremium && !unlocked;
  const comments = book.commentCount || 0;

  const card = el('article', { class: 'card', dataset: { id: book.id } });
  card.style.setProperty('--i', String(index % 24));

  /* ---- cover ---- */
  const thumb = el('a', {
    class: 'card__thumb',
    href: `./book.html?id=${encodeURIComponent(book.id)}`,
    'aria-label': `Open ${book.title}`,
  });
  thumb.append(bookThumb(book));

  const badges = el('div', { class: 'card__badges' });
  badges.append(book.isPremium
    ? el('span', { class: 'badge badge--premium', html: `${icon('crown')}<span>Premium</span>` })
    : el('span', { class: 'badge badge--free', html: '<span>Free</span>' }));
  if (book.isNew) badges.append(el('span', { class: 'badge', html: '<span>New</span>' }));
  thumb.append(badges);

  thumb.append(el('div', {
    class: 'card__format',
    html: `<span class="badge badge--${format}">${format.toUpperCase()}</span>`,
  }));

  /* ---- hover overlay ---- */
  const overlay = el('div', { class: 'card__overlay' });
  const desc = book.description ? el('p', { text: book.description }) : null;
  if (desc) overlay.append(desc);

  const actions = el('div', { class: 'card__overlay-actions card__overlay-actions--stacked' });

  const readBtn = el('a', {
    class: 'overlay-btn overlay-btn--primary',
    href: `./book.html?id=${encodeURIComponent(book.id)}`,
  }, [el('span', { html: locked ? icon('lock') : icon('play') }), el('span', { text: locked ? 'Read free preview' : 'Read now' })]);

  const row = el('div', { class: 'overlay-row' });

  const likeBtn = el('button', {
    class: 'overlay-btn', type: 'button', 'aria-pressed': String(liked),
    title: liked ? 'Remove from likes' : 'Like this book',
  }, [el('span', { html: liked ? icon('heartF') : icon('heart') }), el('span', { class: 'js-like-count', text: formatCount(book.likes || 0) })]);
  likeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onLike?.(book, likeBtn); });

  const commentBtn = el('button', { class: 'overlay-btn', type: 'button', title: 'Write a comment' },
    [el('span', { html: icon('comment') }), el('span', { class: 'js-comment-count', text: formatCount(comments) })]);
  commentBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showQuick(); });

  const shareBtn = el('button', { class: 'overlay-btn', type: 'button', title: 'Share' },
    [el('span', { html: icon('share') })]);
  shareBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onShare?.(book); });

  row.append(likeBtn, commentBtn, shareBtn);
  actions.append(readBtn, row);
  overlay.append(actions);

  /* ---- quick comment: write a review without leaving the grid ---- */
  const quick = el('div', { class: 'card__quickcomment hidden' });
  const qInput = el('textarea', {
    rows: '3', placeholder: 'Write a comment...',
    'aria-label': `Write a comment on ${book.title}`,
  });
  const qRow = el('div', { class: 'overlay-row' });

  const qPost = el('button', { class: 'overlay-btn overlay-btn--primary', type: 'button' },
    [el('span', { html: icon('check') }), el('span', { text: 'Post' })]);
  const qCancel = el('button', { class: 'overlay-btn', type: 'button', text: 'Cancel' });
  const qViewAll = el('button', { class: 'overlay-btn', type: 'button', title: 'Read all comments' },
    [el('span', { html: icon('list') }), el('span', { text: 'View' })]);

  qRow.append(qPost, qViewAll, qCancel);
  quick.append(qInput, qRow);
  overlay.append(quick);

  function showQuick() {
    actions.classList.add('hidden');
    if (desc) desc.classList.add('hidden');
    quick.classList.remove('hidden');
    setTimeout(() => qInput.focus(), 30);
  }
  function hideQuick() {
    quick.classList.add('hidden');
    actions.classList.remove('hidden');
    if (desc) desc.classList.remove('hidden');
  }
  function bumpCount(n) {
    card.querySelectorAll('.js-comment-count').forEach((node) => { node.textContent = formatCount(n); });
  }

  qCancel.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); qInput.value = ''; hideQuick(); });
  qViewAll.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); hideQuick(); onComment?.(book); });
  qPost.addEventListener('click', async (e) => {
    e.preventDefault(); e.stopPropagation();
    const text = qInput.value.trim();
    if (!text) { qInput.focus(); return; }
    qPost.disabled = true;
    try {
      await onQuickComment?.(book, text);
      qInput.value = '';
      hideQuick();
      const next = Number(card.dataset.comments || comments) + 1;
      card.dataset.comments = String(next);
      bumpCount(next);
    } catch (err) {
      console.error(err); // the parent surfaces the reason
    } finally {
      qPost.disabled = false;
    }
  });
  qInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') qPost.click();
  });
  qInput.addEventListener('click', (e) => e.stopPropagation());

  thumb.append(overlay);
  card.append(thumb);

  /* ---- meta ---- */
  const body = el('div', { class: 'card__body' });
  const titleWrap = el('div');
  titleWrap.append(el('a', {
    class: 'card__title', href: `./book.html?id=${encodeURIComponent(book.id)}`,
    text: book.title || 'Untitled', title: book.title || '',
  }));
  titleWrap.append(el('div', { class: 'card__author', text: book.author || 'Unknown author' }));
  body.append(titleWrap);

  const stats = el('div', { class: 'card__stats' });
  if (rating > 0) {
    stats.append(el('span', { class: 'row gap-8', html: `${starRow(rating)}<span class="rating-num">${rating.toFixed(1)}</span>` }));
  }
  stats.append(el('span', { class: 'row gap-8', html: `${icon('eye')}<span>${formatCount(book.views || 0)}</span>` }));

  const footerComment = el('button', {
    class: 'card__comment', type: 'button',
    title: comments ? `Read ${comments} comment${comments === 1 ? '' : 's'}` : 'Be the first to comment',
    html: `${icon('comment')}<span class="js-comment-count">${formatCount(comments)}</span>`,
  });
  footerComment.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onComment?.(book); });
  stats.append(footerComment);

  body.append(stats);
  card.append(body);
  return card;
}

export function skeletonCard() {
  return el('div', { class: 'skel-card' }, [
    el('div', { class: 'skel skel-thumb' }),
    el('div', { class: 'skel skel-line', style: 'width:70%' }),
    el('div', { class: 'skel skel-line', style: 'width:44%' }),
  ]);
}

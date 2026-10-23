/* PageUp — book card component (shared by home grid and library) */
import { el, icon, escapeHtml, formatCount, starRow, coverGradient } from './util.js';

/* Generated cover used when a book has no coverUrl. The top strip is left
   empty on purpose — the Free/Premium and format badges sit there. */
const FALLBACK_COVER = (book) =>
  `<div style="width:100%;height:100%;background:${coverGradient(book.title + (book.author || ''))};
     display:flex;flex-direction:column;justify-content:flex-end;padding:18px;color:#fff;position:relative">
     <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.42),transparent 62%)"></div>
     <div style="position:relative">
       <div style="font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;opacity:.78;margin-bottom:8px">
         ${escapeHtml(book.category || 'General')}
       </div>
       <div style="font-size:17px;font-weight:800;line-height:1.25">${escapeHtml(book.title || 'Untitled')}</div>
       <div style="font-size:12.5px;opacity:.85;margin-top:6px">${escapeHtml(book.author || 'Unknown author')}</div>
     </div>
   </div>`;

export function bookThumb(book, { lazy = true } = {}) {
  const img = el('img', {
    alt: `Cover of ${book.title || 'book'}`,
    loading: lazy ? 'lazy' : 'eager',
    decoding: 'async',
    src: book.coverUrl || '',
  });
  img.addEventListener('error', () => {
    const wrap = el('div', { html: FALLBACK_COVER(book) });
    img.replaceWith(wrap.firstElementChild);
  });
  if (!book.coverUrl) {
    const wrap = el('div', { html: FALLBACK_COVER(book) });
    return wrap.firstElementChild;
  }
  return img;
}

export function renderBookCard(book, { liked = false, unlocked = false, onLike, onShare } = {}) {
  const rating = book.ratingAvg || 0;
  const format = (book.format || 'pdf').toLowerCase();
  const locked = book.isPremium && !unlocked;

  const card = el('article', { class: 'card', dataset: { id: book.id } });

  const thumb = el('a', {
    class: 'card__thumb',
    href: `./book.html?id=${encodeURIComponent(book.id)}`,
    'aria-label': `Open ${book.title}`,
  });
  thumb.append(bookThumb(book));

  const badges = el('div', { class: 'card__badges' });
  if (book.isPremium) {
    badges.append(el('span', { class: 'badge badge--premium', html: `${icon('crown')}<span>Premium</span>` }));
  } else {
    badges.append(el('span', { class: 'badge badge--free', html: `<span>Free</span>` }));
  }
  if (book.isNew) badges.append(el('span', { class: 'badge', html: `<span>New</span>` }));
  thumb.append(badges);

  thumb.append(el('div', {
    class: 'card__format',
    html: `<span class="badge badge--${format}">${format.toUpperCase()}</span>`,
  }));

  const overlay = el('div', { class: 'card__overlay' });
  if (book.description) {
    overlay.append(el('p', { text: book.description }));
  }
  const actions = el('div', { class: 'card__overlay-actions' });

  const readBtn = el('a', {
    class: 'overlay-btn overlay-btn--primary',
    href: `./book.html?id=${encodeURIComponent(book.id)}`,
  }, [el('span', { html: locked ? icon('lock') : icon('play') }), el('span', { text: locked ? 'Preview' : 'Read' })]);

  const likeBtn = el('button', {
    class: 'overlay-btn', type: 'button', 'aria-pressed': String(liked),
    title: liked ? 'Remove from likes' : 'Like this book',
  }, [el('span', { html: liked ? icon('heartF') : icon('heart') }), el('span', { class: 'js-like-count', text: formatCount(book.likes || 0) })]);

  likeBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onLike?.(book, likeBtn); });

  const shareBtn = el('button', { class: 'overlay-btn', type: 'button', title: 'Share' },
    [el('span', { html: icon('share') })]);
  shareBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); onShare?.(book); });

  actions.append(readBtn, likeBtn, shareBtn);
  overlay.append(actions);
  thumb.append(overlay);
  card.append(thumb);

  const body = el('div', { class: 'card__body' });
  const meta = el('div', { class: 'card__meta' });
  meta.append(el('a', {
    class: 'card__title', href: `./book.html?id=${encodeURIComponent(book.id)}`,
    text: book.title || 'Untitled', title: book.title || '',
  }));
  meta.append(el('div', { class: 'card__author', text: book.author || 'Unknown author' }));

  const stats = el('div', { class: 'card__stats' });
  if (rating > 0) {
    stats.append(el('span', { class: 'row gap-8', html: `${starRow(rating)}<span class="rating-num">${rating.toFixed(1)}</span>` }));
    stats.append(el('span', { text: `(${formatCount(book.ratingCount || 0)})` }));
  } else {
    stats.append(el('span', { text: 'Not yet rated' }));
  }
  stats.append(el('span', { class: 'row gap-8', html: `${icon('eye')}<span>${formatCount(book.views || 0)}</span>` }));
  if (book.pages) stats.append(el('span', { text: `${book.pages} pp` }));
  meta.append(stats);

  body.append(meta);
  card.append(body);
  return card;
}

export function skeletonCard() {
  return el('div', { class: 'skel-card' }, [
    el('div', { class: 'skel skel-thumb' }),
    el('div', { class: 'skel skel-line', style: 'width:88%' }),
    el('div', { class: 'skel skel-line', style: 'width:52%' }),
  ]);
}

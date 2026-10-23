/* PageUp — ad-style slide banner for new launches.
   A flex track of slides moved with a transform, with dots, arrows, a slide
   counter, an auto-advance progress bar, swipe and keyboard control. */
import { el, icon, escapeHtml, formatCount, starRow } from './util.js';
import { bookThumb } from './cards.js';

const DURATION = 6000;

/* Every slide keeps to the blue palette, varied by depth. */
const GRADIENTS = [
  'linear-gradient(120deg,#0f3355 0%,#1b5a96 58%,#226db4 100%)',
  'linear-gradient(120deg,#123a5e 0%,#226db4 55%,#3d8fd1 100%)',
  'linear-gradient(120deg,#0b2b47 0%,#154a7c 60%,#2a7cc4 100%)',
  'linear-gradient(120deg,#16324d 0%,#1f6aa8 55%,#4a9ad6 100%)',
  'linear-gradient(120deg,#0d2f4f 0%,#1b5a96 50%,#2e86c8 100%)',
  'linear-gradient(120deg,#13375a 0%,#2069a5 60%,#3b90cf 100%)',
  'linear-gradient(120deg,#0a2540 0%,#164f80 55%,#1f6fb0 100%)',
];

function eyebrowFor(book) {
  if (book.isNew) return { text: 'New launch', icon: 'flame' };
  if (book.isPremium) return { text: 'Premium pick', icon: 'crown' };
  return { text: 'Featured', icon: 'star' };
}

/**
 * @param {HTMLElement} host   container to render into
 * @param {Array} books        up to 7 slides
 * @param {object} opts
 * @param {(book) => void} opts.onShare
 * @param {(book) => string} opts.hrefFor   how a slide links to the book
 * @returns {{destroy: Function, goTo: Function, next: Function, prev: Function, index: number}}
 */
export function createBanner(host, books, { onShare, hrefFor } = {}) {
  const slides = (books || []).slice(0, 7);
  if (!host || !slides.length) return null;

  host.innerHTML = '';
  const root = el('section', {
    class: 'banner', id: 'launchBanner',
    'aria-roledescription': 'carousel', 'aria-label': 'New launches',
    tabindex: '0',
  });

  const viewport = el('div', { class: 'banner__viewport' });
  const track = el('div', { class: 'banner__track' });

  slides.forEach((book, i) => {
    const eb = eyebrowFor(book);
    const slide = el('article', {
      class: 'banner__slide', role: 'group',
      'aria-roledescription': 'slide',
      'aria-label': `${i + 1} of ${slides.length}`,
      style: `background:${GRADIENTS[i % GRADIENTS.length]}`,
    });

    const copy = el('div', { class: 'banner__copy' });
    copy.append(el('span', { class: 'banner__eyebrow', html: `${icon(eb.icon)}<span>${escapeHtml(eb.text)}</span>` }));
    copy.append(el('h2', { class: 'banner__title', text: book.title || 'Untitled' }));
    copy.append(el('p', { class: 'banner__author', text: `by ${book.author || 'Unknown author'}` }));
    if (book.description) copy.append(el('p', { class: 'banner__desc', text: book.description }));

    const meta = el('div', { class: 'banner__meta' });
    if (book.ratingAvg) {
      meta.append(el('span', { class: 'row gap-8', html: `${starRow(book.ratingAvg)}<span class="rating-num">${book.ratingAvg.toFixed(1)}</span>` }));
    }
    meta.append(el('span', { class: 'row gap-8', html: `${icon('eye')}<span>${formatCount(book.views || 0)} reads</span>` }));
    meta.append(el('span', { class: 'row gap-8', html: `${icon('comment')}<span>${formatCount(book.commentCount || 0)}</span>` }));
    meta.append(el('span', { class: 'row gap-8', html: `${icon('book')}<span>${escapeHtml((book.format || 'epub').toUpperCase())}</span>` }));
    copy.append(meta);

    const actions = el('div', { class: 'banner__actions' });
    const read = el('a', {
      class: 'banner__btn',
      href: (hrefFor || ((b) => `./book.html?id=${encodeURIComponent(b.id)}`))(book),
      html: `${icon('play')}<span>${book.isPremium ? 'Read free preview' : 'Read now'}</span>`,
    });
    const share = el('button', { class: 'banner__btn banner__btn--ghost', type: 'button' },
      [el('span', { html: icon('share') }), el('span', { text: 'Share' })]);
    share.addEventListener('click', () => onShare?.(book));
    actions.append(read, share);
    copy.append(actions);

    const art = el('div', { class: 'banner__art' });
    const frame = el('div', { class: 'banner__art-inner' });
    frame.append(bookThumb(book, { lazy: false }));
    if (book.isNew) frame.append(el('span', { class: 'banner__tag', text: 'New' }));
    art.append(frame);

    slide.append(copy, art);
    track.append(slide);
  });

  viewport.append(track);

  /* ---- controls ---- */
  const prevBtn = el('button', { class: 'banner__arrow banner__arrow--prev', type: 'button', 'aria-label': 'Previous slide', html: icon('left') });
  const nextBtn = el('button', { class: 'banner__arrow banner__arrow--next', type: 'button', 'aria-label': 'Next slide', html: icon('right') });

  const dots = el('div', { class: 'banner__dots', role: 'tablist', 'aria-label': 'Choose slide' });
  slides.forEach((book, i) => {
    const dot = el('button', {
      class: 'banner__dot', type: 'button', role: 'tab',
      'aria-current': String(i === 0), 'aria-label': `Slide ${i + 1}: ${book.title}`,
    });
    dot.addEventListener('click', () => { goTo(i); restart(); });
    dots.append(dot);
  });

  const counter = el('div', { class: 'banner__count' });
  const progress = el('div', { class: 'banner__progress' });
  const progressBar = el('div', { class: 'banner__progress-bar' });
  progress.append(progressBar);

  root.append(viewport, prevBtn, nextBtn, dots, counter, progress);
  host.append(root);

  /* ---- state ---- */
  let index = 0;
  let timer = null;
  let paused = false;
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function paint() {
    track.style.transform = `translateX(-${index * 100}%)`;
    Array.from(dots.children).forEach((d, i) => d.setAttribute('aria-current', String(i === index)));
    counter.textContent = `${index + 1} / ${slides.length}`;
    // keep off-screen slides out of the tab order
    track.querySelectorAll('.banner__slide').forEach((s, i) => {
      s.setAttribute('aria-hidden', String(i !== index));
      s.querySelectorAll('a, button').forEach((n) => { n.tabIndex = i === index ? 0 : -1; });
    });
  }

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    paint();
  }
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  function stop() {
    if (timer) { clearTimeout(timer); timer = null; }
    progressBar.classList.remove('is-running');
  }
  function start() {
    if (reduceMotion || paused || slides.length < 2) return;
    stop();
    progressBar.style.setProperty('--banner-ms', `${DURATION}ms`);
    void progressBar.offsetWidth;          // restart the CSS animation
    progressBar.classList.add('is-running');
    timer = setTimeout(() => { next(); start(); }, DURATION);
  }
  function restart() { stop(); start(); }

  nextBtn.addEventListener('click', () => { next(); restart(); });
  prevBtn.addEventListener('click', () => { prev(); restart(); });

  root.addEventListener('mouseenter', () => { paused = true; stop(); });
  root.addEventListener('mouseleave', () => { paused = false; start(); });
  root.addEventListener('focusin', () => { paused = true; stop(); });
  root.addEventListener('focusout', () => { paused = false; start(); });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); next(); restart(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); restart(); }
  });

  /* ---- swipe ---- */
  let startX = null;
  viewport.addEventListener('pointerdown', (e) => { startX = e.clientX; });
  viewport.addEventListener('pointerup', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    startX = null;
    if (Math.abs(dx) < 45) return;
    if (dx < 0) next(); else prev();
    restart();
  });
  viewport.addEventListener('pointercancel', () => { startX = null; });

  /* ---- pause when the tab is hidden ---- */
  const onVisibility = () => { if (document.hidden) stop(); else start(); };
  document.addEventListener('visibilitychange', onVisibility);

  paint();
  start();

  return {
    get index() { return index; },
    goTo: (i) => { goTo(i); restart(); },
    next: () => { next(); restart(); },
    prev: () => { prev(); restart(); },
    destroy() {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      host.innerHTML = '';
    },
  };
}

/* PageUp — shared utilities (no dependencies) */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Create an element: el('div', {class:'x'}, ['text', childNode]) */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** Escape untrusted text before it reaches innerHTML. */
export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** 1234 -> "1.2K", 1200000 -> "1.2M" */
export function formatCount(n) {
  n = Number(n) || 0;
  if (n < 1000) return String(n);
  if (n < 1e6)  return (n / 1000).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K';
  if (n < 1e9)  return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  return (n / 1e9).toFixed(1) + 'B';
}

/** Firestore Timestamp | Date | millis -> "3 days ago" */
export function timeAgo(ts) {
  if (!ts) return '';
  const date = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 45) return 'just now';
  const units = [
    ['year', 31536000], ['month', 2592000], ['week', 604800],
    ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1],
  ];
  for (const [name, size] of units) {
    const v = Math.floor(secs / size);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

export function debounce(fn, wait = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Deterministic gradient for cover fallbacks. */
export function coverGradient(seed = '') {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return `linear-gradient(140deg, hsl(${h} 62% 42%), hsl(${(h + 48) % 360} 68% 28%))`;
}

/* ------------------------------ Toasts ---------------------------------- */
const ICONS = {
  success: '<path d="M20 6 9 17l-5-5"/>',
  error:   '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  info:    '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
};

export function toast(message, kind = 'info', ms = 3200) {
  let wrap = $('.toast-wrap');
  if (!wrap) { wrap = el('div', { class: 'toast-wrap' }); document.body.append(wrap); }
  const node = el('div', { class: `toast toast--${kind}` }, [
    el('span', { html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind] || ICONS.info}</svg>` }),
    el('span', { text: message }),
  ]);
  wrap.append(node);
  setTimeout(() => {
    node.style.transition = 'opacity .25s, transform .25s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 260);
  }, ms);
}

/* ------------------------------ SVG icons ------------------------------- */
const S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const SF = (d) => `<svg viewBox="0 0 24 24" fill="currentColor">${d}</svg>`;

export const icons = {
  book:    S('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  search:  S('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  close:   S('<path d="M18 6 6 18M6 6l12 12"/>'),
  heart:   S('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  heartF:  SF('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>'),
  star:    SF('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
  starO:   S('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
  share:   S('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>'),
  eye:     S('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'),
  comment: S('<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.9-.9L3 21l2-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/>'),
  sun:     S('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon:    S('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  user:    S('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  logout:  S('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>'),
  google:  `<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z"/><path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z"/><path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 0 0 1.8 7.1l3.8 3C6.5 7.3 9 4.8 12 4.8z"/></svg>`,
  crown:   S('<path d="M2 18h20l-1.5-9-4.5 3.5L12 6 8 12.5 3.5 9z"/>'),
  lock:    S('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
  play:    SF('<path d="M6 4v16l14-8z"/>'),
  grid:    S('<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'),
  flame:   S('<path d="M12 2s5 4.5 5 9a5 5 0 0 1-10 0c0-1.5.5-2.5 1-3.2C8.5 9 12 7 12 2z"/>'),
  bookmark:S('<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>'),
  left:    S('<path d="m15 18-6-6 6-6"/>'),
  right:   S('<path d="m9 18 6-6-6-6"/>'),
  zoomIn:  S('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>'),
  zoomOut: S('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>'),
  list:    S('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  download:S('<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>'),
  check:   S('<path d="M20 6 9 17l-5-5"/>'),
  trash:   S('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  up:      S('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  info:    S('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'),
};

export function icon(name, cls = '') {
  const raw = icons[name] || '';
  return raw.replace('<svg ', `<svg class="${cls}" `);
}

/* --------------------------- Lazy images -------------------------------- */
/* Covers are marked with data-src and swapped in only as they approach the
   viewport, then faded in. Keeps a long catalogue cheap to scroll. */
let imgObserver = null;

export function activateLazyImages(root = document) {
  const imgs = Array.from(root.querySelectorAll('img.js-lazy[data-src]:not(.is-loaded)'));
  if (!imgs.length) return;

  const show = (img) => {
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
    const done = () => img.classList.add('is-loaded');
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
  };

  if (!('IntersectionObserver' in window)) { imgs.forEach(show); return; }

  if (!imgObserver) {
    imgObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        imgObserver.unobserve(entry.target);
        show(entry.target);
      });
    }, { rootMargin: '400px 0px' });
  }
  imgs.forEach((img) => imgObserver.observe(img));
}

/** <div class="load-more"><span class="spinner"></span>Loading more books...</div> */
export function loadMoreIndicator(text = 'Loading more books...') {
  return el('div', { class: 'load-more' }, [
    el('span', { class: 'spinner' }),
    el('span', { text }),
  ]);
}

/* ------------------------------ Misc ------------------------------------ */
export function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = el('textarea', { style: 'position:fixed;opacity:0' });
  ta.value = text; document.body.append(ta); ta.select();
  try { document.execCommand('copy'); } finally { ta.remove(); }
  return Promise.resolve();
}

export function getParam(name, fallback = null) {
  return new URLSearchParams(location.search).get(name) ?? fallback;
}

export function starRow(rating = 0, size = 13) {
  let out = '<span class="stars">';
  for (let i = 1; i <= 5; i++) {
    const on = rating >= i - 0.25;
    out += `<span class="${on ? 'star--on' : 'star--off'}">${icons.star}</span>`;
  }
  return out + '</span>';
}

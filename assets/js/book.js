/* PageUp — book detail page: metadata, ratings, likes, comments, reader */
import {
  renderShell, initAuth, onSession, shareBook, requireAuth, actorId, actorProfile,
  toast, money, $, el, icon, escapeHtml, initials,
} from './ui.js';
import { mountCommentsSection, openCommentsDrawer } from './comments.js';
import * as store from './store.js';
import { bookThumb } from './cards.js';
import { openReader, detectFormat } from './reader.js';
import { formatCount, starRow } from './util.js';
import { siteConfig } from './firebase-config.js';

const ui = {
  book: null, unlocked: false, liked: false, myRating: 0,
  reader: null, commentsUnsub: null, atLimit: false,
};

async function boot() {
  renderShell();
  await initAuth();
  store.setUid(actorId());

  const id = new URLSearchParams(location.search).get('id');
  const host = $('#bookDetail');
  if (!id) { host.innerHTML = notFound('No book was specified.'); return; }

  host.innerHTML = detailSkeleton();
  let book;
  try { book = await store.getBook(id); }
  catch (err) { host.innerHTML = notFound(err?.message || 'Could not load this book.'); return; }
  if (!book) { host.innerHTML = notFound('This book does not exist or was removed.'); return; }

  ui.book = book;
  document.title = `${book.title} — PageUp`;
  store.registerView(id);

  ui.unlocked = !book.isPremium || await safe(() => store.isUnlocked(id, actorId()), false);
  ui.liked = await safe(() => store.isLiked(id, actorId()), false);
  ui.myRating = await safe(() => store.getMyRating(id, actorId()), 0);

  renderDetail();

  onSession(async () => {
    store.setUid(actorId());
    ui.liked = await safe(() => store.isLiked(id, actorId()), false);
    ui.myRating = await safe(() => store.getMyRating(id, actorId()), 0);
    ui.unlocked = !book.isPremium || await safe(() => store.isUnlocked(id, actorId()), false);
    paintActions();
    paintRating();
  });

  store.subscribeBook(id, (fresh) => {
    if (!fresh) return;
    ui.book = fresh;
    paintStats();
    paintActions();
  });
}

const safe = async (fn, fallback) => { try { return await fn(); } catch { return fallback; } };

/* ------------------------------------------------------------- Render */
function renderDetail() {
  const b = ui.book;
  const format = detectFormat(b);

  $('#bookDetail').innerHTML = `
    <div class="page-head" style="padding-bottom:6px">
      <div>
        <div class="crumbs">
          <a href="./index.html">Catalogue</a>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          <span>${escapeHtml(b.category || 'General')}</span>
        </div>
      </div>
      <div class="row gap-12">
        <button class="btn btn--ghost btn--sm" id="headShare">${icon('share')}<span>Share</span></button>
        <button class="btn btn--ghost btn--sm" id="headComments">${icon('comment')}<span>Comments</span></button>
      </div>
    </div>

    <div class="detail">
      <div>
        <div class="detail__cover" id="coverBox"></div>
      </div>

      <div>
        <div class="row gap-8" style="flex-wrap:wrap;margin-bottom:12px" id="topBadges"></div>
        <h1>${escapeHtml(b.title)}</h1>
        <p class="detail__author">by <b>${escapeHtml(b.author || 'Unknown author')}</b></p>

        <div class="detail__stats" id="statRow"></div>
        <div id="gateBox"></div>
        <div class="detail__actions" id="actionRow"></div>

        <dl class="meta-list">
          <div><dt>Format</dt><dd>${escapeHtml(format.toUpperCase())}</dd></div>
          <div><dt>Pages</dt><dd>${b.pages ? b.pages : '—'}</dd></div>
          <div><dt>Language</dt><dd>${escapeHtml(b.language || 'English')}</dd></div>
          <div><dt>Publisher</dt><dd>${escapeHtml(b.publisher || '—')}</dd></div>
          <div><dt>Published</dt><dd>${escapeHtml(String(b.publishedYear || '—'))}</dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(b.category || 'General')}</dd></div>
        </dl>

        <section class="panel" style="margin-bottom:22px">
          <div class="panel__head">
            <span>${icon('info')}</span>
            <div><h3>About this book</h3></div>
          </div>
          <div class="panel__body">
            <p class="detail__desc" style="margin-top:0">${escapeHtml(b.description || 'No description provided yet.')}</p>
            ${(b.tags || []).length ? `<div class="row gap-8" style="flex-wrap:wrap">${b.tags.map((t) => `<span class="chip" style="pointer-events:none">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
          </div>
        </section>

        <section class="panel" style="margin-bottom:22px">
          <div class="panel__head">
            <span>${icon('star')}</span>
            <div><h3>Rate this book</h3><p id="ratingSub"></p></div>
          </div>
          <div class="panel__body row gap-16" style="flex-wrap:wrap">
            <div class="rate-input" id="rateInput" role="radiogroup" aria-label="Your rating"></div>
            <span class="hint" id="ratingHint">Tap a star to rate</span>
          </div>
        </section>

        <div id="commentsHost"></div>
      </div>
    </div>`;

  $('#coverBox').append(bookThumb(b, { lazy: false }));
  $('#headShare').addEventListener('click', () => shareBook(ui.book));
  $('#headComments').addEventListener('click', () => openCommentsDrawer(ui.book));

  paintBadges();
  paintStats();
  paintActions();
  paintRating();
  mountComments();
}

function paintBadges() {
  const b = ui.book;
  const host = $('#topBadges');
  if (!host) return;
  const format = detectFormat(b);
  host.innerHTML = `
    <span class="badge badge--${format}">${format.toUpperCase()}</span>
    ${b.isPremium ? `<span class="badge badge--premium">${icon('crown')}<span>Premium</span></span>`
                  : `<span class="badge badge--free">Free to read</span>`}
    ${b.isNew ? `<span class="badge badge--muted">New</span>` : ''}
    ${ui.unlocked && b.isPremium ? `<span class="badge badge--free">${icon('check')}<span>Unlocked</span></span>` : ''}`;
}

function paintStats() {
  const b = ui.book;
  const host = $('#statRow');
  if (!host) return;
  const rating = b.ratingAvg || 0;
  host.innerHTML = `
    <div class="detail__stat">
      <b class="row gap-8">${rating ? rating.toFixed(1) : '—'} <span style="font-size:12px">${starRow(rating)}</span></b>
      <span>${formatCount(b.ratingCount || 0)} ratings</span>
    </div>
    <div class="detail__stat"><b>${formatCount(b.views || 0)}</b><span>reads</span></div>
    <div class="detail__stat"><b id="likeStatNum">${formatCount(b.likes || 0)}</b><span>likes</span></div>
    <div class="detail__stat"><b id="commentStatNum">${formatCount(b.commentCount || 0)}</b><span>comments</span></div>`;
}

function paintActions() {
  const b = ui.book;
  const row = $('#actionRow');
  if (!row) return;
  row.innerHTML = '';

  const locked = b.isPremium && !ui.unlocked;

  const readBtn = el('button', { class: 'btn btn--primary btn--lg' }, [
    el('span', { html: locked ? icon('lock') : icon('play') }),
    el('span', { text: locked ? 'Read free preview' : 'Read now' }),
  ]);
  readBtn.addEventListener('click', () => openBookReader());

  const likeBtn = el('button', { class: 'btn btn--ghost btn--lg', 'aria-pressed': String(ui.liked) }, [
    el('span', { html: ui.liked ? icon('heartF') : icon('heart') }),
    el('span', { text: ui.liked ? 'Liked' : 'Like' }),
  ]);
  likeBtn.addEventListener('click', () => handleLike(likeBtn));

  const commentBtn = el('button', { class: 'btn btn--ghost btn--lg' }, [
    el('span', { html: icon('comment') }), el('span', { text: 'Add a comment' }),
  ]);
  commentBtn.addEventListener('click', () => {
    const host = $('#commentsHost');
    host?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => host?.querySelector('textarea')?.focus(), 420);
  });

  const shareBtn = el('button', { class: 'btn btn--ghost btn--lg' }, [
    el('span', { html: icon('share') }), el('span', { text: 'Share' }),
  ]);
  shareBtn.addEventListener('click', () => shareBook(b));

  row.append(readBtn, likeBtn, commentBtn, shareBtn);

  if (locked) {
    const unlock = el('button', { class: 'btn btn--gold btn--lg' }, [
      el('span', { html: icon('crown') }),
      el('span', { text: `Unlock for ${money(b.price || 0)}` }),
    ]);
    unlock.addEventListener('click', openUnlockModal);
    row.append(unlock);
  }

  paintGate();
}

function paintGate() {
  const b = ui.book;
  const box = $('#gateBox');
  if (!box) return;
  box.innerHTML = '';
  if (!b.isPremium || ui.unlocked) return;

  box.innerHTML = `
    <div class="gate">
      <h3>${icon('crown')} Premium title</h3>
      <p>Read the first <b>${b.previewPages || siteConfig.defaultPreviewPages} pages</b> free.
      Unlock the full book for <b>${money(b.price || 0)}</b> — one-time, yours forever, no subscription.</p>
      <div class="row gap-8" style="flex-wrap:wrap">
        <button class="btn btn--gold" id="gateUnlock">${icon('crown')}<span>Unlock full book</span></button>
        <button class="btn btn--ghost" id="gatePreview">${icon('eye')}<span>Continue free preview</span></button>
      </div>
    </div>`;
  $('#gateUnlock').addEventListener('click', openUnlockModal);
  $('#gatePreview').addEventListener('click', () => openBookReader());
}

/* -------------------------------------------------------------- Rating */
function paintRating() {
  const b = ui.book;
  const input = $('#rateInput');
  if (!input) return;
  input.innerHTML = '';
  const current = ui.myRating || 0;
  for (let i = 1; i <= 5; i++) {
    const btn = el('button', {
      type: 'button', class: i <= current ? 'on' : '',
      'aria-label': `${i} star${i > 1 ? 's' : ''}`, 'aria-checked': String(i === current),
      role: 'radio', html: icon('star'),
    });
    btn.addEventListener('click', () => submitRating(i));
    btn.addEventListener('mouseenter', () => paintStars(i));
    input.append(btn);
  }
  input.addEventListener('mouseleave', () => paintStars(current));

  const sub = $('#ratingSub');
  if (sub) sub.textContent = b.ratingCount
    ? `${(b.ratingAvg || 0).toFixed(1)} average from ${formatCount(b.ratingCount)} ratings`
    : 'No ratings yet';
  const hint = $('#ratingHint');
  if (hint) hint.textContent = current ? `You rated this ${current}/5` : 'Tap a star to rate';
}

function paintStars(upto) {
  document.querySelectorAll('#rateInput button').forEach((btn, idx) => {
    btn.classList.toggle('on', idx < upto);
  });
}

async function submitRating(value) {
  if (!requireAuth('rate books')) return;
  try {
    await store.rateBook(ui.book.id, actorId(), value);
    ui.myRating = value;
    paintStars(value);
    const hint = $('#ratingHint');
    if (hint) hint.textContent = `You rated this ${value}/5`;
    toast(`Rated ${value} out of 5`, 'success');
  } catch (err) { console.error(err); toast('Could not save your rating', 'error'); }
}

/* ------------------------------------------------------------ Comments */
function mountComments() {
  const host = $('#commentsHost');
  if (!host) return;
  if (ui.commentsUnsub) ui.commentsUnsub();
  ui.commentsUnsub = mountCommentsSection(host, ui.book, {
    onCount: (n) => {
      const node = $('#commentStatNum');
      if (node) node.textContent = formatCount(n);
    },
  });
}

/* --------------------------------------------------------------- Likes */
async function handleLike(btn) {
  if (!requireAuth('like books')) return;
  try {
    const nowLiked = await store.toggleLike(ui.book.id, actorId());
    ui.liked = nowLiked;
    btn.setAttribute('aria-pressed', String(nowLiked));
    btn.innerHTML = `<span>${nowLiked ? icon('heartF') : icon('heart')}</span><span>${nowLiked ? 'Liked' : 'Like'}</span>`;
    const n = $('#likeStatNum');
    if (n) n.textContent = formatCount(Math.max(0, (ui.book.likes || 0) + (nowLiked ? 1 : -1)));
    toast(nowLiked ? 'Added to your likes' : 'Removed from likes', nowLiked ? 'success' : 'info', 1800);
  } catch (err) { console.error(err); toast('Could not update like', 'error'); }
}

/* -------------------------------------------------------- Unlock modal */
function openUnlockModal() {
  if (!requireAuth('unlock premium books')) return;
  const b = ui.book;
  const price = Number(b.price || 0);

  $('.overlay')?.remove();
  const overlay = el('div', { class: 'overlay', html: `<div class="modal" role="dialog" aria-modal="true"></div>` });
  const modal = overlay.firstElementChild;
  document.body.append(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  modal.innerHTML = `
    <div class="modal__head">
      <div style="flex:1">
        <h3>Unlock “${escapeHtml(b.title)}”</h3>
        <p>One-time purchase. Read it forever on every device.</p>
      </div>
      <button class="icon-btn" id="unlockClose" aria-label="Close">${icon('close')}</button>
    </div>
    <div class="modal__body">
      <div class="meta-list" style="grid-template-columns:1fr 1fr;margin-bottom:16px">
        <div><dt>Price</dt><dd>${money(price)}</dd></div>
        <div><dt>Access</dt><dd>Lifetime</dd></div>
        <div><dt>Format</dt><dd>${detectFormat(b).toUpperCase()}</dd></div>
        <div><dt>Devices</dt><dd>Unlimited</dd></div>
      </div>
      <ul class="small muted" style="line-height:2">
        <li>${icon('check')} Full book, no page limits</li>
        <li>${icon('check')} Read online, resume where you left off</li>
        <li>${icon('check')} Offline reading in the PageUp app</li>
      </ul>
      <button class="btn btn--gold btn--block btn--lg mt-16" id="payNow">
        ${icon('crown')}<span>Pay ${money(price)} and unlock</span>
      </button>
      <p class="hint text-center mt-8">
        ${siteConfig.razorpayKeyId ? 'Secured by Razorpay' : 'Demo checkout — no real payment is taken. Add a Razorpay key in firebase-config.js for live payments.'}
      </p>
    </div>`;

  modal.querySelector('#unlockClose').onclick = () => overlay.remove();
  modal.querySelector('#payNow').onclick = async (e) => {
    const btn = e.target.closest('button');
    btn.disabled = true;
    const ok = await startCheckout(b);
    if (ok) {
      await store.recordPurchase(b.id, actorId(), { amount: price, currency: siteConfig.currency, method: siteConfig.razorpayKeyId ? 'razorpay' : 'demo' });
      ui.unlocked = true;
      overlay.remove();
      paintActions();
      paintBadges();
      toast('Unlocked — enjoy the full book', 'success');
    } else {
      btn.disabled = false;
    }
  };
}

function startCheckout(book) {
  const price = Number(book.price || 0) * 100;
  if (!siteConfig.razorpayKeyId) return new Promise((resolve) => setTimeout(() => resolve(true), 600));
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      const rzp = new window.Razorpay({
        key: siteConfig.razorpayKeyId, amount: price, currency: siteConfig.currency,
        name: siteConfig.name, description: book.title, theme: { color: '#e42527' },
        handler: () => resolve(true),
        modal: { ondismiss: () => resolve(false) },
      });
      rzp.on('payment.failed', () => resolve(false));
      rzp.open();
    };
    script.onerror = () => resolve(false);
    document.head.append(script);
  });
}

/* ------------------------------------------------------------- Reader */
function openBookReader() {
  const b = ui.book;
  if (ui.reader) return;

  const previewPages = b.previewPages || siteConfig.defaultPreviewPages;

  const shell = el('div', { class: 'reader-shell', id: 'readerShell', html: `
    <div class="reader-bar">
      <button class="icon-btn" id="readerBack" aria-label="Close reader">${icon('left')}</button>
      <div style="min-width:0">
        <div class="reader-bar__title">${escapeHtml(b.title)}</div>
        <div class="reader-bar__sub" id="readerSub">${escapeHtml(b.author || '')} · ${detectFormat(b).toUpperCase()}</div>
      </div>
      <span class="spacer"></span>
      <button class="btn btn--ghost btn--sm" id="readerComments">${icon('comment')}<span>Comments</span></button>
      <button class="icon-btn" id="readerZoomOut" aria-label="Zoom out">${icon('zoomOut')}</button>
      <button class="icon-btn" id="readerZoomIn" aria-label="Zoom in">${icon('zoomIn')}</button>
      ${b.fileUrl ? `<a class="icon-btn" href="${escapeHtml(b.fileUrl)}" target="_blank" rel="noopener" download aria-label="Download">${icon('download')}</a>` : ''}
      <button class="icon-btn" id="readerFull" aria-label="Toggle fullscreen">${icon('grid')}</button>
    </div>
    <div class="reader-progress"><div class="reader-progress__bar" id="readerBar"></div></div>
    <div class="reader-main">
      <button class="reader-nav reader-nav--prev" id="readerPrev" aria-label="Previous page">${icon('left')}</button>
      <div class="reader-stage" id="readerStage"></div>
      <button class="reader-nav" id="readerNext" aria-label="Next page">${icon('right')}</button>
    </div>
    <div class="reader-foot">
      <span>Page</span>
      <input class="page-input" id="readerPageInput" type="number" min="1" value="1" aria-label="Go to page">
      <span id="readerTotal">of —</span>
      <span class="spacer"></span>
      <button class="link-btn" id="footComments">${icon('comment')}<span>Comments</span></button>
      <span id="readerPercent">0%</span>
    </div>` });

  document.body.append(shell);
  document.body.style.overflow = 'hidden';

  const stage = $('#readerStage');

  openReader({
    book: b, stage, previewPages, unlocked: ui.unlocked,
    onProgress: (p) => {
      const limit = p.limit || p.total;
      const atLimit = !ui.unlocked && p.page >= limit;
      ui.atLimit = atLimit;

      $('#readerBar').style.width = `${p.percent}%`;
      $('#readerPercent').textContent = atLimit ? 'Preview ended' : `${p.percent}%`;
      $('#readerTotal').textContent = `of ${p.total}`;
      const inp = $('#readerPageInput');
      if (document.activeElement !== inp) inp.value = p.page;
      $('#readerPrev').disabled = p.page <= 1;
      $('#readerNext').disabled = ui.unlocked && p.page >= p.total;
      $('#readerNext').innerHTML = icon(atLimit ? 'lock' : 'right');
      $('#readerNext').classList.toggle('reader-nav--locked', atLimit);
      $('#readerSub').textContent = ui.unlocked
        ? (b.author || '')
        : (atLimit ? 'End of free preview' : `Preview · first ${previewPages} pages`);
    },
  }).then((reader) => {
    ui.reader = reader;
    $('#readerTotal').textContent = `of ${reader.total}`;
  }).catch((err) => {
    console.error(err);
    stage.innerHTML = `<div style="display:grid;place-items:center;height:100%;padding:30px;text-align:center">
      <div><h3>Could not open this book</h3><p class="muted small mt-8">${escapeHtml(err?.message || 'Unknown error')}</p></div></div>`;
  });

  const close = () => {
    ui.reader?.destroy();
    ui.reader = null;
    shell.remove();
    document.body.style.overflow = '';
    store.saveProgress(b.id, { page: Number($('#readerPageInput')?.value) || 1 });
  };
  $('#readerBack').addEventListener('click', close);
  document.addEventListener('keydown', function onKey(e) {
    if (!document.getElementById('readerShell')) { document.removeEventListener('keydown', onKey); return; }
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') $('#readerNext').click();
    if (e.key === 'ArrowLeft') $('#readerPrev').click();
  });

  $('#readerNext').addEventListener('click', async () => {
    if (ui.atLimit && !ui.unlocked) { showPaywall(); return; }
    const ok = await ui.reader?.next();
    if (ok === false && !ui.unlocked) showPaywall();
  });
  $('#readerPrev').addEventListener('click', () => ui.reader?.prev());
  $('#readerZoomIn').addEventListener('click', () => ui.reader?.zoomIn());
  $('#readerZoomOut').addEventListener('click', () => ui.reader?.zoomOut());
  $('#readerPageInput').addEventListener('change', (e) => ui.reader?.goTo(Number(e.target.value)));
  $('#readerFull').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else shell.requestFullscreen?.().catch(() => {});
  });
  window.addEventListener('resize', () => ui.reader?.resize?.());

  /* Comments are reachable without leaving the page. */
  const openComments = () => openCommentsDrawer(ui.book);
  $('#readerComments').addEventListener('click', openComments);
  $('#footComments').addEventListener('click', openComments);

  const resume = store.getProgress(b.id);
  if (resume?.page > 1) {
    setTimeout(() => ui.reader?.goTo(resume.page), 700);
    toast(`Resumed at page ${resume.page}`, 'info', 2200);
  }
}

function showPaywall() {
  if ($('#paywallOverlay')) return;
  const overlay = el('div', { class: 'paywall', id: 'paywallOverlay', html: `
    <div class="paywall__box">
      <div class="paywall__icon" style="width:52px;height:52px;border-radius:var(--r-lg);background:var(--zoho-yellow);display:grid;place-items:center;margin:0 auto 14px;color:#3d2c00">${icon('crown')}</div>
      <h2>You have reached the free preview</h2>
      <p class="muted mt-8">Unlock “${escapeHtml(ui.book.title)}” to keep reading — one payment, yours for life.</p>
      <div class="row gap-8 mt-24" style="justify-content:center;flex-wrap:wrap">
        <button class="btn btn--gold btn--lg" id="paywallUnlock">${icon('crown')}<span>Unlock for ${money(ui.book.price || 0)}</span></button>
        <button class="btn btn--ghost btn--lg" id="paywallClose">Keep browsing</button>
      </div>
    </div>` });
  $('.reader-main').append(overlay);
  overlay.querySelector('#paywallUnlock').addEventListener('click', () => { overlay.remove(); openUnlockModal(); });
  overlay.querySelector('#paywallClose').addEventListener('click', () => { overlay.remove(); $('#readerBack')?.click(); });
}

/* -------------------------------------------------------------- States */
function detailSkeleton() {
  return `<div class="detail">
    <div class="skel" style="aspect-ratio:3/4;border-radius:8px"></div>
    <div class="stack gap-16" style="padding-top:10px">
      <div class="skel" style="height:34px;width:60%"></div>
      <div class="skel" style="height:18px;width:34%"></div>
      <div class="skel" style="height:64px"></div>
      <div class="skel" style="height:140px"></div>
    </div></div>`;
}
function notFound(msg) {
  return `<div class="empty" style="padding:120px 20px">${icon('book')}
    <h3>Book not available</h3><p>${escapeHtml(msg)}</p>
    <a class="btn btn--primary mt-16" href="./index.html">Back to the catalogue</a></div>`;
}

document.addEventListener('DOMContentLoaded', boot);

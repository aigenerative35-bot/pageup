/* PageUp — book detail page: metadata, ratings, likes, comments, reader */
import {
  renderHeader, initAuth, onSession, shareBook, requireAuth, actorId, actorProfile,
  openAuthModal, toast, money, $, el, icon, escapeHtml, initials,
} from './ui.js';
import * as store from './store.js';
import { bookThumb } from './cards.js';
import { openReader, detectFormat } from './reader.js';
import { formatCount, starRow, timeAgo } from './util.js';
import { siteConfig } from './firebase-config.js';

const ui = { book: null, unlocked: false, liked: false, myRating: 0, comments: [], reader: null, commentsUnsub: null, atLimit: false };

async function boot() {
  renderHeader();
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
  wireComments();

  onSession(async () => {
    store.setUid(actorId());
    ui.liked = await safe(() => store.isLiked(id, actorId()), false);
    ui.myRating = await safe(() => store.getMyRating(id, actorId()), 0);
    ui.unlocked = !book.isPremium || await safe(() => store.isUnlocked(id, actorId()), false);
    paintActions();
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
  const host = $('#bookDetail');
  const format = detectFormat(b);

  host.innerHTML = `
    <div class="detail">
      <div>
        <div class="detail__cover" id="coverBox"></div>
        <div class="mt-16" style="display:grid;gap:8px" id="coverActions"></div>
      </div>

      <div>
        <div class="row gap-8" style="flex-wrap:wrap;margin-bottom:14px" id="topBadges"></div>
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

        <div class="tabs" role="tablist">
          <button class="tab" role="tab" aria-selected="true"  data-tab="about">About</button>
          <button class="tab" role="tab" aria-selected="false" data-tab="comments">Comments <span id="tabCommentCount"></span></button>
        </div>

        <section id="tab-about">
          <p class="detail__desc">${escapeHtml(b.description || 'No description provided yet.')}</p>
          ${(b.tags || []).length ? `<div class="row gap-8" style="flex-wrap:wrap">${b.tags.map((t) => `<span class="chip" style="pointer-events:none">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
        </section>

        <section id="tab-comments" class="hidden"></section>
      </div>
    </div>`;

  $('#coverBox').append(bookThumb(b, { lazy: false }));
  paintBadges();
  paintStats();
  paintActions();
  wireTabs();
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
    ${b.isNew ? `<span class="badge">New</span>` : ''}
    ${ui.unlocked && b.isPremium ? `<span class="badge badge--free">${icon('check')}<span>Unlocked</span></span>` : ''}`;
}

function paintStats() {
  const b = ui.book;
  const host = $('#statRow');
  if (!host) return;
  const rating = b.ratingAvg || 0;
  host.innerHTML = `
    <div class="detail__stat">
      <b class="row gap-8">${rating ? rating.toFixed(1) : '—'} <span style="font-size:13px">${starRow(rating)}</span></b>
      <span>${formatCount(b.ratingCount || 0)} ratings</span>
    </div>
    <div class="detail__stat"><b>${formatCount(b.views || 0)}</b><span>reads</span></div>
    <div class="detail__stat"><b id="likeStatNum">${formatCount(b.likes || 0)}</b><span>likes</span></div>
    <div class="detail__stat"><b>${b.pages || '—'}</b><span>pages</span></div>`;
}

function paintActions() {
  const b = ui.book;
  const row = $('#actionRow');
  if (!row) return;
  row.innerHTML = '';

  const locked = b.isPremium && !ui.unlocked;

  const readBtn = el('button', { class: 'btn btn--primary btn--lg' }, [
    el('span', { html: locked ? icon('lock') : icon('play') }),
    el('span', { text: locked ? `Read free preview` : 'Read now' }),
  ]);
  readBtn.addEventListener('click', () => openBookReader());

  const likeBtn = el('button', { class: 'btn btn--outline btn--lg', 'aria-pressed': String(ui.liked) }, [
    el('span', { html: ui.liked ? icon('heartF') : icon('heart') }),
    el('span', { text: ui.liked ? 'Liked' : 'Like' }),
  ]);
  likeBtn.addEventListener('click', () => handleLike(likeBtn));

  const shareBtn = el('button', { class: 'btn btn--ghost btn--lg' }, [
    el('span', { html: icon('share') }), el('span', { text: 'Share' }),
  ]);
  shareBtn.addEventListener('click', () => shareBook(b));

  row.append(readBtn, likeBtn, shareBtn);

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
        <button class="btn btn--outline" id="gatePreview">${icon('eye')}<span>Continue free preview</span></button>
      </div>
    </div>`;
  $('#gateUnlock').addEventListener('click', openUnlockModal);
  $('#gatePreview').addEventListener('click', () => openBookReader());
}

function wireTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
      const target = tab.dataset.tab;
      $('#tab-about').classList.toggle('hidden', target !== 'about');
      $('#tab-comments').classList.toggle('hidden', target !== 'comments');
      if (target === 'comments') renderComments();
    });
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

/* ------------------------------------------------------------ Comments */
function wireComments() {
  if (ui.commentsUnsub) ui.commentsUnsub();
  ui.commentsUnsub = store.subscribeComments(ui.book.id, (items) => {
    ui.comments = items;
    const badge = $('#tabCommentCount');
    if (badge) badge.textContent = items.length ? `(${items.length})` : '';
    if (!$('#tab-comments').classList.contains('hidden')) renderComments();
  });
}

function renderComments() {
  const host = $('#tab-comments');
  if (!host) return;

  host.innerHTML = `
    <div class="stack gap-16">
      <div class="row gap-12" id="commentComposer"></div>
      <div id="commentList"></div>
    </div>`;

  const composer = $('#commentComposer');
  const me = actorProfile();
  composer.append(
    el('div', { class: 'avatar', html: me.photoURL ? `<img src="${escapeHtml(me.photoURL)}" alt="">` : escapeHtml(initials(me.displayName)) }),
    el('div', { style: 'flex:1' }, [
      el('textarea', { class: 'textarea', id: 'commentInput', placeholder: 'Share what you thought of this book…', rows: '3' }),
      el('div', { class: 'row gap-8 mt-8' }, [
        el('span', { class: 'hint', text: `${ui.comments.length} comment${ui.comments.length === 1 ? '' : 's'}` }),
        el('span', { class: 'spacer' }),
        el('button', { class: 'btn btn--primary btn--sm', id: 'commentSubmit', text: 'Post comment' }),
      ]),
    ]),
  );
  $('#commentSubmit').addEventListener('click', postComment);

  const list = $('#commentList');
  if (!ui.comments.length) {
    list.innerHTML = `<p class="muted small text-center" style="padding:30px 0">No comments yet — be the first to share your thoughts.</p>`;
    return;
  }
  ui.comments.forEach((c) => list.append(renderComment(c)));
}

function renderComment(c) {
  const canDelete = actorId() && c.uid === actorId();
  const node = el('div', { class: 'comment' });
  node.append(el('div', { class: 'avatar', html: c.photoURL ? `<img src="${escapeHtml(c.photoURL)}" alt="">` : escapeHtml(initials(c.name)) }));

  const body = el('div', { class: 'comment__body' });
  body.append(el('div', { class: 'comment__head' }, [
    el('span', { class: 'comment__name', text: c.name || 'Reader' }),
    el('span', { class: 'comment__time', text: timeAgo(c.createdAt) }),
  ]));
  body.append(el('div', { class: 'comment__text', text: c.text }));

  const actions = el('div', { class: 'comment__actions' });
  const likeBtn = el('button', { class: 'link-btn', type: 'button', html: `${icon('heart')}<span>${c.likes || 0}</span>` });
  likeBtn.addEventListener('click', async () => {
    if (!requireAuth('like comments')) return;
    try {
      const on = await store.toggleCommentLike(ui.book.id, c.id, actorId());
      likeBtn.classList.toggle('is-active', on);
      likeBtn.innerHTML = `${icon('heart')}<span>${Math.max(0, (c.likes || 0) + (on ? 1 : -1))}</span>`;
    } catch (err) { console.error(err); toast('Could not update', 'error'); }
  });
  actions.append(likeBtn);

  if (canDelete) {
    const del = el('button', { class: 'link-btn', type: 'button', html: `${icon('trash')}<span>Delete</span>` });
    del.addEventListener('click', async () => {
      try { await store.deleteComment(ui.book.id, c.id); toast('Comment deleted', 'info'); }
      catch (err) { console.error(err); toast('Could not delete', 'error'); }
    });
    actions.append(del);
  }
  body.append(actions);
  node.append(body);
  return node;
}

async function postComment() {
  if (!requireAuth('comment')) return;
  const input = $('#commentInput');
  const text = input.value.trim();
  if (!text) { toast('Write something first', 'info'); return; }
  const btn = $('#commentSubmit');
  btn.disabled = true;
  try {
    await store.addComment(ui.book.id, actorProfile(), text);
    input.value = '';
    toast('Comment posted', 'success');
  } catch (err) { console.error(err); toast('Could not post comment', 'error'); }
  finally { btn.disabled = false; }
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

    <div class="meta-list" style="grid-template-columns:1fr 1fr">
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
    </p>`;

  modal.querySelector('#unlockClose').onclick = () => overlay.remove();
  modal.querySelector('#payNow').onclick = async (e) => {
    e.target.closest('button').disabled = true;
    const ok = await startCheckout(b);
    if (ok) {
      await store.recordPurchase(b.id, actorId(), { amount: price, currency: siteConfig.currency, method: siteConfig.razorpayKeyId ? 'razorpay' : 'demo' });
      ui.unlocked = true;
      overlay.remove();
      paintActions();
      paintBadges();
      toast('Unlocked — enjoy the full book', 'success');
    } else {
      e.target.closest('button').disabled = false;
    }
  };
}

/** Razorpay checkout when a key is configured; otherwise a demo confirm. */
function startCheckout(book) {
  const price = Number(book.price || 0) * 100; // paise
  if (!siteConfig.razorpayKeyId) {
    return new Promise((resolve) => setTimeout(() => resolve(true), 600));
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => {
      const rzp = new window.Razorpay({
        key: siteConfig.razorpayKeyId,
        amount: price,
        currency: siteConfig.currency,
        name: siteConfig.name,
        description: book.title,
        theme: { color: '#4f46e5' },
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
      <span id="readerPercent">0%</span>
    </div>` });

  document.body.append(shell);
  document.body.style.overflow = 'hidden';

  const stage = $('#readerStage');

  openReader({
    book: b,
    stage,
    previewPages,
    unlocked: ui.unlocked,
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
      // For a locked book the next button stays live so the reader can be
      // invited to unlock — it is never disabled out from under them.
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
    if (e.key === 'ArrowRight') ui.reader?.next();
    if (e.key === 'ArrowLeft') ui.reader?.prev();
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
      <div class="paywall__icon" style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#f59e0b,#f97316);
                  display:grid;place-items:center;margin:0 auto 16px;color:#fff">${icon('crown')}</div>
      <h2 style="font-size:22px">You have reached the free preview</h2>
      <p class="muted mt-8">Unlock “${escapeHtml(ui.book.title)}” to keep reading — one payment, yours for life.</p>
      <div class="row gap-8 mt-24" style="justify-content:center;flex-wrap:wrap">
        <button class="btn btn--gold btn--lg" id="paywallUnlock">${icon('crown')}<span>Unlock for ${money(ui.book.price || 0)}</span></button>
        <button class="btn btn--outline btn--lg" id="paywallClose">Keep browsing</button>
      </div>
    </div>` });
  $('#readerStage').parentElement.append(overlay);
  overlay.querySelector('#paywallUnlock').addEventListener('click', () => { overlay.remove(); openUnlockModal(); });
  overlay.querySelector('#paywallClose').addEventListener('click', () => { overlay.remove(); $('#readerBack')?.click(); });
}

/* -------------------------------------------------------------- States */
function detailSkeleton() {
  return `<div class="detail">
    <div class="skel" style="aspect-ratio:3/4.1;border-radius:18px"></div>
    <div class="stack gap-16" style="padding-top:10px">
      <div class="skel" style="height:38px;width:60%"></div>
      <div class="skel" style="height:20px;width:34%"></div>
      <div class="skel" style="height:70px"></div>
      <div class="skel" style="height:140px"></div>
    </div></div>`;
}
function notFound(msg) {
  return `<div class="empty" style="padding:120px 20px">${icon('book')}
    <h3>Book not available</h3><p>${escapeHtml(msg)}</p>
    <a class="btn btn--primary mt-16" href="./index.html">Back to the library</a></div>`;
}

document.addEventListener('DOMContentLoaded', boot);

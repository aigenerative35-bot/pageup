/* ==========================================================================
   PageUp — single-file preview controller
   Classic script (no modules, no network) so the page runs straight from
   file:// by double-clicking. Uses the exact same stylesheet and card
   component as the real app; only the data layer is swapped for localStorage.
   ========================================================================== */
(function () {
  'use strict';

  var LS_KEY = 'pageup:preview:state';

  /* small helpers that live in ui.js in the full app */
  function money(amount) {
    return '\u20B9' + (Number(amount) || 0).toLocaleString('en-IN');
  }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  }

  /* ------------------------------------------------------------ state ---- */
  var blank = function () {
    return { likes: {}, ratings: {}, comments: {}, purchases: {}, progress: {}, theme: null };
  };
  var state = blank();
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) state = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* private mode — run in memory */ }

  function save() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
  }

  var GUEST = 'guest';
  var sort = 'trending';
  var category = 'all';
  var search = '';

  var VIEW = document.getElementById('view');
  var CATEGORIES = [];

  /* ------------------------------------------------------- demo helpers -- */
  function bookById(id) {
    for (var i = 0; i < DEMO_BOOKS.length; i++) if (DEMO_BOOKS[i].id === id) return DEMO_BOOKS[i];
    return null;
  }

  function likesOf(id) { return state.likes[id] || (state.likes[id] = {}); }
  function ratingsOf(id) { return state.ratings[id] || (state.ratings[id] = {}); }
  function purchasesOf(id) { return state.purchases[id] || (state.purchases[id] = {}); }

  /** A book merged with this browser's local interactions. */
  function view(id) {
    var b = bookById(id);
    if (!b) return null;
    var r = ratingsOf(id);
    var values = Object.keys(r).map(function (k) { return r[k]; });
    var extra = values.reduce(function (a, v) { return a + v; }, 0);
    var count = (b.ratingCount || 0) + values.length;
    var sum = (b.ratingSum || 0) + extra;
    var liked = Object.keys(likesOf(id)).length;
    return Object.assign({}, b, {
      likes: (b.likes || 0) + liked,
      ratingSum: sum,
      ratingCount: count,
      ratingAvg: count ? +(sum / count).toFixed(2) : 0,
      liked: !!likesOf(id)[GUEST],
      myRating: r[GUEST] || 0,
      unlocked: !b.isPremium || !!purchasesOf(id)[GUEST],
    });
  }

  function catalogue() {
    var items = DEMO_BOOKS.map(function (b) { return view(b.id); });
    if (category !== 'all') {
      items = items.filter(function (b) { return b.category.toLowerCase() === category.toLowerCase(); });
    }
    if (search) {
      var q = search.toLowerCase();
      items = items.filter(function (b) {
        return b.title.toLowerCase().indexOf(q) > -1 ||
               b.author.toLowerCase().indexOf(q) > -1 ||
               (b.tags || []).some(function (t) { return t.toLowerCase().indexOf(q) > -1; });
      });
    }
    var key = {
      newest: function (b) { return -(b.publishedYear || 0); },
      rating: function (b) { return b.ratingAvg; },
      views: function (b) { return b.views; },
      likes: function (b) { return b.likes; },
      trending: function (b) { return b.trendScore; }
    }[sort] || function (b) { return b.trendScore; };
    return items.sort(function (a, b) { return key(b) - key(a); });
  }

  function categories() {
    var seen = {};
    DEMO_BOOKS.forEach(function (b) { seen[b.category] = (seen[b.category] || 0) + 1; });
    return Object.keys(seen).sort(function (a, b) { return seen[b] - seen[a]; });
  }

  var SEED_COMMENTS = [
    { name: 'Ananya Rao', text: 'Finished this in two sittings. The pacing in the middle chapters is superb.', likes: 24, hours: 30 },
    { name: 'Vikram Shah', text: 'The annotations in this edition really help if you are reading it for the first time.', likes: 11, hours: 74 },
    { name: 'Priya Menon', text: 'Read it on the train every morning. Highly recommend the EPUB version for the typography.', likes: 6, hours: 210 }
  ];

  function commentsOf(id) {
    var mine = (state.comments[id] || []).map(function (c) {
      return Object.assign({}, c, { createdAt: new Date(c.createdAt) });
    });
    var seed = SEED_COMMENTS.map(function (c, i) {
      return {
        id: 'seed-' + i, name: c.name, text: c.text, likes: c.likes,
        createdAt: new Date(Date.now() - c.hours * 3600 * 1000), seeded: true
      };
    });
    return mine.concat(seed).sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  /* ------------------------------------------------------------- header -- */
  function renderHeader() {
    var host = document.getElementById('appHeader');
    host.innerHTML =
      '<header class="app-header"><div class="container">' +
        '<a class="brand" href="#/" aria-label="PageUp home">' +
          '<span class="brand__mark">' + icon('book') + '</span>' +
          '<span class="brand__name">Page<span>Up</span></span>' +
        '</a>' +
        '<form class="search" id="searchForm" role="search">' +
          '<span class="search__icon">' + icon('search') + '</span>' +
          '<input class="search__input" id="searchInput" type="search" placeholder="Search books, authors, topics..." aria-label="Search books" autocomplete="off" value="' + escapeHtml(search) + '">' +
          '<button class="search__clear' + (search ? '' : ' hidden') + '" id="searchClear" type="button" aria-label="Clear search">' + icon('close') + '</button>' +
        '</form>' +
        '<div class="header-actions">' +
          '<button class="icon-btn" id="themeToggle" type="button" aria-label="Toggle theme"></button>' +
          '<button class="btn btn--ghost btn--sm" id="navSignIn" type="button">' + icon('user') + '<span>Sign in</span></button>' +
        '</div>' +
      '</div></header>';

    applyTheme();

    $('#themeToggle').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next); state.theme = next; save();
    });
    $('#navSignIn').addEventListener('click', previewNotice);

    var input = $('#searchInput');
    var clear = $('#searchClear');
    var run = debounce(function () {
      search = input.value.trim();
      clear.classList.toggle('hidden', !input.value);
      if (route().name === 'home') paintHome();
      else location.hash = '#/';
    }, 260);
    input.addEventListener('input', run);
    clear.addEventListener('click', function () {
      input.value = ''; search = ''; clear.classList.add('hidden'); input.focus();
      if (route().name === 'home') paintHome(); else location.hash = '#/';
    });
    $('#searchForm').addEventListener('submit', function (e) { e.preventDefault(); run(); });
  }

  function applyTheme(force) {
    var t = force || state.theme ||
      (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    var btn = $('#themeToggle');
    if (btn) btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
  }

  function previewNotice() {
    modal(
      'Static preview',
      '<p class="small muted">This single HTML file is a design and interaction preview. There is no ' +
      'account system here — likes, ratings, comments and unlocks are stored in this browser\'s localStorage only.</p>' +
      '<ul class="small muted" style="line-height:2;margin-top:12px">' +
        '<li>' + icon('check') + 'Real sign-in: Google + email/password</li>' +
        '<li>' + icon('check') + 'Real data: Firestore, shared across devices</li>' +
        '<li>' + icon('check') + 'Real reading: EPUB and PDF streamed from Storage</li>' +
        '<li>' + icon('check') + 'Real payments: Razorpay checkout</li>' +
      '</ul>' +
      '<p class="hint" style="margin-top:14px">The full app is in the <b>pageup</b> repository.</p>',
      'Got it'
    );
  }

  /* --------------------------------------------------------------- home -- */
  function renderHome() {
    var total = DEMO_BOOKS.length;
    var reads = DEMO_BOOKS.reduce(function (a, b) { return a + (b.views || 0); }, 0);
    var free = DEMO_BOOKS.filter(function (b) { return !b.isPremium; }).length;

    VIEW.innerHTML =
      '<section class="hero">' +
        '<span class="hero__eyebrow">Freemium reading, built for India</span>' +
        '<h1>Read unlimited previews. Pay only for the books you love.</h1>' +
        '<p>PageUp is a modern online reader. Start any book free — no card, no signup wall. ' +
          'When a story grabs you, unlock it once and keep it for life.</p>' +
        '<div class="hero__actions">' +
          '<a class="btn btn--lg" style="background:#fff;color:#312e81" href="#catalogue">' + icon('grid') + '<span>Browse the library</span></a>' +
          '<a class="btn btn--lg" style="background:rgba(255,255,255,.14);color:#fff;border:1px solid rgba(255,255,255,.3)" href="#/book/demo-meditations">' + icon('play') + '<span>Start reading free</span></a>' +
        '</div>' +
        '<div class="hero__stats">' +
          '<div class="hero__stat"><b>' + total + '</b><span>Titles in catalogue</span></div>' +
          '<div class="hero__stat"><b>' + compact(reads) + '</b><span>Reads on PageUp</span></div>' +
          '<div class="hero__stat"><b>' + free + '</b><span>Free to read now</span></div>' +
          '<div class="hero__stat"><b>EPUB + PDF</b><span>Both formats supported</span></div>' +
        '</div>' +
      '</section>' +
      '<section id="catalogue">' +
        '<div class="section-head" style="margin-top:8px">' +
          '<div><h2>Explore the catalogue</h2><p id="resultMeta" class="hidden"></p></div>' +
          '<div class="row gap-12">' +
            '<label class="sr-only" for="sortSelect">Sort books</label>' +
            '<select class="select" id="sortSelect" style="width:auto;height:38px">' +
              '<option value="trending">Trending</option><option value="newest">Newest</option>' +
              '<option value="rating">Top rated</option><option value="views">Most read</option>' +
              '<option value="likes">Most liked</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="chipbar" id="chipbar" role="group" aria-label="Filter by category"></div>' +
        '<div class="grid" id="bookGrid" style="margin-top:22px"></div>' +
      '</section>' +
      '<section style="padding:20px 0 40px">' +
        '<div class="section-head"><div><h2>How the freemium model works</h2>' +
        '<p>Simple for readers, sustainable for publishers.</p></div></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:18px">' +
          '<div class="gate" style="margin:0"><h3>1 &middot; Preview anything</h3>' +
            '<p class="mb-0">Every premium book opens with a free preview — enough pages to know whether it is for you. No payment, no signup.</p></div>' +
          '<div class="gate" style="margin:0"><h3>2 &middot; Unlock what you love</h3>' +
            '<p class="mb-0">Pay once per book through UPI, cards or netbanking. The title lands in your library permanently.</p></div>' +
          '<div class="gate" style="margin:0"><h3>3 &middot; Read anywhere</h3>' +
            '<p class="mb-0">Streamed EPUB and PDF reading in the browser, with your page position saved across devices.</p></div>' +
        '</div>' +
      '</section>';

    $('#sortSelect').value = sort;
    $('#sortSelect').addEventListener('change', function (e) { sort = e.target.value; paintHome(); });

    CATEGORIES = categories();
    paintChips();
    paintGrid();
  }

  function paintChips() {
    var host = $('#chipbar');
    if (!host) return;
    host.innerHTML = '';
    var list = [{ name: 'all', label: 'All books' }].concat(CATEGORIES.map(function (c) { return { name: c, label: c }; }));
    list.forEach(function (c) {
      var btn = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(category === c.name), text: c.label });
      btn.addEventListener('click', function () { category = c.name; paintChips(); paintGrid(); });
      host.append(btn);
    });
  }

  function paintHome() {
    CATEGORIES = categories();
    paintChips();
    paintGrid();
  }

  function paintGrid() {
    var grid = $('#bookGrid');
    if (!grid) return;
    grid.innerHTML = '';
    var items = catalogue();

    var meta = $('#resultMeta');
    if (meta) {
      var bits = [items.length + ' book' + (items.length === 1 ? '' : 's')];
      if (search) bits.push('for \u201C' + search + '\u201D');
      if (category !== 'all') bits.push('in ' + category);
      meta.textContent = bits.join(' ');
      meta.classList.toggle('hidden', items.length === 0 && !search);
    }

    if (!items.length) {
      grid.append(el('div', { class: 'empty', html: icon('search') +
        '<h3>No books matched</h3><p>Try a different search term or clear the category filter.</p>' }));
      return;
    }

    items.forEach(function (book) {
      grid.append(renderBookCard(book, {
        liked: book.liked,
        unlocked: book.unlocked,
        onLike: onLike,
        onShare: onShare
      }));
    });
  }

  /* ------------------------------------------------------------- detail -- */
  function renderDetail(id) {
    var b = view(id);
    if (!b) {
      VIEW.innerHTML = '<div class="empty" style="padding:120px 20px">' + icon('book') +
        '<h3>Book not available</h3><p>This title is not in the preview catalogue.</p>' +
        '<a class="btn btn--primary mt-16" href="#/">Back to the library</a></div>';
      return;
    }
    document.title = b.title + ' \u2014 PageUp';

    var locked = b.isPremium && !b.unlocked;
    var rating = b.ratingAvg || 0;

    VIEW.innerHTML =
      '<div class="detail">' +
        '<div>' +
          '<div class="detail__cover" id="coverBox"></div>' +
        '</div>' +
        '<div>' +
          '<div class="row gap-8" style="flex-wrap:wrap;margin-bottom:14px">' +
            '<span class="badge badge--' + b.format + '">' + b.format.toUpperCase() + '</span>' +
            (b.isPremium
              ? '<span class="badge badge--premium">' + icon('crown') + '<span>Premium</span></span>'
              : '<span class="badge badge--free">Free to read</span>') +
            (b.unlocked && b.isPremium ? '<span class="badge badge--free">' + icon('check') + '<span>Unlocked</span></span>' : '') +
          '</div>' +
          '<h1>' + escapeHtml(b.title) + '</h1>' +
          '<p class="detail__author">by <b>' + escapeHtml(b.author) + '</b></p>' +
          '<div class="detail__stats" id="statRow"></div>' +
          '<div id="gateBox"></div>' +
          '<div class="detail__actions" id="actionRow"></div>' +
          '<dl class="meta-list">' +
            '<div><dt>Format</dt><dd>' + b.format.toUpperCase() + '</dd></div>' +
            '<div><dt>Pages</dt><dd>' + (b.pages || '\u2014') + '</dd></div>' +
            '<div><dt>Language</dt><dd>' + escapeHtml(b.language) + '</dd></div>' +
            '<div><dt>Publisher</dt><dd>' + escapeHtml(b.publisher) + '</dd></div>' +
            '<div><dt>Published</dt><dd>' + escapeHtml(String(b.publishedYear)) + '</dd></div>' +
            '<div><dt>Category</dt><dd>' + escapeHtml(b.category) + '</dd></div>' +
          '</dl>' +
          '<div class="tabs" role="tablist">' +
            '<button class="tab" role="tab" aria-selected="true" data-tab="about">About</button>' +
            '<button class="tab" role="tab" aria-selected="false" data-tab="comments">Comments <span id="tabCommentCount"></span></button>' +
          '</div>' +
          '<section id="tab-about">' +
            '<p class="detail__desc">' + escapeHtml(b.description) + '</p>' +
            '<div class="row gap-8" style="flex-wrap:wrap">' +
              (b.tags || []).map(function (t) { return '<span class="chip" style="pointer-events:none">' + escapeHtml(t) + '</span>'; }).join('') +
            '</div>' +
            '<div class="mt-24"><h3 style="font-size:15px;margin-bottom:8px">Free sample</h3>' +
              '<div class="gate" style="margin:0"><p style="font-family:var(--font-read);font-size:16px;line-height:1.8;margin:0;white-space:pre-wrap">' +
                escapeHtml((b.textContent || '').slice(0, 320)) + '\u2026</p></div>' +
            '</div>' +
          '</section>' +
          '<section id="tab-comments" class="hidden"></section>' +
        '</div>' +
      '</div>';

    $('#coverBox').append(bookThumb(b, { lazy: false }));
    paintStats(b, rating);
    paintActions(b, locked);
    wireTabs(b);
  }

  function paintStats(b, rating) {
    var host = $('#statRow');
    if (!host) return;
    host.innerHTML =
      '<div class="detail__stat"><b class="row gap-8">' + (rating ? rating.toFixed(1) : '\u2014') +
        ' <span style="font-size:13px">' + starRow(rating) + '</span></b>' +
        '<span>' + formatCount(b.ratingCount) + ' ratings</span></div>' +
      '<div class="detail__stat"><b>' + formatCount(b.views) + '</b><span>reads</span></div>' +
      '<div class="detail__stat"><b id="likeStatNum">' + formatCount(b.likes) + '</b><span>likes</span></div>' +
      '<div class="detail__stat"><b>' + (b.pages || '\u2014') + '</b><span>pages</span></div>';
  }

  function paintActions(b, locked) {
    var row = $('#actionRow');
    if (!row) return;
    row.innerHTML = '';

    var read = el('button', { class: 'btn btn--primary btn--lg' }, [
      el('span', { html: locked ? icon('lock') : icon('play') }),
      el('span', { text: locked ? 'Read free preview' : 'Read now' })
    ]);
    read.addEventListener('click', function () { openReader(b.id); });

    var like = el('button', { class: 'btn btn--outline btn--lg', 'aria-pressed': String(b.liked) }, [
      el('span', { html: b.liked ? icon('heartF') : icon('heart') }),
      el('span', { text: b.liked ? 'Liked' : 'Like' })
    ]);
    like.addEventListener('click', function () { onLike(b, like); });

    var share = el('button', { class: 'btn btn--ghost btn--lg' }, [
      el('span', { html: icon('share') }), el('span', { text: 'Share' })
    ]);
    share.addEventListener('click', function () { onShare(b); });

    row.append(read, like, share);

    if (locked) {
      var unlock = el('button', { class: 'btn btn--gold btn--lg' }, [
        el('span', { html: icon('crown') }),
        el('span', { text: 'Unlock for ' + money(b.price) })
      ]);
      unlock.addEventListener('click', function () { openUnlock(b.id); });
      row.append(unlock);
    }

    /* premium gate block */
    var gate = $('#gateBox');
    gate.innerHTML = '';
    if (b.isPremium && !b.unlocked) {
      gate.innerHTML =
        '<div class="gate"><h3>' + icon('crown') + ' Premium title</h3>' +
        '<p>Read the free sample, then unlock the full book for <b>' + money(b.price) + '</b> \u2014 ' +
        'one-time, yours forever, no subscription.</p>' +
        '<div class="row gap-8" style="flex-wrap:wrap">' +
          '<button class="btn btn--gold" id="gateUnlock">' + icon('crown') + '<span>Unlock full book</span></button>' +
          '<button class="btn btn--outline" id="gatePreview">' + icon('eye') + '<span>Continue free preview</span></button>' +
        '</div></div>';
      $('#gateUnlock').addEventListener('click', function () { openUnlock(b.id); });
      $('#gatePreview').addEventListener('click', function () { openReader(b.id); });
    }
  }

  function wireTabs(b) {
    var tabs = document.querySelectorAll('.tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      tab.addEventListener('click', function () {
        Array.prototype.forEach.call(tabs, function (t) {
          t.setAttribute('aria-selected', String(t === tab));
        });
        var target = tab.getAttribute('data-tab');
        $('#tab-about').classList.toggle('hidden', target !== 'about');
        $('#tab-comments').classList.toggle('hidden', target !== 'comments');
        if (target === 'comments') renderComments(b.id);
      });
    });
    var count = document.getElementById('tabCommentCount');
    if (count) {
      var n = commentsOf(b.id).length;
      count.textContent = n ? '(' + n + ')' : '';
    }
  }

  /* ----------------------------------------------------------- comments -- */
  function renderComments(bookId) {
    var host = $('#tab-comments');
    if (!host) return;
    host.innerHTML =
      '<div class="stack gap-16">' +
        '<div class="row gap-12">' +
          '<div class="avatar">G</div>' +
          '<div style="flex:1">' +
            '<textarea class="textarea" id="commentInput" rows="3" placeholder="Share what you thought of this book..."></textarea>' +
            '<div class="row gap-8 mt-8"><span class="hint" id="commentCount"></span><span class="spacer"></span>' +
            '<button class="btn btn--primary btn--sm" id="commentSubmit">Post comment</button></div>' +
          '</div>' +
        '</div>' +
        '<div id="commentList"></div>' +
      '</div>';

    $('#commentSubmit').addEventListener('click', function () {
      var input = $('#commentInput');
      var text = input.value.trim();
      if (!text) { toast('Write something first', 'info'); return; }
      var list = state.comments[bookId] || (state.comments[bookId] = []);
      list.unshift({
        id: 'c-' + Date.now(), name: 'Guest reader', text: text.slice(0, 2000),
        likes: 0, createdAt: new Date().toISOString()
      });
      save();
      input.value = '';
      renderComments(bookId);
      toast('Comment posted', 'success');
    });

    var items = commentsOf(bookId);
    var listHost = $('#commentList');
    var cc = $('#commentCount');
    if (cc) cc.textContent = items.length + ' comment' + (items.length === 1 ? '' : 's');

    if (!items.length) {
      listHost.innerHTML = '<p class="muted small text-center" style="padding:30px 0">No comments yet \u2014 be the first.</p>';
      return;
    }
    items.forEach(function (c) { listHost.append(renderComment(bookId, c)); });
  }

  function renderComment(bookId, c) {
    var node = el('div', { class: 'comment' });
    node.append(el('div', { class: 'avatar', text: initials(c.name) }));

    var body = el('div', { class: 'comment__body' });
    body.append(el('div', { class: 'comment__head' }, [
      el('span', { class: 'comment__name', text: c.name }),
      el('span', { class: 'comment__time', text: timeAgo(c.createdAt) })
    ]));
    body.append(el('div', { class: 'comment__text', text: c.text }));

    var actions = el('div', { class: 'comment__actions' });
    var likeBtn = el('button', { class: 'link-btn', type: 'button', html: icon('heart') + '<span>' + (c.likes || 0) + '</span>' });
    likeBtn.addEventListener('click', function () {
      c.likes = (c.likes || 0) + 1;
      if (!c.seeded) {
        var mine = (state.comments[bookId] || []).filter(function (x) { return x.id === c.id; })[0];
        if (mine) mine.likes = c.likes;
        save();
      }
      likeBtn.innerHTML = icon('heart') + '<span>' + c.likes + '</span>';
      likeBtn.classList.add('is-active');
    });
    actions.append(likeBtn);

    if (!c.seeded) {
      var del = el('button', { class: 'link-btn', type: 'button', html: icon('trash') + '<span>Delete</span>' });
      del.addEventListener('click', function () {
        state.comments[bookId] = (state.comments[bookId] || []).filter(function (x) { return x.id !== c.id; });
        save();
        renderComments(bookId);
        toast('Comment deleted', 'info');
      });
      actions.append(del);
    }

    body.append(actions);
    node.append(body);
    return node;
  }

  /* -------------------------------------------------------------- likes -- */
  function onLike(book, btn) {
    var map = likesOf(book.id);
    var now = !map[GUEST];
    if (now) map[GUEST] = true; else delete map[GUEST];
    save();

    if (btn) {
      btn.setAttribute('aria-pressed', String(now));
      var first = btn.firstElementChild;
      if (first) first.innerHTML = now ? icon('heartF') : icon('heart');
      var counter = btn.querySelector('.js-like-count');
      if (counter) counter.textContent = formatCount(Math.max(0, (book.likes || 0) + (now ? 1 : -1)));
    }
    if (route().name === 'detail') {
      var fresh = view(book.id);
      var stat = $('#likeStatNum');
      if (stat) stat.textContent = formatCount(fresh.likes);
      var likeBtn = document.querySelector('#actionRow button[aria-pressed]');
      if (likeBtn) {
        likeBtn.setAttribute('aria-pressed', String(fresh.liked));
        likeBtn.innerHTML = '<span>' + (fresh.liked ? icon('heartF') : icon('heart')) + '</span><span>' +
          (fresh.liked ? 'Liked' : 'Like') + '</span>';
      }
    }
    toast(now ? 'Added to your likes' : 'Removed from likes', now ? 'success' : 'info', 1600);
  }

  function onShare(book) {
    var url = location.href.split('#')[0] + '#/book/' + book.id;
    if (navigator.share) {
      navigator.share({ title: book.title + ' \u2014 PageUp', text: 'Read "' + book.title + '" on PageUp', url: url })
        .catch(function () {});
      return;
    }
    copyToClipboard(url).then(function () { toast('Link copied to clipboard', 'success'); });
  }

  /* ----------------------------------------------------------- unlocking -- */
  function openUnlock(id) {
    var b = view(id);
    modal('Unlock \u201C' + b.title + '\u201D',
      '<p class="small muted">One-time purchase. Read it forever on every device.</p>' +
      '<div class="meta-list" style="grid-template-columns:1fr 1fr;margin-top:16px">' +
        '<div><dt>Price</dt><dd>' + money(b.price) + '</dd></div>' +
        '<div><dt>Access</dt><dd>Lifetime</dd></div>' +
        '<div><dt>Format</dt><dd>' + b.format.toUpperCase() + '</dd></div>' +
        '<div><dt>Devices</dt><dd>Unlimited</dd></div>' +
      '</div>' +
      '<ul class="small muted" style="line-height:2;margin-top:8px">' +
        '<li>' + icon('check') + 'Full book, no page limits</li>' +
        '<li>' + icon('check') + 'Read online, resume where you left off</li>' +
        '<li>' + icon('check') + 'Offline reading in the PageUp app</li>' +
      '</ul>' +
      '<button class="btn btn--gold btn--block btn--lg mt-16" id="payNow">' + icon('crown') +
        '<span>Pay ' + money(b.price) + ' and unlock</span></button>' +
      '<p class="hint text-center mt-8">Preview only \u2014 no real payment is taken here. ' +
      'The full app wires this to Razorpay.</p>',
      null,
      function (root) {
        root.querySelector('#payNow').addEventListener('click', function () {
          purchasesOf(id)[GUEST] = true;
          save();
          closeModal();
          renderDetail(id);
          toast('Unlocked \u2014 enjoy the full book', 'success');
        });
      });
  }

  /* -------------------------------------------------------------- reader -- */
  var reader = null;

  function openReader(id) {
    if (reader) return;
    var b = view(id);
    var PER_PAGE = 700;
    var paragraphs = String(b.textContent || '').split(/\n{2,}/).filter(Boolean);
    var pages = [];
    var buf = '';
    paragraphs.forEach(function (p) {
      if ((buf + '\n\n' + p).length > PER_PAGE && buf) { pages.push(buf); buf = p; }
      else buf = buf ? buf + '\n\n' + p : p;
    });
    if (buf) pages.push(buf);
    if (!pages.length) pages = ['No sample text for this title.'];

    var total = pages.length;
    var limit = b.unlocked ? total : (b.isPremium ? Math.max(1, Math.floor(total * 0.6)) : total);
    var page = Math.min(state.progress[id] || 1, limit);

    var shell = el('div', { class: 'reader-shell', id: 'readerShell', html:
      '<div class="reader-bar">' +
        '<button class="icon-btn" id="readerBack" aria-label="Close reader">' + icon('left') + '</button>' +
        '<div style="min-width:0"><div class="reader-bar__title">' + escapeHtml(b.title) + '</div>' +
        '<div class="reader-bar__sub" id="readerSub"></div></div>' +
        '<span class="spacer"></span>' +
        '<button class="icon-btn" id="readerZoomOut" aria-label="Zoom out">' + icon('zoomOut') + '</button>' +
        '<button class="icon-btn" id="readerZoomIn" aria-label="Zoom in">' + icon('zoomIn') + '</button>' +
        '<button class="icon-btn" id="readerFull" aria-label="Toggle fullscreen">' + icon('grid') + '</button>' +
      '</div>' +
      '<div class="reader-progress"><div class="reader-progress__bar" id="readerBar"></div></div>' +
      '<div class="reader-main">' +
        '<button class="reader-nav reader-nav--prev" id="readerPrev" aria-label="Previous page">' + icon('left') + '</button>' +
        '<div class="reader-stage" id="readerStage"></div>' +
        '<button class="reader-nav" id="readerNext" aria-label="Next page">' + icon('right') + '</button>' +
      '</div>' +
      '<div class="reader-foot"><span>Page</span>' +
        '<input class="page-input" id="readerPageInput" type="number" min="1" value="' + page + '" aria-label="Go to page">' +
        '<span id="readerTotal">of ' + total + '</span><span class="spacer"></span>' +
        '<span id="readerPercent">0%</span></div>' });

    document.body.append(shell);
    document.body.style.overflow = 'hidden';
    var stage = $('#readerStage');

    stage.innerHTML = '<div style="max-width:720px;margin:0 auto;padding:36px 24px 80px">' +
      '<div id="textPage" style="font-family:var(--font-read);font-size:19px;line-height:1.85;color:var(--text)"></div></div>';
    var textPage = $('#textPage');

    var atLimit = false;

    function paint() {
      textPage.innerHTML = pages[page - 1].split(/\n{2,}/).map(function (p) {
        return '<p style="margin:0 0 1.1em">' + escapeHtml(p) + '</p>';
      }).join('');
      stage.scrollTop = 0;

      var percent = Math.round((page / total) * 100);
      atLimit = !b.unlocked && page >= limit;
      $('#readerBar').style.width = percent + '%';
      $('#readerPercent').textContent = atLimit ? 'Preview ended' : percent + '%';
      $('#readerTotal').textContent = 'of ' + total;
      var input = $('#readerPageInput');
      if (document.activeElement !== input) input.value = page;
      $('#readerPrev').disabled = page <= 1;
      $('#readerNext').disabled = b.unlocked && page >= total;
      $('#readerNext').innerHTML = icon(atLimit ? 'lock' : 'right');
      $('#readerNext').classList.toggle('reader-nav--locked', atLimit);
      $('#readerSub').textContent = b.unlocked
        ? (b.author + ' \u00b7 preview reader')
        : (atLimit ? 'End of free sample' : 'Free sample');
      state.progress[id] = page;
      save();
    }
    paint();

    function close() {
      shell.remove();
      document.body.style.overflow = '';
      reader = null;
    }
    reader = { close: close };

    $('#readerBack').addEventListener('click', close);
    $('#readerPrev').addEventListener('click', function () { if (page > 1) { page--; paint(); } });
    $('#readerNext').addEventListener('click', function () {
      if (atLimit) { paywall(); return; }
      if (page < limit) { page++; paint(); }
      else if (!b.unlocked) paywall();
    });
    $('#readerZoomIn').addEventListener('click', function () {
      textPage.style.fontSize = Math.min(30, parseFloat(getComputedStyle(textPage).fontSize) + 2) + 'px';
    });
    $('#readerZoomOut').addEventListener('click', function () {
      textPage.style.fontSize = Math.max(14, parseFloat(getComputedStyle(textPage).fontSize) - 2) + 'px';
    });
    $('#readerPageInput').addEventListener('change', function (e) {
      var n = Math.min(limit, Math.max(1, Math.round(Number(e.target.value) || 1)));
      page = n; paint();
    });
    $('#readerFull').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (shell.requestFullscreen) shell.requestFullscreen().catch(function () {});
    });
    document.addEventListener('keydown', function onKey(e) {
      if (!document.getElementById('readerShell')) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') $('#readerNext').click();
      if (e.key === 'ArrowLeft') $('#readerPrev').click();
    });

    function paywall() {
      if ($('#paywallOverlay')) return;
      var overlay = el('div', { class: 'paywall', id: 'paywallOverlay', html:
        '<div class="paywall__box">' +
          '<div class="paywall__icon" style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#f59e0b,#f97316);display:grid;place-items:center;margin:0 auto 16px;color:#fff">' + icon('crown') + '</div>' +
          '<h2 style="font-size:22px">You have reached the free preview</h2>' +
          '<p class="muted mt-8">Unlock \u201C' + escapeHtml(b.title) + '\u201D to keep reading \u2014 one payment, yours for life.</p>' +
          '<div class="row gap-8 mt-24" style="justify-content:center;flex-wrap:wrap">' +
            '<button class="btn btn--gold btn--lg" id="paywallUnlock">' + icon('crown') + '<span>Unlock for ' + money(b.price) + '</span></button>' +
            '<button class="btn btn--outline btn--lg" id="paywallClose">Keep browsing</button>' +
          '</div>' +
        '</div>' });
      $('.reader-main').append(overlay);
      overlay.querySelector('#paywallUnlock').addEventListener('click', function () {
        overlay.remove(); close(); openUnlock(id);
      });
      overlay.querySelector('#paywallClose').addEventListener('click', function () { overlay.remove(); close(); });
    }
  }

  /* -------------------------------------------------------------- modal -- */
  var modalEl = null;
  function modal(title, bodyHtml, okLabel, onMount) {
    closeModal();
    modalEl = el('div', { class: 'overlay', html:
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal__head"><div style="flex:1"><h3>' + escapeHtml(title) + '</h3></div>' +
        '<button class="icon-btn" data-close aria-label="Close">' + icon('close') + '</button></div>' +
        '<div data-body>' + bodyHtml + '</div>' +
        (okLabel ? '<button class="btn btn--primary btn--block btn--lg mt-16" data-close>' + escapeHtml(okLabel) + '</button>' : '') +
      '</div>' });
    document.body.append(modalEl);
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl || e.target.closest('[data-close]')) closeModal();
    });
    if (onMount) onMount(modalEl);
  }
  function closeModal() { if (modalEl) { modalEl.remove(); modalEl = null; } }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  /* -------------------------------------------------------------- router -- */
  function route() {
    var h = location.hash || '#/';
    var m = h.match(/^#\/book\/(.+)$/);
    if (m) return { name: 'detail', id: decodeURIComponent(m[1]) };
    return { name: 'home' };
  }

  function render() {
    var r = route();
    closeModal();
    if (reader) reader.close();
    if (r.name === 'detail') {
      renderDetail(r.id);
      window.scrollTo(0, 0);
    } else {
      document.title = 'PageUp \u2014 Read unlimited. Pay only for what you love.';
      renderHome();
    }
  }

  window.addEventListener('hashchange', render);
  renderHeader();
  render();
})();

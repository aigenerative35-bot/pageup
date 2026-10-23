/* ==========================================================================
   PageUp — single-file preview controller
   Classic script (no modules, no network) so the page runs straight from
   file:// by double-clicking. Uses the exact same stylesheet, card component
   and Zoho shell as the real app; only the data layer is localStorage.
   ========================================================================== */
(function () {
  'use strict';

  var LS_KEY = 'pageup:preview:state';

  /* helpers that live in ui.js in the full app */
  function money(amount) { return '\u20B9' + (Number(amount) || 0).toLocaleString('en-IN'); }
  function compact(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  }

  /* ------------------------------------------------------------ state ---- */
  function blank() {
    return { likes: {}, ratings: {}, comments: {}, commentLikes: {}, purchases: {}, progress: {}, theme: null };
  }
  var state = blank();
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) state = Object.assign(blank(), JSON.parse(raw));
  } catch (e) { /* private mode — run in memory */ }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {} }

  var GUEST = 'guest';
  var sort = 'trending';
  var category = 'all';
  var search = '';
  var VIEW = document.getElementById('view');

  /* ------------------------------------------------------- demo helpers -- */
  function bookById(id) {
    for (var i = 0; i < DEMO_BOOKS.length; i++) if (DEMO_BOOKS[i].id === id) return DEMO_BOOKS[i];
    return null;
  }
  function likesOf(id) { return state.likes[id] || (state.likes[id] = {}); }
  function ratingsOf(id) { return state.ratings[id] || (state.ratings[id] = {}); }
  function purchasesOf(id) { return state.purchases[id] || (state.purchases[id] = {}); }

  function SEED_COMMENTS() {
    return [
      { name: 'Ananya Rao', text: 'Finished this in two sittings. The pacing in the middle chapters is superb.', likes: 24, hours: 30 },
      { name: 'Vikram Shah', text: 'The annotations in this edition really help if you are reading it for the first time.', likes: 11, hours: 74 },
      { name: 'Priya Menon', text: 'Read it on the train every morning. Highly recommend the EPUB version for the typography.', likes: 6, hours: 210 }
    ];
  }
  function commentLikesFor(bookId, commentId) {
    return Object.keys((state.commentLikes || {})[bookId + ':' + commentId] || {}).length;
  }
  function commentsOf(bookId) {
    var mine = (state.comments[bookId] || []).map(function (c) {
      return Object.assign({}, c, { createdAt: new Date(c.createdAt) });
    });
    var seed = SEED_COMMENTS().map(function (c, i) {
      return { id: 'seed-' + i, name: c.name, text: c.text, likes: c.likes,
               createdAt: new Date(Date.now() - c.hours * 3600 * 1000), seeded: true };
    });
    return mine.concat(seed)
      .map(function (c) { return Object.assign({}, c, { likes: (c.likes || 0) + commentLikesFor(bookId, c.id) }); })
      .sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  function view(id) {
    var b = bookById(id);
    if (!b) return null;
    var r = ratingsOf(id);
    var values = Object.keys(r).map(function (k) { return r[k]; });
    var count = (b.ratingCount || 0) + values.length;
    var sum = (b.ratingSum || 0) + values.reduce(function (a, v) { return a + v; }, 0);
    return Object.assign({}, b, {
      likes: (b.likes || 0) + Object.keys(likesOf(id)).length,
      commentCount: commentsOf(id).length,
      ratingSum: sum,
      ratingCount: count,
      ratingAvg: count ? +(sum / count).toFixed(2) : 0,
      liked: !!likesOf(id)[GUEST],
      myRating: r[GUEST] || 0,
      unlocked: !b.isPremium || !!purchasesOf(id)[GUEST]
    });
  }

  function catalogue() {
    var items = DEMO_BOOKS.map(function (b) { return view(b.id); });
    if (category !== 'all') items = items.filter(function (b) { return b.category.toLowerCase() === category.toLowerCase(); });
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

  /* -------------------------------------------------------------- shell -- */
  var NAV = [
    { label: 'Browse', items: [
      { id: 'discover', label: 'Discover', icon: 'grid', href: '#/' },
      { id: 'trending', label: 'Trending', icon: 'flame', href: '#/?sort=trending' },
      { id: 'newest',   label: 'New releases', icon: 'book', href: '#/?sort=newest' },
      { id: 'rated',    label: 'Top rated', icon: 'star', href: '#/?sort=rating' },
      { id: 'popular',  label: 'Most read', icon: 'eye', href: '#/?sort=views' }
    ] },
    { label: 'My books', items: [
      { id: 'library',  label: 'My library', icon: 'bookmark', href: '#/library' },
      { id: 'liked',    label: 'Liked', icon: 'heart', href: '#/library/liked' },
      { id: 'continue', label: 'Continue reading', icon: 'play', href: '#/library/continue' }
    ] }
  ];

  function activeId() {
    var r = route();
    if (r.name === 'library') return r.panel || 'library';
    if (r.name === 'detail') return null;
    return { trending: 'trending', newest: 'newest', rating: 'rated', views: 'popular' }[sort] || 'discover';
  }

  function renderShell() {
    document.body.classList.add('has-shell');
    var host = document.getElementById('appHeader');
    host.innerHTML =
      '<header class="app-topbar">' +
        '<button class="icon-btn app-topbar__burger" id="navBurger" aria-label="Open navigation">' + icon('list') + '</button>' +
        '<a class="brand" href="#/" aria-label="PageUp home">' +
          '<span class="brand__mark">' + icon('book') + '</span>' +
          '<span class="brand__name">Page<span>Up</span></span>' +
        '</a>' +
        '<span class="brand__divider"></span>' +
        '<span class="brand__product">Reading Platform</span>' +
        '<form class="search" id="searchForm" role="search">' +
          '<span class="search__icon">' + icon('search') + '</span>' +
          '<input class="search__input" id="searchInput" type="search" placeholder="Search books, authors, topics..." aria-label="Search books" autocomplete="off" value="' + escapeHtml(search) + '">' +
          '<button class="search__clear' + (search ? '' : ' hidden') + '" id="searchClear" type="button" aria-label="Clear search">' + icon('close') + '</button>' +
        '</form>' +
        '<div class="header-actions">' +
          '<button class="icon-btn" id="themeToggle" aria-label="Toggle theme"><span data-theme-icon></span></button>' +
          '<button class="btn btn--primary btn--sm" id="navSignIn" type="button">Sign in</button>' +
        '</div>' +
      '</header>' +
      '<aside class="app-sidebar" id="appSidebar">' +
        '<nav id="sidebarNav" aria-label="Main"></nav>' +
        '<div class="sidebar-foot" id="planSlot"></div>' +
      '</aside>' +
      '<div class="sidebar-scrim" id="sidebarScrim"></div>';

    applyTheme();
    paintSidebar();

    document.getElementById('themeToggle').addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next); state.theme = next; save();
    });
    document.getElementById('navBurger').addEventListener('click', function () {
      document.body.classList.toggle('sidebar-open');
    });
    document.getElementById('sidebarScrim').addEventListener('click', function () {
      document.body.classList.remove('sidebar-open');
    });
    document.getElementById('navSignIn').addEventListener('click', previewNotice);

    var input = document.getElementById('searchInput');
    var clear = document.getElementById('searchClear');
    var run = debounce(function () {
      search = input.value.trim();
      clear.classList.toggle('hidden', !input.value);
      if (route().name === 'home') paintGrid(); else location.hash = '#/';
    }, 260);
    input.addEventListener('input', run);
    clear.addEventListener('click', function () {
      input.value = ''; search = ''; clear.classList.add('hidden'); input.focus();
      if (route().name === 'home') paintGrid(); else location.hash = '#/';
    });
    document.getElementById('searchForm').addEventListener('submit', function (e) { e.preventDefault(); run(); });

    renderPlanCard();
  }

  function paintSidebar() {
    var nav = document.getElementById('sidebarNav');
    if (!nav) return;
    var current = activeId();
    nav.innerHTML = '';
    NAV.forEach(function (group) {
      var section = el('div', { class: 'nav-section' });
      section.append(el('div', { class: 'nav-section__label', text: group.label }));
      group.items.forEach(function (item) {
        var a = el('a', {
          class: 'nav-item' + (item.id === current ? ' is-active' : ''),
          href: item.href,
          html: icon(item.icon) + '<span>' + escapeHtml(item.label) + '</span>'
        });
        a.addEventListener('click', function () { document.body.classList.remove('sidebar-open'); });
        section.append(a);
      });
      nav.append(section);
    });
    var cats = el('div', { class: 'nav-section' });
    cats.append(el('div', { class: 'nav-section__label', text: 'Categories' }));
    categories().slice(0, 8).forEach(function (c) {
      var a = el('a', {
        class: 'nav-item' + (category === c ? ' is-active' : ''),
        href: '#/?cat=' + encodeURIComponent(c),
        html: icon('list') + '<span>' + escapeHtml(c) + '</span>'
      });
      a.addEventListener('click', function () { document.body.classList.remove('sidebar-open'); });
      cats.append(a);
    });
    nav.append(cats);
  }

  function renderPlanCard() {
    var host = document.getElementById('planSlot');
    if (!host) return;
    host.innerHTML =
      '<div class="plan-card">' +
        '<b>Free plan</b>' +
        '<p>Read free previews of any book.</p>' +
        '<button class="btn btn--primary btn--sm btn--block" id="planAction">Go premium</button>' +
      '</div>';
    document.getElementById('planAction').addEventListener('click', function () {
      location.hash = '#/?sort=rating';
    });
  }

  function applyTheme(force) {
    var t = force || state.theme ||
      (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', t);
    Array.prototype.forEach.call(document.querySelectorAll('[data-theme-icon]'), function (n) {
      n.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
    });
  }

  function previewNotice() {
    modal('Static preview',
      '<p class="small muted">This single HTML file is a design and interaction preview. There is no ' +
      'account system here — likes, ratings, comments and unlocks are stored in this browser\'s localStorage only.</p>' +
      '<ul class="small muted" style="line-height:2;margin-top:12px">' +
        '<li>' + icon('check') + 'Real sign-in: Google + email/password</li>' +
        '<li>' + icon('check') + 'Real data: Firestore, shared across devices</li>' +
        '<li>' + icon('check') + 'Real reading: EPUB and PDF streamed from Storage</li>' +
        '<li>' + icon('check') + 'Real payments: Razorpay checkout</li>' +
      '</ul>' +
      '<p class="hint" style="margin-top:14px">The full app is in the <b>pageup</b> repository.</p>',
      'Got it');
  }

  /* --------------------------------------------------------------- home -- */
  function renderHome() {
    var reads = DEMO_BOOKS.reduce(function (a, b) { return a + (b.views || 0); }, 0);
    var comments = DEMO_BOOKS.reduce(function (a, b) { return a + 3; }, 0);

    VIEW.innerHTML =
      '<div class="page-head">' +
        '<div>' +
          '<div class="crumbs"><a href="#/">Home</a>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' +
            '<span>Catalogue</span></div>' +
          '<h1>Discover books</h1>' +
          '<p id="resultMeta">Every premium title opens with a free preview — no card, no signup wall.</p>' +
        '</div>' +
        '<div class="row gap-12">' +
          '<label class="sr-only" for="sortSelect">Sort books</label>' +
          '<select class="select" id="sortSelect" style="width:auto">' +
            '<option value="trending">Trending</option><option value="newest">Newest</option>' +
            '<option value="rating">Top rated</option><option value="views">Most read</option>' +
            '<option value="likes">Most liked</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      '<section class="hero">' +
        '<span class="hero__eyebrow">Freemium reading, built for India</span>' +
        '<h1>Read unlimited previews. Pay only for the books you love.</h1>' +
        '<p>Start any book free. When a story grabs you, unlock it once and keep it for life — on every device, in EPUB and PDF.</p>' +
        '<div class="hero__actions">' +
          '<a class="btn btn--primary btn--lg" href="#catalogue">' + icon('grid') + '<span>Browse the library</span></a>' +
          '<a class="btn btn--outline btn--lg" href="#/book/demo-meditations">' + icon('play') + '<span>Start reading free</span></a>' +
        '</div>' +
        '<div class="hero__stats">' +
          '<div class="hero__stat"><b>' + DEMO_BOOKS.length + '</b><span>Titles in catalogue</span></div>' +
          '<div class="hero__stat"><b>' + compact(reads) + '</b><span>Reads on PageUp</span></div>' +
          '<div class="hero__stat"><b>' + DEMO_BOOKS.filter(function (b) { return !b.isPremium; }).length + '</b><span>Free to read now</span></div>' +
          '<div class="hero__stat"><b>' + comments + '</b><span>Reader comments</span></div>' +
        '</div>' +
      '</section>' +

      '<section id="catalogue">' +
        '<div class="filterbar">' +
          '<span class="hint" style="font-weight:600;color:var(--text-2)">Category</span>' +
          '<div class="chipbar" id="chipbar" role="group" aria-label="Filter by category"></div>' +
        '</div>' +
        '<div class="grid" id="bookGrid"></div>' +
      '</section>' +

      '<section style="padding:8px 0 36px">' +
        '<div class="page-head" style="padding-top:0"><div>' +
          '<h1 style="font-size:18px">How the freemium model works</h1>' +
          '<p>Simple for readers, sustainable for publishers.</p>' +
        '</div></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">' +
          '<div class="panel"><div class="panel__body">' +
            '<h3 style="font-size:14.5px;margin-bottom:6px">1 &middot; Preview anything</h3>' +
            '<p class="small muted">Every premium book opens with a free preview — enough pages to know whether it is for you.</p></div></div>' +
          '<div class="panel"><div class="panel__body">' +
            '<h3 style="font-size:14.5px;margin-bottom:6px">2 &middot; Unlock what you love</h3>' +
            '<p class="small muted">Pay once per book through UPI, cards or netbanking. It stays in your library permanently.</p></div></div>' +
          '<div class="panel"><div class="panel__body">' +
            '<h3 style="font-size:14.5px;margin-bottom:6px">3 &middot; Read anywhere</h3>' +
            '<p class="small muted">Streamed EPUB and PDF reading in the browser, with your page saved across devices.</p></div></div>' +
        '</div>' +
      '</section>';

    var sel = document.getElementById('sortSelect');
    sel.value = sort;
    sel.addEventListener('change', function (e) { sort = e.target.value; paintChips(); paintGrid(); paintSidebar(); });
    paintChips();
    paintGrid();
  }

  function paintChips() {
    var host = document.getElementById('chipbar');
    if (!host) return;
    host.innerHTML = '';
    var list = [{ name: 'all', label: 'All books' }].concat(categories().map(function (c) { return { name: c, label: c }; }));
    list.forEach(function (c) {
      var btn = el('button', { class: 'chip', type: 'button', 'aria-pressed': String(category === c.name), text: c.label });
      btn.addEventListener('click', function () { category = c.name; paintChips(); paintGrid(); paintSidebar(); });
      host.append(btn);
    });
  }

  function paintGrid() {
    var grid = document.getElementById('bookGrid');
    if (!grid) return;
    grid.innerHTML = '';
    var items = catalogue();

    var meta = document.getElementById('resultMeta');
    if (meta) {
      var bits = [items.length + ' book' + (items.length === 1 ? '' : 's')];
      if (search) bits.push('for \u201C' + search + '\u201D');
      if (category !== 'all') bits.push('in ' + category);
      meta.textContent = bits.join(' ');
    }

    if (!items.length) {
      grid.append(el('div', { class: 'empty', html: icon('search') +
        '<h3>No books matched</h3><p>Try a different search term or clear the category filter.</p>' }));
      return;
    }
    items.forEach(function (book) {
      grid.append(renderBookCard(book, {
        liked: book.liked, unlocked: book.unlocked,
        onLike: onLike, onComment: function (b) { openCommentsDrawer(b); }, onShare: onShare
      }));
    });
  }

  /* ------------------------------------------------------------- detail -- */
  function renderDetail(id) {
    var b = view(id);
    if (!b) {
      VIEW.innerHTML = '<div class="empty" style="padding:120px 20px">' + icon('book') +
        '<h3>Book not available</h3><p>This title is not in the preview catalogue.</p>' +
        '<a class="btn btn--primary mt-16" href="#/">Back to the catalogue</a></div>';
      return;
    }
    document.title = b.title + ' \u2014 PageUp';
    var locked = b.isPremium && !b.unlocked;
    var rating = b.ratingAvg || 0;

    VIEW.innerHTML =
      '<div class="page-head" style="padding-bottom:6px"><div>' +
        '<div class="crumbs"><a href="#/">Catalogue</a>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' +
          '<span>' + escapeHtml(b.category) + '</span></div>' +
      '</div>' +
      '<div class="row gap-12">' +
        '<button class="btn btn--ghost btn--sm" id="headShare">' + icon('share') + '<span>Share</span></button>' +
        '<button class="btn btn--ghost btn--sm" id="headComments">' + icon('comment') + '<span>Comments</span></button>' +
      '</div></div>' +

      '<div class="detail">' +
        '<div><div class="detail__cover" id="coverBox"></div></div>' +
        '<div>' +
          '<div class="row gap-8" style="flex-wrap:wrap;margin-bottom:12px">' +
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

          '<section class="panel" style="margin-bottom:22px">' +
            '<div class="panel__head">' + icon('info') +
              '<div><h3>About this book</h3></div></div>' +
            '<div class="panel__body">' +
              '<p class="detail__desc" style="margin-top:0">' + escapeHtml(b.description) + '</p>' +
              '<div class="row gap-8" style="flex-wrap:wrap">' +
                (b.tags || []).map(function (t) { return '<span class="chip" style="pointer-events:none">' + escapeHtml(t) + '</span>'; }).join('') +
              '</div>' +
            '</div>' +
          '</section>' +

          '<section class="panel" style="margin-bottom:22px">' +
            '<div class="panel__head">' + icon('star') +
              '<div><h3>Rate this book</h3><p id="ratingSub"></p></div></div>' +
            '<div class="panel__body row gap-16" style="flex-wrap:wrap">' +
              '<div class="rate-input" id="rateInput" role="radiogroup" aria-label="Your rating"></div>' +
              '<span class="hint" id="ratingHint">Tap a star to rate</span>' +
            '</div>' +
          '</section>' +

          '<div id="commentsHost"></div>' +
        '</div>' +
      '</div>';

    document.getElementById('coverBox').append(bookThumb(b, { lazy: false }));
    document.getElementById('headShare').addEventListener('click', function () { onShare(b); });
    document.getElementById('headComments').addEventListener('click', function () { openCommentsDrawer(b); });

    paintStats(b, rating);
    paintActions(b, locked);
    paintRating(b);
    mountCommentsSection(b);
  }

  function paintStats(b, rating) {
    var host = document.getElementById('statRow');
    if (!host) return;
    host.innerHTML =
      '<div class="detail__stat"><b class="row gap-8">' + (rating ? rating.toFixed(1) : '\u2014') +
        ' <span style="font-size:12px">' + starRow(rating) + '</span></b>' +
        '<span>' + formatCount(b.ratingCount) + ' ratings</span></div>' +
      '<div class="detail__stat"><b>' + formatCount(b.views) + '</b><span>reads</span></div>' +
      '<div class="detail__stat"><b id="likeStatNum">' + formatCount(b.likes) + '</b><span>likes</span></div>' +
      '<div class="detail__stat"><b id="commentStatNum">' + formatCount(b.commentCount) + '</b><span>comments</span></div>';
  }

  function paintActions(b, locked) {
    var row = document.getElementById('actionRow');
    row.innerHTML = '';

    var read = el('button', { class: 'btn btn--primary btn--lg' }, [
      el('span', { html: locked ? icon('lock') : icon('play') }),
      el('span', { text: locked ? 'Read free preview' : 'Read now' })
    ]);
    read.addEventListener('click', function () { openReader(b.id); });

    var like = el('button', { class: 'btn btn--ghost btn--lg', 'aria-pressed': String(b.liked) }, [
      el('span', { html: b.liked ? icon('heartF') : icon('heart') }),
      el('span', { text: b.liked ? 'Liked' : 'Like' })
    ]);
    like.addEventListener('click', function () { onLike(b, like); });

    var comment = el('button', { class: 'btn btn--ghost btn--lg' }, [
      el('span', { html: icon('comment') }), el('span', { text: 'Add a comment' })
    ]);
    comment.addEventListener('click', function () {
      var host = document.getElementById('commentsHost');
      if (host) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(function () { var t = host && host.querySelector('textarea'); if (t) t.focus(); }, 420);
    });

    var share = el('button', { class: 'btn btn--ghost btn--lg' }, [
      el('span', { html: icon('share') }), el('span', { text: 'Share' })
    ]);
    share.addEventListener('click', function () { onShare(b); });

    row.append(read, like, comment, share);

    if (locked) {
      var unlock = el('button', { class: 'btn btn--gold btn--lg' }, [
        el('span', { html: icon('crown') }),
        el('span', { text: 'Unlock for ' + money(b.price) })
      ]);
      unlock.addEventListener('click', function () { openUnlock(b.id); });
      row.append(unlock);
    }

    var gate = document.getElementById('gateBox');
    gate.innerHTML = '';
    if (b.isPremium && !b.unlocked) {
      gate.innerHTML =
        '<div class="gate"><h3>' + icon('crown') + ' Premium title</h3>' +
        '<p>Read the free sample, then unlock the full book for <b>' + money(b.price) + '</b> \u2014 ' +
        'one-time, yours forever, no subscription.</p>' +
        '<div class="row gap-8" style="flex-wrap:wrap">' +
          '<button class="btn btn--gold" id="gateUnlock">' + icon('crown') + '<span>Unlock full book</span></button>' +
          '<button class="btn btn--ghost" id="gatePreview">' + icon('eye') + '<span>Continue free preview</span></button>' +
        '</div></div>';
      document.getElementById('gateUnlock').addEventListener('click', function () { openUnlock(b.id); });
      document.getElementById('gatePreview').addEventListener('click', function () { openReader(b.id); });
    }
  }

  /* ------------------------------------------------------------- rating -- */
  function paintRating(b) {
    var input = document.getElementById('rateInput');
    if (!input) return;
    input.innerHTML = '';
    var current = b.myRating || 0;
    for (var i = 1; i <= 5; i++) {
      (function (value) {
        var btn = el('button', {
          type: 'button', class: value <= current ? 'on' : '', role: 'radio',
          'aria-label': value + ' star' + (value > 1 ? 's' : ''), 'aria-checked': String(value === current),
          html: icon('star')
        });
        btn.addEventListener('click', function () { rate(b.id, value); });
        btn.addEventListener('mouseenter', function () { paintStars(value); });
        input.append(btn);
      })(i);
    }
    input.addEventListener('mouseleave', function () { paintStars(current); });

    var sub = document.getElementById('ratingSub');
    if (sub) sub.textContent = b.ratingCount
      ? (b.ratingAvg || 0).toFixed(1) + ' average from ' + formatCount(b.ratingCount) + ' ratings'
      : 'No ratings yet';
    var hint = document.getElementById('ratingHint');
    if (hint) hint.textContent = current ? 'You rated this ' + current + '/5' : 'Tap a star to rate';
  }
  function paintStars(upto) {
    Array.prototype.forEach.call(document.querySelectorAll('#rateInput button'), function (btn, idx) {
      btn.classList.toggle('on', idx < upto);
    });
  }
  function rate(bookId, value) {
    ratingsOf(bookId)[GUEST] = value;
    save();
    var b = view(bookId);
    paintStars(value);
    var hint = document.getElementById('ratingHint');
    if (hint) hint.textContent = 'You rated this ' + value + '/5';
    var sub = document.getElementById('ratingSub');
    if (sub) sub.textContent = (b.ratingAvg || 0).toFixed(1) + ' average from ' + formatCount(b.ratingCount) + ' ratings';
    toast('Rated ' + value + ' out of 5', 'success');
  }

  /* ----------------------------------------------------------- comments -- */
  function composerNode(book, compact) {
    var node = el('div', { class: compact ? 'row gap-12' : 'comment-composer' });
    node.append(el('div', { class: 'avatar', text: 'GR' }));

    var field = el('div', { style: 'flex:1;min-width:0' });
    var input = el('textarea', {
      class: 'textarea', rows: compact ? '2' : '3',
      placeholder: 'Write a review or ask a question about this book...',
      'aria-label': 'Write a comment'
    });
    var bar = el('div', { class: 'row gap-8 mt-8' }, [
      el('span', { class: 'hint', text: 'Be kind. Reviews are public.' }),
      el('span', { class: 'spacer' })
    ]);
    var submit = el('button', { class: 'btn btn--primary btn--sm', type: 'button' },
      [el('span', { html: icon('comment') }), el('span', { text: 'Post comment' })]);
    bar.append(submit);
    field.append(input, bar);

    submit.addEventListener('click', function () {
      var text = input.value.trim();
      if (!text) { toast('Write something first', 'info'); input.focus(); return; }
      var list = state.comments[book.id] || (state.comments[book.id] = []);
      list.unshift({
        id: 'c-' + Date.now(), name: 'Guest reader', text: text.slice(0, 2000),
        likes: 0, createdAt: new Date().toISOString()
      });
      save();
      input.value = '';
      refreshComments(book.id);
      toast('Comment posted', 'success');
    });

    node.append(field);
    return node;
  }

  function commentNode(book, c) {
    var node = el('div', { class: 'comment' });
    node.append(el('div', { class: 'avatar', text: initials(c.name) }));

    var body = el('div', { class: 'comment__body' });
    var head = el('div', { class: 'comment__head' }, [
      el('span', { class: 'comment__name', text: c.name }),
      el('span', { class: 'comment__time', text: timeAgo(c.createdAt) })
    ]);
    body.append(head);
    body.append(el('div', { class: 'comment__text', text: c.text }));

    var actions = el('div', { class: 'comment__actions' });
    var likeBtn = el('button', { class: 'link-btn', type: 'button',
      html: icon('heart') + '<span>' + (c.likes || 0) + '</span>' });
    likeBtn.addEventListener('click', function () {
      state.commentLikes = state.commentLikes || {};
      var key = book.id + ':' + c.id;
      var set = state.commentLikes[key] = state.commentLikes[key] || {};
      if (set[GUEST]) delete set[GUEST]; else set[GUEST] = true;
      save();
      refreshComments(book.id);
    });
    actions.append(likeBtn);

    if (!c.seeded) {
      var del = el('button', { class: 'link-btn', type: 'button', html: icon('trash') + '<span>Delete</span>' });
      del.addEventListener('click', function () {
        state.comments[book.id] = (state.comments[book.id] || []).filter(function (x) { return x.id !== c.id; });
        save();
        refreshComments(book.id);
        toast('Comment deleted', 'info');
      });
      actions.append(del);
    }

    body.append(actions);
    node.append(body);
    return node;
  }

  function commentList(items, book) {
    var wrap = el('div');
    if (!items.length) {
      wrap.append(el('p', { class: 'muted small text-center', style: 'padding:32px 0',
        text: 'No comments yet — be the first to share your thoughts.' }));
      return wrap;
    }
    items.forEach(function (c) { wrap.append(commentNode(book, c)); });
    return wrap;
  }

  /* A tiny registry so every mounted comments view refreshes on any change. */
  var commentsViews = [];

  function refreshComments(bookId) {
    commentsViews.forEach(function (v) {
      if (v.bookId !== bookId) return;
      v.paint();
    });
  }

  function mountCommentsSection(book) {
    var host = document.getElementById('commentsHost');
    if (!host) return;
    host.innerHTML = '';

    var panel = el('section', { class: 'panel' });
    panel.append(el('div', { class: 'panel__head' }, [
      el('span', { html: icon('comment') }),
      el('div', {}, [el('h3', { text: 'Comments & reviews' }), el('p', { id: 'commentSub' })])
    ]));
    var body = el('div', { class: 'panel__body' });
    var list = el('div', { class: 'mt-16' });
    body.append(composerNode(book, false), list);
    panel.append(body);
    host.append(panel);

    var entry = {
      bookId: book.id,
      paint: function () {
        var items = commentsOf(book.id);
        var sub = document.getElementById('commentSub');
        if (sub) sub.textContent = items.length
          ? items.length + ' comment' + (items.length === 1 ? '' : 's')
          : 'Be the first to comment';
        list.innerHTML = '';
        list.append(commentList(items, book));
        var stat = document.getElementById('commentStatNum');
        if (stat) stat.textContent = formatCount(items.length);
      }
    };
    commentsViews.push(entry);
    entry.paint();
  }

  function openCommentsDrawer(book) {
    closeDrawer();
    var scrim = el('div', { class: 'overlay', style: 'place-items:stretch;padding:0;background:rgba(16,20,26,.42)' });
    var drawer = el('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true' });

    var head = el('div', { class: 'drawer__head' });
    head.append(
      el('span', { html: icon('comment') }),
      el('div', { style: 'flex:1;min-width:0' }, [el('h3', { text: 'Comments' }), el('p', { class: 'clamp-2', text: book.title })]),
      el('button', { class: 'icon-btn', id: 'drawerClose', 'aria-label': 'Close comments', html: icon('close') })
    );
    var body = el('div', { class: 'drawer__body' });
    var foot = el('div', { class: 'drawer__foot' });
    drawer.append(head, body, foot);
    scrim.append(drawer);
    document.body.append(scrim);

    var entry = {
      bookId: book.id,
      paint: function () {
        var items = commentsOf(book.id);
        body.innerHTML = '';
        body.append(commentList(items, book));
        head.querySelector('h3').textContent = items.length ? 'Comments (' + items.length + ')' : 'Comments';
      }
    };
    commentsViews.push(entry);
    entry.paint();
    foot.append(composerNode(book, true));

    var close = function () {
      commentsViews = commentsViews.filter(function (v) { return v !== entry; });
      scrim.remove();
      document.removeEventListener('keydown', onKey);
      refreshComments(book.id);
    };
    function onKey(e) { if (e.key === 'Escape') close(); }
    head.querySelector('#drawerClose').addEventListener('click', close);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) close(); });
    document.addEventListener('keydown', onKey);
    activeDrawer = close;
  }
  var activeDrawer = null;
  function closeDrawer() { if (activeDrawer) { var c = activeDrawer; activeDrawer = null; c(); } }

  /* -------------------------------------------------------------- likes -- */
  function onLike(book, btn) {
    var map = likesOf(book.id);
    var now = !map[GUEST];
    if (now) map[GUEST] = true; else delete map[GUEST];
    save();

    if (btn) {
      btn.setAttribute('aria-pressed', String(now));
      if (btn.firstElementChild) btn.firstElementChild.innerHTML = now ? icon('heartF') : icon('heart');
      var counter = btn.querySelector('.js-like-count');
      if (counter) counter.textContent = formatCount(Math.max(0, (book.likes || 0) + (now ? 1 : -1)));
    }
    if (route().name === 'detail') {
      var fresh = view(book.id);
      var stat = document.getElementById('likeStatNum');
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
      '<div class="meta-list" style="grid-template-columns:1fr 1fr;margin:16px 0">' +
        '<div><dt>Price</dt><dd>' + money(b.price) + '</dd></div>' +
        '<div><dt>Access</dt><dd>Lifetime</dd></div>' +
        '<div><dt>Format</dt><dd>' + b.format.toUpperCase() + '</dd></div>' +
        '<div><dt>Devices</dt><dd>Unlimited</dd></div>' +
      '</div>' +
      '<ul class="small muted" style="line-height:2">' +
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
        '<button class="btn btn--ghost btn--sm" id="readerComments">' + icon('comment') + '<span>Comments</span></button>' +
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
        '<button class="link-btn" id="footComments">' + icon('comment') + '<span>Comments</span></button>' +
        '<span id="readerPercent">0%</span></div>' });

    document.body.append(shell);
    document.body.style.overflow = 'hidden';
    var stage = document.getElementById('readerStage');

    stage.innerHTML = '<div style="max-width:720px;margin:0 auto;padding:36px 24px 80px">' +
      '<div id="textPage" style="font-family:var(--font-read);font-size:19px;line-height:1.85;color:var(--text)"></div></div>';
    var textPage = document.getElementById('textPage');
    var atLimit = false;

    function paint() {
      textPage.innerHTML = pages[page - 1].split(/\n{2,}/).map(function (p) {
        return '<p style="margin:0 0 1.1em">' + escapeHtml(p) + '</p>';
      }).join('');
      stage.scrollTop = 0;

      var percent = Math.round((page / total) * 100);
      atLimit = !b.unlocked && page >= limit;
      document.getElementById('readerBar').style.width = percent + '%';
      document.getElementById('readerPercent').textContent = atLimit ? 'Preview ended' : percent + '%';
      document.getElementById('readerTotal').textContent = 'of ' + total;
      var input = document.getElementById('readerPageInput');
      if (document.activeElement !== input) input.value = page;
      document.getElementById('readerPrev').disabled = page <= 1;
      document.getElementById('readerNext').disabled = b.unlocked && page >= total;
      document.getElementById('readerNext').innerHTML = icon(atLimit ? 'lock' : 'right');
      document.getElementById('readerNext').classList.toggle('reader-nav--locked', atLimit);
      document.getElementById('readerSub').textContent = b.unlocked
        ? (b.author + ' \u00b7 preview reader')
        : (atLimit ? 'End of free sample' : 'Free sample');
      state.progress[id] = page;
      save();
    }
    paint();

    function close() { shell.remove(); document.body.style.overflow = ''; reader = null; }
    reader = { close: close };

    document.getElementById('readerBack').addEventListener('click', close);
    document.getElementById('readerPrev').addEventListener('click', function () { if (page > 1) { page--; paint(); } });
    document.getElementById('readerNext').addEventListener('click', function () {
      if (atLimit) { paywall(); return; }
      if (page < limit) { page++; paint(); }
      else if (!b.unlocked) paywall();
    });
    document.getElementById('readerZoomIn').addEventListener('click', function () {
      textPage.style.fontSize = Math.min(30, parseFloat(getComputedStyle(textPage).fontSize) + 2) + 'px';
    });
    document.getElementById('readerZoomOut').addEventListener('click', function () {
      textPage.style.fontSize = Math.max(14, parseFloat(getComputedStyle(textPage).fontSize) - 2) + 'px';
    });
    document.getElementById('readerPageInput').addEventListener('change', function (e) {
      page = Math.min(limit, Math.max(1, Math.round(Number(e.target.value) || 1)));
      paint();
    });
    document.getElementById('readerFull').addEventListener('click', function () {
      if (document.fullscreenElement) document.exitFullscreen();
      else if (shell.requestFullscreen) shell.requestFullscreen().catch(function () {});
    });
    document.addEventListener('keydown', function onKey(e) {
      if (!document.getElementById('readerShell')) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') document.getElementById('readerNext').click();
      if (e.key === 'ArrowLeft') document.getElementById('readerPrev').click();
    });

    var openComments = function () { openCommentsDrawer(b); };
    document.getElementById('readerComments').addEventListener('click', openComments);
    document.getElementById('footComments').addEventListener('click', openComments);

    function paywall() {
      if (document.getElementById('paywallOverlay')) return;
      var overlay = el('div', { class: 'paywall', id: 'paywallOverlay', html:
        '<div class="paywall__box">' +
          '<div class="paywall__icon" style="width:52px;height:52px;border-radius:var(--r-lg);background:var(--zoho-yellow);display:grid;place-items:center;margin:0 auto 14px;color:#3d2c00">' + icon('crown') + '</div>' +
          '<h2>You have reached the free preview</h2>' +
          '<p class="muted mt-8">Unlock \u201C' + escapeHtml(b.title) + '\u201D to keep reading \u2014 one payment, yours for life.</p>' +
          '<div class="row gap-8 mt-24" style="justify-content:center;flex-wrap:wrap">' +
            '<button class="btn btn--gold btn--lg" id="paywallUnlock">' + icon('crown') + '<span>Unlock for ' + money(b.price) + '</span></button>' +
            '<button class="btn btn--ghost btn--lg" id="paywallClose">Keep browsing</button>' +
          '</div>' +
        '</div>' });
      document.querySelector('.reader-main').append(overlay);
      overlay.querySelector('#paywallUnlock').addEventListener('click', function () {
        overlay.remove(); close(); openUnlock(id);
      });
      overlay.querySelector('#paywallClose').addEventListener('click', function () { overlay.remove(); close(); });
    }
  }

  /* --------------------------------------------------------------- modal -- */
  var modalEl = null;
  function modal(title, bodyHtml, okLabel, onMount) {
    closeModal();
    modalEl = el('div', { class: 'overlay', html:
      '<div class="modal" role="dialog" aria-modal="true">' +
        '<div class="modal__head"><div style="flex:1"><h3>' + escapeHtml(title) + '</h3></div>' +
        '<button class="icon-btn" data-close aria-label="Close">' + icon('close') + '</button></div>' +
        '<div class="modal__body">' + bodyHtml +
        (okLabel ? '<button class="btn btn--primary btn--block btn--lg mt-16" data-close>' + escapeHtml(okLabel) + '</button>' : '') +
        '</div>' +
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
    var m = h.match(/^#\/book\/([^?]+)/);
    if (m) return { name: 'detail', id: decodeURIComponent(m[1]) };
    var lib = h.match(/^#\/library(?:\/(\w+))?/);
    if (lib) return { name: 'library', panel: lib[1] || 'continue' };

    var q = (h.split('?')[1] || '');
    var params = {};
    q.split('&').filter(Boolean).forEach(function (kv) {
      var parts = kv.split('=');
      params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
    });
    if (params.cat) category = params.cat;
    if (params.sort) sort = params.sort;
    return { name: 'home' };
  }

  function render() {
    var r = route();
    closeModal();
    closeDrawer();
    if (reader) reader.close();
    commentsViews = [];
    if (r.name === 'detail') { renderDetail(r.id); window.scrollTo(0, 0); }
    else if (r.name === 'library') { renderLibrary(r.panel); window.scrollTo(0, 0); }
    else { document.title = 'PageUp \u2014 Read unlimited. Pay only for what you love.'; renderHome(); }
    paintSidebar();
  }

  /* ------------------------------------------------------------ library -- */
  var PANELS = ['continue', 'liked', 'owned'];

  function renderLibrary(panel) {
    if (!PANELS.includes(panel)) panel = 'continue';
    document.title = 'My library \u2014 PageUp';

    VIEW.innerHTML =
      '<div class="page-head"><div>' +
        '<div class="crumbs"><a href="#/">Home</a>' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>' +
          '<span>My library</span></div>' +
        '<h1>My library</h1><p>Everything you have liked, unlocked or started reading.</p>' +
      '</div></div>' +
      '<div class="tabs" role="tablist">' +
        PANELS.map(function (p) {
          var labels = { continue: 'Continue reading', liked: 'Liked', owned: 'Unlocked' };
          return '<button class="tab" role="tab" data-panel="' + p + '" aria-selected="' + (p === panel) + '">' +
            '<span>' + labels[p] + '</span><span class="js-tab-count"></span></button>';
        }).join('') +
      '</div>' +
      PANELS.map(function (p) {
        return '<div id="panel-' + p + '" class="' + (p === panel ? '' : 'hidden') + '">' +
          '<div class="grid" id="grid-' + p + '"></div></div>';
      }).join('');

    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () {
        location.hash = '#/library/' + tab.getAttribute('data-panel');
      });
    });
    paintLibrary();
  }

  function paintLibrary() {
    var cards = DEMO_BOOKS.map(function (b) { return view(b.id); });
    var liked = cards.filter(function (b) { return b.liked; });
    var owned = cards.filter(function (b) { return b.isPremium && b.unlocked; });
    var progress = Object.keys(state.progress || {}).map(function (id) {
      var b = bookById(id);
      return b ? { book: view(id), page: state.progress[id] } : null;
    }).filter(Boolean);

    var sets = { continue: progress, liked: liked, owned: owned };
    PANELS.forEach(function (p) {
      var grid = document.getElementById('grid-' + p);
      if (!grid) return;
      grid.innerHTML = '';
      var rows = sets[p];
      var count = document.querySelector('.tab[data-panel="' + p + '"] .js-tab-count');
      if (count) count.textContent = rows.length ? '(' + rows.length + ')' : '';
      if (!rows.length) {
        var msgs = {
          continue: ['Nothing in progress', 'Open any book and PageUp will remember where you stopped.'],
          liked: ['No likes yet', 'Tap the heart on any book to keep it here.'],
          owned: ['No premium unlocks yet', 'Unlock a premium title and it appears here forever.']
        };
        grid.append(el('div', { class: 'empty', html: icon('bookmark') +
          '<h3>' + msgs[p][0] + '</h3><p>' + msgs[p][1] + '</p>' +
          '<a class="btn btn--primary mt-16" href="#/">Browse the catalogue</a>' }));
        return;
      }
      rows.forEach(function (row) {
        var b = p === 'continue' ? row.book : row;
        var card = renderBookCard(b, {
          liked: b.liked, unlocked: true,
          onLike: onLike, onComment: function (x) { openCommentsDrawer(x); }, onShare: onShare
        });
        if (p === 'continue') {
          var total = b.pages || 100;
          var pct = Math.min(99, Math.round((row.page / total) * 100));
          card.querySelector('.card__body').append(el('div', { style: 'margin-top:8px;padding-top:8px;border-top:1px solid var(--border)' }, [
            el('div', { style: 'height:4px;background:var(--surface-3);border-radius:99px;overflow:hidden' }, [
              el('div', { style: 'height:100%;width:' + pct + '%;background:var(--accent)' })
            ]),
            el('div', { class: 'hint', style: 'margin-top:5px', text: 'Page ' + row.page + ' of ' + total + ' \u00b7 ' + pct + '%' })
          ]));
        }
        grid.append(card);
      });
    });
  }

  /* ---------------------------------------------------------------- boot -- */
  window.addEventListener('hashchange', render);
  renderShell();
  render();
})();

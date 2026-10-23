/* PageUp — admin console.
   A separate page that manages the same catalogue the public site reads.
   Access is enforced by firestore.rules / storage.rules via the `staff`
   custom claim — hiding the UI here is only cosmetic. */
import {
  renderShell, initAuth, onSession, session, openAuthModal,
  toast, money, $, el, icon, escapeHtml,
} from './ui.js';
import { auth, isConfigured } from './firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js';
import * as store from './store.js';
import { renderBookCard } from './cards.js';
import { formatCount } from './util.js';

const S = {
  books: [],
  stats: null,
  editingId: null,
  coverUrl: '',
  fileUrl: '',
  busy: false,
  filter: '',
};

/* ------------------------------------------------------------------ boot */
async function boot() {
  renderShell();
  await initAuth();
  paint();

  onSession(() => paint());
}

function paint() {
  const host = $('#adminView');
  if (!host) return;

  /* Preview mode has no server and no shared data, so the console is open —
     everything it writes stays in this visitor's own browser. As soon as a
     Firebase project is connected the staff gate below takes over. */
  if (!isConfigured) { renderPanel(host); return loadAll(); }

  if (!session.user) return renderSignIn(host);
  if (!session.isStaff) return renderNoStaff(host);

  renderPanel(host);
  loadAll();
}

/* ------------------------------------------------------------ gate views */
function gateCard({ tone = 'info', title, body, action }) {
  const tint = { info: 'var(--brand-50)', warn: 'var(--premium-50)', danger: 'var(--danger-50)' }[tone];
  const wrap = el('div', { style: 'max-width:640px;margin:40px auto' });
  const panel = el('section', { class: 'panel' });
  const bodyEl = el('div', { class: 'panel__body' });
  bodyEl.append(el('h2', { style: 'font-size:19px;margin-bottom:8px', text: title }));
  bodyEl.append(el('p', { class: 'small muted', style: 'line-height:1.7', html: body }));
  if (action) {
    const btn = el('button', { class: 'btn btn--primary btn--lg mt-16', type: 'button' },
      [el('span', { html: icon(action.icon || 'user') }), el('span', { text: action.label })]);
    btn.addEventListener('click', action.onClick);
    bodyEl.append(btn);
  }
  panel.append(bodyEl);
  wrap.append(panel);
  wrap.style.setProperty('--gate-tint', tint);
  return wrap;
}

function renderSignIn(host) {
  host.innerHTML = '';
  host.append(gateCard({
    title: 'Sign in to the admin console',
    body: 'Use the account that carries the <code>staff</code> custom claim. Ordinary reader accounts cannot open this page — the security rules reject their writes.',
    action: { label: 'Sign in', icon: 'user', onClick: () => openAuthModal() },
  }));
}

function renderNoStaff(host) {
  host.innerHTML = '';
  const email = session.user?.email || 'this account';
  host.append(gateCard({
    tone: 'danger',
    title: 'This account is not an admin',
    body: `<b>${escapeHtml(email)}</b> is signed in, but it does not carry the <code>staff</code> claim.<br><br>
      Grant it with the Admin SDK:<br>
      <code style="display:block;margin-top:8px;padding:8px 10px;background:var(--bg);border:1px solid var(--border);border-radius:4px;font-size:12px">
      node seed/grant-staff.js you@example.com
      </code>`,
    action: { label: 'Sign out', icon: 'logout', onClick: async () => { await signOut(auth); toast('Signed out', 'info'); } },
  }));
}

/* ----------------------------------------------------------- the panel */
function renderPanel(host) {
  host.innerHTML = `
    <div class="page-head">
      <div>
        <div class="crumbs">
          <a href="./index.html">Home</a>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          <span>Admin</span>
        </div>
        <h1>Admin console</h1>
        <p>${store.DEMO
          ? 'Preview mode &middot; changes stay in this browser'
          : `Signed in as ${escapeHtml(session.user?.email || 'staff')} &middot; changes go live on the site immediately`}</p>
      </div>
      <div class="row gap-12">
        <button class="btn btn--ghost btn--sm" id="adminRefresh">${icon('refresh')}<span>Refresh</span></button>
        <button class="btn btn--ghost btn--sm" id="adminSignOut">${icon('logout')}<span>Sign out</span></button>
      </div>
    </div>

    ${store.DEMO ? `
    <div class="gate" style="margin:0 0 18px;border-color:var(--premium);background:var(--premium-50)">
      <h3>${icon('info')} Preview mode</h3>
      <p class="mb-0">No Firebase project is connected, so anything you save here stays in <b>this browser</b> only.
      Paste a real config in <code>assets/js/firebase-config.js</code> and the same screens write to Firestore and Storage for real.</p>
    </div>` : ''}

    <div class="stat-strip" id="adminStats"></div>

    <div class="admin-grid">
      <section class="panel" id="formPanel"></section>
      <section class="panel" id="listPanel"></section>
    </div>`;

  $('#adminRefresh').addEventListener('click', () => { toast('Refreshed', 'info', 1200); loadAll(); });
  $('#adminSignOut').addEventListener('click', async () => {
    await signOut(auth);
    toast('Signed out', 'info');
  });

  paintForm();
  paintListShell();
}

/* -------------------------------------------------------------- the form */
const FIELDS = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'The Time Machine', span: 2 },
  { name: 'author', label: 'Author', type: 'text', placeholder: 'H. G. Wells' },
  { name: 'category', label: 'Category', type: 'text', placeholder: 'Science Fiction' },
  { name: 'language', label: 'Language', type: 'text', placeholder: 'English' },
  { name: 'format', label: 'Format', type: 'select', options: [['epub', 'EPUB'], ['pdf', 'PDF']] },
  { name: 'pages', label: 'Pages', type: 'number', placeholder: '118' },
  { name: 'publisher', label: 'Publisher', type: 'text', placeholder: 'Public Domain Press' },
  { name: 'publishedYear', label: 'Published year', type: 'text', placeholder: '1895' },
  { name: 'isbn', label: 'ISBN', type: 'text', placeholder: '978-…' },
  { name: 'tags', label: 'Tags', type: 'text', placeholder: 'classic, sci-fi', span: 2, hint: 'Comma separated. Used by search and the filter chips.' },
  { name: 'description', label: 'Description', type: 'textarea', placeholder: 'What is this book about?', span: 2 },
];

function paintForm() {
  const host = $('#formPanel');
  if (!host) return;
  const b = S.editingId ? S.books.find((x) => x.id === S.editingId) : null;
  const v = (name, fallback = '') => (b?.[name] ?? fallback);

  host.innerHTML = `
    <div class="panel__head">
      <span>${icon('book')}</span>
      <div style="flex:1">
        <h3 id="formTitle">${b ? 'Edit book' : 'Add a new book'}</h3>
        <p>${b ? escapeHtml(b.title || '') : 'Saved books appear on the site straight away.'}</p>
      </div>
    </div>
    <div class="panel__body">
      <form id="bookForm" novalidate>
        <div class="admin-fields">
          ${FIELDS.map((f) => fieldHtml(f, v(f.name, f.name === 'format' ? 'epub' : ''))).join('')}
        </div>

        <div class="field" style="margin-top:14px">
          <label>Access</label>
          <div class="row gap-16" style="flex-wrap:wrap">
            <label class="check"><input type="checkbox" id="isPremium" ${b?.isPremium ? 'checked' : ''}> <span>Premium (pay to unlock)</span></label>
            <label class="check"><input type="checkbox" id="featured" ${b?.featured ? 'checked' : ''}> <span>Feature in launch banner</span></label>
            <label class="check"><input type="checkbox" id="isNew" ${b?.isNew ? 'checked' : ''}> <span>Mark as new</span></label>
          </div>
        </div>

        <div class="admin-fields">
          ${fieldHtml({ name: 'price', label: 'Price (₹)', type: 'number', placeholder: '149' }, v('price', 0))}
          ${fieldHtml({ name: 'previewPages', label: 'Free preview pages', type: 'number', placeholder: '12' }, v('previewPages', 12))}
        </div>

        <div class="field">
          <label for="coverUrl">Cover image</label>
          <div class="row gap-8" style="flex-wrap:wrap">
            <input class="input" id="coverUrl" type="url" placeholder="https://… or upload →" value="${escapeHtml(S.coverUrl || v('coverUrl'))}" style="flex:1;min-width:200px">
            <button class="btn btn--ghost btn--sm" type="button" id="pickCover">${icon('upload')}<span>Upload</span></button>
            <input type="file" id="coverFile" accept="image/*" class="hidden">
          </div>
          <div class="upload-progress hidden" id="coverProgress"><div class="upload-progress__bar"></div></div>
          <div id="coverPreview" class="mt-8"></div>
        </div>

        <div class="field">
          <label for="fileUrl">Book file</label>
          <div class="row gap-8" style="flex-wrap:wrap">
            <input class="input" id="fileUrl" type="url" placeholder="https://… or upload →" value="${escapeHtml(S.fileUrl || v('fileUrl'))}" style="flex:1;min-width:200px">
            <button class="btn btn--ghost btn--sm" type="button" id="pickFile">${icon('upload')}<span>Upload</span></button>
            <input type="file" id="bookFile" accept=".pdf,.epub,application/pdf,application/epub+zip" class="hidden">
          </div>
          <div class="upload-progress hidden" id="fileProgress"><div class="upload-progress__bar"></div></div>
          <p class="hint">PDF or EPUB. Streamed by the reader from Storage.</p>
        </div>

        <div class="row gap-12 mt-16">
          <button class="btn btn--primary" type="submit" id="saveBtn">${icon('check')}<span>${b ? 'Update book' : 'Publish book'}</span></button>
          <button class="btn btn--ghost ${b ? '' : 'hidden'}" type="button" id="cancelBtn">Cancel</button>
          <span class="spacer"></span>
          <span class="hint" id="formMsg"></span>
        </div>
      </form>

      <div class="admin-preview">
        <div class="hint" style="margin-bottom:8px">Live preview on the site</div>
        <div id="cardPreview" style="max-width:220px"></div>
      </div>
    </div>`;

  host.querySelector('#bookForm').addEventListener('submit', onSubmit);
  $('#cancelBtn')?.addEventListener('click', () => { resetForm(); paintForm(); });
  $('#pickCover').addEventListener('click', () => $('#coverFile').click());
  $('#pickFile').addEventListener('click', () => $('#bookFile').click());
  $('#coverFile').addEventListener('change', (e) => handleUpload('cover', e.target.files[0]));
  $('#bookFile').addEventListener('change', (e) => handleUpload('book', e.target.files[0]));
  ['title', 'author', 'description', 'category'].forEach((n) => {
    $(`#${n}`)?.addEventListener('input', paintPreview);
  });
  $('#coverUrl').addEventListener('input', () => { S.coverUrl = $('#coverUrl').value; paintPreview(); });
  $('#isPremium')?.addEventListener('change', paintPreview);

  paintCoverPreview();
  paintPreview();
}

function fieldHtml(f, value) {
  const span = f.span === 2 ? ' style="grid-column:1/-1"' : '';
  const common = `id="${f.name}" name="${f.name}"${f.required ? ' required' : ''} placeholder="${escapeHtml(f.placeholder || '')}"`;
  let control;
  if (f.type === 'textarea') {
    control = `<textarea class="textarea" ${common} rows="4">${escapeHtml(value)}</textarea>`;
  } else if (f.type === 'select') {
    control = `<select class="select" ${common}>${f.options
      .map(([v, l]) => `<option value="${v}"${String(value) === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  } else {
    control = `<input class="input" type="${f.type}" ${common} value="${escapeHtml(value)}">`;
  }
  return `<div class="field"${span}>
      <label for="${f.name}">${escapeHtml(f.label)}${f.required ? ' *' : ''}</label>
      ${control}
      ${f.hint ? `<p class="hint">${escapeHtml(f.hint)}</p>` : ''}
    </div>`;
}

function readForm() {
  const val = (id) => $(`#${id}`)?.value ?? '';
  return {
    title: val('title'), author: val('author'), category: val('category'),
    language: val('language'), format: val('format'), pages: val('pages'),
    publisher: val('publisher'), publishedYear: val('publishedYear'), isbn: val('isbn'),
    tags: val('tags'), description: val('description'),
    isPremium: !!$('#isPremium')?.checked,
    featured: !!$('#featured')?.checked,
    isNew: !!$('#isNew')?.checked,
    price: val('price'), previewPages: val('previewPages'),
    coverUrl: val('coverUrl'), fileUrl: val('fileUrl'),
  };
}

function paintPreview() {
  const host = $('#cardPreview');
  if (!host) return;
  const draft = readForm();
  if (!draft.title) { host.innerHTML = '<p class="hint">Add a title to see the card.</p>'; return; }
  host.innerHTML = '';
  host.append(renderBookCard({
    id: 'preview', ...draft,
    tags: String(draft.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
    isPremium: !!$('#isPremium')?.checked,
    price: Number(draft.price) || 0,
    views: 0, likes: 0, commentCount: 0, ratingAvg: 0, ratingCount: 0,
  }, {}));
}

function paintCoverPreview() {
  const host = $('#coverPreview');
  if (!host) return;
  const url = $('#coverUrl')?.value || S.coverUrl;
  host.innerHTML = url
    ? `<img src="${escapeHtml(url)}" alt="" style="width:70px;height:94px;object-fit:cover;border-radius:4px;border:1px solid var(--border)">`
    : '<p class="hint">No cover yet — the site will draw a generated one.</p>';
}

function resetForm() {
  S.editingId = null;
  S.coverUrl = '';
  S.fileUrl = '';
}

/* ------------------------------------------------------------- uploading */
async function handleUpload(kind, file) {
  if (!file) return;
  const bar = $(`#${kind === 'cover' ? 'coverProgress' : 'fileProgress'}`);
  const fill = bar?.querySelector('.upload-progress__bar');
  const input = $(kind === 'cover' ? '#coverUrl' : '#fileUrl');

  bar?.classList.remove('hidden');
  if (fill) fill.style.width = '0%';
  S.busy = true;

  try {
    // Uploads need a book id. For a brand-new book we mint one up front so the
    // Storage path and the Firestore document agree.
    let id = S.editingId;
    if (!id) {
      id = await store.createBook(null, { ...readForm(), title: readForm().title || 'Untitled draft' });
      S.editingId = id;
      await loadAll();
    }
    const { url } = await store.uploadAsset(kind, id, file, (pct) => {
      if (fill) fill.style.width = `${pct}%`;
    });
    if (kind === 'cover') S.coverUrl = url; else S.fileUrl = url;
    input.value = url;
    if (kind === 'cover') paintCoverPreview();
    paintPreview();
    toast(`${kind === 'cover' ? 'Cover' : 'Book file'} uploaded`, 'success');
  } catch (err) {
    console.error(err);
    toast(err?.message || 'Upload failed', 'error', 4200);
  } finally {
    S.busy = false;
    setTimeout(() => bar?.classList.add('hidden'), 600);
  }
}

/* ---------------------------------------------------------------- saving */
async function onSubmit(e) {
  e.preventDefault();
  const msg = $('#formMsg');
  const data = readForm();

  if (!data.title.trim()) { msg.textContent = 'Title is required.'; $('#title').focus(); return; }
  if (data.isPremium && !(Number(data.price) > 0)) {
    msg.textContent = 'Set a price above 0 for a premium book.'; $('#price').focus(); return;
  }

  const btn = $('#saveBtn');
  btn.disabled = true;
  msg.textContent = 'Saving…';
  try {
    if (S.editingId) await store.updateBook(S.editingId, data);
    else await store.createBook(null, data);
    toast(S.editingId ? 'Book updated — live now' : 'Book published — live now', 'success');
    resetForm();
    await loadAll();
    paintForm();
  } catch (err) {
    console.error(err);
    msg.textContent = err?.message || 'Could not save.';
    toast('Save failed', 'error');
  } finally {
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------------ list */
function paintListShell() {
  const host = $('#listPanel');
  if (!host) return;
  host.innerHTML = `
    <div class="panel__head">
      <span>${icon('list')}</span>
      <div style="flex:1"><h3>Catalogue</h3><p id="listCount">Loading…</p></div>
      <input class="input" id="listFilter" type="search" placeholder="Filter by title or author…" style="width:240px;height:32px">
    </div>
    <div class="panel__body" id="listBody"></div>`;
  $('#listFilter').addEventListener('input', (e) => { S.filter = e.target.value.trim().toLowerCase(); renderList(); });
}

async function loadAll() {
  try {
    const { items } = await store.listBooks({ sort: 'title', pageSize: 500 });
    S.books = items;
    S.stats = await store.adminStats();
    renderStats();
    renderList();
    if (S.editingId) paintForm();
  } catch (err) {
    console.error(err);
    const body = $('#listBody');
    if (body) body.innerHTML = `<p class="error-text">Could not load the catalogue: ${escapeHtml(err?.message || '')}</p>`;
  }
}

function renderStats() {
  const host = $('#adminStats');
  if (!host || !S.stats) return;
  const s = S.stats;
  const tile = (v, l) => `<div><b>${escapeHtml(String(v))}</b><span>${escapeHtml(l)}</span></div>`;
  host.innerHTML =
    tile(s.books, 'Books') +
    tile(s.premium, 'Premium') +
    tile(s.free, 'Free') +
    tile(s.featured, 'Featured') +
    tile(formatCount(s.reads), 'Reads') +
    tile(formatCount(s.likes), 'Likes') +
    tile(formatCount(s.comments), 'Comments');
}

function renderList() {
  const body = $('#listBody');
  if (!body) return;
  const all = S.books;
  const rows = S.filter
    ? all.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(S.filter))
    : all;

  const count = $('#listCount');
  if (count) count.textContent = `${rows.length} of ${all.length} books`;

  if (!rows.length) {
    body.innerHTML = '<p class="muted small text-center" style="padding:28px 0">Nothing here yet. Publish your first book on the left.</p>';
    return;
  }

  body.innerHTML = '';
  rows.forEach((b) => body.append(rowNode(b)));
}

function rowNode(b) {
  const node = el('div', { class: 'admin-row' });
  const thumb = el('div', { class: 'admin-row__thumb' });
  if (b.coverUrl) thumb.append(el('img', { src: b.coverUrl, alt: '', loading: 'lazy' }));
  else thumb.append(el('div', { class: 'admin-row__thumb--empty', html: icon('book') }));

  const main = el('div', { style: 'flex:1;min-width:0' });
  main.append(el('div', { class: 'admin-row__title', text: b.title || 'Untitled' }));
  main.append(el('div', { class: 'admin-row__sub', text: `${b.author || 'Unknown author'} · ${escapeHtml(String(b.category || 'General'))}` }));

  const badges = el('div', { class: 'row gap-8', style: 'flex-wrap:wrap;margin-top:6px' });
  badges.append(el('span', { class: `badge badge--${b.isPremium ? 'premium' : 'free'}`, text: b.isPremium ? `Premium ${money(b.price)}` : 'Free' }));
  badges.append(el('span', { class: `badge badge--${(b.format || 'pdf').toLowerCase()}`, text: (b.format || 'pdf').toUpperCase() }));
  if (b.featured) badges.append(el('span', { class: 'badge badge--muted', text: 'Featured' }));
  if (b.isNew) badges.append(el('span', { class: 'badge badge--muted', text: 'New' }));
  if (!b.fileUrl) badges.append(el('span', { class: 'badge badge--muted', text: 'No file' }));
  main.append(badges);

  const actions = el('div', { class: 'admin-row__actions' });

  // A freshly published book can sit anywhere in the grid's sort order, so
  // give staff a direct link to its page on the site.
  const view = el('a', {
    class: 'icon-btn', title: 'View on the site',
    href: `./book.html?id=${encodeURIComponent(b.id)}`, target: '_blank', rel: 'noopener',
    html: icon('external'),
  });
  actions.append(view);

  const feat = el('button', {
    class: `icon-btn${b.featured ? ' is-on' : ''}`, type: 'button',
    title: b.featured ? 'Remove from the launch banner' : 'Feature in the launch banner',
    html: icon('star'),
  });
  feat.addEventListener('click', async () => {
    try {
      await store.updateBook(b.id, { ...b, featured: !b.featured });
      toast(b.featured ? 'Removed from the banner' : 'Added to the launch banner', 'success');
      await loadAll();
    } catch (err) { toast(err?.message || 'Could not update', 'error'); }
  });

  const edit = el('button', { class: 'icon-btn', type: 'button', title: 'Edit', html: icon('settings') });
  edit.addEventListener('click', () => {
    S.editingId = b.id;
    S.coverUrl = '';
    S.fileUrl = '';
    paintForm();
    $('#formPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  const del = el('button', { class: 'icon-btn icon-btn--danger', type: 'button', title: 'Delete', html: icon('trash') });
  del.addEventListener('click', async () => {
    const ok = await confirmDialog('Delete this book?', `“${b.title}” will be removed from the site for everyone. This cannot be undone.`);
    if (!ok) return;
    try {
      await store.removeBook(b.id);
      toast('Book deleted', 'info');
      if (S.editingId === b.id) { resetForm(); paintForm(); }
      await loadAll();
    } catch (err) { toast(err?.message || 'Could not delete', 'error'); }
  });

  actions.append(feat, edit, del);
  node.append(thumb, main, actions);
  return node;
}

/* --------------------------------------------------------------- confirm */
function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const overlay = el('div', { class: 'overlay', html: `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div style="flex:1"><h3>${escapeHtml(title)}</h3></div>
          <button class="icon-btn" data-no aria-label="Close">${icon('close')}</button>
        </div>
        <div class="modal__body">
          <p class="small muted">${escapeHtml(message)}</p>
          <div class="row gap-12 mt-16" style="justify-content:flex-end">
            <button class="btn btn--ghost" data-no type="button">Cancel</button>
            <button class="btn btn--danger" data-yes type="button">${icon('trash')}<span>Delete</span></button>
          </div>
        </div>
      </div>` });
    document.body.append(overlay);
    const done = (v) => { overlay.remove(); resolve(v); };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-no]')) done(false);
      if (e.target.closest('[data-yes]')) done(true);
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); done(false); }
    });
  });
}

document.addEventListener('DOMContentLoaded', boot);

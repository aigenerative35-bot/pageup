/* PageUp — shared shell: header, theme, auth modal, session, share */
import {
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import { auth, googleProvider, isConfigured } from "./firebase.js";
import { ensureUserProfile, subscribeProfile } from "./data.js";
import { $, $$, el, icon, escapeHtml, initials, toast, copyToClipboard } from "./util.js";
import { siteConfig } from "./firebase-config.js";

/* ---------------------------------------------------------------- Theme */
const THEME_KEY = 'pageup:theme';
export function applyTheme(theme) {
  const t = theme || localStorage.getItem(THEME_KEY) ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem(THEME_KEY, t);
  const btn = $('#themeToggle');
  if (btn) btn.innerHTML = icon(t === 'dark' ? 'sun' : 'moon');
  return t;
}
export function toggleTheme() {
  return applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}

/* -------------------------------------------------------------- Session */
export const session = { user: null, profile: null };
const listeners = new Set();
export function onSession(cb) { listeners.add(cb); if (session.user !== null || session.ready) cb(session); return () => listeners.delete(cb); }
function emit() { listeners.forEach((cb) => { try { cb(session); } catch (e) { console.error(e); } }); }

let profileUnsub = null;
export function initAuth() {
  /* Preview mode: no Firebase project yet, so run as a local guest. */
  if (!isConfigured) {
    session.user = null; session.profile = null; session.ready = true;
    return Promise.resolve(session);
  }
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      session.user = user;
      if (profileUnsub) { profileUnsub(); profileUnsub = null; }
      if (user) {
        try { session.profile = await ensureUserProfile(user); } catch { session.profile = null; }
        profileUnsub = subscribeProfile(user.uid, (p) => { if (p) { session.profile = p; emit(); renderHeaderAuth(); } });
      } else {
        session.profile = null;
      }
      session.ready = true;
      renderHeaderAuth();
      emit();
      resolve(session);
    });
  });
}

/* --------------------------------------------------------------- Header */
export function renderHeader() {
  const host = $('#appHeader');
  if (!host) return;
  host.innerHTML = `
    <header class="app-header">
      <div class="container">
        <a class="brand" href="./index.html" aria-label="PageUp home">
          <span class="brand__mark">${icon('book')}</span>
          <span class="brand__name">Page<span>Up</span></span>
        </a>

        <form class="search" id="searchForm" role="search">
          <span class="search__icon">${icon('search')}</span>
          <input class="search__input" id="searchInput" type="search"
                 placeholder="Search books, authors, topics..." aria-label="Search books" autocomplete="off">
          <button class="search__clear hidden" id="searchClear" type="button" aria-label="Clear search">${icon('close')}</button>
        </form>

        <div class="header-actions">
          <button class="icon-btn" id="themeToggle" type="button" aria-label="Toggle theme"></button>
          <a class="btn btn--ghost btn--sm hidden" id="navLibrary" href="./library.html">${icon('bookmark')}<span>Library</span></a>
          <button class="btn btn--primary btn--sm" id="navSignIn" type="button">Sign in</button>
          <div class="hidden" id="userSlot" style="position:relative"></div>
        </div>
      </div>
    </header>`;

  applyTheme();
  $('#themeToggle').addEventListener('click', toggleTheme);

  const form = $('#searchForm');
  const input = $('#searchInput');
  const clear = $('#searchClear');
  const params = new URLSearchParams(location.search);
  if (params.get('q')) input.value = params.get('q');

  input.addEventListener('input', () => clear.classList.toggle('hidden', !input.value));
  clear.addEventListener('click', () => { input.value = ''; clear.classList.add('hidden'); input.focus(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = input.value.trim();
    const url = new URL('./index.html', location.href);
    if (q) url.searchParams.set('q', q);
    location.href = url.toString();
  });

  $('#navSignIn').addEventListener('click', () => openAuthModal());
  renderHeaderAuth();
}

export function renderHeaderAuth() {
  const signIn = $('#navSignIn');
  const slot = $('#userSlot');
  const lib = $('#navLibrary');
  if (!signIn || !slot) return;

  if (!session.user) {
    signIn.classList.remove('hidden');
    slot.classList.add('hidden');
    lib?.classList.add('hidden');
    slot.innerHTML = '';
    return;
  }
  signIn.classList.add('hidden');
  slot.classList.remove('hidden');
  lib?.classList.remove('hidden');

  const name = session.user.displayName || session.user.email || 'Reader';
  const photo = session.user.photoURL;
  const isPremium = session.profile?.isPremium;

  slot.innerHTML = `
    <button class="icon-btn" id="userBtn" type="button" aria-haspopup="menu" aria-label="Account menu">
      <span class="avatar avatar--sm">${photo ? `<img src="${escapeHtml(photo)}" alt="">` : escapeHtml(initials(name))}</span>
    </button>`;

  $('#userBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    if ($('.menu')) { $('.menu').remove(); return; }
    const menu = el('div', { class: 'menu', role: 'menu', html: `
      <div class="menu__head">
        <b>${escapeHtml(name)}</b>
        <span>${escapeHtml(session.user.email || '')}</span>
      </div>
      <div class="menu__sep"></div>
      <div class="menu__item" style="pointer-events:none">
        ${icon('crown')}<span>Plan: <b>${isPremium ? 'Premium' : 'Free'}</b></span>
      </div>
      <a class="menu__item" href="./library.html">${icon('bookmark')}<span>My library</span></a>
      <button class="menu__item" id="menuTheme">${icon('sun')}<span>Switch theme</span></button>
      <div class="menu__sep"></div>
      <button class="menu__item menu__item--danger" id="menuLogout">${icon('logout')}<span>Sign out</span></button>
    ` });
    slot.append(menu);
    menu.querySelector('#menuTheme').addEventListener('click', () => { toggleTheme(); menu.remove(); });
    menu.querySelector('#menuLogout').addEventListener('click', async () => {
      menu.remove(); await signOut(auth); toast('Signed out', 'info');
    });
  });
}
document.addEventListener('click', () => $('.menu')?.remove());

/* ----------------------------------------------------------- Auth modal */
export function openAuthModal(mode = 'signin') {
  if (!isConfigured) {
    openConfigNotice();
    return;
  }
  $('.overlay')?.remove();
  let current = mode;

  const overlay = el('div', { class: 'overlay', html: `<div class="modal" role="dialog" aria-modal="true"></div>` });
  const modal = overlay.firstElementChild;
  document.body.append(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
  });

  function paint() {
    const isSignup = current === 'signup';
    modal.innerHTML = `
      <div class="modal__head">
        <div style="flex:1">
          <h3>${isSignup ? 'Create your free account' : 'Welcome back'}</h3>
          <p>${isSignup ? 'Save your library, likes and progress across devices.' : 'Sign in to rate, comment and unlock premium books.'}</p>
        </div>
        <button class="icon-btn" id="authClose" aria-label="Close">${icon('close')}</button>
      </div>

      <button class="btn btn--outline btn--block btn--lg" id="googleBtn">
        ${icon('google')}<span>Continue with Google</span>
      </button>

      <div class="divider">or use email</div>

      <form id="authForm">
        ${isSignup ? `<div class="field"><label for="authName">Full name</label>
          <input class="input" id="authName" type="text" placeholder="Ada Lovelace" autocomplete="name"></div>` : ''}
        <div class="field">
          <label for="authEmail">Email</label>
          <input class="input" id="authEmail" type="email" placeholder="you@example.com" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="authPass">Password</label>
          <input class="input" id="authPass" type="password" placeholder="At least 6 characters" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required minlength="6">
        </div>
        <div class="error-text hidden" id="authError"></div>
        <button class="btn btn--primary btn--block btn--lg mt-8" id="authSubmit" type="submit">
          ${isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p class="small muted mt-16 text-center">
        ${isSignup ? 'Already have an account?' : 'New to PageUp?'}
        <button class="link-btn" id="authSwap" style="font-size:13px">${isSignup ? 'Sign in' : 'Create a free account'}</button>
      </p>
      ${!isSignup ? `<p class="small muted mt-8 text-center"><button class="link-btn" id="authReset" style="font-size:13px">Forgot password?</button></p>` : ''}
    `;

    modal.querySelector('#authClose').onclick = () => overlay.remove();
    modal.querySelector('#authSwap').onclick = () => { current = isSignup ? 'signin' : 'signup'; paint(); };
    modal.querySelector('#googleBtn').onclick = async () => {
      try {
        await signInWithPopup(auth, googleProvider);
        overlay.remove(); toast('Signed in', 'success');
      } catch (err) { showErr(err); }
    };
    modal.querySelector('#authReset')?.addEventListener('click', async () => {
      const email = modal.querySelector('#authEmail').value.trim();
      if (!email) return showErr({ message: 'Enter your email first, then tap reset.' });
      try { await sendPasswordResetEmail(auth, email); toast('Reset link sent — check your inbox', 'success'); }
      catch (err) { showErr(err); }
    });
    modal.querySelector('#authForm').onsubmit = async (e) => {
      e.preventDefault();
      const email = modal.querySelector('#authEmail').value.trim();
      const pass = modal.querySelector('#authPass').value;
      const btn = modal.querySelector('#authSubmit');
      btn.disabled = true;
      try {
        if (isSignup) {
          const name = modal.querySelector('#authName').value.trim();
          const cred = await createUserWithEmailAndPassword(auth, email, pass);
          if (name) await updateProfile(cred.user, { displayName: name });
          await ensureUserProfile(cred.user);
          toast('Welcome to PageUp', 'success');
        } else {
          await signInWithEmailAndPassword(auth, email, pass);
          toast('Signed in', 'success');
        }
        overlay.remove();
      } catch (err) { showErr(err); btn.disabled = false; }
    };
  }

  function showErr(err) {
    const box = modal.querySelector('#authError');
    if (!box) return;
    box.textContent = friendlyAuthError(err);
    box.classList.remove('hidden');
  }

  paint();
  setTimeout(() => modal.querySelector('#authEmail')?.focus(), 60);
}

function friendlyAuthError(err) {
  const code = err?.code || '';
  const map = {
    'auth/invalid-email': 'That email address does not look right.',
    'auth/user-not-found': 'No account with that email. Try creating one.',
    'auth/wrong-password': 'Incorrect password. Try again.',
    'auth/invalid-credential': 'Email or password is incorrect.',
    'auth/email-already-in-use': 'That email is already registered — sign in instead.',
    'auth/weak-password': 'Use at least 6 characters for your password.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment.',
    'auth/popup-closed-by-user': 'Google sign-in was closed before finishing.',
    'auth/operation-not-allowed': 'Enable this sign-in method in the Firebase Console.',
    'auth/unauthorized-domain': 'This domain is not authorised in Firebase Auth settings.',
  };
  return map[code] || err?.message || 'Something went wrong. Please try again.';
}

/* ------------------------------------------------------- Config notice */
function openConfigNotice() {
  $('.overlay')?.remove();
  const overlay = el('div', { class: 'overlay', html: `
    <div class="modal modal--wide" role="dialog" aria-modal="true">
      <div class="modal__head">
        <div style="flex:1">
          <h3>Connect your Firebase project</h3>
          <p>PageUp is running in preview mode.</p>
        </div>
        <button class="icon-btn" id="cfgClose" aria-label="Close">${icon('close')}</button>
      </div>
      <p class="small muted">Open <code>assets/js/firebase-config.js</code> and paste the config from
      Firebase Console &rarr; Project settings &rarr; Your apps &rarr; Web app. Then enable
      <b>Authentication</b> (Google + Email/Password), <b>Firestore</b> and <b>Storage</b>.</p>
      <ol class="small muted" style="padding-left:18px;line-height:1.9">
        <li>Create a project at console.firebase.google.com</li>
        <li>Add a Web app and copy the config block</li>
        <li>Deploy with <code>firebase deploy</code> (see README)</li>
      </ol>
      <button class="btn btn--primary btn--block mt-16" id="cfgOk">Got it</button>
    </div>` });
  document.body.append(overlay);
  overlay.querySelector('#cfgClose').onclick = () => overlay.remove();
  overlay.querySelector('#cfgOk').onclick = () => overlay.remove();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

/* ---------------------------------------------------------------- Share */
export async function shareBook(book) {
  const url = new URL(`./book.html?id=${encodeURIComponent(book.id)}`, location.href).toString();
  const data = {
    title: `${book.title} — ${siteConfig.name}`,
    text: book.author ? `Read "${book.title}" by ${book.author} on ${siteConfig.name}` : `Read "${book.title}" on ${siteConfig.name}`,
    url,
  };
  if (navigator.share) {
    try { await navigator.share(data); return; } catch (err) { if (err?.name === 'AbortError') return; }
  }
  await copyToClipboard(url);
  toast('Link copied to clipboard', 'success');
}

/* ------------------------------------------------------- Auth guard util */
export function requireAuth(action = 'do that') {
  if (session.user) return true;
  if (!isConfigured) {
    toast('Preview mode — your changes stay in this browser', 'info');
    return true;
  }
  toast(`Sign in to ${action}`, 'info');
  openAuthModal();
  return false;
}

/** Identity used for writes: the signed-in uid, or a local guest in preview. */
export function actorId() {
  return session.user?.uid || (isConfigured ? null : 'guest');
}

/** Display identity for new comments. */
export function actorProfile() {
  if (session.user) {
    return { uid: session.user.uid, displayName: session.user.displayName, photoURL: session.user.photoURL, email: session.user.email };
  }
  return { uid: 'guest', displayName: 'Guest reader', photoURL: '', email: '' };
}

export function money(amount) {
  const v = Number(amount) || 0;
  return `${siteConfig.currencySymbol}${v.toLocaleString('en-IN')}`;
}

export { el, icon, escapeHtml, initials, toast, $, $$ };

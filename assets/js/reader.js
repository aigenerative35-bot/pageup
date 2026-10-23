/* PageUp — reading engine.
   One controller interface over three sources:
     pdf  -> pdf.js  (canvas render, zoom, page jump)
     epub -> epub.js (reflowable, next/prev across spine sections)
     text -> built-in paginator (used for the offline demo catalogue)
   The premium paywall is enforced here by clamping the reachable range. */

const PDFJS_VERSION = '4.6.82';
const EPUBJS_VERSION = '0.3.93';
const JSZIP_VERSION = '3.10.1';

let pdfjsPromise = null;
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`)
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc =
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;
        return lib;
      });
  }
  return pdfjsPromise;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === 'true') return resolve();
    const s = existing || document.createElement('script');
    s.src = src;
    s.addEventListener('load', () => { s.dataset.loaded = 'true'; resolve(); });
    s.addEventListener('error', () => reject(new Error(`Could not load ${src}`)));
    if (!existing) document.head.append(s);
  });
}

let epubjsPromise = null;
async function loadEpubJs() {
  if (window.ePub) return window.ePub;
  if (!epubjsPromise) {
    epubjsPromise = (async () => {
      // epub.js does not bundle JSZip — it must be present first.
      if (!window.JSZip) await loadScript(`https://cdn.jsdelivr.net/npm/jszip@${JSZIP_VERSION}/dist/jszip.min.js`);
      await loadScript(`https://cdn.jsdelivr.net/npm/epubjs@${EPUBJS_VERSION}/dist/epub.min.js`);
      if (!window.ePub) throw new Error('The EPUB engine did not initialise');
      return window.ePub;
    })().catch((err) => { epubjsPromise = null; throw err; });
  }
  return epubjsPromise;
}

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);

/* ======================================================================= */

export function detectFormat(book) {
  if (book.format) return String(book.format).toLowerCase();
  const url = book.fileUrl || '';
  if (/\.pdf(\?|$)/i.test(url)) return 'pdf';
  if (/\.epub(\?|$)/i.test(url)) return 'epub';
  return 'text';
}

/**
 * @param {object} opts
 * @param {object} opts.book
 * @param {HTMLElement} opts.stage   scrollable container
 * @param {number} opts.previewPages pages readable without entitlement
 * @param {boolean} opts.unlocked    full access
 * @param {(p:{page:number,total:number,percent:number})=>void} opts.onProgress
 */
export async function openReader({ book, stage, previewPages = 12, unlocked = false, onProgress }) {
  const format = detectFormat(book);
  const hasFile = !!book.fileUrl;

  if (!hasFile) {
    return textReader({ book, stage, previewPages, unlocked, onProgress });
  }
  if (format === 'epub') {
    try { return await epubReader({ book, stage, previewPages, unlocked, onProgress }); }
    catch (err) { console.warn('EPUB engine failed, falling back to text', err); return textReader({ book, stage, previewPages, unlocked, onProgress }); }
  }
  try { return await pdfReader({ book, stage, previewPages, unlocked, onProgress }); }
  catch (err) { console.warn('PDF engine failed, falling back to text', err); return textReader({ book, stage, previewPages, unlocked, onProgress }); }
}

/* ------------------------------------------------------------------ PDF */
async function pdfReader({ book, stage, previewPages, unlocked, onProgress }) {
  const pdfjsLib = await loadPdfJs();
  stage.innerHTML = '<div style="display:grid;place-items:center;height:100%;color:var(--text-3)">Loading document…</div>';

  // Fetch in the main thread and hand pdf.js the bytes. This keeps the worker
  // from having to resolve the URL itself, so relative paths, cross-origin
  // Storage URLs and missing CORS headers on the worker all stop being issues.
  let bytes;
  try {
    const res = await fetch(book.fileUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (err) {
    throw new Error(`Could not download the PDF (${err.message}). Check the file URL and the bucket CORS settings.`);
  }

  const doc = await pdfjsLib.getDocument({
    data: bytes,
    cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/cmaps/`,
    cMapPacked: true,
  }).promise;

  const total = doc.numPages;
  const limit = unlocked ? total : Math.min(previewPages, total);

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;justify-content:center;padding:20px;min-height:100%';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'background:#fff;box-shadow:var(--shadow-md);border-radius:6px;max-width:100%;height:auto';
  wrap.append(canvas);
  stage.innerHTML = '';
  stage.append(wrap);

  let page = 1;
  let scale = 1;
  let baseViewport = null;
  let renderTask = null;

  async function render() {
    const pdfPage = await doc.getPage(page);
    baseViewport = pdfPage.getViewport({ scale: 1 });
    const fit = clamp((stage.clientWidth - 60) / baseViewport.width, 0.4, 3);
    const viewport = pdfPage.getViewport({ scale: fit * scale });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${Math.floor(viewport.width)}px`;
    canvas.style.height = `${Math.floor(viewport.height)}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (renderTask) { try { renderTask.cancel(); } catch {} }
    renderTask = pdfPage.render({ canvasContext: ctx, viewport });
    await renderTask.promise.catch(() => {});
    stage.scrollTop = 0;
    report();
  }

  function report() {
    onProgress?.({ page, total, percent: Math.round((page / total) * 100), limit });
  }

  await render();

  return {
    format: 'pdf',
    get page() { return page; },
    get total() { return total; },
    get limit() { return limit; },
    next: async () => { if (page < limit) { page++; await render(); return true; } return false; },
    prev: async () => { if (page > 1) { page--; await render(); return true; } return false; },
    goTo: async (n) => { page = clamp(Math.round(n), 1, limit); await render(); },
    zoomIn:  async () => { scale = clamp(scale * 1.2, 0.5, 4); await render(); },
    zoomOut: async () => { scale = clamp(scale / 1.2, 0.5, 4); await render(); },
    resize: async () => { await render(); },
    destroy: () => { try { renderTask?.cancel(); } catch {} doc.destroy?.(); stage.innerHTML = ''; },
  };
}

/* ----------------------------------------------------------------- EPUB */
async function epubReader({ book, stage, previewPages, unlocked, onProgress }) {
  const ePub = await loadEpubJs();
  stage.innerHTML = '<div id="epubHost" style="height:100%"></div>';
  const host = stage.querySelector('#epubHost');

  // Same reasoning as the PDF path: fetch the bytes here so the archive is
  // never resolved from inside a worker, and cross-origin URLs just work.
  let bytes;
  try {
    const res = await fetch(book.fileUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    bytes = await res.arrayBuffer();
  } catch (err) {
    throw new Error(`Could not download the EPUB (${err.message}). Check the file URL and the bucket CORS settings.`);
  }

  const epub = ePub(bytes);
  const rendition = epub.renderTo(host, {
    width: '100%', height: '100%', spread: 'none', flow: 'paginated',
  });

  // A malformed file or a stalled layout engine must never hang the reader.
  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);

  await withTimeout(epub.ready, 25000, 'Opening the EPUB');
  await withTimeout(rendition.display(), 25000, 'Rendering the first page');

  const meta = epub.packaging?.metadata || {};
  if (meta.title) document.title = `${meta.title} — PageUp`;

  /* Progress is derived from the spine, which is always available and needs
     no location generation pass — that keeps opening a book instant. */
  const sections = Math.max(epub.spine?.length || 1, 1);
  const pageCount = book.pages || sections * 12;
  let index = 0;
  let percent = 0;

  // Preview cap expressed in spine sections for locked premium titles.
  const previewFraction = clamp(previewPages / Math.max(pageCount, 20), 0.06, 0.35);
  const previewSections = Math.max(1, Math.ceil(sections * previewFraction));
  const limitPage = unlocked ? pageCount : Math.max(1, Math.round(pageCount * previewFraction));

  function computePercent() {
    percent = sections > 1 ? (index / (sections - 1)) * 100 : 100;
    return percent;
  }
  function pageFromIndex() {
    return clamp(Math.round(1 + (index / Math.max(sections - 1, 1)) * (pageCount - 1)), 1, pageCount);
  }
  function report() {
    computePercent();
    onProgress?.({
      page: pageFromIndex(),
      total: pageCount,
      percent: Math.round(percent),
      limit: limitPage,
      section: index + 1,
      sections,
    });
  }

  rendition.on('relocated', (loc) => {
    const i = loc?.start?.index;
    if (typeof i === 'number') index = i;
    report();
  });
  report();

  const atPreviewEnd = () => !unlocked && index + 1 >= previewSections;

  return {
    format: 'epub',
    get page() { return pageFromIndex(); },
    get total() { return pageCount; },
    get percent() { return computePercent(); },
    get limit() { return limitPage; },
    next: async () => {
      if (atPreviewEnd()) return false;
      await rendition.next();
      report();
      return !atPreviewEnd();
    },
    prev: async () => { await rendition.prev(); report(); return true; },
    goTo: async (target) => {
      const targetIndex = clamp(Math.round(((target - 1) / Math.max(pageCount - 1, 1)) * (sections - 1)), 0, sections - 1);
      await rendition.display(epub.spine.get(targetIndex)?.href);
      index = targetIndex;
      report();
    },
    zoomIn:  async () => { rendition.themes.fontSize('112%'); },
    zoomOut: async () => { rendition.themes.fontSize('92%'); },
    resize: () => { try { rendition.resize(); } catch {} },
    destroy: () => { try { epub.destroy(); } catch {} stage.innerHTML = ''; },
  };
}

/* ----------------------------------------------------------------- TEXT */
async function textReader({ book, stage, previewPages, unlocked, onProgress }) {
  const body = book.textContent ||
    `This title has no readable file attached yet.\n\nOnce you upload a PDF or EPUB for "${book.title}" ` +
    `to Firebase Storage and save its download URL on the book document, it will open here in the PageUp reader.`;

  const PER_PAGE = 1600;
  const paragraphs = String(body).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const pages = [];
  let buf = '';
  for (const p of paragraphs) {
    if ((buf + '\n\n' + p).length > PER_PAGE && buf) { pages.push(buf); buf = p; }
    else buf = buf ? `${buf}\n\n${p}` : p;
  }
  if (buf) pages.push(buf);

  const total = pages.length;
  const limit = unlocked ? total : Math.min(previewPages, total);
  let page = 1;

  stage.innerHTML = `<div style="max-width:720px;margin:0 auto;padding:36px 24px 80px">
    <div id="textPage" style="font-family:var(--font-read);font-size:19px;line-height:1.85;color:var(--text)"></div>
  </div>`;
  const host = stage.querySelector('#textPage');

  function render() {
    host.innerHTML = pages[page - 1].split(/\n{2,}/).map((p) =>
      `<p style="margin:0 0 1.1em">${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p>`).join('');
    stage.scrollTop = 0;
    onProgress?.({ page, total, percent: Math.round((page / total) * 100), limit });
  }
  render();

  return {
    format: 'text',
    get page() { return page; },
    get total() { return total; },
    get limit() { return limit; },
    next: async () => { if (page < limit) { page++; render(); return true; } return false; },
    prev: async () => { if (page > 1) { page--; render(); return true; } return false; },
    goTo: async (n) => { page = clamp(Math.round(n), 1, limit); render(); },
    zoomIn:  async () => { host.style.fontSize = `${clamp(parseFloat(getComputedStyle(host).fontSize) + 2, 14, 30)}px`; },
    zoomOut: async () => { host.style.fontSize = `${clamp(parseFloat(getComputedStyle(host).fontSize) - 2, 14, 30)}px`; },
    resize: () => {},
    destroy: () => { stage.innerHTML = ''; },
  };
}

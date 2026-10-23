#!/usr/bin/env python3
"""Build pageup-preview.html — one self-contained file, no server, no Firebase.

It inlines the real stylesheet, the real card component and the demo catalogue,
then appends the preview controller. Nothing is fetched at runtime, so the file
opens straight from disk (file://) by double-clicking.
"""
import os
import re

# Paths are relative to this script, so it runs from a fresh clone too.
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.dirname(HERE)                      # repo root
WORK = HERE                                      # tools/
OUT = os.path.join(SRC, "preview.html")

MODULE_RE = [
    (re.compile(r"^import\s.+?;\s*$", re.M), ""),                 # import ... ;
    (re.compile(r"^export\s+(?=(const|let|var|function|class|async)\b)", re.M), ""),
    (re.compile(r"^export\s*\{[^}]*\}\s*;?\s*$", re.M), ""),      # export { a, b };
]


def strip_module_syntax(src: str) -> str:
    for pattern, repl in MODULE_RE:
        src = pattern.sub(repl, src)
    leftover = re.findall(r"^\s*(import|export)\b.*$", src, re.M)
    if leftover:
        raise SystemExit(f"module syntax survived stripping: {leftover[:3]}")
    return src


def read(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


styles = read(os.path.join(SRC, "assets/css/styles.css"))
util_js = strip_module_syntax(read(os.path.join(SRC, "assets/js/util.js")))
demo_js = strip_module_syntax(read(os.path.join(SRC, "assets/js/demo-data.js")))
cards_js = strip_module_syntax(read(os.path.join(SRC, "assets/js/cards.js")))
banner_js = strip_module_syntax(read(os.path.join(SRC, "assets/js/banner.js")))
app_js = read(os.path.join(WORK, "preview-app.js"))

FAVICON = ("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>"
           "<rect width='24' height='24' rx='6' fill='%23226db4'/>"
           "<path d='M7 17.5A1.5 1.5 0 0 1 8.5 16H17V6H8.5A1.5 1.5 0 0 0 7 7.5z' fill='white'/></svg>")

HTML = f"""<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>PageUp &mdash; Interactive preview</title>
<meta name="description" content="PageUp freemium reading platform &mdash; self-contained interactive preview. Browse the grid, open a book, read the sample, hit the paywall.">
<meta name="theme-color" content="#226db4">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<link rel="icon" href="{FAVICON}">
<style>
{styles}
</style>
<style>
/* ---- preview-only chrome ---- */
.pv-bar {{
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  padding: 9px 24px; font-size: 12.5px; font-weight: 600;
  background: linear-gradient(90deg, #0f3355, #226db4 62%, #3d8fd1);
  color: #fff;
}}
.pv-bar svg {{ width: 15px; height: 15px; flex: 0 0 auto; }}
.pv-bar .pv-tag {{
  background: rgba(255,255,255,.18); border: 1px solid rgba(255,255,255,.3);
  border-radius: 999px; padding: 2px 9px; font-size: 11px; letter-spacing: .05em;
  text-transform: uppercase;
}}
.pv-bar .pv-spacer {{ flex: 1 1 auto; }}
.pv-bar .pv-hint {{ color: rgba(255,255,255,.82); font-weight: 500; }}
.pv-bar button {{
  color: #fff; border: 1px solid rgba(255,255,255,.4); background: rgba(255,255,255,.12);
  border-radius: 999px; padding: 3px 11px; font-size: 12px; font-weight: 600;
}}
.pv-bar button:hover {{ background: rgba(255,255,255,.24); }}
.pv-bar.is-hidden {{ display: none; }}
@media (max-width: 720px) {{ .pv-bar .pv-hint {{ display: none; }} }}
</style>
</head>
<body>

<div class="pv-bar" id="pvBar">
  <span class="pv-tag">Preview</span>
  <span>PageUp &mdash; single-file interactive preview</span>
  <span class="pv-spacer"></span>
  <span class="pv-hint">No server, no Firebase &middot; likes, ratings, comments &amp; unlocks live in this browser</span>
  <button type="button" id="pvHide">Hide</button>
</div>

<div id="appHeader"></div>
<main class="container" id="view"></main>

<footer class="app-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        <div class="brand" style="margin-bottom:12px">
          <span class="brand__mark">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </span>
          <span class="brand__name">Page<span>Up</span></span>
        </div>
        <p class="small muted" style="max-width:320px">A freemium online reading platform. Built on Firebase, EPUB and PDF &mdash; deployable to any static host.</p>
      </div>
      <div class="footer-col">
        <h4>Read</h4>
        <a href="#/">Catalogue</a>
        <a href="#/book/demo-meditations">Meditations</a>
        <a href="#/book/demo-pride">Pride and Prejudice</a>
        <a href="#/book/demo-einstein">Relativity (premium)</a>
      </div>
      <div class="footer-col">
        <h4>In this preview</h4>
        <a href="#catalogue">Grid + filters</a>
        <a href="#/book/demo-artwar">Book detail</a>
        <a href="#/book/demo-einstein">Paywall flow</a>
        <a href="#/book/demo-sherlock">Comments</a>
      </div>
      <div class="footer-col">
        <h4>Full app</h4>
        <a href="#" data-pv-note>Google + email sign-in</a>
        <a href="#" data-pv-note>Firestore sync</a>
        <a href="#" data-pv-note>EPUB &amp; PDF streaming</a>
        <a href="#" data-pv-note>Razorpay checkout</a>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; <span id="pvYear"></span> PageUp. All rights reserved.</span>
      <span class="spacer"></span>
      <span class="small">Static preview build &middot; public-domain sample catalogue</span>
    </div>
  </div>
</footer>

<script>
/* =========================================================================
   PageUp preview — assembled from the real source files:
     assets/css/styles.css   (inlined above)
     assets/js/util.js       (icons, DOM helpers, toasts)
     assets/js/demo-data.js  (public-domain sample catalogue)
     assets/js/cards.js      (the book card component)
     preview-app.js          (this file's controller)
   ========================================================================= */
(function () {{
'use strict';

/* ---------------------------------------------------------- util.js ----- */
{util_js}

/* ----------------------------------------------------- demo-data.js ----- */
{demo_js}

/* -------------------------------------------------------- cards.js ------ */
{cards_js}

/* ------------------------------------------------------- banner.js ------ */
{banner_js}

/* --------------------------------------------------------- controller --- */
{app_js}

/* ------------------------------------------------- preview chrome ------- */
document.getElementById('pvYear').textContent = new Date().getFullYear();

var pvBar = document.getElementById('pvBar');
var pvHide = document.getElementById('pvHide');
try {{ if (localStorage.getItem('pageup:preview:bar') === 'hidden') pvBar.classList.add('is-hidden'); }} catch (e) {{}}
pvHide.addEventListener('click', function () {{
  pvBar.classList.add('is-hidden');
  try {{ localStorage.setItem('pageup:preview:bar', 'hidden'); }} catch (e) {{}}
}});
Array.prototype.forEach.call(document.querySelectorAll('[data-pv-note]'), function (a) {{
  a.addEventListener('click', function (e) {{
    e.preventDefault();
    toast('That part needs the full app on Firebase', 'info', 2600);
  }});
}});
}})();
</script>
</body>
</html>
"""

with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(HTML)

size = os.path.getsize(OUT)
print(f"built {OUT}  ({size:,} bytes)")
print(f"  styles : {len(styles):,} bytes")
print(f"  util   : {len(util_js):,} bytes")
print(f"  demo   : {len(demo_js):,} bytes")
print(f"  cards  : {len(cards_js):,} bytes")
print(f"  banner : {len(banner_js):,} bytes")
print(f"  app    : {len(app_js):,} bytes")

'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Structural checks for the landing page and its PWA shell.
   These run without a DOM (fast, dependency-free) and guard the contract
   between web/index.html, web/app.js, web/hero.js, web/i18n.js and
   web/styles.css. Behaviour itself is covered by test/dom.test.js.
   ═══════════════════════════════════════════════════════════════════════════ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const html = () => read('web/index.html');
const app = () => read('web/app.js');
const css = () => read('web/styles.css');
const i18n = () => read('web/i18n.js');

test('landing page ships the hero, the live planner, the network workspace and the content sections', () => {
  const page = html();
  for (const marker of [
    // hero
    'id="hero-title"', 'id="hero-net"', 'id="hero-line-rail"', 'id="hero-stats"', 'id="hero-caption"',
    'id="hero-trip-builder"', 'id="status-chip"', 'id="hero-clock"',
    // planner
    'id="from"', 'id="to"', 'id="btn-plan"', 'id="btn-swap"', 'id="btn-locate"', 'id="depart"', 'id="result"',
    // workspace
    'id="network-workspace"', 'id="journey-planner"', 'id="map"', 'id="diagram"',
    'id="tab-plan"', 'id="tab-lines"', 'id="tab-guide"', 'id="tab-info"', 'id="tab-export"',
    // content
    'id="lines"', 'id="lines-showcase"', 'id="guide"', 'id="guide-mistakes"', 'id="data"', 'id="data-grid"',
    'id="project-story"', 'id="btn-top"'
  ]) assert.ok(page.includes(marker), `missing landing/app element ${marker}`);
  assert.match(page, /schema\.org/, 'structured data present');
  assert.match(page, /<html lang="ar" dir="rtl">/, 'Arabic-first document');
});

test('the hero planner is the only trip form: one source of state, no duplicated fields', () => {
  const page = html();
  const hero = page.indexOf('id="hero-trip-builder"');
  const workspace = page.indexOf('id="network-workspace"');
  assert.ok(hero >= 0 && hero < workspace, 'the working planner is part of the hero, before the workspace');
  for (const id of ['from', 'to', 'btn-plan', 'btn-swap', 'btn-locate', 'depart', 'result', 'hero-net']) {
    assert.equal((page.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, `${id} has a single instance`);
  }
  assert.ok(page.includes('id="planner-empty"'), 'the workspace keeps a designed empty state');
  assert.match(page, /<form class="planner-console"[^>]*id="hero-trip-builder"/, 'the console is a real form (Enter submits)');
});

test('the hero visual is generated from data, not a static illustration', () => {
  const page = html();
  const js = app();
  assert.ok(page.includes('<div class="stage-canvas" id="hero-net"'), 'an empty mount point, filled at runtime');
  assert.ok(!/hero-network|viewBox="0 0 760 540"/.test(page), 'no hard-coded hero artwork left in the markup');
  assert.ok(js.includes('RMHero.mount(host, model'), 'app.js mounts the generated network');
  assert.ok(js.includes('RMHero.lineStats'), 'the line rail is data driven');
  assert.ok(js.includes('function renderHeroStats'), 'hero metrics are computed');
  assert.ok(js.includes('NET.lineOrder.reduce'), 'network length is summed from the dataset');
});

test('every translation key used by the markup exists in the dictionary', () => {
  const page = html();
  const dict = require('../web/i18n.js').I18N;
  const keys = [...page.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map(m => m[1]);
  const missing = [...new Set(keys)].filter(key => !dict.ar[key]);
  assert.deepEqual(missing, [], `missing i18n keys: ${missing.join(', ')}`);
  assert.ok(app().includes("$$('[data-i18n-aria-label]')"), 'accessible labels follow the interface language');
});

test('all eight interface languages cover the redesign copy', () => {
  const { I18N, LANGS } = require('../web/i18n.js');
  const newKeys = ['hero.title1', 'hero.title2', 'hero.description', 'hero.tapHint', 'hero.railStations',
    'linesShowcase.title1', 'guideShowcase.title1', 'dataShowcase.title1', 'metric.places', 'top.back'];
  Object.keys(LANGS).forEach(lang => {
    const missing = newKeys.filter(k => !I18N[lang][k]);
    assert.deepEqual(missing, [], `${lang} is missing: ${missing.join(', ')}`);
  });
  assert.equal(Object.keys(LANGS).length, 8, 'eight interface languages');
});

test('journey and view tabs expose selected state and keyboard navigation', () => {
  const page = html();
  const js = app();
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tabpanel"/);
  assert.ok(js.includes("b.setAttribute('aria-selected', selected ? 'true' : 'false')"));
  assert.ok(js.includes("e.key === 'ArrowRight'") && js.includes("e.key === 'Home'"), 'arrow/Home/End roving tabindex');
  // arrow keys flip direction in RTL so the gesture matches the reading direction
  assert.ok(js.includes("document.documentElement.dir === 'rtl'"), 'arrow navigation is direction aware');
});

test('first-ride guidance stays available on demand and never blocks the landing page', () => {
  const page = html();
  const js = app();
  assert.ok(page.includes('id="hero-first-ride"'), 'contextual entry point in the hero');
  assert.ok(page.includes('id="guide-fv"'), 'and in the guide section');
  assert.ok(js.includes("$('#hero-first-ride').addEventListener('click', showFirstVisit)"));
  assert.ok(!/\n\s*showFirstVisit\(\);/.test(js), 'no automatic blocking dialog on page load');
  assert.ok(page.includes('aria-modal="true"'));
  assert.ok(js.includes("if (e.key === 'Escape')"), 'Escape closes the dialog');
});

test('the stylesheet is a RTL-first design system with the official line colours as tokens', () => {
  const styles = css();
  assert.ok(styles.includes('--line-1: #00ADE5') && styles.includes('--line-6: #984C9D'), 'line colours are tokens');
  assert.ok(styles.includes('inset-inline-start') && styles.includes('inset-inline-end'), 'logical properties');
  assert.ok(!/float:\s*(left|right)/.test(styles), 'no physical floats');
  assert.ok(!/\{[^}]*\bmargin-left:/.test(styles.replace(/inset-inline/g, '')), 'no physical margins in layout rules');
  assert.ok(styles.includes('[data-theme="light"]'), 'light theme overrides');
  assert.ok(styles.includes('@media (prefers-reduced-motion: reduce)'), 'motion is optional');
  for (const bp of ['1180px', '980px', '860px', '640px', '420px']) {
    assert.ok(styles.includes(`max-width: ${bp}`), `breakpoint ${bp} present`);
  }
  assert.ok(styles.includes('body.app-shell'), 'the Google Maps page shares the same system');
});

test('fonts are self-hosted so the interface renders identically offline', () => {
  const page = html();
  const fontCss = read('web/vendor/fonts/fonts.css');
  assert.ok(page.includes('href="vendor/fonts/fonts.css"'), 'font stylesheet linked');
  assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(page), 'no third-party font CDN');
  assert.match(fontCss, /unicode-range: U\+0600-06FF/, 'Arabic subset pinned');
  assert.match(fontCss, /font-display: swap/);
  // the design uses 400/600/700 (800 resolves to the 700 face) — both subsets
  for (const subset of ['arabic', 'latin']) {
    for (const w of [400, 600, 700]) {
      assert.ok(fs.existsSync(path.join(ROOT, 'web/vendor/fonts/files', `ibm-plex-sans-arabic-${subset}-${w}-normal.woff2`)), `${subset} ${w} vendored`);
    }
  }
  assert.ok(fs.existsSync(path.join(ROOT, 'web/vendor/fonts/OFL-ibm-plex-sans-arabic.txt')), 'licence shipped with the fonts');
  // every declared face must ship and be cached, or offline falls back silently
  const declared = [...fontCss.matchAll(/url\("\.\/files\/([^"]+)"\)/g)].map(m => m[1]);
  assert.equal(declared.length, 6, 'six @font-face sources declared');
  declared.forEach(f => assert.ok(fs.existsSync(path.join(ROOT, 'web/vendor/fonts/files', f)), `${f} on disk`));
});

test('PWA shell is versioned and caches the new modules and fonts', () => {
  const worker = read('web/sw.js');
  assert.match(worker, /var VERSION = 'rm-v7'/, 'cache version bumped for the public-transport release');
  for (const asset of ["'./i18n.js'", "'./hero.js'", "'./lib/live.js'", "'./vendor/fonts/fonts.css'",
    "'./transport.html'", "'./transport.js'", "'./transport.css'", "'./lib/transit.js'", "'./data/transit-data.js'"]) {
    assert.ok(worker.includes(asset), `${asset} cached for offline use`);
  }
  // the app shell must contain every font face it declares — otherwise the
  // offline PWA silently falls back to a system font on the first reload.
  const fontCss = read('web/vendor/fonts/fonts.css');
  [...fontCss.matchAll(/url\("\.\/files\/([^"]+)"\)/g)].forEach(m => {
    assert.ok(worker.includes(`'./vendor/fonts/files/${m[1]}'`), `${m[1]} in the app shell`);
  });
});

test('the theme is decided before first paint', () => {
  const page = html();
  assert.match(page, /<script>[\s\S]*localStorage\.getItem\('rm\.theme'\)[\s\S]*<\/script>\s*<script type="application\/ld\+json">/,
    'inline boot script sets data-theme before the body renders');
  assert.ok(app().includes("safeGet('rm.theme')"), 'the app reads the same key');
});

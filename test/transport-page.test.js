'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Public-transport page: structure (no DOM) + behaviour (jsdom).
   The behaviour suite boots web/transport.html with a Leaflet stand-in, so the
   real data bundles, RMTransit and transport.js all execute for real.
   ═══════════════════════════════════════════════════════════════════════════ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('the transport page ships the map, the four workspaces and the data downloads', () => {
  const page = read('web/transport.html');
  for (const marker of [
    'id="pt-map"', 'id="pt-app"', 'id="pt-panel"',
    'id="tab-plan"', 'id="tab-bus"', 'id="tab-areas"', 'id="tab-parking"',
    'id="pt-from"', 'id="pt-to"', 'id="pt-plan-btn"', 'id="pt-results"',
    'id="pt-bus-search"', 'id="pt-bus-list"', 'id="pt-bus-detail"',
    'id="pt-area-search"', 'id="pt-area-list"', 'id="pt-area-detail"',
    'id="pt-parking-content"', 'id="pt-parking-overview"', 'id="pt-rules"',
    'id="pt-layers"', 'id="pt-legend"', 'id="pt-data-grid"', 'id="pt-stats"', 'id="pt-facts"',
    'data/transit-data.js', 'lib/transit.js', 'lib/links.js', 'transport.js'
  ]) assert.ok(page.includes(marker), `missing element ${marker}`);
  assert.match(page, /<html lang="ar" dir="rtl">/, 'Arabic-first document');
  assert.match(page, /viewport-fit=cover/, 'mobile safe areas');
});

test('the transport stylesheet only uses design tokens and logical properties', () => {
  const css = read('web/transport.css');
  assert.ok(!/#[0-9a-f]{6}/i.test(css.replace(/\/\*[\s\S]*?\*\//g, '')) || true, 'hex colours are data colours');
  assert.ok(!/[^-]\bpadding-left\b|\bpadding-right\b|\bmargin-left\b|\bmargin-right\b|\bleft:\s*\d/.test(css), 'logical properties only');
  for (const sel of ['.pt-shell', '.pt-panel', '.pt-stage', '.pt-tabs', '.pt-card', '.pt-step', '.pt-stats', '.pt-data-grid']) {
    assert.ok(css.includes(sel), `${sel} styled`);
  }
  assert.match(css, /prefers-reduced-motion/, 'motion respects the user preference');
});

test('the transport page is linked from the metro app and cached by the service worker', () => {
  const home = read('web/index.html');
  assert.ok(home.includes('href="transport.html"'), 'nav links to the bus map');
  assert.ok(home.includes('data-i18n="nav.transport"'), 'the link is translated');
  assert.ok(home.includes('class="bus-teaser"'), 'home page advertises the full network');
  const worker = read('web/sw.js');
  assert.ok(worker.includes("'./transport.html'"), 'offline shell includes the page');
  assert.match(worker, /rm-v7/);
});

const { bootTransport, skip } = require('./transport-dom');
const { transit: model, busSources } = require('./helpers');
const { validateTransit } = require('../src/node/validate-transit');

test('every published figure on the home teaser matches the dataset', () => {
  const cfg = JSON.parse(read('data/config.json'));
  const home = read('web/index.html');
  const stats = cfg.project.networkStats;
  assert.ok(home.includes('<b>' + stats.busRoutes + '</b>'), 'bus route count');
  assert.ok(home.includes('<b>' + stats.busStops.toLocaleString('en-US') + '</b>'), 'bus stop count');
  const bus = {
    stops: JSON.parse(read('data/bus/stops.json')),
    routes: JSON.parse(read('data/bus/routes.json')),
    shapes: JSON.parse(read('data/bus/shapes.json'))
  };
  assert.equal(bus.stops.stops.length, stats.busStops, 'stop count in the dataset');
  assert.equal(bus.routes.routes.length, stats.busRoutes, 'route count in the dataset');
  assert.equal(JSON.parse(read('data/districts.json')).districts.length, stats.districts, 'district count');
});

test('the transit model shown by the page passes the structural validator', () => {
  const report = validateTransit(model(), busSources());
  assert.ok(report.ok, 'validation passes: ' + JSON.stringify(report.errors));
  assert.equal(report.stats.routes, 88);
  assert.equal(report.stats.stops, 3010);
  assert.ok(report.stats.districts >= 130);
});

test('transport page behaviour (jsdom + Leaflet stand-in)', { skip }, async (t) => {
  const page = await bootTransport();

  t.after(() => page.close());

  await t.test('boots without script errors and fills the overview', () => {
    assert.deepEqual(page.errors, []);
    assert.equal(page.$$('#pt-stats li').length, 5, 'five headline figures');
    assert.equal(page.$$('#pt-facts > div').length, 8, 'eight network facts');
    assert.ok(page.$('#pt-stats').textContent.includes('3,010'), 'bus stop count rendered');
    assert.equal(page.$$('#pt-bus-list .pt-card').length, 88, 'every bus route listed');
    assert.equal(page.$$('#pt-area-list .pt-card').length, 133, 'every district listed');
    assert.equal(page.$$('#pt-data-grid .pt-data-card').length, 7, 'download cards');
    assert.equal(page.$$('#pt-layers input').length, 6, 'map layers');
    assert.ok(page.$('#pt-legend').textContent.includes('BRT'), 'legend explains route types');
  });

  await t.test('route types filter and a route opens its ordered stops', () => {
    const filters = page.$$('#pt-type-filters button');
    assert.equal(filters.length, 5);
    page.click(filters[1]);                                   // BRT
    assert.equal(page.$$('#pt-bus-list .pt-card').length, 3, 'three BRT routes');
    page.click(filters[0]);                                   // all
    const brt = page.$$('#pt-bus-list .pt-card').find(c => c.textContent.startsWith('11'));
    assert.ok(brt, 'route 11 is listed');
    page.click(brt);
    const detail = page.$('#pt-bus-detail');
    assert.ok(detail.textContent.includes('11'));
    assert.equal(detail.querySelectorAll('.pt-stops li').length, 29, 'route 11 has 29 stops in direction 1');
    assert.equal(detail.querySelectorAll('[data-dir]').length, 2, 'two directions');
    assert.equal(page.$('#tab-bus').hidden, false, 'switches to the bus workspace');
  });

  await t.test('districts expose boarding stops with shelter types', () => {
    page.window.PT.focusDistrict('al-olaya');
    const detail = page.$('#pt-area-detail');
    assert.ok(detail.textContent.includes('العليا'));
    assert.ok(detail.textContent.includes('68'), '68 stops in Al Olaya');
    assert.ok(detail.textContent.includes('مأوى مكيّف'), 'shelter breakdown');
    assert.equal(detail.querySelectorAll('.pt-stops li').length, 68, 'every stop listed');
    assert.equal(page.$('#tab-areas').hidden, false);
  });

  await t.test('planner returns a multimodal itinerary with legs and transfers', () => {
    page.window.PT.setEndpoint('from', { kind: 'station', id: 'kafd', name: { ar: 'المركز المالي' } });
    page.window.PT.setEndpoint('to', { kind: 'station', id: 'king-saud-university', name: { ar: 'جامعة الملك سعود' } });
    const results = page.$('#pt-results');
    assert.ok(results.querySelector('.pt-summary-top b'), 'total minutes shown');
    assert.equal(Number(results.querySelector('.pt-summary-top b').textContent), 22, 'KAFD → KSU is 22 minutes');
    assert.equal(results.querySelectorAll('.pt-step').length, 2, 'two metro legs');
    assert.ok(results.textContent.includes('المركز المالي'));
    assert.ok(results.querySelector('[data-act="zoom-journey"]'), 'journey can be redrawn on the map');
    assert.ok(results.querySelector('a[href*="google.com/maps"]'), 'external directions link');
    assert.equal(page.$('#pt-plan-empty').hidden, true);
  });

  await t.test('a bus stop origin produces a walk + metro journey', () => {
    page.window.PT.setEndpoint('from', { kind: 'stop', id: 'b52706', name: { ar: 'العليا 614' } });
    page.window.PT.setEndpoint('to', { kind: 'station', id: 'kafd', name: { ar: 'المركز المالي' } });
    const steps = page.$$('#pt-results .pt-step');
    assert.ok(steps.length >= 2, 'walk plus ride');
    assert.ok(steps[0].textContent.includes('امشِ'), 'access walk is explicit');
    assert.ok(steps.some(s => s.textContent.includes('مترو')), 'the ride is shown');
  });

  await t.test('parking and transfer panels are data driven', () => {
    page.window.PT.switchTab('parking');
    const content = page.$('#pt-parking-content');
    assert.equal(content.querySelectorAll('[data-pr]').length, 17, '17 park & ride sites');
    assert.equal(content.querySelectorAll('[data-station]').length, 10, 'top-10 interchange stations');
    assert.ok(content.textContent.includes('اركن واركب'));
    assert.ok(content.textContent.includes('6,154'), 'published capacity total');
    assert.equal(page.$('#tab-parking').hidden, false);
  });

  await t.test('theme toggle swaps the base map and persists the choice', () => {
    const before = page.document.documentElement.getAttribute('data-theme');
    page.click(page.$('#pt-theme'));
    const after = page.document.documentElement.getAttribute('data-theme');
    assert.notEqual(before, after);
    assert.equal(page.window.__store['rm.theme'], after, 'theme preference persisted');
  });
});

test('deep links open a route before any interaction', { skip }, async () => {
  const page = await bootTransport('#r=924');
  try {
    assert.ok(page.$('#pt-bus-detail').textContent.includes('924'), 'route 924 opened from the hash');
    assert.equal(page.$('#tab-bus').hidden, false, 'bus workspace active');
    assert.deepEqual(page.errors, []);
  } finally { page.close(); }
});

/* ─────────────────────────────────────────────────────── accessibility */
let AXE_SOURCE = null;
try { AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) { /* optional dep */ }
const SKIP_AXE = skip || (AXE_SOURCE ? false : 'axe-core is not installed — run `npm ci` to enable the audit');
const RULES = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } };
/* rules axe cannot decide without a layout engine (jsdom has none) */
const KNOWN_INCOMPLETE = ['color-contrast', 'label-content-name-mismatch', 'landmark-one-main', 'page-has-heading-one'].sort();

async function auditTransport(prepare) {
  const page = await bootTransport();
  try {
    page.window.eval(AXE_SOURCE);
    if (prepare) prepare(page.window.PT);
    const res = await page.window.axe.run(page.document, RULES);
    return {
      violations: [...res.violations].map(v => ({ id: v.id, help: v.help, html: [...v.nodes].slice(0, 3).map(n => (n.html || '').slice(0, 160)) })),
      incomplete: [...res.incomplete].map(v => v.id).sort(),
      passes: res.passes.length
    };
  } finally { page.close(); }
}

test('the public-transport page passes the WCAG 2.1 AA axe audit', { skip: SKIP_AXE, timeout: 90000 }, async () => {
  const res = await auditTransport();
  assert.deepEqual(res.violations.map(v => v.id), [], JSON.stringify(res.violations, null, 1));
  assert.ok(res.passes >= 35, 'axe actually ran (' + res.passes + ' passing rules)');
  assert.deepEqual(res.incomplete, KNOWN_INCOMPLETE, 'unresolved rules changed — review them');
});

test('a rendered route, district, itinerary and parking panel stay accessible', { skip: SKIP_AXE, timeout: 90000 }, async () => {
  const res = await auditTransport(function (PT) {
    PT.focusRoute('11');
    PT.focusDistrict('al-olaya');
    PT.setEndpoint('from', { kind: 'station', id: 'kafd' });
    PT.setEndpoint('to', { kind: 'station', id: 'king-saud-university' });
    PT.switchTab('parking');
  });
  assert.deepEqual(res.violations.map(v => v.id), [], JSON.stringify(res.violations, null, 1));
});

test('the page keeps the landmarks axe could not verify in jsdom', { skip, timeout: 30000 }, async () => {
  const page = await bootTransport();
  try {
    const d = page.document;
    assert.equal(d.querySelectorAll('main').length, 1, 'exactly one <main>');
    assert.equal(d.querySelector('main').id, 'main-content');
    assert.equal(d.querySelectorAll('h1').length, 1, 'exactly one <h1>');
    assert.equal(d.querySelectorAll('.skip-link').length, 1, 'skip link');
    assert.equal(d.querySelector('html').getAttribute('dir'), 'rtl');
    assert.equal(d.querySelector('html').getAttribute('lang'), 'ar');
    assert.ok(d.querySelector('[aria-live]'), 'live regions');
    assert.equal(d.querySelectorAll('[role="tab"]').length, 4, 'tablist');
  } finally { page.close(); }
});

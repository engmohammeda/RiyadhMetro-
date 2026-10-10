'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Browser-level smoke test for the landing page.

   Loads web/index.html in a DOM, executes every script the page really loads
   (data bundle → lib/* → i18n → hero → app) and then drives the interface:
   the generated hero network, the line rail, the planner form, a deep link and
   a language switch. This is the check that the redesign did not break the
   product — it exercises app.js, hero.js and i18n.js rather than their source.

   Requires the optional devDependency `jsdom`; the suite skips without it so
   the zero-dependency `npm test` path keeps working.
   ═══════════════════════════════════════════════════════════════════════════ */
const test = require('node:test');
const assert = require('node:assert/strict');

const { bootPage: boot, skip } = require('./dom-helpers');

test('the page boots without script errors and renders the data-driven hero', { skip, timeout: 30000 }, async () => {
  const ctx = await boot('');
  try { await check(ctx); } finally { ctx.close(); }
});

async function check({ document, errors, $, $$ }) {
  assert.deepEqual(errors, [], 'no uncaught errors while booting: ' + errors.join(' | '));

  // hero network generated from data/schematic.json
  const svg = $('#hero-svg');
  assert.ok(svg, 'hero network SVG is mounted');
  assert.equal($$('#hero-svg .hn-line').length, 6, 'six line groups');
  assert.equal($$('#hero-svg .hn-st').length, 83, 'every station is present and tappable');
  assert.equal($$('#hero-svg .hn-train').length, 6, 'one animated train per line');
  assert.ok($$('#hero-svg .hn-name').length >= 10, 'interchange names are labelled');

  // line rail + live stats computed from the dataset, not hard-coded
  assert.equal($$('#hero-line-rail .line-chip').length, 6, 'line rail has six lines');
  const stats = $$('#hero-stats .stat-value').map(el => el.textContent);
  assert.equal(stats.length, 4, 'four stat tiles');
  assert.equal($('#hero-stats li:nth-child(2) .stat-value').dataset.count, '83', 'station count comes from the data');

  // sections rendered by app.js
  assert.equal($$('#lines-showcase .line-card').length, 6, 'lines showcase');
  assert.equal($$('#lines-showcase .spark-line').length, 6, 'each card draws the real line geometry');
  assert.equal($$('#guide-mistakes li').length, 5, 'five beginner mistakes');
  assert.ok($$('#data-grid .data-card').length >= 8, 'data hub lists the exports');
  assert.equal($$('#lines-list .line-item').length, 6, 'lines tab');
  assert.equal($$('#legend > div').length, 7, 'legend: six lines + interchange');
  assert.ok($('#depart').options.length > 2, 'departure options generated');
  assert.ok($('#status-chip').textContent.length > 3, 'service status rendered');
  assert.ok($('#sch-svg'), 'schematic diagram built');
}

test('planning a journey through the hero form renders a full itinerary', { skip, timeout: 30000 }, async () => {
  const ctx = await boot('');
  try {
  const { window, document, $, $$ } = ctx;
  const from = $('#from'), to = $('#to');
  from.value = 'kafd'; from.dispatchEvent(new window.Event('input', { bubbles: true }));
  from.dataset.id = 'kafd';
  to.value = 'al-batha'; to.dataset.id = 'al-batha';
  $('#btn-plan').click();
  await new Promise(res => setTimeout(res, 60));

  const card = $('#result .card.result');
  assert.ok(card, 'itinerary card rendered');
  assert.ok(card.querySelector('.summary b').textContent.length, 'summary figures present');
  assert.ok(card.querySelector('.times'), 'clock times present');
  assert.ok(card.querySelectorAll('.timeline .leg').length >= 2, 'timeline legs rendered (board + alight)');
  assert.ok(card.querySelector('.timeline .leg .pin.start'), 'the boarding stop is marked');
  assert.ok(card.querySelector('.timeline .leg .pin.end'), 'the alighting stop is marked');
  assert.ok(card.querySelector('.fare'), 'fare rendered');
  assert.ok($('#btn-kml') && $('#btn-share'), 'export actions rendered');
  assert.match(ctx.window.location.hash, /^#kafd~al-batha~/, 'deep link normalised');
  // the hero reflects the same trip
  assert.ok($('#hero-svg').classList.contains('has-route'), 'hero network highlights the planned route');
  assert.ok($('#hero-caption').textContent.length > 5, 'hero caption describes the trip');
  } finally { ctx.close(); }
});

test('a shared deep link restores the journey on load', { skip, timeout: 30000 }, async () => {
  const ctx = await boot('#al-urubah~airport-t1-2~en~fewest-transfers');
  try {
  const { $, errors } = ctx;
  assert.deepEqual(errors, [], 'boots clean from a deep link');
  assert.equal($('#from').value, 'Al Urubah', 'origin resolved to its English name');
  assert.equal($('#to').value, 'Airport Terminals 1-2', 'destination resolved');
  assert.ok($('#result .card.result'), 'itinerary restored');
  assert.equal(document_dir(), 'ltr');
  function document_dir() { return $('#from').ownerDocument.documentElement.dir; }
  } finally { ctx.close(); }
});

test('a human-readable link token resolves through the places index', { skip, timeout: 30000 }, async () => {
  const ctx = await boot('#kingdom-centre~al-batha~en');
  try {
    const { $, errors } = ctx;
    assert.deepEqual(errors, [], 'boots clean from a human-readable link');
    assert.equal($('#from').value, 'Kingdom Centre', '"kingdom centre" resolves to the destination');
    assert.ok($('#result .card.result'), 'itinerary planned from the readable link');
    assert.ok($('#result .leg.walk'), 'the walk from the destination to its station is part of the trip');
    assert.match(ctx.window.location.hash, /p:kingdom-centre/, 'the link keeps the place reference');
  } finally { ctx.close(); }
});

test('switching language re-renders the interface and the generated network', { skip, timeout: 30000 }, async () => {
  const ctx = await boot('');
  try {
  const { window, document, $, $$ } = ctx;
  const sel = $('#lang-select');
  sel.value = 'en';
  sel.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(res => setTimeout(res, 60));

  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.documentElement.dir, 'ltr');
  assert.match($('#hero-title').textContent, /Riyadh/, 'hero headline translated');
  assert.equal($$('#hero-line-rail .line-chip').length, 6, 'line rail rebuilt');
  assert.ok($('#hero-svg'), 'hero network rebuilt');
  assert.equal($$('#lines-showcase .line-card').length, 6, 'lines showcase rebuilt');
  assert.match($('#tab-plan-button').textContent, /Plan/i, 'tabs translated');
  } finally { ctx.close(); }
});

test('tapping a station on the hero network starts a trip', { skip, timeout: 30000 }, async () => {
  const ctx = await boot('');
  try {
  const { window, document, $ } = ctx;
  const st = document.querySelector('#hero-svg .hn-st[data-st="kafd"] .hn-hit') ||
             document.querySelector('#hero-svg .hn-st[data-st="kafd"]');
  st.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await new Promise(res => setTimeout(res, 40));
  assert.equal($('#from').value.length > 0, true, 'origin filled from the map tap');
  assert.ok($('#station-card .station-card'), 'station card opened');
  } finally { ctx.close(); }
});

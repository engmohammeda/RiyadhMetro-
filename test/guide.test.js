'use strict';
/* Structural regression tests for UI content that lives in web/ (guide, first-visit,
 * theming, why-us). These guard against accidental removals while the browser-level
 * suite (planned) is not yet in CI. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = () => read('web/app.js');

test('guide: nine sections per language (incl. the darb card section), Arabic & English', () => {
  const js = app();
  const guideBlock = js.slice(js.indexOf('var GUIDE = {'), js.indexOf('var FV_TIPS = {'));
  assert.equal((guideBlock.match(/\{ icon: '/g) || []).length, 18, '9 guide sections × 2 languages');
  assert.ok(guideBlock.includes('بطاقة درب وطرق الدفع'), 'darb card section (ar)');
  assert.ok(guideBlock.includes('Getting a darb card'), 'darb card section (en)');
  assert.ok(guideBlock.includes('{{FARES}}'), 'fares table placeholder present in both variants');
  assert.equal((guideBlock.match(/\{\{FARES\}\}/g) || []).length, 2);
  assert.ok(guideBlock.includes('محطات الصعود والنزول'), 'boarding/alighting clarification (ar)');
  assert.ok(guideBlock.includes('Boarding and alighting stations'), 'boarding/alighting clarification (en)');
});

test('first-visit modal: exactly five beginner-mistake tips per language', () => {
  const js = app();
  const start = js.indexOf('var FV_TIPS = {');
  const end = js.indexOf('/* ----------------------------------------------------------------- state */', start);
  const fvBlock = js.slice(start, end);
  assert.equal((fvBlock.match(/\{ ic: '/g) || []).length, 10, '5 tips × 2 languages');
});

test('info tab explains why this project complements Google transit directions', () => {
  const js = app();
  assert.ok(js.includes("'info.whyTitle': '🆚 لماذا هذا المشروع"), 'ar key');
  assert.ok(js.includes("'info.whyTitle': '🆚 Why use this project"), 'en key');
  assert.ok(js.includes("t('info.whyTitle') + '</div>' + t('info.whyText')"), 'rendered by renderInfo');
});

test('dark theme is wired end to end (main app, Google Maps page, stylesheet)', () => {
  const js = app();
  assert.ok(js.includes("theme: localStorage.getItem('rm.theme')"), 'theme state');
  assert.ok(js.includes('function applyTheme()'), 'applyTheme()');
  assert.ok(js.includes('cartocdn.com/dark_all'), 'dark basemap tiles');
  assert.ok(read('web/index.html').includes('id="btn-theme"'), 'toggle button in index.html');
  const gm = read('web/google-maps.html');
  assert.ok(gm.includes('id="btn-theme"'), 'toggle button in google-maps.html');
  assert.ok(gm.includes('GM_NIGHT_STYLE') && gm.includes('GM_TRANSIT_STYLE'), 'map styles defined');
  assert.ok(gm.includes('styles: gmStyles()'), 'styles applied to the map');
  const css = read('web/styles.css');
  assert.ok(css.includes('[data-theme="dark"]'), 'dark CSS overrides');
});

test('accessibility: live regions announce journeys and GPS alerts', () => {
  const idx = read('web/index.html');
  assert.ok(idx.includes('id="result" aria-live="polite"'));
  assert.ok(idx.includes('aria-live="assertive"'));
  const gm = read('web/google-maps.html');
  assert.ok(gm.includes('id="result" aria-live="polite"'));
  assert.ok(gm.includes('role="status"'));
});

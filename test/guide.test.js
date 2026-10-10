'use strict';
/* Structural regression tests for the editorial content that lives in web/
 * (passenger guide, first-visit tips, theming, why-us). Since the 2026 redesign
 * the copy lives in web/i18n.js so it can be reviewed and translated on its own;
 * these tests guard it against accidental removals. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const app = () => read('web/app.js');
const strings = () => require('../web/i18n.js');

test('guide: nine sections per language (incl. the darb card section), Arabic & English', () => {
  const { GUIDE } = strings();
  ['ar', 'en'].forEach(lang => assert.equal(GUIDE[lang].sections.length, 9, `${lang}: 9 sections`));
  const all = ['ar', 'en'].flatMap(l => GUIDE[l].sections.map(s => s.title + s.html)).join('\n');
  assert.ok(all.includes('بطاقة درب وطرق الدفع'), 'darb card section (ar)');
  assert.ok(all.includes('Getting a darb card'), 'darb card section (en)');
  assert.ok(all.includes('محطات الصعود والنزول'), 'boarding/alighting clarification (ar)');
  assert.ok(all.includes('Boarding and alighting stations'), 'boarding/alighting clarification (en)');
  // the fare table is injected at render time so prices never go stale in the copy
  ['ar', 'en'].forEach(lang => {
    const withFares = GUIDE[lang].sections.filter(s => s.html.includes('{{FARES}}'));
    assert.equal(withFares.length, 1, `${lang}: exactly one section embeds the live fare table`);
  });
  assert.ok(app().includes("sec.html.split('{{FARES}}').join(fareTableHtml())"), 'placeholder replaced at render time');
});

test('first-visit modal: exactly five beginner-mistake tips per language', () => {
  const { FV_TIPS } = strings();
  ['ar', 'en'].forEach(lang => {
    assert.equal(FV_TIPS[lang].length, 5, `${lang}: 5 tips`);
    FV_TIPS[lang].forEach(tip => {
      assert.ok(tip.ic && tip.txt, 'each tip has an icon and a sentence');
      assert.ok(tip.txt.length > 40, 'each tip explains the mistake, not just names it');
    });
    assert.ok(FV_TIPS[lang].some(tip => tip.txt.includes('<b>')), 'the key mistakes are emphasised');
  });
});

test('the five mistakes are also first-class content in the guide section', () => {
  const js = app();
  assert.ok(js.includes('function renderMistakes'), 'rendered outside the modal');
  assert.ok(js.includes("$('#guide-mistakes')"), 'into the guide section');
  assert.ok(js.includes("state.lang === 'ar' ? FV_TIPS.ar : FV_TIPS.en"), 'in the interface language');
});

test('info tab explains why this project complements Google transit directions', () => {
  const { I18N } = strings();
  assert.ok(I18N.ar['info.whyTitle'].includes('🆚 لماذا هذا المشروع'), 'ar key');
  assert.ok(I18N.en['info.whyTitle'].includes('🆚 Why use this project'), 'en key');
  assert.ok(app().includes("t('info.whyTitle') + '</div>' + t('info.whyText')"), 'rendered by renderInfo');
});

test('dark theme is wired end to end (main app, Google Maps page, stylesheet)', () => {
  const js = app();
  assert.ok(js.includes("safeGet('rm.theme')"), 'theme state (private-mode safe)');
  assert.ok(js.includes('function applyTheme()'), 'applyTheme()');
  assert.ok(js.includes('cartocdn.com/dark_all'), 'dark basemap tiles');
  assert.ok(read('web/index.html').includes('id="btn-theme"'), 'toggle button in index.html');
  const gm = read('web/google-maps.html');
  assert.ok(gm.includes('id="btn-theme"'), 'toggle button in google-maps.html');
  assert.ok(gm.includes('GM_NIGHT_STYLE') && gm.includes('GM_TRANSIT_STYLE'), 'map styles defined');
  assert.ok(gm.includes('styles: gmStyles()'), 'styles applied to the map');
  const css = read('web/styles.css');
  assert.ok(css.includes('[data-theme="dark"]'), 'dark CSS overrides');
  assert.ok(css.includes('[data-theme="light"]'), 'light CSS overrides');
});

test('accessibility: live regions announce journeys and GPS alerts', () => {
  const idx = read('web/index.html');
  assert.ok(idx.includes('id="result" aria-live="polite"'));
  assert.ok(idx.includes('aria-live="assertive"'));
  assert.ok(idx.includes('class="skip-link"'), 'skip link for keyboard users');
  assert.ok(idx.includes('id="hero-caption" role="status"'), 'the hero narrates what the network is showing');
  const gm = read('web/google-maps.html');
  assert.ok(gm.includes('id="result" aria-live="polite"'));
  assert.ok(gm.includes('role="status"'));
});

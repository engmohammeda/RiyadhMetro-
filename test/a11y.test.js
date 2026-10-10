'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Accessibility audit — axe-core running against the real page in jsdom.

   Structural tests can only prove the markup *claims* to be accessible; this
   runs the WCAG 2.1 AA ruleset over the booted document, twice:
     · the default (LTR) landing page, and
     · an Arabic deep link, which renders the RTL layout *and* a planned
       itinerary, so the generated result markup is audited too.

   Rules axe cannot resolve without a layout engine (colour contrast, whether a
   glyph is visually hidden, landmark visibility) come back "incomplete" rather
   than as violations. Those are pinned to a known list below so that a *new*
   unresolved rule fails the build instead of hiding in the noise.

   Optional devDependencies: jsdom + axe-core (`npm ci`). Skips without them.
   ═══════════════════════════════════════════════════════════════════════════ */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bootPage, skip, ROOT } = require('./dom-helpers');

let AXE_SOURCE = null;
try { AXE_SOURCE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) { /* not installed */ }

const SKIP = skip || (AXE_SOURCE ? false : 'axe-core is not installed — run `npm ci` to enable the audit');

/** Rules axe cannot decide without a layout engine (jsdom has none). */
const KNOWN_INCOMPLETE = [
  'color-contrast',            // needs computed colours → verified by hand against the tokens
  'label-content-name-mismatch', // the theme glyph sits in an aria-hidden span
  'landmark-one-main',         // <main id="main-content"> — asserted directly below
  'page-has-heading-one'       // <h1 id="hero-title"> — asserted directly below
].sort();

const RULES = { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } };

async function audit(hash) {
  const ctx = await bootPage(hash);
  try {
    assert.deepEqual(ctx.errors, [], 'no uncaught errors: ' + ctx.errors.join(' | '));
    ctx.window.eval(AXE_SOURCE);
    const res = await ctx.window.axe.run(ctx.document, RULES);
    // axe's result lives in the jsdom realm — copy it into plain Node data so
    // strict assertions compare values instead of prototypes.
    const shape = list => [...list].map(v => ({
      id: v.id, impact: v.impact, help: v.help,
      nodes: [...v.nodes].slice(0, 4).map(n => (n.html || '').slice(0, 140))
    }));
    return { violations: shape(res.violations), incomplete: shape(res.incomplete), passes: res.passes.length };
  } finally { ctx.close(); }
}

function report(res) {
  return res.violations.map(v =>
    `[${v.impact}] ${v.id}: ${v.help}\n` + v.nodes.map(n => '    ' + n).join('\n')
  ).join('\n');
}

test('the landing page passes the WCAG 2.1 AA axe audit', { skip: SKIP, timeout: 60000 }, async () => {
  const res = await audit('');
  assert.deepEqual(res.violations, [], report(res));
  assert.ok(res.passes >= 40, 'axe actually ran: ' + res.passes + ' passing rules');
  assert.deepEqual(res.incomplete.map(v => v.id).sort(), KNOWN_INCOMPLETE,
    'unresolved rules changed — review them and update KNOWN_INCOMPLETE');
});

test('the Arabic RTL layout and a planned itinerary stay accessible', { skip: SKIP, timeout: 60000 }, async () => {
  const res = await audit('#al-urubah~airport-t1-2~ar~fewest-transfers');
  assert.deepEqual(res.violations, [], report(res));
});

test('the document has the landmarks axe could not verify in jsdom', { skip, timeout: 30000 }, async () => {
  const ctx = await bootPage('');
  try {
    const { $, $$, document } = ctx;
    assert.equal($$('main').length, 1, 'exactly one <main>');
    assert.equal($('main').id, 'main-content', 'the skip link targets it');
    assert.equal($$('h1').length, 1, 'exactly one <h1>');
    assert.equal($('h1').id, 'hero-title');
    assert.equal($$('.skip-link').length, 1, 'a skip link exists');
    assert.ok($('html').getAttribute('lang') && $('html').getAttribute('dir'), 'lang + dir are set');
    assert.ok(document.querySelector('[aria-live]'), 'live regions for status updates');
  } finally { ctx.close(); }
});

test('the axe source is the published package, not a stub', { skip: SKIP }, () => {
  assert.ok(AXE_SOURCE.length > 100000, 'axe-core bundle loaded (' + AXE_SOURCE.length + ' bytes)');
  assert.ok(fs.existsSync(require.resolve('axe-core/package.json')));
  assert.ok(ROOT);
});

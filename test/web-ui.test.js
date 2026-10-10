'use strict';
/* Structural checks for the public-facing landing page and its progressive web app shell. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const html = () => read('web/index.html');
const app = () => read('web/app.js');

test('landing page includes the hero, live planner, network story and open-data pathways', () => {
  const page = html();
  for (const marker of [
    'id="hero-title"', 'class="hero-visual"', 'hero-metrics"',
    'id="network-workspace"', 'id="journey-planner"', 'id="project-story"', 'id="hero-trip-builder"',
    'id="status-chip"', 'id="from"', 'id="to"', 'id="btn-plan"', 'id="btn-swap"', 'id="map"', 'id="diagram"',
    'id="tab-guide"', 'id="tab-lines"', 'id="tab-info"', 'id="tab-export"'
  ]) assert.ok(page.includes(marker), `missing landing/app element ${marker}`);
  assert.match(page, /six Riyadh Metro lines|خطوط مترو الرياض الستة/);
  assert.match(page, /schema\.org/);
});

test('the hero planner uses the real journey fields and preserves one source of trip state', () => {
  const page = html();
  const hero = page.indexOf('id="hero-trip-builder"');
  const workspace = page.indexOf('id="network-workspace"');
  assert.ok(hero >= 0 && hero < workspace, 'the working planner is part of the hero, before the network workspace');
  for (const id of ['from', 'to', 'btn-plan', 'btn-swap', 'btn-locate', 'depart', 'result']) {
    assert.equal((page.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, `${id} has a single instance`);
  }
  assert.ok(page.includes('id="planner-empty"'), 'the map workspace has a designed empty/result state');
});

test('landing page translation keys exist in the app dictionary and are applied to accessible labels', () => {
  const page = html();
  const js = app();
  const keys = [...page.matchAll(/data-i18n(?:-[a-z-]+)?="([^"]+)"/g)].map(match => match[1]);
  const missing = [...new Set(keys)].filter(key => !js.includes("'" + key + "':"));
  assert.deepEqual(missing, [], `missing i18n keys: ${missing.join(', ')}`);
  assert.ok(js.includes("$$('[data-i18n-aria-label]')"), 'accessible labels follow the selected interface language');
});

test('journey and view tabs expose selected state and keyboard navigation', () => {
  const page = html();
  const js = app();
  assert.match(page, /role="tablist"/);
  assert.match(page, /role="tabpanel"/);
  assert.ok(js.includes("b.setAttribute('aria-selected', selected ? 'true' : 'false')"));
  assert.ok(js.includes("e.key === 'ArrowRight'"));
  assert.ok(js.includes("e.key === 'Home'"));
});

test('first-ride guidance is available on demand and does not interrupt the initial visit', () => {
  const page = html();
  const js = app();
  assert.ok(page.includes('id="hero-first-ride"'), 'contextual guide entry point');
  assert.ok(js.includes("$('#hero-first-ride').addEventListener('click', showFirstVisit)"));
  assert.ok(js.includes('Keep first-ride guidance available on demand'));
  assert.ok(!/\n\s*showFirstVisit\(\);/.test(js), 'no automatic blocking dialog on page load');
  assert.ok(page.includes('aria-modal="true"'));
});

test('PWA cache version is refreshed and includes the live trip module', () => {
  const worker = read('web/sw.js');
  assert.match(worker, /var VERSION = 'rm-v4'/);
  assert.ok(worker.includes("'./lib/live.js'"));
});

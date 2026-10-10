'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { network, loadData } = require('./helpers');
const schematic = require('../src/schematic');
const router = require('../src/router');

const model = () => schematic.build(network(), loadData().schematic);

test('schematic layout places every station exactly once and reports no errors', () => {
  const m = model();
  assert.deepEqual(m.errors, []);
  const ids = Object.keys(network().stations);
  assert.equal(Object.keys(m.stations).length, ids.length);
  ids.forEach(id => assert.ok(m.stations[id], `station ${id} missing from the diagram`));
  // no two stations share the same grid position
  const seen = new Map();
  ids.forEach(id => {
    const key = m.stations[id].x.toFixed(1) + ',' + m.stations[id].y.toFixed(1);
    assert.ok(!seen.has(key), `${id} overlaps ${seen.get(key)} at ${key}`);
    seen.set(key, id);
  });
});

test('every line edge is octilinear (horizontal, vertical or 45°), possibly with one bend', () => {
  const m = model();
  const okDir = (dx, dy) => {
    const ax = Math.abs(dx), ay = Math.abs(dy);
    return ax < 0.5 || ay < 0.5 || Math.abs(ax - ay) < 0.5;
  };
  m.lineOrder.forEach(lid => {
    m.lines[lid].edges.forEach(e => {
      const pts = e.points;
      assert.ok(pts.length >= 2 && pts.length <= 4, `edge ${e.from}→${e.to} has ${pts.length} points`);
      for (let i = 1; i < pts.length; i++) {
        assert.ok(okDir(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]), `line ${lid} ${e.from}→${e.to} segment ${i} is not octilinear`);
      }
    });
  });
});

test('SVG output is well-formed, bilingual and interactive', () => {
  const m = model();
  const ar = schematic.svg(m, { lang: 'ar', interactive: true, id: 'sch-svg' });
  const en = schematic.svg(m, { lang: 'en' });
  assert.ok(ar.startsWith('<svg'), 'starts with <svg');
  assert.ok(ar.trim().endsWith('</svg>'));
  assert.ok(ar.includes('المركز المالي') && en.includes('KAFD'));
  assert.ok(ar.includes('data-st="kafd"'));
  assert.ok((ar.match(/class="hit"/g) || []).length === Object.keys(m.stations).length, 'one hit target per station');
  assert.ok(!en.includes('class="hit"'), 'non-interactive render has no hit targets');
  // balanced tags (very small check)
  const opens = (ar.match(/<text\b/g) || []).length, closes = (ar.match(/<\/text>/g) || []).length;
  assert.equal(opens, closes);
  assert.ok(!/direction="rtl"/.test(ar), 'Arabic labels rely on bidi, not on direction=rtl (renderers disagree about anchors)');
});

test('route overlay covers every segment of an itinerary and marks A/B/transfers', () => {
  const m = model();
  const it = router.planRoute(network(), 'jeddah-road', 'airport-t1-2');
  const svg = schematic.routeOverlay(m, it, 'en');
  const segs = it.legs.reduce((a, l) => a + l.stations.length - 1, 0);
  assert.equal((svg.match(/class="line halo"/g) || []).length, segs);
  assert.equal((svg.match(/⇄/g) || []).length, it.transferCount);
  assert.ok(svg.includes('>A</text>') && svg.includes('>B</text>'));
});

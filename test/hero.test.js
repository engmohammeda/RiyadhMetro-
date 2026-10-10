'use strict';
/* ═══════════════════════════════════════════════════════════════════════════
   Unit tests for the hero network (web/hero.js).

   The hero is generated from data/schematic.json through the same schematic
   engine as the printable diagram, so these tests assert the generated markup
   directly — no DOM, no browser. Rendering behaviour is covered end to end in
   test/dom.test.js.
   ═══════════════════════════════════════════════════════════════════════════ */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

const RMNetwork = require('../src/network');
const RMSchematic = require('../src/schematic');
const RMHero = require('../web/hero.js');

const DATA = {
  stations: read('stations.json'), lines: read('lines.json'), shapes: read('shapes.json'),
  config: read('config.json'), places: read('places.json'), schematic: read('schematic.json')
};
const NET = RMNetwork.buildNetwork(DATA);
const MODEL = RMSchematic.build(NET, DATA.schematic);

test('the generated hero covers the whole network', () => {
  const svg = RMHero.build(MODEL, { lang: 'ar' });
  assert.match(svg, /^<svg id="hero-svg"/, 'root element with the expected id');
  assert.equal((svg.match(/class="hn-line"/g) || []).length, 6, 'one group per line');
  assert.equal((svg.match(/class="hn-st[ "]/g) || []).length, Object.keys(NET.stations).length, 'every station drawn');
  assert.equal((svg.match(/class="hn-train"/g) || []).length, 6, 'one animated train per line');
  assert.equal((svg.match(/class="hn-centre"/g) || []).length, 6, 'one motion path per line');
  assert.equal((svg.match(/class="hn-hit"/g) || []).length, Object.keys(NET.stations).length, 'every station tappable');
  assert.ok(svg.includes('<g class="hn-route" id="hn-route">'), 'overlay target for a planned trip');
  assert.match(svg, /preserveAspectRatio="xMidYMid slice"/, 'covers its container on any screen');
});

test('interchanges are visually distinct and labelled', () => {
  const svg = RMHero.build(MODEL, { lang: 'ar' });
  const interchanges = Object.values(NET.stations).filter(s => s.interchange);
  assert.equal(interchanges.length, 10, 'the network has ten interchanges');
  assert.equal((svg.match(/class="hn-ring"/g) || []).length, interchanges.length, 'each one gets a ring');
  const names = (svg.match(/class="hn-name(?: x)?"/g) || []).length;
  const termini = new Set();
  NET.lineOrder.forEach(lid => { termini.add(NET.lines[lid].termini.first); termini.add(NET.lines[lid].termini.last); });
  const expected = new Set([...interchanges.map(s => s.id), ...termini]).size;
  assert.equal(names, expected, 'only interchanges and termini carry names at hero scale');
  interchanges.forEach(s => assert.ok(svg.includes(`data-st="${s.id}"`), `${s.id} is addressable`));
});

test('station hit areas expose their name for assistive tech', () => {
  const svg = RMHero.build(MODEL, { lang: 'ar' });
  assert.ok(svg.includes('<title>المركز المالي</title>') || svg.includes('<title>'), 'hit areas carry a title');
  const titles = (svg.match(/<title>[^<]*<\/title>/g) || []).length;
  assert.equal(titles, Object.keys(NET.stations).length, 'one title per station');
});

test('a line can be rendered without interactivity or trains', () => {
  const lite = RMHero.build(MODEL, { lang: 'en', interactive: false, trains: false, labels: false, districts: false });
  assert.ok(!lite.includes('class="hn-hit"'), 'no hit areas');
  assert.ok(!lite.includes('class="hn-train"'), 'no trains');
  assert.ok(!lite.includes('class="hn-name'), 'no labels');
  assert.ok(!lite.includes('class="hn-districts"'), 'no district names');
  assert.equal((lite.match(/class="hn-line"/g) || []).length, 6, 'the network itself is always drawn');
});

test('build() is deterministic — the same data yields the same markup', () => {
  const a = RMHero.build(MODEL, { lang: 'ar' });
  const b = RMHero.build(MODEL, { lang: 'ar' });
  assert.equal(a, b);
});

test('the hero ships no external references (offline-first)', () => {
  const svg = RMHero.build(MODEL, { lang: 'ar' });
  const withoutNs = svg.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, '');
  assert.ok(!/https?:\/\//.test(withoutNs), 'no remote URLs in the generated SVG');
  assert.ok(!/(xlink:href|href)="(?!#)/.test(svg), 'no external asset references');
  assert.ok(!/<image/.test(svg), 'no raster images');
});

test('centrePath produces one continuous path per line for the trains', () => {
  NET.lineOrder.forEach(lid => {
    const d = RMHero.centrePath(MODEL.lines[lid]);
    assert.match(d, /^M-?[\d.]+ -?[\d.]+ L/, `${lid}: starts with a moveto and has segments`);
    const stations = NET.lines[lid].stations.length;
    assert.ok(d.split(' L').length >= stations, `${lid}: at least one point per station`);
  });
});

test('lineStats reports the real facts used by the line rail and the showcase', () => {
  const stats = RMHero.lineStats(MODEL, NET);
  assert.equal(stats.length, 6);
  const blue = stats.find(s => s.id === '1');
  assert.equal(blue.number, 1);
  assert.equal(blue.color, '#00ADE5');
  assert.equal(blue.stations, NET.lines['1'].stations.length);
  assert.equal(blue.km, NET.lines['1'].officialLengthKm);
  assert.equal(blue.from.en, NET.stations[NET.lines['1'].termini.first].name.en);
  assert.equal(blue.to.en, NET.stations[NET.lines['1'].termini.last].name.en);
  assert.ok(blue.interchanges >= 1, 'interchange count derived from the network');
  const totalKm = Math.round(stats.reduce((sum, s) => sum + s.km, 0) * 10) / 10;
  assert.equal(totalKm, 176.4, 'the published network length');
});

test('the itinerary overlay reuses the shared schematic engine', () => {
  const RMRouter = require('../src/router');
  const it = RMRouter.planAlternatives(NET, 'airport-t1-2', 'al-batha')[0];
  const overlay = RMHero.routeOverlay(MODEL, it, 'ar');
  assert.ok(overlay.includes('class="line halo"'), 'halo keeps the route readable over the network');
  assert.match(overlay, />A</); assert.match(overlay, />B</, 'origin and destination marked');
  assert.equal(RMHero.routeOverlay(MODEL, null, 'ar'), '', 'no itinerary → no overlay');
});

test('mount() is only reachable in a browser and never in the SVG string', () => {
  assert.equal(typeof RMHero.mount, 'function');
  const svg = RMHero.build(MODEL, { lang: 'ar' });
  assert.ok(!/is-focused|has-route/.test(svg), 'state classes are applied at runtime, not baked in');
});

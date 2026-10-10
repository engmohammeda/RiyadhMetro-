'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadData, network } = require('./helpers');
const { validateNetwork } = require('../src/node/validate');
const geo = require('../src/geo');

test('dataset passes integrity validation', () => {
  const report = validateNetwork(network(), loadData());
  assert.deepEqual(report.errors, []);
  assert.equal(report.ok, true);
});

test('network has the expected size: 6 lines, 83 stations, 94 line-stops, 10 interchanges', () => {
  const n = network();
  assert.equal(n.lineOrder.length, 6);
  assert.equal(Object.keys(n.stations).length, 83);
  assert.equal(n.lineOrder.reduce((a, l) => a + n.lines[l].stations.length, 0), 94);
  const inter = Object.values(n.stations).filter(s => s.interchange).map(s => s.id).sort();
  assert.deepEqual(inter, ['al-hamra', 'an-naseem', 'ar-rabi', 'kafd', 'ministry-of-education', 'national-museum', 'qasr-al-hokm', 'sabic', 'stc', 'uthman-bin-affan-road']);
  assert.deepEqual(n.stations.kafd.lines, ['1', '4', '6']);
});

test('station counts per line match the operator network', () => {
  const n = network();
  const counts = {};
  n.lineOrder.forEach(l => { counts[l] = n.lines[l].stations.length; });
  assert.deepEqual(counts, { 1: 25, 2: 15, 3: 22, 4: 9, 5: 12, 6: 11 });
});

test('line termini are the official ones', () => {
  const n = network();
  assert.deepEqual(n.lines['1'].termini, { first: 'sab-bank', last: 'ad-dar-al-baida' });
  assert.deepEqual(n.lines['2'].termini, { first: 'king-saud-university', last: 'king-fahad-sport-city' });
  assert.deepEqual(n.lines['3'].termini, { first: 'jeddah-road', last: 'khashm-al-an' });
  assert.deepEqual(n.lines['4'].termini, { first: 'kafd', last: 'airport-t1-2' });
  assert.deepEqual(n.lines['5'].termini, { first: 'ministry-of-education', last: 'national-museum' });
  assert.deepEqual(n.lines['6'].termini, { first: 'kafd', last: 'an-naseem' });
});

test('yellow and purple lines share the KAFD → SABIC trunk', () => {
  const n = network();
  assert.deepEqual(n.lines['4'].stations.slice(0, 4), n.lines['6'].stations.slice(0, 4));
  const shared = n.transfers.find(t => t.station === 'ar-rabi' && t.from === '4' && t.to === '6');
  assert.equal(shared.minutes, 2, 'cross-platform transfer penalty applies on the shared trunk');
  const kafd = n.transfers.find(t => t.station === 'kafd' && t.from === '1' && t.to === '4');
  assert.equal(kafd.minutes, 7);
});

test('alignments are oriented first → last station and stations snap closely', () => {
  const n = network();
  n.lineOrder.forEach(lid => {
    const line = n.lines[lid];
    const first = n.stations[line.termini.first], last = n.stations[line.termini.last];
    assert.ok(geo.haversine([first.lat, first.lng], line.shape[0]) < 400, `line ${lid} shape should start near ${first.id}`);
    assert.ok(geo.haversine([last.lat, last.lng], line.shape[line.shape.length - 1]) < 400, `line ${lid} shape should end near ${last.id}`);
    line.snapOffsets.forEach((off, i) => assert.ok(off < 300, `line ${lid} station ${line.stations[i]} is ${off} m from the track`));
    // segments chain without gaps
    for (let i = 1; i < line.segments.length; i++) {
      const prevEnd = line.segments[i - 1].geometry.slice(-1)[0];
      const start = line.segments[i].geometry[0];
      assert.ok(geo.haversine(prevEnd, start) < 1, `line ${lid} segment ${i} does not start where ${i - 1} ends`);
    }
    const segSum = line.segments.reduce((a, s) => a + s.distanceM, 0);
    assert.ok(Math.abs(segSum - line.lengthM) < line.lengthM * 0.03, `segments should add up to (almost) the line length on line ${lid}`);
  });
});

test('computed line lengths are within 10% of the official figures (total ≈ 176 km)', () => {
  const n = network();
  let official = 0;
  n.lineOrder.forEach(lid => {
    const line = n.lines[lid];
    const ratio = line.lengthM / 1000 / line.officialLengthKm;
    assert.ok(ratio > 0.9 && ratio < 1.1, `line ${lid}: ${line.lengthM} m vs official ${line.officialLengthKm} km`);
    official += line.officialLengthKm;
  });
  assert.ok(Math.abs(official - 176.4) < 0.1);
});

test('every station has bilingual names and lies inside Riyadh', () => {
  Object.values(network().stations).forEach(s => {
    assert.ok(s.name.ar && s.name.en, s.id);
    assert.ok(/[\u0600-\u06FF]/.test(s.name.ar) || s.name.ar === 'stc', `Arabic name expected for ${s.id}`);
    assert.ok(s.lat > 24.4 && s.lat < 25.1 && s.lng > 46.4 && s.lng < 47.0, s.id);
  });
});

test('search works in Arabic, English and by id, ignoring diacritics/hamza variants', () => {
  const net = require('../src/network');
  const n = network();
  assert.equal(net.searchStations(n, 'KAFD', 1)[0].id, 'kafd');
  assert.equal(net.searchStations(n, 'المركز المالي', 1)[0].id, 'kafd');
  assert.equal(net.searchStations(n, 'national mus', 1)[0].id, 'national-museum');
  assert.equal(net.searchStations(n, 'اشبيلية', 1)[0].id, 'ishbiliyah'); // written with alef instead of alef-hamza
  assert.equal(net.searchStations(n, 'qasr-al-hokm', 1)[0].id, 'qasr-al-hokm');
  assert.ok(net.searchStations(n, 'مطار', 5).length >= 3);
  assert.deepEqual(net.searchStations(n, '', 5), []);
});

test('nearest stations are ordered by distance', () => {
  const net = require('../src/network');
  const res = net.nearestStations(network(), 24.7114, 46.6745, 3); // Kingdom Centre
  assert.equal(res[0].station.id, 'al-urubah');
  assert.ok(res[0].distanceM < res[1].distanceM && res[1].distanceM <= res[2].distanceM);
});

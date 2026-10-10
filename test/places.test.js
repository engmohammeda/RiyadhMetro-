'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { network, loadData } = require('./helpers');
const net = require('../src/network');

test('places are attached with nearest stations and walking times', () => {
  const N = network();
  assert.ok(N.placeOrder.length >= 40);
  N.placeOrder.forEach(id => {
    const p = N.places[id];
    assert.ok(p.nearest.length >= 1 && p.nearest.length <= 3);
    assert.ok(N.stations[p.station], `${id}: nearest station exists`);
    assert.equal(p.station, p.nearest[0].station);
    assert.ok(p.nearest[0].walkMinutes >= 1);
    for (let i = 1; i < p.nearest.length; i++) assert.ok(p.nearest[i].distanceM >= p.nearest[0].distanceM || p.nearest[0].station === loadData().places.places.find(x => x.id === id).station);
  });
});

test('well-known places resolve to the expected station', () => {
  const N = network();
  assert.equal(N.places['kingdom-centre'].station, 'al-urubah');
  assert.equal(N.places['centria-mall'].station, 'bank-albilad');
  assert.equal(N.places['kkia-airport'].station, 'airport-t1-2');
  assert.equal(N.places['masmak-fortress'].station, 'qasr-al-hokm');
  assert.ok(N.places['kingdom-centre'].nearest[0].distanceM < 500);
});

test('search understands aliases / old names and places', () => {
  const N = network();
  const ids = q => net.searchAll(N, q, 5).map(r => r.kind[0] + ':' + r.id);
  assert.equal(ids('olaya')[0], 's:stc', 'Olaya → stc');
  assert.equal(ids('العليا')[0], 's:stc');
  assert.equal(ids('batha')[0], 's:al-batha');
  assert.equal(ids('kingdom')[0], 'p:kingdom-centre');
  assert.ok(ids('المصمك').slice(0, 2).includes('p:masmak-fortress'), 'Masmak place in the top two (station alias also matches)');
  assert.equal(ids('salahaddin')[0], 's:king-salman-park');
  assert.equal(ids('kkia')[0].slice(0, 2), 's:');
  assert.ok(ids('مول').every(x => x.startsWith('p:')));
  assert.equal(net.searchStations(N, 'faisaliah')[0].id, 'king-fahad-library');
  assert.deepEqual(net.searchAll(N, '   '), []);
});

test('place ids and categories are valid', () => {
  const raw = loadData().places;
  const seen = new Set();
  raw.places.forEach(p => {
    assert.ok(!seen.has(p.id), 'duplicate ' + p.id); seen.add(p.id);
    assert.match(p.id, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.ok(raw.categories[p.category], p.id + ' category');
    assert.ok(p.lat > 24.4 && p.lat < 25.1 && p.lng > 46.4 && p.lng < 47.0, p.id + ' inside Riyadh');
  });
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { network } = require('./helpers');
const router = require('../src/router');

test('direct journey on one line (KAFD → Airport T1-2, Yellow Line)', () => {
  const it = router.planRoute(network(), 'kafd', 'airport-t1-2');
  assert.equal(it.legs.length, 1);
  assert.equal(it.legs[0].line, '4');
  assert.equal(it.legs[0].direction, 'airport-t1-2');
  assert.equal(it.stops, 8);
  assert.equal(it.transferCount, 0);
  assert.ok(it.totalMinutes >= 25 && it.totalMinutes <= 45, `plausible airport time, got ${it.totalMinutes}`);
  assert.ok(Math.abs(it.totalDistanceM - 29050) < 600);
});

test('reverse direction reports the opposite terminus', () => {
  const it = router.planRoute(network(), 'airport-t1-2', 'kafd');
  assert.equal(it.legs[0].direction, 'kafd');
  assert.equal(it.legs[0].forward, false);
});

test('one transfer: SAB Bank → King Fahad Sport City changes Blue → Red at stc', () => {
  const it = router.planRoute(network(), 'sab-bank', 'king-fahad-sport-city');
  assert.equal(it.transferCount, 1);
  assert.deepEqual(it.legs.map(l => l.line), ['1', '2']);
  assert.equal(it.transfers[0].station, 'stc');
});

test('two transfers: Jeddah Road → Airport (Orange → Blue → Yellow)', () => {
  const it = router.planRoute(network(), 'jeddah-road', 'airport-t1-2');
  assert.deepEqual(it.legs.map(l => l.line), ['3', '1', '4']);
  assert.deepEqual(it.transfers.map(t => t.station), ['qasr-al-hokm', 'kafd']);
  assert.equal(it.stops, 32);
});

test('green line connects National Museum and Ministry of Education without transfer', () => {
  const it = router.planRoute(network(), 'national-museum', 'ministry-of-education');
  assert.equal(it.transferCount, 0);
  assert.equal(it.legs[0].line, '5');
  assert.equal(it.stops, 11);
});

test('fewest-transfers mode never uses more transfers than fastest mode', () => {
  const n = network();
  const ids = Object.keys(n.stations);
  for (let i = 0; i < ids.length; i += 7) {
    for (let j = 3; j < ids.length; j += 11) {
      if (ids[i] === ids[j]) continue;
      const fast = router.planRoute(n, ids[i], ids[j], { mode: 'fastest' });
      const few = router.planRoute(n, ids[i], ids[j], { mode: 'fewest-transfers' });
      assert.ok(few.transferCount <= fast.transferCount, `${ids[i]} → ${ids[j]}`);
      assert.ok(fast.totalSeconds <= few.totalSeconds + 1, `${ids[i]} → ${ids[j]} fastest should not be slower`);
    }
  }
});

test('journeys are symmetric and every pair of stations is reachable', () => {
  const n = network();
  const ids = Object.keys(n.stations);
  let pairs = 0;
  for (const a of ids) {
    for (const b of ids) {
      if (a >= b) continue;
      const ab = router.planRoute(n, a, b), ba = router.planRoute(n, b, a);
      assert.ok(ab && ba, `${a} ↔ ${b} must be routable`);
      assert.equal(ab.totalSeconds, ba.totalSeconds, `${a} ↔ ${b} should take the same time both ways`);
      assert.equal(ab.stops, ba.stops);
      assert.ok(ab.transferCount <= 3, `${a} → ${b} needs ${ab.transferCount} transfers`);
      pairs++;
    }
  }
  assert.equal(pairs, 83 * 82 / 2);
});

test('legs carry continuous geometry that starts/ends at the leg stations', () => {
  const geo = require('../src/geo');
  const n = network();
  const it = router.planRoute(n, 'al-malaz', 'kacst');
  it.legs.forEach(leg => {
    const f = n.stations[leg.from], t = n.stations[leg.to];
    assert.ok(geo.haversine([f.lat, f.lng], leg.geometry[0]) < 300);
    assert.ok(geo.haversine([t.lat, t.lng], leg.geometry[leg.geometry.length - 1]) < 300);
    for (let i = 1; i < leg.geometry.length; i++) assert.ok(geo.haversine(leg.geometry[i - 1], leg.geometry[i]) < 4500, 'no jumps in geometry');
  });
});

test('same origin and destination yields an empty itinerary', () => {
  const it = router.planRoute(network(), 'kafd', 'kafd');
  assert.equal(it.legs.length, 0);
  assert.equal(it.totalMinutes, 0);
  assert.deepEqual(router.describeItinerary(network(), it, 'ar'), ['نقطة البداية والنهاية هي نفس المحطة.']);
});

test('unknown stations throw a helpful error', () => {
  assert.throws(() => router.planRoute(network(), 'nowhere', 'kafd'), /Unknown origin/);
  assert.throws(() => router.planRoute(network(), 'kafd', 'nowhere'), /Unknown destination/);
});

test('instructions are produced in Arabic and English with correct plurals', () => {
  const n = network();
  const it = router.planRoute(n, 'sab-bank', 'king-fahad-sport-city');
  const ar = router.describeItinerary(n, it, 'ar');
  const en = router.describeItinerary(n, it, 'en');
  assert.match(ar[0], /تبديل واحد/);
  assert.match(ar.join('\n'), /اركب المسار الأزرق باتجاه «الدار البيضاء» — 6 محطات/);
  assert.match(en.join('\n'), /Board the Blue Line towards Ad Dar Al Baida — 6 stops/);
  assert.match(en.join('\n'), /Change at stc to the Red Line/);
  assert.equal(router.arCount(1, router.AR_FORMS.stations), 'محطة واحدة');
  assert.equal(router.arCount(2, router.AR_FORMS.stations), 'محطتان');
  assert.equal(router.arCount(5, router.AR_FORMS.stations), '5 محطات');
  assert.equal(router.arCount(13, router.AR_FORMS.stations), '13 محطة');
});

test('planAlternatives returns distinct options only', () => {
  const n = network();
  const alts = router.planAlternatives(n, 'kafd', 'airport-t1-2');
  assert.equal(alts.length, 1); // only one sensible route
  alts.forEach(a => assert.equal(a.from, 'kafd'));
});

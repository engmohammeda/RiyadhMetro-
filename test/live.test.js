'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { network } = require('./helpers');
const router = require('../src/router');
const live = require('../src/live');

const net = network();
const at = id => ({ lat: net.stations[id].lat, lng: net.stations[id].lng });

// Direct Yellow-line journey: KAFD → Airport Terminals 1-2
const direct = () => router.planRoute(net, 'kafd', 'airport-t1-2');
// One transfer: SAB Bank → King Fahad Sport City (Blue → Red at stc)
const withTransfer = () => router.planRoute(net, 'sab-bank', 'king-fahad-sport-city');

test('statusAt: standing at the destination counts as arrived', () => {
  const it = direct();
  const dest = at(it.to);
  const st = live.statusAt(net, it, dest.lat, dest.lng);
  assert.equal(st.arrived, true);
  assert.equal(st.prepareAlight, false);
  assert.equal(st.destination, 'airport-t1-2');
  assert.equal(st.remainingStops, 0);
});

test('statusAt: ~300 m from the destination → prepare to alight, not arrived', () => {
  const it = direct();
  const dest = at(it.to);
  const st = live.statusAt(net, it, dest.lat + 0.0027, dest.lng); // ≈ 300 m north
  assert.equal(st.arrived, false);
  assert.equal(st.prepareAlight, true);
  assert.ok(st.distanceToEndM > 150 && st.distanceToEndM < 500, `distance ${st.distanceToEndM}`);
});

test('statusAt: far away → no alerts, full remaining stops', () => {
  const it = direct();
  const st = live.statusAt(net, it, at('kafd').lat, at('kafd').lng);
  assert.equal(st.arrived, false);
  assert.equal(st.prepareAlight, false);
  assert.equal(st.nearestStation, 'kafd');
  assert.equal(st.remainingStops, it.stations.length - 1);
  assert.equal(st.nextTransfer, null);
});

test('statusAt: approaching a transfer station triggers the transfer alert', () => {
  const it = withTransfer();
  assert.equal(it.transfers[0].station, 'stc');
  const stc = at('stc');
  const st = live.statusAt(net, it, stc.lat - 0.002, stc.lng); // ≈ 220 m before stc
  assert.ok(st.nextTransfer, 'a transfer ahead is reported');
  assert.equal(st.nextTransfer.station, 'stc');
  assert.equal(st.prepareTransfer, true);
  assert.equal(st.arrived, false);
});

test('statusAt: at the transfer station the alert stays until the user moves past it', () => {
  const it = withTransfer();
  const stc = at('stc');
  const st = live.statusAt(net, it, stc.lat, stc.lng);
  assert.equal(st.nearestStation, 'stc');
  assert.ok(st.nextTransfer, 'the transfer is still actionable while at the station');
  assert.equal(st.prepareTransfer, true);
});

test('statusAt: after passing the transfer (on the next line) no transfer is ahead', () => {
  const it = withTransfer();
  const beyond = at('al-wurud'); // first station after stc on the Red line
  const st = live.statusAt(net, it, beyond.lat, beyond.lng);
  assert.equal(st.nearestStation, 'al-wurud');
  assert.equal(st.nextTransfer, null);
  assert.equal(st.prepareTransfer, false);
});

test('statusAt: thresholds are configurable (used for testing and tuning)', () => {
  const it = direct();
  const dest = at(it.to);
  const far = live.statusAt(net, it, dest.lat + 0.009, dest.lng, { prepareAlightM: 1200 });
  assert.equal(far.prepareAlight, true, 'wide prepare window fires early');
  const near = live.statusAt(net, it, dest.lat + 0.001, dest.lng, { arriveM: 400 });
  assert.equal(near.arrived, true, 'wide arrival radius counts as arrived');
});

test('statusAt: empty itinerary returns null', () => {
  const it = router.planRoute(net, 'kafd', 'kafd');
  assert.equal(live.statusAt(net, it, 24.7, 46.7), null);
});

test('walkMinutes: short walks round up to at least one minute', () => {
  assert.equal(live.walkMinutes(50), 1);
  assert.equal(live.walkMinutes(450), 6);
  assert.equal(live.walkMinutes(900), 12);
});

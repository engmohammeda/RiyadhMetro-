'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { transit, busSources, network, read } = require('./helpers');
const transitLib = require('../src/transit');
const { validateTransit, RIYADH_BBOX } = require('../src/node/validate-transit');
const exportsLib = require('../src/node/transit-exports');
const { readZip } = require('../src/node/binary');
const geo = require('../src/geo');

const M = transit();

test('transit dataset passes integrity validation', () => {
  const report = validateTransit(M, busSources());
  assert.deepEqual(report.errors, []);
  assert.equal(report.ok, true);
});

test('the multimodal network has the expected size', () => {
  assert.equal(M.stats.routes, 88);
  assert.equal(M.stats.stops, 3010);
  assert.equal(M.stats.stations, 83);
  assert.equal(M.stats.districts, 133);
  assert.equal(M.stats.brtStops, 106);
  assert.equal(M.stats.operatingStops + 849, 3010);
  assert.equal(M.stats.parkAndRide, 17);
});

test('every bus stop has coordinates inside Riyadh and a district', () => {
  const bad = [];
  M.stopOrder.forEach(id => {
    const s = M.stops[id];
    if (s.lat < RIYADH_BBOX[0][0] || s.lat > RIYADH_BBOX[1][0] || s.lng < RIYADH_BBOX[0][1] || s.lng > RIYADH_BBOX[1][1]) bad.push(id);
    assert.ok(s.district, 'stop ' + id + ' has no district');
    assert.ok(M.districts[s.district], 'stop ' + id + ' references a missing district');
    assert.ok(s.name.ar && s.name.en, 'stop ' + id + ' is missing a bilingual name');
  });
  assert.deepEqual(bad, []);
  const approx = M.stopOrder.filter(id => M.stops[id].districtApprox).length;
  assert.ok(approx / M.stopOrder.length < 0.08, 'too many stops fall back to the nearest district centre: ' + approx);
});

test('district statistics add up to the stop register', () => {
  const total = M.districtOrder.reduce((n, id) => n + M.districts[id].stops, 0);
  assert.equal(total, M.stopOrder.length);
  assert.ok(M.districtOrder.filter(id => M.districts[id].stops > 0).length >= 120);
});

test('routes have ordered stop sequences and geometry for every direction', () => {
  M.routeOrder.forEach(id => {
    const r = M.routes[id];
    assert.ok(r.stopCount >= 2, 'route ' + id + ' has too few stops');
    assert.ok(r.directions.length >= 1, 'route ' + id + ' has no direction');
    Object.keys(r.dirs).forEach(dir => {
      const d = r.dirs[dir];
      assert.ok(d.stops.length >= 2, 'route ' + id + ' dir ' + dir + ' has < 2 stops');
      assert.ok(d.segments.length === d.stops.length - 1, 'route ' + id + ' dir ' + dir + ' segment count mismatch');
      d.segments.forEach(seg => {
        assert.ok(M.stops[seg.from] && M.stops[seg.to], 'unknown stop in route ' + id);
        assert.ok(seg.meters >= 0 && seg.seconds >= 0);
        assert.ok(seg.geometry.length >= 2, 'segment without geometry on route ' + id);
      });
      // Ordering invariant: the distance along the alignment can never be shorter than
      // the straight line between two consecutive stops (loops only make it longer).
      // Source gaps (no published stop for several km) are legitimate and not flagged.
      for (let i = 1; i < d.stops.length; i++) {
        const a = M.stops[d.stops[i - 1]], b = M.stops[d.stops[i]];
        const straight = geo.haversine([a.lat, a.lng], [b.lat, b.lng]);
        if (straight > 60) {
          assert.ok(d.segments[i - 1].meters >= straight * 0.8,
            'stop order does not follow the alignment on route ' + id + ' at stop ' + i);
        }
      }
    });
  });
});

test('BRT is the 11/12/13 corridor network and has BRT platforms', () => {
  const brt = M.routeOrder.filter(id => M.routes[id].type === 'brt');
  assert.deepEqual(brt, ['11', '12', '13']);
  brt.forEach(id => assert.ok(M.routes[id].brtStops > 0, 'route ' + id + ' has no BRT platform'));
  assert.equal(M.routeOrder.filter(id => M.routes[id].type === 'main').length, 6);
  assert.equal(M.routeOrder.filter(id => M.routes[id].type === 'community').length, 59);
});

test('search resolves districts, routes, stations and stops', () => {
  const d = transitLib.search(M, 'العليا', 6);
  assert.equal(d[0].kind, 'district');
  assert.equal(d[0].name.en, 'Al Olaya');

  const r = transitLib.search(M, '11', 6);
  assert.equal(r[0].kind, 'route');
  assert.equal(r[0].id, '11');

  const st = transitLib.search(M, 'المركز المالي', 6);
  assert.ok(st.some(x => x.kind === 'station' && x.id === 'kafd'));

  const busStop = M.stops[M.stopOrder[0]];
  const s = transitLib.search(M, busStop.code, 6);
  assert.ok(s.some(x => x.kind === 'stop' && x.id === busStop.id));
});

test('journey KAFD → King Saud University uses the metro with one interchange', () => {
  const it = transitLib.plan(M, { kind: 'station', id: 'kafd' }, { kind: 'station', id: 'king-saud-university' }, { mode: 'fastest' });
  assert.ok(it, 'no itinerary');
  assert.equal(it.transfers, 1);
  assert.deepEqual(it.modes, ['metro']);
  assert.ok(it.totalMinutes >= 15 && it.totalMinutes <= 60, 'unexpected duration ' + it.totalMinutes);
  const lines = it.legs.filter(l => l.type === 'metro').map(l => l.line);
  assert.deepEqual(lines, ['1', '2']);
  it.legs.filter(l => l.type === 'metro').forEach(l => assert.ok(l.geometry.length > 2));
  assert.ok(it.fare > 0);
});

test('a bus-only journey stays on the bus (route 7 corridor)', () => {
  const r = M.routes['7'];
  const from = r.dirs['1'].stops[2], to = r.dirs['1'].stops[8];
  const it = transitLib.plan(M, { kind: 'stop', id: from }, { kind: 'stop', id: to }, { modes: ['bus'] });
  assert.ok(it, 'no bus itinerary');
  assert.deepEqual(it.modes, ['bus']);
  const leg = it.legs.find(l => l.type === 'bus');
  assert.equal(leg.route, '7');
  assert.ok(!it.legs.some(l => l.type === 'metro'));
});

test('door-to-door planning walks from a place to the nearest stop or station', () => {
  const it = transitLib.plan(M, { kind: 'place', id: 'kkia-airport' }, { kind: 'station', id: 'kafd' }, { mode: 'fastest' });
  assert.ok(it, 'no itinerary');
  assert.equal(it.legs[0].type, 'walk');
  assert.ok(it.legs[0].meters < 900);
  assert.ok(it.legs.some(l => l.type === 'metro' && l.line === '4'));
  assert.ok(it.totalMinutes > 20 && it.totalMinutes < 90);
});

test('walking-only journeys are supported', () => {
  const a = M.stops[M.stopOrder.find(id => M.stops[id].district === 'al-olaya' && M.stops[id].routes.length)];
  const near = transitLib.nearby(M, a.lat, a.lng, 3, 400).find(x => x.kind === 'stop' && x.id !== a.id);
  assert.ok(near, 'no neighbouring stop found');
  const it = transitLib.plan(M, { kind: 'stop', id: a.id }, { kind: 'stop', id: near.id }, { maxWalkM: 600 });
  assert.ok(it);
  assert.ok(it.legs.every(l => l.type === 'walk'));
});

test('park & ride register is wired to real stations and capacities', () => {
  assert.equal(M.parkAndRide.byStation['sab-bank'].capacity, 592);
  assert.equal(M.parkAndRide.byStation['ar-rabi'].capacity, 567);
  assert.equal(M.parkAndRide.byStation['western-station'].capacity, 600);
  const total = M.parkAndRide.sites.reduce((n, s) => n + (s.capacity || 0), 0);
  assert.equal(total, 6154);
  M.parkAndRide.sites.forEach(s => assert.ok(M.network.stations[s.station]));
});

test('metro ↔ bus interchanges are ranked from real stop proximity', () => {
  const ranking = transitLib.interchangeRanking(M);
  assert.equal(ranking.length, 83);
  assert.ok(ranking[0].routes >= 3, 'top interchange should serve several bus routes');
  const kafd = ranking.find(x => x.station.id === 'kafd');
  assert.ok(kafd.stops >= 1, 'KAFD should have a bus stop within 450 m');
});

test('GTFS export is internally consistent', () => {
  const { zip, counts } = exportsLib.gtfs(M, { version: 'test' });
  const files = readZip(zip);
  const byName = {};
  files.forEach(f => { byName[f.name] = f.data.toString('utf8'); });
  ['agency.txt', 'stops.txt', 'routes.txt', 'trips.txt', 'stop_times.txt', 'shapes.txt', 'frequencies.txt', 'calendar.txt', 'transfers.txt', 'fare_rules.txt', 'feed_info.txt']
    .forEach(name => assert.ok(byName[name], 'missing ' + name));

  const parseCsv = text => {
    const rows = [];
    let row = [], field = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ''; }
      else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (ch !== '\r') field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.some(c => c !== ''));
  };
  const lines = parseCsv;
  const stopIds = new Set(lines(byName['stops.txt']).slice(1).map(r => r[0]));
  const routeIds = new Set(lines(byName['routes.txt']).slice(1).map(r => r[0]));
  const trips = lines(byName['trips.txt']).slice(1);
  const tripIds = new Set(trips.map(r => r[2]));
  const stopTimes = lines(byName['stop_times.txt']).slice(1);
  const shapeIds = new Set(lines(byName['shapes.txt']).slice(1).map(r => r[0]));
  const frequencyTrips = new Set(lines(byName['frequencies.txt']).slice(1).map(r => r[0]));

  assert.equal(stopIds.size, 3010 + 83);
  assert.equal(routeIds.size, 88 + 6);
  trips.forEach(t => {
    assert.ok(routeIds.has(t[0]), 'trip references unknown route ' + t[0]);
    assert.ok(shapeIds.has(t[5]), 'trip references unknown shape ' + t[5]);
  });
  stopTimes.forEach(r => {
    assert.ok(tripIds.has(r[0]), 'stop time references unknown trip');
    assert.ok(stopIds.has(r[3]), 'stop time references unknown stop ' + r[3]);
  });
  assert.equal(counts.routes, 94);
  assert.ok(frequencyTrips.size >= 100);
});

test('GIS exports cover stops, routes, districts and park & ride', () => {
  const stops = exportsLib.busStopsGeoJson(M);
  assert.equal(stops.features.length, 3010);
  assert.ok(stops.features[0].properties.district_ar);
  const routes = exportsLib.busRoutesGeoJson(M);
  assert.equal(routes.features.length, 88);
  const districts = exportsLib.districtsGeoJson(M);
  assert.equal(districts.features.length, 133);
  const pr = exportsLib.parkAndRideGeoJson(M);
  assert.equal(pr.features.length, 17);

  const csv = exportsLib.busStopsCsv(M);
  assert.ok(csv.startsWith('stop_id,code,name_ar,name_en,lat,lng'));
  assert.equal(csv.trim().split('\n').length, 3011);
  const routeCsv = exportsLib.busRoutesCsv(M);
  assert.equal(routeCsv.trim().split('\n').length, 89);
});

test('every metro station keeps its metro data untouched by the transit layer', () => {
  assert.deepEqual(M.network.lines['1'].termini, { first: 'sab-bank', last: 'ad-dar-al-baida' });
  assert.equal(Object.keys(M.network.stations).length, Object.keys(network().stations).length);
  assert.ok(read('config.json').busModel);
});

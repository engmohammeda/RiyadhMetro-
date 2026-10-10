'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { ROOT, network } = require('./helpers');
const kml = require('../src/kml');
const geojson = require('../src/geojson');
const links = require('../src/links');
const router = require('../src/router');
const { stationsCsv, lineStopsCsv, placesCsv, gpx } = require('../src/node/exports');
const { createZip, readZip, circleIcon, crc32 } = require('../src/node/binary');
const { checkXmlBalanced } = require('../src/node/validate');

test('network KML is well-formed and contains every line, station and tour', () => {
  const n = network();
  const xml = kml.networkKml(n, { iconMode: 'hosted', siteUrl: 'https://example.org/', repoUrl: 'https://github.com/x/y' });
  const wf = checkXmlBalanced(xml);
  assert.ok(wf.ok, wf.error);
  assert.match(xml, /<kml xmlns="http:\/\/www.opengis.net\/kml\/2.2"/);
  assert.equal((xml.match(/<Placemark id="pm-line-/g) || []).length, 6);
  assert.equal((xml.match(/<gx:Tour>/g) || []).length, 6);
  // 94 line-stops + 10 interchanges folder
  assert.equal((xml.match(/<Placemark id="st-/g) || []).length, 94 + 10);
  Object.values(n.stations).forEach(s => assert.ok(xml.includes(kml.escapeXml(s.name.ar)), s.id));
  // KML coordinates are lng,lat
  assert.match(xml, /<coordinates>46\.\d+,24\.\d+,0/);
  assert.ok(xml.includes('https://www.google.com/maps/search/?api=1&amp;query='), 'balloons link to Google Maps');
  assert.ok(!xml.includes('undefined'), 'no "undefined" leaked into the KML');
  assert.ok(!xml.includes('NaN'));
});

test('KML colours are aabbggrr', () => {
  assert.equal(kml.kmlColor('#00ADE5'), 'ffe5ad00');
  assert.equal(kml.kmlColor('#F0493A', 0.5), '803a49f0');
});

test('per-line KML and route KML are well-formed', () => {
  const n = network();
  n.lineOrder.forEach(lid => {
    const xml = kml.lineKml(n, lid, { iconMode: 'hosted' });
    const wf = checkXmlBalanced(xml);
    assert.ok(wf.ok, `line ${lid}: ${wf.error}`);
    assert.equal((xml.match(/<Placemark id="st-/g) || []).length, n.lines[lid].stations.length);
  });
  const it = router.planRoute(n, 'jeddah-road', 'airport-t1-2');
  const steps = router.describeItinerary(n, it, 'ar');
  const xml = kml.routeKml(n, it, { steps });
  const wf = checkXmlBalanced(xml);
  assert.ok(wf.ok, wf.error);
  assert.equal((xml.match(/<styleUrl>#route-transfer<\/styleUrl>/g) || []).length, 2);
  assert.ok(xml.includes('#route-start') && xml.includes('#route-end'));
  assert.ok(xml.includes(kml.escapeXml(steps[0])));
});

test('KMZ packaging: doc.kml first, icons embedded and referenced', () => {
  const n = network();
  const doc = kml.networkKml(n, { iconMode: 'embedded', iconBase: 'icons/' });
  const icons = ['line-1.png', 'interchange.png'].map(name => ({ name: 'icons/' + name, data: circleIcon(16, [{ radius: 1, color: '#00ADE5' }]) }));
  const zip = createZip([{ name: 'doc.kml', data: doc }, ...icons]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50, 'local file header signature');
  const entries = readZip(zip);
  assert.equal(entries[0].name, 'doc.kml');
  assert.equal(entries[0].data.toString('utf8'), doc);
  assert.deepEqual(entries.slice(1).map(e => e.name), ['icons/line-1.png', 'icons/interchange.png']);
  assert.ok(doc.includes('<href>icons/line-1.png</href>'));
  assert.ok(doc.includes('<href>icons/interchange.png</href>'));
  // EOCD record
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), 3);
});

test('crc32 and PNG encoder produce valid output', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xCBF43926);
  const png = circleIcon(32, [{ radius: 1, color: '#ff0000' }, { radius: 0.5, color: '#ffffff' }]);
  assert.deepEqual([...png.slice(0, 8)], [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  assert.equal(png.readUInt32BE(16), 32);
  assert.equal(png.readUInt32BE(20), 32);
  assert.equal(png.slice(-8, -4).toString('ascii'), 'IEND');
});

test('GeoJSON exports are valid FeatureCollections with lng/lat order and simplestyle colours', () => {
  const n = network();
  const all = geojson.networkGeoJson(n, 'all');
  assert.equal(all.type, 'FeatureCollection');
  assert.equal(all.features.filter(f => f.geometry.type === 'LineString').length, 6);
  assert.equal(all.features.filter(f => f.geometry.type === 'Point').length, 83);
  all.features.forEach(f => {
    const coords = f.geometry.type === 'Point' ? [f.geometry.coordinates] : f.geometry.coordinates;
    coords.forEach(c => { assert.ok(c[0] > 46 && c[0] < 47 && c[1] > 24 && c[1] < 25.2, 'lng,lat order'); });
    assert.ok(f.properties.name_ar && f.properties.name_en);
  });
  const line = all.features.find(f => f.id === 'line-1');
  assert.equal(line.properties.stroke, '#00ADE5');
  const kafd = all.features.find(f => f.id === 'station-kafd');
  assert.equal(kafd.properties['marker-color'], '#222222');
  assert.equal(geojson.networkGeoJson(n, 'segments').features.length, 88);
  const route = geojson.routeGeoJson(n, router.planRoute(n, 'kafd', 'national-museum'));
  assert.equal(route.features.filter(f => f.properties.kind === 'leg').length, 1);
  assert.equal(route.features.find(f => f.properties.role === 'origin').properties.id, 'kafd');
});

test('CSV exports have one row per station / per line-stop, BOM for Excel', () => {
  const n = network();
  const csv = stationsCsv(n);
  assert.equal(csv.charCodeAt(0), 0xFEFF);
  const rows = csv.trim().split('\r\n'); // trim() also strips the BOM
  assert.equal(rows.length, 84);
  assert.equal(rows[0].split(',')[0], 'id');
  assert.ok(rows[0].includes('latitude') && rows[0].includes('longitude'));
  const stops = lineStopsCsv(n).trim().split('\r\n');
  assert.equal(stops.length, 95);
});

test('GPX contains 83 waypoints and 6 tracks', () => {
  const x = gpx(network());
  const wf = checkXmlBalanced(x);
  assert.ok(wf.ok, wf.error);
  assert.equal((x.match(/<wpt /g) || []).length, 83);
  assert.equal((x.match(/<trk>/g) || []).length, 6);
});

test('deep links use the documented Google URL schemes', () => {
  assert.equal(links.googleMapsPlace(24.7678740402426, 46.6430089081625), 'https://www.google.com/maps/search/?api=1&query=24.767874%2C46.643009');
  assert.equal(links.googleMapsDirections({ origin: [24.1, 46.1], destination: [24.2, 46.2] }),
    'https://www.google.com/maps/dir/?api=1&origin=24.100000%2C46.100000&destination=24.200000%2C46.200000&travelmode=transit&transit_mode=subway');
  assert.equal(links.googleMapsDirections({ destination: [24.2, 46.2], travelmode: 'walking' }),
    'https://www.google.com/maps/dir/?api=1&destination=24.200000%2C46.200000&travelmode=walking');
  assert.match(links.googleEarth(24.5, 46.5), /^https:\/\/earth\.google\.com\/web\/@24\.500000,46\.500000,620a,1400d,35y,0h,50t,0r$/);
  assert.equal(links.geoUri(24.5, 46.5, 'KAFD'), 'geo:24.500000,46.500000?q=24.500000,46.500000(KAFD)');
  assert.equal(links.appStation('https://x.y/z', 'kafd'), 'https://x.y/z/web/#station=kafd');
});

test('committed dist/ and web/ artefacts are in sync with the data (run `npm run build`)', () => {
  const n = network();
  const distKml = fs.readFileSync(path.join(ROOT, 'dist', 'riyadh-metro.kml'), 'utf8');
  Object.values(n.stations).forEach(s => assert.ok(distKml.includes(kml.escapeXml(s.name.ar)), `dist KML missing ${s.id} — rebuild`));
  const bundle = JSON.parse(fs.readFileSync(path.join(ROOT, 'web', 'data', 'metro-data.json'), 'utf8'));
  assert.equal(bundle.stations.stations.length, 83);
  assert.equal(bundle.lines.lines.length, 6);
  assert.equal(bundle.places.places.length, n.placeOrder.length);
  assert.ok(bundle.schematic && bundle.schematic.stations, 'schematic layout bundled for the web app');
  ['geo', 'network', 'router', 'links', 'kml', 'geojson', 'schematic', 'service'].forEach(m => {
    const src = fs.readFileSync(path.join(ROOT, 'src', m + '.js'), 'utf8');
    const copy = fs.readFileSync(path.join(ROOT, 'web', 'lib', m + '.js'), 'utf8');
    assert.equal(copy, src, `web/lib/${m}.js is stale — run npm run build`);
  });
  const kmz = fs.readFileSync(path.join(ROOT, 'dist', 'riyadh-metro.kmz'));
  assert.equal(readZip(kmz)[0].name, 'doc.kml');
});

test('destinations: hidden KML folder, GeoJSON layer and CSV with nearest station + walk', () => {
  const n = network();
  const x = kml.networkKml(n, { iconMode: 'hosted' });
  assert.ok(x.includes('<Folder id="places">'));
  assert.equal((x.match(/<Placemark id="pl-/g) || []).length, n.placeOrder.length);
  assert.ok(/<Folder id="places">[^]*?<visibility>0<\/visibility>/.test(x), 'destinations folder is hidden by default');
  assert.ok(x.includes('<Style id="place">') || x.includes('id="place-n"') || x.includes('id="place"'));
  assert.equal(checkXmlBalanced(x).ok, true);
  const ids = [...x.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'all XML ids unique');

  const gj = geojson.networkGeoJson(n, 'places');
  assert.equal(gj.features.length, n.placeOrder.length);
  const f = gj.features.find(f => f.properties.id === 'kingdom-centre');
  assert.equal(f.properties.nearest_station, 'al-urubah');
  assert.ok(f.geometry.coordinates[0] > 46 && f.geometry.coordinates[1] > 24, 'lng,lat order');

  const csv = placesCsv(n);
  const rows = csv.trim().split(/\r?\n/);
  assert.equal(rows.length, 1 + n.placeOrder.length);
  assert.ok(rows[0].includes('nearest_station_id') && rows[0].includes('walk_m'));
});

test('schematic SVGs are written by the build and match the renderer', () => {
  const svgAr = fs.readFileSync(path.join(ROOT, 'dist', 'riyadh-metro-diagram.svg'), 'utf8');
  const svgEn = fs.readFileSync(path.join(ROOT, 'dist', 'riyadh-metro-diagram-en.svg'), 'utf8');
  assert.ok(svgAr.startsWith('<?xml') && svgAr.includes('<svg') && svgAr.trim().endsWith('</svg>'));
  assert.ok(svgEn.includes('Riyadh Metro') && svgAr.includes('مترو الرياض'));
  const n = network();
  Object.values(n.stations).forEach(s => assert.ok(svgEn.includes('data-st="' + s.id + '"'), 'diagram missing ' + s.id));
});

#!/usr/bin/env node
/*
 * Riyadh Metro Navigator — build
 *
 *   node scripts/build.js          → validates data and writes every export into dist/ and web/data/
 *   node scripts/build.js --check  → validation report only (no files written)
 *
 * Outputs (all generated from data/*.json — never edit dist/ by hand):
 *   dist/riyadh-metro.kmz                    Google Earth package (embedded icons, tours)
 *   dist/riyadh-metro.kml                    same as plain KML (hosted icons) – Google My Maps import
 *   dist/lines/line-N-<colour>.kml           one KML per line (one My Maps layer per line)
 *   dist/riyadh-metro.geojson                lines + stations (simplestyle colours → renders on GitHub)
 *   dist/riyadh-metro-{lines,stations,segments}.geojson
 *   dist/riyadh-metro-stations.csv           My Maps / Sheets import
 *   dist/riyadh-metro-places.{geojson,csv}   destinations (malls, hospitals, landmarks…) with nearest station + walk
 *   dist/riyadh-metro-diagram{,-en}.svg      schematic network diagram (Arabic / English)
 *   dist/riyadh-metro-line-stops.csv         ordered stops per line with distances & estimated run times
 *   dist/riyadh-metro.gpx                    waypoints + tracks
 *   dist/riyadh-metro-network.json           routable network (segments, geometry, transfer penalties)
 *   web/data/metro-data.{js,json}            dataset bundle consumed by the web app
 *   web/icons/*.png                          PWA / favicon icons
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const net = require('../src/network');
const kml = require('../src/kml');
const geojson = require('../src/geojson');
const schematic = require('../src/schematic');
const { stationsCsv, lineStopsCsv, placesCsv, gpx } = require('../src/node/exports');
const { createZip, circleIcon } = require('../src/node/binary');
const { validateNetwork } = require('../src/node/validate');

const CHECK_ONLY = process.argv.includes('--check');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

function loadData() {
  return {
    stations: read('stations.json'), lines: read('lines.json'), shapes: read('shapes.json'), config: read('config.json'),
    places: read('places.json'), schematic: read('schematic.json')
  };
}

function write(rel, content) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);
  console.log(`  ✔ ${rel}  (${(size / 1024).toFixed(1)} KB)`);
}

function buildIcons(network) {
  const icons = {};
  network.lineOrder.forEach(lid => {
    const c = network.lines[lid].color;
    icons[`line-${lid}.png`] = circleIcon(64, [
      { radius: 1.0, color: '#000000', alpha: 0.25 },
      { radius: 0.9, color: '#ffffff' },
      { radius: 0.68, color: c }
    ]);
  });
  icons['interchange.png'] = circleIcon(64, [
    { radius: 1.0, color: '#000000', alpha: 0.25 },
    { radius: 0.9, color: '#1f1f1f' },
    { radius: 0.68, color: '#ffffff' },
    { radius: 0.3, color: '#1f1f1f' }
  ]);
  return icons;
}

function appLogo(size) {
  return circleIcon(size, [
    { radius: 1.0, color: '#1f1f1f' },
    { radius: 0.92, color: '#00ADE5' },
    { radius: 0.79, color: '#F0493A' },
    { radius: 0.66, color: '#F68D39' },
    { radius: 0.53, color: '#FFD105' },
    { radius: 0.40, color: '#43B649' },
    { radius: 0.27, color: '#984C9D' },
    { radius: 0.14, color: '#ffffff' }
  ]);
}

function main() {
  const data = loadData();
  const network = net.buildNetwork(data);
  const report = validateNetwork(network, data);

  console.log('Riyadh Metro Navigator — build');
  console.log(`  lines: ${report.stats.lines}  stations: ${report.stats.stations}  line-stops: ${report.stats.lineStops}  interchanges: ${report.stats.interchanges}  places: ${report.stats.places}`);
  console.log(`  official length: ${report.stats.officialKm} km  computed from alignments: ${report.stats.computedKm} km  shape points: ${report.stats.shapePoints}`);
  report.warnings.forEach(w => console.log('  ⚠ ' + w));
  report.errors.forEach(e => console.error('  ✖ ' + e));
  if (!report.ok) { console.error('Validation failed.'); process.exit(1); }
  if (CHECK_ONLY) { console.log('Validation OK.'); return; }

  const proj = data.config.project || {};
  const kmlOpts = { siteUrl: proj.siteUrl, repoUrl: proj.repoUrl };
  const slug = l => `line-${l.number}-${l.colorName.en.toLowerCase()}`;

  console.log('Writing exports…');
  // KML / KMZ
  const icons = buildIcons(network);
  const kmlHosted = kml.networkKml(network, Object.assign({ iconMode: 'hosted' }, kmlOpts));
  const kmlEmbedded = kml.networkKml(network, Object.assign({ iconMode: 'embedded', iconBase: 'icons/' }, kmlOpts));
  write('dist/riyadh-metro.kml', kmlHosted);
  write('dist/riyadh-metro.kmz', createZip([
    { name: 'doc.kml', data: kmlEmbedded },
    ...Object.keys(icons).map(name => ({ name: 'icons/' + name, data: icons[name] }))
  ]));
  network.lineOrder.forEach(lid => {
    const line = network.lines[lid];
    write(`dist/lines/${slug(line)}.kml`, kml.lineKml(network, lid, Object.assign({ iconMode: 'hosted' }, kmlOpts)));
  });

  // GeoJSON
  write('dist/riyadh-metro.geojson', JSON.stringify(geojson.networkGeoJson(network, 'all'), null, 1));
  write('dist/riyadh-metro-lines.geojson', JSON.stringify(geojson.networkGeoJson(network, 'lines'), null, 1));
  write('dist/riyadh-metro-stations.geojson', JSON.stringify(geojson.networkGeoJson(network, 'stations'), null, 1));
  write('dist/riyadh-metro-segments.geojson', JSON.stringify(geojson.networkGeoJson(network, 'segments')));
  write('dist/riyadh-metro-places.geojson', JSON.stringify(geojson.networkGeoJson(network, 'places'), null, 1));

  // CSV / GPX
  write('dist/riyadh-metro-stations.csv', stationsCsv(network));
  write('dist/riyadh-metro-line-stops.csv', lineStopsCsv(network));
  write('dist/riyadh-metro-places.csv', placesCsv(network));

  // Schematic diagram (same renderer the web app uses)
  const model = schematic.build(network, data.schematic);
  write('dist/riyadh-metro-diagram.svg', schematic.svg(model, { lang: 'ar', standalone: true }));
  write('dist/riyadh-metro-diagram-en.svg', schematic.svg(model, { lang: 'en', standalone: true }));
  write('dist/riyadh-metro.gpx', gpx(network));

  // Routable network
  write('dist/riyadh-metro-network.json', JSON.stringify(network));

  // Web app bundle (raw data; the browser builds the network itself with the same code)
  const bundle = { stations: data.stations, lines: data.lines, shapes: data.shapes, config: data.config, places: data.places, schematic: data.schematic, built: new Date().toISOString() };
  write('web/data/metro-data.json', JSON.stringify(bundle));
  write('web/data/metro-data.js', '/* generated by scripts/build.js — do not edit */\nwindow.RIYADH_METRO_DATA = ' + JSON.stringify(bundle) + ';\n');

  // Shared browser libraries (same code the build & tests use) → web/lib/
  ['geo', 'network', 'router', 'links', 'kml', 'geojson', 'schematic', 'service'].forEach(m => {
    write(`web/lib/${m}.js`, fs.readFileSync(path.join(ROOT, 'src', m + '.js')));
  });

  // Icons
  Object.keys(icons).forEach(name => write('web/icons/' + name, icons[name]));
  write('web/icons/icon-192.png', appLogo(192));
  write('web/icons/icon-512.png', appLogo(512));
  write('web/icons/favicon.png', appLogo(64));

  console.log('Done.');
}

main();

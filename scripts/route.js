#!/usr/bin/env node
/*
 * Riyadh Metro Navigator — command-line journey planner
 *
 *   node scripts/route.js "KAFD" "National Museum"
 *   node scripts/route.js المركز المالي المتحف الوطني --en
 *   node scripts/route.js kafd airport-t1-2 --fewest --json
 *   node scripts/route.js --list            # list all stations with ids
 *   node scripts/route.js --near 24.7114 46.6745
 */
'use strict';
const fs = require('fs');
const path = require('path');
const net = require('../src/network');
const router = require('../src/router');
const links = require('../src/links');

const ROOT = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));
const NET = net.buildNetwork({ stations: read('stations.json'), lines: read('lines.json'), shapes: read('shapes.json'), config: read('config.json') });

const args = process.argv.slice(2);
const flag = f => { const i = args.indexOf(f); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const lang = flag('--en') ? 'en' : 'ar';
const asJson = flag('--json');
const mode = flag('--fewest') ? 'fewest-transfers' : 'fastest';

if (flag('--list')) {
  NET.lineOrder.forEach(lid => {
    const line = NET.lines[lid];
    console.log(`\n${line.number} — ${line.name.ar} / ${line.name.en}`);
    line.stations.forEach((id, i) => {
      const s = NET.stations[id];
      console.log(`  ${String(i + 1).padStart(2)}. ${id.padEnd(28)} ${s.name.en.padEnd(28)} ${s.name.ar}${s.interchange ? '  ⇄ ' + s.lines.filter(l => l !== lid).map(l => NET.lines[l].name.en).join(', ') : ''}`);
    });
  });
  process.exit(0);
}

if (flag('--near')) {
  const [lat, lng] = args.map(Number);
  net.nearestStations(NET, lat, lng, 5).forEach(n => console.log(`${n.distanceM} m  ${n.station.name[lang]}  (${n.station.id})  ${links.googleMapsPlace(n.station.lat, n.station.lng)}`));
  process.exit(0);
}

if (args.length < 2) {
  console.error('Usage: node scripts/route.js <from> <to> [--fewest] [--en] [--json]\n       node scripts/route.js --list | --near <lat> <lng>');
  process.exit(1);
}

// Allow multi-word names without quotes: split the remaining args in the middle on the best match.
function resolve(q) {
  if (NET.stations[q]) return q;
  const r = net.searchStations(NET, q, 1);
  return r.length ? r[0].id : null;
}
let from = null, to = null;
for (let split = 1; split < args.length && !(from && to); split++) {
  from = resolve(args.slice(0, split).join(' '));
  to = resolve(args.slice(split).join(' '));
}
if (!from || !to) { console.error('Could not resolve stations. Try --list to see station ids.'); process.exit(2); }

const it = router.planRoute(NET, from, to, { mode });
if (asJson) { console.log(JSON.stringify(it, null, 2)); process.exit(0); }
console.log(router.describeItinerary(NET, it, lang).map((s, i) => (i === 0 ? '★ ' : '  ') + s).join('\n'));
const f = NET.stations[from], t = NET.stations[to];
console.log('\n' + (lang === 'ar' ? 'خرائط Google (مواصلات): ' : 'Google Maps (transit): ') +
  links.googleMapsDirections({ origin: [f.lat, f.lng], destination: [t.lat, t.lng], travelmode: 'transit' }));

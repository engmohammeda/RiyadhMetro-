#!/usr/bin/env node
/*
 * Riyadh Metro Navigator — import-transit
 *
 * Builds the canonical bus / district datasets from the vendored official sources in
 * `data/bus/source/`:
 *
 *   bus-stops-2024.csv     RCRC Open Data — bus stops by route, direction, shelter type (2024)
 *   bus-routes-2024.csv    RCRC Open Data — bus alignments by route + direction (2024)
 *   riyadh-districts.topojson  Riyadh district boundaries (Saudi Post verified, community mirror)
 *
 * Outputs (committed, so the web app never parses CSV):
 *
 *   data/bus/stops.json     one record per physical stop (3,010) + district + nearest metro station
 *   data/bus/routes.json    one record per bus route (88) with ordered stops per direction
 *   data/bus/shapes.json    simplified alignment per route + direction
 *   data/districts.json     134 district polygons (simplified) + stop/route statistics
 *
 * Run: npm run import:transit
 */
'use strict';

const fs = require('fs');
const path = require('path');
const geo = require('../src/geo');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'bus', 'source');
const OUT = path.join(ROOT, 'data');

/* ─────────────────────────────────────────────────────────────── CSV parser */
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift().map(h => h.replace(/\u00a0/g, ' ').trim());
  return rows.filter(r => r.some(c => c !== '')).map(r => {
    const o = {};
    header.forEach((h, i) => { o[h] = (r[i] == null ? '' : r[i]).trim(); });
    return o;
  });
}

/* ─────────────────────────────────────────────────────────── GeoJSON helpers */
function decodeTopology(topology) {
  const arcs = topology.arcs.map(arc => arc.map(p => [p[0], p[1]]));
  const arcPoints = i => (i < 0 ? arcPoints(-i - 1).slice().reverse() : arcs[i]);
  const ring = indices => {
    const pts = [];
    indices.forEach(i => {
      let a = arcPoints(i);
      if (pts.length && pts[pts.length - 1][0] === a[0][0] && pts[pts.length - 1][1] === a[0][1]) a = a.slice(1);
      pts.push.apply(pts, a);
    });
    return pts;
  };
  const features = [];
  Object.keys(topology.objects).forEach(key => {
    const obj = topology.objects[key];
    const geoms = obj.type === 'GeometryCollection' ? obj.geometries : [obj];
    geoms.forEach(g => {
      let geometry = null;
      if (g.type === 'Polygon') geometry = { type: 'Polygon', coordinates: g.arcs.map(ring) };
      else if (g.type === 'MultiPolygon') geometry = { type: 'MultiPolygon', coordinates: g.arcs.map(poly => poly.map(ring)) };
      if (geometry) features.push({ type: 'Feature', properties: g.properties || {}, geometry });
    });
  });
  return features;
}

function pointInRing(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > p[1]) !== (yj > p[1])) && (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function pointInGeometry(p, geometry) {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return pointInRing(p, geometry.coordinates[0]);
  return geometry.coordinates.some(poly => pointInRing(p, poly[0]));
}

/** Douglas–Peucker on [lat,lng] points, tolerance in metres. */
function simplify(points, toleranceM) {
  if (points.length <= 2) return points.slice();
  const refLat = points[0][0];
  const kx = Math.cos(refLat * Math.PI / 180) * 111320, ky = 110540;
  const toXY = p => [p[1] * kx, p[0] * ky];
  const pts = points.map(toXY);
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;

  function reduce(first, last) {
    if (last <= first + 1) return;
    const a = pts[first], b = pts[last];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    let maxD = -1, idx = -1;
    for (let i = first + 1; i < last; i++) {
      const p = pts[i];
      const d = len === 0 ? Math.hypot(p[0] - a[0], p[1] - a[1])
        : Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > toleranceM) { keep[idx] = true; reduce(first, idx); reduce(idx, last); }
  }
  reduce(0, points.length - 1);
  return points.filter((_, i) => keep[i]);
}

function roundCoord(p, digits) {
  const f = Math.pow(10, digits == null ? 5 : digits);
  return [Math.round(p[0] * f) / f, Math.round(p[1] * f) / f];
}

function slug(s) {
  return String(s).toLowerCase()
    .replace(/['’`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function baseName(en, ar) {
  const cleanEn = String(en || '').replace(/\s+\d+\s*[A-Za-z]?\s*$/, '').replace(/\s+[A-Za-z]\s*$/, '').trim();
  const cleanAr = String(ar || '').replace(/\s+\d+\s*[A-Za-zأ-ي]?\s*$/, '').replace(/\s+[أ-ي]\s*$/, '').trim();
  return { en: cleanEn || String(en || ''), ar: cleanAr || String(ar || '') };
}

/* ─────────────────────────────────────────────────────────────── constants */
const SHELTERS = {
  'BRT station': { id: 'brt', ar: 'محطة حافلات سريعة (BRT)', en: 'BRT station' },
  'Air conditioned shelter': { id: 'ac', ar: 'مأوى مكيّف', en: 'Air-conditioned shelter' },
  'Large air conditioned shelter': { id: 'ac-large', ar: 'مأوى كبير مكيّف', en: 'Large air-conditioned shelter' },
  'Open shelter': { id: 'open', ar: 'مأوى مفتوح', en: 'Open shelter' },
  'Feeder pole with reduced site adaptation': { id: 'pole', ar: 'عمود توقّف (تجهيز بسيط)', en: 'Feeder pole (reduced adaptation)' },
  'Feeder pole with standard site adaptation': { id: 'pole-standard', ar: 'عمود توقّف (تجهيز قياسي)', en: 'Feeder pole (standard adaptation)' },
  Terminal: { id: 'terminal', ar: 'محطة طرفية', en: 'Terminal' },
  'Iconic Metro Station': { id: 'metro', ar: 'محطة مترو رئيسية', en: 'Iconic metro station' }
};

const ROUTE_TYPES = {
  brt: { ar: 'حافلة ذات مسار مخصص (BRT)', en: 'Bus rapid transit (BRT)', color: '#E8552D', kmh: 24, headway: 7 },
  main: { ar: 'مسار رئيسي', en: 'Main corridor', color: '#2D7DD2', kmh: 21, headway: 12 },
  sector: { ar: 'مسار قطاعي / تغذية', en: 'Sector / feeder', color: '#2FA37C', kmh: 18, headway: 18 },
  community: { ar: 'حافلة مجتمعية', en: 'Community bus', color: '#7C8794', kmh: 16, headway: 25 }
};

const BRT_ROUTES = ['11', '12', '13'];

function routeType(number) {
  if (BRT_ROUTES.indexOf(number) >= 0) return 'brt';
  if (/^\d{1,2}$/.test(number)) return 'main';
  if (/^9/.test(number)) return 'community';
  return 'sector';
}

function stageInfo(raw) {
  const v = String(raw || '').trim();
  if (!v || v === 'NA') return { stage: null, operating: null };
  if (/beyond/i.test(v)) return { stage: 'beyond-5.2', operating: false };
  return { stage: v, operating: true };
}

/* ─────────────────────────────────────────────────────────────────── main */
function main() {
  const districtsTopo = JSON.parse(fs.readFileSync(path.join(SRC, 'riyadh-districts.topojson'), 'utf8'));
  const districtNames = JSON.parse(fs.readFileSync(path.join(OUT, 'bus', 'district-names.json'), 'utf8'));

  /* 1 ── districts (merge polygons sharing a name, simplify, compute stats) */
  const features = decodeTopology(districtsTopo).map(f => {
    const en = f.properties.id || f.properties.name;
    return { en, ar: (districtNames.names && districtNames.names[en]) || en, geometry: f.geometry };
  }).filter(f => f.en);

  const byName = new Map();
  features.forEach(f => {
    if (!byName.has(f.en)) {
      byName.set(f.en, { id: slug(f.en), name: { ar: f.ar, en: f.en }, polys: [], geometry: null, approx: (districtNames.approx || []).indexOf(f.en) >= 0 });
    }
    const rec = byName.get(f.en);
    if (f.geometry.type === 'Polygon') rec.polys.push(f.geometry.coordinates);
    else rec.polys.push.apply(rec.polys, f.geometry.coordinates);
  });

  const districts = {};
  const districtList = [];
  byName.forEach(rec => {
    // ring points are GeoJSON order [lng, lat]
    const allPts = [];
    rec.polys.forEach(poly => poly.forEach(ring => ring.forEach(p => allPts.push(p))));
    const bbox = allPts.reduce((b, p) => [
      [Math.min(b[0][0], p[1]), Math.min(b[0][1], p[0])],
      [Math.max(b[1][0], p[1]), Math.max(b[1][1], p[0])]
    ], [[Infinity, Infinity], [-Infinity, -Infinity]]);
    const simplified = rec.polys.map(poly => poly.map(ring => simplify(ring, 22).map(p => roundCoord(p, 5))));
    const geometry = simplified.length === 1
      ? { type: 'Polygon', coordinates: simplified[0] }
      : { type: 'MultiPolygon', coordinates: simplified };
    const cLng = allPts.reduce((n, p) => n + p[0], 0) / allPts.length;
    const cLat = allPts.reduce((n, p) => n + p[1], 0) / allPts.length;
    const d = {
      id: rec.id,
      name: rec.name,
      approx: rec.approx || undefined,
      centroid: roundCoord([cLat, cLng], 5),
      bbox: [roundCoord(bbox[0], 5), roundCoord(bbox[1], 5)],
      geometry,
      stops: 0,
      routes: [],
      brtStops: 0,
      plannedStops: 0
    };
    districts[rec.id] = d;
    districtList.push(d);
    rec.full = {
      geometry: {
        type: rec.polys.length === 1 ? 'Polygon' : 'MultiPolygon',
        coordinates: rec.polys.length === 1 ? rec.polys[0] : rec.polys
      },
      bbox, district: d
    };
  });

  // Lookup table used for stop → district point-in-polygon assignment
  const lookups = Array.from(byName.values()).map(r => r.full);
  function districtFor(lat, lng) {
    const p = [lng, lat]; // GeoJSON order
    for (let i = 0; i < lookups.length; i++) {
      const L = lookups[i], b = L.bbox;
      if (lat < b[0][0] || lat > b[1][0] || lng < b[0][1] || lng > b[1][1]) continue;
      if (pointInGeometry(p, L.geometry)) return { district: L.district, approx: false };
    }
    // outside every polygon: nearest district centre within 6 km (hospitals, highways, industrial edges)
    let best = null;
    lookups.forEach(L => {
      const c = L.district.centroid;
      const dm = geo.haversine([lat, lng], c);
      if (!best || dm < best.dm) best = { dm, district: L.district };
    });
    return best && best.dm <= 6000 ? { district: best.district, approx: true } : null;
  }

  /* 2 ── bus alignments */
  const routeRows = parseCsv(fs.readFileSync(path.join(SRC, 'bus-routes-2024.csv'), 'utf8'));
  const shapes = {};
  const roadMeta = {};
  routeRows.forEach(r => {
    const line = r['Bus line'];
    const dir = r['Direction'];
    if (!line || line === 'NA' || !dir) return;
    let geometry;
    try { geometry = JSON.parse(r['Geographical coordinates']); } catch (e) { return; }
    if (!geometry || !geometry.coordinates || geometry.coordinates.length < 2) return;
    const full = geometry.coordinates.map(p => [p[1], p[0]]); // [lat,lng]
    const key = line + '-' + dir;
    const deduped = full.filter((p, i) => i === 0 || Math.abs(p[0] - full[i - 1][0]) > 1e-7 || Math.abs(p[1] - full[i - 1][1]) > 1e-7);
    shapes[key] = {
      full,
      clean: deduped.map(p => roundCoord(p, 5)),
      display: simplify(full, 6).map(p => roundCoord(p, 5))
    };
    roadMeta[line + '-' + dir] = {
      origin: { en: r['Origin of the line'], ar: r['منشأ المسار'] },
      destination: { en: r['Destination of the line'], ar: r['جهة الوصول'] },
      comment: r['Comments'] || ''
    };
  });

  /* 3 ── stops */
  const stopRows = parseCsv(fs.readFileSync(path.join(SRC, 'bus-stops-2024.csv'), 'utf8'));
  const stops = [];
  const stopById = {};
  stopRows.forEach((r, index) => {
    const code = r['Bus station code'];
    if (!code) return;
    const coords = String(r['geo_point_2d'] || '').split(',').map(Number);
    if (coords.length !== 2 || !isFinite(coords[0]) || !isFinite(coords[1])) return;
    const [lat, lng] = coords;
    const name = { en: r['Bus station name'], ar: r['اسم موقف الحافلات'] };
    const shelter = SHELTERS[r['Shelter type']] || { id: 'unknown', ar: 'غير محدد', en: r['Shelter type'] || 'Unknown' };
    const st = stageInfo(r['Development stage']);
    const place = districtFor(lat, lng);
    const route = r['Bus line'] && r['Bus line'] !== 'NA' ? r['Bus line'] : null;
    const stop = {
      id: 'b' + code,
      code,
      name,
      base: baseName(name.en, name.ar),
      lat: +lat.toFixed(6),
      lng: +lng.toFixed(6),
      shelter: shelter.id,
      stage: st.stage,
      operating: st.operating,
      district: place ? place.district.id : null,
      districtApprox: place ? place.approx : undefined,
      routes: route ? [{ route, dir: +r['Direction'], seq: +r['Sequence of the stops'] || null }] : []
    };
    stops.push(stop);
    stopById[stop.id] = stop;
    if (place) {
      place.district.stops++;
      if (shelter.id === 'brt') place.district.brtStops++;
      if (st.operating === false) place.district.plannedStops++;
      if (route && place.district.routes.indexOf(route) < 0) place.district.routes.push(route);
    }
  });

  /* 4 ── nearest metro station for each stop (for transfers on foot) */
  const metro = JSON.parse(fs.readFileSync(path.join(OUT, 'stations.json'), 'utf8')).stations;
  stops.forEach(s => {
    let best = null;
    metro.forEach(m => {
      const d = geo.haversine([s.lat, s.lng], [m.lat, m.lng]);
      if (!best || d < best.d) best = { d, m };
    });
    if (best && best.d <= 700) {
      s.nearMetro = { station: best.m.id, distanceM: Math.round(best.d) };
    }
  });

  /* 5 ── routes: order stops along each direction's alignment */
  const groups = {};
  stops.forEach(s => {
    s.routes.forEach(r => {
      const key = r.route + '-' + r.dir;
      (groups[key] = groups[key] || []).push(s);
    });
  });

  const routes = {};
  Object.keys(groups).forEach(key => {
    const dash = key.lastIndexOf('-');
    const line = key.slice(0, dash), dir = +key.slice(dash + 1);
    const shapeInfo = shapes[key];
    if (!shapeInfo) return;
    const cum = geo.cumulativeDistances(shapeInfo.full);
    const projected = groups[key].map(s => {
      const pr = geo.projectOnPolyline([s.lat, s.lng], shapeInfo.full, 0, cum);
      return { stop: s, along: pr.along, offset: pr.offset };
    }).filter(x => x.offset <= 250);
    projected.sort((a, b) => a.along - b.along);
    const ordered = [];
    projected.forEach(x => {
      if (ordered.length && ordered[ordered.length - 1].stop.id === x.stop.id) return;
      ordered.push(x);
    });
    if (ordered.length < 2) return;

    routes[line] = routes[line] || { id: line, dirs: {} };
    const R = routes[line];
    const kmh = ROUTE_TYPES[routeType(line)].kmh;
    const segs = [];
    for (let i = 1; i < ordered.length; i++) {
      const a = ordered[i - 1], b = ordered[i];
      let dist = b.along - a.along;
      const straight = geo.haversine([a.stop.lat, a.stop.lng], [b.stop.lat, b.stop.lng]);
      // a stop can project onto the wrong pass of a loop; fall back to the straight-line
      // distance when the along-shape distance is impossibly short
      if (dist < straight * 0.8) dist = straight;
      segs.push({ from: a.stop.id, to: b.stop.id, meters: Math.round(dist), seconds: Math.round(dist / (kmh / 3.6)) });
    }
    R.dirs[dir] = {
      shape: key,
      shapeLengthM: Math.round(cum[cum.length - 1]),
      stops: ordered.map(x => x.stop.id),
      along: ordered.map(x => Math.round(x.along)),
      segments: segs,
      lengthM: segs.reduce((n, sg) => n + sg.meters, 0),
      maxOffsetM: Math.round(Math.max.apply(null, ordered.map(x => x.offset)))
    };
    if (!roadMeta[key]) roadMeta[key] = { origin: {}, destination: {} };
  });

  /* 6 ── route records */
  const routeList = [];
  Object.keys(routes).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).forEach(line => {
    const R = routes[line];
    const dirIds = Object.keys(R.dirs).map(Number).sort();
    const mainDir = dirIds.slice().sort((a, b) => R.dirs[b].stops.length - R.dirs[a].stops.length)[0];
    const meta = roadMeta[line + '-' + mainDir] || { origin: {}, destination: {} };
    const mainStops = R.dirs[mainDir].stops.map(id => stopById[id]);
    const type = routeType(line);
    const T = ROUTE_TYPES[type];
    const first = mainStops[0], last = mainStops[mainStops.length - 1];
    const orig = { en: first.base.en, ar: first.base.ar };
    const dest = { en: last.base.en, ar: last.base.ar };
    const loop = orig.en === dest.en && orig.ar === dest.ar;
    const sourceName = {
      origin: { en: meta.origin.en || null, ar: meta.origin.ar || null },
      destination: { en: meta.destination.en || null, ar: meta.destination.ar || null }
    };
    const allStops = Object.keys(R.dirs).reduce((acc, d) => acc.concat(R.dirs[d].stops), []);
    const uniqueStops = Array.from(new Set(allStops));
    const planned = uniqueStops.filter(id => stopById[id].operating === false).length;
    const lengthM = R.dirs[mainDir].lengthM;
    const stopsCount = Math.max.apply(null, dirIds.map(d => R.dirs[d].stops.length));
    const seconds = Math.round(lengthM / (T.kmh / 3.6));
    const brtStops = uniqueStops.filter(id => stopById[id].shelter === 'brt').length;
    const route = {
      id: line,
      number: +line,
      type,
      color: T.color,
      name: loop
        ? { ar: orig.ar + ' (دائري)', en: orig.en + ' (loop)' }
        : { ar: orig.ar + ' ↔ ' + dest.ar, en: orig.en + ' ↔ ' + dest.en },
      termini: { first: orig, last: dest },
      origin: orig,
      destination: dest,
      loop,
      sourceName,
      headwayMin: T.headway,
      speedKmh: T.kmh,
      lengthM,
      stopCount: stopsCount,
      uniqueStops: uniqueStops.length,
      plannedStops: planned,
      brtStops,
      directions: dirIds,
      bidirectional: dirIds.length > 1,
      runtimeMin: Math.round(seconds / 60),
      stops: uniqueStops,
      dirs: R.dirs,
      stage: planned === uniqueStops.length ? 'planned' : (planned > 0 ? 'partial' : 'operating')
    };
    // keep direction data lean: stops + shape + lengths only
    Object.keys(route.dirs).forEach(d => {
      const dd = route.dirs[d];
      route.dirs[d] = {
        shape: dd.shape, shapeLengthM: dd.shapeLengthM, stops: dd.stops, along: dd.along,
        segments: dd.segments, lengthM: dd.lengthM, maxOffsetM: dd.maxOffsetM
      };
    });
    routes[line] = route;
    routeList.push(route);
  });

  /* 7 ── metro ↔ bus interchange index (stops within 450 m of a station) */
  const stationBus = {};
  stops.forEach(s => {
    if (!s.nearMetro || s.nearMetro.distanceM > 450) return;
    const sid = s.nearMetro.station;
    (stationBus[sid] = stationBus[sid] || []).push({ stop: s.id, distanceM: s.nearMetro.distanceM });
  });

  /* 8 ── write */
  const stamp = '2026-10-25';
  const districtOut = {
    _comment: 'Riyadh districts — simplified polygons (Saudi Post verified boundaries, community mirror) + public-transport statistics computed from data/bus/stops.json.',
    updated: stamp,
    count: districtList.length,
    districts: districtList
  };
  stops.forEach(s => { delete s.routes; delete s.base; });
  const stopsOut = {
    _comment: 'Riyadh Bus stops — official RCRC Open Data (2024) stop register, one record per physical stop, enriched with district and nearest metro station.',
    updated: stamp,
    count: stops.length,
    shelters: Object.keys(SHELTERS).reduce((acc, k) => { const s = SHELTERS[k]; acc[s.id] = { ar: s.ar, en: s.en }; return acc; }, {}),
    stops
  };
  const routesOut = {
    _comment: 'Riyadh Bus routes — official RCRC Open Data (2024) alignments; stops ordered by projection along each direction alignment. Speeds/headways are estimates (see data/config.json → busModel).',
    updated: stamp,
    count: routeList.length,
    types: ROUTE_TYPES,
    routes: routeList
  };
  const shapesOut = {
    _comment: 'Bus alignments per route + direction ([lat,lng]). Full geometry is used for distances; `simplified` for display.',
    updated: stamp,
    shapes: {}
  };
  Object.keys(shapes).forEach(k => { shapesOut.shapes[k] = shapes[k].display; });

  fs.writeFileSync(path.join(OUT, 'bus', 'stops.json'), JSON.stringify(stopsOut));
  fs.writeFileSync(path.join(OUT, 'bus', 'routes.json'), JSON.stringify(routesOut));
  fs.writeFileSync(path.join(OUT, 'bus', 'shapes.json'), JSON.stringify(shapesOut));
  fs.writeFileSync(path.join(OUT, 'districts.json'), JSON.stringify(districtOut));

  /* 9 ── report */
  const withoutDistrict = stops.filter(s => !s.district).length;
  const offsets = routeList.map(r => Math.max.apply(null, Object.keys(r.dirs).map(d => r.dirs[d].maxOffsetM)));
  console.log('Riyadh transit import');
  console.log('  stops:      ' + stops.length + '  (no district: ' + withoutDistrict + ')');
  console.log('  routes:     ' + routeList.length + '  (BRT ' + routeList.filter(r => r.type === 'brt').length +
    ' · main ' + routeList.filter(r => r.type === 'main').length +
    ' · sector ' + routeList.filter(r => r.type === 'sector').length +
    ' · community ' + routeList.filter(r => r.type === 'community').length + ')');
  console.log('  directions: ' + Object.keys(shapes).length + '  shape points: ' +
    Object.keys(shapes).reduce((n, k) => n + shapes[k].full.length, 0) +
    ' → display ' + Object.keys(shapes).reduce((n, k) => n + shapes[k].display.length, 0));
  console.log('  districts:  ' + districtList.length + '  with stops: ' + districtList.filter(d => d.stops > 0).length);
  console.log('  max stop-to-alignment offset: ' + Math.max.apply(null, offsets) + ' m');
  console.log('  metro stations with a bus stop within 450 m: ' + Object.keys(stationBus).length + '/' + metro.length);
  console.log('  sizes: stops ' + kb('bus/stops.json') + ' · routes ' + kb('bus/routes.json') +
    ' · shapes ' + kb('bus/shapes.json') + ' · districts ' + kb('districts.json'));

  function kb(rel) { return (fs.statSync(path.join(OUT, rel)).size / 1024).toFixed(1) + ' KB'; }
}

main();

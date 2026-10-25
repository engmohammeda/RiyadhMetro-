/*
 * Riyadh Metro Navigator — transit exports (Node only)
 *
 * Turns the multimodal model into portable artefacts:
 *   GeoJSON / CSV for GIS & spreadsheets
 *   a GTFS Schedule feed (frequencies-based) for any trip planner
 *
 * The GTFS feed is derived: route geometry and stop sequences are official, while run
 * times and headways come from data/config.json → busModel (the operator publishes no
 * timetable). Every trip therefore describes a *representative* service, expanded by
 * frequencies.txt — good for routing engines, not for printed timetables.
 */
'use strict';

const { createZip } = require('./binary');

const SHELTER_AR = {
  brt: 'محطة BRT',
  ac: 'مأوى مكيّف',
  'ac-large': 'مأوى كبير مكيّف',
  open: 'مأوى مفتوح',
  pole: 'عمود توقّف',
  'pole-standard': 'عمود توقّف (قياسي)',
  terminal: 'محطة طرفية',
  metro: 'محطة مترو رئيسية',
  unknown: 'غير محدد'
};

function round(p, d) {
  const f = Math.pow(10, d == null ? 6 : d);
  return Math.round(p * f) / f;
}

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function csv(rows) {
  return rows.map(r => r.map(csvEscape).join(',')).join('\n') + '\n';
}

function hms(seconds) {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return [h, m, sec].map(x => (x < 10 ? '0' : '') + x).join(':');
}

/* ─────────────────────────────────────────────────────────────── GeoJSON */
function stopFeatures(model) {
  return model.stopOrder.map(id => {
    const s = model.stops[id];
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        id: s.id,
        code: s.code,
        name_ar: s.name.ar,
        name_en: s.name.en,
        shelter: s.shelter,
        shelter_ar: SHELTER_AR[s.shelter] || s.shelter,
        stage: s.stage,
        operating: s.operating,
        district: s.district ? model.districts[s.district] && model.districts[s.district].name.en : null,
        district_ar: s.district ? model.districts[s.district] && model.districts[s.district].name.ar : null,
        routes: s.routes.join(' '),
        metro_station: s.nearMetro ? s.nearMetro.station : null,
        metro_walk_m: s.nearMetro ? s.nearMetro.distanceM : null
      }
    };
  });
}

function busStopsGeoJson(model) {
  return { type: 'FeatureCollection', _comment: 'Riyadh Bus stops — RCRC Open Data 2024 + computed district / nearest metro station.', features: stopFeatures(model) };
}

function busRoutesGeoJson(model) {
  const features = model.routeOrder.map(id => {
    const r = model.routes[id];
    const coords = Object.keys(r.dirs).map(k => r.dirs[k].shape.map(p => [p[1], p[0]]));
    return {
      type: 'Feature',
      geometry: coords.length === 1 ? { type: 'LineString', coordinates: coords[0] } : { type: 'MultiLineString', coordinates: coords },
      properties: {
        route: r.id,
        type: r.type,
        name_ar: r.name.ar,
        name_en: r.name.en,
        from_ar: r.origin.ar,
        to_ar: r.destination.ar,
        from_en: r.origin.en,
        to_en: r.destination.en,
        stops: r.stopCount,
        length_km: round(r.lengthM / 1000, 1),
        run_min: r.runtimeMin,
        headway_min: r.headwayMin,
        directions: r.directions.join(' '),
        color: r.color,
        stage: r.stage
      }
    };
  });
  return { type: 'FeatureCollection', _comment: 'Riyadh Bus route alignments (RCRC Open Data 2024); stops ordered by projection.', features };
}

function districtsGeoJson(model) {
  return {
    type: 'FeatureCollection',
    _comment: 'Riyadh districts (Saudi Post verified boundaries, community mirror) + public-transport statistics.',
    features: model.districtOrder.map(id => {
      const d = model.districts[id];
      return {
        type: 'Feature',
        geometry: d.geometry,
        properties: {
          id: d.id,
          name_ar: d.name.ar,
          name_en: d.name.en,
          stops: d.stops,
          brt_stops: d.brtStops,
          routes: d.routes.length,
          route_ids: d.routes.join(' '),
          planned_stops: d.plannedStops,
          centroid_lat: d.centroid[0],
          centroid_lng: d.centroid[1]
        }
      };
    })
  };
}

function parkAndRideGeoJson(model) {
  return {
    type: 'FeatureCollection',
    _comment: 'Park & Ride sites compiled from RCRC and press/community reports (see data/park-and-ride.json).',
    features: model.parkAndRide.sites.map(s => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      properties: {
        station: s.station,
        name_ar: s.name.ar,
        name_en: s.name.en,
        lines: (s.lines || []).join(' '),
        capacity: s.capacity,
        confidence: s.confidence || 'reported'
      }
    }))
  };
}

/* ─────────────────────────────────────────────────────────────────── CSV */
function busStopsCsv(model) {
  const rows = [[
    'stop_id', 'code', 'name_ar', 'name_en', 'lat', 'lng', 'shelter', 'shelter_ar', 'stage', 'operating',
    'district', 'district_ar', 'routes', 'metro_station', 'metro_walk_m'
  ]];
  model.stopOrder.forEach(id => {
    const s = model.stops[id];
    const d = s.district && model.districts[s.district];
    rows.push([
      s.id, s.code, s.name.ar, s.name.en, s.lat, s.lng, s.shelter, SHELTER_AR[s.shelter] || s.shelter,
      s.stage || '', s.operating === false ? 'planned' : s.operating ? 'operating' : '',
      d ? d.name.en : '', d ? d.name.ar : '', s.routes.join(' '),
      s.nearMetro ? s.nearMetro.station : '', s.nearMetro ? s.nearMetro.distanceM : ''
    ]);
  });
  return csv(rows);
}

function busRoutesCsv(model) {
  const rows = [[
    'route', 'type', 'name_ar', 'name_en', 'from_ar', 'to_ar', 'from_en', 'to_en',
    'stops', 'unique_stops', 'planned_stops', 'length_km', 'run_min', 'headway_min', 'speed_kmh', 'directions', 'stage'
  ]];
  model.routeOrder.forEach(id => {
    const r = model.routes[id];
    rows.push([
      r.id, r.type, r.name.ar, r.name.en, r.origin.ar, r.destination.ar, r.origin.en, r.destination.en,
      r.stopCount, r.uniqueStops, r.plannedStops, round(r.lengthM / 1000, 2), r.runtimeMin, r.headwayMin,
      r.speedKmh, r.directions.join(' '), r.stage
    ]);
  });
  return csv(rows);
}

function districtCsv(model) {
  const rows = [['district_id', 'name_ar', 'name_en', 'stops', 'brt_stops', 'planned_stops', 'routes', 'route_ids', 'centroid_lat', 'centroid_lng']];
  model.districtOrder.forEach(id => {
    const d = model.districts[id];
    rows.push([d.id, d.name.ar, d.name.en, d.stops, d.brtStops, d.plannedStops, d.routes.length, d.routes.join(' '), d.centroid[0], d.centroid[1]]);
  });
  return csv(rows);
}

/* ────────────────────────────────────────────────────────────────── GTFS */
function gtfs(model, opts) {
  opts = opts || {};
  const network = model.network;
  const date = opts.date || new Date('2026-01-01T00:00:00Z');
  const start = '20260101', end = '20271231';

  const files = {};
  files['agency.txt'] = csv([
    ['agency_id', 'agency_name', 'agency_url', 'agency_timezone', 'agency_lang', 'agency_phone'],
    ['RCRC', 'Riyadh Public Transport — Metro & Bus (community feed)', 'https://www.rpt.sa/', 'Asia/Riyadh', 'ar', '19933']
  ]);

  const stopRows = [['stop_id', 'stop_name', 'stop_lat', 'stop_lon', 'location_type', 'wheelchair_boarding', 'stop_code', 'stop_desc']];
  Object.keys(network.stations).sort().forEach(id => {
    const s = network.stations[id];
    stopRows.push(['m-' + id, s.name.ar + ' / ' + s.name.en, s.lat, s.lng, 0, '', '', 'Riyadh Metro — lines ' + s.lines.join(',')]);
  });
  model.stopOrder.forEach(id => {
    const s = model.stops[id];
    stopRows.push([s.id, s.name.ar + ' / ' + s.name.en, s.lat, s.lng, 0, '', s.code, (SHELTER_AR[s.shelter] || s.shelter)]);
  });
  files['stops.txt'] = csv(stopRows);

  const routeRows = [['route_id', 'agency_id', 'route_short_name', 'route_long_name', 'route_type', 'route_color', 'route_text_color', 'route_desc']];
  const tripRows = [['route_id', 'service_id', 'trip_id', 'trip_headsign', 'direction_id', 'shape_id']];
  const timeRows = [['trip_id', 'arrival_time', 'departure_time', 'stop_id', 'stop_sequence', 'pickup_type', 'drop_off_type']];
  const freqRows = [['trip_id', 'start_time', 'end_time', 'headway_secs', 'exact_times']];
  const shapeRows = [['shape_id', 'shape_pt_lat', 'shape_pt_lon', 'shape_pt_sequence']];
  const shapeIds = {};

  function emitShape(shapeId, points) {
    if (shapeIds[shapeId]) return;
    shapeIds[shapeId] = true;
    points.forEach((p, i) => shapeRows.push([shapeId, round(p[0], 6), round(p[1], 6), i + 1]));
  }

  /* metro */
  network.lineOrder.forEach(lid => {
    const line = network.lines[lid];
    routeRows.push([
      'metro-' + lid, 'RCRC', String(line.number), line.name.ar + ' / ' + line.name.en, 1,
      line.color.replace('#', ''), 'FFFFFF', 'Riyadh Metro — ' + (line.corridor ? line.corridor.en : '')
    ]);
    const shapeId = 'sh-m-' + lid;
    emitShape(shapeId, line.shape);
    [0, 1].forEach(dirIdx => {
      const stations = dirIdx === 0 ? line.stations.slice() : line.stations.slice().reverse();
      const tripId = 'metro-' + lid + '-d' + dirIdx;
      const headsign = network.stations[stations[stations.length - 1]].name.ar;
      tripRows.push(['metro-' + lid, 'ALL', tripId, headsign, dirIdx, shapeId]);
      let t = 5 * 3600; // 05:00
      stations.forEach((sid, i) => {
        if (i > 0) {
          const seg = line.segments.find(sg =>
            (sg.from === stations[i - 1] && sg.to === sid) || (sg.to === stations[i - 1] && sg.from === sid));
          t += seg ? seg.seconds : 120;
        }
        timeRows.push([tripId, hms(t), hms(t), 'm-' + sid, i + 1, 0, 0]);
      });
      freqRows.push([tripId, '05:00:00', '23:00:00', 5 * 60, 0]);
    });
  });

  /* bus */
  model.routeOrder.forEach(rid => {
    const r = model.routes[rid];
    routeRows.push([
      'bus-' + rid, 'RCRC', rid, r.name.ar + ' / ' + r.name.en, 3,
      r.color.replace('#', ''), 'FFFFFF',
      r.type + ' — ' + r.stopCount + ' stops, ' + round(r.lengthM / 1000, 1) + ' km'
    ]);
    Object.keys(r.dirs).forEach(dir => {
      const d = r.dirs[dir];
      if (dir === 'r') return; // synthetic reverse of a one-way shape
      const shapeId = 'sh-b-' + rid + '-' + dir;
      emitShape(shapeId, d.shape);
      const tripId = 'bus-' + rid + '-d' + dir;
      const headsign = model.stops[d.stops[d.stops.length - 1]].name.ar;
      tripRows.push(['bus-' + rid, 'ALL', tripId, headsign, dir === '2' ? 1 : 0, shapeId]);
      let t = 5 * 3600;
      d.stops.forEach((sid, i) => {
        if (i > 0) {
          const seg = d.segments[i - 1];
          t += seg ? seg.seconds : 90;
        }
        timeRows.push([tripId, hms(t), hms(t), sid, i + 1, 0, 0]);
      });
      freqRows.push([tripId, '05:00:00', '23:00:00', Math.round(r.headwayMin * 60), 0]);
    });
  });

  files['routes.txt'] = csv(routeRows);
  files['trips.txt'] = csv(tripRows);
  files['stop_times.txt'] = csv(timeRows);
  files['frequencies.txt'] = csv(freqRows);
  files['shapes.txt'] = csv(shapeRows);
  files['calendar.txt'] = csv([
    ['service_id', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'start_date', 'end_date'],
    ['ALL', 1, 1, 1, 1, 1, 1, 1, start, end]
  ]);

  const transferRows = [['from_stop_id', 'to_stop_id', 'transfer_type', 'min_transfer_time']];
  Object.keys(model.stationStops).forEach(sid => {
    model.stationStops[sid].forEach(x => {
      if (x.distanceM > 500) return;
      const sec = Math.round(x.distanceM / (4.5 / 3.6));
      transferRows.push(['m-' + sid, x.stop, 2, sec]);
      transferRows.push([x.stop, 'm-' + sid, 2, sec]);
    });
  });
  files['transfers.txt'] = csv(transferRows);

  files['fare_attributes.txt'] = csv([
    ['fare_id', 'price', 'currency_type', 'payment_method', 'transfers', 'agency_id', 'transfer_duration'],
    ['single', 4.00, 'SAR', 0, '', 'RCRC', 7200]
  ]);
  const fareRows = [['fare_id', 'route_id']];
  routeRows.slice(1).forEach(r => fareRows.push(['single', r[0]]));
  files['fare_rules.txt'] = csv(fareRows);

  files['feed_info.txt'] = csv([
    ['feed_publisher_name', 'feed_publisher_url', 'feed_lang', 'feed_start_date', 'feed_end_date', 'feed_version'],
    ['Riyadh Metro Navigator (community)', 'https://github.com/engmohammeda/RiyadhMetro-', 'ar', start, end, (opts.version || '2026.10')]
  ]);

  const entries = Object.keys(files).map(name => ({ name, data: files[name], date }));
  return { zip: createZip(entries), counts: {
    stops: stopRows.length - 1,
    routes: routeRows.length - 1,
    trips: tripRows.length - 1,
    stopTimes: timeRows.length - 1,
    shapes: Object.keys(shapeIds).length
  } };
}

module.exports = {
  busStopsGeoJson, busRoutesGeoJson, districtsGeoJson, parkAndRideGeoJson,
  busStopsCsv, busRoutesCsv, districtCsv, gtfs, hms, csv
};

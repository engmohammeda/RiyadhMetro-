/*
 * Riyadh Metro Navigator — src/node/exports.js
 * Tabular / GPS exports: CSV (Google My Maps, Sheets, Excel) and GPX (Google Earth, OsmAnd, Garmin…).
 */
'use strict';
const links = require('../links');
const { escapeXml: esc } = require('../kml');

function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** Stations CSV — column names chosen so Google My Maps auto-detects latitude/longitude and the title. */
function stationsCsv(network) {
  const header = ['id', 'name_ar', 'name_en', 'latitude', 'longitude', 'lines', 'line_names_en', 'interchange',
    'structure', 'bus_hub', 'park_and_ride', 'google_maps', 'google_earth'];
  const rows = [header.join(',')];
  network.lineOrder.forEach(lid => {
    // emit stations in line order; interchanges only once (first line they appear on)
    network.lines[lid].stations.forEach(id => {
      const s = network.stations[id];
      if (s.lines[0] !== lid) return;
      rows.push([
        s.id, s.name.ar, s.name.en, s.lat.toFixed(6), s.lng.toFixed(6), s.lines.join(';'),
        s.lines.map(l => network.lines[l].name.en).join('; '), s.interchange ? 'yes' : 'no',
        s.lines.map(l => (s.structure[l] || '')).join(';'), s.busHub ? 'yes' : 'no', s.parkAndRide ? 'yes' : 'no',
        links.googleMapsPlace(s.lat, s.lng), links.googleEarth(s.lat, s.lng)
      ].map(csvCell).join(','));
    });
  });
  return '\uFEFF' + rows.join('\r\n') + '\r\n'; // BOM so Excel opens Arabic correctly
}

/** Line-stop sequence CSV (one row per station per line — like GTFS stop_times order). */
function lineStopsCsv(network) {
  const rows = ['line_id,line_name_en,line_name_ar,sequence,station_id,name_ar,name_en,latitude,longitude,structure,distance_from_prev_m,est_seconds_from_prev,cumulative_m'];
  network.lineOrder.forEach(lid => {
    const line = network.lines[lid];
    let cum = 0;
    line.stations.forEach((id, i) => {
      const s = network.stations[id];
      const sg = i > 0 ? line.segments[i - 1] : null;
      if (sg) cum += sg.distanceM;
      rows.push([lid, line.name.en, line.name.ar, i + 1, id, s.name.ar, s.name.en, s.lat.toFixed(6), s.lng.toFixed(6),
        s.structure[lid] || '', sg ? sg.distanceM : 0, sg ? sg.seconds : 0, cum].map(csvCell).join(','));
    });
  });
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

function gpx(network) {
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx version="1.1" creator="Riyadh Metro Navigator" xmlns="http://www.topografix.com/GPX/1/1" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
    'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n' +
    '<metadata><name>مترو الرياض • Riyadh Metro</name><desc>All lines (tracks) and stations (waypoints). Unofficial community project.</desc>' +
    '<time>' + network.generatedAt + '</time></metadata>\n';
  Object.keys(network.stations).forEach(id => {
    const s = network.stations[id];
    x += '<wpt lat="' + s.lat.toFixed(6) + '" lon="' + s.lng.toFixed(6) + '"><name>' + esc(s.name.ar + ' • ' + s.name.en) + '</name>' +
      '<desc>' + esc(s.lines.map(l => network.lines[l].name.en).join(' + ') + (s.interchange ? ' (interchange)' : '')) + '</desc>' +
      '<sym>' + (s.interchange ? 'Transit Station' : 'Pin, Blue') + '</sym><type>metro_station</type></wpt>\n';
  });
  network.lineOrder.forEach(lid => {
    const line = network.lines[lid];
    x += '<trk><name>' + esc(line.number + ' — ' + line.name.ar + ' • ' + line.name.en) + '</name><type>metro</type>' +
      '<extensions><color>' + esc(line.color) + '</color></extensions><trkseg>' +
      line.shape.map(p => '<trkpt lat="' + p[0].toFixed(6) + '" lon="' + p[1].toFixed(6) + '"/>').join('') +
      '</trkseg></trk>\n';
  });
  return x + '</gpx>\n';
}

/** Destinations CSV — nearest station + walking distance, importable into Google My Maps as its own layer. */
function placesCsv(network) {
  const header = ['id', 'name_ar', 'name_en', 'category', 'latitude', 'longitude', 'nearest_station_id', 'nearest_station_ar', 'nearest_station_en',
    'nearest_station_lines', 'walk_m', 'walk_min', 'approximate', 'google_maps'];
  const rows = [header.join(',')];
  (network.placeOrder || []).forEach(pid => {
    const p = network.places[pid], st = network.stations[p.station], n = p.nearest[0];
    rows.push([
      p.id, p.name.ar, p.name.en, p.category, p.lat.toFixed(6), p.lng.toFixed(6), st.id, st.name.ar, st.name.en,
      st.lines.join(';'), n.distanceM, n.walkMinutes, p.approx ? 'yes' : 'no', links.googleMapsPlace(p.lat, p.lng)
    ].map(csvCell).join(','));
  });
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

module.exports = { stationsCsv, lineStopsCsv, placesCsv, gpx };

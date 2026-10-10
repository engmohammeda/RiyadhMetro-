/*
 * Riyadh Metro Navigator — geojson.js
 * GeoJSON (RFC 7946) exports with simplestyle-spec properties so GitHub, geojson.io, QGIS,
 * Mapbox/MapLibre and the Google Maps Data layer render them with the right colours.
 *
 * UMD: `require('./geojson')` in Node, `window.RMGeoJson` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./links'));
  else root.RMGeoJson = factory(root.RMLinks);
})(typeof self !== 'undefined' ? self : this, function (links) {
  'use strict';

  function lngLat(p) { return [Number(p[1].toFixed(6)), Number(p[0].toFixed(6))]; }

  function lineFeature(network, line) {
    return {
      type: 'Feature',
      id: 'line-' + line.id,
      properties: {
        kind: 'line',
        id: line.id,
        number: line.number,
        name_ar: line.name.ar,
        name_en: line.name.en,
        color: line.color,
        corridor_ar: line.corridor.ar,
        corridor_en: line.corridor.en,
        official_length_km: line.officialLengthKm,
        computed_length_km: Number((line.lengthM / 1000).toFixed(2)),
        station_count: line.stations.length,
        from: line.termini.first,
        to: line.termini.last,
        stations: line.stations.slice(),
        opened_on: line.openedOn || null,
        stroke: line.color,
        'stroke-width': 5,
        'stroke-opacity': 0.95
      },
      geometry: { type: 'LineString', coordinates: line.shape.map(lngLat) }
    };
  }

  function stationFeature(network, s) {
    var first = network.lines[s.lines[0]];
    return {
      type: 'Feature',
      id: 'station-' + s.id,
      properties: {
        kind: 'station',
        id: s.id,
        name_ar: s.name.ar,
        name_en: s.name.en,
        lines: s.lines.slice(),
        line_names_en: s.lines.map(function (l) { return network.lines[l].name.en; }),
        interchange: s.interchange,
        bus_hub: s.busHub,
        park_and_ride: s.parkAndRide,
        structure: s.structure,
        google_maps: links.googleMapsPlace(s.lat, s.lng),
        google_earth: links.googleEarth(s.lat, s.lng),
        'marker-color': s.interchange ? '#222222' : first.color,
        'marker-size': s.interchange ? 'large' : 'medium',
        'marker-symbol': 'rail-metro'
      },
      geometry: { type: 'Point', coordinates: lngLat([s.lat, s.lng]) }
    };
  }

  function segmentFeature(network, line, sg, i) {
    return {
      type: 'Feature',
      id: 'segment-' + line.id + '-' + i,
      properties: {
        kind: 'segment', line: line.id, from: sg.from, to: sg.to,
        distance_m: sg.distanceM, est_seconds: sg.seconds,
        stroke: line.color, 'stroke-width': 4
      },
      geometry: { type: 'LineString', coordinates: sg.geometry.map(lngLat) }
    };
  }

  /** @param what 'all' | 'lines' | 'stations' | 'segments' */
  function placeFeature(network, p) {
    var st = network.stations[p.station], n = p.nearest[0];
    var cat = (network.placeCategories || {})[p.category] || {};
    return {
      type: 'Feature', id: 'place-' + p.id,
      properties: {
        kind: 'place', id: p.id, name: p.name.en, name_ar: p.name.ar, name_en: p.name.en,
        category: p.category, category_en: cat.en || p.category, approximate: !!p.approx,
        nearest_station: st.id, nearest_station_en: st.name.en, nearest_station_ar: st.name.ar,
        nearest_station_lines: st.lines.join(';'), walk_m: n.distanceM, walk_min: n.walkMinutes,
        'marker-color': '#6b7280', 'marker-size': 'small', 'marker-symbol': 'marker'
      },
      geometry: { type: 'Point', coordinates: lngLat([p.lat, p.lng]) }
    };
  }

  function networkGeoJson(network, what) {
    what = what || 'all';
    var features = [];
    if (what === 'places') (network.placeOrder || []).forEach(function (id) { features.push(placeFeature(network, network.places[id])); });
    if (what === 'all' || what === 'lines') network.lineOrder.forEach(function (l) { features.push(lineFeature(network, network.lines[l])); });
    if (what === 'segments') network.lineOrder.forEach(function (l) { network.lines[l].segments.forEach(function (sg, i) { features.push(segmentFeature(network, network.lines[l], sg, i)); }); });
    if (what === 'all' || what === 'stations') Object.keys(network.stations).forEach(function (id) { features.push(stationFeature(network, network.stations[id])); });
    return {
      type: 'FeatureCollection',
      name: 'Riyadh Metro — ' + what,
      metadata: { generated: network.generatedAt, crs: 'EPSG:4326', source: 'Riyadh public-transport open route data; unofficial community project' },
      features: features
    };
  }

  function routeGeoJson(network, it) {
    var features = [];
    it.legs.forEach(function (leg, i) {
      var line = network.lines[leg.line];
      features.push({
        type: 'Feature', id: 'leg-' + i,
        properties: { kind: 'leg', index: i, line: leg.line, line_name_en: line.name.en, from: leg.from, to: leg.to,
          direction: leg.direction, stops: leg.stops, distance_m: leg.distanceM, est_minutes: leg.minutes,
          stroke: line.color, 'stroke-width': 7 },
        geometry: { type: 'LineString', coordinates: leg.geometry.map(lngLat) }
      });
    });
    it.stations.forEach(function (id, i) {
      var f = stationFeature(network, network.stations[id]);
      f.id = 'route-station-' + i;
      f.properties.role = id === it.from ? 'origin' : id === it.to ? 'destination' :
        it.transfers.some(function (t) { return t.station === id; }) ? 'transfer' : 'pass';
      features.push(f);
    });
    return { type: 'FeatureCollection', name: 'Riyadh Metro route ' + it.from + ' → ' + it.to,
      properties: { from: it.from, to: it.to, total_minutes: it.totalMinutes, stops: it.stops, transfers: it.transferCount, distance_m: it.totalDistanceM },
      features: features };
  }

  return { networkGeoJson: networkGeoJson, routeGeoJson: routeGeoJson, lineFeature: lineFeature, stationFeature: stationFeature, placeFeature: placeFeature };
});

/*
 * Riyadh Metro Navigator — network.js
 * Turns the raw datasets (data/stations.json, data/lines.json, data/shapes.json, data/config.json)
 * into a routable network model:
 *   - every line alignment is oriented first → last station,
 *   - every station is snapped onto its line(s) so the alignment can be cut into
 *     inter-station segments (real track geometry for highlighting / KML export),
 *   - segment distances & estimated run times, transfer penalties, line termini.
 *
 * UMD: `require('./network')` in Node, `window.RMNetwork` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geo'));
  else root.RMNetwork = factory(root.RMGeo);
})(typeof self !== 'undefined' ? self : this, function (geo) {
  'use strict';

  var DEFAULT_MODEL = { cruiseKmh: 65, stopPenaltySec: 50, transferMinutes: 5, transferOverrides: [], walkingKmh: 4.5 };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /** Estimated run time (seconds) for one inter-station hop. */
  function segmentSeconds(distanceM, model) {
    return distanceM / (model.cruiseKmh / 3.6) + model.stopPenaltySec;
  }

  /**
   * Build the network.
   * @param {{stations:object, lines:object, shapes:object, config?:object}} data raw datasets
   * @returns network model
   */
  function buildNetwork(data) {
    var model = Object.assign({}, DEFAULT_MODEL, (data.config && data.config.travelModel) || {});
    var stations = {};
    var stationList = (data.stations.stations || data.stations);
    stationList.forEach(function (s) {
      stations[s.id] = {
        id: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        lines: [],
        structure: {},
        busHub: !!s.busHub,
        parkAndRide: !!s.parkAndRide,
        operatorStopId: s.operatorStopId || null,
        aliases: s.aliases || null
      };
    });

    var lines = {};
    var lineOrder = [];
    var shapes = data.shapes.shapes || data.shapes;

    (data.lines.lines || data.lines).forEach(function (l) {
      var ids = l.stations.map(function (st) { return st.station; });
      ids.forEach(function (id, i) {
        if (!stations[id]) throw new Error('Line ' + l.id + ' references unknown station "' + id + '"');
        if (stations[id].lines.indexOf(l.id) < 0) stations[id].lines.push(l.id);
        stations[id].structure[l.id] = l.stations[i].structure || null;
      });

      var shape = clone(shapes[l.id]);
      if (!shape || shape.length < 2) throw new Error('Missing shape for line ' + l.id);

      // Orient the alignment from the first to the last station.
      var first = stations[ids[0]], last = stations[ids[ids.length - 1]];
      var pFirst = geo.projectOnPolyline([first.lat, first.lng], shape);
      var pLast = geo.projectOnPolyline([last.lat, last.lng], shape);
      if (pFirst.along > pLast.along) shape.reverse();
      var cum = geo.cumulativeDistances(shape);

      // Snap every station in order; constrain the search window so loops/back-tracks keep order.
      var projections = [];
      var startIdx = 0;
      ids.forEach(function (id, i) {
        var s = stations[id];
        var pr = geo.projectOnPolyline([s.lat, s.lng], shape, startIdx, cum);
        if (i > 0 && pr.along < projections[i - 1].along) {
          throw new Error('Station order/alignment mismatch on line ' + l.id + ' at ' + id);
        }
        projections.push(pr);
        startIdx = pr.index;
      });

      var segments = [];
      for (var i = 1; i < ids.length; i++) {
        var geom = geo.slicePolyline(shape, projections[i - 1], projections[i]);
        var dist = projections[i].along - projections[i - 1].along;
        segments.push({
          from: ids[i - 1],
          to: ids[i],
          distanceM: Math.round(dist),
          seconds: Math.round(segmentSeconds(dist, model)),
          geometry: geom
        });
      }

      lines[l.id] = {
        id: l.id,
        number: l.number,
        color: l.color,
        name: l.name,
        colorName: l.colorName,
        corridor: l.corridor,
        officialLengthKm: l.officialLengthKm,
        openedOn: l.openedOn,
        stations: ids,
        termini: { first: ids[0], last: ids[ids.length - 1] },
        shape: shape,
        lengthM: Math.round(cum[cum.length - 1]),
        segments: segments,
        snapOffsets: projections.map(function (p) { return Math.round(p.offset); })
      };
      lineOrder.push(l.id);
    });

    // Interchange flags + transfer penalties
    var transfers = [];
    Object.keys(stations).forEach(function (id) {
      var s = stations[id];
      s.interchange = s.lines.length > 1;
      for (var a = 0; a < s.lines.length; a++) {
        for (var b = 0; b < s.lines.length; b++) {
          if (a === b) continue;
          transfers.push({ station: id, from: s.lines[a], to: s.lines[b], minutes: transferMinutes(id, s.lines[a], s.lines[b], model) });
        }
      }
    });

    var network = {
      // A pinned build time (scripts/build.js) keeps exports byte-identical so
      // "stale artefacts" can be told apart from "you forgot to commit".
      generatedAt: data.buildTime || new Date().toISOString(),
      params: model,
      stations: stations,
      lines: lines,
      lineOrder: lineOrder,
      transfers: transfers,
      config: data.config || {},
      places: {},
      placeOrder: [],
      placeCategories: {}
    };
    if (data.places) attachPlaces(network, data.places);
    return network;
  }

  /**
   * Attach destinations (data/places.json) to the network, resolving each one to its
   * nearest stations (straight-line distance + walking time). A place may pin a
   * `station` explicitly (it is listed first); up to 3 candidates are kept.
   */
  function attachPlaces(network, placesData) {
    var list = placesData.places || placesData;
    var walkKmh = (network.params && network.params.walkingKmh) || 4.5;
    network.placeCategories = placesData.categories || {};
    network.places = {};
    network.placeOrder = [];
    list.forEach(function (p) {
      var near = nearestStations(network, p.lat, p.lng, 3).map(function (n) {
        return { station: n.station.id, distanceM: n.distanceM, walkMinutes: Math.max(1, Math.round(n.distanceM / (walkKmh * 1000 / 60))) };
      });
      if (p.station && network.stations[p.station]) {
        var st = network.stations[p.station];
        var d = Math.round(geo.haversine([p.lat, p.lng], [st.lat, st.lng]));
        near = [{ station: p.station, distanceM: d, walkMinutes: Math.max(1, Math.round(d / (walkKmh * 1000 / 60))) }]
          .concat(near.filter(function (n) { return n.station !== p.station; })).slice(0, 3);
      }
      network.places[p.id] = {
        id: p.id, name: p.name, aliases: p.aliases || null, category: p.category || 'landmark',
        lat: p.lat, lng: p.lng, approx: p.approx !== false, nearest: near, station: near[0].station
      };
      network.placeOrder.push(p.id);
    });
    return network;
  }

  function transferMinutes(stationId, lineA, lineB, model) {
    var ov = (model.transferOverrides || []).find(function (o) {
      return o.station === stationId && o.lines.indexOf(lineA) >= 0 && o.lines.indexOf(lineB) >= 0;
    });
    return ov ? ov.minutes : model.transferMinutes;
  }

  /** Index of a station on a line (or -1). */
  function indexOnLine(network, lineId, stationId) {
    return network.lines[lineId].stations.indexOf(stationId);
  }

  /** Segment between two adjacent stations of a line (either direction). Geometry oriented from → to. */
  function segmentBetween(network, lineId, fromId, toId) {
    var line = network.lines[lineId];
    for (var i = 0; i < line.segments.length; i++) {
      var sg = line.segments[i];
      if (sg.from === fromId && sg.to === toId) return sg;
      if (sg.from === toId && sg.to === fromId) {
        return { from: fromId, to: toId, distanceM: sg.distanceM, seconds: sg.seconds, geometry: sg.geometry.slice().reverse() };
      }
    }
    return null;
  }

  /** Stations sorted by straight-line distance from a point. */
  function nearestStations(network, lat, lng, limit) {
    var out = Object.keys(network.stations).map(function (id) {
      var s = network.stations[id];
      return { station: s, distanceM: Math.round(geo.haversine([lat, lng], [s.lat, s.lng])) };
    });
    out.sort(function (a, b) { return a.distanceM - b.distanceM; });
    return out.slice(0, limit || 5);
  }

  /** Simple multilingual search over station names (prefix/substring, diacritics-insensitive for Arabic). */
  function normalizeText(t) {
    return String(t || '')
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0640]/g, '')         // Arabic diacritics & tatweel
      .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  }

  function scoreTexts(texts, q) {
    var score = 0;
    texts.forEach(function (txt, i) {
      if (!txt) return;
      var w = i < 3 ? 1 : 0.9;              // aliases score slightly lower than the official names
      if (txt === q) score = Math.max(score, 100 * w);
      else if (txt.indexOf(q) === 0) score = Math.max(score, 80 * w);
      else if (txt.split(' ').some(function (x) { return x.indexOf(q) === 0; })) score = Math.max(score, 60 * w);
      else if (txt.indexOf(q) >= 0) score = Math.max(score, 40 * w);
    });
    return score;
  }
  function searchTexts(item, id) {
    var t = [normalizeText(item.name.en), normalizeText(item.name.ar), id.replace(/-/g, ' ')];
    if (item.aliases) {
      (item.aliases.en || []).concat(item.aliases.ar || []).forEach(function (a) { t.push(normalizeText(a)); });
    }
    return t;
  }

  /** Station search (names, ids and aliases such as old/sponsor names). */
  function searchStations(network, query, limit) {
    var q = normalizeText(query);
    if (!q) return [];
    var scored = [];
    Object.keys(network.stations).forEach(function (id) {
      var s = network.stations[id];
      var score = scoreTexts(searchTexts(s, id), q);
      if (score) scored.push({ station: s, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score || a.station.name.en.localeCompare(b.station.name.en); });
    return scored.slice(0, limit || 8).map(function (x) { return x.station; });
  }

  /**
   * Search stations and places together.
   * @returns [{ kind: 'station'|'place', id, item, station (id to route from/to), score }]
   */
  function searchAll(network, query, limit) {
    var q = normalizeText(query);
    if (!q) return [];
    var scored = [];
    Object.keys(network.stations).forEach(function (id) {
      var s = network.stations[id];
      var score = scoreTexts(searchTexts(s, id), q);
      if (score) scored.push({ kind: 'station', id: id, item: s, station: id, score: score + 1 });
    });
    Object.keys(network.places || {}).forEach(function (id) {
      var p = network.places[id];
      var score = scoreTexts(searchTexts(p, id), q);
      if (score) scored.push({ kind: 'place', id: id, item: p, station: p.station, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score || a.item.name.en.localeCompare(b.item.name.en); });
    return scored.slice(0, limit || 8);
  }

  return {
    buildNetwork: buildNetwork,
    segmentSeconds: segmentSeconds,
    transferMinutes: transferMinutes,
    indexOnLine: indexOnLine,
    segmentBetween: segmentBetween,
    nearestStations: nearestStations,
    attachPlaces: attachPlaces,
    searchStations: searchStations,
    searchAll: searchAll,
    normalizeText: normalizeText
  };
});

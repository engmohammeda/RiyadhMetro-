/*
 * Riyadh Metro Navigator — transit.js
 * Multimodal public-transport model and journey planner for Riyadh:
 * metro (6 lines, 83 stations) + Riyadh Bus (88 routes, 3,010 stops) + walking.
 *
 * Graph
 *   nodes   m:<stationId>            metro station (all lines at that station share the node)
 *           b:<stopId>               bus stop
 *           o: / d:                  virtual origin / destination (created per query)
 *   edges   metro ride   adjacent stations on a line, cost = run time
 *           bus ride     adjacent stops along a route direction, cost = run time
 *           walk         stop ↔ stop (≤ 400 m) and stop ↔ metro station (≤ 500 m)
 *
 * Boarding a vehicle adds half its headway (waiting) + a small boarding penalty; changing
 * route/line adds the transfer penalty. Dijkstra therefore optimises door-to-door time
 * including waiting, not just in-vehicle time.
 *
 * UMD: `require('./transit')` in Node, `window.RMTransit` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geo'), require('./network'));
  else root.RMTransit = factory(root.RMGeo, root.RMNetwork);
})(typeof self !== 'undefined' ? self : this, function (geo, netLib) {
  'use strict';

  var DEFAULTS = {
    commercialKmh: { brt: 24, main: 21, sector: 18, community: 16 },
    headwayMinutes: { brt: 7, main: 12, sector: 18, community: 25 },
    walkTransferMaxM: 400,
    metroWalkMaxM: 500,
    sameStopTransferMinutes: 1,
    metroTransferMinutes: 5,
    boardingPenaltyMinutes: 1,
    walkingKmh: 4.5,
    metroWaitMinutes: 3
  };

  var TRANSFER_PENALTY_FEWEST = 45 * 60; // seconds

  function cfg(model, key) {
    var b = (model.config && model.config.busModel) || {};
    return b[key] != null ? b[key] : DEFAULTS[key];
  }

  /* ─────────────────────────────────────────────────────── text normalisation */
  function normalize(t) {
    return String(t == null ? '' : t)
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0640]/g, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
      .replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ')
      .trim();
  }

  function scoreTexts(texts, q) {
    var best = 0;
    texts.forEach(function (txt, i) {
      if (!txt) return;
      var w = i < 2 ? 1 : 0.85;
      if (txt === q) best = Math.max(best, 100 * w);
      else if (txt.indexOf(q) === 0) best = Math.max(best, 85 * w);
      else if (txt.split(' ').some(function (x) { return x.indexOf(q) === 0; })) best = Math.max(best, 65 * w);
      else if (txt.indexOf(q) >= 0) best = Math.max(best, 45 * w);
    });
    return best;
  }

  /* ───────────────────────────────────────────────────────────── spatial grid */
  function Grid(cellDeg) {
    this.cell = cellDeg || 0.005; // ~550 m
    this.buckets = {};
  }
  Grid.prototype.key = function (lat, lng) {
    return Math.floor(lat / this.cell) + ',' + Math.floor(lng / this.cell);
  };
  Grid.prototype.add = function (item) {
    var k = this.key(item.lat, item.lng);
    (this.buckets[k] = this.buckets[k] || []).push(item);
  };
  Grid.prototype.near = function (lat, lng, radiusM) {
    var dLat = radiusM / 110540, dLng = radiusM / (111320 * Math.cos(lat * Math.PI / 180) || 1);
    var out = [];
    var i0 = Math.floor((lat - dLat) / this.cell), i1 = Math.floor((lat + dLat) / this.cell);
    var j0 = Math.floor((lng - dLng) / this.cell), j1 = Math.floor((lng + dLng) / this.cell);
    for (var i = i0; i <= i1; i++) {
      for (var j = j0; j <= j1; j++) {
        var b = this.buckets[i + ',' + j];
        if (b) out.push.apply(out, b);
      }
    }
    return out;
  };

  /* ──────────────────────────────────────────────────────────── build model */
  function build(input) {
    var network = input.network;
    var bus = input.bus || {};
    var config = input.config || (network && network.config) || {};
    var model = {
      network: network,
      config: config,
      stops: {},
      stopOrder: [],
      routes: {},
      routeOrder: [],
      districts: {},
      districtOrder: [],
      places: (network && network.places) || {},
      placeOrder: (network && network.placeOrder) || [],
      stationStops: {},
      stopRoutes: {},
      parkAndRide: { sites: [], byStation: {} },
      stopGrid: new Grid(0.004),
      stationGrid: new Grid(0.01),
      index: [],
      stats: {}
    };
    var bm = config.busModel || {};
    var headway = bm.headwayMinutes || DEFAULTS.headwayMinutes;
    var kmh = bm.commercialKmh || DEFAULTS.commercialKmh;

    /* stops */
    (bus.stops && bus.stops.stops || []).forEach(function (s) {
      var rec = {
        id: s.id,
        code: s.code,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        shelter: s.shelter,
        stage: s.stage,
        operating: s.operating,
        district: s.district || null,
        districtApprox: !!s.districtApprox,
        nearMetro: s.nearMetro || null,
        routes: []
      };
      model.stops[rec.id] = rec;
      model.stopOrder.push(rec.id);
      model.stopGrid.add({ id: rec.id, lat: rec.lat, lng: rec.lng });
    });

    /* routes + per-direction segments */
    (bus.routes && bus.routes.routes || []).forEach(function (r) {
      var route = {
        id: r.id,
        number: r.number,
        type: r.type,
        color: r.color,
        name: r.name,
        origin: r.origin,
        destination: r.destination,
        loop: !!r.loop,
        headwayMin: r.headwayMin || headway[r.type] || 15,
        speedKmh: r.speedKmh || kmh[r.type] || 18,
        lengthM: r.lengthM,
        stopCount: r.stopCount,
        uniqueStops: r.uniqueStops,
        plannedStops: r.plannedStops,
        brtStops: r.brtStops,
        directions: r.directions || [],
        bidirectional: !!r.bidirectional,
        runtimeMin: r.runtimeMin,
        stage: r.stage,
        stops: r.stops || [],
        dirs: {},
        segments: {}
      };
      var shapes = (bus.shapes && bus.shapes.shapes) || {};
      route.directions.forEach(function (dir) {
        var d = r.dirs[String(dir)];
        if (!d) return;
        var shape = shapes[d.shape];
        if (!shape || shape.length < 2) return;
        var cum = geo.cumulativeDistances(shape);
        var shapeLen = cum[cum.length - 1];
        var fullLen = d.shapeLengthM || shapeLen;
        // Distances/run-times come pre-computed from the full-resolution alignment
        // (scripts/import-transit.js). Here we only need display geometry: map every
        // stop's along-distance on the full alignment onto the simplified polyline.
        var srcSegs = d.segments || [];
        var secPerM = 1 / ((route.speedKmh || 18) / 3.6);
        var alongs = d.along || [];
        var pts = alongs.map(function (a) {
          return geo.pointAtAlong(shape, cum, fullLen ? (a / fullLen) * shapeLen : 0);
        });
        var segs = srcSegs.map(function (sg, i) {
          var geometry;
          var a = pts[i], b = pts[i + 1];
          if (a && b && b.along >= a.along) geometry = geo.slicePolyline(shape, a, b);
          if (!geometry || geometry.length < 2) {
            var pa = model.stops[sg.from], pb = model.stops[sg.to];
            geometry = [[pa.lat, pa.lng], [pb.lat, pb.lng]];
          }
          return {
            from: sg.from, to: sg.to,
            meters: sg.meters != null ? sg.meters : Math.round(Math.max(0, (b ? b.along : 0) - (a ? a.along : 0))),
            seconds: sg.seconds != null ? sg.seconds : Math.round(Math.max(0, (b ? b.along : 0) - (a ? a.along : 0)) * secPerM),
            geometry: geometry
          };
        });
        route.dirs[dir] = {
          shape: shape,
          stops: d.stops.slice(),
          lengthM: d.lengthM,
          segments: segs
        };
        route.segments[dir] = segs;
        // a single published alignment usually serves both directions
        if ((r.directions || []).length === 1) {
          var rev = segs.map(function (s) {
            return { from: s.to, to: s.from, meters: s.meters, seconds: s.seconds, geometry: s.geometry.slice().reverse() };
          }).reverse();
          route.dirs['r'] = { shape: shape.slice().reverse(), stops: route.dirs[dir].stops.slice().reverse(), lengthM: d.lengthM, segments: rev };
          route.segments['r'] = rev;
        }
      });
      model.routes[route.id] = route;
      model.routeOrder.push(route.id);
      route.stops.forEach(function (sid) {
        if (!model.stops[sid]) return;
        model.stops[sid].routes.push(route.id);
      });
    });
    model.routeOrder.sort(function (a, b) { return (model.routes[a].number || 0) - (model.routes[b].number || 0); });
    Object.keys(model.stops).forEach(function (id) {
      model.stops[id].routes = Array.from(new Set(model.stops[id].routes)).sort(function (a, b) { return (+a) - (+b); });
    });

    /* districts */
    ((input.districts && input.districts.districts) || []).forEach(function (d) {
      model.districts[d.id] = {
        id: d.id,
        name: d.name,
        approx: !!d.approx,
        centroid: d.centroid,
        bbox: d.bbox,
        geometry: d.geometry,
        stops: d.stops || 0,
        routes: d.routes || [],
        brtStops: d.brtStops || 0,
        plannedStops: d.plannedStops || 0
      };
      model.districtOrder.push(d.id);
    });
    model.districtOrder.sort(function (a, b) {
      return model.districts[b].stops - model.districts[a].stops;
    });

    /* metro grid + station ↔ bus index */
    var st = network ? network.stations : {};
    Object.keys(st).forEach(function (id) {
      model.stationGrid.add({ id: id, lat: st[id].lat, lng: st[id].lng });
      model.stationStops[id] = [];
    });
    var metroMax = (config.busModel && config.busModel.metroWalkMaxM) || DEFAULTS.metroWalkMaxM;
    model.stopOrder.forEach(function (sid) {
      var s = model.stops[sid];
      model.stationGrid.near(s.lat, s.lng, metroMax).forEach(function (m) {
        var station = st[m.id];
        if (!station) return;
        var d = geo.haversine([s.lat, s.lng], [station.lat, station.lng]);
        if (d <= metroMax) model.stationStops[m.id].push({ stop: sid, distanceM: Math.round(d) });
      });
    });
    Object.keys(model.stationStops).forEach(function (id) {
      model.stationStops[id].sort(function (a, b) { return a.distanceM - b.distanceM; });
    });

    /* park & ride */
    var pr = input.parkAndRide || {};
    (pr.sites || []).forEach(function (site) {
      if (!st[site.station]) return;
      var rec = Object.assign({}, site, {
        name: st[site.station].name,
        lat: st[site.station].lat,
        lng: st[site.station].lng
      });
      model.parkAndRide.sites.push(rec);
      model.parkAndRide.byStation[site.station] = rec;
    });
    model.parkAndRide.summary = pr.summary || null;
    model.parkAndRide.rules = pr.rules || null;
    model.parkAndRide.busParking = pr.busParking || null;

    /* search index */
    Object.keys(st).forEach(function (id) {
      var s = st[id];
      model.index.push({
        kind: 'station', id: id, lat: s.lat, lng: s.lng, name: s.name, lines: s.lines,
        texts: [normalize(s.name.ar), normalize(s.name.en), normalize(id.replace(/-/g, ' '))]
          .concat(((s.aliases && (s.aliases.ar || []).concat(s.aliases.en || [])) || []).map(normalize))
      });
    });
    model.stopOrder.forEach(function (id) {
      var s = model.stops[id];
      var base = baseName(s.name);
      model.index.push({
        kind: 'stop', id: id, lat: s.lat, lng: s.lng, name: s.name, district: s.district, routes: s.routes,
        texts: [normalize(s.name.ar), normalize(s.name.en), normalize(base.ar), normalize(base.en), normalize(s.code)]
      });
    });
    model.routeOrder.forEach(function (id) {
      var r = model.routes[id];
      model.index.push({
        kind: 'route', id: id, name: r.name, number: r.number, type: r.type,
        texts: [normalize('خط ' + r.id), normalize('bus ' + r.id), normalize('route ' + r.id),
          normalize(r.name.ar), normalize(r.name.en), normalize(r.origin.ar + ' ' + r.destination.ar),
          normalize(r.origin.en + ' ' + r.destination.en)]
      });
    });
    model.districtOrder.forEach(function (id) {
      var d = model.districts[id];
      model.index.push({
        kind: 'district', id: id, name: d.name, lat: d.centroid[0], lng: d.centroid[1], stops: d.stops,
        texts: [normalize(d.name.ar), normalize(d.name.en), normalize(id.replace(/-/g, ' '))]
      });
    });
    model.placeOrder.forEach(function (id) {
      var p = model.places[id];
      model.index.push({
        kind: 'place', id: id, lat: p.lat, lng: p.lng, name: p.name, station: p.station,
        texts: [normalize(p.name.ar), normalize(p.name.en)].concat(((p.aliases && (p.aliases.ar || []).concat(p.aliases.en || [])) || []).map(normalize))
      });
    });

    model.stats = {
      routes: model.routeOrder.length,
      stops: model.stopOrder.length,
      stations: Object.keys(st).length,
      districts: model.districtOrder.length,
      brtStops: model.stopOrder.filter(function (id) { return model.stops[id].shelter === 'brt'; }).length,
      operatingStops: model.stopOrder.filter(function (id) { return model.stops[id].operating !== false; }).length,
      parkAndRide: model.parkAndRide.sites.length,
      routeStops: model.routeOrder.reduce(function (n, id) { return n + model.routes[id].stopCount; }, 0)
    };
    return model;
  }

  function baseName(name) {
    var en = String(name.en || '').replace(/\s+\d+\s*[A-Za-z]?\s*$/, '').trim();
    var ar = String(name.ar || '').replace(/\s+\d+\s*[A-Za-zأ-ي]?\s*$/, '').trim();
    return { en: en || name.en, ar: ar || name.ar };
  }

  /* ───────────────────────────────────────────────────────────── search API */
  function search(model, query, limit) {
    var q = normalize(query);
    if (!q) return [];
    var out = [];
    model.index.forEach(function (item) {
      var sc = scoreTexts(item.texts, q);
      if (!sc) return;
      if (item.kind === 'stop') sc += 0.5;
      if (item.kind === 'route' && /^\d+$/.test(q)) {
        if (String(item.number) === q) sc = Math.max(sc, 120);
        else if (String(item.number).indexOf(q) === 0) sc = Math.max(sc, 70);
      }
      out.push({ score: sc, item: item });
    });
    out.sort(function (a, b) {
      return b.score - a.score || (a.item.kind === 'station' ? -1 : 0) - (b.item.kind === 'station' ? -1 : 0);
    });
    return out.slice(0, limit || 12).map(function (x) { return x.item; });
  }

  /** Nearest boarding points to a coordinate, mixed metro + bus, with walk times. */
  function nearby(model, lat, lng, limit, maxM) {
    var walkKmh = cfg(model, 'walkingKmh');
    var out = [];
    model.stopGrid.near(lat, lng, maxM || 900).forEach(function (b) {
      var s = model.stops[b.id];
      var d = geo.haversine([lat, lng], [s.lat, s.lng]);
      if (d <= (maxM || 900)) out.push({ kind: 'stop', id: b.id, item: s, distanceM: Math.round(d), walkMinutes: Math.max(1, Math.round(d / (walkKmh * 1000 / 60))) });
    });
    model.stationGrid.near(lat, lng, maxM || 900).forEach(function (b) {
      var s = model.network.stations[b.id];
      var d = geo.haversine([lat, lng], [s.lat, s.lng]);
      if (d <= (maxM || 900)) out.push({ kind: 'station', id: b.id, item: s, distanceM: Math.round(d), walkMinutes: Math.max(1, Math.round(d / (walkKmh * 1000 / 60))) });
    });
    out.sort(function (a, b) { return a.distanceM - b.distanceM; });
    return out.slice(0, limit || 8);
  }

  /* ──────────────────────────────────────────────────────────── graph build */
  function buildGraph(model, opts) {
    opts = opts || {};
    var modes = opts.modes || ['metro', 'bus', 'walk'];
    var allowMetro = modes.indexOf('metro') >= 0;
    var allowBus = modes.indexOf('bus') >= 0;
    var allowWalk = modes.indexOf('walk') >= 0;
    var adj = Object.create(null);
    function add(u, v, edge) { (adj[u] = adj[u] || []).push(edge); }

    /* metro ride edges */
    if (allowMetro) {
      model.network.lineOrder.forEach(function (lid) {
        var line = model.network.lines[lid];
        line.segments.forEach(function (sg) {
          var meta = { line: lid, from: sg.from, to: sg.to, segment: sg };
          add('m:' + sg.from, 'm:' + sg.to, { to: 'm:' + sg.to, cost: sg.seconds, kind: 'metro', board: 'L' + lid, meta: meta });
          add('m:' + sg.to, 'm:' + sg.from, { to: 'm:' + sg.from, cost: sg.seconds, kind: 'metro', board: 'L' + lid, meta: { line: lid, from: sg.to, to: sg.from, segment: sg } });
        });
      });
    }

    /* bus ride edges */
    if (allowBus) {
      model.routeOrder.forEach(function (rid) {
        var r = model.routes[rid];
        Object.keys(r.dirs).forEach(function (dir) {
          r.dirs[dir].segments.forEach(function (sg) {
            var meta = { route: rid, dir: dir, from: sg.from, to: sg.to, segment: sg };
            add('b:' + sg.from, 'b:' + sg.to, { to: 'b:' + sg.to, cost: sg.seconds, kind: 'bus', board: 'B' + rid, meta: meta });
          });
        });
      });
    }

    /* walking transfers */
    if (allowWalk) {
      var maxStop = cfg(model, 'walkTransferMaxM');
      var maxMetro = cfg(model, 'metroWalkMaxM');
      var walkSec = function (m) { return m / (cfg(model, 'walkingKmh') / 3.6); };
      model.stopOrder.forEach(function (sid) {
        var s = model.stops[sid];
        var seen = {};
        model.stopGrid.near(s.lat, s.lng, maxStop).forEach(function (b) {
          if (b.id === sid || seen[b.id]) return;
          var o = model.stops[b.id];
          var d = geo.haversine([s.lat, s.lng], [o.lat, o.lng]);
          if (d > maxStop) return;
          seen[b.id] = true;
          add('b:' + sid, 'b:' + b.id, { to: 'b:' + b.id, cost: walkSec(d), kind: 'walk', board: null, meta: { from: sid, to: b.id, meters: Math.round(d), kind: 'stop-stop' } });
          add('b:' + b.id, 'b:' + sid, { to: 'b:' + sid, cost: walkSec(d), kind: 'walk', board: null, meta: { from: b.id, to: sid, meters: Math.round(d), kind: 'stop-stop' } });
        });
        if (allowMetro) {
          model.stationGrid.near(s.lat, s.lng, maxMetro).forEach(function (st) {
            var station = model.network.stations[st.id];
            if (!station) return;
            var dm = geo.haversine([s.lat, s.lng], [station.lat, station.lng]);
            if (dm > maxMetro) return;
            add('b:' + sid, 'm:' + st.id, { to: 'm:' + st.id, cost: walkSec(dm), kind: 'walk', board: null, meta: { from: sid, to: st.id, meters: Math.round(dm), kind: 'stop-station' } });
            add('m:' + st.id, 'b:' + sid, { to: 'b:' + sid, cost: walkSec(dm), kind: 'walk', board: null, meta: { from: st.id, to: sid, meters: Math.round(dm), kind: 'station-stop' } });
          });
        }
      });
    }
    return adj;
  }

  /* ───────────────────────────────────────────────────────────────── heap */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (x) {
    var a = this.a; a.push(x);
    var i = a.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      var t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a;
    if (!a.length) return null;
    var top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      var i = 0;
      for (;;) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < a.length && a[l].cost < a[m].cost) m = l;
        if (r < a.length && a[r].cost < a[m].cost) m = r;
        if (m === i) break;
        var t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  };

  /* ───────────────────────────────────────────────────────────── planning */
  function refNode(model, ref) {
    if (!ref) return null;
    if (ref.kind === 'station' && model.network.stations[ref.id]) return { node: 'm:' + ref.id, lat: model.network.stations[ref.id].lat, lng: model.network.stations[ref.id].lng, name: model.network.stations[ref.id].name };
    if (ref.kind === 'stop' && model.stops[ref.id]) return { node: 'b:' + ref.id, lat: model.stops[ref.id].lat, lng: model.stops[ref.id].lng, name: model.stops[ref.id].name };
    if (ref.kind === 'place' && model.places[ref.id]) return { node: null, lat: model.places[ref.id].lat, lng: model.places[ref.id].lng, name: model.places[ref.id].name };
    if (ref.lat != null && ref.lng != null) return { node: null, lat: +ref.lat, lng: +ref.lng, name: ref.name || null };
    return null;
  }

  function walkSeconds(model, m) { return m / (cfg(model, 'walkingKmh') / 3.6); }

  /**
   * Plan a journey.
   * @param {object} model
   * @param {object} from  {kind:'station'|'stop'|'place'|'coord', id?, lat?, lng?, name?}
   * @param {object} to    same
   * @param {{mode?:'fastest'|'fewest-transfers', modes?:string[], maxWalkM?:number}} [opts]
   */
  function plan(model, from, to, opts) {
    opts = opts || {};
    opts.modes = opts.modes || ['metro', 'bus', 'walk'];
    var mode = opts.mode || 'fastest';
    var maxWalk = opts.maxWalkM || 1200;
    var A = refNode(model, from), B = refNode(model, to);
    if (!A || !B) return null;

    /* trivial case: same boarding point or a very short walk */
    if (A.node && A.node === B.node) return walkOnly(model, A, B, mode);
    var direct = geo.haversine([A.lat, A.lng], [B.lat, B.lng]);
    if (!A.node && !B.node && direct < 250) return walkOnly(model, A, B, mode);

    var cacheKey = opts.modes.slice().sort().join(',');
    model._graphs = model._graphs || {};
    var graph = model._graphs[cacheKey] || (model._graphs[cacheKey] = buildGraph(model, opts));
    var adj = Object.assign(Object.create(null), graph);
    var oNode = 'o:', dNode = 'd:';
    adj[oNode] = [];
    adj[dNode] = [];

    var startTargets = [], endTargets = [];
    if (A.node) startTargets.push({ node: A.node, meters: 0 });
    else nearby(model, A.lat, A.lng, 12, maxWalk).forEach(function (n) {
      startTargets.push({ node: (n.kind === 'station' ? 'm:' : 'b:') + n.id, meters: n.distanceM });
    });
    if (B.node) endTargets.push({ node: B.node, meters: 0 });
    else nearby(model, B.lat, B.lng, 12, maxWalk).forEach(function (n) {
      endTargets.push({ node: (n.kind === 'station' ? 'm:' : 'b:') + n.id, meters: n.distanceM });
    });
    if (!startTargets.length || !endTargets.length) return null;
    startTargets.forEach(function (t) {
      adj[oNode].push({ to: t.node, cost: walkSeconds(model, t.meters), kind: 'walk', board: null, meta: { virtual: 'origin', meters: t.meters } });
    });
    endTargets.forEach(function (t) {
      adj[t.node] = (adj[t.node] || []).concat([{ to: dNode, cost: walkSeconds(model, t.meters), kind: 'walk', board: null, meta: { virtual: 'destination', meters: t.meters } }]);
    });

    /* Dijkstra over (node, board) states */
    var dist = Object.create(null), prev = Object.create(null);
    var heap = new Heap();
    var startKey = oNode + '|';
    dist[startKey] = 0;
    heap.push({ node: oNode, board: '', cost: 0 });
    var endKey = null;
    var guard = 0;
    while (heap.a.length && guard++ < 500000) {
      var cur = heap.pop();
      var curKey = cur.node + '|' + cur.board;
      if (cur.cost > dist[curKey] + 1e-6) continue;
      if (cur.node === dNode) { endKey = curKey; break; }
      var edges = adj[cur.node] || [];
      for (var i = 0; i < edges.length; i++) {
        var e = edges[i];
        var nb = e.kind === 'walk' ? '' : (e.board || '');
        var extra = 0;
        if (e.kind !== 'walk' && cur.board !== nb) {
          extra = boardCost(model, nb);
          if (cur.board) {
            extra += cfg(model, 'sameStopTransferMinutes') * 60;
            if (mode === 'fewest-transfers') extra += TRANSFER_PENALTY_FEWEST;
          }
        }
        var nextKey = e.to + '|' + nb;
        var nc = cur.cost + e.cost + extra;
        if (dist[nextKey] === undefined || nc < dist[nextKey]) {
          dist[nextKey] = nc;
          prev[nextKey] = { key: curKey, node: cur.node, edge: e };
          heap.push({ node: e.to, board: nb, cost: nc });
        }
      }
    }
    if (!endKey) return null;

    var chain = [];
    var k = endKey;
    while (k && prev[k]) {
      chain.unshift({ from: prev[k].node, edge: prev[k].edge });
      k = prev[k].key;
    }
    return buildItinerary(model, chain, A, B, mode, opts);
  }

  function boardCost(model, board) {
    if (!board) return 0;
    var mins;
    if (board[0] === 'L') {
      mins = (model.config && model.config.travelModel && model.config.travelModel.initialWaitMinutes) || DEFAULTS.metroWaitMinutes;
    } else {
      var r = model.routes[board.slice(1)];
      mins = r ? r.headwayMin / 2 : 8;
    }
    return mins * 60 + cfg(model, 'boardingPenaltyMinutes') * 60;
  }

  function walkOnly(model, A, B, mode) {
    var meters = Math.round(geo.haversine([A.lat, A.lng], [B.lat, B.lng]));
    var seconds = Math.round(walkSeconds(model, meters));
    var leg = {
      type: 'walk', fromName: A.name, toName: B.name, meters: meters,
      minutes: Math.max(1, Math.round(seconds / 60)), seconds: seconds,
      geometry: [[A.lat, A.lng], [B.lat, B.lng]], virtual: 'direct'
    };
    return {
      mode: mode, from: A, to: B, originName: A.name, destinationName: B.name, legs: [leg],
      transfers: 0, boardings: 0, rideSeconds: 0, walkSeconds: seconds, waitSeconds: 0,
      totalSeconds: seconds, totalMinutes: leg.minutes, walkMinutes: leg.minutes, rideMinutes: 0,
      waitMinutes: 0, totalDistanceM: meters, fare: 0, modes: []
    };
  }

  function nameOf(model, nodeId) {
    if (!nodeId) return null;
    if (nodeId.indexOf('m:') === 0) {
      var s = model.network.stations[nodeId.slice(2)];
      return s ? s.name : null;
    }
    if (nodeId.indexOf('b:') === 0) {
      var b = model.stops[nodeId.slice(2)];
      return b ? b.name : null;
    }
    return null;
  }
  function pointOf(model, nodeId) {
    if (!nodeId) return null;
    if (nodeId.indexOf('m:') === 0) {
      var s = model.network.stations[nodeId.slice(2)];
      return s ? [s.lat, s.lng] : null;
    }
    if (nodeId.indexOf('b:') === 0) {
      var b = model.stops[nodeId.slice(2)];
      return b ? [b.lat, b.lng] : null;
    }
    return null;
  }

  function buildItinerary(model, chain, A, B, mode, opts) {
    var walkKmh = cfg(model, 'walkingKmh');
    var legs = [];
    var cur = null;

    chain.forEach(function (step) {
      var e = step.edge, from = step.from;
      if (e.kind === 'walk') {
        cur = null;
        var virtual = e.meta && e.meta.virtual;
        var fromName = virtual === 'origin' ? (A.name || { ar: 'موقعك', en: 'Your location' }) : nameOf(model, from);
        var toName = virtual === 'destination' ? (B.name || { ar: 'وجهتك', en: 'Your destination' }) : nameOf(model, e.to);
        var p0 = virtual === 'origin' ? [A.lat, A.lng] : pointOf(model, from);
        var p1 = virtual === 'destination' ? [B.lat, B.lng] : pointOf(model, e.to);
        if (!p0 || !p1) { p0 = p0 || p1; p1 = p1 || p0; }
        var meters = Math.round(e.meta && e.meta.meters != null ? e.meta.meters : geo.haversine(p0, p1));
        legs.push({
          type: 'walk', fromName: fromName, toName: toName, fromNode: from, toNode: e.to,
          meters: meters, seconds: Math.round(walkSeconds(model, meters)),
          minutes: Math.max(1, Math.round(walkSeconds(model, meters) / 60)),
          geometry: [p0, p1], virtual: virtual || null
        });
        return;
      }
      if (e.kind === 'metro') {
        var lid = e.meta.line;
        var line = model.network.lines[lid];
        if (!cur || cur.type !== 'metro' || cur.line !== lid) {
          cur = {
            type: 'metro', line: lid, color: line.color, name: line.name,
            stations: [e.meta.from], stops: 0, seconds: 0, meters: 0, geometry: [],
            waitMinutes: Math.round(((model.config.travelModel || {}).initialWaitMinutes || DEFAULTS.metroWaitMinutes))
          };
          legs.push(cur);
        }
        cur.stations.push(e.meta.to);
        cur.stops++;
        cur.seconds += e.cost;
        cur.meters += e.meta.segment.distanceM;
        appendGeometry(cur.geometry, e.meta.segment.geometry);
        return;
      }
      if (e.kind === 'bus') {
        var rid = e.meta.route, dir = e.meta.dir;
        if (!cur || cur.type !== 'bus' || cur.route !== rid || cur.dir !== dir) {
          var route = model.routes[rid];
          cur = {
            type: 'bus', route: rid, color: route.color, name: route.name, routeType: route.type,
            stopsIds: [e.meta.from], stops: 0, seconds: 0, meters: 0, geometry: [],
            waitMinutes: Math.round(route.headwayMin / 2), dir: dir
          };
          legs.push(cur);
        }
        cur.stopsIds.push(e.meta.to);
        cur.stops++;
        cur.seconds += e.cost;
        cur.meters += e.meta.segment.meters;
        appendGeometry(cur.geometry, e.meta.segment.geometry);
      }
    });

    /* merge chained pedestrian edges (origin → stop → … → station) into one walk leg,
       and drop sub-25 m access hops that only add noise */
    var merged = [];
    legs.forEach(function (leg) {
      if (leg.type === 'walk' && leg.meters < 25) return;
      var last = merged[merged.length - 1];
      if (last && last.type === 'walk' && leg.type === 'walk') {
        last.meters += leg.meters;
        last.seconds += leg.seconds;
        last.geometry = (last.geometry || []).concat(leg.geometry || []);
        last.toName = leg.toName;
        last.toNode = leg.toNode;
        last.virtual = null;
      } else merged.push(leg);
    });
    legs = merged;

    var rideSeconds = 0, walkTotal = 0, waitTotal = 0;
    legs.forEach(function (leg) {
      if (leg.type === 'walk') {
        walkTotal += leg.seconds;
        leg.minutes = Math.max(1, Math.round(leg.seconds / 60));
        return;
      }
      rideSeconds += leg.seconds;
      waitTotal += (leg.waitMinutes || 0) * 60;
      leg.minutes = Math.max(1, Math.round(leg.seconds / 60));
      if (leg.type === 'metro') {
        var line = model.network.lines[leg.line];
        var iFrom = line.stations.indexOf(leg.stations[0]);
        var iTo = line.stations.indexOf(leg.stations[leg.stations.length - 1]);
        leg.fromStation = leg.stations[0];
        leg.toStation = leg.stations[leg.stations.length - 1];
        leg.forward = iTo > iFrom;
        leg.direction = leg.forward ? line.termini.last : line.termini.first;
        leg.fromName = line.stations[0] && model.network.stations[leg.fromStation].name;
        leg.toName = model.network.stations[leg.toStation].name;
      } else {
        leg.fromStop = leg.stopsIds[0];
        leg.toStop = leg.stopsIds[leg.stopsIds.length - 1];
        leg.fromName = model.stops[leg.fromStop].name;
        leg.toName = model.stops[leg.toStop].name;
        // direction label: first → last stop of that direction
        var d = model.routes[leg.route].dirs[leg.dir];
        if (d) {
          leg.directionName = {
            ar: model.stops[d.stops[0]].name.ar + ' ← ' + model.stops[d.stops[d.stops.length - 1]].name.ar,
            en: model.stops[d.stops[0]].name.en + ' → ' + model.stops[d.stops[d.stops.length - 1]].name.en
          };
        }
      }
    });

    var vehicleLegs = legs.filter(function (l) { return l.type !== 'walk'; });
    for (var i = 1; i < vehicleLegs.length; i++) {
      var prevLeg = vehicleLegs[i - 1], nextLeg = vehicleLegs[i];
      var between = legs.slice(legs.indexOf(prevLeg) + 1, legs.indexOf(nextLeg));
      var walkM = between.reduce(function (n, l) { return n + (l.meters || 0); }, 0);
      var at = prevLeg.type === 'metro' ? prevLeg.toStation : prevLeg.toStop;
      var atName = prevLeg.type === 'metro' ? model.network.stations[at].name : model.stops[at].name;
      prevLeg.transferTo = {
        type: nextLeg.type,
        id: nextLeg.type === 'metro' ? nextLeg.line : nextLeg.route,
        name: nextLeg.name, at: at, atName: atName, walkM: walkM
      };
    }

    var totalSeconds = rideSeconds + walkTotal + waitTotal;
    var fare = 4;
    try {
      var t = (model.config.fares || {}).tickets || [];
      if (t.length) fare = t[0].price;
    } catch (err) { /* keep default */ }
    var firstVehicle = vehicleLegs[0];
    var lastVehicle = vehicleLegs[vehicleLegs.length - 1];
    return {
      mode: mode,
      from: A, to: B,
      originName: A.name || (legs[0] && legs[0].fromName) || null,
      destinationName: B.name || (legs[legs.length - 1] && legs[legs.length - 1].toName) || null,
      firstVehicle: firstVehicle ? { type: firstVehicle.type, id: firstVehicle.line || firstVehicle.route, name: firstVehicle.name, stopName: firstVehicle.fromName, station: firstVehicle.fromStation || firstVehicle.fromStop } : null,
      lastVehicle: lastVehicle ? { type: lastVehicle.type, id: lastVehicle.line || lastVehicle.route, name: lastVehicle.name, stopName: lastVehicle.toName, station: lastVehicle.toStation || lastVehicle.toStop } : null,
      legs: legs,
      transfers: Math.max(0, vehicleLegs.length - 1),
      boardings: vehicleLegs.length,
      rideSeconds: rideSeconds,
      walkSeconds: walkTotal,
      waitSeconds: waitTotal,
      totalSeconds: totalSeconds,
      totalMinutes: Math.max(1, Math.round(totalSeconds / 60)),
      walkMinutes: Math.round(walkTotal / 60),
      rideMinutes: Math.round(rideSeconds / 60),
      waitMinutes: Math.round(waitTotal / 60),
      totalDistanceM: legs.reduce(function (n, l) { return n + (l.meters || 0); }, 0),
      fare: fare,
      modes: Array.from(new Set(vehicleLegs.map(function (l) { return l.type; })))
    };
  }

  function appendGeometry(target, pts) {
    (pts || []).forEach(function (p) {
      var last = target[target.length - 1];
      if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) target.push(p);
    });
  }

  /** Compare strategies: fastest, fewest transfers, then each single mode. */
  function alternatives(model, from, to, opts) {
    opts = opts || {};
    var out = [];
    var modes = opts.modes || ['metro', 'bus', 'walk'];
    function add(it) {
      if (!it) return;
      if (!it.legs.some(function (l) { return l.type !== 'walk'; })) return;   // pure stroll, not an option
      if (out.some(function (x) { return signature(x) === signature(it); })) return;
      out.push(it);
    }
    add(plan(model, from, to, Object.assign({}, opts, { mode: 'fastest' })));
    add(plan(model, from, to, Object.assign({}, opts, { mode: 'fewest-transfers' })));
    if (modes.length > 2) {
      if (modes.indexOf('metro') >= 0) add(plan(model, from, to, Object.assign({}, opts, { mode: 'fastest', modes: ['metro', 'walk'] })));
      if (modes.indexOf('bus') >= 0) add(plan(model, from, to, Object.assign({}, opts, { mode: 'fastest', modes: ['bus', 'walk'] })));
    }
    return out;
  }
  function signature(it) {
    return it.legs.filter(function (l) { return l.type !== 'walk'; }).map(function (l) {
      return l.type + ':' + (l.line || l.route) + ':' + (l.fromStation || l.fromStop) + '>' + (l.toStation || l.toStop);
    }).join(',');
  }

  /* ─────────────────────────────────────────────────────────── UI helpers */
  function stopRoutes(model, stopId) {
    var s = model.stops[stopId];
    return s ? s.routes.map(function (rid) { return model.routes[rid]; }) : [];
  }
  function stationStopList(model, stationId) {
    return (model.stationStops[stationId] || []).map(function (x) {
      return { stop: model.stops[x.stop], distanceM: x.distanceM };
    });
  }
  function routeShape(model, routeId, dir) {
    var r = model.routes[routeId];
    if (!r) return [];
    var d = r.dirs[dir != null ? dir : r.directions[0]];
    return d ? d.shape : [];
  }
  function districtStops(model, districtId) {
    return model.stopOrder.filter(function (id) { return model.stops[id].district === districtId; })
      .map(function (id) { return model.stops[id]; });
  }
  /** Count of bus routes that stop within 450 m of every metro station. */
  function interchangeRanking(model) {
    return Object.keys(model.network.stations).map(function (id) {
      var stops = model.stationStops[id] || [];
      var routes = {};
      stops.forEach(function (x) {
        model.stops[x.stop].routes.forEach(function (r) { routes[r] = true; });
      });
      return {
        station: model.network.stations[id],
        stops: stops.length,
        routes: Object.keys(routes).length,
        routeIds: Object.keys(routes).sort(function (a, b) { return (+a) - (+b); }),
        nearestM: stops.length ? stops[0].distanceM : null
      };
    }).sort(function (a, b) { return b.routes - a.routes || b.stops - a.stops; });
  }

  return {
    build: build,
    plan: plan,
    alternatives: alternatives,
    search: search,
    nearby: nearby,
    stopRoutes: stopRoutes,
    stationStopList: stationStopList,
    routeShape: routeShape,
    districtStops: districtStops,
    interchangeRanking: interchangeRanking,
    baseName: baseName,
    normalize: normalize,
    DEFAULTS: DEFAULTS
  };
});

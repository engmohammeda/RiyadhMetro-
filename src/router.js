/*
 * Riyadh Metro Navigator — router.js
 * Journey planner over the network model (see network.js).
 *
 * Graph: one node per (station, line) pair.
 *   ride edges     : adjacent stations on the same line, cost = estimated seconds
 *   transfer edges : same station, different line, cost = transfer minutes (+ big penalty in
 *                    "fewest-transfers" mode so Dijkstra minimises interchanges first)
 *
 * UMD: `require('./router')` in Node, `window.RMRouter` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./network'));
  else root.RMRouter = factory(root.RMNetwork);
})(typeof self !== 'undefined' ? self : this, function (net) {
  'use strict';

  var TRANSFER_MODE_PENALTY = 3 * 3600; // seconds added per transfer in fewest-transfers mode

  /* ---------- tiny binary heap ---------- */
  function Heap() { this.a = []; }
  Heap.prototype.push = function (item) {
    var a = this.a; a.push(item);
    var i = a.length - 1;
    while (i > 0) {
      var p = (i - 1) >> 1;
      if (a[p].cost <= a[i].cost) break;
      var t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  };
  Heap.prototype.pop = function () {
    var a = this.a;
    if (!a.length) return undefined;
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
  Heap.prototype.size = function () { return this.a.length; };

  /* ---------- graph ---------- */
  function buildGraph(network, mode) {
    var adj = {};
    function add(u, v, cost, kind, meta) {
      (adj[u] = adj[u] || []).push({ to: v, cost: cost, kind: kind, meta: meta });
    }
    network.lineOrder.forEach(function (lid) {
      var line = network.lines[lid];
      line.segments.forEach(function (sg) {
        add(sg.from + '|' + lid, sg.to + '|' + lid, sg.seconds, 'ride', sg);
        add(sg.to + '|' + lid, sg.from + '|' + lid, sg.seconds, 'ride', sg);
      });
    });
    network.transfers.forEach(function (t) {
      var penalty = mode === 'fewest-transfers' ? TRANSFER_MODE_PENALTY : 0;
      add(t.station + '|' + t.from, t.station + '|' + t.to, t.minutes * 60 + penalty, 'transfer', t);
    });
    return adj;
  }

  /**
   * Plan a journey.
   * @param network  model from RMNetwork.buildNetwork
   * @param fromId   origin station id
   * @param toId     destination station id
   * @param {{mode?: 'fastest'|'fewest-transfers'}} [opts]
   */
  function planRoute(network, fromId, toId, opts) {
    opts = opts || {};
    var mode = opts.mode || 'fastest';
    var from = network.stations[fromId], to = network.stations[toId];
    if (!from) throw new Error('Unknown origin station: ' + fromId);
    if (!to) throw new Error('Unknown destination station: ' + toId);
    if (fromId === toId) return emptyItinerary(network, fromId, mode);

    var adj = buildGraph(network, mode);
    var dist = {}, prev = {}, prevEdge = {};
    var heap = new Heap();
    from.lines.forEach(function (lid) {
      var n = fromId + '|' + lid;
      dist[n] = 0; heap.push({ node: n, cost: 0 });
    });
    var targets = {};
    to.lines.forEach(function (lid) { targets[toId + '|' + lid] = true; });

    var end = null;
    while (heap.size()) {
      var cur = heap.pop();
      if (cur.cost > dist[cur.node]) continue;
      if (targets[cur.node]) { end = cur.node; break; }
      (adj[cur.node] || []).forEach(function (e) {
        var nc = cur.cost + e.cost;
        if (dist[e.to] === undefined || nc < dist[e.to]) {
          dist[e.to] = nc; prev[e.to] = cur.node; prevEdge[e.to] = e;
          heap.push({ node: e.to, cost: nc });
        }
      });
    }
    if (!end) return null; // disconnected (should not happen on this network)

    // Reconstruct node path
    var path = [], edges = [];
    for (var n = end; n; n = prev[n]) { path.unshift(n); if (prevEdge[n]) edges.unshift(prevEdge[n]); }
    return buildItinerary(network, path, edges, mode);
  }

  function emptyItinerary(network, id, mode) {
    return { mode: mode, from: id, to: id, legs: [], transfers: [], totalSeconds: 0, totalMinutes: 0, rideSeconds: 0,
      transferSeconds: 0, totalDistanceM: 0, stops: 0, transferCount: 0, stations: [id] };
  }

  function buildItinerary(network, path, edges, mode) {
    var legs = [], transfers = [];
    var curLeg = null;
    function nodeStation(n) { return n.split('|')[0]; }
    function nodeLine(n) { return n.split('|')[1]; }

    for (var i = 0; i < edges.length; i++) {
      var e = edges[i], u = path[i], v = path[i + 1];
      if (e.kind === 'ride') {
        var lid = nodeLine(u);
        if (!curLeg || curLeg.line !== lid) {
          curLeg = { type: 'ride', line: lid, stations: [nodeStation(u)], distanceM: 0, seconds: 0, geometry: [] };
          legs.push(curLeg);
        }
        var seg = net.segmentBetween(network, lid, nodeStation(u), nodeStation(v));
        curLeg.stations.push(nodeStation(v));
        curLeg.distanceM += seg.distanceM;
        curLeg.seconds += seg.seconds;
        appendGeometry(curLeg.geometry, seg.geometry);
      } else {
        var t = e.meta;
        transfers.push({ station: t.station, fromLine: t.from, toLine: t.to, minutes: t.minutes });
        curLeg = null;
      }
    }

    // Decorate legs with direction (terminus towards which the train travels) and counts
    legs.forEach(function (leg) {
      var line = network.lines[leg.line];
      var iFrom = line.stations.indexOf(leg.stations[0]);
      var iTo = line.stations.indexOf(leg.stations[leg.stations.length - 1]);
      leg.from = leg.stations[0];
      leg.to = leg.stations[leg.stations.length - 1];
      leg.forward = iTo > iFrom;
      leg.direction = leg.forward ? line.termini.last : line.termini.first;
      leg.stops = leg.stations.length - 1;
      leg.minutes = Math.round(leg.seconds / 60);
    });

    var rideSeconds = legs.reduce(function (a, l) { return a + l.seconds; }, 0);
    var transferSeconds = transfers.reduce(function (a, t) { return a + t.minutes * 60; }, 0);
    var stationsVisited = [];
    legs.forEach(function (l) { l.stations.forEach(function (s) { if (stationsVisited[stationsVisited.length - 1] !== s) stationsVisited.push(s); }); });

    return {
      mode: mode,
      from: path.length ? path[0].split('|')[0] : null,
      to: path.length ? path[path.length - 1].split('|')[0] : null,
      legs: legs,
      transfers: transfers,
      rideSeconds: rideSeconds,
      transferSeconds: transferSeconds,
      totalSeconds: rideSeconds + transferSeconds,
      totalMinutes: Math.round((rideSeconds + transferSeconds) / 60),
      totalDistanceM: legs.reduce(function (a, l) { return a + l.distanceM; }, 0),
      stops: legs.reduce(function (a, l) { return a + l.stops; }, 0),
      transferCount: transfers.length,
      stations: stationsVisited
    };
  }

  function appendGeometry(target, pts) {
    pts.forEach(function (p) {
      var last = target[target.length - 1];
      if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) target.push(p);
    });
  }

  /** Fastest + fewest-transfers; returns distinct options (fastest first). */
  function planAlternatives(network, fromId, toId) {
    var fastest = planRoute(network, fromId, toId, { mode: 'fastest' });
    var fewest = planRoute(network, fromId, toId, { mode: 'fewest-transfers' });
    var out = [];
    if (fastest) out.push(fastest);
    if (fewest && (!fastest || signature(fewest) !== signature(fastest))) out.push(fewest);
    return out;
  }

  function signature(it) {
    return it.legs.map(function (l) { return l.line + ':' + l.from + '>' + l.to; }).join(',');
  }

  /* ---------- text rendering (shared by CLI + web) ---------- */
  /** Arabic counted nouns: 1 → "محطة واحدة", 2 → "محطتان", 3–10 → "n محطات", 11+ → "n محطة". */
  function arCount(n, forms) {
    if (n === 1) return forms.one;
    if (n === 2) return forms.two;
    if (n >= 3 && n <= 10) return n + ' ' + forms.few;
    return n + ' ' + forms.many;
  }
  var AR_STATIONS = { one: 'محطة واحدة', two: 'محطتان', few: 'محطات', many: 'محطة' };
  var AR_TRANSFERS = { one: 'تبديل واحد', two: 'تبديلان', few: 'تبديلات', many: 'تبديل' };
  var AR_MINUTES = { one: 'دقيقة واحدة', two: 'دقيقتان', few: 'دقائق', many: 'دقيقة' };

  function enCount(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  var T = {
    ar: {
      board: function (line, dir, stops, mins) { return 'اركب ' + line + ' باتجاه «' + dir + '» — ' + arCount(stops, AR_STATIONS) + ' (' + arCount(mins, AR_MINUTES) + ' تقريباً)'; },
      alight: function (st) { return 'انزل في محطة «' + st + '»'; },
      transfer: function (st, line, mins) { return 'بدّل في محطة «' + st + '» إلى ' + line + ' (' + arCount(mins, AR_MINUTES) + ' للتبديل)'; },
      summary: function (mins, stops, tr) { return 'المدة التقديرية ' + arCount(mins, AR_MINUTES) + ' • ' + arCount(stops, AR_STATIONS) + ' • ' + (tr ? arCount(tr, AR_TRANSFERS) : 'بدون تبديل'); },
      same: 'نقطة البداية والنهاية هي نفس المحطة.',
      start: function (st) { return 'ابدأ من محطة «' + st + '»'; },
      arrive: function (st) { return 'وصلت إلى «' + st + '»'; }
    },
    en: {
      board: function (line, dir, stops, mins) { return 'Board the ' + line + ' towards ' + dir + ' — ' + enCount(stops, 'stop', 'stops') + ' (~' + mins + ' min)'; },
      alight: function (st) { return 'Alight at ' + st; },
      transfer: function (st, line, mins) { return 'Change at ' + st + ' to the ' + line + ' (' + mins + ' min transfer)'; },
      summary: function (mins, stops, tr) { return 'Estimated ' + mins + ' min • ' + enCount(stops, 'stop', 'stops') + ' • ' + (tr ? enCount(tr, 'transfer', 'transfers') : 'no transfers'); },
      same: 'Origin and destination are the same station.',
      start: function (st) { return 'Start at ' + st; },
      arrive: function (st) { return 'Arrive at ' + st; }
    }
  };

  /** Step-by-step instructions as an array of strings. */
  function describeItinerary(network, it, lang) {
    lang = lang === 'en' ? 'en' : 'ar';
    var t = T[lang];
    var name = function (id) { return network.stations[id].name[lang]; };
    var lname = function (id) { return network.lines[id].name[lang]; };
    if (!it.legs.length) return [t.same];
    var out = [t.summary(it.totalMinutes, it.stops, it.transferCount), t.start(name(it.from))];
    it.legs.forEach(function (leg, i) {
      out.push(t.board(lname(leg.line), name(leg.direction), leg.stops, Math.max(1, leg.minutes)));
      if (i < it.legs.length - 1) {
        var tr = it.transfers[i];
        out.push(t.transfer(name(leg.to), lname(it.legs[i + 1].line), tr.minutes));
      } else {
        out.push(t.alight(name(leg.to)));
      }
    });
    out.push(t.arrive(name(it.to)));
    return out;
  }

  return {
    planRoute: planRoute,
    planAlternatives: planAlternatives,
    describeItinerary: describeItinerary,
    buildGraph: buildGraph,
    arCount: arCount,
    AR_FORMS: { stations: AR_STATIONS, transfers: AR_TRANSFERS, minutes: AR_MINUTES },
    TRANSFER_MODE_PENALTY: TRANSFER_MODE_PENALTY
  };
});

/*
 * Riyadh Metro Navigator — geo.js
 * Small, dependency-free geodesy helpers shared by Node (build/tests) and the browser.
 * All points are [lat, lng] arrays in WGS84 degrees; distances are in metres.
 *
 * UMD: `require('./geo')` in Node, `window.RMGeo` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMGeo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EARTH_RADIUS = 6371008.8; // mean Earth radius (m)
  var DEG = Math.PI / 180;

  /** Great-circle distance between two [lat,lng] points, metres. */
  function haversine(a, b) {
    var dLat = (b[0] - a[0]) * DEG;
    var dLng = (b[1] - a[1]) * DEG;
    var la1 = a[0] * DEG;
    var la2 = b[0] * DEG;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** Initial bearing from a to b in degrees (0 = north, clockwise). */
  function bearing(a, b) {
    var la1 = a[0] * DEG, la2 = b[0] * DEG;
    var dLng = (b[1] - a[1]) * DEG;
    var y = Math.sin(dLng) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
    return ((Math.atan2(y, x) / DEG) + 360) % 360;
  }

  /** Total length of a polyline, metres. */
  function polylineLength(line) {
    var d = 0;
    for (var i = 1; i < line.length; i++) d += haversine(line[i - 1], line[i]);
    return d;
  }

  /** Cumulative distance at every vertex. */
  function cumulativeDistances(line) {
    var out = [0];
    for (var i = 1; i < line.length; i++) out.push(out[i - 1] + haversine(line[i - 1], line[i]));
    return out;
  }

  /* Local equirectangular projection around a reference latitude (good to <0.1% over a city). */
  function toLocal(p, refLat) {
    var kx = Math.cos(refLat * DEG) * 111320;
    return [p[1] * kx, p[0] * 110540];
  }

  /**
   * Project a point onto a polyline.
   * @param {number[]} p            [lat,lng]
   * @param {number[][]} line       polyline
   * @param {number} [startIndex=0] only consider segments at or after this index (keeps ordering along loops)
   * @param {number[]} [cum]        cumulative distances (optional cache)
   * @returns {{index:number, t:number, along:number, offset:number, point:number[]}}
   */
  function projectOnPolyline(p, line, startIndex, cum) {
    cum = cum || cumulativeDistances(line);
    startIndex = startIndex || 0;
    var P = toLocal(p, p[0]);
    var best = null;
    for (var i = Math.max(0, startIndex); i < line.length - 1; i++) {
      var A = toLocal(line[i], p[0]);
      var B = toLocal(line[i + 1], p[0]);
      var bx = B[0] - A[0], by = B[1] - A[1];
      var L2 = bx * bx + by * by;
      var t = L2 === 0 ? 0 : ((P[0] - A[0]) * bx + (P[1] - A[1]) * by) / L2;
      t = Math.max(0, Math.min(1, t));
      var qx = A[0] + t * bx, qy = A[1] + t * by;
      var off = Math.hypot(P[0] - qx, P[1] - qy);
      if (!best || off < best.offset) {
        var segLen = cum[i + 1] - cum[i];
        best = {
          index: i,
          t: t,
          along: cum[i] + t * segLen,
          offset: off,
          point: [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])]
        };
      }
    }
    return best;
  }

  /** Point / segment index at a given along-distance (metres) on a polyline. */
  function pointAtAlong(line, cum, target) {
    cum = cum || cumulativeDistances(line);
    var total = cum[cum.length - 1];
    var t = Math.max(0, Math.min(total, target));
    var lo = 0, hi = cum.length - 1;
    while (lo < hi - 1) {
      var mid = (lo + hi) >> 1;
      if (cum[mid] <= t) lo = mid; else hi = mid;
    }
    var segLen = cum[lo + 1] - cum[lo] || 1;
    var f = Math.max(0, Math.min(1, (t - cum[lo]) / segLen));
    var a = line[lo], b = line[lo + 1];
    return {
      index: lo,
      t: f,
      along: t,
      offset: 0,
      point: [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]
    };
  }

  /** Sub-polyline between two projections (from must precede to along the line). */
  function slicePolyline(line, from, to) {
    var out = [from.point];
    for (var i = from.index + 1; i <= to.index; i++) out.push(line[i]);
    out.push(to.point);
    // drop duplicates created when a projection sits exactly on a vertex
    var clean = [out[0]];
    for (var j = 1; j < out.length; j++) {
      var a = clean[clean.length - 1], b = out[j];
      if (Math.abs(a[0] - b[0]) > 1e-9 || Math.abs(a[1] - b[1]) > 1e-9) clean.push(b);
    }
    return clean;
  }

  /** [[minLat,minLng],[maxLat,maxLng]] of a list of points. */
  function boundsOf(points) {
    var b = [[Infinity, Infinity], [-Infinity, -Infinity]];
    points.forEach(function (p) {
      if (p[0] < b[0][0]) b[0][0] = p[0];
      if (p[1] < b[0][1]) b[0][1] = p[1];
      if (p[0] > b[1][0]) b[1][0] = p[0];
      if (p[1] > b[1][1]) b[1][1] = p[1];
    });
    return b;
  }

  function centroid(points) {
    var lat = 0, lng = 0;
    points.forEach(function (p) { lat += p[0]; lng += p[1]; });
    return [lat / points.length, lng / points.length];
  }

  /** Format metres as a short human string (Arabic or English). */
  function formatDistance(m, lang) {
    var ar = lang === 'ar';
    if (m < 950) return Math.round(m / 10) * 10 + (ar ? ' م' : ' m');
    return (m / 1000).toFixed(m < 10000 ? 1 : 0) + (ar ? ' كم' : ' km');
  }

  return {
    EARTH_RADIUS: EARTH_RADIUS,
    haversine: haversine,
    bearing: bearing,
    polylineLength: polylineLength,
    cumulativeDistances: cumulativeDistances,
    projectOnPolyline: projectOnPolyline,
    pointAtAlong: pointAtAlong,
    slicePolyline: slicePolyline,
    boundsOf: boundsOf,
    centroid: centroid,
    formatDistance: formatDistance
  };
});

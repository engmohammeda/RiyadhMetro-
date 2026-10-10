/*
 * Riyadh Metro Navigator — live.js
 * Live GPS companion logic shared by the web app and the Google Maps page.
 *
 * Pure functions (no DOM): given the network, a planned itinerary and the
 * user's current position, computes journey progress: nearest station on the
 * route, remaining stops, the next transfer ahead, distance to the
 * destination, and the alert states (prepare to transfer / prepare to alight
 * / arrived). Thresholds are configurable for testing.
 *
 * UMD: `require('./live')` in Node, `window.RMLive` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geo'));
  else root.RMLive = factory(root.RMGeo);
})(typeof self !== 'undefined' ? self : this, function (geo) {
  'use strict';

  /** Distance (m) to the destination counted as "arrived". */
  var ARRIVE_M = 150;
  /** Distance (m) to the destination that triggers "prepare to alight". */
  var PREPARE_ALIGHT_M = 500;
  /** Distance (m) to the next transfer station that triggers "prepare to transfer". */
  var PREPARE_TRANSFER_M = 450;

  /** Estimated walking minutes for a distance (default speed 4.5 km/h). */
  function walkMinutes(distanceM, kmh) {
    var speed = kmh || 4.5;
    return Math.max(1, Math.round(distanceM / (speed * 1000 / 60)));
  }

  /**
   * Journey progress relative to the user's live position.
   * @param network  model from RMNetwork.buildNetwork
   * @param it       itinerary from RMRouter.planRoute (may be empty)
   * @param lat,lng  current position (WGS84)
   * @param {object} [opts]  { arriveM, prepareAlightM, prepareTransferM }
   * @returns {object|null}
   *   arrived           boolean — within arriveM of the destination station
   *   prepareAlight     boolean — close to the destination, not yet arrived
   *   prepareTransfer   boolean — close to the next transfer ahead
   *   nearestStation    id of the itinerary station closest to the user
   *   nearestDistanceM  distance to that station
   *   remainingStops    stops left after the nearest station (incl. destination)
   *   nextTransfer      { station, fromLine, toLine, minutes } ahead of the user, or null
   *   distanceToTransferM  distance to nextTransfer (null if none)
   *   distanceToEndM    straight-line distance to the destination station
   *   destination       itinerary destination station id
   */
  function statusAt(network, it, lat, lng, opts) {
    if (!it || !it.legs || !it.legs.length) return null;
    opts = opts || {};
    var arriveM = opts.arriveM !== undefined ? opts.arriveM : ARRIVE_M;
    var prepareAlightM = opts.prepareAlightM !== undefined ? opts.prepareAlightM : PREPARE_ALIGHT_M;
    var prepareTransferM = opts.prepareTransferM !== undefined ? opts.prepareTransferM : PREPARE_TRANSFER_M;

    var stations = it.stations;
    var bestIdx = 0, bestD = Infinity;
    for (var i = 0; i < stations.length; i++) {
      var s = network.stations[stations[i]];
      var d = geo.haversine([lat, lng], [s.lat, s.lng]);
      if (d < bestD) { bestD = d; bestIdx = i; }
    }

    var toSt = network.stations[it.to];
    var distToEnd = Math.round(geo.haversine([lat, lng], [toSt.lat, toSt.lng]));
    var arrived = distToEnd <= arriveM;
    var prepareAlight = !arrived && distToEnd <= prepareAlightM;

    // First transfer whose station is at or ahead of the user's nearest itinerary
    // station — so "prepare to transfer" fires on approach and while standing there.
    var nextTransfer = null;
    for (var j = 0; j < (it.transfers || []).length; j++) {
      var idx = stations.indexOf(it.transfers[j].station);
      if (idx >= bestIdx) { nextTransfer = it.transfers[j]; break; }
    }
    var distanceToTransferM = null, prepareTransfer = false;
    if (nextTransfer) {
      var ts = network.stations[nextTransfer.station];
      distanceToTransferM = Math.round(geo.haversine([lat, lng], [ts.lat, ts.lng]));
      prepareTransfer = distanceToTransferM <= prepareTransferM;
    }

    var remainingStops = stations.length - 1 - bestIdx;
    if (remainingStops < 0) remainingStops = 0;

    return {
      arrived: arrived,
      prepareAlight: prepareAlight,
      prepareTransfer: prepareTransfer,
      nearestStation: stations[bestIdx],
      nearestDistanceM: Math.round(bestD),
      remainingStops: remainingStops,
      nextTransfer: nextTransfer,
      distanceToTransferM: distanceToTransferM,
      distanceToEndM: distToEnd,
      destination: it.to
    };
  }

  return {
    ARRIVE_M: ARRIVE_M,
    PREPARE_ALIGHT_M: PREPARE_ALIGHT_M,
    PREPARE_TRANSFER_M: PREPARE_TRANSFER_M,
    statusAt: statusAt,
    walkMinutes: walkMinutes
  };
});

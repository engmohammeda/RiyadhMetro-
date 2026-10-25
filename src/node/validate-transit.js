/*
 * Riyadh Metro Navigator — transit data validation (Node only)
 *
 * Guards the multimodal dataset the same way validate.js guards the metro:
 * everything referenced must exist, every stop must be routable, every polygon
 * must be inside Riyadh, and the generated GTFS must be internally consistent.
 */
'use strict';

const RIYADH_BBOX = [[24.15, 46.15], [25.25, 47.55]];

function inBbox(lat, lng) {
  return lat >= RIYADH_BBOX[0][0] && lat <= RIYADH_BBOX[1][0] && lng >= RIYADH_BBOX[0][1] && lng <= RIYADH_BBOX[1][1];
}

function validateTransit(model, sources) {
  const errors = [];
  const warnings = [];
  const stops = model.stopOrder.map(id => model.stops[id]);
  const routes = model.routeOrder.map(id => model.routes[id]);

  /* stops */
  const seen = new Set();
  const unassigned = [];
  const shortRoutes = [];
  const longGaps = [];
  stops.forEach(s => {
    if (seen.has(s.id)) errors.push('Duplicate stop id ' + s.id);
    seen.add(s.id);
    if (!(s.lat > 0) || !(s.lng > 0)) errors.push('Stop ' + s.id + ' has no coordinates');
    else if (!inBbox(s.lat, s.lng)) warnings.push('Stop ' + s.id + ' lies outside the Riyadh bounding box');
    if (!s.name || !s.name.ar || !s.name.en) errors.push('Stop ' + s.id + ' is missing a bilingual name');
    if (!s.routes.length) unassigned.push(s.id);
  });

  /* routes */
  routes.forEach(r => {
    if (!r.stops.length) errors.push('Route ' + r.id + ' has no stops');
    if (r.stopCount < 2) errors.push('Route ' + r.id + ' has fewer than two stops in its longest direction');
    if (r.stopCount < 6) shortRoutes.push(r.id + '(' + r.stopCount + ')');
    r.stops.forEach(sid => { if (!model.stops[sid]) errors.push('Route ' + r.id + ' references unknown stop ' + sid); });
    const direct = Object.keys(r.dirs);
    if (!direct.length) errors.push('Route ' + r.id + ' has no direction geometry');
    direct.forEach(dir => {
      const d = r.dirs[dir];
      if (!d.segments.length) errors.push('Route ' + r.id + ' direction ' + dir + ' has no segments');
      d.segments.forEach(seg => {
        if (!model.stops[seg.from] || !model.stops[seg.to]) errors.push('Route ' + r.id + ' segment references an unknown stop');
        if (!(seg.meters >= 0)) errors.push('Route ' + r.id + ' has a negative segment length');
        if (seg.meters > 6000) longGaps.push(r.id + '/' + dir + ' ' + (seg.meters / 1000).toFixed(1) + ' km');
      });
    });
    if (!r.directions.length) errors.push('Route ' + r.id + ' has no published direction');
    if (r.stage === 'planned') warnings.push('Route ' + r.id + ' is fully in the planned (post-5.2) stage');
  });

  if (unassigned.length) warnings.push(unassigned.length + ' stops are not assigned to any route in the source (kept as standalone boarding points)');
  if (longGaps.length) warnings.push('Long stretches without a published stop (source gaps): ' + longGaps.join(', '));
  if (shortRoutes.length) warnings.push('Routes with fewer than 6 stops (source may be incomplete): ' + shortRoutes.join(', '));

  /* stop ↔ route agreement */
  let linkageErrors = 0;
  routes.forEach(r => r.stops.forEach(sid => {
    const s = model.stops[sid];
    if (s && s.routes.indexOf(r.id) < 0) linkageErrors++;
  }));
  if (linkageErrors) errors.push(linkageErrors + ' stop↔route links are missing in the stop register');

  /* districts */
  if (model.districtOrder.length < 100) warnings.push('Only ' + model.districtOrder.length + ' districts loaded');
  const noDistrict = stops.filter(s => !s.district).length;
  const approxDistrict = stops.filter(s => s.districtApprox).length;
  if (noDistrict) errors.push(noDistrict + ' stops have no district');
  if (approxDistrict / stops.length > 0.10) warnings.push(approxDistrict + ' stops are assigned to a district by nearest-centre fallback');
  model.districtOrder.forEach(id => {
    const d = model.districts[id];
    if (!d.name || !d.name.ar || !d.name.en) errors.push('District ' + id + ' is missing a bilingual name');
    if (!d.centroid || !inBbox(d.centroid[0], d.centroid[1])) warnings.push('District ' + id + ' centroid is outside Riyadh');
    if (d.stops === 0) warnings.push('District ' + d.name.en + ' has no bus stops');
  });

  /* park & ride */
  model.parkAndRide.sites.forEach(site => {
    if (!model.network.stations[site.station]) errors.push('Park & ride references unknown station ' + site.station);
    if (site.capacity != null && !(site.capacity > 0)) errors.push('Park & ride ' + site.station + ' has an invalid capacity');
  });

  /* metro ↔ bus transfers */
  const stationsWithStops = Object.keys(model.stationStops).filter(id => model.stationStops[id].length).length;
  if (stationsWithStops < 50) warnings.push('Only ' + stationsWithStops + ' metro stations have a bus stop within 500 m');

  const stats = {
    routes: routes.length,
    stops: stops.length,
    stations: Object.keys(model.network.stations).length,
    districts: model.districtOrder.length,
    districtsWithStops: model.districtOrder.filter(id => model.districts[id].stops > 0).length,
    brtRoutes: routes.filter(r => r.type === 'brt').length,
    brtStops: stops.filter(s => s.shelter === 'brt').length,
    operatingStops: stops.filter(s => s.operating !== false).length,
    plannedStops: stops.filter(s => s.operating === false).length,
    routeKm: Math.round(routes.reduce((n, r) => n + r.lengthM, 0) / 1000),
    parkAndRide: model.parkAndRide.sites.length,
    parkAndRideSpaces: model.parkAndRide.sites.reduce((n, s) => n + (s.capacity || 0), 0),
    stationsWithBus: stationsWithStops,
    approxDistrict
  };

  /* reference checks against raw sources */
  if (sources) {
    if (sources.stops && sources.stops.count && sources.stops.count !== stats.stops) {
      errors.push('Stop count mismatch: source ' + sources.stops.count + ' vs model ' + stats.stops);
    }
    if (sources.routes && sources.routes.count && sources.routes.count !== stats.routes) {
      errors.push('Route count mismatch: source ' + sources.routes.count + ' vs model ' + stats.routes);
    }
  }

  return { ok: errors.length === 0, errors, warnings, stats };
}

module.exports = { validateTransit, RIYADH_BBOX };

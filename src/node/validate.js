/*
 * Riyadh Metro Navigator — src/node/validate.js
 * Data-integrity checks run by `npm run validate`, the build and the test-suite.
 */
'use strict';

const RIYADH_BBOX = { minLat: 24.40, maxLat: 25.10, minLng: 46.40, maxLng: 47.00 };
const inBbox = p => p.lat >= RIYADH_BBOX.minLat && p.lat <= RIYADH_BBOX.maxLat && p.lng >= RIYADH_BBOX.minLng && p.lng <= RIYADH_BBOX.maxLng;

function validateNetwork(network, raw) {
  const errors = [], warnings = [];
  const stations = Object.values(network.stations);
  const lineIds = network.lineOrder;

  // --- ids & names
  const seen = new Set();
  (raw.stations.stations || []).forEach(s => {
    if (seen.has(s.id)) errors.push(`duplicate station id "${s.id}"`);
    seen.add(s.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) errors.push(`station id "${s.id}" is not a lowercase slug`);
    if (!s.name || !s.name.ar || !s.name.en) errors.push(`station "${s.id}" is missing an Arabic or English name`);
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number') errors.push(`station "${s.id}" has non-numeric coordinates`);
    else if (s.lat < RIYADH_BBOX.minLat || s.lat > RIYADH_BBOX.maxLat || s.lng < RIYADH_BBOX.minLng || s.lng > RIYADH_BBOX.maxLng) {
      errors.push(`station "${s.id}" lies outside the Riyadh bounding box (${s.lat}, ${s.lng})`);
    }
  });

  // --- lines
  lineIds.forEach(lid => {
    const line = network.lines[lid];
    if (!/^#[0-9A-Fa-f]{6}$/.test(line.color)) errors.push(`line ${lid} colour "${line.color}" is not #RRGGBB`);
    if (line.stations.length < 2) errors.push(`line ${lid} has fewer than 2 stations`);
    if (new Set(line.stations).size !== line.stations.length) errors.push(`line ${lid} lists a station twice`);
    const ratio = (line.lengthM / 1000) / line.officialLengthKm;
    if (ratio < 0.9 || ratio > 1.1) warnings.push(`line ${lid} computed length ${(line.lengthM / 1000).toFixed(1)} km differs >10% from official ${line.officialLengthKm} km`);
    line.snapOffsets.forEach((off, i) => {
      if (off > 400) errors.push(`line ${lid}: station "${line.stations[i]}" is ${off} m from the alignment`);
      else if (off > 250) warnings.push(`line ${lid}: station "${line.stations[i]}" is ${off} m from the alignment`);
    });
    line.segments.forEach(sg => {
      if (sg.distanceM < 300) warnings.push(`line ${lid}: segment ${sg.from} → ${sg.to} is only ${sg.distanceM} m`);
      if (sg.distanceM > 12000) warnings.push(`line ${lid}: segment ${sg.from} → ${sg.to} is ${sg.distanceM} m long`);
      if (sg.geometry.length < 2) errors.push(`line ${lid}: segment ${sg.from} → ${sg.to} has no geometry`);
    });
  });

  // --- orphan stations
  stations.forEach(s => { if (!s.lines.length) errors.push(`station "${s.id}" is not on any line`); });

  // --- connectivity (BFS over station adjacency)
  const adj = {};
  lineIds.forEach(lid => network.lines[lid].segments.forEach(sg => {
    (adj[sg.from] = adj[sg.from] || new Set()).add(sg.to);
    (adj[sg.to] = adj[sg.to] || new Set()).add(sg.from);
  }));
  const start = stations[0].id, visited = new Set([start]), queue = [start];
  while (queue.length) { const u = queue.shift(); (adj[u] || []).forEach(v => { if (!visited.has(v)) { visited.add(v); queue.push(v); } }); }
  if (visited.size !== stations.length) errors.push(`network is not connected: ${stations.length - visited.size} unreachable station(s)`);

  // --- places (destinations)
  const placeIds = new Set();
  ((raw.places && raw.places.places) || []).forEach(p => {
    if (placeIds.has(p.id)) errors.push(`duplicate place id "${p.id}"`);
    placeIds.add(p.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id)) errors.push(`place id "${p.id}" is not a lowercase slug`);
    if (!p.name || !p.name.ar || !p.name.en) errors.push(`place "${p.id}" is missing an Arabic or English name`);
    if (typeof p.lat !== 'number' || typeof p.lng !== 'number' || !inBbox(p)) errors.push(`place "${p.id}" has invalid coordinates`);
    if (p.station && !network.stations[p.station]) errors.push(`place "${p.id}" references unknown station "${p.station}"`);
    if (p.category && raw.places.categories && !raw.places.categories[p.category]) errors.push(`place "${p.id}" has unknown category "${p.category}"`);
    const np = network.places && network.places[p.id];
    if (np && np.nearest[0].distanceM > 8000) warnings.push(`place "${p.id}" is ${(np.nearest[0].distanceM / 1000).toFixed(1)} km from the nearest station`);
  });

  // --- schematic diagram (octilinear layout must cover every station exactly once)
  if (raw.schematic) {
    try {
      const schematic = require('../schematic');
      const model = schematic.build(network, raw.schematic);
      model.errors.forEach(e => errors.push('schematic: ' + e));
    } catch (e) { errors.push('schematic: ' + e.message); }
  }

  const stats = {
    lines: lineIds.length,
    places: placeIds.size,
    stations: stations.length,
    lineStops: lineIds.reduce((a, l) => a + network.lines[l].stations.length, 0),
    interchanges: stations.filter(s => s.interchange).length,
    officialKm: Number(lineIds.reduce((a, l) => a + network.lines[l].officialLengthKm, 0).toFixed(1)),
    computedKm: Number((lineIds.reduce((a, l) => a + network.lines[l].lengthM, 0) / 1000).toFixed(1)),
    shapePoints: lineIds.reduce((a, l) => a + network.lines[l].shape.length, 0)
  };
  return { ok: errors.length === 0, errors, warnings, stats };
}

/** Very small well-formedness check for our own generated XML (balanced tags, no stray '<'). */
function checkXmlBalanced(xml) {
  const stack = [];
  const re = /<\/?([A-Za-z_][\w:.-]*)[^<>]*?(\/)?>|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g;
  let m, last = 0;
  while ((m = re.exec(xml))) {
    const between = xml.slice(last, m.index);
    if (between.indexOf('<') >= 0) return { ok: false, error: 'stray "<" before offset ' + m.index };
    last = re.lastIndex;
    const tok = m[0];
    if (tok.startsWith('<![CDATA[') || tok.startsWith('<?') || tok.startsWith('<!--')) continue;
    if (tok.startsWith('</')) {
      const open = stack.pop();
      if (open !== m[1]) return { ok: false, error: `closing </${m[1]}> but expected </${open}>` };
    } else if (!m[2]) {
      stack.push(m[1]);
    }
  }
  if (xml.slice(last).indexOf('<') >= 0) return { ok: false, error: 'stray "<" at end' };
  return stack.length ? { ok: false, error: 'unclosed <' + stack[stack.length - 1] + '>' } : { ok: true };
}

module.exports = { validateNetwork, checkXmlBalanced, RIYADH_BBOX };

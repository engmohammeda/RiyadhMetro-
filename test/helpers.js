'use strict';
const fs = require('fs');
const path = require('path');
const net = require('../src/network');

const ROOT = path.resolve(__dirname, '..');
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8'));

function loadData() {
  return {
    stations: read('stations.json'), lines: read('lines.json'), shapes: read('shapes.json'), config: read('config.json'),
    places: read('places.json'), schematic: read('schematic.json')
  };
}
let cached = null;
function network() {
  if (!cached) cached = net.buildNetwork(loadData());
  return cached;
}
module.exports = { ROOT, loadData, network, read };

let transitModel = null;
/** Multimodal model (metro + bus + districts + park & ride), built once per process. */
function transit() {
  if (transitModel) return transitModel;
  const tr = require('../src/transit');
  transitModel = tr.build({
    network: network(),
    bus: { stops: read('bus/stops.json'), routes: read('bus/routes.json'), shapes: read('bus/shapes.json') },
    districts: read('districts.json'),
    parkAndRide: read('park-and-ride.json'),
    config: read('config.json')
  });
  return transitModel;
}
function busSources() {
  return { stops: read('bus/stops.json'), routes: read('bus/routes.json'), shapes: read('bus/shapes.json') };
}
module.exports.transit = transit;
module.exports.busSources = busSources;

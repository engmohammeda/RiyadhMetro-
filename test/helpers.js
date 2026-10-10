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
module.exports = { ROOT, loadData, network };

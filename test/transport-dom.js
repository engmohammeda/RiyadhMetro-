'use strict';
/* jsdom harness for web/transport.html.
   Leaflet needs real layout + canvas, neither of which jsdom implements, so the
   page is booted with a small stand-in for the ~15 Leaflet calls transport.js
   makes. Everything else — data bundles, RMTransit, rendering, events — is the
   real thing. */
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const ROOT = path.resolve(__dirname, '..');
let JSDOM;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { JSDOM = null; }

const LEAFLET_STUB = `
window.__layers = { polylines: 0, markers: 0, circles: 0, polygons: 0 };
(function () {
  function bounds(pts) {
    var b = { south: pts[0][0], north: pts[0][0], west: pts[0][1], east: pts[0][1] };
    pts.forEach(function (p) { b.south = Math.min(b.south, p[0]); b.north = Math.max(b.north, p[0]); b.west = Math.min(b.west, p[1]); b.east = Math.max(b.east, p[1]); });
    return {
      getSouth: function () { return b.south - 0.5; }, getNorth: function () { return b.north + 0.5; },
      getWest: function () { return b.west - 0.5; }, getEast: function () { return b.east + 0.5; },
      contains: function (p) { return p[0] >= b.south - 0.5 && p[0] <= b.north + 0.5 && p[1] >= b.west - 0.5 && p[1] <= b.east + 0.5; },
      isValid: function () { return true; }
    };
  }
  function layer(kind) {
    var o = {
      addTo: function (g) { if (g && g.__add) g.__add(o); return o; },
      removeFrom: function () { return o; },
      on: function (ev, fn) { (o.__ev = o.__ev || {})[ev] = fn; return o; },
      click: function () { if (o.__ev && o.__ev.click) o.__ev.click({}); return o; },
      bindTooltip: function () { return o; }, bindPopup: function () { return o; },
      setLatLng: function () { return o; }, setContent: function () { return o; },
      openOn: function () { return o; }, bringToFront: function () { return o; },
      getBounds: function () { return bounds([[24.4, 46.3], [25.1, 47.1]]); },
      setStyle: function () { return o; }, getLayers: function () { return []; },
      addLayer: function () { return o; }, clearLayers: function () { return o; }
    };
    if (kind === 'polyline') window.__layers.polylines++;
    if (kind === 'circle') window.__layers.circles++;
    if (kind === 'marker') window.__layers.markers++;
    if (kind === 'polygon') window.__layers.polygons++;
    return o;
  }
  function group() {
    var o = layer('group');
    o.__items = [];
    o.__add = function (x) { o.__items.push(x); };
    o.clearLayers = function () { o.__items = []; return o; };
    o.removeLayer = function () { return o; };
    o.getLayers = function () { return o.__items; };
    return o;
  }
  var L = {
    map: function () {
      var m = {
        __zoom: 15,
        setView: function () { return m; }, fitBounds: function () { return m; },
        on: function () { return m; }, off: function () { return m; },
        addLayer: function () { return m; }, removeLayer: function () { return m; }, hasLayer: function () { return true; },
        getZoom: function () { return m.__zoom; }, setZoom: function (z) { m.__zoom = z; return m; },
        zoomIn: function () { m.__zoom++; return m; }, zoomOut: function () { m.__zoom--; return m; },
        getCenter: function () { return { lat: 24.71, lng: 46.67 }; },
        getBounds: function () { return bounds([[24.45, 46.35], [25.05, 47.05]]); },
        invalidateSize: function () { return m; }, closePopup: function () { return m; },
        panTo: function () { return m; }, setMaxBounds: function () { return m; }
      };
      return m;
    },
    tileLayer: function () { return layer('tile'); },
    layerGroup: group,
    featureGroup: group,
    canvas: function () { return {}; },
    latLng: function (a, b) { return Array.isArray(a) ? { lat: a[0], lng: a[1] } : { lat: a, lng: b }; },
    latLngBounds: function (pts) { return bounds(Array.isArray(pts[0]) ? pts : [[24.4, 46.3], [25.1, 47.1]]); },
    polyline: function () { return layer('polyline'); },
    polygon: function () { return layer('polygon'); },
    circleMarker: function () { return layer('circle'); },
    marker: function () { return layer('marker'); },
    divIcon: function (o) { return o; },
    icon: function (o) { return o; },
    popup: function () { return layer('popup'); },
    geoJSON: function (data, opts) {
      var g = group();
      (data.features || [data]).forEach(function (f) {
        if (opts && opts.style) opts.style(f);
        if (opts && opts.onEachFeature) opts.onEachFeature(f, layer('polygon'));
      });
      return g;
    },
    control: { layers: function () { return { addTo: function () { return this; } }; }, scale: function () { return { addTo: function () { return this; } }; } }
  };
  window.L = L;
})();
`;

const skip = JSDOM ? false : 'jsdom is not installed — run `npm ci` to enable the browser suite';

async function bootTransport(hash) {
  const errors = [];
  const { VirtualConsole } = require('jsdom');
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(String((e && e.message) || e)));
  vc.on('error', (...a) => errors.push(a.join(' ')));

  const html = fs.readFileSync(path.join(ROOT, 'web', 'transport.html'), 'utf8')
    .replace('<script src="vendor/leaflet/leaflet.js"></script>', '<script>' + LEAFLET_STUB + '</script>');
  const pageUrl = pathToFileURL(path.join(ROOT, 'web', 'transport.html')).href + (hash || '');
  const dom = new JSDOM(html, {
    url: pageUrl, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(window) {
      // file:// pages get an opaque origin; give the page a real storage object so
      // the theme preference can be exercised (and observed) by the tests
      const store = {};
      Object.defineProperty(window, '__store', { value: store });
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: {
          getItem: k => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
          setItem: (k, v) => { store[k] = String(v); },
          removeItem: k => { delete store[k]; },
          clear: () => { Object.keys(store).forEach(k => delete store[k]); },
          key: i => Object.keys(store)[i] || null,
          get length() { return Object.keys(store).length; }
        }
      });
      window.Element.prototype.scrollIntoView = function () {};
      window.scrollTo = function () {};
      Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { value: 900, configurable: true });
      Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { value: 700, configurable: true });
      Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { value: 900, configurable: true });
      Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { value: 700, configurable: true });
    }
  });
  const { window } = dom;
  await new Promise(res => {
    if (window.document.readyState === 'complete') return res();
    window.addEventListener('load', res);
    setTimeout(res, 6000);
  });
  await new Promise(res => setTimeout(res, 200));
  return {
    window, document: window.document, errors,
    $: s => window.document.querySelector(s),
    $$: s => [...window.document.querySelectorAll(s)],
    click: el => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })),
    type(el, value) {
      el.value = value;
      el.dispatchEvent(new window.Event('input', { bubbles: true }));
    },
    close: () => { try { window.close(); } catch (e) { /* closed */ } }
  };
}

module.exports = { ROOT, bootTransport, skip, hasJsdom: !!JSDOM };

/* Riyadh Metro Navigator — service worker (offline app shell).
 * Map tiles are intentionally NOT cached (tile-provider usage policies); everything else works offline. */
var VERSION = 'rm-v7';
var SHELL = [
  './', './index.html', './transport.html', './google-maps.html', './styles.css', './transport.css',
  './app.js', './transport.js', './i18n.js', './hero.js', './manifest.webmanifest',
  './vendor/fonts/fonts.css',
  // every face fonts.css declares — the app must not fall back offline
  './vendor/fonts/files/ibm-plex-sans-arabic-arabic-400-normal.woff2',
  './vendor/fonts/files/ibm-plex-sans-arabic-arabic-600-normal.woff2',
  './vendor/fonts/files/ibm-plex-sans-arabic-arabic-700-normal.woff2',
  './vendor/fonts/files/ibm-plex-sans-arabic-latin-400-normal.woff2',
  './vendor/fonts/files/ibm-plex-sans-arabic-latin-600-normal.woff2',
  './vendor/fonts/files/ibm-plex-sans-arabic-latin-700-normal.woff2',
  './data/metro-data.js', './data/transit-data.js',
  './lib/geo.js', './lib/network.js', './lib/router.js', './lib/links.js', './lib/kml.js', './lib/geojson.js', './lib/schematic.js', './lib/service.js', './lib/live.js', './lib/transit.js',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './vendor/leaflet/images/marker-icon.png', './vendor/leaflet/images/marker-shadow.png', './vendor/leaflet/images/layers.png',
  './icons/favicon.png', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // tiles & external links: network only
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      var fresh = fetch(e.request).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(VERSION).then(function (c) { c.put(e.request, copy); }); }
        return res;
      }).catch(function () { return cached; });
      return cached || fresh;
    })
  );
});

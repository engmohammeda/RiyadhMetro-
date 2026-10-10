/*
 * Riyadh Metro Navigator — links.js
 * Deep links into Google Maps, Google Earth (web), Apple Maps, OpenStreetMap and geo: URIs.
 * Pure string helpers; UMD: `require('./links')` in Node, `window.RMLinks` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMLinks = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function f(n) { return Number(n).toFixed(6); }
  function enc(s) { return encodeURIComponent(s); }

  /** Pin on Google Maps (works on web, Android and iOS apps). */
  function googleMapsPlace(lat, lng) {
    return 'https://www.google.com/maps/search/?api=1&query=' + f(lat) + '%2C' + f(lng);
  }

  /**
   * Google Maps directions. origin/destination may be [lat,lng] or a string; travelmode: transit|walking|driving|bicycling.
   * Omit origin to start from the user's current location.
   */
  function googleMapsDirections(opts) {
    var p = ['api=1'];
    if (opts.origin) p.push('origin=' + pt(opts.origin));
    p.push('destination=' + pt(opts.destination));
    p.push('travelmode=' + (opts.travelmode || 'transit'));
    if (opts.travelmode === 'transit' || !opts.travelmode) p.push('transit_mode=subway');
    return 'https://www.google.com/maps/dir/?' + p.join('&');
  }

  function pt(v) { return Array.isArray(v) ? f(v[0]) + '%2C' + f(v[1]) : enc(v); }

  /**
   * Google Earth (web) camera link: @lat,lng,ALTa,DISTd,FOVy,HEADINGh,TILTt,ROLLr
   * Riyadh ground elevation ≈ 600 m, so the target altitude defaults to 620 m.
   */
  function googleEarth(lat, lng, opts) {
    opts = opts || {};
    var alt = opts.altitude !== undefined ? opts.altitude : 620;
    var range = opts.range || 1400;
    var heading = opts.heading || 0;
    var tilt = opts.tilt !== undefined ? opts.tilt : 50;
    return 'https://earth.google.com/web/@' + f(lat) + ',' + f(lng) + ',' + alt + 'a,' + range + 'd,35y,' +
      Math.round(heading) + 'h,' + tilt + 't,0r';
  }

  /** Google Earth search link (opens the search panel at the coordinates — most robust across versions). */
  function googleEarthSearch(lat, lng) {
    return 'https://earth.google.com/web/search/' + f(lat) + ',' + f(lng);
  }

  /** geo: URI — opens the default maps app on mobile. */
  function geoUri(lat, lng, label) {
    return 'geo:' + f(lat) + ',' + f(lng) + '?q=' + f(lat) + ',' + f(lng) + (label ? '(' + enc(label) + ')' : '');
  }

  function appleMaps(lat, lng, label) {
    return 'https://maps.apple.com/?ll=' + f(lat) + ',' + f(lng) + '&q=' + enc(label || 'Metro station');
  }

  function openStreetMap(lat, lng, zoom) {
    return 'https://www.openstreetmap.org/?mlat=' + f(lat) + '&mlon=' + f(lng) + '#map=' + (zoom || 17) + '/' + f(lat) + '/' + f(lng);
  }

  /** Link into the project's own web app. */
  function appStation(siteUrl, stationId) {
    return (siteUrl || './').replace(/\/?$/, '/') + 'web/#station=' + enc(stationId);
  }
  function appRoute(siteUrl, fromId, toId) {
    return (siteUrl || './').replace(/\/?$/, '/') + 'web/#from=' + enc(fromId) + '&to=' + enc(toId);
  }

  return {
    googleMapsPlace: googleMapsPlace,
    googleMapsDirections: googleMapsDirections,
    googleEarth: googleEarth,
    googleEarthSearch: googleEarthSearch,
    geoUri: geoUri,
    appleMaps: appleMaps,
    openStreetMap: openStreetMap,
    appStation: appStation,
    appRoute: appRoute
  };
});

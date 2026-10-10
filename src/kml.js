/*
 * Riyadh Metro Navigator — kml.js
 * KML 2.2 (+ gx extensions) generator for Google Earth / Google My Maps.
 *
 *   networkKml(network, opts)  – full network: lines, stations per line, interchanges, fly-over tours
 *   lineKml(network, lineId)   – a single line (handy as a separate Google My Maps layer)
 *   routeKml(network, itinerary, opts) – a planned journey (used by the web app "download KML")
 *
 * Pure string building — UMD: `require('./kml')` in Node, `window.RMKml` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geo'), require('./links'));
  else root.RMKml = factory(root.RMGeo, root.RMLinks);
})(typeof self !== 'undefined' ? self : this, function (geo, links) {
  'use strict';

  var HOSTED = {
    station: 'https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png',
    interchange: 'https://maps.google.com/mapfiles/kml/shapes/subway.png',
    start: 'https://maps.google.com/mapfiles/kml/paddle/go.png',
    end: 'https://maps.google.com/mapfiles/kml/paddle/red-square.png',
    transfer: 'https://maps.google.com/mapfiles/kml/shapes/subway.png'
  };

  var STRUCTURE = {
    elevated: { ar: 'مرتفعة (جسر)', en: 'Elevated' },
    deep_underground: { ar: 'نفقية عميقة', en: 'Deep underground' },
    shallow_underground: { ar: 'نفقية سطحية', en: 'Shallow underground' },
    at_grade: { ar: 'على مستوى الأرض', en: 'At grade' }
  };

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function cdata(html) { return '<![CDATA[' + String(html).replace(/]]>/g, ']]]]><![CDATA[>') + ']]>'; }

  /** #RRGGBB (+ alpha 0..1) → KML aabbggrr */
  function kmlColor(hex, alpha) {
    var h = hex.replace('#', '');
    var a = Math.round((alpha === undefined ? 1 : alpha) * 255).toString(16).padStart(2, '0');
    return (a + h.substr(4, 2) + h.substr(2, 2) + h.substr(0, 2)).toLowerCase();
  }
  function coord(p) { return p[1].toFixed(6) + ',' + p[0].toFixed(6) + ',0'; }
  function coords(pts) { return pts.map(coord).join(' '); }

  function lookAt(lat, lng, range, tilt, heading) {
    return '<LookAt><longitude>' + lng.toFixed(6) + '</longitude><latitude>' + lat.toFixed(6) + '</latitude>' +
      '<altitude>0</altitude><heading>' + (heading || 0).toFixed(1) + '</heading><tilt>' + (tilt || 0) + '</tilt>' +
      '<range>' + Math.round(range) + '</range><altitudeMode>relativeToGround</altitudeMode></LookAt>';
  }

  /* ------------------------------------------------------------------ styles */
  function styles(network, opts) {
    var out = [];
    network.lineOrder.forEach(function (lid) {
      var line = network.lines[lid];
      out.push('<Style id="line-' + lid + '"><LineStyle><color>' + kmlColor(line.color, 0.95) + '</color><width>6</width>' +
        '<gx:labelVisibility>0</gx:labelVisibility></LineStyle>' +
        '<PolyStyle><color>' + kmlColor(line.color, 0.4) + '</color></PolyStyle></Style>');
      out.push('<Style id="line-' + lid + '-casing"><LineStyle><color>' + kmlColor('#ffffff', 0.85) + '</color><width>10</width></LineStyle></Style>');
      var href = opts.iconMode === 'embedded' ? opts.iconBase + 'line-' + lid + '.png' : HOSTED.station;
      var tint = opts.iconMode === 'embedded' ? '' : '<color>' + kmlColor(line.color) + '</color>';
      out.push(stylePair('station-' + lid, href, tint, 0.85, 1.1, 0.75));
    });
    var ih = opts.iconMode === 'embedded' ? opts.iconBase + 'interchange.png' : HOSTED.interchange;
    out.push(stylePair('interchange', ih, '', 1.05, 1.3, 0.9));
    out.push(stylePair('route-start', HOSTED.start, '', 1.2, 1.4, 1));
    out.push(stylePair('route-end', HOSTED.end, '', 1.2, 1.4, 1));
    out.push(stylePair('route-transfer', HOSTED.transfer, '', 1.1, 1.3, 0.9));
    out.push('<Style id="route-casing"><LineStyle><color>' + kmlColor('#ffffff', 0.9) + '</color><width>12</width></LineStyle></Style>');
    out.push(stylePair('place', 'https://maps.google.com/mapfiles/kml/paddle/wht-blank.png', '<color>' + kmlColor('#6b7280') + '</color>', 0.7, 0.9, 0.7));
    return out.join('\n');
  }

  /** Destination (place) placemark: category, nearest stations with walking distance, Google links. Hidden by default. */
  function placePlacemark(network, p, opts) {
    var cat = (network.placeCategories || {})[p.category] || {};
    var rows = p.nearest.map(function (n) {
      var st = network.stations[n.station];
      return '<li>' + st.lines.map(function (l) { return badge(network.lines[l]); }).join(' ') + ' <b>' + esc(st.name.ar) + '</b> · ' + esc(st.name.en) +
        ' — ' + geo.formatDistance(n.distanceM, 'ar') + ' (~' + n.walkMinutes + ' د مشياً / min walk)</li>';
    }).join('');
    var html = '<div style="font-family:Segoe UI,Tahoma,Arial,sans-serif;font-size:13px;min-width:280px;max-width:380px">' +
      '<h3 style="margin:0 0 4px">' + (cat.icon || '📍') + ' ' + esc(p.name.ar) + '</h3><div style="color:#555;margin-bottom:8px">' + esc(p.name.en) + ' · ' + esc(cat.ar || '') + ' / ' + esc(cat.en || '') + '</div>' +
      '<p style="margin:4px 0"><b>أقرب المحطات • Nearest stations</b></p><ol style="padding-right:18px;padding-left:18px;margin:4px 0">' + rows + '</ol>' +
      (p.approx ? '<p style="margin:6px 0;color:#777;font-size:12px">الإحداثيات تقريبية • Coordinates are approximate.</p>' : '') +
      '<p style="margin:8px 0 0">' +
      '<a href="' + esc(links.googleMapsPlace(p.lat, p.lng)) + '">📌 Google Maps</a> · ' +
      '<a href="' + esc(links.googleMapsDirections({ origin: [network.stations[p.station].lat, network.stations[p.station].lng], destination: [p.lat, p.lng], travelmode: 'walking' })) + '">🚶 من المحطة • Walk from station</a>' +
      (opts.siteUrl ? ' · <a href="' + esc(opts.siteUrl + 'web/#p:' + p.id + '~~ar') + '">🧭 ' + esc('خطّط رحلة إليه') + '</a>' : '') +
      '</p></div>';
    return '<Placemark id="pl-' + p.id + '"><name>' + esc((cat.icon || '📍') + ' ' + p.name.ar) + '</name><visibility>0</visibility>' +
      '<Snippet maxLines="1">' + esc(p.name.en + ' → ' + network.stations[p.station].name.en) + '</Snippet>' +
      '<description>' + cdata(html) + '</description><styleUrl>#place</styleUrl>' +
      extendedData({ name_ar: p.name.ar, name_en: p.name.en, category: p.category, nearest_station: p.station, walk_m: p.nearest[0].distanceM }) +
      '<Point><coordinates>' + coord([p.lat, p.lng]) + '</coordinates></Point></Placemark>';
  }

  /** normal + highlight style pair wrapped in a StyleMap (labels grow on hover). */
  function stylePair(id, href, tint, scale, hiScale, labelScale) {
    function st(suffix, sc, ls) {
      return '<Style id="' + id + '-' + suffix + '"><IconStyle><scale>' + sc + '</scale>' + tint +
        '<Icon><href>' + esc(href) + '</href></Icon><hotSpot x="0.5" y="0.5" xunits="fraction" yunits="fraction"/></IconStyle>' +
        '<LabelStyle><scale>' + ls + '</scale></LabelStyle>' +
        '<BalloonStyle><text>$[description]</text></BalloonStyle></Style>';
    }
    return st('n', scale, labelScale) + st('h', hiScale, labelScale + 0.25) +
      '<StyleMap id="' + id + '"><Pair><key>normal</key><styleUrl>#' + id + '-n</styleUrl></Pair>' +
      '<Pair><key>highlight</key><styleUrl>#' + id + '-h</styleUrl></Pair></StyleMap>';
  }

  /* ------------------------------------------------------------ descriptions */
  function badge(line) {
    var dark = line.id === '4' ? '#333' : '#fff';
    return '<span style="display:inline-block;background:' + line.color + ';color:' + dark + ';padding:2px 8px;border-radius:12px;font-weight:bold;margin:0 2px;white-space:nowrap">' +
      line.number + ' · ' + esc(line.name.ar) + ' / ' + esc(line.name.en) + '</span>';
  }

  function stationDescription(network, s, opts) {
    var site = opts.siteUrl;
    var lines = s.lines.map(function (lid) { return network.lines[lid]; });
    var rows = lines.map(function (line) {
      var i = line.stations.indexOf(s.id);
      var prev = i > 0 ? network.stations[line.stations[i - 1]] : null;
      var next = i < line.stations.length - 1 ? network.stations[line.stations[i + 1]] : null;
      var str = STRUCTURE[s.structure[line.id]] || null;
      return '<tr><td style="padding:3px 6px">' + badge(line) + '</td>' +
        '<td style="padding:3px 6px">' + (prev ? '◀ ' + esc(prev.name.ar) + ' <small>(' + esc(prev.name.en) + ')</small>' : '<i>بداية المسار / terminus</i>') + '</td>' +
        '<td style="padding:3px 6px">' + (next ? esc(next.name.ar) + ' <small>(' + esc(next.name.en) + ')</small> ▶' : '<i>نهاية المسار / terminus</i>') + '</td>' +
        '<td style="padding:3px 6px">' + (str ? esc(str.ar) + ' / ' + esc(str.en) : '—') + '</td></tr>';
    }).join('');

    var interchange = s.interchange
      ? '<p style="margin:6px 0;color:#b00020"><b>محطة تبادل</b> بين ' + lines.map(function (l) { return esc(l.name.ar); }).join(' و') +
        ' — <b>Interchange</b> between the ' + lines.map(function (l) { return esc(l.name.en); }).join(' and ') + '.</p>'
      : '';
    var flags = [];
    if (s.busHub) flags.push('محور حافلات / Bus hub');
    if (s.parkAndRide) flags.push('مواقف اركن واركب / Park & Ride');

    return '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:13px;min-width:330px;max-width:520px;text-align:right">' +
      '<h2 style="margin:0 0 2px 0;font-size:20px">' + esc(s.name.ar) + '</h2>' +
      '<div style="color:#555;font-size:15px;margin-bottom:8px" dir="ltr">' + esc(s.name.en) + '</div>' +
      '<div style="margin:4px 0">' + lines.map(badge).join(' ') + '</div>' +
      interchange +
      (flags.length ? '<p style="margin:4px 0">' + flags.join(' • ') + '</p>' : '') +
      '<table style="border-collapse:collapse;margin:6px 0;font-size:12px;width:100%" border="0">' +
      '<tr style="background:#f3f3f3"><th style="padding:3px 6px">المسار / Line</th><th style="padding:3px 6px">المحطة السابقة / Previous</th><th style="padding:3px 6px">المحطة التالية / Next</th><th style="padding:3px 6px">النوع / Type</th></tr>' + rows + '</table>' +
      '<p style="margin:6px 0" dir="ltr"><small>📍 ' + s.lat.toFixed(6) + ', ' + s.lng.toFixed(6) + '</small></p>' +
      '<p style="margin:8px 0;line-height:2">' +
      '<a href="' + links.googleMapsPlace(s.lat, s.lng) + '" target="_blank">📌 خرائط Google</a> · ' +
      '<a href="' + links.googleMapsDirections({ destination: [s.lat, s.lng], travelmode: 'walking' }) + '" target="_blank">🚶 الاتجاهات إلى المحطة</a> · ' +
      '<a href="' + links.googleEarth(s.lat, s.lng) + '" target="_blank">🌍 Google Earth</a>' +
      (site ? ' · <a href="' + esc(links.appStation(site, s.id)) + '" target="_blank">🧭 دليل التنقل</a>' : '') + '</p>' +
      '<p style="margin:4px 0;color:#777;font-size:11px">مشروع مجتمعي غير رسمي — Unofficial community project. ' +
      (opts.repoUrl ? '<a href="' + esc(opts.repoUrl) + '">' + esc(opts.repoUrl.replace(/^https?:\/\//, '')) + '</a>' : '') + '</p></div>';
  }

  function lineDescription(network, line, opts) {
    var list = line.stations.map(function (id, i) {
      var s = network.stations[id];
      var others = s.lines.filter(function (l) { return l !== line.id; }).map(function (l) { return network.lines[l]; });
      return '<li style="margin:2px 0">' + esc(s.name.ar) + ' <small style="color:#666">' + esc(s.name.en) + '</small>' +
        (others.length ? ' <span style="color:#b00020">⇄ ' + others.map(function (o) { return esc(o.name.ar); }).join('، ') + '</span>' : '') + '</li>';
    }).join('');
    var opened = line.openedOn ? new Date(line.openedOn + 'T00:00:00Z') : null;
    return '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:13px;min-width:320px;max-width:520px;text-align:right">' +
      '<h2 style="margin:0;font-size:20px;border-right:10px solid ' + line.color + ';padding-right:8px">' + esc(line.name.ar) + ' <small>(' + line.number + ')</small></h2>' +
      '<div style="color:#555;font-size:15px;margin:2px 0 8px 0" dir="ltr">' + esc(line.name.en) + '</div>' +
      '<p style="margin:4px 0"><b>المحور / Corridor:</b> ' + esc(line.corridor.ar) + '<br><span dir="ltr" style="color:#555">' + esc(line.corridor.en) + '</span></p>' +
      '<p style="margin:4px 0"><b>الطول / Length:</b> ' + line.officialLengthKm + ' كم (رسمي) — محسوب من المسار: ' + (line.lengthM / 1000).toFixed(1) + ' كم<br>' +
      '<b>عدد المحطات / Stations:</b> ' + line.stations.length + '<br>' +
      '<b>من / From:</b> ' + esc(network.stations[line.termini.first].name.ar) + ' — <b>إلى / To:</b> ' + esc(network.stations[line.termini.last].name.ar) +
      (opened ? '<br><b>تاريخ الافتتاح / Opened:</b> ' + line.openedOn : '') + '</p>' +
      '<ol style="padding-right:22px;margin:6px 0;columns:2;-webkit-columns:2">' + list + '</ol>' +
      '<p style="margin:4px 0;color:#777;font-size:11px">مشروع مجتمعي غير رسمي — Unofficial community project.</p></div>';
  }

  /* ------------------------------------------------------------- placemarks */
  function stationPlacemark(network, s, styleId, opts, labelPrefix) {
    var name = (labelPrefix || '') + s.name.ar + ' • ' + s.name.en;
    var snippet = s.lines.map(function (l) { return network.lines[l].name.ar; }).join(' + ');
    return '<Placemark id="st-' + esc(s.id) + (opts.idSuffix || '') + '">' +
      '<name>' + esc(name) + '</name>' +
      (opts.hidden ? '<visibility>0</visibility>' : '') +
      '<Snippet maxLines="1">' + esc(snippet) + '</Snippet>' +
      '<description>' + cdata(stationDescription(network, s, opts)) + '</description>' +
      '<styleUrl>#' + styleId + '</styleUrl>' +
      lookAt(s.lat, s.lng, 900, 45, 0) +
      extendedData({
        id: s.id, name_ar: s.name.ar, name_en: s.name.en,
        lines: s.lines.map(function (l) { return network.lines[l].name.en; }).join('; '),
        line_numbers: s.lines.join(';'),
        interchange: s.interchange ? 'yes' : 'no',
        bus_hub: s.busHub ? 'yes' : 'no',
        park_and_ride: s.parkAndRide ? 'yes' : 'no',
        google_maps: links.googleMapsPlace(s.lat, s.lng)
      }) +
      '<Point><coordinates>' + coord([s.lat, s.lng]) + '</coordinates></Point></Placemark>';
  }

  function extendedData(obj) {
    return '<ExtendedData>' + Object.keys(obj).map(function (k) {
      return '<Data name="' + esc(k) + '"><value>' + esc(obj[k]) + '</value></Data>';
    }).join('') + '</ExtendedData>';
  }

  function linePlacemark(network, line, opts, withCasing) {
    var b = geo.boundsOf(line.shape);
    var c = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
    var span = Math.max(geo.haversine(b[0], [b[1][0], b[0][1]]), geo.haversine(b[0], [b[0][0], b[1][1]]));
    var pm = '';
    if (withCasing) {
      pm += '<Placemark><name>' + esc(line.name.ar + ' — casing') + '</name><visibility>1</visibility><styleUrl>#line-' + line.id + '-casing</styleUrl>' +
        '<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>' + coords(line.shape) + '</coordinates></LineString></Placemark>';
    }
    pm += '<Placemark id="pm-line-' + line.id + '">' +
      '<name>' + esc(line.number + ' — ' + line.name.ar + ' • ' + line.name.en) + '</name>' +
      '<Snippet maxLines="2">' + esc(network.stations[line.termini.first].name.ar + ' ⇄ ' + network.stations[line.termini.last].name.ar + ' • ' + line.stations.length + ' محطة') + '</Snippet>' +
      '<description>' + cdata(lineDescription(network, line, opts)) + '</description>' +
      '<styleUrl>#line-' + line.id + '</styleUrl>' +
      lookAt(c[0], c[1], span * 1.4, 0, 0) +
      extendedData({
        id: line.id, name_ar: line.name.ar, name_en: line.name.en, color: line.color,
        corridor_en: line.corridor.en, official_length_km: line.officialLengthKm,
        stations: line.stations.length, from: network.stations[line.termini.first].name.en,
        to: network.stations[line.termini.last].name.en, opened_on: line.openedOn || ''
      }) +
      '<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>' + coords(line.shape) + '</coordinates></LineString></Placemark>';
    return pm;
  }

  /* ------------------------------------------------------------------ tours */
  function lineTour(network, line) {
    var items = [];
    line.stations.forEach(function (id, i) {
      var s = network.stations[id];
      var next = i < line.stations.length - 1 ? network.stations[line.stations[i + 1]] : null;
      var prev = i > 0 ? network.stations[line.stations[i - 1]] : null;
      var heading = next ? geo.bearing([s.lat, s.lng], [next.lat, next.lng]) : (prev ? geo.bearing([prev.lat, prev.lng], [s.lat, s.lng]) : 0);
      var dist = prev ? geo.haversine([prev.lat, prev.lng], [s.lat, s.lng]) : 0;
      var dur = i === 0 ? 4 : Math.min(9, 2.5 + dist / 1500);
      items.push('<gx:FlyTo><gx:duration>' + dur.toFixed(1) + '</gx:duration><gx:flyToMode>smooth</gx:flyToMode>' +
        lookAt(s.lat, s.lng, 1100, 62, heading) + '</gx:FlyTo>');
      items.push('<gx:AnimatedUpdate><gx:duration>0</gx:duration><Update><targetHref/><Change>' +
        '<Placemark targetId="st-' + esc(id) + '-l' + line.id + '"><gx:balloonVisibility>1</gx:balloonVisibility></Placemark></Change></Update></gx:AnimatedUpdate>');
      items.push('<gx:Wait><gx:duration>1.6</gx:duration></gx:Wait>');
      items.push('<gx:AnimatedUpdate><gx:duration>0</gx:duration><Update><targetHref/><Change>' +
        '<Placemark targetId="st-' + esc(id) + '-l' + line.id + '"><gx:balloonVisibility>0</gx:balloonVisibility></Placemark></Change></Update></gx:AnimatedUpdate>');
    });
    return '<gx:Tour><name>' + esc('🎬 جولة ' + line.name.ar + ' • ' + line.name.en + ' fly-over') + '</name>' +
      '<description>' + esc('رحلة افتراضية فوق جميع محطات ' + line.name.ar + ' من ' + network.stations[line.termini.first].name.ar + ' إلى ' + network.stations[line.termini.last].name.ar) + '</description>' +
      '<gx:Playlist>' + items.join('') + '</gx:Playlist></gx:Tour>';
  }

  /* ---------------------------------------------------------------- network */
  function header() {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:atom="http://www.w3.org/2005/Atom">\n';
  }

  function networkDescription(network, opts) {
    var total = Object.keys(network.stations).length;
    var inter = Object.keys(network.stations).filter(function (id) { return network.stations[id].interchange; }).length;
    var km = network.lineOrder.reduce(function (a, l) { return a + network.lines[l].officialLengthKm; }, 0);
    return '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:13px;text-align:right;max-width:520px">' +
      '<h2 style="margin:0">مترو الرياض — خريطة الشبكة الكاملة</h2><div dir="ltr" style="color:#555">Riyadh Metro — complete network map</div>' +
      '<p>' + network.lineOrder.length + ' مسارات • ' + total + ' محطة (' + inter + ' محطات تبادل) • ' + km.toFixed(1) + ' كم</p>' +
      '<ul style="padding-right:20px">' + network.lineOrder.map(function (l) { var line = network.lines[l]; return '<li>' + badge(line) + ' ' + esc(network.stations[line.termini.first].name.ar) + ' ⇄ ' + esc(network.stations[line.termini.last].name.ar) + ' (' + line.stations.length + ' محطة)</li>'; }).join('') + '</ul>' +
      '<p>انقر على أي محطة لعرض المسارات والمحطات المجاورة وروابط خرائط Google. المجلد «جولات» يحتوي على رحلات طيران افتراضية فوق كل مسار.</p>' +
      '<p dir="ltr" style="color:#555">Click any station for its lines, neighbours and Google Maps links. The “Tours” folder contains fly-over tours for every line.</p>' +
      (opts.siteUrl ? '<p>🧭 <a href="' + esc(opts.siteUrl) + 'web/">دليل التنقل التفاعلي / Interactive journey planner</a></p>' : '') +
      '<p style="color:#777;font-size:11px">مشروع مجتمعي غير رسمي، البيانات من المصادر المفتوحة لمشغّل النقل العام بالرياض. Unofficial community project; data from Riyadh public-transport open route data. Generated ' + network.generatedAt.slice(0, 10) + '.</p></div>';
  }

  /**
   * Full network KML.
   * @param opts {iconMode:'hosted'|'embedded', iconBase:'icons/', siteUrl, repoUrl, tours:true}
   */
  function networkKml(network, opts) {
    opts = Object.assign({ iconMode: 'hosted', iconBase: 'icons/', tours: true }, opts || {});
    var allPts = [];
    network.lineOrder.forEach(function (l) { allPts = allPts.concat(network.lines[l].shape); });
    var c = geo.centroid(allPts);

    var x = header() + '<Document id="riyadh-metro">\n' +
      '<name>' + esc('مترو الرياض • Riyadh Metro') + '</name>\n' +
      '<open>1</open>\n' +
      '<description>' + cdata(networkDescription(network, opts)) + '</description>\n' +
      (opts.repoUrl ? '<atom:link href="' + esc(opts.repoUrl) + '"/>\n' : '') +
      lookAt(c[0], c[1], 48000, 0, 0) + '\n' +
      styles(network, opts) + '\n';

    // Lines folder
    x += '<Folder id="lines"><name>' + esc('🚇 المسارات • Lines') + '</name><open>1</open>\n';
    network.lineOrder.forEach(function (lid) { x += linePlacemark(network, network.lines[lid], opts, false) + '\n'; });
    x += '</Folder>\n';

    // Stations per line
    x += '<Folder id="stations"><name>' + esc('📍 المحطات • Stations') + '</name><open>0</open>\n';
    network.lineOrder.forEach(function (lid) {
      var line = network.lines[lid];
      x += '<Folder id="stations-' + lid + '"><name>' + esc(line.number + ' — ' + line.name.ar + ' • ' + line.name.en) + '</name><open>0</open>\n';
      line.stations.forEach(function (id, i) {
        var s = network.stations[id];
        x += stationPlacemark(network, s, s.interchange ? 'interchange' : 'station-' + lid, Object.assign({}, opts, { idSuffix: '-l' + lid }), (i + 1) + '. ') + '\n';
      });
      x += '</Folder>\n';
    });
    x += '</Folder>\n';

    // Interchanges
    x += '<Folder id="interchanges"><name>' + esc('🔁 محطات التبادل • Interchanges') + '</name><open>0</open>\n';
    Object.keys(network.stations).filter(function (id) { return network.stations[id].interchange; }).forEach(function (id) {
      x += stationPlacemark(network, network.stations[id], 'interchange', Object.assign({}, opts, { idSuffix: '-x' })) + '\n';
    });
    x += '</Folder>\n';

    // Destinations (hidden by default — tick the folder in Google Earth to show them)
    if (network.placeOrder && network.placeOrder.length) {
      x += '<Folder id="places"><name>' + esc('🏛️ أماكن ووجهات • Destinations (' + network.placeOrder.length + ')') + '</name><open>0</open><visibility>0</visibility>\n';
      network.placeOrder.forEach(function (pid) { x += placePlacemark(network, network.places[pid], opts) + '\n'; });
      x += '</Folder>\n';
    }

    if (opts.tours) {
      x += '<Folder id="tours"><name>' + esc('🎬 جولات • Tours') + '</name><open>0</open>\n';
      network.lineOrder.forEach(function (lid) { x += lineTour(network, network.lines[lid]) + '\n'; });
      x += '</Folder>\n';
    }
    x += '</Document>\n</kml>\n';
    return x;
  }

  /** Single line KML (its own layer in Google My Maps). */
  function lineKml(network, lineId, opts) {
    opts = Object.assign({ iconMode: 'hosted', iconBase: 'icons/' }, opts || {});
    var line = network.lines[lineId];
    var sub = Object.assign({}, network, { lineOrder: [lineId] });
    var x = header() + '<Document id="riyadh-metro-line-' + lineId + '">\n' +
      '<name>' + esc('مترو الرياض — ' + line.name.ar + ' • ' + line.name.en) + '</name><open>1</open>\n' +
      '<description>' + cdata(lineDescription(network, line, opts)) + '</description>\n' +
      styles(sub, opts) + '\n' +
      linePlacemark(network, line, opts, false) + '\n' +
      '<Folder><name>' + esc('📍 المحطات • Stations') + '</name>\n';
    line.stations.forEach(function (id, i) {
      var s = network.stations[id];
      x += stationPlacemark(network, s, s.interchange ? 'interchange' : 'station-' + lineId, Object.assign({}, opts, { idSuffix: '-l' + lineId }), (i + 1) + '. ') + '\n';
    });
    x += '</Folder>\n' + lineTour(network, line) + '\n</Document>\n</kml>\n';
    return x;
  }

  /* ------------------------------------------------------------------ route */
  function routeKml(network, it, opts) {
    opts = Object.assign({ iconMode: 'hosted', lang: 'ar' }, opts || {});
    var from = network.stations[it.from], to = network.stations[it.to];
    var steps = opts.steps || [];
    var pts = [];
    it.legs.forEach(function (l) { pts = pts.concat(l.geometry); });
    if (!pts.length) pts = [[from.lat, from.lng]];
    var b = geo.boundsOf(pts);
    var c = [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2];
    var span = Math.max(1500, geo.haversine(b[0], b[1]));

    var desc = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:13px;text-align:right;max-width:520px">' +
      '<h2 style="margin:0">' + esc(from.name.ar) + ' ← ' + esc(to.name.ar) + '</h2>' +
      '<div dir="ltr" style="color:#555">' + esc(from.name.en) + ' → ' + esc(to.name.en) + '</div>' +
      '<ol style="padding-right:20px">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p><a href="' + links.googleMapsDirections({ origin: [from.lat, from.lng], destination: [to.lat, to.lng], travelmode: 'transit' }) + '">🚇 افتح الرحلة في خرائط Google (مواصلات عامة)</a></p>' +
      '<p style="color:#777;font-size:11px">الأزمنة تقديرية. Estimated times — unofficial.</p></div>';

    var x = header() + '<Document id="riyadh-metro-route">\n' +
      '<name>' + esc('رحلة مترو: ' + from.name.ar + ' ← ' + to.name.ar) + '</name><open>1</open>\n' +
      '<description>' + cdata(desc) + '</description>\n' +
      styles(network, opts) + '\n' + lookAt(c[0], c[1], span * 1.6, 0, 0) + '\n';

    it.legs.forEach(function (leg, i) {
      var line = network.lines[leg.line];
      x += '<Placemark><name>' + esc('مسار ' + (i + 1) + ' — casing') + '</name><styleUrl>#route-casing</styleUrl>' +
        '<LineString><tessellate>1</tessellate><coordinates>' + coords(leg.geometry) + '</coordinates></LineString></Placemark>\n';
      x += '<Placemark><name>' + esc((i + 1) + '. ' + line.name.ar + ' • ' + line.name.en + ': ' + network.stations[leg.from].name.ar + ' ← ' + network.stations[leg.to].name.ar) + '</name>' +
        '<description>' + cdata('<div dir="rtl">' + badge(line) + '<p>باتجاه <b>' + esc(network.stations[leg.direction].name.ar) + '</b> — ' + leg.stops + ' محطة — ' + Math.max(1, leg.minutes) + ' دقيقة تقريباً<br>' +
          '<span dir="ltr">towards ' + esc(network.stations[leg.direction].name.en) + ' — ' + leg.stops + ' stops — ~' + Math.max(1, leg.minutes) + ' min</span></p>' +
          '<ol style="padding-right:20px">' + leg.stations.map(function (id) { return '<li>' + esc(network.stations[id].name.ar) + ' <small>' + esc(network.stations[id].name.en) + '</small></li>'; }).join('') + '</ol></div>') + '</description>' +
        '<styleUrl>#line-' + leg.line + '</styleUrl>' +
        '<LineString><tessellate>1</tessellate><altitudeMode>clampToGround</altitudeMode><coordinates>' + coords(leg.geometry) + '</coordinates></LineString></Placemark>\n';
    });

    x += stationPlacemark(network, from, 'route-start', Object.assign({}, opts, { idSuffix: '-start' }), '🟢 البداية • Start: ') + '\n';
    it.transfers.forEach(function (t, i) {
      x += stationPlacemark(network, network.stations[t.station], 'route-transfer', Object.assign({}, opts, { idSuffix: '-tr' + i }), '🔁 تبديل • Transfer: ') + '\n';
    });
    x += stationPlacemark(network, to, 'route-end', Object.assign({}, opts, { idSuffix: '-end' }), '🔴 الوصول • End: ') + '\n';

    // Intermediate stations as a collapsed folder
    x += '<Folder><name>' + esc('المحطات على الطريق • Stations en route') + '</name><visibility>0</visibility><open>0</open>\n';
    it.stations.forEach(function (id, i) {
      var s = network.stations[id];
      x += stationPlacemark(network, s, s.interchange ? 'interchange' : 'station-' + s.lines[0], Object.assign({}, opts, { idSuffix: '-r' + i, hidden: true }), (i + 1) + '. ') + '\n';
    });
    x += '</Folder>\n</Document>\n</kml>\n';
    return x;
  }

  return {
    networkKml: networkKml,
    lineKml: lineKml,
    routeKml: routeKml,
    kmlColor: kmlColor,
    escapeXml: esc,
    STRUCTURE: STRUCTURE
  };
});

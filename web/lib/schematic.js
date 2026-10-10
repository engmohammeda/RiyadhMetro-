/*
 * Riyadh Metro Navigator — schematic (diagrammatic) network map
 *
 * Turns the hand-designed octilinear layout in data/schematic.json into an SVG
 * "metro map" (45°/90° segments, interchange rings, rotated labels, legend).
 * Used by the web app (interactive, tap-to-plan) and by the build
 * (dist/riyadh-metro-diagram.svg).
 *
 * UMD: `require('./schematic')` in Node, `window.RMSchematic` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMSchematic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function r2(n) { return Math.round(n * 100) / 100; }

  /* ------------------------------------------------------------- model */

  /**
   * Build the schematic model: pixel positions, edges (with shared-track offsets) and validation errors.
   * @param {object} network  model from RMNetwork.buildNetwork
   * @param {object} layout   data/schematic.json
   */
  function build(network, layout) {
    var unit = layout.unit || 40;
    var b = layout.bounds || { minX: -1, minY: -1, maxX: 24, maxY: 31 };
    var px = function (x) { return (x - b.minX) * unit; };
    var py = function (y) { return (y - b.minY) * unit; };
    var errors = [];
    var stations = {};

    Object.keys(network.stations).forEach(function (id) {
      var spec = layout.stations[id];
      if (!spec) { errors.push('No schematic position for station "' + id + '"'); return; }
      var ov = spec[3] || {};
      var s = network.stations[id];
      stations[id] = {
        id: id, name: s.name, lines: s.lines.slice(), interchange: s.interchange,
        gx: spec[0], gy: spec[1], x: px(spec[0]), y: py(spec[1]),
        label: spec[2] || 'E', dx: ov.dx || 0, dy: ov.dy || 0, text: ov.text || null,
        terminus: false
      };
    });
    Object.keys(layout.stations).forEach(function (id) {
      if (!network.stations[id]) errors.push('Schematic lists unknown station "' + id + '"');
    });

    // duplicate grid positions
    var seen = {};
    Object.keys(stations).forEach(function (id) {
      var k = stations[id].gx + ',' + stations[id].gy;
      if (seen[k]) errors.push('Stations "' + seen[k] + '" and "' + id + '" share grid position ' + k);
      seen[k] = id;
    });

    // edges
    var shared = {}; // key -> [lineId]
    var lines = {};
    network.lineOrder.forEach(function (lid) {
      var line = network.lines[lid];
      var ids = line.stations;
      var edges = [];
      if (stations[ids[0]]) stations[ids[0]].terminus = true;
      if (stations[ids[ids.length - 1]]) stations[ids[ids.length - 1]].terminus = true;
      for (var i = 0; i < ids.length - 1; i++) {
        var a = stations[ids[i]], c = stations[ids[i + 1]];
        if (!a || !c) continue;
        var via = ((layout.via || {})[lid] || {})[ids[i] + '|' + ids[i + 1]] || [];
        var pts = [[a.x, a.y]].concat(via.map(function (p) { return [px(p[0]), py(p[1])]; })).concat([[c.x, c.y]]);
        for (var k = 0; k < pts.length - 1; k++) {
          var dx = Math.abs(pts[k + 1][0] - pts[k][0]), dy = Math.abs(pts[k + 1][1] - pts[k][1]);
          if (!(dx < 1e-6 || dy < 1e-6 || Math.abs(dx - dy) < 1e-6)) {
            errors.push('Line ' + lid + ': segment ' + ids[i] + ' → ' + ids[i + 1] + ' is not octilinear (dx=' + r2(dx / unit) + ', dy=' + r2(dy / unit) + ')');
          }
        }
        var key = [ids[i], ids[i + 1]].sort().join('|');
        (shared[key] = shared[key] || []).push(lid);
        edges.push({ from: ids[i], to: ids[i + 1], key: key, points: pts });
      }
      lines[lid] = { id: lid, color: line.color, number: line.number, name: line.name, edges: edges, termini: line.termini };
    });
    // offsets for shared edges
    Object.keys(lines).forEach(function (lid) {
      lines[lid].edges.forEach(function (e) {
        var group = shared[e.key];
        e.shared = group.length > 1 ? group.slice() : null;
        e.offsetIndex = group.indexOf(lid);
        e.offsetCount = group.length;
      });
    });

    return {
      unit: unit, bounds: b,
      width: Math.round((b.maxX - b.minX) * unit), height: Math.round((b.maxY - b.minY) * unit),
      px: px, py: py,
      stations: stations, lines: lines, lineOrder: network.lineOrder.slice(),
      districts: (layout.districts || []).map(function (d) { return { x: px(d.x), y: py(d.y), text: d.text }; }),
      legend: layout.legend ? { x: px(layout.legend.x), y: py(layout.legend.y) } : null,
      title: layout.title ? { x: px(layout.title.x), y: py(layout.title.y) } : null,
      compass: layout.compass ? { x: px(layout.compass.x), y: py(layout.compass.y) } : null,
      errors: errors
    };
  }

  /* --------------------------------------------------------------- svg */

  function offsetSegment(p, q, off) {
    var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = -dy / len * off, ny = dx / len * off;
    return [[p[0] + nx, p[1] + ny], [q[0] + nx, q[1] + ny]];
  }

  function edgePath(edge, gap) {
    var pts = edge.points;
    if (!edge.shared) {
      return 'M' + pts.map(function (p) { return r2(p[0]) + ' ' + r2(p[1]); }).join(' L');
    }
    var off = (edge.offsetIndex - (edge.offsetCount - 1) / 2) * gap;
    var d = '';
    for (var i = 0; i < pts.length - 1; i++) {
      var seg = offsetSegment(pts[i], pts[i + 1], off);
      d += (i ? ' L' : 'M') + r2(seg[0][0]) + ' ' + r2(seg[0][1]) + ' L' + r2(seg[1][0]) + ' ' + r2(seg[1][1]);
    }
    return d;
  }

  /** Label geometry for a station: anchor, rotation, text-anchor, baseline. */
  function labelSpec(st, unit, lang) {
    var g = 0.36 * unit; // gap from the station centre
    var ring = st.interchange ? 0.1 * unit : 0;
    var x = st.x + st.dx * unit, y = st.y + st.dy * unit;
    var mode = st.label;
    switch (mode) {
      case 'E': return { x: x + g + ring, y: y, rotate: 0, anchor: 'start', baseline: 'middle' };
      case 'W': return { x: x - g - ring, y: y, rotate: 0, anchor: 'end', baseline: 'middle' };
      case 'N': return { x: x + 0.16 * unit, y: y - 0.28 * unit - ring, rotate: -45, anchor: 'start', baseline: 'middle' };
      case 'S': return { x: x - 0.16 * unit, y: y + 0.28 * unit + ring, rotate: -45, anchor: 'end', baseline: 'middle' };
      case 'n': return { x: x, y: y - g - ring, rotate: 0, anchor: 'middle', baseline: 'bottom' };
      case 's': return { x: x, y: y + g + ring, rotate: 0, anchor: 'middle', baseline: 'top' };
      case 'NE': return { x: x + 0.3 * unit, y: y - 0.3 * unit, rotate: 0, anchor: 'start', baseline: 'middle' };
      case 'NW': return { x: x - 0.3 * unit, y: y - 0.3 * unit, rotate: 0, anchor: 'end', baseline: 'middle' };
      case 'SE': return { x: x + 0.3 * unit, y: y + 0.3 * unit, rotate: 0, anchor: 'start', baseline: 'middle' };
      case 'SW': return { x: x - 0.3 * unit, y: y + 0.3 * unit, rotate: 0, anchor: 'end', baseline: 'middle' };
      default: return { x: x + g, y: y, rotate: 0, anchor: 'start', baseline: 'middle' };
    }
  }

  function labelText(st, lang) {
    var t = (st.text && st.text[lang]) || (st.name[lang] || st.name.en);
    return String(t).split('\n');
  }

  /**
   * One <text> element per line (more robust than tspans for RTL text across renderers).
   * The whole diagram is laid out as an LTR paragraph (direction="ltr" on the root), so
   * text-anchor is purely visual (start = left edge, end = right edge) in every renderer;
   * Arabic strings render as RTL runs inside it. Strings that start/end with neutral
   * characters (arrows) are wrapped in RLM marks in the data to pin them to the Arabic run.
   */
  function textEl(lines, spec, cls, fontSize, extraAttr) {
    var lh = fontSize * 1.12;
    var n = lines.length;
    var first;
    if (spec.baseline === 'top') first = spec.y + fontSize * 0.9;
    else if (spec.baseline === 'bottom') first = spec.y - (n - 1) * lh - fontSize * 0.1;
    else first = spec.y - (n - 1) * lh / 2 + fontSize * 0.35;
    var attr = ' class="' + cls + '" text-anchor="' + spec.anchor + '" font-size="' + r2(fontSize) + '"' + (extraAttr || '');
    if (spec.rotate) attr += ' transform="rotate(' + spec.rotate + ' ' + r2(spec.x) + ' ' + r2(spec.y) + ')"';
    return lines.map(function (ln, i) {
      return '<text x="' + r2(spec.x) + '" y="' + r2(first + i * lh) + '"' + attr + '>' + esc(ln) + '</text>';
    }).join('');
  }

  var DEFAULT_CSS = [
    '.sch{font-family:"Segoe UI",Tahoma,"Noto Sans Arabic","Noto Naskh Arabic UI","Helvetica Neue",Arial,sans-serif}',
    '.sch .bg{fill:#fbfbf9}',
    '.sch .line{fill:none;stroke-linecap:round;stroke-linejoin:round}',
    '.sch .st{fill:#fff;stroke-width:2.6}',
    '.sch .st.x{stroke:#1a1a1a;stroke-width:3}',
    '.sch .st.t{stroke-width:3.4}',
    '.sch .lbl{fill:#1f2937;paint-order:stroke;stroke:#fbfbf9;stroke-width:3px;stroke-linejoin:round}',
    '.sch .lbl.x{font-weight:700;fill:#111}',
    '.sch .lbl.t{font-weight:700}',
    '.sch .district{fill:#9ca3af;font-weight:700;letter-spacing:.08em}',
    '.sch .title{fill:#111;font-weight:800}',
    '.sch .sub{fill:#6b7280}',
    '.sch .legend text{fill:#374151}',
    '.sch .hit{fill:transparent;cursor:pointer}',
    '.sch.interactive .lbl{cursor:pointer}',
    '.sch .dim .line,.sch .dim .st,.sch .dim .lbl{opacity:.22}',
    '.sch .dim .lbl{stroke:none}',
    '.sch .route .line{stroke-width:11}',
    '.sch .route .halo{stroke:#fff;stroke-width:17}',
    '.sch .route .st{stroke-width:3}',
    '.sch .ab{font-weight:800;fill:#fff;text-anchor:middle}',
    '.sch .hover .st{stroke:#0ea5e9!important}'
  ].join('\n');

  /**
   * Render the schematic as an SVG string.
   * @param {object} model   from build()
   * @param {object} opts    { lang:'ar'|'en', interactive:bool, title:bool, legend:bool, css:bool, id:string }
   */
  function svg(model, opts) {
    opts = opts || {};
    var lang = opts.lang || 'ar';
    var u = model.unit;
    var fs = 0.285 * u;
    var lw = 0.22 * u;
    var gap = 0.26 * u;
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + model.width + ' ' + model.height + '" width="' + model.width + '" height="' + model.height + '" direction="ltr" class="sch' + (opts.interactive ? ' interactive' : '') + '"' + (opts.id ? ' id="' + esc(opts.id) + '"' : '') + ' role="img" aria-label="' + esc(lang === 'ar' ? 'مخطط شبكة مترو الرياض' : 'Riyadh Metro network diagram') + '">');
    if (opts.css !== false) out.push('<style>' + DEFAULT_CSS + '</style>');
    out.push('<rect class="bg" width="' + model.width + '" height="' + model.height + '"/>');

    // districts
    model.districts.forEach(function (d) {
      out.push('<text class="district" x="' + r2(d.x) + '" y="' + r2(d.y) + '" font-size="' + r2(fs * 0.95) + '" text-anchor="middle">' + esc(d.text[lang] || d.text.en) + '</text>');
    });

    // lines
    out.push('<g class="net" id="sch-net">');
    out.push('<g class="lines">');
    model.lineOrder.forEach(function (lid) {
      var line = model.lines[lid];
      out.push('<g class="l" data-line="' + lid + '">');
      line.edges.forEach(function (e) {
        out.push('<path class="line" data-line="' + lid + '" data-from="' + e.from + '" data-to="' + e.to + '" d="' + edgePath(e, gap) + '" stroke="' + line.color + '" stroke-width="' + r2(lw) + '"/>');
      });
      out.push('</g>');
    });
    out.push('</g>');

    // stations
    out.push('<g class="stations">');
    Object.keys(model.stations).forEach(function (id) {
      var st = model.stations[id];
      var color = model.lines[st.lines[0]].color;
      var cls = 'st' + (st.interchange ? ' x' : '') + (st.terminus && !st.interchange ? ' t' : '');
      var r = st.interchange ? (st.lines.length > 2 ? 0.27 * u : 0.22 * u) : 0.15 * u;
      out.push('<g class="s" data-st="' + id + '">');
      out.push('<circle class="' + cls + '" cx="' + r2(st.x) + '" cy="' + r2(st.y) + '" r="' + r2(r) + '"' + (st.interchange ? '' : ' stroke="' + color + '"') + '/>');
      if (st.interchange && st.lines.length > 2) out.push('<circle cx="' + r2(st.x) + '" cy="' + r2(st.y) + '" r="' + r2(0.09 * u) + '" fill="#1a1a1a"/>');
      var spec = labelSpec(st, u, lang);
      out.push(textEl(labelText(st, lang), spec, 'lbl' + (st.interchange ? ' x' : '') + (st.terminus ? ' t' : ''), st.interchange ? fs * 1.05 : fs, ' data-st="' + id + '"'));
      if (opts.interactive) out.push('<circle class="hit" data-st="' + id + '" cx="' + r2(st.x) + '" cy="' + r2(st.y) + '" r="' + r2(0.42 * u) + '"><title>' + esc((st.name[lang] || st.name.en) + ' · ' + (st.name[lang === 'ar' ? 'en' : 'ar'] || '')) + '</title></circle>');
      out.push('</g>');
    });
    out.push('</g>');
    out.push('</g>'); // net
    out.push('<g class="route" id="sch-route"></g>');

    // title
    var rtl = lang === 'ar';
    if (opts.title !== false && model.title) {
      var tt = rtl ? 'مترو الرياض — مخطط الشبكة' : 'Riyadh Metro — network diagram';
      var sub = rtl ? 'مخطط تخطيطي غير رسمي (المسافات غير حقيقية) · ' + model.lineOrder.length + ' مسارات · ' + Object.keys(model.stations).length + ' محطة' : model.lineOrder.length + ' lines · ' + Object.keys(model.stations).length + ' stations · unofficial schematic (not to scale)';
      var tx = rtl ? model.width - model.title.x : model.title.x;
      var tAnchor = rtl ? 'end' : 'start';
      out.push('<text class="title" x="' + r2(tx) + '" y="' + r2(model.title.y) + '" font-size="' + r2(fs * 1.9) + '" text-anchor="' + tAnchor + '">' + esc(tt) + '</text>');
      out.push('<text class="sub" x="' + r2(tx) + '" y="' + r2(model.title.y + fs * 1.5) + '" font-size="' + r2(fs * 0.95) + '" text-anchor="' + tAnchor + '">' + esc(sub) + '</text>');
    }
    // compass
    if (model.compass) {
      var cx = rtl ? model.width - model.compass.x : model.compass.x, cy = model.compass.y;
      out.push('<g class="compass"><circle cx="' + r2(cx) + '" cy="' + r2(cy) + '" r="' + r2(0.42 * u) + '" fill="#fff" stroke="#9ca3af" stroke-width="1.5"/>' +
        '<path d="M' + r2(cx) + ' ' + r2(cy - 0.3 * u) + ' L' + r2(cx + 0.14 * u) + ' ' + r2(cy + 0.14 * u) + ' L' + r2(cx) + ' ' + r2(cy + 0.02 * u) + ' L' + r2(cx - 0.14 * u) + ' ' + r2(cy + 0.14 * u) + ' Z" fill="#374151"/>' +
        '<text x="' + r2(cx) + '" y="' + r2(cy - 0.5 * u) + '" font-size="' + r2(fs * 0.85) + '" text-anchor="middle" fill="#374151" font-weight="700">N</text></g>');
    }
    // legend
    if (opts.legend !== false && model.legend) {
      var legendW = 9.2 * u;
      var lx = model.legend.x, ly = model.legend.y, row = fs * 1.75;
      var sw = rtl ? lx + legendW - fs * 1.9 : lx;              // swatch x
      var txx = rtl ? sw - fs * 0.5 : lx + fs * 2.4;             // text anchor x
      var ta = ' text-anchor="' + (rtl ? 'end' : 'start') + '"';
      out.push('<g class="legend">');
      model.lineOrder.forEach(function (lid, i) {
        var line = model.lines[lid];
        var y = ly + i * row;
        var first = model.stations[line.termini.first], last = model.stations[line.termini.last];
        out.push('<rect x="' + r2(sw) + '" y="' + r2(y - fs * 0.45) + '" width="' + r2(fs * 1.9) + '" height="' + r2(fs * 0.9) + '" rx="' + r2(fs * 0.45) + '" fill="' + line.color + '"/>');
        out.push('<text x="' + r2(sw + fs * 0.95) + '" y="' + r2(y + fs * 0.33) + '" font-size="' + r2(fs * 0.8) + '" text-anchor="middle" font-weight="800" fill="' + (lid === '4' ? '#111' : '#fff') + '">' + line.number + '</text>');
        out.push('<text x="' + r2(txx) + '" y="' + r2(y + fs * 0.35) + '" font-size="' + r2(fs * 0.95) + '"' + ta + '><tspan font-weight="700">' + esc(line.name[lang] || line.name.en) + '</tspan>' +
          (first && last ? '<tspan fill="#6b7280"> · ' + esc((first.name[lang] || first.name.en) + ' ⇄ ' + (last.name[lang] || last.name.en)) + '</tspan>' : '') + '</text>');
      });
      var iy = ly + model.lineOrder.length * row;
      out.push('<circle cx="' + r2(sw + fs * 0.95) + '" cy="' + r2(iy) + '" r="' + r2(0.2 * u) + '" fill="#fff" stroke="#1a1a1a" stroke-width="3"/>');
      out.push('<text x="' + r2(txx) + '" y="' + r2(iy + fs * 0.35) + '" font-size="' + r2(fs * 0.95) + '"' + ta + '>' + esc(rtl ? 'محطة تبادل بين المسارات' : 'Interchange station') + '</text>');
      out.push('<text class="sub" x="' + r2(rtl ? lx + legendW : lx) + '" y="' + r2(iy + row * 1.1) + '" font-size="' + r2(fs * 0.8) + '"' + ta + '>' + esc(rtl ? 'المسار الأصفر والبنفسجي يتشاركان المحطات الأربع من المركز المالي إلى سابك' : 'Yellow and Purple share the four stations from KAFD to SABIC') + '</text>');
      out.push('</g>');
    }
    out.push('</svg>');
    return (opts.standalone ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '') + out.join('\n');
  }

  /**
   * SVG fragment highlighting an itinerary on the diagram (to be injected into #sch-route).
   */
  function routeOverlay(model, itinerary, lang) {
    if (!itinerary || !itinerary.legs || !itinerary.legs.length) return '';
    var u = model.unit, out = [];
    var halo = [], paths = [];
    itinerary.legs.forEach(function (leg) {
      var line = model.lines[leg.line];
      for (var i = 0; i < leg.stations.length - 1; i++) {
        var a = leg.stations[i], b = leg.stations[i + 1];
        var e = line.edges.find(function (x) { return (x.from === a && x.to === b) || (x.from === b && x.to === a); });
        if (!e) continue;
        var d = edgePath(e, 0.26 * u);
        halo.push('<path class="line halo" d="' + d + '"/>');
        paths.push('<path class="line" d="' + d + '" stroke="' + line.color + '"/>');
      }
    });
    out.push(halo.join(''));
    out.push(paths.join(''));
    // stations along the way
    itinerary.legs.forEach(function (leg) {
      var line = model.lines[leg.line];
      leg.stations.slice(1, -1).forEach(function (id) {
        var st = model.stations[id];
        if (!st) return;
        out.push('<circle class="st" cx="' + r2(st.x) + '" cy="' + r2(st.y) + '" r="' + r2(0.15 * u) + '" stroke="' + line.color + '"/>');
      });
    });
    (itinerary.transfers || []).forEach(function (tr) {
      var st = model.stations[tr.station];
      if (!st) return;
      out.push('<circle cx="' + r2(st.x) + '" cy="' + r2(st.y) + '" r="' + r2(0.3 * u) + '" fill="#fff" stroke="#111" stroke-width="4"/>');
      out.push('<text x="' + r2(st.x) + '" y="' + r2(st.y + 0.12 * u) + '" font-size="' + r2(0.3 * u) + '" text-anchor="middle" font-weight="800" fill="#111">⇄</text>');
    });
    var ends = [[itinerary.from, '#16a34a', 'A'], [itinerary.to, '#dc2626', 'B']];
    ends.forEach(function (e) {
      var st = model.stations[e[0]];
      if (!st) return;
      out.push('<circle cx="' + r2(st.x) + '" cy="' + r2(st.y) + '" r="' + r2(0.36 * u) + '" fill="' + e[1] + '" stroke="#fff" stroke-width="3"/>');
      out.push('<text class="ab" x="' + r2(st.x) + '" y="' + r2(st.y + 0.13 * u) + '" font-size="' + r2(0.36 * u) + '">' + e[2] + '</text>');
    });
    return out.join('');
  }

  return { build: build, svg: svg, routeOverlay: routeOverlay, labelSpec: labelSpec, edgePath: edgePath };
});

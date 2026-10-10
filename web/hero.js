/* Riyadh Metro Navigator — hero network
 * ---------------------------------------------------------------------------
 * The hero of the landing page is not an illustration: it is the real network,
 * generated at runtime from data/schematic.json through the same schematic
 * engine that draws the interactive diagram and the printable SVG.
 *
 *   RMHero.build(model, opts)   → SVG markup (pure, no DOM — unit tested)
 *   RMHero.mount(el, model, o)  → animated, interactive controller
 *   RMHero.lineStats(model, network) → facts for the line rail
 *
 * UMD: `require('./hero')` in Node, `window.RMHero` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./lib/schematic.js'));
  else root.RMHero = factory(root.RMSchematic);
})(typeof self !== 'undefined' ? self : this, function (RMSchematic) {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function r2(n) { return Math.round(n * 100) / 100; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function nameOf(st, lang) { return (st.name && (st.name[lang] || st.name.en)) || ''; }

  /* ------------------------------------------------------------------ model */

  /** One continuous centre-line path per line (shared-track offsets ignored —
   *  this path exists only to carry the animated trains). */
  function centrePath(line) {
    var pts = [];
    line.edges.forEach(function (e) {
      if (!pts.length) pts.push(e.points[0]);
      pts = pts.concat(e.points.slice(1));
    });
    if (pts.length < 2) return '';
    return 'M' + pts.map(function (p) { return r2(p[0]) + ' ' + r2(p[1]); }).join(' L');
  }

  /** Facts about every line, used by the hero rail and the lines showcase. */
  function lineStats(model, network) {
    return model.lineOrder.map(function (lid) {
      var line = model.lines[lid];
      var first = model.stations[line.termini.first], last = model.stations[line.termini.last];
      var net = network ? network.lines[lid] : null;
      return {
        id: lid,
        number: line.number,
        color: line.color,
        name: line.name,
        from: first ? first.name : null,
        to: last ? last.name : null,
        stations: net ? net.stations.length : line.edges.length + 1,
        km: net ? net.officialLengthKm : null,
        interchanges: net ? net.stations.filter(function (id) { return network.stations[id].interchange; }).length : 0
      };
    });
  }

  /* -------------------------------------------------------------------- svg */

  var DEFAULTS = {
    lang: 'ar',
    interactive: true,
    trains: true,
    labels: true,          // interchange + terminus names
    districts: true,
    id: 'hero-svg',
    unitScale: 1           // marker sizing multiplier
  };

  /**
   * Render the hero network as an SVG string.
   * @param {object} model  from RMSchematic.build
   * @param {object} [opts] see DEFAULTS
   */
  function build(model, opts) {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = opts && opts[k] !== undefined ? opts[k] : DEFAULTS[k]; });
    var u = model.unit * o.unitScale;
    var lang = o.lang;
    var out = [];

    out.push('<svg id="' + o.id + '" class="hn-svg" xmlns="' + SVG_NS + '" viewBox="0 0 ' + model.width + ' ' + model.height +
      '" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true" focusable="false">');

    /* defs — one soft glow + a hairline grid, both cheap to composite */
    out.push('<defs>' +
      '<filter id="hn-glow" x="-60%" y="-60%" width="220%" height="220%">' +
      '<feGaussianBlur stdDeviation="' + r2(u * 0.32) + '" result="b"/>' +
      '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>' +
      '<pattern id="hn-grid" width="' + r2(u * 2) + '" height="' + r2(u * 2) + '" patternUnits="userSpaceOnUse">' +
      '<path d="M' + r2(u * 2) + ' 0H0V' + r2(u * 2) + '" fill="none" class="hn-gridline"/></pattern>' +
      '</defs>');

    out.push('<rect class="hn-bg" width="' + model.width + '" height="' + model.height + '"/>');
    out.push('<rect class="hn-gridrect" width="' + model.width + '" height="' + model.height + '" fill="url(#hn-grid)"/>');

    /* districts (neighbourhood names from the layout file) */
    if (o.districts && model.districts && model.districts.length) {
      out.push('<g class="hn-districts">');
      model.districts.forEach(function (d) {
        out.push('<text x="' + r2(d.x) + '" y="' + r2(d.y) + '" font-size="' + r2(u * 0.62) + '">' + esc(d.text) + '</text>');
      });
      out.push('</g>');
    }

    /* lines — one group per line, one path per edge (keeps shared tracks legible) */
    out.push('<g class="hn-lines">');
    model.lineOrder.forEach(function (lid) {
      var line = model.lines[lid];
      out.push('<g class="hn-line" data-line="' + lid + '" style="--line:' + line.color + '">');
      line.edges.forEach(function (e) {
        out.push('<path class="hn-edge" d="' + RMSchematic.edgePath(e, 0.3 * u) + '"/>');
      });
      out.push('<path class="hn-centre" id="hn-centre-' + lid + '" d="' + centrePath(line) + '"/>');
      out.push('</g>');
    });
    out.push('</g>');

    /* stations */
    out.push('<g class="hn-stations">');
    Object.keys(model.stations).forEach(function (id) {
      var st = model.stations[id];
      var x = r2(st.x), y = r2(st.y);
      out.push('<g class="hn-st' + (st.interchange ? ' x' : '') + (st.terminus ? ' t' : '') + '" data-st="' + id + '" data-lines="' + st.lines.join(' ') + '">');
      if (st.interchange) out.push('<circle class="hn-ring" cx="' + x + '" cy="' + y + '" r="' + r2(u * 0.3) + '"/>');
      out.push('<circle class="hn-dot" cx="' + x + '" cy="' + y + '" r="' + r2(u * (st.interchange ? 0.15 : 0.13)) + '"/>');
      if (o.interactive) out.push('<circle class="hn-hit" cx="' + x + '" cy="' + y + '" r="' + r2(u * 0.55) + '"><title>' + esc(nameOf(st, lang)) + '</title></circle>');
      out.push('</g>');
    });
    out.push('</g>');

    /* names for the stations that matter at a glance */
    if (o.labels) {
      out.push('<g class="hn-names">');
      Object.keys(model.stations).forEach(function (id) {
        var st = model.stations[id];
        if (!st.interchange && !st.terminus) return;
        var spec = RMSchematic.labelSpec(st, u, lang);
        var txt = nameOf(st, lang) || nameOf(st, 'en');
        var cls = 'hn-name' + (st.interchange ? ' x' : '');
        var attr = ' class="' + cls + '" text-anchor="' + spec.anchor + '" font-size="' + r2(u * 0.44) + '"';
        if (spec.rotate) attr += ' transform="rotate(' + spec.rotate + ' ' + r2(spec.x) + ' ' + r2(spec.y) + ')"';
        out.push('<text x="' + r2(spec.x) + '" y="' + r2(spec.y + u * 0.15) + '"' + attr + '>' + esc(txt) + '</text>');
      });
      out.push('</g>');
    }

    /* animated trains (positioned by mount(); harmless when scripting is off) */
    if (o.trains) {
      out.push('<g class="hn-trains">');
      model.lineOrder.forEach(function (lid) {
        var line = model.lines[lid];
        out.push('<g class="hn-train" data-line="' + lid + '" style="--line:' + line.color + '">' +
          '<circle class="hn-train-halo" r="' + r2(u * 0.42) + '"/>' +
          '<rect class="hn-train-body" x="' + r2(-u * 0.34) + '" y="' + r2(-u * 0.15) + '" width="' + r2(u * 0.68) + '" height="' + r2(u * 0.3) + '" rx="' + r2(u * 0.15) + '"/>' +
          '</g>');
      });
      out.push('</g>');
    }

    /* itinerary overlay target (filled by RMHero.routeOverlay) */
    out.push('<g class="hn-route" id="hn-route"></g>');
    out.push('</svg>');
    return out.join('');
  }

  /** Itinerary overlay markup for the hero (delegates to the shared schematic engine). */
  function routeOverlay(model, itinerary, lang) {
    return RMSchematic.routeOverlay(model, itinerary, lang);
  }

  /* -------------------------------------------------------------- behaviour */

  /**
   * Mount the hero: draw-in animation, travelling trains, line focus and taps.
   * Everything degrades: without rAF/IntersectionObserver the SVG still renders.
   * @returns {object} controller
   */
  function mount(host, model, opts) {
    var o = opts || {};
    host.innerHTML = build(model, o);
    var svg = host.querySelector('.hn-svg');
    var trains = Array.prototype.slice.call(svg.querySelectorAll('.hn-train'));
    var lines = Array.prototype.slice.call(svg.querySelectorAll('.hn-line'));
    var stations = Array.prototype.slice.call(svg.querySelectorAll('.hn-st'));
    var routeLayer = svg.querySelector('#hn-route');
    var raf = null, running = false, visible = true, startedAt = 0;
    var reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* one-time draw-in of the network */
    function drawIn() {
      if (reduce) return;
      var delay = 0;
      lines.forEach(function (g, gi) {
        Array.prototype.forEach.call(g.querySelectorAll('.hn-edge'), function (p) {
          var len = 0;
          try { len = p.getTotalLength(); } catch (e) { return; }
          if (!len) return;
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = len;
          p.style.transition = 'stroke-dashoffset 900ms cubic-bezier(.22,.61,.36,1) ' + delay + 'ms';
          delay += 26;
          requestAnimationFrame(function () { p.style.strokeDashoffset = '0'; });
        });
        delay += 60 - Math.min(60, gi * 6);
      });
    }

    /* trains travel their centre line at a steady, slightly varied pace */
    var tracks = trains.map(function (g, i) {
      var lid = g.getAttribute('data-line');
      var path = svg.querySelector('#hn-centre-' + lid);
      var len = 0;
      try { len = path ? path.getTotalLength() : 0; } catch (e) { len = 0; }
      return { g: g, path: path, len: len, period: 21000 + i * 2600, offset: i * 0.13 };
    });

    function place(track, t) {
      if (!track.path || !track.len) return;
      var p = ((t / track.period) + track.offset) % 1;
      var at = track.path.getPointAtLength(p * track.len);
      var ahead = track.path.getPointAtLength(Math.min(track.len, p * track.len + 2));
      var angle = Math.atan2(ahead.y - at.y, ahead.x - at.x) * 180 / Math.PI;
      track.g.setAttribute('transform', 'translate(' + r2(at.x) + ',' + r2(at.y) + ') rotate(' + r2(angle) + ')');
    }

    function frame(now) {
      if (!startedAt) startedAt = now;
      tracks.forEach(function (tr) { place(tr, now - startedAt); });
      raf = running ? requestAnimationFrame(frame) : null;
    }

    function start() { if (running || reduce || !visible) return; running = true; raf = requestAnimationFrame(frame); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = null; }

    if (reduce) tracks.forEach(function (tr) { place(tr, tr.period * 0.32); });
    else {
      start();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
        if (window.IntersectionObserver) {
          new IntersectionObserver(function (entries) {
            visible = entries.some(function (e) { return e.isIntersecting; });
            if (visible) start(); else stop();
          }, { rootMargin: '120px' }).observe(host);
        }
      }
    }

    drawIn();

    var api = {
      svg: svg,
      model: model,
      /** Highlight one line (null resets) and report which stations belong to it. */
      focusLine: function (lid) {
        svg.classList.toggle('is-focused', !!lid);
        lines.forEach(function (g) { g.classList.toggle('is-focus', !!lid && g.getAttribute('data-line') === lid); });
        stations.forEach(function (g) {
          var on = !lid || (' ' + (g.getAttribute('data-lines') || '') + ' ').indexOf(' ' + lid + ' ') >= 0;
          g.classList.toggle('is-focus', !!lid && on);
        });
        trains.forEach(function (g) { g.classList.toggle('is-focus', !!lid && g.getAttribute('data-line') === lid); });
      },
      /** Draw a planned itinerary over the network. */
      highlightRoute: function (itinerary, lang) {
        if (!routeLayer) return;
        routeLayer.innerHTML = itinerary ? routeOverlay(model, itinerary, lang || o.lang) : '';
        svg.classList.toggle('has-route', !!itinerary);
      },
      /** Mark the current A/B selection without a full itinerary. */
      markEnds: function (fromId, toId) {
        if (!routeLayer) return;
        var u = model.unit;
        var mark = function (id, color, letter) {
          var st = model.stations[id];
          if (!st) return '';
          return '<circle cx="' + r2(st.x) + '" cy="' + r2(st.y) + '" r="' + r2(u * 0.4) + '" fill="' + color + '" stroke="#fff" stroke-width="' + r2(u * 0.08) + '"/>' +
            '<text class="hn-ab" x="' + r2(st.x) + '" y="' + r2(st.y + u * 0.14) + '" font-size="' + r2(u * 0.4) + '">' + letter + '</text>';
        };
        routeLayer.innerHTML = mark(fromId, '#16a34a', 'A') + mark(toId, '#dc2626', 'B');
      },
      onStation: function (handler) {
        svg.addEventListener('click', function (e) {
          var el = e.target.closest ? e.target.closest('[data-st]') : null;
          if (el) handler(el.getAttribute('data-st'));
        });
      },
      destroy: function () { stop(); host.innerHTML = ''; }
    };
    return api;
  }

  return { build: build, mount: mount, lineStats: lineStats, centrePath: centrePath, routeOverlay: routeOverlay };
});

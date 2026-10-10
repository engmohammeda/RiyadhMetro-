/*
 * Riyadh Metro Navigator — service hours, fares and trip timing
 *
 * Pure functions over data/config.json ("service" and "fares" sections).
 * Riyadh has no daylight-saving time, so "local time" is UTC+3 — computed
 * without Intl so it behaves the same in every browser and in Node.
 *
 * UMD: `require('./service')` in Node, `window.RMService` in the browser.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RMService = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RIYADH_OFFSET_MIN = 180;
  var DAY = 1440;

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /** "05:30" → 330, "24:00" → 1440 */
  function parseHM(s) { var p = String(s).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  /** 330 → "05:30"; values ≥ 1440 wrap ("24:00" → "00:00") */
  function formatHM(min) { var m = ((Math.round(min) % DAY) + DAY) % DAY; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }

  /** Current wall-clock time in Riyadh: { dow (0 = Sunday … 6 = Saturday), minutes since midnight, date parts } */
  function riyadhNow(date) {
    var d = date ? new Date(date) : new Date();
    var shifted = new Date(d.getTime() + RIYADH_OFFSET_MIN * 60000);
    return {
      dow: shifted.getUTCDay(),
      minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
      y: shifted.getUTCFullYear(), m: shifted.getUTCMonth() + 1, d: shifted.getUTCDate(),
      epoch: d.getTime()
    };
  }

  /** Operating window for a weekday → { open, close } in minutes (close may be 1440 = midnight) or null */
  function windowFor(config, dow) {
    var svc = (config && config.service) || {};
    var rules = svc.hours || [];
    for (var i = 0; i < rules.length; i++) {
      if ((rules[i].days || []).indexOf(dow) >= 0) return { open: parseHM(rules[i].open), close: parseHM(rules[i].close), rule: rules[i] };
    }
    return null;
  }

  /**
   * Is the metro running at (dow, minutes)? Returns a status object:
   * { open, closesAt, opensAt, opensDow, minutesToClose, minutesToOpen }
   */
  function status(config, now) {
    now = now || riyadhNow();
    var w = windowFor(config, now.dow);
    var out = { open: false, closesAt: null, opensAt: null, opensDow: now.dow, minutesToClose: null, minutesToOpen: null };
    if (w && now.minutes >= w.open && now.minutes < w.close) {
      out.open = true; out.closesAt = formatHM(w.close); out.minutesToClose = w.close - now.minutes;
      return out;
    }
    // closed: find the next opening (today if before open, else following days)
    if (w && now.minutes < w.open) {
      out.opensAt = formatHM(w.open); out.minutesToOpen = w.open - now.minutes; out.opensDow = now.dow;
      return out;
    }
    for (var k = 1; k <= 7; k++) {
      var dow = (now.dow + k) % 7, wk = windowFor(config, dow);
      if (wk) { out.opensAt = formatHM(wk.open); out.opensDow = dow; out.minutesToOpen = k * DAY - now.minutes + wk.open; return out; }
    }
    return out;
  }

  /**
   * Departure choices for a "Leave at" selector: now + every 30 min for the next 24 h.
   * Each item: { value: 'now' | 'd<dayOffset>t<minutes>', minutes, dayOffset, label }
   */
  function departureOptions(now, stepMin) {
    now = now || riyadhNow();
    stepMin = stepMin || 30;
    var out = [{ value: 'now', minutes: now.minutes, dayOffset: 0, label: 'now' }];
    var first = Math.ceil((now.minutes + 1) / stepMin) * stepMin;
    for (var t = first; t < first + DAY; t += stepMin) {
      var dayOffset = Math.floor(t / DAY), minutes = t % DAY;
      out.push({ value: 'd' + dayOffset + 't' + minutes, minutes: minutes, dayOffset: dayOffset, label: formatHM(minutes) + (dayOffset ? ' (+' + dayOffset + ')' : '') });
    }
    return out;
  }

  function parseDeparture(value, now) {
    now = now || riyadhNow();
    if (!value || value === 'now') return { minutes: now.minutes, dayOffset: 0, isNow: true };
    var m = /^d(\d+)t(\d+)$/.exec(value);
    if (!m) return { minutes: now.minutes, dayOffset: 0, isNow: true };
    return { minutes: +m[2], dayOffset: +m[1], isNow: false };
  }

  /**
   * Clock times for a trip.
   * @param config   project config
   * @param dep      { minutes, dayOffset, isNow } (see parseDeparture)
   * @param travelMinutes  itinerary.totalMinutes (+ walking)
   * @param now      riyadhNow()
   * @returns { departAt, arriveAt, waitMinutes, warnings: [...], serviceOpen, shifted }
   *   warnings: 'closed' (metro not running at departure – times computed from the next opening),
   *             'late' (arrival after the last service of the day), 'tight' (< 20 min before closing)
   */
  function tripTiming(config, dep, travelMinutes, now) {
    now = now || riyadhNow();
    var model = (config && config.travelModel) || {};
    var wait = dep.isNow ? (model.initialWaitMinutes || 3) : 0;
    var dow = (now.dow + dep.dayOffset) % 7;
    var start = dep.minutes;
    var warnings = [];
    var w = windowFor(config, dow);
    var shifted = false;
    if (!w || start < w.open || start >= w.close) {
      warnings.push('closed');
      // move to next opening
      if (w && start < w.open) start = w.open;
      else {
        for (var k = 1; k <= 7; k++) {
          var d2 = (dow + k) % 7, w2 = windowFor(config, d2);
          if (w2) { dow = d2; w = w2; start = w2.open; dep = { minutes: start, dayOffset: dep.dayOffset + k, isNow: false }; break; }
        }
      }
      shifted = true;
      wait = 0;
    }
    var departAt = start + wait;
    var arriveAt = departAt + travelMinutes;
    if (w && arriveAt > w.close) warnings.push('late');
    else if (w && w.close - arriveAt < 20) warnings.push('tight');
    return {
      departAt: formatHM(departAt), arriveAt: formatHM(arriveAt),
      departMinutes: departAt, arriveMinutes: arriveAt, dow: dow,
      waitMinutes: wait, warnings: warnings, shifted: shifted,
      closesAt: w ? formatHM(w.close) : null, opensAt: w ? formatHM(w.open) : null
    };
  }

  /** Ticket needed for a trip: the cheapest pass whose validity covers it (always the 2-hour ticket here). */
  function fareFor(config, totalMinutes) {
    var fares = (config && config.fares) || {};
    var tickets = fares.tickets || [];
    var t = tickets.filter(function (x) { return !x.validMinutes || x.validMinutes >= (totalMinutes || 0); })[0] || tickets[0];
    if (!t) return null;
    return { ticket: t, standard: t.price, first: t.firstClass, currency: fares.currency || 'SAR' };
  }

  /** Human weekday names */
  var DOW = {
    ar: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };

  return {
    parseHM: parseHM, formatHM: formatHM, riyadhNow: riyadhNow, windowFor: windowFor, status: status,
    departureOptions: departureOptions, parseDeparture: parseDeparture, tripTiming: tripTiming, fareFor: fareFor, DOW: DOW
  };
});

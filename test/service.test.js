'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadData } = require('./helpers');
const svc = require('../src/service');

const cfg = loadData().config;

test('time helpers', () => {
  assert.equal(svc.parseHM('05:30'), 330);
  assert.equal(svc.parseHM('24:00'), 1440);
  assert.equal(svc.formatHM(1440), '00:00');
  assert.equal(svc.formatHM(1453), '00:13');
  assert.equal(svc.formatHM(7), '00:07');
  const n = svc.riyadhNow(new Date('2026-10-09T21:00:00Z')); // Friday 21:00 UTC = Saturday 00:00 Riyadh
  assert.equal(n.dow, 6); assert.equal(n.minutes, 0);
});

test('service status: Sat–Thu 05:30–00:00, Friday from 10:00', () => {
  assert.equal(svc.status(cfg, { dow: 1, minutes: 12 * 60 }).open, true);
  assert.equal(svc.status(cfg, { dow: 1, minutes: 12 * 60 }).closesAt, '00:00');
  const fri = svc.status(cfg, { dow: 5, minutes: 9 * 60 });
  assert.equal(fri.open, false); assert.equal(fri.opensAt, '10:00'); assert.equal(fri.opensDow, 5);
  const night = svc.status(cfg, { dow: 6, minutes: 10 });
  assert.equal(night.open, false); assert.equal(night.opensAt, '05:30'); assert.equal(night.minutesToOpen, 320);
  assert.equal(svc.status(cfg, { dow: 4, minutes: 23 * 60 + 59 }).open, true);
  assert.equal(svc.status(cfg, { dow: 4, minutes: 23 * 60 + 59 }).minutesToClose, 1);
});

test('departure options start with "now" then half-hour slots, rolling into the next day', () => {
  const opts = svc.departureOptions({ dow: 1, minutes: 23 * 60 + 5 });
  assert.equal(opts[0].value, 'now');
  assert.equal(opts[1].label, '23:30');
  assert.equal(opts[2].label, '00:00 (+1)'); assert.equal(opts[2].dayOffset, 1);
  assert.equal(opts.length, 1 + 48);
  assert.deepEqual(svc.parseDeparture('d1t180'), { minutes: 180, dayOffset: 1, isNow: false });
  assert.equal(svc.parseDeparture('now', { minutes: 100, dow: 0 }).isNow, true);
});

test('trip timing adds the initial wait, warns when closed / arriving late, shifts to the first train', () => {
  const now = { dow: 1, minutes: 12 * 60 };
  const t1 = svc.tripTiming(cfg, { minutes: 12 * 60, dayOffset: 0, isNow: true }, 33, now);
  assert.equal(t1.waitMinutes, cfg.travelModel.initialWaitMinutes);
  assert.equal(t1.departAt, '12:03'); assert.equal(t1.arriveAt, '12:36'); assert.deepEqual(t1.warnings, []);
  const t2 = svc.tripTiming(cfg, { minutes: 23 * 60 + 40, dayOffset: 0, isNow: false }, 50, now);
  assert.deepEqual(t2.warnings, ['late']); assert.equal(t2.arriveAt, '00:30');
  const t3 = svc.tripTiming(cfg, { minutes: 3 * 60, dayOffset: 1, isNow: false }, 33, now);
  assert.deepEqual(t3.warnings, ['closed']); assert.equal(t3.departAt, '05:30'); assert.equal(t3.arriveAt, '06:03'); assert.equal(t3.shifted, true);
  const t4 = svc.tripTiming(cfg, { minutes: 8 * 60, dayOffset: 0, isNow: false }, 20, { dow: 5, minutes: 7 * 60 }); // Friday morning
  assert.deepEqual(t4.warnings, ['closed']); assert.equal(t4.departAt, '10:00');
  const t5 = svc.tripTiming(cfg, { minutes: 23 * 60 + 30, dayOffset: 0, isNow: false }, 15, now);
  assert.deepEqual(t5.warnings, ['tight']);
});

test('fare: a 2-hour ticket covers every metro trip; first class is priced separately', () => {
  const f = svc.fareFor(cfg, 101);
  assert.equal(f.ticket.id, '2h'); assert.equal(f.standard, 4); assert.equal(f.first, 10); assert.equal(f.currency, 'SAR');
});

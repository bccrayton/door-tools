'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/fraction.js');
const DM = require('../js/doormath.js');

function settings(overrides) {
  return Object.assign(DM.defaultSettings(), overrides);
}

// --- Inset math straight off the whiteboard -------------------------------
// 15" x 20" opening, 2 1/4" stiles/rails, 3/8" tongues, 3/32" gap per side.

test('inset single door: blank loses 3/16 in each direction', () => {
  const s = settings();
  const size = DM.doorSize(s, { width: F.parse('15'), height: F.parse('20'), doorsAcross: 1 });
  assert.equal(F.format(size.width), '14 13/16');  // 15 − 3/16
  assert.equal(F.format(size.height), '19 13/16'); // 20 − 3/16
  assert.deepEqual(size.warnings, []);
});

test('inset stile length = opening height − 3/16', () => {
  const s = settings();
  const size = DM.doorSize(s, { width: F.parse('15'), height: F.parse('20'), doorsAcross: 1 });
  const stile = DM.doorParts(s, size).parts.find(p => p.part === 'Stile');
  assert.equal(F.format(stile.length), '19 13/16');
  assert.equal(stile.qtyPerDoor, 2);
});

test('inset rail length = width − 3/16 − 2(stile width) + 2(tongue)', () => {
  const s = settings();
  const size = DM.doorSize(s, { width: F.parse('15'), height: F.parse('20'), doorsAcross: 1 });
  const rail = DM.doorParts(s, size).parts.find(p => p.part === 'Rail');
  // 15 − 3/16 − 4 1/2 + 3/4 = 11 1/16
  assert.equal(F.format(rail.length), '11 1/16');
  assert.equal(rail.qtyPerDoor, 2);
});

test('inset panel: groove-to-groove minus clearance per side', () => {
  const s = settings();
  const size = DM.doorSize(s, { width: F.parse('15'), height: F.parse('20'), doorsAcross: 1 });
  const panel = DM.doorParts(s, size).parts.find(p => p.part === 'Panel');
  // width: rail length − 2×1/16 = 11 1/16 − 1/8 = 10 15/16
  assert.equal(F.format(panel.width), '10 15/16');
  // height: 19 13/16 − 4 1/2 + 3/4 − 1/8 = 15 15/16
  assert.equal(F.format(panel.length), '15 15/16');
  assert.equal(panel.qtyPerDoor, 1);
});

test('inset pair: three 3/32 gaps across, width split in two', () => {
  const s = settings();
  const size = DM.doorSize(s, { width: F.parse('30'), height: F.parse('20'), doorsAcross: 2 });
  // (30 − 3×3/32) / 2 = (30 − 9/32)/2 = 29 23/32 / 2 = 14 55/64
  assert.equal(F.format(size.width), '14 55/64');
  assert.equal(F.format(size.height), '19 13/16');
});

// --- Overlay math ----------------------------------------------------------

test('overlay single door adds 2×overlay in each direction', () => {
  const s = settings({ mode: 'overlay', overlay: F.frac(1, 2) });
  const size = DM.doorSize(s, { width: F.parse('15'), height: F.parse('20'), doorsAcross: 1 });
  assert.equal(F.format(size.width), '16');
  assert.equal(F.format(size.height), '21');
});

test('overlay pair subtracts the pair gap before splitting', () => {
  const s = settings({ mode: 'overlay', overlay: F.frac(1, 2), pairGap: F.frac(1, 8) });
  const size = DM.doorSize(s, { width: F.parse('30'), height: F.parse('20'), doorsAcross: 2 });
  // (30 + 1 − 1/8)/2 = 30 7/8 / 2 = 15 7/16
  assert.equal(F.format(size.width), '15 7/16');
  assert.equal(F.format(size.height), '21');
});

// --- Drawer fronts -----------------------------------------------------------

test('inset drawer front sizes like a single door', () => {
  const s = settings();
  const res = DM.computeOpening(s, {
    label: 'D1', width: F.parse('15'), height: F.parse('6'), type: 'drawer', qty: 1
  });
  assert.equal(F.format(res.door.width), '14 13/16');
  assert.equal(F.format(res.door.height), '5 13/16');
  assert.equal(res.doorCount, 1);
  assert.equal(res.kind, 'drawer');
});

test('five-piece drawer front produces stiles, rails, and a panel', () => {
  const s = settings();
  const res = DM.computeOpening(s, {
    label: 'D1', width: F.parse('24'), height: F.parse('8'), type: 'drawer', qty: 1
  });
  assert.deepEqual(res.parts.map(p => p.part), ['Stile', 'Rail', 'Panel']);
  assert.deepEqual(res.warnings, []);
});

test('slab drawer front is one full-size piece of frame-thickness stock', () => {
  const s = settings({ drawerStyle: 'slab' });
  const res = DM.computeOpening(s, {
    label: 'D1', width: F.parse('15'), height: F.parse('6'), type: 'drawer', qty: 1
  });
  assert.equal(res.parts.length, 1);
  const slab = res.parts[0];
  assert.equal(slab.part, 'Slab front');
  assert.equal(F.format(slab.width), '14 13/16');
  assert.equal(F.format(slab.length), '5 13/16');
  assert.equal(F.format(slab.thickness), '3/4');
  assert.equal(slab.material, 'Slab stock');
});

test('a shallow five-piece drawer front warns instead of emitting a negative panel', () => {
  const s = settings(); // 2 1/4 rails: a 4" tall front cannot hold two rails
  const res = DM.computeOpening(s, {
    label: 'D1', width: F.parse('15'), height: F.parse('4'), type: 'drawer', qty: 1
  });
  assert.ok(res.warnings.length > 0);
  // ...but the same front as a slab is fine
  const slab = DM.computeOpening(settings({ drawerStyle: 'slab' }), {
    label: 'D1', width: F.parse('15'), height: F.parse('4'), type: 'drawer', qty: 1
  });
  assert.deepEqual(slab.warnings, []);
});

test('legacy openings without a type still compute (doorsAcross migration)', () => {
  const s = settings();
  const pair = DM.computeOpening(s, {
    label: 'Old', width: F.parse('30'), height: F.parse('20'), doorsAcross: 2, qty: 1
  });
  assert.equal(pair.kind, 'pair');
  assert.equal(pair.doorCount, 2);
});

// --- Warnings ---------------------------------------------------------------

test('impossible openings produce warnings, not nonsense parts', () => {
  const s = settings();
  const res = DM.computeOpening(s, {
    label: 'Tiny', width: F.parse('3'), height: F.parse('20'), doorsAcross: 1, qty: 1
  });
  assert.ok(res.warnings.length > 0);
});

// --- Cut list aggregation ----------------------------------------------------

test('cut list merges identical parts across openings', () => {
  const s = settings();
  const openings = [
    { label: 'B1', width: F.parse('15'), height: F.parse('20'), doorsAcross: 1, qty: 2 },
    { label: 'B2', width: F.parse('15'), height: F.parse('20'), doorsAcross: 1, qty: 1 }
  ];
  const cl = DM.computeCutList(s, openings);
  assert.deepEqual(cl.warnings, []);
  const stiles = cl.rows.filter(r => r.part === 'Stile');
  assert.equal(stiles.length, 1);          // identical stiles merged
  assert.equal(stiles[0].qty, 6);          // 3 doors × 2 stiles
  assert.deepEqual(stiles[0].labels.sort(), ['B1', 'B2']);
  const panels = cl.rows.filter(r => r.part === 'Panel');
  assert.equal(panels[0].qty, 3);
});

test('cut list rounds 64ths to the configured grid and flags it', () => {
  const s = settings({ roundDenom: 32 });
  // Pair door width lands on 64ths: 14 55/64 → stile widths fine, rails inherit it.
  const openings = [
    { label: 'Pair', width: F.parse('30'), height: F.parse('20'), doorsAcross: 2, qty: 1 }
  ];
  const cl = DM.computeCutList(s, openings);
  const rail = cl.rows.find(r => r.part === 'Rail');
  // exact: 14 55/64 − 4 1/2 + 3/4 = 11 7/64 → rounds to 11 3/32... check:
  // 11 7/64 = 11.109375 → nearest 1/32 is 11 4/32? 7/64 = 3.5/32 → ties to 4/32 = 1/8
  assert.equal(F.format(rail.length), '11 1/8');
  assert.equal(rail.rounded, true);
});

test('unbuildable openings are excluded from the cut list with a warning', () => {
  const s = settings();
  const openings = [
    { label: 'Bad', width: F.parse('3'), height: F.parse('20'), doorsAcross: 1, qty: 1 },
    { label: 'Good', width: F.parse('15'), height: F.parse('20'), doorsAcross: 1, qty: 1 }
  ];
  const cl = DM.computeCutList(s, openings);
  assert.equal(cl.warnings.length >= 1, true);
  assert.ok(cl.warnings[0].startsWith('Bad:'));
  assert.equal(cl.rows.filter(r => r.part === 'Panel').length, 1);
});

test('frame linear inches totals stiles and rails only', () => {
  const s = settings();
  const openings = [
    { label: 'B1', width: F.parse('15'), height: F.parse('20'), doorsAcross: 1, qty: 1 }
  ];
  const cl = DM.computeCutList(s, openings);
  // 2 stiles × 19 13/16 + 2 rails × 11 1/16 = 39 5/8 + 22 1/8 = 61 3/4
  assert.equal(F.format(DM.frameLinearInches(cl)), '61 3/4');
});

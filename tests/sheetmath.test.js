'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/fraction.js');
const SM = require('../js/sheetmath.js');

const SHEET_4x8 = { width: F.parse('48'), length: F.parse('96') };
const KERF = { kerf: F.frac(1, 8), trim: F.frac(0, 1) };

// The B1 panel from the door tests: 10 15/16 × 15 15/16.
const PANEL = { width: F.parse('10 15/16'), height: F.parse('15 15/16') };

test('gridCount: 20 project panels fit a 4x8 with 1/8 kerf', () => {
  const g = SM.gridCount(SHEET_4x8, PANEL, KERF);
  // across 48": floor(48.125 / 11.0625) = 4 ; along 96": floor(96.125 / 16.0625) = 5
  assert.deepEqual(g, { count: 20, cols: 4, rows: 5, rotated: false });
});

test('gridCount honors rotation when it wins', () => {
  const part = { width: F.parse('30'), height: F.parse('20') };
  const locked = SM.gridCount(SHEET_4x8, part, KERF);
  assert.equal(locked.count, 4);   // 1 col × 4 rows
  const rotated = SM.gridCount(SHEET_4x8, part, Object.assign({}, KERF, { allowRotate: true }));
  assert.equal(rotated.count, 6);  // 2 cols × 3 rows, rotated
  assert.equal(rotated.rotated, true);
});

test('gridCount: trim shrinks the usable area', () => {
  // 48x96 with 1/2" trim per side → 47×95 usable; 24"-wide part: only 1 col
  const g = SM.gridCount(SHEET_4x8,
    { width: F.parse('24'), height: F.parse('40') },
    { kerf: F.frac(1, 8), trim: F.frac(1, 2) });
  assert.equal(g.cols, 1);
  assert.equal(g.rows, 2);
});

test('packParts fills sheets and overflows to a second one', () => {
  const res = SM.packParts(SHEET_4x8, [
    { width: PANEL.width, height: PANEL.height, qty: 25, label: 'P' }
  ], KERF);
  assert.equal(res.totalUnits, 25);
  assert.equal(res.placedUnits, 25);
  assert.equal(res.sheets.length, 2);
  assert.equal(res.sheets[0].placements.length, 20); // matches gridCount
  assert.equal(res.sheets[1].placements.length, 5);
  assert.ok(res.sheets[0].utilization > 0.7 && res.sheets[0].utilization < 0.8);
});

test('packParts separates parts by exactly one kerf', () => {
  const res = SM.packParts(SHEET_4x8, [
    { width: PANEL.width, height: PANEL.height, qty: 2, label: 'P' }
  ], KERF);
  const [a, b] = res.sheets[0].placements;
  // second part starts one part-width + one kerf after the first
  assert.equal(b.x - a.x, a.w + SM.to64(F.frac(1, 8)));
  assert.equal(a.y, b.y);
});

test('packParts respects the trim margin', () => {
  const res = SM.packParts(SHEET_4x8, [
    { width: PANEL.width, height: PANEL.height, qty: 1, label: 'P' }
  ], { kerf: F.frac(1, 8), trim: F.frac(1, 2) });
  const p = res.sheets[0].placements[0];
  assert.equal(p.x, SM.to64(F.frac(1, 2)));
  assert.equal(p.y, SM.to64(F.frac(1, 2)));
});

test('oversize parts are reported unplaced, not silently dropped', () => {
  const res = SM.packParts(SHEET_4x8, [
    { width: F.parse('50'), height: F.parse('100'), qty: 1, label: 'Huge' },
    { width: PANEL.width, height: PANEL.height, qty: 1, label: 'P' }
  ], KERF);
  assert.equal(res.unplaced.length, 1);
  assert.equal(res.unplaced[0].label, 'Huge');
  assert.equal(res.placedUnits, 1);
});

test('rotation rescues a part that only fits sideways', () => {
  const part = { width: F.parse('90'), height: F.parse('40'), qty: 1, label: 'Wide' };
  const locked = SM.packParts(SHEET_4x8, [part], KERF);
  assert.equal(locked.unplaced.length, 1);
  const free = SM.packParts(SHEET_4x8, [part], Object.assign({}, KERF, { allowRotate: true }));
  assert.equal(free.placedUnits, 1);
  assert.equal(free.sheets[0].placements[0].rotated, true);
});

test('whole inset doors: a dozen 14 13/16 × 19 13/16 blanks per 4x8', () => {
  const door = { width: F.parse('14 13/16'), height: F.parse('19 13/16'), qty: 12, label: 'D' };
  const res = SM.packParts(SHEET_4x8, [door], KERF);
  assert.equal(res.sheets.length, 1);   // 3 cols × 4 rows
  assert.equal(res.sheets[0].placements.length, 12);
});

test('mixed sizes pack tallest-first without overlap', () => {
  const res = SM.packParts(SHEET_4x8, [
    { width: F.parse('20'), height: F.parse('30'), qty: 3, label: 'A' },
    { width: F.parse('10'), height: F.parse('12'), qty: 6, label: 'B' }
  ], KERF);
  assert.equal(res.placedUnits, 9);
  assert.equal(res.sheets.length, 1);
  // no two placements overlap
  const ps = res.sheets[0].placements;
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i], b = ps[j];
      const overlap = a.x < b.x + b.w && b.x < a.x + a.w &&
        a.y < b.y + b.h && b.y < a.y + a.h;
      assert.ok(!overlap, `placements ${i} and ${j} overlap`);
    }
  }
});

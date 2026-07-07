'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/fraction.js');
const SM = require('../js/sheetmath.js');
const BM = require('../js/boardmath.js');

const KERF = { kerf: F.frac(1, 8), endTrim: F.frac(0, 1) };

// One B1 door's frame parts: 2 stiles 19 13/16, 2 rails 11 1/16, all 2 1/4 wide.
function b1Parts(qty) {
  return [
    { width: F.parse('2 1/4'), length: F.parse('19 13/16'), qty: 2 * qty, label: 'Stile' },
    { width: F.parse('2 1/4'), length: F.parse('11 1/16'), qty: 2 * qty, label: 'Rail' }
  ];
}

test('a 5 1/2 wide board rips into exactly two 2 1/4 strips', () => {
  const res = BM.packBoards(
    [{ width: F.parse('5 1/2'), length: F.parse('96'), qty: 1, label: 'M1' }],
    b1Parts(1), KERF);
  assert.equal(res.boards.length, 1);
  assert.equal(res.placedUnits, 4);
  // 5.5 fits 2 rips of 2.25 + kerf; a third would need 2.25 more than the
  // remaining 0.75, so at most 2 strips exist even with more parts
  const res2 = BM.packBoards(
    [{ width: F.parse('5 1/2'), length: F.parse('96'), qty: 1, label: 'M1' }],
    b1Parts(4), KERF);
  assert.equal(res2.boards[0].strips.length, 2);
});

test('one door frame fits on a single 96" strip', () => {
  const res = BM.packBoards(
    [{ width: F.parse('5 1/2'), length: F.parse('96'), qty: 1, label: 'M1' }],
    b1Parts(1), KERF);
  const b = res.boards[0];
  // 2×19 13/16 + 2×11 1/16 + 3 kerfs = 62 1/8 ≤ 96 → one strip holds all four
  assert.equal(b.strips.length, 1);
  assert.equal(b.strips[0].segments.length, 4);
});

test('crosscut kerf separates segments by exactly 1/8', () => {
  const res = BM.packBoards(
    [{ width: F.parse('5 1/2'), length: F.parse('96'), qty: 1 }],
    [{ width: F.parse('2 1/4'), length: F.parse('19 13/16'), qty: 2, label: 'Stile' }],
    KERF);
  const [a, b] = res.boards[0].strips[0].segments;
  assert.equal(b.x, a.len + SM.to64(F.frac(1, 8)));
});

test('end trim shrinks the usable length', () => {
  // 24" board, 1" trim per end → 22" usable; a 23" part must not fit
  const res = BM.packBoards(
    [{ width: F.parse('2 1/4'), length: F.parse('24'), qty: 1 }],
    [{ width: F.parse('2 1/4'), length: F.parse('23'), qty: 1, label: 'Stile' }],
    { kerf: F.frac(1, 8), endTrim: F.parse('1') });
  assert.equal(res.placedUnits, 0);
  assert.equal(res.shortfalls.length, 1);
});

test('shortfall reports missing linear inches by width class', () => {
  const res = BM.packBoards(
    [{ width: F.parse('2 1/4'), length: F.parse('24'), qty: 1 }],
    [{ width: F.parse('2 1/4'), length: F.parse('20'), qty: 3, label: 'Stile' }],
    KERF);
  assert.equal(res.placedUnits, 1);
  assert.equal(res.shortfalls[0].count, 2);
  assert.equal(res.shortfalls[0].linear, 2 * SM.to64(F.parse('20')));
});

test('a board too narrow for the parts is never used', () => {
  const res = BM.packBoards(
    [{ width: F.parse('2'), length: F.parse('96'), qty: 1, label: 'narrow' },
     { width: F.parse('3'), length: F.parse('96'), qty: 1, label: 'wide' }],
    [{ width: F.parse('2 1/4'), length: F.parse('20'), qty: 2, label: 'Stile' }],
    KERF);
  assert.equal(res.boards.length, 1);
  assert.equal(res.boards[0].label, 'wide');
  assert.equal(res.placedUnits, 2);
});

test('longest boards are consumed first', () => {
  const res = BM.packBoards(
    [{ width: F.parse('2 1/4'), length: F.parse('48'), qty: 1, label: 'short' },
     { width: F.parse('2 1/4'), length: F.parse('96'), qty: 1, label: 'long' }],
    [{ width: F.parse('2 1/4'), length: F.parse('40'), qty: 1, label: 'Stile' }],
    KERF);
  assert.equal(res.boards[0].label, 'long');
});

test('mixed widths open separate strips', () => {
  const res = BM.packBoards(
    [{ width: F.parse('7'), length: F.parse('96'), qty: 1 }],
    [{ width: F.parse('2 1/4'), length: F.parse('20'), qty: 2, label: 'Stile' },
     { width: F.parse('3'), length: F.parse('20'), qty: 1, label: 'Wide rail' }],
    KERF);
  assert.equal(res.placedUnits, 3);
  const widths = res.boards[0].strips.map(s => s.wclass).sort((a, b) => a - b);
  assert.deepEqual(widths, [SM.to64(F.parse('2 1/4')), SM.to64(F.parse('3'))]);
});

test('whole kitchen: 3 doors of frame parts pack onto two 8-footers', () => {
  const res = BM.packBoards(
    [{ width: F.parse('5 1/2'), length: F.parse('96'), qty: 2, label: 'M' }],
    b1Parts(3), KERF);
  // 6 stiles (19 13/16) + 6 rails (11 1/16) ≈ 185 linear inches over
  // four 96" strips — must all place
  assert.equal(res.placedUnits, 12);
  assert.ok(res.boards.length <= 2);
  assert.deepEqual(res.shortfalls, []);
});

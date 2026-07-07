'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/fraction.js');

test('parse mixed numbers, fractions, decimals, integers', () => {
  assert.deepEqual(F.parse('24 3/8'), F.frac(195, 8));
  assert.deepEqual(F.parse('24-3/8'), F.frac(195, 8));
  assert.deepEqual(F.parse('3/8'), F.frac(3, 8));
  assert.deepEqual(F.parse('24.375'), F.frac(195, 8));
  assert.deepEqual(F.parse('24'), F.frac(24, 1));
  assert.deepEqual(F.parse('24 3/8"'), F.frac(195, 8));
  assert.deepEqual(F.parse('  1/2 in '), F.frac(1, 2));
  assert.deepEqual(F.parse('-3/32'), F.frac(-3, 32));
});

test('parse rejects garbage', () => {
  assert.equal(F.parse(''), null);
  assert.equal(F.parse('abc'), null);
  assert.equal(F.parse('3/0'), null);
  assert.equal(F.parse('1 2'), null);
  assert.equal(F.parse(null), null);
});

test('arithmetic stays exact and reduced', () => {
  const a = F.parse('3/32');
  assert.deepEqual(F.scale(a, 2), F.frac(3, 16));
  assert.deepEqual(F.sub(F.parse('15'), F.frac(3, 16)), F.frac(237, 16));
  assert.deepEqual(F.add(F.frac(1, 4), F.frac(1, 4)), F.frac(1, 2));
  assert.deepEqual(F.div(F.frac(3, 16), F.frac(2, 1)), F.frac(3, 32));
});

test('format renders mixed numbers', () => {
  assert.equal(F.format(F.frac(195, 8)), '24 3/8');
  assert.equal(F.format(F.frac(3, 16)), '3/16');
  assert.equal(F.format(F.frac(24, 1)), '24');
  assert.equal(F.format(F.frac(-195, 8)), '-24 3/8');
});

test('format marks values that need rounding', () => {
  // 1/3 is not representable in 64ths
  assert.equal(F.format(F.frac(1, 3), 64), '≈21/64');
  assert.ok(!F.isRepresentable(F.frac(1, 3), 64));
  assert.ok(F.isRepresentable(F.frac(3, 32), 64));
});

test('roundTo snaps to the grid', () => {
  assert.deepEqual(F.roundTo(F.frac(1, 3), 32), F.frac(11, 32));
  assert.deepEqual(F.roundTo(F.frac(3, 32), 32), F.frac(3, 32));
});

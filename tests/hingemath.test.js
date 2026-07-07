'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../js/fraction.js');
const HM = require('../js/hingemath.js');

function opts(overrides) {
  return Object.assign({
    cupDia: F.parse('35mm'),
    edgeGap: F.parse('5mm'),
    endOffset: F.parse('3'),
    count: 'auto'
  }, overrides);
}

// --- metric parsing (fraction.js) ------------------------------------------

test('mm measurements parse to exact inch fractions', () => {
  assert.deepEqual(F.parse('35mm'), F.frac(175, 127));   // 35 × 5/127
  assert.deepEqual(F.parse('22.5 mm'), F.frac(225, 254));
  assert.deepEqual(F.parse('5MM'.toLowerCase()), F.frac(25, 127));
  assert.equal(F.parse('mm'), null);
  assert.equal(F.parse('abcmm'), null);
});

test('toMM round-trips', () => {
  assert.ok(Math.abs(F.toMM(F.parse('35mm')) - 35) < 1e-9);
  assert.ok(Math.abs(F.toMM(F.parse('1')) - 25.4) < 1e-9);
});

// --- hinge count rule --------------------------------------------------------

test('hinge count follows the height rule', () => {
  assert.equal(HM.autoCount(19.8125), 2);
  assert.equal(HM.autoCount(40), 2);
  assert.equal(HM.autoCount(40.1), 3);
  assert.equal(HM.autoCount(60.1), 4);
  assert.equal(HM.autoCount(81), 5);
});

// --- layout -------------------------------------------------------------------

test('two hinges sit exactly at the end offsets', () => {
  const res = HM.computeHinges(opts(), F.parse('19 13/16'));
  assert.equal(res.count, 2);
  assert.equal(F.format(res.centers[0]), '3');
  assert.equal(F.format(res.centers[1]), '16 13/16'); // 19 13/16 − 3
  assert.deepEqual(res.warnings, []);
});

test('middle hinges divide the span evenly', () => {
  const res = HM.computeHinges(opts(), F.parse('51')); // 3 hinges
  assert.equal(res.count, 3);
  assert.equal(F.format(res.centers[0]), '3');
  assert.equal(F.format(res.centers[1]), '25 1/2');   // symmetric midpoint
  assert.equal(F.format(res.centers[2]), '48');
});

test('cup center from edge = edge gap + cup radius (22.5mm for a 35mm cup, 5mm tab)', () => {
  const res = HM.computeHinges(opts(), F.parse('20'));
  assert.deepEqual(res.cupCenterFromEdge, F.frac(225, 254)); // 22.5mm exactly
  assert.ok(Math.abs(F.toMM(res.cupCenterFromEdge) - 22.5) < 1e-9);
});

test('explicit count overrides auto', () => {
  const res = HM.computeHinges(opts({ count: 4 }), F.parse('30'));
  assert.equal(res.count, 4);
  assert.equal(res.centers.length, 4);
});

test('short doors clamp the end offset with a warning', () => {
  const res = HM.computeHinges(opts(), F.parse('5')); // 2×3" > 5"
  assert.equal(res.warnings.length, 1);
  assert.equal(F.format(res.centers[0]), '1 1/4');    // 5/4
  assert.equal(F.format(res.centers[1]), '3 3/4');
});

/*
 * hingemath.js — cup-hinge (Euro / 35mm) boring locations.
 *
 * Conventions:
 * - Positions are CUP CENTERS, measured from the TOP of the door along
 *   the hinged edge.
 * - The cup center sits (edge gap + cup diameter / 2) in from the hinged
 *   edge of the door; the edge gap ("tab") is the wood left between the
 *   door edge and the rim of the cup bore, typically 3–6mm.
 * - Hinge count follows the usual height rule unless overridden:
 *     ≤ 40" → 2,  ≤ 60" → 3,  ≤ 80" → 4,  taller → 5.
 * - End hinges sit a fixed offset from the door ends (default 3");
 *   middle hinges divide the space between them evenly.
 *
 * All measurements are fractions of an inch (see fraction.js — metric
 * entries like "35mm" parse exactly as 175/127).
 *
 * Runs in the browser (window.HingeMath) and in Node via require().
 */
(function (global) {
  'use strict';

  var F = (typeof module !== 'undefined' && module.exports)
    ? require('./fraction.js')
    : global.Fraction;

  /** Standard hinge count for a door height (inches, number). */
  function autoCount(heightIn) {
    if (heightIn <= 40) return 2;
    if (heightIn <= 60) return 3;
    if (heightIn <= 80) return 4;
    return 5;
  }

  /**
   * Boring layout for one door.
   * opts: {
   *   cupDia,     // fraction, e.g. parse('35mm')
   *   edgeGap,    // fraction, wood between door edge and cup rim
   *   endOffset,  // fraction, cup center from each door end
   *   count       // 'auto' or an integer ≥ 2
   * }
   * doorHeight: fraction.
   * Returns { count, centers: [fraction, from top], cupCenterFromEdge, warnings }.
   */
  function computeHinges(opts, doorHeight) {
    var warnings = [];
    var n = opts.count === 'auto'
      ? autoCount(F.toNumber(doorHeight))
      : Math.max(2, parseInt(opts.count, 10) || 2);

    var off = opts.endOffset;
    // end hinges must not cross the door's midpoint
    if (F.cmp(F.scale(off, 2), doorHeight) >= 0) {
      off = F.div(doorHeight, F.frac(4, 1));
      warnings.push('End offset is too large for this door — hinges placed at height/4 instead.');
    }

    var centers = [];
    var span = F.sub(doorHeight, F.scale(off, 2));
    for (var i = 0; i < n; i++) {
      centers.push(F.add(off, F.div(F.scale(span, i), F.frac(n - 1, 1))));
    }

    return {
      count: n,
      centers: centers,
      cupCenterFromEdge: F.add(opts.edgeGap, F.div(opts.cupDia, F.frac(2, 1))),
      warnings: warnings
    };
  }

  var API = { autoCount: autoCount, computeHinges: computeHinges };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.HingeMath = API;
  }
})(typeof window !== 'undefined' ? window : this);

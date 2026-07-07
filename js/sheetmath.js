/*
 * sheetmath.js — nesting parts onto sheet goods.
 *
 * All dimensions are handled internally as integer 1/64ths of an inch,
 * so kerf and trim math stays exact. Packing is a first-fit-decreasing
 * shelf algorithm: parts sorted tallest-first are placed left-to-right
 * on horizontal shelves; every part is separated from its neighbors by
 * one saw kerf, and an optional trim margin is reserved on all four
 * sheet edges.
 *
 * By default parts keep their orientation (height runs along the sheet
 * length, i.e. with the grain); opts.allowRotate permits 90° rotation.
 *
 * Runs in the browser (window.SheetMath) and in Node via require().
 */
(function (global) {
  'use strict';

  var F = (typeof module !== 'undefined' && module.exports)
    ? require('./fraction.js')
    : global.Fraction;

  var STANDARD_SHEETS = [
    { key: '4x8', label: '4′ × 8′ (48" × 96")', width: '48', length: '96' },
    { key: '4x10', label: '4′ × 10′ (48" × 120")', width: '48', length: '120' },
    { key: '5x5', label: '5′ × 5′ Baltic birch (60" × 60")', width: '60', length: '60' },
    { key: '4x4', label: '4′ × 4′ (48" × 48")', width: '48', length: '48' },
    { key: '2x4', label: '2′ × 4′ handy panel (24" × 48")', width: '24', length: '48' }
  ];

  /** Fraction → integer 1/64ths (rounded). */
  function to64(f) { return Math.round((f.n * 64) / f.d); }
  /** Integer 1/64ths → fraction. */
  function from64(u) { return F.frac(u, 64); }

  /**
   * Pack parts onto as many sheets as needed.
   *
   * sheet: { width, length }            (fractions, inches)
   * parts: [{ width, height, qty, label }]  (fractions + int)
   * opts:  { kerf, trim, allowRotate }  (fractions + bool)
   *
   * Returns {
   *   sheets: [{ placements: [{x, y, w, h, label, rotated}], usedArea, utilization }],
   *   totalUnits, placedUnits, unplaced: [{w, h, label}],
   *   sheetArea            // 1/64² units, full sheet
   * }
   * Placement coordinates are 1/64ths from the sheet's top-left corner
   * (trim margin already included), x across the width, y along the length.
   */
  function packParts(sheet, parts, opts) {
    opts = opts || {};
    var kerf = to64(opts.kerf || F.frac(1, 8));
    var trim = to64(opts.trim || F.frac(0, 1));
    var sheetW = to64(sheet.width);
    var sheetL = to64(sheet.length);
    var W = sheetW - 2 * trim;  // usable across the width  (x axis)
    var H = sheetL - 2 * trim;  // usable along the length  (y axis)

    var units = [];
    parts.forEach(function (p, i) {
      var w = to64(p.width);
      var h = to64(p.height);
      for (var k = 0; k < (p.qty || 0); k++) {
        units.push({ w: w, h: h, label: p.label || ('P' + (i + 1)) });
      }
    });
    units.sort(function (a, b) { return (b.h - a.h) || (b.w - a.w); });

    var sheets = [];
    var unplaced = [];

    function orientationsFor(u) {
      var list = [{ w: u.w, h: u.h, rotated: false }];
      if (opts.allowRotate && u.w !== u.h) list.push({ w: u.h, h: u.w, rotated: true });
      return list.filter(function (o) { return o.w <= W && o.h <= H; });
    }

    function tryPlace(sh, orients, u) {
      var i, j, o;
      // existing shelves, left to right
      for (i = 0; i < sh.shelves.length; i++) {
        var shelf = sh.shelves[i];
        for (j = 0; j < orients.length; j++) {
          o = orients[j];
          if (o.h <= shelf.h && shelf.x + o.w <= W) {
            sh.placements.push({
              x: trim + shelf.x, y: trim + shelf.y,
              w: o.w, h: o.h, label: u.label, rotated: o.rotated
            });
            shelf.x += o.w + kerf;
            return true;
          }
        }
      }
      // open a new shelf below the last one
      for (j = 0; j < orients.length; j++) {
        o = orients[j];
        if (sh.usedY + o.h <= H && o.w <= W) {
          var ns = { y: sh.usedY, h: o.h, x: o.w + kerf };
          sh.shelves.push(ns);
          sh.placements.push({
            x: trim, y: trim + sh.usedY,
            w: o.w, h: o.h, label: u.label, rotated: o.rotated
          });
          sh.usedY += o.h + kerf;
          return true;
        }
      }
      return false;
    }

    units.forEach(function (u) {
      var orients = orientationsFor(u);
      if (!orients.length) {
        unplaced.push({ w: u.w, h: u.h, label: u.label });
        return;
      }
      var placed = false;
      for (var s = 0; s < sheets.length && !placed; s++) {
        placed = tryPlace(sheets[s], orients, u);
      }
      if (!placed) {
        var fresh = { shelves: [], usedY: 0, placements: [] };
        sheets.push(fresh);
        if (!tryPlace(fresh, orients, u)) {
          sheets.pop(); // cannot happen if orientationsFor passed, but stay safe
          unplaced.push({ w: u.w, h: u.h, label: u.label });
        }
      }
    });

    var sheetArea = sheetW * sheetL;
    var out = sheets.map(function (sh) {
      var used = sh.placements.reduce(function (sum, p) { return sum + p.w * p.h; }, 0);
      return {
        placements: sh.placements,
        usedArea: used,
        utilization: sheetArea ? used / sheetArea : 0
      };
    });

    return {
      sheets: out,
      totalUnits: units.length,
      placedUnits: units.length - unplaced.length,
      unplaced: unplaced,
      sheetArea: sheetArea
    };
  }

  /**
   * Quick reference: how many copies of ONE part fit on one sheet in a
   * straight row/column grid (which is what shelf packing produces for
   * identical parts). Returns { count, cols, rows, rotated }.
   */
  function gridCount(sheet, part, opts) {
    opts = opts || {};
    var kerf = to64(opts.kerf || F.frac(1, 8));
    var trim = to64(opts.trim || F.frac(0, 1));
    var W = to64(sheet.width) - 2 * trim;
    var H = to64(sheet.length) - 2 * trim;

    function grid(w, h, rotated) {
      if (w <= 0 || h <= 0 || w > W || h > H) return { count: 0, cols: 0, rows: 0, rotated: rotated };
      var cols = Math.floor((W + kerf) / (w + kerf));
      var rows = Math.floor((H + kerf) / (h + kerf));
      return { count: cols * rows, cols: cols, rows: rows, rotated: rotated };
    }

    var best = grid(to64(part.width), to64(part.height), false);
    if (opts.allowRotate) {
      var rot = grid(to64(part.height), to64(part.width), true);
      if (rot.count > best.count) best = rot;
    }
    return best;
  }

  var API = {
    STANDARD_SHEETS: STANDARD_SHEETS,
    to64: to64,
    from64: from64,
    packParts: packParts,
    gridCount: gridCount
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.SheetMath = API;
  }
})(typeof window !== 'undefined' ? window : this);

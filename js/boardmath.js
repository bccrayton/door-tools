/*
 * boardmath.js — fitting the frame cut list onto lumber in stock.
 *
 * Model matches how frame stock is actually milled: each board is first
 * RIPPED lengthwise into strips of a part's exact width (one rip kerf
 * between strips), then each strip is CROSSCUT into part lengths (one
 * kerf between cuts). An optional end trim is reserved at both ends of
 * every board.
 *
 * All dimensions are integer 1/64ths internally (see sheetmath.js).
 * Strips only accept parts of exactly their ripped width. Boards are
 * used longest-first; parts are placed longest-first (first fit).
 *
 * Runs in the browser (window.BoardMath) and in Node via require().
 */
(function (global) {
  'use strict';

  var F, SM;
  if (typeof module !== 'undefined' && module.exports) {
    F = require('./fraction.js');
    SM = require('./sheetmath.js');
  } else {
    F = global.Fraction;
    SM = global.SheetMath;
  }
  var to64 = SM.to64;

  /**
   * boards: [{ width, length, qty, label }]  (fractions + int) — stock on hand
   * parts:  [{ width, length, qty, label }]  (fractions + int) — frame parts
   * opts:   { kerf, endTrim }                (fractions)
   *
   * Returns {
   *   boards: [{                 // one entry per physical board, in use order
   *     label, width, length,    // 1/64ths
   *     usable,                  // length minus both end trims
   *     endTrim,
   *     strips: [{ wclass, y, used, segments: [{ x, len, label }] }],
   *     usedRipWidth,            // total width consumed by rips (incl kerfs)
   *     utilization              // placed part area / board area
   *   }],
   *   totalUnits, placedUnits,
   *   shortfalls: [{ wclass, count, linear }]   // parts that didn't fit, by width
   * }
   * Strip y and segment x are offsets from the board's top edge / start of
   * the usable region (after end trim).
   */
  function packBoards(boardsIn, parts, opts) {
    opts = opts || {};
    var kerf = to64(opts.kerf || F.frac(1, 8));
    var endTrim = to64(opts.endTrim || F.frac(0, 1));

    var boards = [];
    boardsIn.forEach(function (b, i) {
      var w = to64(b.width);
      var l = to64(b.length);
      for (var k = 0; k < (b.qty || 0); k++) {
        boards.push({
          label: b.label || ('Board ' + (i + 1)),
          width: w,
          length: l,
          endTrim: endTrim,
          usable: l - 2 * endTrim,
          remWidth: w,
          strips: []
        });
      }
    });
    // longest boards first, then widest
    boards.sort(function (a, b) { return (b.length - a.length) || (b.width - a.width); });

    var units = [];
    parts.forEach(function (p, i) {
      var w = to64(p.width);
      var len = to64(p.length);
      for (var k = 0; k < (p.qty || 0); k++) {
        units.push({ w: w, len: len, label: p.label || ('P' + (i + 1)) });
      }
    });
    units.sort(function (a, b) { return (b.len - a.len) || (b.w - a.w); });

    var shortfalls = {};

    function placeInStrip(board, strip, u) {
      var x = strip.used === 0 ? 0 : strip.used + kerf;
      if (x + u.len > board.usable) return false;
      strip.segments.push({ x: x, len: u.len, label: u.label });
      strip.used = x + u.len;
      return true;
    }

    function ripNewStrip(board, u) {
      if (board.remWidth < u.w || u.len > board.usable || board.usable <= 0) return false;
      var strip = {
        wclass: u.w,
        y: board.width - board.remWidth,
        used: 0,
        segments: []
      };
      board.remWidth -= u.w + kerf;
      board.strips.push(strip);
      return placeInStrip(board, strip, u);
    }

    units.forEach(function (u) {
      var placed = false;
      // existing strips of the same width first (least new ripping)
      for (var i = 0; i < boards.length && !placed; i++) {
        var b = boards[i];
        for (var j = 0; j < b.strips.length && !placed; j++) {
          if (b.strips[j].wclass === u.w) placed = placeInStrip(b, b.strips[j], u);
        }
      }
      // then rip a fresh strip from the first board with room
      for (var i2 = 0; i2 < boards.length && !placed; i2++) {
        placed = ripNewStrip(boards[i2], u);
      }
      if (!placed) {
        var key = String(u.w);
        if (!shortfalls[key]) shortfalls[key] = { wclass: u.w, count: 0, linear: 0 };
        shortfalls[key].count += 1;
        shortfalls[key].linear += u.len;
      }
    });

    var used = boards.filter(function (b) { return b.strips.length > 0; });
    used.forEach(function (b) {
      var area = 0;
      b.strips.forEach(function (s) {
        s.segments.forEach(function (seg) { area += seg.len * s.wclass; });
      });
      b.usedRipWidth = b.width - b.remWidth;
      b.utilization = (b.width * b.length) ? area / (b.width * b.length) : 0;
      delete b.remWidth;
    });

    var shortList = Object.keys(shortfalls).map(function (k) { return shortfalls[k]; });
    shortList.sort(function (a, b) { return b.linear - a.linear; });
    var placedCount = units.length - shortList.reduce(function (n, s) { return n + s.count; }, 0);

    return {
      boards: used,
      boardsAvailable: boards.length,
      totalUnits: units.length,
      placedUnits: placedCount,
      shortfalls: shortList
    };
  }

  var API = { packBoards: packBoards };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.BoardMath = API;
  }
})(typeof window !== 'undefined' ? window : this);

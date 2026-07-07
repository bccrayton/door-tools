/*
 * fraction.js — exact rational arithmetic for shop math (inches).
 * Works in the browser as a plain script (window.Fraction) and in
 * Node via require() for tests.
 */
(function (global) {
  'use strict';

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a || 1;
  }

  /** Create a reduced fraction {n, d}. */
  function frac(n, d) {
    if (d === undefined) d = 1;
    if (d === 0) throw new Error('Division by zero');
    if (!Number.isInteger(n) || !Number.isInteger(d)) {
      throw new Error('frac() requires integers, got ' + n + '/' + d);
    }
    if (d < 0) {
      n = -n;
      d = -d;
    }
    var g = gcd(n, d);
    return { n: n / g, d: d / g };
  }

  function add(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
  function sub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
  function mul(a, b) { return frac(a.n * b.n, a.d * b.d); }
  function div(a, b) { return frac(a.n * b.d, a.d * b.n); }
  /** Multiply by an integer. */
  function scale(a, k) { return frac(a.n * k, a.d); }
  /** a <=> b : negative, zero, or positive number. */
  function cmp(a, b) { return a.n * b.d - b.n * a.d; }
  function toNumber(a) { return a.n / a.d; }
  function isZero(a) { return a.n === 0; }
  function isNegative(a) { return a.n < 0; }
  function eq(a, b) { return cmp(a, b) === 0; }

  /** Round to the nearest 1/denom. */
  function roundTo(a, denom) {
    return frac(Math.round((a.n * denom) / a.d), denom);
  }

  /**
   * Parse a measurement string into a fraction.
   * Accepts: `24`, `24 3/8`, `24-3/8`, `3/8`, `24.375`, with optional
   * trailing `"` or `in`. Returns null on bad input.
   */
  function parse(str) {
    if (typeof str === 'number') {
      return parse(String(str));
    }
    if (typeof str !== 'string') return null;
    var s = str.trim().toLowerCase()
      .replace(/(inches|inch|in|["”″])\s*$/, '')
      .trim();
    if (s === '') return null;

    var neg = false;
    if (s[0] === '-') {
      neg = true;
      s = s.slice(1).trim();
    }

    var m;
    // Mixed number: "24 3/8" or "24-3/8"
    m = s.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/);
    if (m) {
      var whole = parseInt(m[1], 10);
      var num = parseInt(m[2], 10);
      var den = parseInt(m[3], 10);
      if (den === 0) return null;
      var f = frac(whole * den + num, den);
      return neg ? frac(-f.n, f.d) : f;
    }
    // Bare fraction: "3/8"
    m = s.match(/^(\d+)\/(\d+)$/);
    if (m) {
      var den2 = parseInt(m[2], 10);
      if (den2 === 0) return null;
      var f2 = frac(parseInt(m[1], 10), den2);
      return neg ? frac(-f2.n, f2.d) : f2;
    }
    // Decimal: "24.375"
    m = s.match(/^(\d+)?\.(\d+)$/);
    if (m) {
      var intPart = m[1] ? parseInt(m[1], 10) : 0;
      var fracDigits = m[2];
      var f3 = frac(intPart * Math.pow(10, fracDigits.length) + parseInt(fracDigits, 10),
        Math.pow(10, fracDigits.length));
      return neg ? frac(-f3.n, f3.d) : f3;
    }
    // Whole number: "24"
    m = s.match(/^(\d+)$/);
    if (m) {
      var f4 = frac(parseInt(m[1], 10), 1);
      return neg ? frac(-f4.n, f4.d) : f4;
    }
    return null;
  }

  /**
   * Format a fraction as a mixed number string, e.g. `24 3/8`.
   * If the exact value doesn't land on maxDenom (default 64), it is
   * rounded to the nearest 1/maxDenom and prefixed with `≈`.
   */
  function isRepresentable(a, maxDenom) {
    return (maxDenom || 64) % a.d === 0;
  }

  function format(a, maxDenom) {
    maxDenom = maxDenom || 64;
    var v = a;
    var approx = '';
    if (maxDenom % v.d !== 0) {
      v = roundTo(a, maxDenom);
      approx = '≈'; // ≈ prefix when rounding was needed
    }
    var sign = v.n < 0 ? '-' : '';
    var n = Math.abs(v.n);
    var whole = Math.floor(n / v.d);
    var rem = n % v.d;
    var out;
    if (rem === 0) {
      out = String(whole);
    } else if (whole === 0) {
      out = rem + '/' + v.d;
    } else {
      out = whole + ' ' + rem + '/' + v.d;
    }
    return approx + sign + out;
  }

  var API = {
    frac: frac,
    add: add,
    sub: sub,
    mul: mul,
    div: div,
    scale: scale,
    cmp: cmp,
    eq: eq,
    toNumber: toNumber,
    isZero: isZero,
    isNegative: isNegative,
    roundTo: roundTo,
    parse: parse,
    format: format,
    isRepresentable: isRepresentable
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.Fraction = API;
  }
})(typeof window !== 'undefined' ? window : this);

/*
 * visualize.js — SVG renderers for the cabinet elevation and sheet
 * layout views. Pure string builders: no DOM access, so the geometry
 * is easy to reason about and user text is always XML-escaped.
 */
(function (global) {
  'use strict';

  var F = global.Fraction;

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var COLORS = {
    frame: '#e6d8bb',        // face frame / carcase
    frameEdge: '#b5a37c',
    interior: '#42392e',     // cabinet interior behind an inset door
    doorWood: '#e0bd8d',     // stiles and rails
    doorEdge: '#7a5426',
    panel: '#f0ddb2',        // recessed shaker panel
    panelEdge: '#a8834f',
    dim: '#6f675c',          // dimension lines/text
    openingDash: '#3c3227',
    sheet: '#e9d6ad',
    sheetEdge: '#a3865a',
    part: '#f5e6c4',
    partEdge: '#8a5a2b',
    trimDash: '#a3865a'
  };

  // ------------------------------------------------------------- cabinet

  /**
   * Elevation drawing of one opening with its door(s), to scale.
   * comp: result of DoorMath.computeOpening (warning-free).
   * settings: parsed DoorMath settings.
   * pxPerIn: shared scale so different openings compare accurately.
   * Returns an SVG string.
   */
  function cabinetSVG(comp, settings, pxPerIn) {
    var s = pxPerIn;
    var op = comp.opening;
    var ow = F.toNumber(op.width);
    var oh = F.toNumber(op.height);
    var dw = F.toNumber(comp.door.width);
    var dh = F.toNumber(comp.door.height);
    var n = op.doorsAcross || 1;
    var stileW = F.toNumber(settings.stileWidth);
    var railW = F.toNumber(settings.railWidth);
    var overlay = settings.mode === 'overlay' ? F.toNumber(settings.overlay) : 0;

    // face-frame border wide enough to show the overlay landing on it
    var fm = Math.max(1.75, overlay + 1);
    var padL = 46, padT = 30, padR = 10, padB = 10;
    var frameW = (ow + 2 * fm) * s;
    var frameH = (oh + 2 * fm) * s;
    var W = padL + frameW + padR;
    var H = padT + frameH + padB;
    var ox = padL + fm * s;     // opening top-left in px
    var oy = padT + fm * s;

    var parts = [];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(W) +
      '" height="' + Math.ceil(H) + '" viewBox="0 0 ' + Math.ceil(W) + ' ' + Math.ceil(H) +
      '" role="img" font-family="inherit">');

    // face frame + opening
    parts.push(rect(padL, padT, frameW, frameH, COLORS.frame, COLORS.frameEdge, 1.5, 3));
    parts.push(rect(ox, oy, ow * s, oh * s, COLORS.interior, COLORS.frameEdge, 1));

    // doors
    for (var i = 0; i < n; i++) {
      var dx, dy;
      if (settings.mode === 'overlay') {
        var pg = F.toNumber(settings.pairGap);
        dx = ox + (-overlay + i * (dw + pg)) * s;
        dy = oy - overlay * s;
      } else {
        var gap = F.toNumber(settings.gapPerSide);
        dx = ox + (gap + i * (dw + gap)) * s;
        dy = oy + gap * s;
      }
      parts.push(doorSVG(dx, dy, dw * s, dh * s, stileW * s, railW * s));
    }

    // overlay mode: show the hidden opening boundary through the door
    if (settings.mode === 'overlay') {
      parts.push('<rect x="' + ox + '" y="' + oy + '" width="' + (ow * s) +
        '" height="' + (oh * s) + '" fill="none" stroke="' + COLORS.openingDash +
        '" stroke-width="1" stroke-dasharray="5 4" opacity="0.55"/>');
    }

    // dimension: opening width (top) and height (left)
    parts.push(dimH(ox, ox + ow * s, padT - 12, F.format(op.width) + '"'));
    parts.push(dimV(padL - 14, oy, oy + oh * s, F.format(op.height) + '"'));

    // door size label centered on the first door's panel, when it fits
    if (dw * s > 78 && dh * s > 46) {
      var firstDx = settings.mode === 'overlay'
        ? ox - overlay * s
        : ox + F.toNumber(settings.gapPerSide) * s;
      var cx = firstDx + (dw * s) / 2;
      var cy = (settings.mode === 'overlay' ? oy - overlay * s : oy) + (dh * s) / 2;
      parts.push('<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-size="10" fill="#5a4326">' +
        esc(F.format(comp.door.width)) + '" ×</text>');
      parts.push('<text x="' + cx + '" y="' + (cy + 11) + '" text-anchor="middle" font-size="10" fill="#5a4326">' +
        esc(F.format(comp.door.height)) + '"</text>');
    }

    parts.push('</svg>');
    return parts.join('');
  }

  /** One shaker door: frame with recessed panel and shadow line. */
  function doorSVG(x, y, w, h, stileW, railW) {
    var out = [];
    out.push(rect(x, y, w, h, COLORS.doorWood, COLORS.doorEdge, 1.5, 1.5));
    var pw = w - 2 * stileW;
    var ph = h - 2 * railW;
    if (pw > 2 && ph > 2) {
      out.push(rect(x + stileW, y + railW, pw, ph, COLORS.panel, COLORS.panelEdge, 1));
      // inner shadow line suggests the recess
      if (pw > 10 && ph > 10) {
        out.push('<rect x="' + (x + stileW + 2.5) + '" y="' + (y + railW + 2.5) +
          '" width="' + (pw - 5) + '" height="' + (ph - 5) +
          '" fill="none" stroke="#00000018" stroke-width="1.5"/>');
      }
    }
    return out.join('');
  }

  // --------------------------------------------------------------- sheets

  /**
   * One packed sheet, drawn portrait (width across, length down).
   * sheetResult: one entry of SheetMath.packParts().sheets
   * dims: { widthIn, lengthIn, trimIn } in inches (numbers)
   * scale: px per inch
   */
  function sheetSVG(sheetResult, dims, scale) {
    var pad = 4;
    var W = dims.widthIn * scale + 2 * pad;
    var H = dims.lengthIn * scale + 2 * pad;
    var out = [];
    out.push('<svg xmlns="http://www.w3.org/2000/svg" width="' + Math.ceil(W) +
      '" height="' + Math.ceil(H) + '" viewBox="0 0 ' + Math.ceil(W) + ' ' + Math.ceil(H) +
      '" role="img" font-family="inherit">');
    out.push(rect(pad, pad, dims.widthIn * scale, dims.lengthIn * scale,
      COLORS.sheet, COLORS.sheetEdge, 1.5, 2));

    if (dims.trimIn > 0) {
      out.push('<rect x="' + (pad + dims.trimIn * scale) + '" y="' + (pad + dims.trimIn * scale) +
        '" width="' + ((dims.widthIn - 2 * dims.trimIn) * scale) +
        '" height="' + ((dims.lengthIn - 2 * dims.trimIn) * scale) +
        '" fill="none" stroke="' + COLORS.trimDash + '" stroke-width="1" stroke-dasharray="4 3" opacity="0.7"/>');
    }

    sheetResult.placements.forEach(function (p) {
      // placements are in 1/64ths
      var x = pad + (p.x / 64) * scale;
      var y = pad + (p.y / 64) * scale;
      var w = (p.w / 64) * scale;
      var h = (p.h / 64) * scale;
      out.push(rect(x, y, w, h, COLORS.part, COLORS.partEdge, 1));
      var showDims = w > 92 && h > 34;
      if (w > 30 && h > 16) {
        out.push('<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + (showDims ? -1 : 3)) +
          '" text-anchor="middle" font-size="9" fill="#5a4326">' +
          esc(shorten(p.label, Math.floor(w / 6))) + (p.rotated ? ' ↻' : '') + '</text>');
      }
      if (showDims) {
        out.push('<text x="' + (x + w / 2) + '" y="' + (y + h / 2 + 10) +
          '" text-anchor="middle" font-size="8" fill="#8a7454">' +
          esc(F.format(F.frac(p.w, 64)) + ' × ' + F.format(F.frac(p.h, 64))) + '</text>');
      }
    });

    out.push('</svg>');
    return out.join('');
  }

  // --------------------------------------------------------------- helpers

  function rect(x, y, w, h, fill, stroke, sw, rx) {
    return '<rect x="' + x + '" y="' + y + '" width="' + Math.max(0, w) +
      '" height="' + Math.max(0, h) + '" fill="' + fill + '" stroke="' + stroke +
      '" stroke-width="' + (sw || 1) + '"' + (rx ? ' rx="' + rx + '"' : '') + '/>';
  }

  /** Horizontal dimension line with end ticks and centered label. */
  function dimH(x1, x2, y, label) {
    return '<g stroke="' + COLORS.dim + '" stroke-width="1">' +
      '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '"/>' +
      '<line x1="' + x1 + '" y1="' + (y - 4) + '" x2="' + x1 + '" y2="' + (y + 4) + '"/>' +
      '<line x1="' + x2 + '" y1="' + (y - 4) + '" x2="' + x2 + '" y2="' + (y + 4) + '"/>' +
      '</g>' +
      '<text x="' + ((x1 + x2) / 2) + '" y="' + (y - 4) + '" text-anchor="middle" font-size="10" fill="' +
      COLORS.dim + '">' + esc(label) + '</text>';
  }

  /** Vertical dimension line with rotated label. */
  function dimV(x, y1, y2, label) {
    var cy = (y1 + y2) / 2;
    return '<g stroke="' + COLORS.dim + '" stroke-width="1">' +
      '<line x1="' + x + '" y1="' + y1 + '" x2="' + x + '" y2="' + y2 + '"/>' +
      '<line x1="' + (x - 4) + '" y1="' + y1 + '" x2="' + (x + 4) + '" y2="' + y1 + '"/>' +
      '<line x1="' + (x - 4) + '" y1="' + y2 + '" x2="' + (x + 4) + '" y2="' + y2 + '"/>' +
      '</g>' +
      '<text x="' + (x - 5) + '" y="' + cy + '" text-anchor="middle" font-size="10" fill="' + COLORS.dim +
      '" transform="rotate(-90 ' + (x - 5) + ' ' + cy + ')">' + esc(label) + '</text>';
  }

  function shorten(s, max) {
    s = String(s);
    return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s;
  }

  var API = { cabinetSVG: cabinetSVG, sheetSVG: sheetSVG };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.Visualize = API;
  }
})(typeof window !== 'undefined' ? window : this);

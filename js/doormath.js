/*
 * doormath.js — shaker door sizing and cut-list math.
 *
 * Inset doors (from the shop whiteboard):
 *   gap        = 3/32" per side  → single door loses 3/16" in each direction
 *   door H     = opening height − 2×gap
 *   door W     = (opening width − (doorsAcross+1)×gap) / doorsAcross
 *                (a pair has three gaps across: left, center, right)
 *   stile len  = door height
 *   rail len   = door width − 2×(stile width) + 2×(tongue length)
 *   panel      = groove-to-groove size minus an expansion clearance per side
 *
 * Overlay doors:
 *   door H     = opening height + 2×overlay
 *   door W     = (opening width + 2×overlay − (doorsAcross−1)×pairGap) / doorsAcross
 *   frame/panel parts follow the same stile/rail/panel rules.
 *
 * Runs in the browser as a plain script (window.DoorMath) and in Node
 * via require() for tests.
 */
(function (global) {
  'use strict';

  var F = (typeof module !== 'undefined' && module.exports)
    ? require('./fraction.js')
    : global.Fraction;

  var TWO = 2;

  /** Default project settings. All measurement values are fractions. */
  function defaultSettings() {
    return {
      mode: 'inset',               // 'inset' | 'overlay'
      gapPerSide: F.frac(3, 32),   // inset: reveal per side
      overlay: F.frac(1, 2),       // overlay: how far the door overlaps the frame, per side
      pairGap: F.frac(1, 8),       // overlay: gap between the two doors of a pair
      stileWidth: F.frac(9, 4),    // 2 1/4"
      railWidth: F.frac(9, 4),     // 2 1/4"
      tongueLength: F.frac(3, 8),  // tongue on rail ends; also the groove depth
      panelClearance: F.frac(1, 16), // panel expansion clearance per side
      frameThickness: F.frac(3, 4),
      panelThickness: F.frac(1, 4),
      drawerStyle: 'fivepiece',    // 'fivepiece' | 'slab' drawer-front construction
      roundDenom: 32               // round cut-list dimensions to nearest 1/32
    };
  }

  /** Normalize an opening's type: 'single' | 'pair' | 'drawer'. */
  function openingType(opening) {
    if (opening.type === 'pair' || opening.type === 'drawer' || opening.type === 'single') {
      return opening.type;
    }
    return (opening.doorsAcross === 2) ? 'pair' : 'single';
  }

  /**
   * Size one door (or drawer-front) blank for an opening.
   * opening: { width, height, type|doorsAcross } (fractions + type)
   * Returns { width, height, warnings: [] } for a single blank of the set.
   */
  function doorSize(settings, opening) {
    var warnings = [];
    var n = openingType(opening) === 'pair' ? 2 : 1;
    var w, h;

    if (settings.mode === 'overlay') {
      h = F.add(opening.height, F.scale(settings.overlay, TWO));
      var totalW = F.add(opening.width, F.scale(settings.overlay, TWO));
      if (n > 1) {
        totalW = F.sub(totalW, F.scale(settings.pairGap, n - 1));
      }
      w = F.div(totalW, F.frac(n, 1));
    } else {
      h = F.sub(opening.height, F.scale(settings.gapPerSide, TWO));
      var avail = F.sub(opening.width, F.scale(settings.gapPerSide, n + 1));
      w = F.div(avail, F.frac(n, 1));
    }

    if (F.isNegative(w) || F.isZero(w)) warnings.push('Door width is zero or negative — check the opening width.');
    if (F.isNegative(h) || F.isZero(h)) warnings.push('Door height is zero or negative — check the opening height.');
    return { width: w, height: h, warnings: warnings };
  }

  /**
   * Parts for ONE door (or drawer front) of the given blank size.
   * kind: 'single' | 'pair' | 'drawer'. A slab drawer front is one full-size
   * piece; everything else is a five-piece frame + panel.
   * Returns { warnings, parts: [{part, thickness, width, length, qtyPerDoor, material}] }.
   */
  function doorParts(settings, size, kind) {
    var warnings = [];

    if (kind === 'drawer' && settings.drawerStyle === 'slab') {
      return {
        warnings: warnings,
        parts: [{
          part: 'Slab front',
          thickness: settings.frameThickness,
          width: size.width,
          length: size.height,
          qtyPerDoor: 1,
          material: 'Slab stock'
        }]
      };
    }

    var stileLength = size.height;
    var railLength = F.add(
      F.sub(size.width, F.scale(settings.stileWidth, TWO)),
      F.scale(settings.tongueLength, TWO)
    );

    // Panel sits in the grooves: groove-to-groove opening minus clearance per side.
    var panelWidth = F.sub(
      F.add(F.sub(size.width, F.scale(settings.stileWidth, TWO)),
        F.scale(settings.tongueLength, TWO)),
      F.scale(settings.panelClearance, TWO)
    );
    var panelHeight = F.sub(
      F.add(F.sub(size.height, F.scale(settings.railWidth, TWO)),
        F.scale(settings.tongueLength, TWO)),
      F.scale(settings.panelClearance, TWO)
    );

    if (F.cmp(railLength, F.frac(0, 1)) <= 0) {
      warnings.push('Rail length is zero or negative — the door is narrower than two stiles.');
    }
    if (F.cmp(panelHeight, F.frac(0, 1)) <= 0) {
      warnings.push('Panel height is zero or negative — the door is shorter than two rails.');
    }

    return {
      warnings: warnings,
      parts: [
        {
          part: 'Stile',
          thickness: settings.frameThickness,
          width: settings.stileWidth,
          length: stileLength,
          qtyPerDoor: 2,
          material: 'Frame stock'
        },
        {
          part: 'Rail',
          thickness: settings.frameThickness,
          width: settings.railWidth,
          length: railLength,
          qtyPerDoor: 2,
          material: 'Frame stock'
        },
        {
          part: 'Panel',
          thickness: settings.panelThickness,
          width: panelWidth,
          length: panelHeight,
          qtyPerDoor: 1,
          material: 'Panel stock'
        }
      ]
    };
  }

  /**
   * Compute everything for one opening row.
   * opening: { id, label, width, height, type, qty }
   */
  function computeOpening(settings, opening) {
    var kind = openingType(opening);
    var size = doorSize(settings, opening);
    var pp = doorParts(settings, size, kind);
    var doorCount = (kind === 'pair' ? 2 : 1) * (opening.qty || 1);
    return {
      opening: opening,
      kind: kind,
      door: size,
      doorCount: doorCount,
      parts: pp.parts,
      warnings: size.warnings.concat(pp.warnings)
    };
  }

  /**
   * Aggregate a whole project into a cut list.
   * openings: array of opening rows. Returns:
   *   { rows: [{part, material, thickness, width, length, qty, labels}], warnings }
   * Identical parts (same name/thickness/width/length) are merged.
   * Lengths are rounded to settings.roundDenom for grouping and display;
   * a row is flagged rounded:true when rounding changed the exact value.
   */
  function computeCutList(settings, openings) {
    var groups = {};
    var warnings = [];

    openings.forEach(function (op) {
      var res = computeOpening(settings, op);
      res.warnings.forEach(function (msg) {
        warnings.push((op.label || 'Opening') + ': ' + msg);
      });
      if (res.warnings.length) return; // skip unbuildable rows

      res.parts.forEach(function (p) {
        var length = F.roundTo(p.length, settings.roundDenom);
        var width = F.roundTo(p.width, settings.roundDenom);
        var rounded = !F.eq(length, p.length) || !F.eq(width, p.width);
        var key = [p.part, F.format(p.thickness), F.format(width), F.format(length)].join('|');
        if (!groups[key]) {
          groups[key] = {
            part: p.part,
            material: p.material,
            thickness: p.thickness,
            width: width,
            length: length,
            qty: 0,
            rounded: false,
            labels: []
          };
        }
        groups[key].qty += p.qtyPerDoor * res.doorCount;
        groups[key].rounded = groups[key].rounded || rounded;
        var label = op.label || 'Opening';
        if (groups[key].labels.indexOf(label) === -1) groups[key].labels.push(label);
      });
    });

    var order = { Stile: 0, Rail: 1, Panel: 2, 'Slab front': 3 };
    var rows = Object.keys(groups).map(function (k) { return groups[k]; });
    rows.sort(function (a, b) {
      if (order[a.part] !== order[b.part]) return order[a.part] - order[b.part];
      return F.cmp(b.length, a.length); // longest first within a part type
    });

    return { rows: rows, warnings: warnings };
  }

  /** Total linear inches of frame stock (stiles + rails), as a fraction. */
  function frameLinearInches(cutList) {
    var total = F.frac(0, 1);
    cutList.rows.forEach(function (r) {
      if (r.material === 'Frame stock') {
        total = F.add(total, F.scale(r.length, r.qty));
      }
    });
    return total;
  }

  var API = {
    defaultSettings: defaultSettings,
    openingType: openingType,
    doorSize: doorSize,
    doorParts: doorParts,
    computeOpening: computeOpening,
    computeCutList: computeCutList,
    frameLinearInches: frameLinearInches
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  } else {
    global.DoorMath = API;
  }
})(typeof window !== 'undefined' ? window : this);

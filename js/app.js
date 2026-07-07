/*
 * app.js — UI wiring for Shaker Door Tools.
 * State lives in memory and persists to localStorage. Measurements are
 * stored as strings (as typed) and parsed with Fraction.parse on use.
 */
(function () {
  'use strict';

  var F = window.Fraction;
  var DM = window.DoorMath;
  var SM = window.SheetMath;
  var BM = window.BoardMath;
  var VZ = window.Visualize;

  var STORAGE_PROJECT = 'doorTools.project.v1';
  var STORAGE_INVENTORY = 'doorTools.inventory.v1';

  // ------------------------------------------------------------------ state

  function defaultProject() {
    return {
      mode: 'inset',
      settings: {
        gapPerSide: '3/32',
        overlay: '1/2',
        pairGap: '1/8',
        stileWidth: '2 1/4',
        railWidth: '2 1/4',
        tongueLength: '3/8',
        panelClearance: '1/16',
        frameThickness: '3/4',
        panelThickness: '1/4',
        drawerStyle: 'fivepiece',
        roundDenom: 32
      },
      openings: [],
      sheets: defaultSheetConfig(),
      boards: defaultBoardConfig()
    };
  }

  function defaultBoardConfig() {
    return { kerf: '1/8', endTrim: '0' };
  }

  function defaultSheetConfig() {
    return {
      source: 'panels',      // 'panels' | 'doors' | 'custom'
      partW: '11',
      partH: '16',
      partQty: 10,
      sheetKey: '4x8',
      sheetW: '48',
      sheetL: '96',
      kerf: '1/8',
      trim: '0',
      allowRotate: false
    };
  }

  var project = loadJSON(STORAGE_PROJECT) || defaultProject();
  // projects saved by earlier versions lack newer config blocks/fields
  project.sheets = Object.assign(defaultSheetConfig(), project.sheets || {});
  project.boards = Object.assign(defaultBoardConfig(), project.boards || {});
  if (!project.settings.drawerStyle) project.settings.drawerStyle = 'fivepiece';
  project.openings.forEach(function (op) {
    if (!op.type) op.type = op.doorsAcross === 2 ? 'pair' : 'single';
  });
  var inventory = loadJSON(STORAGE_INVENTORY) || [];
  var nextId = 1;

  function loadJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveProject() {
    try { localStorage.setItem(STORAGE_PROJECT, JSON.stringify(project)); } catch (e) { /* private mode */ }
  }

  function saveInventory() {
    try { localStorage.setItem(STORAGE_INVENTORY, JSON.stringify(inventory)); } catch (e) { /* private mode */ }
  }

  function uid() { return 'id' + (nextId++) + '-' + Date.now().toString(36); }

  // ------------------------------------------------- settings (parsed form)

  /**
   * Parse the string settings into fractions for DoorMath.
   * Returns { settings, errors: {fieldName: true} }.
   */
  function parsedSettings() {
    var s = DM.defaultSettings();
    s.mode = project.mode;
    s.roundDenom = project.settings.roundDenom || 32;
    s.drawerStyle = project.settings.drawerStyle === 'slab' ? 'slab' : 'fivepiece';
    var errors = {};
    ['gapPerSide', 'overlay', 'pairGap', 'stileWidth', 'railWidth',
      'tongueLength', 'panelClearance', 'frameThickness', 'panelThickness'
    ].forEach(function (name) {
      var v = F.parse(project.settings[name]);
      if (v === null || F.isNegative(v)) {
        errors[name] = true;
      } else {
        s[name] = v;
      }
    });
    return { settings: s, errors: errors };
  }

  /** Parse opening rows into DoorMath form; invalid rows get row.invalid. */
  function parsedOpenings() {
    return project.openings.map(function (op) {
      var w = F.parse(op.width);
      var h = F.parse(op.height);
      var qty = parseInt(op.qty, 10);
      var valid = w && h && !F.isNegative(w) && !F.isZero(w) &&
        !F.isNegative(h) && !F.isZero(h) && qty >= 1;
      var type = DM.openingType(op);
      return {
        raw: op,
        valid: !!valid,
        label: op.label || 'Opening',
        width: w,
        height: h,
        type: type,
        doorsAcross: type === 'pair' ? 2 : 1,
        qty: qty >= 1 ? qty : 1
      };
    });
  }

  // ------------------------------------------------------------------ tabs

  document.querySelectorAll('nav.tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('nav.tabs button').forEach(function (b) {
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-panel').forEach(function (panel) {
        panel.hidden = panel.id !== 'tab-' + btn.dataset.tab;
      });
    });
  });

  // ------------------------------------------------------------- mode + settings

  var modeToggle = document.getElementById('mode-toggle');

  function renderMode() {
    modeToggle.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.mode === project.mode ? 'true' : 'false');
    });
    document.querySelectorAll('#settings-grid .field[data-modes]').forEach(function (f) {
      f.style.display = f.dataset.modes.indexOf(project.mode) === -1 ? 'none' : '';
    });
  }

  modeToggle.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    project.mode = btn.dataset.mode;
    saveProject();
    renderMode();
    renderAll();
  });

  function renderSettingsInputs() {
    document.querySelectorAll('[data-setting]').forEach(function (input) {
      input.value = project.settings[input.dataset.setting];
    });
    document.getElementById('set-roundDenom').value = String(project.settings.roundDenom || 32);
    document.getElementById('set-drawerStyle').value =
      project.settings.drawerStyle === 'slab' ? 'slab' : 'fivepiece';
  }

  document.querySelectorAll('[data-setting]').forEach(function (input) {
    input.addEventListener('input', function () {
      project.settings[input.dataset.setting] = input.value;
      saveProject();
      renderAll();
    });
    // Normalize display on blur: "24.375" -> "24 3/8"
    input.addEventListener('blur', function () {
      var v = F.parse(input.value);
      if (v && !F.isNegative(v)) {
        var pretty = F.format(v);
        if (pretty.charAt(0) !== '≈') {
          input.value = pretty;
          project.settings[input.dataset.setting] = pretty;
          saveProject();
        }
      }
    });
  });

  document.getElementById('set-roundDenom').addEventListener('change', function () {
    project.settings.roundDenom = parseInt(this.value, 10);
    saveProject();
    renderAll();
  });

  document.getElementById('set-drawerStyle').addEventListener('change', function () {
    project.settings.drawerStyle = this.value;
    saveProject();
    renderAll();
  });

  // -------------------------------------------------------------- openings

  var openingsBody = document.querySelector('#openings-table tbody');

  document.getElementById('add-opening').addEventListener('click', function () {
    project.openings.push({
      id: uid(),
      label: 'B' + (project.openings.length + 1),
      width: '',
      height: '',
      type: 'single',
      qty: 1
    });
    saveProject();
    renderAll();
    // Focus the width input of the new row
    var rows = openingsBody.querySelectorAll('tr');
    var last = rows[rows.length - 1];
    if (last) last.querySelector('input[data-field="width"]').focus();
  });

  function openingInputCell(op, field, cls, placeholder) {
    var td = document.createElement('td');
    var input = document.createElement('input');
    input.value = op[field];
    input.dataset.field = field;
    input.dataset.id = op.id;
    if (cls) input.className = cls;
    if (placeholder) input.placeholder = placeholder;
    input.spellcheck = false;
    td.appendChild(input);
    return td;
  }

  function renderOpenings(computed) {
    openingsBody.innerHTML = '';
    project.openings.forEach(function (op, i) {
      var comp = computed[i];
      var tr = document.createElement('tr');

      tr.appendChild(openingInputCell(op, 'label', 'label'));
      tr.appendChild(openingInputCell(op, 'width', null, 'e.g. 14 5/8'));
      tr.appendChild(openingInputCell(op, 'height', null, 'e.g. 24 1/4'));

      var tdDoors = document.createElement('td');
      var sel = document.createElement('select');
      sel.className = 'doors';
      sel.dataset.id = op.id;
      var opType = DM.openingType(op);
      [['single', 'Door'], ['pair', 'Door pair'], ['drawer', 'Drawer']].forEach(function (opt) {
        var o = document.createElement('option');
        o.value = opt[0];
        o.textContent = opt[1];
        if (opType === opt[0]) o.selected = true;
        sel.appendChild(o);
      });
      tdDoors.appendChild(sel);
      tr.appendChild(tdDoors);

      var tdQty = document.createElement('td');
      var qty = document.createElement('input');
      qty.type = 'number';
      qty.min = '1';
      qty.step = '1';
      qty.className = 'qty';
      qty.value = op.qty;
      qty.dataset.field = 'qty';
      qty.dataset.id = op.id;
      tdQty.appendChild(qty);
      tr.appendChild(tdQty);

      var tdSize = document.createElement('td');
      tdSize.className = 'computed';
      if (comp && comp.doorText) {
        tdSize.textContent = comp.doorText;
      } else {
        tdSize.textContent = '—';
      }
      tr.appendChild(tdSize);

      var tdDel = document.createElement('td');
      tdDel.className = 'no-print';
      var del = document.createElement('button');
      del.className = 'btn danger-text';
      del.textContent = '✕';
      del.title = 'Remove opening';
      del.addEventListener('click', function () {
        project.openings = project.openings.filter(function (o) { return o.id !== op.id; });
        saveProject();
        renderAll();
      });
      tdDel.appendChild(del);
      tr.appendChild(tdDel);

      if (comp && comp.hasWarnings) tr.classList.add('warn-row');
      openingsBody.appendChild(tr);
    });

    document.getElementById('openings-empty').style.display =
      project.openings.length ? 'none' : '';
  }

  // Delegate edits on the openings table
  openingsBody.addEventListener('input', function (e) {
    var el = e.target;
    var op = project.openings.find(function (o) { return o.id === el.dataset.id; });
    if (!op) return;
    if (el.dataset.field) {
      op[el.dataset.field] = el.dataset.field === 'qty'
        ? (parseInt(el.value, 10) || 1)
        : el.value;
    }
    saveProject();
    renderComputedOnly();
  });

  openingsBody.addEventListener('change', function (e) {
    var el = e.target;
    if (el.tagName === 'SELECT') {
      var op = project.openings.find(function (o) { return o.id === el.dataset.id; });
      if (op) {
        op.type = el.value;
        delete op.doorsAcross; // legacy field superseded by type
        saveProject();
        renderAll();
      }
    }
  });

  // Re-render only computed cells while typing, so inputs keep focus.
  function renderComputedOnly() {
    var data = compute();
    var rows = openingsBody.querySelectorAll('tr');
    project.openings.forEach(function (op, i) {
      var comp = data.perOpening[i];
      var row = rows[i];
      if (!row) return;
      var cell = row.querySelector('td.computed');
      cell.textContent = (comp && comp.doorText) ? comp.doorText : '—';
      row.classList.toggle('warn-row', !!(comp && comp.hasWarnings));
      // flag invalid measurement inputs
      ['width', 'height'].forEach(function (f) {
        var input = row.querySelector('input[data-field="' + f + '"]');
        if (!input) return;
        var v = F.parse(op[f]);
        var bad = op[f] !== '' && (!v || F.isNegative(v) || F.isZero(v));
        input.classList.toggle('invalid', bad);
      });
    });
    renderBreakdown(data);
    renderCutList(data);
    renderWarnings(data);
    renderCabinet(data);
    renderSheets(data);
    renderBoards(data);
  }

  // --------------------------------------------------------------- compute

  /** One computation pass shared by all renderers. */
  function compute() {
    var ps = parsedSettings();
    var ops = parsedOpenings();
    var validOps = ops.filter(function (o) { return o.valid; });

    var perOpening = ops.map(function (o) {
      if (!o.valid || Object.keys(ps.errors).length) {
        return { doorText: null, hasWarnings: false, result: null };
      }
      var res = DM.computeOpening(ps.settings, o);
      var doorText = res.warnings.length
        ? 'check size'
        : F.format(res.door.width, 64) + '" × ' + F.format(res.door.height, 64) + '"' +
          (o.type === 'pair' ? ' (each of pair)' : (o.type === 'drawer' ? ' (drawer front)' : ''));
      return { doorText: doorText, hasWarnings: res.warnings.length > 0, result: res };
    });

    var cutList = Object.keys(ps.errors).length
      ? { rows: [], warnings: ['Fix the highlighted settings first.'] }
      : DM.computeCutList(ps.settings, validOps);

    return {
      settingsErrors: ps.errors,
      settings: ps.settings,
      openings: ops,
      perOpening: perOpening,
      cutList: cutList
    };
  }

  // ------------------------------------------------------------- breakdown

  function renderBreakdown(data) {
    var tbody = document.querySelector('#breakdown-table tbody');
    tbody.innerHTML = '';
    var any = false;

    data.perOpening.forEach(function (comp, i) {
      var o = data.openings[i];
      if (!comp.result || comp.hasWarnings) return;
      any = true;
      comp.result.parts.forEach(function (p, j) {
        var tr = document.createElement('tr');
        var unitName = comp.result.kind === 'drawer' ? 'front' : 'door';
        var cells = [
          j === 0 ? (o.label + ' — ' + comp.result.doorCount + ' ' + unitName +
            (comp.result.doorCount > 1 ? 's' : '')) : '',
          p.part,
          String(p.qtyPerDoor),
          F.format(p.thickness) + '"',
          F.format(p.width) + '"',
          F.format(p.length) + '"'
        ];
        cells.forEach(function (text, k) {
          var td = document.createElement('td');
          td.textContent = text;
          if (k >= 2) td.className = 'num';
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    });

    document.getElementById('breakdown-empty').style.display = any ? 'none' : '';
  }

  // --------------------------------------------------------------- cut list

  function renderCutList(data) {
    var tbody = document.querySelector('#cutlist-table tbody');
    tbody.innerHTML = '';
    var rows = data.cutList.rows;
    var anyRounded = false;

    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (r.rounded) anyRounded = true;
      var cells = [
        r.part + (r.rounded ? ' *' : ''),
        r.material,
        F.format(r.thickness) + '"',
        F.format(r.width) + '"',
        F.format(r.length) + '"',
        String(r.qty),
        r.labels.join(', ')
      ];
      cells.forEach(function (text, k) {
        var td = document.createElement('td');
        td.textContent = text;
        if (k >= 2 && k <= 5) td.className = 'num';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    document.getElementById('cutlist-empty').style.display = rows.length ? 'none' : '';
    document.getElementById('cutlist-approx').hidden = !anyRounded;

    var doorTotal = data.perOpening.reduce(function (sum, comp) {
      return sum + ((comp.result && !comp.hasWarnings) ? comp.result.doorCount : 0);
    }, 0);
    document.getElementById('cutlist-subtitle').textContent =
      doorTotal ? '— ' + doorTotal + ' door' + (doorTotal > 1 ? 's' : '') +
        ', ' + (data.settings.mode === 'inset' ? 'inset' : 'overlay') : '';

    var summary = document.getElementById('cutlist-summary');
    if (rows.length) {
      var linear = DM.frameLinearInches(data.cutList);
      var feet = F.toNumber(linear) / 12;
      summary.textContent = 'Frame stock: ' + F.format(linear) + '" total (' +
        feet.toFixed(1) + ' linear ft, before waste/kerf).';
    } else {
      summary.textContent = '';
    }
  }

  function cutListToCSV(data) {
    var lines = [['Part', 'Material', 'Thickness', 'Width', 'Length', 'Qty', 'For'].join(',')];
    data.cutList.rows.forEach(function (r) {
      lines.push([
        r.part, r.material,
        F.format(r.thickness), F.format(r.width), F.format(r.length),
        r.qty, '"' + r.labels.join(', ') + '"'
      ].join(','));
    });
    return lines.join('\n');
  }

  function cutListToText(data) {
    var lines = ['CUT LIST — ' + (data.settings.mode === 'inset' ? 'inset' : 'overlay') + ' shaker doors'];
    data.cutList.rows.forEach(function (r) {
      lines.push(
        String(r.qty).padStart(3) + ' × ' + r.part.padEnd(6) + ' ' +
        F.format(r.thickness) + '" x ' + F.format(r.width) + '" x ' + F.format(r.length) + '"' +
        '  (' + r.labels.join(', ') + ')'
      );
    });
    return lines.join('\n');
  }

  document.getElementById('print-cutlist').addEventListener('click', function () {
    window.print();
  });

  document.getElementById('csv-cutlist').addEventListener('click', function () {
    var blob = new Blob([cutListToCSV(compute())], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cut-list.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('copy-cutlist').addEventListener('click', function () {
    var text = cutListToText(compute());
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  });

  // --------------------------------------------------------------- warnings

  function renderWarnings(data) {
    var ul = document.getElementById('calc-warnings');
    ul.innerHTML = '';
    data.cutList.warnings.forEach(function (msg) {
      var li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
    });
    var ul2 = document.getElementById('cutlist-warnings');
    ul2.innerHTML = ul.innerHTML;

    // settings error highlighting
    document.querySelectorAll('[data-setting]').forEach(function (input) {
      input.classList.toggle('invalid', !!data.settingsErrors[input.dataset.setting]);
    });
  }

  // ---------------------------------------------------------- cabinet view

  function renderCabinet(data) {
    var wrap = document.getElementById('cabinet-figures');
    wrap.innerHTML = '';
    var drawable = [];
    data.perOpening.forEach(function (comp, i) {
      if (comp.result && !comp.hasWarnings) drawable.push({ comp: comp.result, o: data.openings[i] });
    });

    document.getElementById('cabinet-empty').style.display = drawable.length ? 'none' : '';
    document.getElementById('cabinet-note').hidden =
      !(drawable.length && data.settings.mode === 'overlay');
    if (!drawable.length) return;

    // shared scale: tallest opening (plus frame border) fits ~280px
    var maxIn = 1;
    drawable.forEach(function (d) {
      maxIn = Math.max(maxIn,
        F.toNumber(d.o.height) + 4,
        F.toNumber(d.o.width) + 4);
    });
    var pxPerIn = Math.min(9, 280 / maxIn);

    drawable.forEach(function (d) {
      var fig = document.createElement('figure');
      fig.className = 'viz';
      fig.innerHTML = VZ.cabinetSVG(d.comp, data.settings, pxPerIn);
      var cap = document.createElement('figcaption');
      var what = d.o.type === 'pair' ? 'pair of doors, each '
        : (d.o.type === 'drawer' ? 'drawer front ' : 'door ');
      cap.textContent = d.o.label +
        (d.o.qty > 1 ? ' (×' + d.o.qty + ')' : '') +
        ' — ' + what +
        F.format(d.comp.door.width) + '" × ' + F.format(d.comp.door.height) + '"';
      fig.appendChild(cap);
      wrap.appendChild(fig);
    });
  }

  // -------------------------------------------------------------- sheets tab

  var SHEET_INPUTS = {
    source: document.getElementById('sheet-source'),
    partW: document.getElementById('sheet-partW'),
    partH: document.getElementById('sheet-partH'),
    partQty: document.getElementById('sheet-partQty'),
    size: document.getElementById('sheet-size'),
    w: document.getElementById('sheet-w'),
    l: document.getElementById('sheet-l'),
    kerf: document.getElementById('sheet-kerf'),
    trim: document.getElementById('sheet-trim'),
    rotate: document.getElementById('sheet-rotate')
  };

  // populate the sheet-size dropdown from the standards + a custom entry
  SM.STANDARD_SHEETS.forEach(function (s) {
    var o = document.createElement('option');
    o.value = s.key;
    o.textContent = s.label;
    SHEET_INPUTS.size.appendChild(o);
  });
  (function () {
    var o = document.createElement('option');
    o.value = 'custom';
    o.textContent = 'Custom…';
    SHEET_INPUTS.size.appendChild(o);
  })();

  function renderSheetInputs() {
    var cfg = project.sheets;
    SHEET_INPUTS.source.value = cfg.source;
    SHEET_INPUTS.partW.value = cfg.partW;
    SHEET_INPUTS.partH.value = cfg.partH;
    SHEET_INPUTS.partQty.value = cfg.partQty;
    SHEET_INPUTS.size.value = cfg.sheetKey;
    SHEET_INPUTS.w.value = cfg.sheetW;
    SHEET_INPUTS.l.value = cfg.sheetL;
    SHEET_INPUTS.kerf.value = cfg.kerf;
    SHEET_INPUTS.trim.value = cfg.trim;
    SHEET_INPUTS.rotate.checked = !!cfg.allowRotate;
    document.querySelectorAll('.sheet-custom-part').forEach(function (f) {
      f.hidden = cfg.source !== 'custom';
    });
    document.querySelectorAll('.sheet-custom-size').forEach(function (f) {
      f.hidden = cfg.sheetKey !== 'custom';
    });
  }

  ['source', 'size'].forEach(function (name) {
    SHEET_INPUTS[name].addEventListener('change', function () {
      if (name === 'source') project.sheets.source = this.value;
      else project.sheets.sheetKey = this.value;
      saveProject();
      renderSheetInputs();
      renderSheets(compute());
    });
  });

  [['partW', 'partW'], ['partH', 'partH'], ['w', 'sheetW'], ['l', 'sheetL'],
    ['kerf', 'kerf'], ['trim', 'trim']].forEach(function (pair) {
    SHEET_INPUTS[pair[0]].addEventListener('input', function () {
      project.sheets[pair[1]] = this.value;
      saveProject();
      renderSheets(compute());
    });
  });

  SHEET_INPUTS.partQty.addEventListener('input', function () {
    project.sheets.partQty = parseInt(this.value, 10) || 1;
    saveProject();
    renderSheets(compute());
  });

  SHEET_INPUTS.rotate.addEventListener('change', function () {
    project.sheets.allowRotate = this.checked;
    saveProject();
    renderSheets(compute());
  });

  /** Parts to nest, per the selected source. Returns {parts, errors:[]}. */
  function sheetParts(data) {
    var cfg = project.sheets;
    var errors = [];
    if (cfg.source === 'custom') {
      var w = F.parse(cfg.partW);
      var h = F.parse(cfg.partH);
      var qty = parseInt(cfg.partQty, 10) || 0;
      if (!w || F.isNegative(w) || F.isZero(w) || !h || F.isNegative(h) || F.isZero(h)) {
        errors.push('Enter a valid custom part width and height.');
        return { parts: [], errors: errors };
      }
      return { parts: [{ width: w, height: h, qty: Math.max(1, qty), label: 'Part' }], errors: errors };
    }
    if (cfg.source === 'doors') {
      var parts = [];
      data.perOpening.forEach(function (comp, i) {
        if (comp.result && !comp.hasWarnings) {
          parts.push({
            width: comp.result.door.width,
            height: comp.result.door.height,
            qty: comp.result.doorCount,
            label: data.openings[i].label
          });
        }
      });
      return { parts: parts, errors: errors };
    }
    // panels or slab fronts from the aggregated cut list
    var wanted = cfg.source === 'slabs' ? 'Slab front' : 'Panel';
    return {
      parts: data.cutList.rows
        .filter(function (r) { return r.part === wanted; })
        .map(function (r) {
          return { width: r.width, height: r.length, qty: r.qty, label: r.labels.join(', ') };
        }),
      errors: errors
    };
  }

  function sheetDims() {
    var cfg = project.sheets;
    if (cfg.sheetKey !== 'custom') {
      var std = SM.STANDARD_SHEETS.find(function (s) { return s.key === cfg.sheetKey; }) ||
        SM.STANDARD_SHEETS[0];
      return { width: F.parse(std.width), length: F.parse(std.length), label: std.label };
    }
    var w = F.parse(cfg.sheetW);
    var l = F.parse(cfg.sheetL);
    if (!w || !l || F.isNegative(w) || F.isZero(w) || F.isNegative(l) || F.isZero(l)) return null;
    return { width: w, length: l, label: F.format(w) + '" × ' + F.format(l) + '"' };
  }

  function renderSheets(data) {
    var cfg = project.sheets;
    var headline = document.getElementById('sheet-headline');
    var figures = document.getElementById('sheet-figures');
    var warnUl = document.getElementById('sheet-warnings');
    var emptyNote = document.getElementById('sheet-empty');
    figures.innerHTML = '';
    warnUl.innerHTML = '';
    headline.textContent = '';
    document.getElementById('sheet-subtitle').textContent = '';

    var kerf = F.parse(cfg.kerf);
    var trim = F.parse(cfg.trim);
    SHEET_INPUTS.kerf.classList.toggle('invalid', !kerf || F.isNegative(kerf));
    SHEET_INPUTS.trim.classList.toggle('invalid', !trim || F.isNegative(trim));

    var sp = sheetParts(data);
    var dims = sheetDims();
    var problems = sp.errors.slice();
    if (!kerf || F.isNegative(kerf)) problems.push('Enter a valid saw kerf.');
    if (!trim || F.isNegative(trim)) problems.push('Enter a valid edge trim.');
    if (!dims) problems.push('Enter a valid custom sheet size.');

    problems.forEach(function (msg) {
      var li = document.createElement('li');
      li.textContent = msg;
      warnUl.appendChild(li);
    });

    var totalQty = sp.parts.reduce(function (n, p) { return n + p.qty; }, 0);
    emptyNote.style.display = (totalQty && !problems.length) ? 'none' : '';
    renderQuickRef(sp.parts, kerf, trim, cfg.allowRotate, problems.length > 0);
    if (!totalQty || problems.length) return;

    var opts = { kerf: kerf, trim: trim, allowRotate: cfg.allowRotate };
    var res = SM.packParts(dims, sp.parts, opts);

    var sourceName = { doors: 'door/front', custom: 'part', slabs: 'slab front' }[cfg.source] || 'panel';
    document.getElementById('sheet-subtitle').textContent =
      '— ' + res.placedUnits + ' ' + sourceName + (res.placedUnits === 1 ? '' : 's') +
      ' on ' + dims.label;

    var totalUsed = res.sheets.reduce(function (n, s) { return n + s.usedArea; }, 0);
    var avgUtil = res.sheets.length
      ? Math.round((totalUsed / (res.sheets.length * res.sheetArea)) * 100)
      : 0;
    headline.textContent = res.sheets.length + ' sheet' + (res.sheets.length === 1 ? '' : 's') +
      ' needed · ' + avgUtil + '% of the material used (kerf ' + F.format(kerf) + '", trim ' +
      F.format(trim) + '"/side' + (cfg.allowRotate ? ', rotation allowed' : ', grain locked') + ')';

    if (res.unplaced.length) {
      var li = document.createElement('li');
      var u = res.unplaced[0];
      li.textContent = res.unplaced.length + ' part' + (res.unplaced.length === 1 ? '' : 's') +
        ' won’t fit this sheet at all (e.g. ' + u.label + ', ' +
        F.format(F.frac(u.w, 64)) + '" × ' + F.format(F.frac(u.h, 64)) + '").';
      warnUl.appendChild(li);
    }

    var widthIn = F.toNumber(dims.width);
    var lengthIn = F.toNumber(dims.length);
    var scale = Math.min(5, 300 / lengthIn);
    var MAX_DRAWN = 8;
    res.sheets.slice(0, MAX_DRAWN).forEach(function (s, i) {
      var fig = document.createElement('figure');
      fig.className = 'viz';
      fig.innerHTML = VZ.sheetSVG(s, {
        widthIn: widthIn, lengthIn: lengthIn, trimIn: F.toNumber(trim)
      }, scale);
      var cap = document.createElement('figcaption');
      cap.textContent = 'Sheet ' + (i + 1) + ' — ' + s.placements.length + ' part' +
        (s.placements.length === 1 ? '' : 's') + ', ' + Math.round(s.utilization * 100) + '% used';
      fig.appendChild(cap);
      figures.appendChild(fig);
    });
    if (res.sheets.length > MAX_DRAWN) {
      var more = document.createElement('p');
      more.className = 'empty-note';
      more.textContent = '… and ' + (res.sheets.length - MAX_DRAWN) + ' more identical-size sheets.';
      figures.appendChild(more);
    }
  }

  function renderQuickRef(parts, kerf, trim, allowRotate, broken) {
    var tbody = document.querySelector('#sheet-quickref tbody');
    tbody.innerHTML = '';
    var totalQty = parts.reduce(function (n, p) { return n + p.qty; }, 0);

    // "fits per sheet" only makes sense when every part is the same size
    var singleSize = null;
    if (parts.length && parts.every(function (p) {
      return F.eq(p.width, parts[0].width) && F.eq(p.height, parts[0].height);
    })) {
      singleSize = parts[0];
    }

    SM.STANDARD_SHEETS.forEach(function (std) {
      var sheet = { width: F.parse(std.width), length: F.parse(std.length) };
      var tr = document.createElement('tr');
      var cells = [std.label, '—', '—', '—'];

      if (!broken && totalQty && kerf && trim) {
        var opts = { kerf: kerf, trim: trim, allowRotate: allowRotate };
        if (singleSize) {
          var g = SM.gridCount(sheet, singleSize, opts);
          cells[1] = g.count ? String(g.count) + (g.rotated ? ' ↻' : '') : 'none fit';
        }
        var res = SM.packParts(sheet, parts, opts);
        if (res.placedUnits) {
          var used = res.sheets.reduce(function (n, s) { return n + s.usedArea; }, 0);
          cells[2] = String(res.sheets.length) +
            (res.unplaced.length ? ' (+' + res.unplaced.length + ' won’t fit)' : '');
          cells[3] = Math.round((used / (res.sheets.length * res.sheetArea)) * 100) + '%';
        } else if (totalQty) {
          cells[2] = 'won’t fit';
        }
      }

      cells.forEach(function (text, i) {
        var td = document.createElement('td');
        td.textContent = text;
        if (i > 0) td.className = 'num';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // ---------------------------------------------------------- board optimizer

  var BOARD_INPUTS = {
    kerf: document.getElementById('board-kerf'),
    trim: document.getElementById('board-trim')
  };

  function renderBoardInputs() {
    BOARD_INPUTS.kerf.value = project.boards.kerf;
    BOARD_INPUTS.trim.value = project.boards.endTrim;
  }

  [['kerf', 'kerf'], ['trim', 'endTrim']].forEach(function (pair) {
    BOARD_INPUTS[pair[0]].addEventListener('input', function () {
      project.boards[pair[1]] = this.value;
      saveProject();
      renderBoards(compute());
    });
  });

  /** Frame-stock boards from inventory with usable dimensions. */
  function stockBoards() {
    return inventory
      .filter(function (item) { return item.material === 'Frame stock'; })
      .map(function (item) {
        var w = F.parse(item.width);
        var l = F.parse(item.length);
        var qty = parseInt(item.qty, 10) || 0;
        if (!w || !l || F.isNegative(w) || F.isZero(w) ||
          F.isNegative(l) || F.isZero(l) || qty < 1) return null;
        return {
          width: w, length: l, qty: qty,
          label: (item.species || 'Board') + ' ' + F.format(w) + '×' + F.format(l)
        };
      })
      .filter(Boolean);
  }

  function renderBoards(data) {
    var headline = document.getElementById('board-headline');
    var figures = document.getElementById('board-figures');
    var warnUl = document.getElementById('board-warnings');
    var emptyNote = document.getElementById('board-empty');
    figures.innerHTML = '';
    warnUl.innerHTML = '';
    headline.textContent = '';

    var kerf = F.parse(project.boards.kerf);
    var trim = F.parse(project.boards.endTrim);
    BOARD_INPUTS.kerf.classList.toggle('invalid', !kerf || F.isNegative(kerf));
    BOARD_INPUTS.trim.classList.toggle('invalid', !trim || F.isNegative(trim));

    var parts = data.cutList.rows
      .filter(function (r) { return r.material === 'Frame stock'; })
      .map(function (r) {
        return { width: r.width, length: r.length, qty: r.qty, label: r.part };
      });
    var boards = stockBoards();
    var totalParts = parts.reduce(function (n, p) { return n + p.qty; }, 0);

    var ready = totalParts > 0 && boards.length > 0 &&
      kerf && !F.isNegative(kerf) && trim && !F.isNegative(trim);
    emptyNote.style.display = ready ? 'none' : '';
    if (!ready) return;

    var res = BM.packBoards(boards, parts, { kerf: kerf, endTrim: trim });

    if (res.placedUnits === res.totalUnits) {
      headline.textContent = 'All ' + res.totalUnits + ' frame parts fit your stock — ' +
        res.boards.length + ' of ' + res.boardsAvailable + ' board' +
        (res.boardsAvailable === 1 ? '' : 's') + ' used.';
    } else {
      headline.textContent = res.placedUnits + ' of ' + res.totalUnits +
        ' frame parts fit the stock on hand.';
      res.shortfalls.forEach(function (s) {
        var li = document.createElement('li');
        var feet = (s.linear / 64) / 12;
        li.textContent = 'Short ' + s.count + ' part' + (s.count === 1 ? '' : 's') + ' at ' +
          F.format(F.frac(s.wclass, 64)) + '" wide — need roughly ' +
          feet.toFixed(1) + ' more linear ft (plus waste).';
        warnUl.appendChild(li);
      });
    }

    var maxLenIn = res.boards.reduce(function (m, b) { return Math.max(m, b.length / 64); }, 1);
    var scale = Math.min(8, 640 / maxLenIn);
    res.boards.forEach(function (b, i) {
      var fig = document.createElement('figure');
      fig.className = 'viz board';
      fig.innerHTML = VZ.boardSVG(b, scale);
      var cap = document.createElement('figcaption');
      var segs = b.strips.reduce(function (n, s) { return n + s.segments.length; }, 0);
      cap.textContent = 'Board ' + (i + 1) + ' — ' + b.label + '" — ' +
        b.strips.length + ' rip' + (b.strips.length === 1 ? '' : 's') + ', ' +
        segs + ' part' + (segs === 1 ? '' : 's') + ', ' +
        Math.round(b.utilization * 100) + '% of the board used';
      fig.appendChild(cap);
      figures.appendChild(fig);
    });
  }

  // ---------------------------------------------------------- import/export

  document.getElementById('export-project').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'door-project.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('import-project').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.openings) || typeof data.settings !== 'object') {
          throw new Error('bad shape');
        }
        project = Object.assign(defaultProject(), data);
        project.settings = Object.assign(defaultProject().settings, data.settings || {});
        project.sheets = Object.assign(defaultSheetConfig(), data.sheets || {});
        project.boards = Object.assign(defaultBoardConfig(), data.boards || {});
        if (!project.settings.drawerStyle) project.settings.drawerStyle = 'fivepiece';
        project.openings.forEach(function (op) {
          if (!op.id) op.id = uid();
          if (!op.type) op.type = op.doorsAcross === 2 ? 'pair' : 'single';
        });
        saveProject();
        renderMode();
        renderSettingsInputs();
        renderSheetInputs();
        renderBoardInputs();
        renderAll();
      } catch (e) {
        alert('That file does not look like a door-project JSON export.');
      }
    };
    reader.readAsText(file);
    this.value = '';
  });

  // --------------------------------------------------------------- inventory

  var inventoryBody = document.querySelector('#inventory-table tbody');

  document.getElementById('add-stock').addEventListener('click', function () {
    inventory.push({
      id: uid(),
      material: 'Frame stock',
      species: '',
      thickness: '3/4',
      width: '',
      length: '',
      qty: 1,
      notes: ''
    });
    saveInventory();
    renderInventory();
    var rows = inventoryBody.querySelectorAll('tr');
    var last = rows[rows.length - 1];
    if (last) last.querySelector('input[data-field="width"]').focus();
  });

  function renderInventory() {
    inventoryBody.innerHTML = '';
    inventory.forEach(function (item) {
      var tr = document.createElement('tr');

      var tdMat = document.createElement('td');
      var sel = document.createElement('select');
      sel.dataset.id = item.id;
      sel.dataset.field = 'material';
      ['Frame stock', 'Panel stock', 'Other'].forEach(function (m) {
        var o = document.createElement('option');
        o.value = m;
        o.textContent = m;
        if (item.material === m) o.selected = true;
        sel.appendChild(o);
      });
      tdMat.appendChild(sel);
      tr.appendChild(tdMat);

      [['species', 'e.g. maple'], ['thickness', '3/4'], ['width', '5 1/2'],
        ['length', '96'], ['qty', ''], ['notes', '']].forEach(function (def) {
        var td = document.createElement('td');
        var input = document.createElement('input');
        input.dataset.id = item.id;
        input.dataset.field = def[0];
        input.value = item[def[0]];
        input.placeholder = def[1];
        input.spellcheck = false;
        if (def[0] === 'qty') {
          input.type = 'number';
          input.min = '0';
          input.step = '1';
          input.className = 'qty';
        }
        td.appendChild(input);
        tr.appendChild(td);
      });

      var tdDel = document.createElement('td');
      tdDel.className = 'no-print';
      var del = document.createElement('button');
      del.className = 'btn danger-text';
      del.textContent = '✕';
      del.title = 'Remove stock';
      del.addEventListener('click', function () {
        inventory = inventory.filter(function (x) { return x.id !== item.id; });
        saveInventory();
        renderInventory();
      });
      tdDel.appendChild(del);
      tr.appendChild(tdDel);

      inventoryBody.appendChild(tr);
    });

    document.getElementById('inventory-empty').style.display = inventory.length ? 'none' : '';

    // summary: total boards + linear feet of frame stock
    var boards = 0;
    var frameInches = 0;
    inventory.forEach(function (item) {
      var q = parseInt(item.qty, 10) || 0;
      boards += q;
      var len = F.parse(item.length);
      if (item.material === 'Frame stock' && len) {
        frameInches += F.toNumber(len) * q;
      }
    });
    document.getElementById('inventory-summary').textContent = inventory.length
      ? boards + ' pieces on hand · ' + (frameInches / 12).toFixed(1) + ' linear ft of frame stock'
      : '';

    renderBoards(compute());
  }

  inventoryBody.addEventListener('input', function (e) {
    var el = e.target;
    var item = inventory.find(function (x) { return x.id === el.dataset.id; });
    if (!item || !el.dataset.field) return;
    item[el.dataset.field] = el.dataset.field === 'qty'
      ? (parseInt(el.value, 10) || 0)
      : el.value;
    saveInventory();
    // update summary without rebuilding rows (keeps focus)
    var boards = 0;
    var frameInches = 0;
    inventory.forEach(function (it) {
      var q = parseInt(it.qty, 10) || 0;
      boards += q;
      var len = F.parse(it.length);
      if (it.material === 'Frame stock' && len) frameInches += F.toNumber(len) * q;
    });
    document.getElementById('inventory-summary').textContent =
      boards + ' pieces on hand · ' + (frameInches / 12).toFixed(1) + ' linear ft of frame stock';
    renderBoards(compute());
  });

  inventoryBody.addEventListener('change', function (e) {
    var el = e.target;
    if (el.tagName !== 'SELECT') return;
    var item = inventory.find(function (x) { return x.id === el.dataset.id; });
    if (item) {
      item.material = el.value;
      saveInventory();
      renderInventory();
    }
  });

  // ------------------------------------------------------------------ boot

  function renderAll() {
    var data = compute();
    renderOpenings(data.perOpening);
    renderBreakdown(data);
    renderCutList(data);
    renderWarnings(data);
    renderCabinet(data);
    renderSheets(data);
    renderBoards(data);
  }

  renderMode();
  renderSettingsInputs();
  renderSheetInputs();
  renderBoardInputs();
  renderAll();
  renderInventory();
})();

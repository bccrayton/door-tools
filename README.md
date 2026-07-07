# Shaker Door Tools

Calculator, cut list, and inventory tools for shaker (frame-and-panel) cabinet
doors — **inset** and **overlay**. No build step, no server, no dependencies:
open `index.html` in any browser and go. Everything you enter is saved locally
in your browser (localStorage) and can be exported/imported as JSON.

## The math

All arithmetic is exact fraction math (no floating-point drift), entered and
displayed in shop fractions like `14 5/8`.

### Inset doors

With a reveal of **3/32" per side** (configurable):

| Piece | Formula |
|---|---|
| Door height | opening height − 3/16" (2 × gap) |
| Door width (single) | opening width − 3/16" |
| Door width (pair) | (opening width − 3 × gap) ÷ 2 — left, center, and right gaps |
| Stile length | door height |
| Rail length | door width − 2 × (stile width) + 2 × (tongue length) |
| Panel width | rail length − 2 × (panel clearance) |
| Panel height | door height − 2 × (rail width) + 2 × (groove depth) − 2 × (panel clearance) |

### Overlay doors

With an overlay of **1/2" per side** (configurable):

| Piece | Formula |
|---|---|
| Door height | opening height + 2 × overlay |
| Door width (single) | opening width + 2 × overlay |
| Door width (pair) | (opening width + 2 × overlay − pair gap) ÷ 2 |

Stiles, rails, and panels follow the same rules as inset once the door blank
size is known.

## Using it

1. **Calculator tab** — pick Inset or Overlay, set your stile/rail width,
   tongue depth, and clearances, then add one row per cabinet opening
   (label, opening width × height, type, quantity). Types: single door,
   door pair, or **drawer front**. Drawer fronts size like a single door
   and build either **five-piece** (same stile/rail/panel math) or **slab**
   (one full-size piece of frame-thickness stock) — pick in settings.
   Sizes can be typed as `14 5/8`, `14-5/8`, `5/8`, or `14.625`.
2. **Cabinet tab** — a to-scale SVG elevation of every opening with its
   door(s) or drawer front drawn in place: real reveal gaps for inset, and
   for overlay the door covering the (dashed) opening. All openings share
   one scale so relative sizes are accurate, with dimension lines for each
   opening.
3. **Cut List tab** — identical parts are merged across openings, sorted
   stiles → rails → panels, longest first, with total linear footage of frame
   stock. Rows marked `*` were rounded to the selected grid (1/16, 1/32, or
   1/64) — pairs often land on 64ths. Print it, download CSV, or copy as text.
4. **Sheets tab** — nests parts onto sheet goods and draws each sheet's
   layout. Nest the project's panels, slab drawer fronts, whole door/front
   blanks (for slab/MDF doors), or any custom part size, onto a standard
   sheet (4×8, 4×10, 5×5 Baltic birch, 4×4, 2×4) or a custom size. Kerf
   spacing between every part, optional edge trim, and grain-locked
   placement by default (height along the sheet length) with an opt-in 90°
   rotation. A quick reference table shows fits-per-sheet, sheets needed,
   and utilization across all the standard sizes at once. Packing is
   first-fit-decreasing shelf nesting in exact 1/64" integer math.
5. **Hinges tab** — cup-hinge (Euro) boring locations for every door
   (drawer fronts are skipped). Set the cup diameter (default `35mm`),
   edge gap/tab (default `5mm`), and end offset (default 3"); hinge count
   follows the standard height rule — ≤40" → 2, ≤60" → 3, ≤80" → 4,
   taller → 5 — or force a count. You get a boring diagram per door
   (hinged edge marked, cup centers with crosshairs and callouts) and a
   drill list with every position in inches *and* millimeters. Metric
   entries like `35mm` or `22.5 mm` parse exactly everywhere in the app
   (1 in = 127/5 mm, kept as an exact fraction).
6. **Inventory tab** — track frame and panel stock on hand (species,
   dimensions, quantity, notes) with a running linear-footage total, plus
   the **board optimizer**: it rips your "Frame stock" boards into strips
   of each part's width (one rip kerf per strip), crosscuts the project's
   stiles and rails onto them (one kerf per cut, optional end trim per
   board end), and draws every board's cutting diagram. Longest boards and
   longest parts go first. If stock runs out it reports the shortfall in
   parts and linear feet per width.

Impossible inputs (an opening narrower than two stiles, negative sizes,
garbage text) are flagged inline and excluded from the cut list with a
warning rather than producing nonsense numbers.

## Development

Plain HTML/CSS/JS. `js/fraction.js` (exact rational arithmetic, fraction and
metric parsing/formatting), `js/doormath.js` (door/drawer sizing and cut-list
aggregation), `js/sheetmath.js` (sheet nesting), `js/boardmath.js`
(rip-and-crosscut board packing), and `js/hingemath.js` (cup-hinge boring
layout) are dependency-free modules that also load in Node; `js/visualize.js`
builds the SVG drawings and `js/app.js` wires up the UI.

Run the tests:

```sh
npm test        # or: node --test tests/
```

## Ideas for later

- Panel-raising and applied-molding profiles
- Face frames

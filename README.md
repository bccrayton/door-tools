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
   (label, opening width × height, single or pair, quantity). Door sizes and
   a per-door stile/rail/panel breakdown update live. Sizes can be typed as
   `14 5/8`, `14-5/8`, `5/8`, or `14.625`.
2. **Cabinet tab** — a to-scale SVG elevation of every opening with its
   door(s) drawn in place: real reveal gaps for inset, and for overlay the
   door covering the (dashed) opening. All openings share one scale so
   relative sizes are accurate, with dimension lines for each opening.
3. **Cut List tab** — identical parts are merged across openings, sorted
   stiles → rails → panels, longest first, with total linear footage of frame
   stock. Rows marked `*` were rounded to the selected grid (1/16, 1/32, or
   1/64) — pairs often land on 64ths. Print it, download CSV, or copy as text.
4. **Sheets tab** — nests parts onto sheet goods and draws each sheet's
   layout. Nest the project's panels, whole door blanks (for slab/MDF
   doors), or any custom part size, onto a standard sheet (4×8, 4×10,
   5×5 Baltic birch, 4×4, 2×4) or a custom size. Kerf spacing between
   every part, optional edge trim, and grain-locked placement by default
   (height along the sheet length) with an opt-in 90° rotation. A quick
   reference table shows fits-per-sheet, sheets needed, and utilization
   across all the standard sizes at once. Packing is first-fit-decreasing
   shelf nesting in exact 1/64" integer math.
5. **Inventory tab** — track frame and panel stock on hand (species,
   dimensions, quantity, notes) with a running linear-footage total.

Impossible inputs (an opening narrower than two stiles, negative sizes,
garbage text) are flagged inline and excluded from the cut list with a
warning rather than producing nonsense numbers.

## Development

Plain HTML/CSS/JS. `js/fraction.js` (exact rational arithmetic and fraction
parsing/formatting), `js/doormath.js` (door sizing and cut-list aggregation),
and `js/sheetmath.js` (sheet nesting) are dependency-free modules that also
load in Node; `js/visualize.js` builds the SVG drawings and `js/app.js`
wires up the UI.

Run the tests:

```sh
npm test        # or: node --test tests/
```

## Ideas for later

- Panel-raising and applied-molding profiles
- Board optimizer: fit the frame cut list onto inventory boards (kerf-aware)
- Drawer fronts and face frames
- Hinge boring locations

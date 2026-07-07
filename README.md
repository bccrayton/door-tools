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
2. **Cut List tab** — identical parts are merged across openings, sorted
   stiles → rails → panels, longest first, with total linear footage of frame
   stock. Rows marked `*` were rounded to the selected grid (1/16, 1/32, or
   1/64) — pairs often land on 64ths. Print it, download CSV, or copy as text.
3. **Inventory tab** — track frame and panel stock on hand (species,
   dimensions, quantity, notes) with a running linear-footage total.

Impossible inputs (an opening narrower than two stiles, negative sizes,
garbage text) are flagged inline and excluded from the cut list with a
warning rather than producing nonsense numbers.

## Development

Plain HTML/CSS/JS — `js/fraction.js` (exact rational arithmetic and
fraction parsing/formatting) and `js/doormath.js` (door sizing and cut-list
aggregation) are dependency-free modules that also load in Node.

Run the tests:

```sh
npm test        # or: node --test tests/
```

## Ideas for later

- Panel-raising and applied-molding profiles
- Board optimizer: fit the cut list onto inventory boards (kerf-aware)
- Drawer fronts and face frames
- Hinge boring locations

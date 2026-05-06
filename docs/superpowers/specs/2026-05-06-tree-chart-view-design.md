# Tree Chart View — Design

**Date:** 2026-05-06
**Status:** Approved (pending implementation)
**Scope:** Add a third view to the builder — an automatically-laid-out genealogy chart, alongside the existing free-form Graphic view and Table view.

---

## Goal

Add a "Tree Chart" view that auto-arranges the family tree into an org-chart-style hierarchy: oldest generation at the top, descendants flowing downward, couples adjacent on the same row. Layout is fully automatic — no manual node positioning. People with no defined relations appear in a "No relation defined" parking area at the bottom of the canvas.

The view supports clan coloring (visually distinguishing connected blood-related groups) and lineage highlighting (clicking a person fades everyone outside their direct ancestor/descendant line).

## Non-goals (v1)

- Persisted user-customizable clan colors.
- Cross-view selection sync between graphic / tree-chart / table.
- Manual node nudging in the tree chart (auto-layout only).
- Multi-marriage rendering (data model only supports one `spouseId`).
- Virtualization for very large trees (>500 people). Acceptable performance is the target; virtualization is a later optimization.

## Decisions log

These decisions came out of brainstorming and are fixed for v1:

| Question | Decision |
|---|---|
| Editable from this view? | Yes — edits flow through the existing modal and trigger a re-layout. No manual node positioning. |
| Multi-cluster trees? | Render side-by-side, sharing one Y-axis. Generation 0 is the same row across all clusters. |
| Spouse rendering? | Adjacent couple unit, marriage line between them, children descend from couple midpoint. |
| Spouse with no parents in tree? | Sits next to partner; no vertical line going up; no phantom slot. |
| Spouses at different calculated generations? | Pulled together onto the deeper row; ancestors of the shallower spouse propagate up to keep parents-above-children. |
| Definition of "no relation"? | No `motherId`, no `fatherId`, no `spouseId`, no incoming child edges, no line-only connections. Line-only counts as a relation and stays in the chart. |
| Parking area position? | Bottom, with a labeled divider, grid-wrapped alphabetical. |
| Clan = ? | Connected component using parent-child edges only. Spouses don't merge clans; shared children do. |
| Lineage highlight = ? | Strict ancestors + descendants + self. In-laws fade. |
| Clan color source? | Auto-generated golden-ratio HSL palette, stable for same input. |
| Clan color visual? | Outer ring on each node. Skipped entirely if only 1 clan. |
| View selector UI? | 3-way segmented control (icon buttons): Graphic / Tree Chart / Table. |
| Architecture? | New SVG-based module under `src/features/tree-chart/`. Existing `CanvasRenderer` untouched. |

---

## Architecture

### Module layout

```
src/features/tree-chart/
  tree-chart-view.js         # Init entry point; owns the <svg>, lifecycle, events
  tree-chart-layout.js       # Pure: data → laid-out coordinates
  tree-chart-clans.js        # Pure: data → clan assignments + color palette
  tree-chart-highlight.js    # Highlight state + DOM class application
  tree-chart-renderer.js     # Builds and updates SVG nodes/edges from layout output
  tree-chart-config.js       # Tunable constants (row height, gaps, etc.)
  styles/tree-chart.css      # Node, edge, clan, fade, parking-area styling
```

The `*-layout`, `*-clans`, and pure parts of `*-highlight` are pure functions over the person `Map`. They take data, return data. They don't touch the DOM. The renderer is the only piece that touches SVG; the view module is the only piece that touches event listeners and lifecycle.

### Public exports

```js
// tree-chart-view.js
export function initTreeChartView(containerEl)
```

Single init function, mirroring how `table.js` is wired into the builder. Internally holds an instance with state (SVG ref, current layout cache, highlight state, viewBox), but nothing about that is "public." The view subscribes to EventBus events on init and self-manages.

### Touchpoints in existing code

- `src/pages/builder.astro` — replace single `viewToggle` button with a 3-way segmented control; add `<div id="treeChartView" class="hidden">` next to `#graphicView` and `#tableView`; replace 2-state `toggleView()` with `setView(name)`; extend `triggerCanvasZoom()` to dispatch to the active view's element; extend export menu logic to detect active view; import and call `initTreeChartView()`.
- `assets/locales/{en,es,ru,de}.json` — new keys for view labels, parking-area divider, empty state, lineage announcements.
- `src/utils/event-bus.js` — verify existing event names; add any missing ones (e.g., a `TREE_LOADED` event for full reload).

### What does not change

- `CanvasRenderer` (`src/core/canvas-renderer.js`) — unchanged.
- `GenerationCalculator` (`src/utils/generation-calculator.js`) — used as input hint; not modified.
- `TreeEngine` (`src/core/tree-engine.js`) — used as data source via `window.treeCore`. No changes.
- Data model (`personData` Map shape, `version: 2.1.0` cache format) — unchanged.
- Existing edit/add/delete person modals — reused as-is.

---

## Layout algorithm

### Inputs

- `personData: Map<id, Person>` from `treeCore`.
- `generationData: Map<id, number>` from `GenerationCalculator` — used as a starting hint, then recomputed.

### Output

```js
Layout = {
  nodes:    Map<id, {x, y, width, height, generation, clusterId, clanId, isParked}>,
  edges:    Array<{fromId, toId, type: 'parent'|'spouse'|'lineOnly', path: 'M..L..'}>,
  parking:  { y, height, items: Array<{id, x, y}> } | null,
  bounds:   { minX, minY, maxX, maxY }
}
```

### Steps

1. **Cluster detection.** Connected components using parent-child *and* spouse edges. Each component is a "cluster" — one laid-out tree.
2. **Clan detection.** Connected components using *only* parent-child edges. A child of two parents in different families causes their clans to merge (handled naturally by the connected-component walk).
3. **Parking-area assignment.** A person is parked iff: no `motherId`, no `fatherId`, no `spouseId`, no incoming child edges, no line-only connections.
4. **Couple grouping.** For each cluster, build "couple units": a couple is `{a, b}` where `a.spouseId === b.id` and both are in the cluster; a singleton is a person without a spouse-in-cluster. The couple unit becomes the atomic positioning unit.
5. **Generation reassignment via longest-path DAG.** Build a DAG of couple-units with edges `couple_of_parents → couple_of_child`. Generation of a couple = longest path from any source node to it. Generation of each individual = generation of their couple. This pulls in-marrying spouses' ancestors down to keep parents-above-children. Cycles (rare malformed data): break by dropping back-edges and emit a console warning.
6. **In-cluster horizontal layout (Reingold-Tilford, adapted for couples).** Process each cluster's couple-DAG top-down by generation. For each couple-unit, recursively lay out its children's couple-units; the children's X-band is centered on the couple's midpoint X. Use Reingold-Tilford "contour" tracking to prevent subtree overlap. Couple member positions: `x_a = couple.x - (NODE_WIDTH + COUPLE_GAP) / 2`, `x_b = couple.x + (NODE_WIDTH + COUPLE_GAP) / 2`. A child of two parents in different couples (rare): pick the couple containing the recorded `fatherId`, fall back to `motherId`. Emit warning.
7. **Cluster placement.** Compute each cluster's bounding-box width. Order clusters by size, largest first. Place left-to-right with `CLUSTER_GAP` between them. All clusters share the same Y-axis.
8. **Parking area.** Below the lowest occupied row, with `PARKING_GAP` and a labeled horizontal divider. Grid-wrap parked people, alphabetical by name. Width matches chart bounds; rows wrap as needed.
9. **Edge path generation.** Org-chart "elbow" connectors. Parent-child: from parents' midpoint at `parents.y + NODE_HEIGHT/2`, drop to a horizontal bus line at `parents.y + ROW_HEIGHT/2`, run horizontally to above the child, drop to `child.y - NODE_HEIGHT/2`. Multiple siblings share the bus line. Spouse: short horizontal segment at shared Y. Line-only: dashed direct line.
10. **Bounds.** Aggregate min/max X/Y across all nodes and parking. That becomes the SVG `viewBox` for fit-to-screen on first render.

### Tunable constants (`tree-chart-config.js`)

```js
ROW_HEIGHT = 140        // vertical generation spacing
NODE_WIDTH = 100
NODE_HEIGHT = 60
NODE_GAP_X = 20         // gap between sibling nodes
COUPLE_GAP = 10         // gap between spouses within a couple
CLUSTER_GAP = 80        // gap between independent clusters
PARKING_GAP = 100       // gap between chart bottom and parking divider
HIGHLIGHT_FADE_OPACITY = 0.25
HIGHLIGHT_EDGE_FADE_OPACITY = 0.15
DEBOUNCE_MS = 100
```

These aren't user-facing settings in v1 — keep as constants. Easy to expose later.

### Performance budget

- Layout cost: O(N log N) for sorting + O(N) for longest-path DAG + O(N²) worst case for Reingold-Tilford contour comparisons (effectively O(N) for typical trees).
- Target: ≤50ms layout time for 200-person trees on mid-range hardware.
- Re-layout debounced 100ms after EventBus data-change events.
- Layout cache key: hash of layout-affecting fields per person (`{id, motherId, fatherId, spouseId, hasLineOnly, name}`). Other field edits (DOB, gender, photo) skip layout entirely and re-render only the affected node.

---

## View integration & UI plumbing

### Selector UI

Replace the single `viewToggle` button at `src/pages/builder.astro:310` with a 3-button segmented control:

```html
<div id="viewSelector" class="view-selector" role="tablist" aria-label="...">
  <button id="viewGraphicBtn" class="view-btn active" role="tab" aria-selected="true"
          data-view="graphic" data-i18n-title="builder.sidebar.view_graphic">
    <svg>...</svg>
  </button>
  <button id="viewTreeChartBtn" class="view-btn" role="tab" aria-selected="false"
          data-view="treeChart" data-i18n-title="builder.sidebar.view_tree_chart">
    <svg>...</svg>
  </button>
  <button id="viewTableBtn" class="view-btn" role="tab" aria-selected="false"
          data-view="table" data-i18n-title="builder.sidebar.view_table">
    <svg>...</svg>
  </button>
</div>
```

Active button gets `.active`. ARIA `tablist` / `tab` roles. Keyboard: ←/→ moves focus between tabs.

### Markup

Third sibling alongside `#graphicView` and `#tableView`:

```html
<div id="treeChartView" class="hidden" role="tabpanel"></div>
```

`TreeChartView` mounts an `<svg>` inside it on init.

### View-switching logic

Replace the current 2-state `toggleView()` with a `setView(name)` function: sets `currentView`, toggles `.hidden` on the three containers, updates `.active` and `aria-selected` on the three buttons, dispatches a `view:changed` custom event. Clicking any view button calls `setView(button.dataset.view)`.

### Initialization order

1. `treeCore` is created (existing).
2. `initTreeChartView(document.getElementById('treeChartView'))` is called — mounts SVG, subscribes to EventBus, no layout work yet.
3. First `setView('treeChart')` triggers initial layout + render.

### Edit modal flow

- Click a node in the tree-chart view → opens existing edit-person modal (same one used by graphic view). Modal is view-agnostic; operates on `treeCore.personData`.
- Modal save → `treeCore` emits its existing person/relation events → `TreeChartView` re-runs layout and re-renders (debounced).
- Right-click / long-press → contextual menu (add child, add parent, add spouse, delete) — reuses existing menu if present; otherwise modal-only flow in v1.
- Click on empty SVG canvas → if a node is highlighted, clear it; otherwise no-op (don't add a person on click — that's specific to the free graphic view).

Adding a person who has no relations: appears in the parking area on next layout. From there, click to open modal and assign relations.

### Pan/zoom in SVG

`viewBox` manipulation on the root `<svg>`. Mouse wheel zooms toward cursor; click-drag on empty canvas pans. Same wheel-zoom factor and drag threshold as the graphic view. Touch: pinch-zoom + 1-finger pan.

### Zoom controls integration

The existing `#zoomInControl` / `#zoomOutControl` buttons (lines 685-700) currently dispatch wheel events at the canvas. Extend `triggerCanvasZoom()` (line 1314) to detect active view and dispatch to the right element — `#svgArea`-equivalent in the tree-chart, or canvas in graphic view, or no-op for table view.

### Export menu integration

The existing export menu (lines 744+) currently exports the canvas. Extend export logic to detect active view: graphic → existing canvas pixel export; tree-chart → SVG markup serialization (and rasterize to PNG via offscreen canvas for PNG/JPG formats); table → notice "Switch to a graphical view to export."

### EventBus subscriptions

The view subscribes once on init to:
- `TREE_PERSON_ADDED`, `TREE_PERSON_UPDATED`, `TREE_PERSON_DELETED`
- `TREE_RELATION_CHANGED` (or whichever existing event signals parent/spouse linkage changes — verified during implementation)
- `TREE_LOADED` (full reload after JSON load or GEDCOM import) → rebuild without debounce

If any of these don't exist yet in `event-bus.js`, the design adds them rather than working around their absence.

### Visibility-aware suspension

When the tree-chart container is hidden, `onDataChanged()` sets a `dirty` flag and returns. No layout work runs. When `setView('treeChart')` shows it: if `dirty`, rebuild immediately; otherwise no-op. Avoids paying layout cost while user is in graphic or table view.

---

## Data flow

```
treeCore.personData (Map)        — source of truth, owned by TreeEngine
        │
        ▼
EventBus emits TREE_PERSON_*     — emitted by treeCore on any mutation
        │
        ▼
TreeChartView.onDataChanged()    — debounced 100ms; suspends if hidden
        │
        ▼
runLayout(personData)            — pure: returns Layout object
   ├─ detectClusters
   ├─ detectClans
   ├─ assignParking
   ├─ buildCoupleDAG
   ├─ assignGenerations          — longest-path
   ├─ layoutClusters             — Reingold-Tilford
   ├─ generateEdgePaths
   └─ computeBounds
        │
        ▼
renderLayout(svgEl, layout)      — diff-based DOM update
        │
        ▼
applyHighlight(svgEl, lineSet)   — class toggles only
```

### Render strategy: shallow diff

Keep a `Map<personId, SVGGElement>`. On rerender, match nodes by `personId` and update position + clan + name text. New nodes get created; deleted nodes get removed. CSS transition on `transform` gives nodes a 250ms glide to new positions when data changes — costs nothing extra in code.

### Persistence

The view stores no persistent state. Highlight, viewBox/zoom — all in-memory only, reset on page reload. Same as the table view. The data being visualized is already persisted by `treeCore`.

---

## Clan colors

### Assignment (`tree-chart-clans.js`)

- Connected components over parent-child edges, sorted by size (largest first) for stable ordering within a given dataset.
- Generate N colors via golden-ratio hue spacing: `hue_i = (i * 137.508°) mod 360°`, fixed `saturation=65%`, `lightness=55%`.
- Stable for the same input data; **not stable across edits** that change clan ordering. This is acceptable — clans aren't durable identities, they're derived. Documented behavior, not a bug.
- Skip coloring entirely if exactly 1 clan exists.

### Rendering

Each `<g class="tc-node">` gets `data-clan="3"` and inline style `--clan-color: hsl(247, 65%, 55%)`. CSS:

```css
.tc-node[data-clan] .tc-node-ring {
  stroke: var(--clan-color);
  stroke-width: 4px;
  fill: none;
}
```

The "ring" is a separate `<circle>` or `<rect>` outside the node's main shape. Doesn't conflict with node fill/stroke from settings. When only 1 clan: renderer omits `data-clan`, CSS rule doesn't apply, no ring drawn.

A single cluster can contain ≥2 clans (e.g., a marriage where the couple has no shared child yet). That's the correct visual — both clans visibly present, distinct rings, joined by a marriage line.

---

## Lineage highlight

### State (`tree-chart-highlight.js`)

Module owns one piece of state: `highlightedPersonId | null`. Pure function:

```js
computeBloodLine(personId, personData) → Set<id>
```

Walks ancestors recursively via `motherId`/`fatherId`. Walks descendants recursively (build a child index once: `childrenOf: Map<parentId, id[]>`). Includes the clicked person. Excludes in-laws (spouses of ancestors/descendants who aren't themselves on the line). Memoized per `personId` until data changes.

### Rendering

Click handler on `<g class="tc-node">` calls `setHighlight(personId)`. Toggles a single class on the SVG root: `<svg class="tc-has-highlight">`. Each node `<g>` gets `tc-on-line` if its id is in the set.

```css
.tc-has-highlight .tc-node:not(.tc-on-line) { opacity: 0.25; }
.tc-has-highlight .tc-edge:not(.tc-on-line) { opacity: 0.15; }
```

Edge opacity: an edge is `tc-on-line` only if **both** endpoints are. Otherwise it fades. Avoids dangling visible lines ending at faded nodes.

### Clearing

Clears on: click empty SVG, press Escape, click same already-highlighted person (toggle), switch view, layout rebuild. All routes set `highlightedPersonId = null` and remove `tc-has-highlight`.

### Selection vs highlight

Same thing in this view. v1 does not sync with the graphic view's selection state.

### Accessibility

Each node `<g>` gets `tabindex="0"`, `role="button"`, `aria-label="<full name>, generation N, click to highlight lineage"`. `Enter` / `Space` triggers click. Faded nodes still receive focus normally. Highlight state announced via an `aria-live="polite"` region.

---

## i18n

New keys, all four locales (`en`, `es`, `ru`, `de`):

```
builder.sidebar.view_graphic            "Graphic view"
builder.sidebar.view_tree_chart         "Tree chart"
builder.sidebar.view_table              "Table view"
builder.tree_chart.parking_area         "No relation defined"
builder.tree_chart.empty_state          "Add your first person to see the tree chart"
builder.tree_chart.lineage_announce     "Showing {name}'s lineage: {ancestors} ancestors, {descendants} descendants"
builder.tree_chart.highlight_cleared    "Highlight cleared"
```

---

## Testing

### Unit tests (`tests/unit/tree-chart/`)

- `tree-chart-clans.test.js`
  - 3 separate families → 3 clans (expected use).
  - Marriage between two clans without shared child → still 2 clans (edge).
  - Child of two parents in different families → 1 merged clan (edge).
  - Empty input → 0 clans (failure case).
- `tree-chart-layout.test.js`
  - Simple 3-generation tree → correct generation assignment (expected).
  - Spouse with deeper-generation partner → both assigned to deeper row, ancestors propagate (edge).
  - Cyclic parent-child data → cycle broken, warning logged, layout still produced (failure).
- `tree-chart-highlight.test.js`
  - Clicked person → bloodline = ancestors + descendants + self (expected).
  - In-law (spouse of ancestor) excluded from bloodline (edge).
  - Childless leaf → bloodline = ancestors + self only (failure/edge).

### E2E tests (`testing/tests/`)

- Switch to tree-chart from default → SVG renders ≥1 node.
- Add person via modal → tree-chart re-layouts within 200ms.
- Click a node → other nodes fade.
- Press Escape → fade clears.
- Switch to table, add person, switch back → tree-chart shows new person.

---

## Edge cases

- **Empty tree** → SVG with centered i18n empty-state message.
- **1 person** → centered single node, no parking, no clan ring.
- **Cyclic data** → handled per Step 5 of layout; warning logged.
- **Same-sex couples** → no special handling; layout is gender-agnostic.
- **Cousin / incestuous marriages** → couple-DAG remains a DAG (no cycles introduced by marriage); longest-path generation handles correctly.
- **Person with multiple historical spouses** → data model only stores one `spouseId`; only current spouse rendered. Documented limitation.
- **Very large trees (>500 persons)** → layout still runs; no virtualization in v1; document `TODO`.

---

## Migration awareness (CLAUDE.md)

The site is mid-migration to Astro + Cloudflare Pages. This change is in the current static structure: builder remains a single Astro page; new module lives under `src/features/`, matching the existing pattern (`src/features/import/`, `src/features/search/`, etc.). No backend or cloud dependencies introduced. No new patterns that conflict with the future structure in [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Open items deferred to implementation

- Verify exact EventBus event names in `src/utils/event-bus.js`. Add any missing ones rather than working around.
- Confirm whether a contextual menu (right-click / long-press) exists in the graphic view. If yes, reuse; if no, modal-only flow in v1.
- Confirm exact node visual styling (font sizes, border-radius, colors) to match the graphic view's settings panel — must look like the same product, not a bolted-on second view.

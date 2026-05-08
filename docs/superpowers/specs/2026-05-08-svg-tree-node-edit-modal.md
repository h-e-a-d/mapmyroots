# SVG Tree Node — Double-Click to Edit Person

**Date:** 2026-05-08
**Status:** Approved

## Problem

The SVG tree chart (`src/features/tree-chart/`) has no way to open the person edit modal. The Canvas tree supports this via a double-click handler in `tree-engine.js`, but that path is not wired up for the SVG tree. Single-click on SVG nodes already toggles bloodline highlighting and must remain unchanged.

## Solution

Add double-click on SVG tree nodes as the trigger to open the person edit modal. Use the EventBus (`TREE_NODE_EDIT_REQUESTED`) rather than a direct import, consistent with the project's event-driven architecture principle.

## Interaction Model

| Gesture | Existing behavior | After change |
|---------|------------------|--------------|
| Single click on node | Toggle bloodline highlight | Unchanged |
| Double-click on node | Nothing | Opens person edit modal |
| Double-click on background | Nothing | Nothing (no change) |

Double-click fires after single-click, so bloodline highlight toggles on the first click before the modal opens. This matches Canvas tree behavior and is acceptable.

## Architecture

### New event constant

`src/utils/event-bus.js` — add to `EVENTS`:
```js
TREE_NODE_EDIT_REQUESTED: 'tree:node:edit:requested'
```

Payload: `{ personId: string }`

### Emit (tree-chart-view.js)

Add a delegated `dblclick` listener on the SVG root, mirroring the existing `click` listener pattern:

```js
svg.addEventListener('dblclick', (ev) => {
  const nodeEl = ev.target.closest('.tc-node');
  if (!nodeEl) return;
  bus.emit(EVENTS.TREE_NODE_EDIT_REQUESTED, { personId: nodeEl.dataset.personId });
});
```

### Subscribe (modal.js)

During modal initialization, subscribe to the event:

```js
bus.on(EVENTS.TREE_NODE_EDIT_REQUESTED, ({ personId }) => openModalForEdit(personId));
```

### Accessibility (tree-chart-renderer.js)

Update `aria-label` on node `<g>` elements:
- Before: `"${fullName}, ${genStr}, click to highlight lineage"`
- After: `"${fullName}, ${genStr}, click to highlight lineage, double-click to edit"`

## Files Changed

| File | Change |
|------|--------|
| `src/utils/event-bus.js` | Add `TREE_NODE_EDIT_REQUESTED` to `EVENTS` |
| `src/features/tree-chart/tree-chart-view.js` | Add `dblclick` listener; emit event |
| `src/ui/modals/modal.js` | Subscribe to event; call `openModalForEdit` |
| `src/features/tree-chart/tree-chart-renderer.js` | Update `aria-label` string |

No new files. No changes to person data model, save flow, or modal internals.

## Edge Cases

- **Double-click on SVG background:** `closest('.tc-node')` returns null → no-op.
- **Modal already open:** `openModalForEdit` repopulates with the new person — existing logic handles this.
- **EventBus not initialized:** The `bus` reference is already established in `tree-chart-view.js` at init time; same guard applies.

## Out of Scope

- Keyboard shortcut to open edit modal from a focused node (separate task if desired)
- Any visual change to node appearance on hover (no hover state planned)

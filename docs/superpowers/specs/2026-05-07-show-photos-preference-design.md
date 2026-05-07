# Show Photos Display Preference

**Date:** 2026-05-07  
**Branch:** feat/tree-chart-view  
**Status:** Approved

## Overview

Add a "Show Photos" checkbox to the Display Preferences section of the settings panel. When unchecked, photos are not rendered on canvas nodes — the circle falls back to the existing name/text display, exactly as it appears when no photo has been uploaded.

## Affected Files

| File | Change |
|------|--------|
| `src/core/canvas-renderer.js` | Add `showPhotos: true` to default `displayPreferences`; guard image draw and text fallback |
| `src/core/tree-engine.js` | Add `showPhotos: true` to default `displayPreferences` |
| `src/pages/builder.astro` | Add checkbox HTML to Display Preferences section |
| `src/ui/components/ui-settings.js` | Add `'showPhotos'` to `preferences` array |
| `assets/locales/en.json` | Add `show_photos` key |
| `assets/locales/es.json` | Add `show_photos` key |
| `assets/locales/ru.json` | Add `show_photos` key |
| `assets/locales/de.json` | Add `show_photos` key |

## Data Model

Add `showPhotos: true` to the `displayPreferences` object in two places:

```js
// src/core/canvas-renderer.js ~line 88
this.displayPreferences = {
  showMaidenName: true,
  showDateOfBirth: true,
  showFatherName: true,
  showPhotos: true   // ← new
};

// src/core/tree-engine.js ~line 37
displayPreferences: {
  showMaidenName: true,
  showDateOfBirth: true,
  showFatherName: true,
  showPhotos: true   // ← new
}
```

Persists automatically via the existing undo/save pipeline — no new storage code needed.

## Settings UI

Add one checkbox item after `showFatherName` in `src/pages/builder.astro`:

```html
<div class="checkbox-item">
  <input type="checkbox" id="showPhotos" checked>
  <label for="showPhotos" data-i18n="builder.settings.show_photos">Show Photos</label>
</div>
```

In `src/ui/components/ui-settings.js`, add `'showPhotos'` to the existing `preferences` array (line 263):

```js
const preferences = ['showMaidenName', 'showDateOfBirth', 'showFatherName', 'showPhotos'];
```

The existing loop wires up the checkbox, syncs it to `treeCore.displayPreferences`, calls `renderer.updateDisplayPreferences()`, shows a notification, and pushes an undo state — all for free.

## Renderer Changes (`src/core/canvas-renderer.js`)

In `drawCircleNode`, wrap the image draw block and update the text guard:

```js
// Before (line ~1148):
const img = this._getNodeImage(id, node);
if (img && img.complete && img.naturalWidth > 0) {
  // draw image ...
}
if (!node.photoBase64) {
  this.drawNodeText(ctx, node, radius * 1.8);
}

// After:
const showPhotos = this.displayPreferences.showPhotos !== false;
const img = showPhotos ? this._getNodeImage(id, node) : null;
if (img && img.complete && img.naturalWidth > 0) {
  // draw image ... (unchanged)
}
if (!node.photoBase64 || !showPhotos) {
  this.drawNodeText(ctx, node, radius * 1.8);
}
```

The rectangle node style does not currently render photos, so no change needed there.

## i18n

Add to all four locale files under `builder.settings`:

| Locale | Key | Value |
|--------|-----|-------|
| en | `show_photos` | `"Show Photos"` |
| es | `show_photos` | `"Mostrar Fotos"` |
| ru | `show_photos` | `"Показывать фото"` |
| de | `show_photos` | `"Fotos anzeigen"` |

## Out of Scope

- The PNG/image exporter (`src/features/export/exporter.js`) also renders photos. Respecting the `showPhotos` flag there is a separate follow-up.
- Per-person photo visibility toggle (global only for now).

## Success Criteria

1. Checkbox appears in Display Preferences, checked by default.
2. Unchecking hides all photos on the canvas; nodes show name text instead.
3. Re-checking restores photos immediately.
4. Setting persists across sessions (saved with tree data).
5. Undo/redo works for the toggle.
6. All four locales show the correct label.

# Changelog

Historical record of significant changes. Going forward, prefer Git history + release notes over this file.

## January 2025 — Critical Fixes

### Export System Improvements
- **Outline Export Fix:** "Show outline" feature now applies to exported files (PNG, SVG, PDF). Updated `drawCircleNodeExport()` and `drawRectangleNodeExport()` in `canvas-renderer.js` to respect outline settings. SVG export styling made conditional based on `window.treeCore.renderer.settings.showNodeOutline`.
- **Connection Lines Export Restoration:** Fixed connection lines disappearing in exports after the outline fix. `drawConnectionsOnly()` was using hardcoded colors instead of user settings; now mirrors browser display logic.

### Connection Modal Implementation
- Added `setupConnectionModal()`, `openConnectionModal()`, `closeConnectionModal()`, `createConnectionWithType()`, `createLineOnlyConnection()` methods.
- Full support for Mother, Father, Child, Spouse, and Line-only connection types.
- Personalized modal text showing actual person names; proper notifications.
- **Line-Only Connection Fix:** Corrected `createConnectionWithType()` parameter handling — was passing person objects instead of IDs.

### Cache Indicator UX
- **Auto-Close Prevention:** Cache indicator no longer closes immediately when editing tree name.
- Added `clearCollapseTimer()` with hover protection.
- Input field interactions no longer trigger parent element handlers.

## December 2024 — Modal UX/UI Redesign

- Complete redesign of Add Person and Edit Person modals.
- Three-tier button system with gradients, animations, and visual hierarchy.
- Mobile-first single-row button arrangement.
- Confirmation modals with consequence lists.
- Resolved CSS conflicts between `ui-modals.js` automatic enhancement and `modal.css` styles by exempting `personModal` from automatic enhancement.

## December 2024 — Critical Bug Fixes

- **Button State Management:** Fixed conflict between multiple button management systems. Save/Delete buttons no longer become permanently disabled after one use.
- **Race Condition Fix:** Eliminated timing conflicts between competing button-loading-state managers.
- Comprehensive button state reset on modal open/close.

## December 2024 — Modal System Refactoring

- Extracted all modal CSS from `style.css` into dedicated `modal.css`.
- `builder.html` now references both `style.css` and `modal.css`.

## December 2024 — Legacy Code Removal

- Removed all support for legacy data formats. Application now only accepts the current JSON schema.
- Removed `processLegacyData()` and `checkForLegacyData()` methods.
- Removed legacy import modal and related UI elements.
- Removed legacy-related translations from all locale files.

## December 2024 — Smart Node Positioning Fix

- New nodes appear at the current viewport center for immediate visibility.
- Camera auto-centers on loaded JSON content when no saved position exists.

## 2024 — Security & Architecture Overhaul

- All `innerHTML` usage replaced with safe DOM manipulation via `SecurityUtils`.
- Comprehensive input sanitization and data validation.
- Event-driven architecture (`event-bus.js`) replacing window globals.
- `RetryManager` for resilient operations.
- Full keyboard navigation and screen reader support.
- Centralized configuration with feature flags (`config.js`).

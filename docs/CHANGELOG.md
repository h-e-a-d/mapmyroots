# Changelog

Summary of significant changes, newest first. Git history has the details.

## October 2026: Keyboard shortcuts and dev tooling

- **Keyboard shortcuts dropped quick presses.** The 100 ms debounce in `tree.js` started on the modifier keydown, so a P, G or / pressed within 100 ms of Cmd/Ctrl was ignored: Cmd/Ctrl+Shift+P (PDF), Cmd/Ctrl+Shift+G (GEDCOM) and Cmd/Ctrl+/ (search) all failed. The debounce now starts only when a shortcut fires, and auto-repeat is ignored.
- **Shortcuts on non-Latin layouts.** With a Russian layout, Cmd+Shift+P reports `key: "З"` and never matched. `src/utils/shortcut-keys.js` falls back to the physical key when the layout doesn't produce a Latin letter (Latin layouts such as AZERTY keep the printed letter).
- New e2e spec `keyboard-shortcuts.spec.js` (fast presses, Ctrl and Cmd). It fails on the old code.
- **Dev tooling:** vitest 3 → 5 (clears the critical `tinypool`/vitest advisories; two constructor mocks updated for Vitest 4's arrow-function rule). Removed the unused `@axe-core/cli`. `npm audit`: 30 → 24, critical 3 → 0, production 0. The remaining highs are all `@lhci/cli`'s Puppeteer/proxy chain (CI only; 0.15 does not clear them).

## October 2026: Astro 7 and dependency updates

- **Astro 5.18 → 7.4** (Vite 8, Rolldown). `npm audit`: 69 → 30 advisories, and production dependencies 18 → 0. All remaining advisories are dev tooling (vitest, `@axe-core/cli`, `@lhci/cli`).
- Rendering is unchanged: computed styles of every element on 11 pages at 1440 px and 390 px match the Astro 5 build. The sitemap, OG images and service worker precache are identical.
- Migration: glossary moved to the content layer (`src/content.config.ts`, `glob()` loader, `id` replaces `slug`). `astro-og-canvas` 0.13 (`param` option removed). `compressHTML: true` keeps the old whitespace. Console stripping moved from `esbuild.pure` (ignored by Vite 8) to Rolldown `treeshake.manualPureFunctions`. CSS/JS browser targets pinned to Vite 6's (Safari 14+): Vite 8's newer default emits range media queries that iOS Safari < 16.4 ignores.
- Sitemap: Astro 7 passes i18n fallback redirects to `@astrojs/sitemap`. `sitemap-filter.mjs` keeps them out.
- **Fixed:** every static page threw `devLog is not defined` from `homepage.js` (live since at least May 2026). The handler it aborted (runtime re-translation and a custom `page_view` push) had never run in production and was removed rather than revived.
- CI and Lighthouse workflows use Node 22. Cloudflare Pages already builds on Node 22.23.4 (verified 2026-10-30).

## October 2026: E2E suite repair

- **Add person had no marriages row.** The marriages list was only mounted when editing, so a new person's modal showed a "Marriages" label with nothing under it and no spouse picker. It now shows one empty row, as the design spec says.
- **Builder view buttons were dead for the first second.** `builder-page.ts` waited a fixed 1000 ms before wiring the sidebar, view buttons and tree chart. It now waits for the tree core and sets `body[data-builder-ready]`.
- **E2E suite passes (29/29 on Desktop Chrome, three runs in a row).** The earlier failures were test bugs (clicking `pointer-events: none` radios, a `window.appContext` that doesn't exist, reading a stale counter, selectors for canvas nodes that aren't in the DOM), now fixed through shared helpers.
- **CI e2e job finishes.** It ran six browser projects with only Chromium installed and was cancelled on every run. It now runs Desktop Chrome only, with one retry.

## October 2026: Static-page styling

- About, Contact, Privacy, Terms, Glossary and Offline rendered without header, navigation or content styles, because that CSS lived only in the homepage stylesheet. Shared chrome moved to `site.css` (loaded by `BaseLayout`), and the content pages got `content-pages.css`. The homepage's computed styles are unchanged.
- The mobile menu opened with zero height on every page, including the homepage: the header's `backdrop-filter` makes it the containing block for the fixed-position menu. The menu is now sized explicitly.
- The hidden skip link peeked 2px into the top of the homepage. Fixed.

## October 2026: Site audit

- **PDF export fixed in production.** `/builder` was sent two CSP headers, and the stricter one blocked the CDN that jsPDF loaded from. jsPDF is now a bundled, pinned npm dependency, and `_headers` has a single policy.
- **Static pages translated.** About, Contact, Privacy and Terms showed raw translation keys. They now render at build time in en/de/es/ru, and privacy and terms gained `/de`, `/es` and `/ru` routes.
- **Security.** Search suggestions and relationship selects no longer render person names as HTML (stored XSS via imported trees). `SecurityUtils.setTextContent` no longer shows literal entities.
- **Analytics.** Builder events were sent to GA4 twice (duplicate `AnalyticsIntegration`). Fixed, with a guard against re-binding.
- **Shortcuts.** Ctrl/Cmd+/ (focus search) and Ctrl/Cmd+Shift+P (PDF export) work again.
- **Cleanup.** Split `exporter.js` (GEDCOM moved to its own module). Moved builder inline scripts to `src/ui/builder/`. Removed legacy social-image tooling and unused dependencies. Added guard tests for i18n keys, `innerHTML` and CSP. Rewrote `ARCHITECTURE.md` to match the code.
- GTM container `GTM-MNZ4MJB7` restored on all pages, so GA4 receives data again.

## July 2026: Builder hardening and performance (PR #1)

- Render-loop culling, cached text layout, batched grid drawing, and autosave only when the tree is dirty
- First-run empty state; undo/redo no longer shows a toast every time; Cmd is the primary shortcut modifier on macOS
- Deep-cloned undo snapshots (fixed shared-reference corruption)
- Removed unused CommandManager, QuadTree and the connection-loss polling monitor
- SEO and privacy accuracy: `/view` noindexed, structured-data claims corrected, DOMPurify bundled instead of loaded from a CDN

## May 2026: Phase 5 features and Astro migration

- Migration to Astro + Cloudflare Pages, SEO infrastructure and PWA (Phases 1–4 in `ROADMAP.md`)
- Photos (avatar cropper), document attachments with PDF preview, rich person fields (dated, placed events, marriages), tree-chart view, share-by-link and GEDCOM import

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

# Architecture

How MapMyRoots is put together today. For conventions, see [`/CLAUDE.md`](../CLAUDE.md). For what's planned, see [`ROADMAP.md`](ROADMAP.md).

> An earlier version of this document described a target design (CommandManager, QuadTree, RelationshipManager, TreeStateManager, UICoordinator). Those modules were never built, or were deleted as unused (7f2d14d). This version describes only code that exists.

## Overview

- **Static site.** Astro 5 pre-renders every page at build time and Cloudflare Pages serves them. There is no backend.
- **Client-side builder.** `/builder` runs as a vanilla-JS app on an HTML canvas. All tree data lives in the visitor's browser (IndexedDB, with a localStorage fallback).
- **Four locales.** en (default, unprefixed), de, es, ru (`/de/...` and so on) for the homepage, About, Contact, Privacy and Terms. The builder translates itself at runtime.

```
Astro pages (build time)          Builder (runtime, /builder)
─────────────────────────         ────────────────────────────────────────
src/pages/*.astro                 src/pages/builder.astro  (markup only)
  └─ layouts/BaseLayout.astro       ├─ src/ui/builder/builder-page.ts  (page wiring)
       ├─ components/SEO.astro       ├─ src/ui/builder/builder-share.ts (share dialog)
       ├─ components/Header.astro    └─ tree.js  (app bootstrap)
       ├─ components/Footer.astro          └─ src/core/tree-engine.js  (TreeCoreCanvas)
       └─ GoogleTagManager.astro                ├─ core/canvas-renderer.js
                                                ├─ data/cache/core-cache.js ── IndexedDB
                                                ├─ data/cache/core-undoRedo.js
                                                ├─ ui/components/*, ui/modals/modal.js
                                                └─ features/* (export, import, search, …)
```

## Static pages

- Every page renders through `BaseLayout.astro`, which emits SEO tags (canonical, hreflang, OG image from `src/pages/og/[slug].ts`), the GTM snippet, the header and the footer.
- Localized routes are thin wrappers. For example, `src/pages/de/about.astro` renders `<About locale="de" />`.
- Page text comes from `t(locale, 'pages.<page>.*')` (`src/i18n/index.ts`) at build time, so each locale's HTML is fully translated. Strings containing inline markup (`<strong>`, links) are rendered with `set:html`. They come only from our own locale files.
- On static pages, the language switcher navigates to the localized URL. It doesn't translate in place.
- The glossary is an Astro content collection (`src/content/glossary`).
- **CSS:** `BaseLayout` loads `global.css` (builder styles, also loaded here) and `site.css` (header, nav, mobile menu, buttons). The homepage adds `homepage.css`; About, Contact, Privacy and Terms add `content-pages.css`. Glossary and Offline use scoped `<style>` blocks, as do `Header.astro` (language dropdown) and `Footer.astro`.

## Builder runtime

### Bootstrap

1. `builder.astro` imports the runtime modules (`i18n.js`, `language-switcher.js`, `modal.js`, `tree.js`, …), then `builder-page.ts` and `builder-share.ts`.
2. On `DOMContentLoaded`, `tree.js`:
   - migrates any legacy localStorage tree into IndexedDB
   - initializes `AnalyticsIntegration` (the only one; a second integration on the same bus is refused)
   - creates and initializes `TreeCoreCanvas`
3. `builder-page.ts` initializes i18n, drag-and-drop import, the sidebar, view switching (graphic, table, tree chart), settings and GEDCOM import.

### TreeCoreCanvas (`src/core/tree-engine.js`)

The central controller. It is still the largest file (~2,300 lines) and is exposed as `window.treeCore` because many UI modules reach it that way. It owns:

- **Person data:** a `Map` of person records (names, gender, parents, spouse, marriages, rich birth and death events, notes, photo and document references)
- **Rendering:** a `CanvasRenderer` instance (nodes, connections, camera, selection)
- **Persistence:** a `CacheManager` instance
- **Undo/redo:** an `UndoRedoManager` instance
- **UI wiring:** `setupButtons`, `setupSettings`, `setupModals`, `setupExport`

Splitting it by responsibility is the top item under [known debt](#known-debt).

### Rendering (`src/core/canvas-renderer.js`)

The render loop draws the grid, connections and nodes onto one canvas. Performance work (PR #1):

- **Culling:** `getVisibleWorldRect()` computes the viewport in world coordinates, and nodes or connections outside it are skipped
- **Text-layout cache:** each node's measured text and the z-order sort are cached between frames
- **Grid:** strokes are batched, and the grid is skipped below 0.3× zoom

Hit-testing is a linear scan, which is fast enough at realistic tree sizes. A QuadTree was tried and removed.

Node shapes for templates live in `src/shapes/` (a strategy per shape, extending `base-shape.js`). The tree-chart view (`src/features/tree-chart/`) is a separate SVG layout of the same data.

### Persistence (`src/data/cache/core-cache.js`)

- `CacheManager` writes the full tree state through `IndexedDBRepository` (`src/data/repositories/indexed-db-repository.js`). It falls back to localStorage if IndexedDB is unavailable.
- Autosave runs every 30 s, on `visibilitychange` and before unload, but only when the tree is **dirty**. Serialization is skipped otherwise.
- Photos and documents are stored as blobs in separate IndexedDB stores and referenced by `mediaId`.
- Schema migrations live in `src/data/migrations/`. Loaded JSON must carry `version` or `persons` (see "Data format" in `CLAUDE.md`).

`src/data/repositories/person-repository.js` is a tested repository abstraction that the runtime does not use yet.

### Undo/redo (`src/data/cache/core-undoRedo.js`)

Snapshot-based: each state change pushes a full tree snapshot, up to 50. Undo restores the previous snapshot. This is simple and correct, at the cost of memory on very large trees.

### Event bus (`src/utils/event-bus.js`)

- `appContext.getEventBus()` returns the shared `EventBus`. Event names are in the `EVENTS` constant.
- New cross-module communication should use the bus rather than `window.*` globals.
- `appContext` also has a small service registry (`getService('treeCore')`).

Main consumers today:

- `AnalyticsIntegration`, which forwards bus events to GTM's `dataLayer`
- the tree-chart view
- the share dialog
- media features

### Features (`src/features/`)

| Folder | What it does |
|---|---|
| `export/` | `exporter.js` (PNG, JPEG, SVG, PDF via bundled jsPDF in `pdf-loader.js`); `gedcom-exporter.js` (GEDCOM 5.5.1); `download.js` |
| `import/` | GEDCOM import (`parse-gedcom`) |
| `photos/` | Avatar cropper, document attachments, PDF preview (`pdfjs-dist`) |
| `search/` | Search box and suggestions |
| `share/` | Compressed "share by link" URLs (`fflate`), opened read-only at `/view` |
| `i18n/` | Runtime translator (`data-i18n*` attributes) and language switcher |
| `accessibility/` | Keyboard shortcuts, focus management, screen-reader announcements |
| `tree-chart/` | Alternative SVG tree-chart view |

## Security

- **CSP** (`public/_headers`): there is exactly one policy, on `/*`. Cloudflare merges every matching rule, and browsers enforce each CSP header separately, so a path-specific policy can only tighten it. `tests/unit/csp-headers.test.js` enforces this. Scripts are allowed from `'self'`, Cloudflare Insights and GTM. No third-party CDNs are allowed; dependencies are bundled.
- **DOM:** never put user data into `innerHTML`. Build nodes and use `textContent`, or `SecurityUtils` (`src/utils/security-utils.js`, DOMPurify-backed). `tests/unit/innerhtml-guard.test.js` fails on new dynamic `innerHTML` writes.

## Analytics

GTM container `GTM-MNZ4MJB7` loads GA4 on every page (`GoogleTagManager.astro`). Cloudflare Web Analytics runs alongside it and is cookieless. Builder events flow EventBus → `AnalyticsIntegration` → `analyticsService` → `dataLayer.push`. Events never include tree content. For the event taxonomy, see [`src/analytics/README.md`](../src/analytics/README.md).

## Testing

| Kind | Location | Command |
|---|---|---|
| Unit (Vitest + jsdom) | `tests/unit/` | `npm test` |
| E2E (Playwright) | `testing/tests/` | `npm run test:e2e` (needs `npm run build` + `npx astro preview`) |
| Types | — | `npm run check` |
| Lighthouse | `.github/workflows/lighthouse.yml` | CI only |

Guard tests that protect cross-cutting rules:

- `i18n-keys.test.js`: every `data-i18n*` and `t(locale, '…')` key exists, and all four locales have identical key sets
- `innerhtml-guard.test.js`: no new dynamic `innerHTML`
- `csp-headers.test.js`: a single CSP with no third-party CDNs

## Known debt

1. **`tree-engine.js` (~2,300 lines) and `modal.js` (~1,500)** mix data, persistence, UI wiring and modal logic. Split them by responsibility, but only behind stronger e2e coverage of add, edit and delete person flows.
2. **`window.*` globals** (`treeCore`, `notifications`, `modalUtils`, …) are still how many UI modules talk to the core. Migrate them to EventBus or service lookups as files are touched.
3. **Hardcoded English UI strings** remain in some builder code paths, e.g. share-dialog notifications and export notifications.
4. **Snapshot undo** holds up to 50 full copies of the tree. If very large trees become common, switch to diffs.

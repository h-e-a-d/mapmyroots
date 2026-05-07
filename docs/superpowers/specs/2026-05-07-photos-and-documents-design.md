# Photos & Documents — Design

**Date:** 2026-05-07
**Status:** Approved (pending user review of this written spec)
**Scope:** One spec, two implementation plans (avatar cropper + document attachments). Both ship against the same data model and storage backend.

## Overview

Two related improvements to per-person media handling:

1. **Avatar cropper.** Replace today's auto cover-fit with a draggable, zoomable crop. Stores the original image plus a small transform; renderer applies the transform on every draw.
2. **Document attachments.** Add multi-document support per person (images + PDFs) with metadata (title, type, date, place, description). New tab in the person modal hosts a thumbnail grid, inline metadata editor, and a lightbox viewer.

Both pieces share a new `media` IndexedDB store for blobs and a separate `documents` store for metadata. Avatar originals and document blobs use the same media pipeline.

## Decisions Locked

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | One spec covering both pieces | Shared data model, shared upload pipeline, shared cache. Two implementation plans flow from this spec. |
| 2 | Save **original + crop transform** for the avatar | Re-editable crop; sharp at any zoom; the original doubles as the gallery source. |
| 3 | **IndexedDB Blob store** for binaries (not base64-in-record, not OPFS) | ~33% smaller than base64; supports much larger files; standard offline-first pattern; portable across browsers we support. |
| 4 | Photos + PDFs with full metadata (title, type, date, place, description) | Genealogy users need certificates and letters with provenance. PDF.js loaded only at thumbnail-generation time; viewing uses native `<iframe>`. |
| 5 | Tabs inside the person modal: **Details / Photo / Documents** | Keeps everything per-person with no new modals. Cropper gets its own tab where it has room to breathe. |
| 6 | Export bundles media as base64 inside the existing JSON | Single-file backup; existing import path extended; no new file format. |
| 7 | Strip media from share links (unchanged behavior) | URLs stay short; full data only travels via JSON export. |
| 8 | **Hard caps + storage warnings** | 30 docs/person, 5 MB/PDF, 10 MB/image input (resized down). Existing 80% quota warning extended to document uploads. |
| 9 | **No migration path** for the existing `photoBase64` field | User decision — drop the legacy field entirely; new schema is the only schema. |

## Data Model

### IndexedDB schema (DB_VERSION 1 → 2)

Two new stores, in addition to existing `persons`, `metadata`, `connections`:

```
media           keyPath: 'id'        value: { id, blob, mimeType, byteLength,
                                              width?, height?, createdAt }

documents       keyPath: 'id'        value: { id, personId, mediaId, kind: 'image'|'pdf',
                                              title, type, eventDate, place, description,
                                              thumbnailMediaId?, createdAt, updatedAt }
                indexes: 'personId'  (non-unique)
```

### Person record

```js
{
  // ...existing fields (name, surname, birth, death, marriages, notes, etc.)...
  photo: {
    mediaId: 'm_xxx',                          // FK into media; null/undefined = no avatar
    transform: { x: 0.5, y: 0.5, scale: 1 }    // x, y normalized 0..1 = which point of original lands at circle center
  } | null
  // legacy `photoBase64` field is removed entirely
  // documents are NOT inlined — queried by personId index when modal opens
}
```

### Why split media and documents

- Blobs are heavy; metadata is light and changes often. Renaming a doc shouldn't rewrite the blob row.
- Avatar originals share `media` with document images — one upload pipeline, one cache.
- `personId` index on `documents` makes per-person queries trivial without scanning.

### Cropper transform math

```js
const baseCover = Math.max(diameter / img.width, diameter / img.height);
const s = baseCover * (transform.scale ?? 1);
const drawW = img.width * s;
const drawH = img.height * s;
const cx = nodeX - drawW * transform.x;
const cy = nodeY - drawH * transform.y;
ctx.drawImage(img, cx, cy, drawW, drawH);
```

Default `{x: 0.5, y: 0.5, scale: 1}` reproduces today's cover-fit exactly. New uploads look identical to today's behavior until the user adjusts the crop.

## Affected Files

| File | Change |
|---|---|
| `src/data/repositories/indexed-db-repository.js` | Bump `DB_VERSION` to 2; add `media` and `documents` stores in `onupgradeneeded`; new methods: `saveMedia(blob, meta)`, `getMedia(id)`, `deleteMedia(id)`, `saveDocument(doc)`, `getDocumentsForPerson(personId)`, `deleteDocument(id)`, `deleteDocumentsForPerson(personId)`, `garbageCollectMedia(referencedIds)`. `deletePerson` cascades to docs + avatar media. |
| `src/data/cache/core-cache.js` | Plumb media + document writes through the same fire-and-forget IDB path as persons. |
| `src/features/photos/photo-utils.js` | Replace base64 pipeline with blob pipeline: `prepareImageUpload(file)` → `{ blob, width, height, mimeType }` (max 2048 px JPEG q=0.9); `validatePdfUpload(file)` (≤ 5 MB); `generateThumbnail(blob, mimeType)` → 256 px JPEG blob (dynamic-imports PDF.js for PDFs). Drop `resizePhotoToDataUrl`. |
| `src/features/photos/avatar-cropper.js` *(new, ~200 LOC)* | `mountCropper({ container, blob, transform, onChange })`. Renders `<canvas>` inside circular mask. Drag pans, wheel/pinch zooms, slider as fallback, keyboard arrows nudge, `+`/`-` zoom, `R` resets. Emits transform on every change. |
| `src/features/photos/document-list.js` *(new, ~250 LOC)* | `mountDocumentList({ container, personId })`. Lazy-fetches via `getDocumentsForPerson`. Renders thumbnail grid + "Add document" tile + count badge. Inline-edit metadata. Click thumbnail → opens viewer. Delete with confirm. |
| `src/features/photos/document-viewer.js` *(new, ~150 LOC)* | Lightbox overlay. Images use shared pan-zoom helper; PDFs use `<iframe src="blob:...">`. Esc closes; ←/→ navigates within the person's docs. Focus-trapped; returns focus to originating tile on close. |
| `src/ui/modals/modal.js` | Restructure: tab strip [Details \| Photo \| Documents] above the existing form. Existing form becomes "Details" tab content (no field changes). "Photo" tab mounts `avatar-cropper`. "Documents" tab mounts `document-list`. Save persists `person.photo.{mediaId, transform}` only. Documents auto-save inline (separate transaction lifecycle). |
| `src/pages/builder.astro` | Replace inline `<input type="file">` photo block with three empty tab containers + tab buttons (ARIA tablist). Remove inline `setupPhotoUpload` IIFE — logic moves into `avatar-cropper.js` and modal.js wiring. |
| `src/core/canvas-renderer.js` | `_getNodeImage` reads from a new `mediaCache: Map<mediaId, HTMLImageElement>` populated by tree-engine. Apply `node.photo.transform` in the existing draw block. Keep `showPhotos` preference. Drop `photoBase64` references. |
| `src/core/tree-engine.js` | Replace `photoBase64` plumbing with `photo: { mediaId, transform }` on personData and renderer node. On tree load: prefetch all referenced media blobs into renderer's `mediaCache` as `<img>` via `URL.createObjectURL`. On person delete: cascade to media + docs. On boot: call `garbageCollectMedia` once. |
| `src/data/core-export.js` | Export adds top-level `media: [{ id, base64, mimeType, width, height, byteLength }]` and `documents: [{...}]`. Bump `version` to `2.2.0`. Import: validate, decode base64 → blobs, save media first then persons then documents. |
| `src/features/share/url-codec.js` | Strip `photo` and skip `documents`/`media` (currently strips `photoBase64`). |
| `assets/locales/{en,es,ru,de}.json` | New keys (full list below). |
| `tests/unit/photo-utils.test.js` | Extend for blob pipeline. |
| `tests/unit/media-repository.test.js` *(new)* | Save/get/delete blobs, cascade delete, orphan sweep, schema upgrade. |
| `tests/unit/avatar-cropper.test.js` *(new)* | Pan/zoom math, clamping. |
| `tests/unit/document-list.test.js` *(new)* | Add/edit/delete flows, count limits. |
| `tests/unit/core-export.test.js` *(extend)* | Round-trip with media + docs, orphan-reference handling. |
| `testing/tests/photos.spec.js` *(new)* | E2E: avatar drag/zoom round-trip, document add (image + PDF), export/import round-trip. |

**File-size note:** `modal.js` is already 1270 lines. New tab logic (~80 lines) goes there; the rest lives in new feature files. No refactor of unrelated modal code.

## Avatar Cropper UX

### Layout (Photo tab)

```
┌─────────────────────────────────────────────┐
│   ┌─────────────────┐                        │
│   │   ╭───────╮     │  ← image canvas with   │
│   │   │ FACE  │     │    circular mask       │
│   │   ╰───────╯     │                        │
│   └─────────────────┘                        │
│                                              │
│   Drag to reposition · Scroll/pinch to zoom │
│                                              │
│   Zoom  [──────●────────]   [Reset]         │
│                                              │
│   [Choose photo...]      [Remove photo]     │
└─────────────────────────────────────────────┘
```

### Interactions

| Input | Action |
|---|---|
| Mouse drag / touch drag | Pan image under the mask |
| Mouse wheel / pinch | Zoom around cursor / pinch-center |
| Zoom slider | Same as wheel, accessible fallback |
| Arrow keys (canvas focused) | Pan 8 px per press |
| `+` / `-` | Zoom step 10% |
| `R` or Reset | Restore default `{x: 0.5, y: 0.5, scale: 1}` |
| Escape inside canvas | Blur (don't close modal) |

### Constraints

- `scale` clamped to `[1.0, 4.0]`. Below 1.0 the image wouldn't cover the circle.
- After every pan/zoom, clamp `transform.x`/`transform.y` so the image still fully covers the circle on all sides — no gaps. Snap to nearest covering position when zoom-out invalidates a pan.

### Cropper canvas rendering

- 400×400 `<canvas>`.
- Image drawn first.
- Dark overlay (`rgba(0,0,0,0.55)`) everywhere except the circular cutout (use `globalCompositeOperation = 'destination-out'` for the circle, then reset).
- 2 px white circle stroke marks the mask boundary.

### Upload pipeline

1. File picker (`accept="image/jpeg,image/png,image/webp"`).
2. `prepareImageUpload(file)`:
   - Reject non-image MIME → toast.
   - Reject `file.size > 10 MB` raw → toast.
   - Decode to `<img>`, draw to offscreen canvas at `min(originalSize, 2048px)` longest edge, encode JPEG q=0.9 → returns `{ blob, width, height, mimeType: 'image/jpeg' }`.
3. `saveMedia(blob, meta)` → returns `mediaId`.
4. Initialize `transform = { x: 0.5, y: 0.5, scale: 1 }`.
5. Mount cropper; transform updates flow into form state.
6. On modal Save: `person.photo = { mediaId, transform }` persisted.
7. Renderer's `mediaCache` invalidated for this person → next paint loads new blob via `URL.createObjectURL`.

### Performance

- Cropper redraws only on `pointermove` (rAF-throttled) and slider input.
- Image decoded once per cropper mount; held in closure.
- Renderer `mediaCache` survives modal open/close cycles; invalidated only on save/remove of that person.

## Documents Tab UX

### Empty state

```
┌─────────────────────────────────────────────┐
│             📄                              │
│      No documents yet.                      │
│      Add scans, certificates, letters,      │
│      and other photos here.                 │
│           [+ Add document]                  │
└─────────────────────────────────────────────┘
```

### Populated state

```
┌─────────────────────────────────────────────┐
│   Documents                      3 / 30     │
│                                              │
│   ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐      │
│   │ 📄   │ │ 🖼️   │ │ 📄   │ │  +   │      │
│   │ thmb │ │ thmb │ │ thmb │ │ Add  │      │
│   └──────┘ └──────┘ └──────┘ └──────┘      │
│   Birth    Family   Marriage                 │
│   cert     photo    cert                     │
│   1952     1948     1971                     │
└─────────────────────────────────────────────┘
```

- 120×120 thumbnail tiles + 2-line caption (title + year if `eventDate`).
- Image docs use cached thumbnail blob via `URL.createObjectURL`.
- PDF docs show a generated page-1 thumbnail (created at upload), with a small PDF badge in the corner.
- "+ Add" tile is the last item until cap is hit; then disabled with tooltip `documents.limit_reached`.
- Hover/focus shows two icons in the top-right of the tile: ✏️ edit, 🗑️ delete (confirm).

### Add document flow

1. File picker (`accept="image/jpeg,image/png,image/webp,application/pdf"`).
2. Validate:
   - PDF: ≤ 5 MB or toast `documents.file_too_large`.
   - Image: `prepareImageUpload` pipeline (resize to 2048 px JPEG).
   - Per-person count check before any I/O — if `getDocumentsForPerson(id).length >= 30`, toast and abort.
3. Generate thumbnail (256 px JPEG):
   - Image: existing canvas resize.
   - PDF: dynamic-import PDF.js, render page 1 to canvas at 256 px wide, encode JPEG, drop module reference.
4. `saveMedia(mainBlob)` → `mediaId`. `saveMedia(thumbBlob)` → `thumbnailMediaId`. `saveDocument({...})`.
5. Open metadata editor pre-filled with file name as title.

### Metadata editor (inline panel below grid)

```
┌─────────────────────────────────────────────┐
│ Editing: birth-cert.pdf                     │
│                                              │
│ Title           [Birth certificate         ] │
│ Type            [Certificate           ▾   ] │
│ Date            [1952-03-14                ] │
│ Place           [Riga, Latvia               ] │
│ Description     [                          ] │
│                 [                          ] │
│             [Cancel]  [Save document]      │
└─────────────────────────────────────────────┘
```

- Type dropdown: `certificate | photo | letter | other` (translated).
- Date reuses existing `createDateInput` component (same fuzzy-date UX as birth/death).
- Place and Description are sanitized via `SecurityUtils.sanitizeText` before render.
- Save persists via `saveDocument` and re-renders the grid.

### Document viewer (lightbox)

```
┌─────────────────────────────────────────────┐
│ ← Birth certificate · 1952             ✕   │
│                                              │
│           [ image / pdf area ]              │
│                                              │
│  ◀  prev      [ Edit ] [ Delete ]   next ▶ │
└─────────────────────────────────────────────┘
```

- Images: pan + wheel-zoom, double-click fit. Shared `pan-zoom` helper used by cropper viewport too.
- PDFs: `<iframe src="blob:...">` — browser-native viewer, no PDF.js bundle for viewing.
- Esc closes. ←/→ navigate this person's docs. Edit opens metadata panel; Delete confirms then closes viewer.

### Persistence model

- **Documents save immediately** on metadata-editor "Save", independent of the person form's Save button. A user uploading 5 scans shouldn't lose them on Cancel.
- Cancel on the person modal does NOT roll back document additions. Toast confirms each save.
- Deletes are also immediate, with confirm.
- The avatar transform uses the modal's transactional Save (it's just a pointer; orphan blobs are cleaned up at boot — see Orphan Cleanup).

### Limits

- Hard cap: 30 documents per person (`saveDocument` rejects beyond limit).
- Hard cap: 5 MB raw per PDF; 10 MB raw per image input (downsized to 2048 px on save).
- Soft warning: `shouldWarnAboutStorage({ usage, quota })` already fires at 80% — extends to document uploads.

### Accessibility

- Tab strip: `role="tablist"` / `role="tab"` / `role="tabpanel"`, arrow-key navigation, `aria-selected`.
- Document tiles: `role="button"`, accessible name = title.
- Viewer: focus-trapped overlay, Esc closes, returns focus to originating tile.
- Cropper canvas: `tabindex="0"`, `aria-label="Drag to reposition photo, arrow keys to nudge"`.

## Export / Import

### JSON format

```jsonc
{
  "version": "2.2.0",
  "cacheFormat": "enhanced",
  "persons": [
    {
      // ...existing fields...
      "photo": { "mediaId": "m_abc", "transform": { "x": 0.5, "y": 0.5, "scale": 1 } }
    }
  ],
  "media": [
    { "id": "m_abc", "mimeType": "image/jpeg", "width": 1024, "height": 1024,
      "byteLength": 187234, "base64": "..." }
  ],
  "documents": [
    {
      "id": "d_xyz", "personId": "p_123", "mediaId": "m_def",
      "thumbnailMediaId": "m_dthumb", "kind": "pdf",
      "title": "Birth certificate", "type": "certificate",
      "eventDate": "1952-03-14", "place": "Riga, Latvia", "description": "",
      "createdAt": 1714000000000, "updatedAt": 1714000000000
    }
  ]
}
```

### Import validation (boundary check)

- Reject if `version` < `2.0.0` or missing `version`/`persons`.
- For each `media` entry: base64 decodes, mimeType in allowlist (`image/jpeg|png|webp|application/pdf`), `byteLength ≤ 10 MB`.
- For each `documents` entry: `mediaId` exists in import's `media`; `personId` exists in `persons`. Orphaned doc rows dropped with console warning, not aborted.
- For each `person.photo`: `mediaId` exists in `media`; otherwise `photo` set to `null`.

### Import order

Media first (so blobs exist when documents reference them) → persons → documents. All inside an `importAllData` wrapper transaction.

## Orphan Cleanup

Three orphan sources:
1. Upload-then-cancel: cropper saved blob to `media`, `person.photo.mediaId` never persisted.
2. Avatar replace: old `mediaId` no longer referenced.
3. Document delete: blob and thumbnail unreferenced.

Cases 2 and 3 are handled inline (`deleteMedia` called immediately on the freed IDs).

Case 1 needs a sweep: on app boot (after IDB init, before first render), `garbageCollectMedia()`:
- Build referenced set: `union(person.photo.mediaId, document.mediaId, document.thumbnailMediaId)` across all persons/documents.
- Iterate `media` store; delete rows not in the set.
- Runs async in background; metadata-only scan, fast even with hundreds of blobs.

## Error Handling

| Scenario | Behavior |
|---|---|
| File picker returns wrong MIME | Toast: `documents.invalid_type` |
| Image > 10 MB raw, or PDF > 5 MB | Toast: `documents.file_too_large` with cap |
| Per-person doc limit hit | Add tile disabled, tooltip explains; toast on programmatic add attempt |
| `navigator.storage.estimate()` > 80% used | Existing `shouldWarnAboutStorage` notification |
| `QuotaExceededError` on `saveMedia` | Catch → toast "Storage full — export your tree and free up space"; revert UI to pre-upload state |
| PDF.js fails to render thumbnail | Fall back to generic PDF icon thumbnail; document still saves |
| Image decode fails | Toast: `documents.decode_failed`; nothing saved |
| Renderer mediaCache miss (dangling reference) | Draw placeholder text, console warning. Recovery: orphan sweep at next boot removes the dangling reference. |

`RetryManager` only wraps idempotent reads (e.g., `getMedia`). Uploads are not retried — failures are user-actionable.

## i18n Keys (all four locales)

Under `builder.modals.person`:

| Key | English |
|---|---|
| `tabs.details` | Details |
| `tabs.photo` | Photo |
| `tabs.documents` | Documents |
| `cropper.drag_hint` | Drag to reposition · Scroll or pinch to zoom |
| `cropper.zoom` | Zoom |
| `cropper.reset` | Reset |
| `cropper.choose` | Choose photo... |
| `documents.empty` | No documents yet. Add scans, certificates, letters, and other photos here. |
| `documents.add` | + Add document |
| `documents.count` | {{n}} / {{max}} |
| `documents.title` | Title |
| `documents.type` | Type |
| `documents.types.certificate` | Certificate |
| `documents.types.photo` | Photo |
| `documents.types.letter` | Letter |
| `documents.types.other` | Other |
| `documents.date` | Date |
| `documents.place` | Place |
| `documents.description` | Description |
| `documents.save` | Save document |
| `documents.cancel` | Cancel |
| `documents.delete_confirm` | Delete this document? |
| `documents.limit_reached` | Limit reached ({{max}} per person) |
| `documents.file_too_large` | File too large (max {{cap}}) |
| `documents.invalid_type` | File type not supported |
| `documents.decode_failed` | Could not read this file |
| `documents.processing` | Processing... |
| `documents.storage_full` | Storage full — export your tree and free up space |

Spanish, Russian, German keys to be filled in during implementation.

## Testing

### Unit (Vitest + jsdom)

- `tests/unit/photo-utils.test.js`
  - `prepareImageUpload`: rejects non-image, resizes oversize, preserves aspect for portrait/landscape.
  - `validatePdfUpload`: cap enforcement.
  - `generateThumbnail`: produces valid blob for image and PDF inputs (PDF.js mocked).
- `tests/unit/media-repository.test.js` *(new)*
  - Round-trip blob save/get/delete.
  - Cascade delete for person → docs + avatar.
  - Orphan sweep removes only unreferenced ids.
  - DB version 2 upgrade migration runs idempotently.
- `tests/unit/avatar-cropper.test.js` *(new)*
  - Pan clamping (image always covers circle at any pan).
  - Zoom clamping `[1.0, 4.0]`.
  - Transform output matches expected values for known interactions.
- `tests/unit/document-list.test.js` *(new)*
  - Limit enforcement at 30.
  - Add/edit/delete state transitions.
  - Filters orphan doc rows from render.
- `tests/unit/core-export.test.js` *(extend)*
  - Export → import round-trip preserves photo transforms and document metadata.
  - Orphan doc reference dropped with warning.

Each new module gets at least one expected-use test, one edge case, one failure case (per CLAUDE.md).

### E2E (Playwright)

- `testing/tests/photos.spec.js` *(new)*
  - Upload avatar, drag, zoom out, save, reopen modal, transform retained.
  - Add image and PDF documents, set metadata, both appear in grid with correct thumbnails.
  - Delete a document, count badge updates.
  - Export tree, clear IndexedDB, import, all media + documents restored, avatar position preserved.

## Out of Scope

- Per-document permissions / privacy flags.
- OCR / full-text search of document contents (search matches title/place/description text only).
- Multiple avatars per person (one avatar field; portraits can live in documents).
- Cloud sync of media (deferred to Phase 6 indefinitely per ROADMAP).
- Drag-and-drop file upload onto the documents tab (picker only in v1).
- Bulk import / bulk export per person.
- Photo of marriages or events (all attachments are person-scoped).
- GEDCOM media import (`OBJE` records ignored on import; v2 work).
- Rotation in the cropper.
- Service-worker caching of media blobs.

## Success Criteria

1. Tab strip [Details | Photo | Documents] renders in person modal with keyboard navigation.
2. Avatar cropper: drag pans, scroll zooms, slider syncs, Reset returns to default. Transform persists on save and renders identically on the canvas.
3. Default `{x: 0.5, y: 0.5, scale: 1}` reproduces today's cover-fit. Existing avatar placement visually unchanged for users who don't touch the cropper after upload.
4. Documents grid: image and PDF thumbnails render. Limit (30/person) and per-file caps enforced with localized errors.
5. Lightbox viewer: images pan/zoom, PDFs render in iframe, ←/→ navigates within person, Esc closes and restores focus.
6. Export/import round-trip preserves all media + documents + transforms.
7. Orphan media is cleaned up at boot (verified by test).
8. All four locales translated for new keys.
9. `navigator.storage.estimate` warning still fires; new `QuotaExceededError` toast fires on upload failure.
10. Renderer no longer references the legacy `photoBase64` field anywhere; new schema is the only schema.

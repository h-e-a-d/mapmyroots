# Fix: family tree import bugs (white text, empty photo nodes, iOS save failure)

## Reproduction
Loading `/Users/matlyubakarimova/Downloads/family-tree-2026-05-08 (3).json`
(76 persons, 7 photos, total ~4.4 MB).

- **Desktop Chrome (macOS):** loads, but text is white (should be black) and the 7 nodes that have photos render as empty colored circles (no text, no photo).
- **iOS Safari:** import aborts with toast "Import Failed. Failed to save media".

## Root cause analysis

### Issue 1A — White text (HIGH CONFIDENCE)
- `buildExport()` in `src/data/core-export.js:282-300` returns `{ version, cacheFormat, persons, media, documents }` — **no `settings`**.
- The user's JSON confirms this: top-level keys are only `version, cacheFormat, persons, media, documents`. There is no `settings`, no `nameColor`, no `dateColor`.
- `processLoadedData()` at `src/core/tree-engine.js:2041` only applies settings when `data.settings` exists. Otherwise the current `nameColor` is left at its default of `'#ffffff'` (canvas-renderer.js:59) → text renders white on light backgrounds.
- `getCurrentState()` in `tree-engine.js:2151` *does* include settings, but `saveToJSON()` in `core-export.js:181` calls `buildExport(repo, persons)` whenever IDB is available, bypassing the settings.

### Issue 1B — Empty photo nodes (MEDIUM-HIGH CONFIDENCE)
- In `canvas-renderer.js:1157-1177` (`drawCircleNode`): if a node has `photo.mediaId` but the image is not yet in `_imageCache`, the code skips both the `drawImage` call AND the `drawNodeText` fallback. Result: an empty colored circle.
- The image cache is filled by `_prefetchMedia()` (`tree-engine.js:590-617`), kicked off via `setTimeout(0)` after `processLoadedData`. If prefetch fails silently (the code uses `.catch(() => null)` and `img.onerror = () => URL.revokeObjectURL(url)` with no logging), nodes stay empty forever.
- Even when prefetch eventually succeeds, the few hundred ms before images decode is enough to leave the user staring at empty nodes — there is no in-progress fallback.

### Issue 2 — iOS "Failed to save media" (MEDIUM CONFIDENCE)
- `saveMedia()` in `src/data/repositories/indexed-db-repository.js:463-480` rejects with a generic `new Error('Failed to save media')` and discards the actual `req.error` (DOMException). It also doesn't listen to `tx.onabort` / `tx.onerror`.
- iOS Safari has well-known IDB quirks (Blob storage edge cases, quota limits in private browsing, transaction aborts that don't surface as request errors). Without the underlying error we can't pin it down.

## Plan

1. **Export settings in `buildExport()`** — `src/data/core-export.js`:
   - Add a `settings` parameter to `buildExport(repo, persons, settings)`, include it in the returned object when present.
   - In `saveToJSON()`, pull `state.settings` from `getCurrentState()` and pass it through.

2. **Photo render fallback** — `src/core/canvas-renderer.js`:
   - In `drawCircleNode` (and `drawRectangleNode` if it has the same pattern), when a node has a `photo.mediaId` but the image isn't loaded yet, draw the text anyway so the node isn't blank.

3. **Better diagnostics + resilience for `saveMedia()`** — `src/data/repositories/indexed-db-repository.js`:
   - Capture `req.error` (and `tx.error`) and include the message in the rejected Error so iOS failures stop being a mystery.
   - Add `tx.onabort` handler so aborted transactions reject promptly.
   - Surface the underlying error message in the `applyImport` user-facing toast (in `core-export.js:249`).

4. **Photo prefetch reliability** — `src/core/tree-engine.js`:
   - Log (warn) when `getMedia` returns null or `img.onerror` fires, so missing-photo cases are visible in the console instead of failing silently.

5. **Tests**:
   - Extend `tests/unit/data/core-export-media.test.js` with a test that verifies `buildExport` round-trips `settings.nameColor`.
   - Add a test that `saveMedia` surfaces the underlying DOMException message on failure (using fake-indexeddb or a mock).

## Out of scope
- iOS Safari Blob workarounds (storing as ArrayBuffer, chunked writes). Will reassess once we see the actual error from step 3.

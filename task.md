# Add analytics tracking for missing user actions

## Goal
Close gaps in the analytics taxonomy by tracking photo/document upload lifecycles, storage warnings, tree-chart view, share-link generation, marriages add/remove, PWA install prompt outcomes, and notes-reveal toggles. Wire everything through the existing EventBus → `analytics-integration.js` pattern so feature code stays decoupled from analytics.

## Design rules (carried over from existing taxonomy)
- snake_case event names, lowercase
- Every event includes `category`, `success` (for fallible flows), and `error_type` when applicable
- No PII. `file_size_kb` and `mime_type` only — never filenames or pixel data
- Reuse `category` values: `media_upload`, `media_management`, `storage`, `view`, `share`, `relationship_management`, `pwa`, `ui_interaction`
- Failures get their own event name (`*_failed`) to keep GA4 conversion goals clean (mirrors `tree_exported` / `tree_export_failed`)

## New EventBus events — `src/utils/event-bus.js`

Add to the `EVENTS` constant:

```js
// Media (photos & documents)
MEDIA_PHOTO_UPLOADED:       'media:photo:uploaded',
MEDIA_PHOTO_UPLOAD_FAILED:  'media:photo:upload:failed',
MEDIA_PHOTO_REMOVED:        'media:photo:removed',
MEDIA_PHOTO_CROP_ADJUSTED:  'media:photo:crop:adjusted',
MEDIA_DOCUMENT_UPLOADED:    'media:document:uploaded',
MEDIA_DOCUMENT_UPLOAD_FAILED:'media:document:upload:failed',
MEDIA_DOCUMENT_REMOVED:     'media:document:removed',
MEDIA_DOCUMENT_METADATA_SAVED:'media:document:metadata:saved',
MEDIA_DOCUMENT_VIEWER_OPENED:'media:document:viewer:opened',
MEDIA_DOCUMENT_VIEWER_NAVIGATED:'media:document:viewer:navigated',

// Storage
STORAGE_WARNING_SHOWN:      'storage:warning:shown',

// Share
SHARE_URL_GENERATED:        'share:url:generated',
SHARE_URL_TOO_LARGE:        'share:url:too_large',
SHARE_URL_COPIED:           'share:url:copied',

// Marriages
MARRIAGE_ADDED:             'marriage:added',
MARRIAGE_REMOVED:           'marriage:removed',

// PWA install
PWA_INSTALL_PROMPT_SHOWN:   'pwa:install:prompt:shown',
PWA_INSTALL_ACCEPTED:       'pwa:install:accepted',
PWA_INSTALL_DISMISSED:      'pwa:install:dismissed',

// Notes/disclosure
UI_DISCLOSURE_TOGGLED:      'ui:disclosure:toggled',
```

## New methods in `src/analytics/analytics-service.js`

Add new section `MEDIA EVENTS` after styling section. Each method follows the existing `trackXxx → sendEvent` pattern:

| Method | Event name | Key params |
|---|---|---|
| `trackPhotoUploaded(meta)` | `photo_uploaded` | `source` (`picker`/`drop`), `file_size_kb`, `mime_type`, `width`, `height`, `was_replacement` |
| `trackPhotoUploadFailed(reason, meta)` | `photo_upload_failed` | `error_type`, `mime_type`, `file_size_kb` |
| `trackPhotoRemoved()` | `photo_removed` | (none beyond standard) |
| `trackPhotoCropAdjusted(action)` | `photo_crop_adjusted` | `action` (`zoom`/`reset`) |
| `trackDocumentUploaded(meta)` | `document_uploaded` | `kind` (`image`/`pdf`), `source`, `file_size_kb`, `mime_type`, `doc_count_after` |
| `trackDocumentUploadFailed(reason, meta)` | `document_upload_failed` | `error_type` (`pdf_invalid`/`limit_reached`/`image_decode`), `kind`, `file_size_kb` |
| `trackDocumentRemoved(docKind)` | `document_removed` | `kind` |
| `trackDocumentMetadataSaved(meta)` | `document_metadata_saved` | `kind`, `has_event_date`, `has_place`, `has_title` |
| `trackDocumentViewerOpened(meta)` | `document_viewer_opened` | `kind`, `doc_count` |
| `trackDocumentViewerNavigated(direction)` | `document_viewer_navigated` | `direction` (`prev`/`next`) |
| `trackStorageWarning(meta)` | `storage_warning_shown` | `usage_mb`, `quota_mb`, `percent_used` |
| `trackShareUrlGenerated(meta)` | `share_url_generated` | `url_bytes`, `node_count` |
| `trackShareUrlTooLarge(meta)` | `share_url_too_large` | `url_bytes`, `node_count` |
| `trackShareUrlCopied()` | `share_url_copied` | (none) |
| `trackMarriageAdded()` | `marriage_added` | (none — emitted on row add) |
| `trackMarriageRemoved()` | `marriage_removed` | (none) |
| `trackPwaInstallPromptShown()` | `pwa_install_prompt_shown` | (none) |
| `trackPwaInstallAccepted()` | `pwa_install_accepted` | (none) |
| `trackPwaInstallDismissed(method)` | `pwa_install_dismissed` | `method` (`button`/`browser`) |
| `trackDisclosureToggled(name, expanded)` | `ui_disclosure_toggled` | `disclosure_name`, `expanded` (bool) |

Also: extend `trackTreeImported` / wire to `UI_VIEW_CHANGED` (existing event) to fire a new `view_changed` event (currently only emitted from keyboard accessibility path; we'll also emit from the builder's `setView()`).

## Emission points

| File | Change |
|---|---|
| `src/ui/modals/modal.js:915` `processPhotoFile` | Emit `MEDIA_PHOTO_UPLOADED` on success with `source` ('picker' or 'drop'), `was_replacement` flag (true if a `mediaId` already existed); emit `MEDIA_PHOTO_UPLOAD_FAILED` in catch with `error_type` derived from `err.message` |
| `src/ui/modals/modal.js:963` `removeBtn` handler | Emit `MEDIA_PHOTO_REMOVED` |
| `src/ui/modals/modal.js:978-983` zoom/reset | Emit `MEDIA_PHOTO_CROP_ADJUSTED` (`zoom` on slider input — debounced 400ms to avoid spam; `reset` on click) |
| `src/ui/modals/modal.js:929-934` storage warning | Emit `STORAGE_WARNING_SHOWN` with usage/quota |
| `src/features/photos/document-list.js:205` `handleUploadedFile` | Emit `MEDIA_DOCUMENT_UPLOADED` on success; emit `MEDIA_DOCUMENT_UPLOAD_FAILED` in catch with derived `error_type` (`pdf_invalid` / `limit_reached` / `image_decode`) |
| `src/features/photos/document-list.js:196` `removeDocument` | Emit `MEDIA_DOCUMENT_REMOVED` |
| `src/features/photos/document-list.js:267` `onSave` in `openMetadataEditor` | Emit `MEDIA_DOCUMENT_METADATA_SAVED` |
| `src/features/photos/document-viewer.js:14` `openDocumentLightbox` | Emit `MEDIA_DOCUMENT_VIEWER_OPENED` on mount; emit `MEDIA_DOCUMENT_VIEWER_NAVIGATED` from `navigate()` |
| `src/pages/builder.astro:1537` share button click | Emit `SHARE_URL_GENERATED` after success; `SHARE_URL_TOO_LARGE` if over `MAX_URL_BYTES` |
| `src/pages/builder.astro:1570` share copy click | Emit `SHARE_URL_COPIED` |
| `src/pages/builder.astro:1416` `setView()` | Also emit `EVENTS.UI_VIEW_CHANGED` on the EventBus (currently only the DOM event fires) |
| `src/ui/components/marriages-list.js:23` `addRow` | Emit `MARRIAGE_ADDED` only when triggered by user action (skip the initial seed row on modal open — guard with the same `previouslySaved` distinction) |
| `src/ui/components/marriages-list.js:43` `onRemove` | Emit `MARRIAGE_REMOVED` |
| `src/scripts/install-prompt.js` | Emit `PWA_INSTALL_PROMPT_SHOWN` when banner shows; `PWA_INSTALL_ACCEPTED` when `outcome === 'accepted'`; `PWA_INSTALL_DISMISSED` from dismiss button (`method: 'button'`) and from browser-dismissal path (`method: 'browser'`) |
| `src/ui/modals/modal.js:528` notes/reveal setup | Emit `UI_DISCLOSURE_TOGGLED` with `disclosure_name` for each reveal trigger |

All emissions go through `appContext.getEventBus().emit(...)`. Files that don't already import the event bus get a single new import.

## New listeners in `src/analytics/analytics-integration.js`

Add a new block in `init()`:

```js
// Media events
this.listen('media:photo:uploaded',        (d) => analyticsService.trackPhotoUploaded(d));
this.listen('media:photo:upload:failed',   (d) => analyticsService.trackPhotoUploadFailed(d.errorType, d));
// ... one .listen() per new EVENT above
```

Plus `view:changed` listener that delegates to a new `trackViewChanged(view, trigger)` method (the existing `UI_VIEW_CHANGED` keyboard path can share this).

## Existing wiring tweaks
- `tree_imported` already exists but `import_format` is whatever the importer passes — confirm GEDCOM importer passes `'gedcom'` (and JSON importer passes `'json'`). One quick verification, no code change unless wrong.

## Tests — `tests/unit/`
New file `analytics-service.test.js`:
- Each new `trackXxx` method calls `sendEvent` with correct `event_name`, `category`, and params shape
- Failure events include `error_type`
- `trackDisclosureToggled` correctly stringifies booleans

New file `analytics-integration.test.js`:
- Subscribing the integration to a mock event bus, then emitting each new event, results in the matching `analyticsService.trackXxx` call (use vitest spies)

Update `testing/tests/avatar-cropper.spec.js` and `testing/tests/documents.spec.js`:
- After uploading, assert `window.dataLayer` last entry has `event_name: 'photo_uploaded'` / `'document_uploaded'`
- After removing, assert the corresponding `*_removed` event was pushed
- One failure case per spec (invalid PDF → `document_upload_failed`)

## README update
Append a new section to `src/analytics/README.md` documenting all new events (params + example), following the existing format. Add to the section index at top.

## Out of scope
- Renaming or restructuring existing events
- GA4 / GTM dashboard changes (configuration lives outside this repo)
- Adding tracking to homepage `gtmTrack` calls (separate scope)
- Translation strings (no new user-visible strings added)

## Verification
1. `npm test` — all new unit tests pass
2. `npm run test:e2e -- documents.spec.js avatar-cropper.spec.js` — dataLayer assertions pass
3. Manual smoke in dev: open builder on localhost, run through upload/remove for both photo and document, check the `[Analytics]` console logs match the new event taxonomy
4. Confirm no PII (filenames, names, dates) leaks into event params by searching final diff for `personData.name`, `file.name`, etc.

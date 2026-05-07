# Document Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-person document attachments (images + PDFs) with metadata, a thumbnail-grid gallery in a Documents tab, an inline metadata editor, and a lightbox viewer.

**Architecture:** New IndexedDB `documents` store (with `personId` index) holds document metadata; binaries reuse the `media` store from plan 1. PDFs use a dynamic-imported PDF.js for thumbnails only — viewing uses native `<iframe>`. The Documents tab in the person modal mounts a `document-list` component; clicking a tile opens a shared `document-viewer` lightbox.

**Tech Stack:** Vanilla JS ES modules, Vitest + jsdom, fake-indexeddb, Playwright. New runtime dep: `pdfjs-dist@^4` (dynamic-imported on first PDF upload only).

**Spec:** `docs/superpowers/specs/2026-05-07-photos-and-documents-design.md`

**Branch:** `feat/document-attachments` (off `main`, after plan 1 merges).

**Prerequisite:** Plan 1 (`feat/avatar-cropper`) must be merged first. This plan depends on:
- `IndexedDBRepository.saveMedia` / `getMedia` / `deleteMedia` / `garbageCollectMedia`
- `prepareImageUpload` from `photo-utils.js`
- The Documents tab container (`#tab-documents`, `#documentsListMount`) already in the DOM
- The `getIdbRepo()` accessor on `CacheManager`

---

## Task 1: Bump DB schema for `documents` store

**Files:**
- Modify: `src/data/repositories/indexed-db-repository.js`
- Modify: `tests/unit/data/repositories/indexed-db-repository-media.test.js` *(rename or add new file)*

- [ ] **Step 1: Write failing test for documents store**

Add to `tests/unit/data/repositories/indexed-db-repository-media.test.js` (or create a sibling file `indexed-db-repository-documents.test.js`):

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBRepository } from '../../../../src/data/repositories/indexed-db-repository.js';

describe('IndexedDBRepository documents store', () => {
  beforeEach(() => { globalThis.indexedDB = new IDBFactory(); });

  it('creates documents store at v3', async () => {
    const repo = new IndexedDBRepository('TestDocsDB', 3);
    await repo.initialize();
    const stores = Array.from(repo._dbForTest().objectStoreNames);
    expect(stores).toContain('documents');
  });

  it('documents store has personId index', async () => {
    const repo = new IndexedDBRepository('TestDocsDB', 3);
    await repo.initialize();
    const tx = repo._dbForTest().transaction(['documents'], 'readonly');
    expect(Array.from(tx.objectStore('documents').indexNames)).toContain('personId');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository`
Expected: FAIL — `documents` store missing.

- [ ] **Step 3: Bump DB version and add the store**

Modify `src/data/repositories/indexed-db-repository.js`:

```js
const DB_VERSION = 3;            // was 2
const STORE_DOCUMENTS = 'documents';
```

In `onupgradeneeded` (after STORE_MEDIA creation):

```js
if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
  const docStore = db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' });
  docStore.createIndex('personId', 'personId', { unique: false });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/indexed-db-repository.js tests/unit/data/repositories/
git commit -m "feat(docs): documents store at IDB schema v3"
```

---

## Task 2: Document CRUD on the repository

**Files:**
- Modify: `src/data/repositories/indexed-db-repository.js`
- Modify: tests file from Task 1

- [ ] **Step 1: Write failing CRUD tests**

Append:

```js
it('saves and retrieves a document', async () => {
  const repo = new IndexedDBRepository('TestDocsDB', 3);
  await repo.initialize();
  const doc = {
    id: 'd1', personId: 'p1', mediaId: 'm1', kind: 'image',
    title: 'Birth cert', type: 'certificate',
    eventDate: { year: 1952 }, place: '', description: '',
    createdAt: 1, updatedAt: 1
  };
  await repo.saveDocument(doc);
  const got = await repo.getDocumentsForPerson('p1');
  expect(got).toHaveLength(1);
  expect(got[0].title).toBe('Birth cert');
});

it('returns empty array for person with no documents', async () => {
  const repo = new IndexedDBRepository('TestDocsDB', 3);
  await repo.initialize();
  expect(await repo.getDocumentsForPerson('nobody')).toEqual([]);
});

it('deletes a document by id', async () => {
  const repo = new IndexedDBRepository('TestDocsDB', 3);
  await repo.initialize();
  await repo.saveDocument({ id: 'd2', personId: 'p2', mediaId: 'm', kind: 'image', title: 't', type: 'photo', eventDate: null, place: '', description: '', createdAt: 1, updatedAt: 1 });
  await repo.deleteDocument('d2');
  expect(await repo.getDocumentsForPerson('p2')).toEqual([]);
});

it('deleteDocumentsForPerson removes all docs of a person', async () => {
  const repo = new IndexedDBRepository('TestDocsDB', 3);
  await repo.initialize();
  for (const id of ['d1', 'd2', 'd3']) {
    await repo.saveDocument({ id, personId: 'p3', mediaId: 'm', kind: 'image', title: id, type: 'photo', eventDate: null, place: '', description: '', createdAt: 1, updatedAt: 1 });
  }
  const removed = await repo.deleteDocumentsForPerson('p3');
  expect(removed.sort()).toEqual(['d1', 'd2', 'd3']);
  expect(await repo.getDocumentsForPerson('p3')).toEqual([]);
});

it('getAllDocuments returns every document', async () => {
  const repo = new IndexedDBRepository('TestDocsDB', 3);
  await repo.initialize();
  await repo.saveDocument({ id: 'a', personId: 'p1', mediaId: 'm', kind: 'image', title: 't', type: 'photo', eventDate: null, place: '', description: '', createdAt: 1, updatedAt: 1 });
  await repo.saveDocument({ id: 'b', personId: 'p2', mediaId: 'm', kind: 'image', title: 't', type: 'photo', eventDate: null, place: '', description: '', createdAt: 1, updatedAt: 1 });
  const all = await repo.getAllDocuments();
  expect(all).toHaveLength(2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository`
Expected: FAIL — methods undefined.

- [ ] **Step 3: Implement the methods**

Add to `src/data/repositories/indexed-db-repository.js`:

```js
/**
 * @param {Object} doc
 * @returns {Promise<string>}
 */
async saveDocument(doc) {
  await this.#ensureInitialized();
  const record = { createdAt: Date.now(), updatedAt: Date.now(), ...doc };
  return new Promise((resolve, reject) => {
    const tx = this.#db.transaction([STORE_DOCUMENTS], 'readwrite');
    const req = tx.objectStore(STORE_DOCUMENTS).put(record);
    req.onsuccess = () => resolve(record.id);
    req.onerror = () => reject(new Error('Failed to save document'));
  });
}

/**
 * @param {string} personId
 * @returns {Promise<Object[]>}
 */
async getDocumentsForPerson(personId) {
  await this.#ensureInitialized();
  return new Promise((resolve, reject) => {
    const tx = this.#db.transaction([STORE_DOCUMENTS], 'readonly');
    const req = tx.objectStore(STORE_DOCUMENTS).index('personId').getAll(personId);
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(new Error('Failed to query documents'));
  });
}

/**
 * @returns {Promise<Object[]>}
 */
async getAllDocuments() {
  await this.#ensureInitialized();
  return new Promise((resolve, reject) => {
    const tx = this.#db.transaction([STORE_DOCUMENTS], 'readonly');
    const req = tx.objectStore(STORE_DOCUMENTS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(new Error('Failed to load documents'));
  });
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
async deleteDocument(id) {
  await this.#ensureInitialized();
  return new Promise((resolve, reject) => {
    const tx = this.#db.transaction([STORE_DOCUMENTS], 'readwrite');
    const req = tx.objectStore(STORE_DOCUMENTS).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('Failed to delete document'));
  });
}

/**
 * Delete every document for a person. Returns the deleted ids.
 * @param {string} personId
 * @returns {Promise<string[]>}
 */
async deleteDocumentsForPerson(personId) {
  await this.#ensureInitialized();
  const docs = await this.getDocumentsForPerson(personId);
  await Promise.all(docs.map((d) => this.deleteDocument(d.id)));
  return docs.map((d) => d.id);
}
```

- [ ] **Step 4: Update `garbageCollectMedia` to consider documents**

The current GC only sees `referencedIds` passed in. Tree-engine needs to include document mediaIds. We'll do that in Task 7. No repository change needed here.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/data/repositories/indexed-db-repository.js tests/unit/data/repositories/
git commit -m "feat(docs): document CRUD on repository"
```

---

## Task 3: Document utils — limits, validation, thumbnail generation

**Files:**
- Create: `src/features/photos/document-utils.js`
- Create: `tests/unit/features/photos/document-utils.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/features/photos/document-utils.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  validatePdfUpload,
  MAX_PDF_BYTES,
  MAX_DOCS_PER_PERSON,
  enforceDocumentLimit,
  defaultDocumentMetadata
} from '../../../../src/features/photos/document-utils.js';

function pdfFile(size) {
  return new File([new Uint8Array(size)], 'doc.pdf', { type: 'application/pdf' });
}

describe('validatePdfUpload', () => {
  it('accepts pdf within size', () => {
    expect(() => validatePdfUpload(pdfFile(100))).not.toThrow();
  });

  it('rejects non-pdf', () => {
    expect(() => validatePdfUpload(new File([], 'a.txt', { type: 'text/plain' }))).toThrow(/type/i);
  });

  it('rejects pdf over MAX_PDF_BYTES', () => {
    expect(() => validatePdfUpload(pdfFile(MAX_PDF_BYTES + 1))).toThrow(/too large/i);
  });
});

describe('enforceDocumentLimit', () => {
  it('throws when at cap', () => {
    expect(() => enforceDocumentLimit(MAX_DOCS_PER_PERSON)).toThrow(/limit/i);
  });

  it('does not throw under cap', () => {
    expect(() => enforceDocumentLimit(MAX_DOCS_PER_PERSON - 1)).not.toThrow();
  });
});

describe('defaultDocumentMetadata', () => {
  it('builds defaults from file name', () => {
    const m = defaultDocumentMetadata({ name: 'birth-cert.pdf' });
    expect(m.title).toBe('birth-cert');
    expect(m.type).toBe('other');
    expect(m.description).toBe('');
  });

  it('strips known image extensions from title', () => {
    expect(defaultDocumentMetadata({ name: 'family.JPEG' }).title).toBe('family');
    expect(defaultDocumentMetadata({ name: 'photo.PNG' }).title).toBe('photo');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/features/photos/document-utils.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

Create `src/features/photos/document-utils.js`:

```js
export const MAX_PDF_BYTES = 5 * 1024 * 1024;
export const MAX_DOCS_PER_PERSON = 30;
export const DOCUMENT_TYPES = ['certificate', 'photo', 'letter', 'other'];

export function validatePdfUpload(file) {
  if (file.type !== 'application/pdf') throw new Error(`Unsupported file type: ${file.type}`);
  if (file.size > MAX_PDF_BYTES) throw new Error(`File too large (max ${MAX_PDF_BYTES} bytes)`);
}

export function enforceDocumentLimit(currentCount) {
  if (currentCount >= MAX_DOCS_PER_PERSON) {
    throw new Error(`Document limit reached (${MAX_DOCS_PER_PERSON} per person)`);
  }
}

/**
 * @param {{name: string}} file
 */
export function defaultDocumentMetadata(file) {
  const title = file.name.replace(/\.(jpe?g|png|webp|pdf)$/i, '');
  return { title, type: 'other', description: '' };
}

/**
 * Render the first page of a PDF Blob to a JPEG thumbnail Blob.
 * Uses pdfjs-dist via dynamic import — only loaded when the user adds a PDF.
 *
 * @param {Blob} pdfBlob
 * @param {number} [width=256]
 * @returns {Promise<Blob>}
 */
export async function generatePdfThumbnail(pdfBlob, width = 256) {
  const pdfjs = await import('pdfjs-dist/build/pdf.mjs');
  const workerSrc = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc.default;
  const buf = await pdfBlob.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  const page = await doc.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = width / baseViewport.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Thumbnail encode failed'))), 'image/jpeg', 0.85);
  });
}

/**
 * Generate a thumbnail Blob for an image source Blob (resize to width on longest edge).
 * @param {Blob} imageBlob
 * @param {number} [width=256]
 * @returns {Promise<Blob>}
 */
export async function generateImageThumbnail(imageBlob, width = 256) {
  const url = URL.createObjectURL(imageBlob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Image decode failed'));
      i.src = url;
    });
    const ratio = width / Math.max(img.width, img.height);
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Thumbnail encode failed'))), 'image/jpeg', 0.85);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 4: Install pdfjs-dist**

Run: `npm install --save pdfjs-dist@^4.7.0`

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/features/photos/document-utils.test.js`
Expected: PASS (5 tests). The PDF.js / image-thumbnail functions are not unit-tested here (they require real binaries) — covered by E2E.

- [ ] **Step 6: Commit**

```bash
git add src/features/photos/document-utils.js tests/unit/features/photos/document-utils.test.js package.json package-lock.json
git commit -m "feat(docs): document validation, limits, and thumbnail generators"
```

---

## Task 4: Document-list component — empty state and grid render

**Files:**
- Create: `src/features/photos/document-list.js`
- Create: `tests/unit/features/photos/document-list.test.js`

- [ ] **Step 1: Write failing tests for empty/populated render**

Create `tests/unit/features/photos/document-list.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountDocumentList } from '../../../../src/features/photos/document-list.js';

function makeRepo(docs = [], blobs = new Map()) {
  return {
    getDocumentsForPerson: vi.fn(async (id) => docs.filter((d) => d.personId === id)),
    saveDocument: vi.fn(async () => {}),
    deleteDocument: vi.fn(async () => {}),
    saveMedia: vi.fn(async (m) => m.id),
    getMedia: vi.fn(async (id) => blobs.get(id) ? { id, blob: blobs.get(id), mimeType: 'image/jpeg' } : null),
    deleteMedia: vi.fn(async () => {})
  };
}

describe('mountDocumentList', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders empty state when no documents', async () => {
    const handle = mountDocumentList({ container, personId: 'p1', repo: makeRepo() });
    await handle.refresh();
    expect(container.querySelector('.document-list-empty')).toBeTruthy();
    handle.destroy();
  });

  it('renders a tile per document', async () => {
    const docs = [
      { id: 'd1', personId: 'p1', mediaId: 'm1', thumbnailMediaId: 't1', kind: 'image', title: 'A', type: 'photo', eventDate: { year: 1948 } },
      { id: 'd2', personId: 'p1', mediaId: 'm2', thumbnailMediaId: 't2', kind: 'pdf', title: 'B', type: 'certificate', eventDate: { year: 1952 } }
    ];
    const blobs = new Map([['t1', new Blob([])], ['t2', new Blob([])]]);
    const handle = mountDocumentList({ container, personId: 'p1', repo: makeRepo(docs, blobs) });
    await handle.refresh();
    expect(container.querySelectorAll('.document-tile').length).toBe(2);
    handle.destroy();
  });

  it('shows count badge n / max', async () => {
    const docs = [{ id: 'd1', personId: 'p1', mediaId: 'm1', kind: 'image', title: 'A', type: 'photo' }];
    const handle = mountDocumentList({ container, personId: 'p1', repo: makeRepo(docs) });
    await handle.refresh();
    expect(container.querySelector('.document-count').textContent).toMatch(/1.*30/);
    handle.destroy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/features/photos/document-list.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module (render only — no upload yet)**

Create `src/features/photos/document-list.js`:

```js
import { MAX_DOCS_PER_PERSON } from './document-utils.js';
import { SecurityUtils } from '../../utils/security-utils.js';

/**
 * @param {{ container: HTMLElement, personId: string, repo: any, t?: (key: string, fallback: string) => string }} opts
 */
export function mountDocumentList(opts) {
  const { container, personId, repo } = opts;
  const t = opts.t ?? ((_, fallback) => fallback);
  let docs = [];
  let urlCache = new Map();

  container.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'document-list';
  container.appendChild(root);

  async function refresh() {
    docs = await repo.getDocumentsForPerson(personId);
    render();
  }

  function render() {
    revokeUrls();
    if (docs.length === 0) {
      root.innerHTML = '';
      const empty = document.createElement('div');
      empty.className = 'document-list-empty';
      SecurityUtils.setTextContent(empty, t('builder.modals.person.documents.empty', 'No documents yet.'));
      root.appendChild(empty);
      const addBtn = createAddButton();
      root.appendChild(addBtn);
      return;
    }
    root.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'document-list-header';
    const count = document.createElement('span');
    count.className = 'document-count';
    SecurityUtils.setTextContent(count, `${docs.length} / ${MAX_DOCS_PER_PERSON}`);
    header.appendChild(count);
    root.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'document-grid';
    for (const doc of docs) grid.appendChild(renderTile(doc));
    grid.appendChild(createAddButton(docs.length >= MAX_DOCS_PER_PERSON));
    root.appendChild(grid);
  }

  function renderTile(doc) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'document-tile';
    tile.dataset.docId = doc.id;
    tile.setAttribute('aria-label', doc.title || doc.id);
    const thumb = document.createElement('div');
    thumb.className = 'document-tile-thumb';
    if (doc.thumbnailMediaId) {
      // thumbnails are loaded async
      repo.getMedia(doc.thumbnailMediaId).then((rec) => {
        if (!rec?.blob) return;
        const url = URL.createObjectURL(rec.blob);
        urlCache.set(doc.thumbnailMediaId, url);
        thumb.style.backgroundImage = `url("${url}")`;
      });
    }
    if (doc.kind === 'pdf') {
      const badge = document.createElement('span');
      badge.className = 'document-tile-badge';
      SecurityUtils.setTextContent(badge, 'PDF');
      thumb.appendChild(badge);
    }
    tile.appendChild(thumb);
    const caption = document.createElement('div');
    caption.className = 'document-tile-caption';
    const title = document.createElement('div');
    title.className = 'document-tile-title';
    SecurityUtils.setTextContent(title, doc.title || '');
    caption.appendChild(title);
    if (doc.eventDate?.year) {
      const year = document.createElement('div');
      year.className = 'document-tile-year';
      SecurityUtils.setTextContent(year, String(doc.eventDate.year));
      caption.appendChild(year);
    }
    tile.appendChild(caption);
    return tile;
  }

  function createAddButton(disabled = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'document-add';
    btn.disabled = disabled;
    SecurityUtils.setTextContent(btn, t('builder.modals.person.documents.add', '+ Add document'));
    if (disabled) btn.title = t('builder.modals.person.documents.limit_reached', `Limit reached (${MAX_DOCS_PER_PERSON} per person)`);
    return btn;
  }

  function revokeUrls() {
    for (const url of urlCache.values()) URL.revokeObjectURL(url);
    urlCache = new Map();
  }

  return {
    refresh,
    destroy: () => { revokeUrls(); root.remove(); }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/features/photos/document-list.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/photos/document-list.js tests/unit/features/photos/document-list.test.js
git commit -m "feat(docs): document-list component renders empty + populated grid"
```

---

## Task 5: Document-list — add/edit/delete flows

**Files:**
- Modify: `src/features/photos/document-list.js`
- Modify: `tests/unit/features/photos/document-list.test.js`

- [ ] **Step 1: Write failing tests for limit and add**

Append to test file:

```js
it('disables add button at limit', async () => {
  const docs = Array.from({ length: 30 }, (_, i) => ({
    id: `d${i}`, personId: 'p1', mediaId: 'm', kind: 'image', title: 't', type: 'photo'
  }));
  const handle = mountDocumentList({ container, personId: 'p1', repo: makeRepo(docs) });
  await handle.refresh();
  const addBtn = container.querySelector('.document-add');
  expect(addBtn.disabled).toBe(true);
  handle.destroy();
});

it('addDocument(metadata) appends doc and re-renders', async () => {
  const repo = makeRepo([], new Map());
  const handle = mountDocumentList({ container, personId: 'p1', repo });
  await handle.refresh();
  await handle._addDocumentForTest({
    mediaId: 'm1', thumbnailMediaId: 't1', kind: 'image',
    title: 'New', type: 'photo', eventDate: null, place: '', description: ''
  });
  expect(repo.saveDocument).toHaveBeenCalled();
});

it('removeDocument(id) deletes and re-renders', async () => {
  const docs = [{ id: 'd1', personId: 'p1', mediaId: 'm1', kind: 'image', title: 'X', type: 'photo' }];
  const repo = makeRepo(docs);
  const handle = mountDocumentList({ container, personId: 'p1', repo });
  await handle.refresh();
  await handle._removeDocumentForTest('d1');
  expect(repo.deleteDocument).toHaveBeenCalledWith('d1');
  expect(repo.deleteMedia).toHaveBeenCalledWith('m1');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/features/photos/document-list.test.js`
Expected: FAIL — `_addDocumentForTest`/`_removeDocumentForTest` undefined; limit-disabled fails because the empty branch doesn't go through the limit check correctly.

- [ ] **Step 3: Add add/remove logic**

Modify `mountDocumentList` to expose programmatic add/remove (the test hooks). Add inside the closure:

```js
async function addDocument(meta) {
  await repo.saveDocument({
    id: `d_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    personId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...meta
  });
  await refresh();
}

async function removeDocument(id) {
  const doc = docs.find((d) => d.id === id);
  if (!doc) return;
  await repo.deleteDocument(id);
  if (doc.mediaId) await repo.deleteMedia(doc.mediaId).catch(() => {});
  if (doc.thumbnailMediaId) await repo.deleteMedia(doc.thumbnailMediaId).catch(() => {});
  await refresh();
}
```

In the populated branch of `render()`, also handle the limit-reached case for the empty state — wrap `createAddButton(true)` if currently at limit. The fix is making the empty-state branch *not* hit-cap when there are zero documents (already correct), so the existing test for "30 docs disables add" needs the populated branch to use `createAddButton(docs.length >= MAX_DOCS_PER_PERSON)` (already in current code from Task 4).

Expose hooks for tests at the bottom of the returned object:

```js
return {
  refresh,
  destroy: () => { revokeUrls(); root.remove(); },
  _addDocumentForTest: addDocument,
  _removeDocumentForTest: removeDocument
};
```

(Underscore prefix flags these as test-only; production code shouldn't call them directly — they'll be wired through the click handlers in Task 6.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/features/photos/document-list.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/photos/document-list.js tests/unit/features/photos/document-list.test.js
git commit -m "feat(docs): add/remove document operations on the list"
```

---

## Task 6: Wire upload + metadata editor into document-list

**Files:**
- Modify: `src/features/photos/document-list.js`
- Create: `src/features/photos/document-metadata-editor.js`

This task adds the user-facing add flow: file picker → validation → upload → thumbnail → open metadata editor → save.

- [ ] **Step 1: Build the metadata editor component**

Create `src/features/photos/document-metadata-editor.js`:

```js
import { SecurityUtils } from '../../utils/security-utils.js';
import { DOCUMENT_TYPES } from './document-utils.js';

/**
 * @param {{
 *   container: HTMLElement,
 *   doc: Object,
 *   onSave: (updated: Object) => void,
 *   onCancel: () => void,
 *   t?: (key: string, fallback: string) => string
 * }} opts
 */
export function mountDocumentMetadataEditor(opts) {
  const { container, doc, onSave, onCancel } = opts;
  const t = opts.t ?? ((_, f) => f);

  container.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'document-metadata-editor';
  form.setAttribute('aria-label', 'Edit document metadata');

  form.appendChild(field('title', t('builder.modals.person.documents.title', 'Title'), 'text', doc.title || ''));
  form.appendChild(typeField(t, doc.type || 'other'));
  form.appendChild(field('eventDate', t('builder.modals.person.documents.date', 'Date (YYYY or YYYY-MM-DD)'), 'text', formatDate(doc.eventDate)));
  form.appendChild(field('place', t('builder.modals.person.documents.place', 'Place'), 'text', doc.place || ''));
  form.appendChild(textarea('description', t('builder.modals.person.documents.description', 'Description'), doc.description || ''));

  const actions = document.createElement('div');
  actions.className = 'document-metadata-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  SecurityUtils.setTextContent(cancel, t('builder.modals.person.documents.cancel', 'Cancel'));
  cancel.addEventListener('click', () => onCancel());
  const save = document.createElement('button');
  save.type = 'submit';
  SecurityUtils.setTextContent(save, t('builder.modals.person.documents.save', 'Save document'));
  actions.appendChild(cancel);
  actions.appendChild(save);
  form.appendChild(actions);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const updated = {
      ...doc,
      title: SecurityUtils.sanitizeText(fd.get('title') || ''),
      type: fd.get('type') || 'other',
      eventDate: parseDate(fd.get('eventDate') || ''),
      place: SecurityUtils.sanitizeText(fd.get('place') || ''),
      description: SecurityUtils.sanitizeText(fd.get('description') || ''),
      updatedAt: Date.now()
    };
    onSave(updated);
  });

  container.appendChild(form);
}

function field(name, label, type, value) {
  const wrap = document.createElement('label');
  wrap.className = 'document-field';
  const lab = document.createElement('span');
  SecurityUtils.setTextContent(lab, label);
  const input = document.createElement('input');
  input.name = name;
  input.type = type;
  input.value = value;
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}

function textarea(name, label, value) {
  const wrap = document.createElement('label');
  wrap.className = 'document-field';
  const lab = document.createElement('span');
  SecurityUtils.setTextContent(lab, label);
  const ta = document.createElement('textarea');
  ta.name = name;
  ta.rows = 3;
  ta.value = value;
  wrap.appendChild(lab);
  wrap.appendChild(ta);
  return wrap;
}

function typeField(t, current) {
  const wrap = document.createElement('label');
  wrap.className = 'document-field';
  const lab = document.createElement('span');
  SecurityUtils.setTextContent(lab, t('builder.modals.person.documents.type', 'Type'));
  const sel = document.createElement('select');
  sel.name = 'type';
  for (const type of DOCUMENT_TYPES) {
    const opt = document.createElement('option');
    opt.value = type;
    SecurityUtils.setTextContent(opt, t(`builder.modals.person.documents.types.${type}`, capitalize(type)));
    if (type === current) opt.selected = true;
    sel.appendChild(opt);
  }
  wrap.appendChild(lab);
  wrap.appendChild(sel);
  return wrap;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  const { year, month, day } = d;
  if (year && month && day) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (year) return String(year);
  return '';
}

function parseDate(s) {
  if (!s) return null;
  const trimmed = s.trim();
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return { year: Number(ymd[1]), month: Number(ymd[2]), day: Number(ymd[3]), estimated: false };
  const y = trimmed.match(/^(\d{4})$/);
  if (y) return { year: Number(y[1]), estimated: false };
  return { note: `Original: ${trimmed}` };
}
```

- [ ] **Step 2: Wire the picker + editor into document-list**

Modify `src/features/photos/document-list.js`. Update imports:

```js
import { MAX_DOCS_PER_PERSON, validatePdfUpload, enforceDocumentLimit, defaultDocumentMetadata, generateImageThumbnail, generatePdfThumbnail } from './document-utils.js';
import { prepareImageUpload } from './photo-utils.js';
import { mountDocumentMetadataEditor } from './document-metadata-editor.js';
import { SecurityUtils } from '../../utils/security-utils.js';
```

Inside `mountDocumentList`, add a hidden file input at the top of the closure:

```js
const fileInput = document.createElement('input');
fileInput.type = 'file';
fileInput.accept = 'image/jpeg,image/png,image/webp,application/pdf';
fileInput.hidden = true;
container.appendChild(fileInput);
```

Wire the Add button click to trigger the picker. In `createAddButton(disabled)`:

```js
btn.addEventListener('click', () => {
  if (disabled) return;
  fileInput.value = '';
  fileInput.click();
});
```

Add the upload handler outside `render()`:

```js
fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  try {
    enforceDocumentLimit(docs.length);
    const isPdf = file.type === 'application/pdf';
    let blob, width, height, thumbBlob;
    if (isPdf) {
      validatePdfUpload(file);
      blob = file;
      thumbBlob = await generatePdfThumbnail(blob).catch(() => null);
    } else {
      const prepared = await prepareImageUpload(file);
      blob = prepared.blob; width = prepared.width; height = prepared.height;
      thumbBlob = await generateImageThumbnail(blob);
    }
    const mediaId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await repo.saveMedia({ id: mediaId, blob, mimeType: isPdf ? 'application/pdf' : 'image/jpeg', byteLength: blob.size, width, height });
    let thumbnailMediaId = null;
    if (thumbBlob) {
      thumbnailMediaId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await repo.saveMedia({ id: thumbnailMediaId, blob: thumbBlob, mimeType: 'image/jpeg', byteLength: thumbBlob.size });
    }
    const meta = defaultDocumentMetadata(file);
    openMetadataEditor({
      ...meta,
      kind: isPdf ? 'pdf' : 'image',
      mediaId,
      thumbnailMediaId,
      eventDate: null,
      place: ''
    });
  } catch (err) {
    notifyError(err.message);
  }
});

function openMetadataEditor(doc) {
  const editorMount = document.createElement('div');
  editorMount.className = 'document-editor-mount';
  root.appendChild(editorMount);
  mountDocumentMetadataEditor({
    container: editorMount,
    doc,
    t,
    onCancel: () => editorMount.remove(),
    onSave: async (updated) => {
      editorMount.remove();
      if (updated.id) {
        await repo.saveDocument(updated);
        await refresh();
      } else {
        await addDocument(updated);
      }
    }
  });
}

function notifyError(msg) {
  // Lazy import to avoid circular deps in tests
  import('../../ui/components/notifications.js').then(({ notifications }) => {
    notifications.error('Document error', msg);
  }).catch(() => console.error(msg));
}
```

Also wire tile click → open viewer (next task) and edit/delete icons. Add to `renderTile`:

```js
tile.addEventListener('click', () => opts.onOpen?.(doc));
const actions = document.createElement('div');
actions.className = 'document-tile-actions';
const editBtn = document.createElement('button');
editBtn.type = 'button';
editBtn.className = 'document-edit-btn';
editBtn.setAttribute('aria-label', t('builder.modals.person.documents.edit', 'Edit'));
SecurityUtils.setTextContent(editBtn, '✎');
editBtn.addEventListener('click', (e) => { e.stopPropagation(); openMetadataEditor(doc); });
const delBtn = document.createElement('button');
delBtn.type = 'button';
delBtn.className = 'document-delete-btn';
delBtn.setAttribute('aria-label', t('builder.modals.person.documents.delete', 'Delete'));
SecurityUtils.setTextContent(delBtn, '🗑');
delBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (window.confirm(t('builder.modals.person.documents.delete_confirm', 'Delete this document?'))) {
    await removeDocument(doc.id);
  }
});
actions.appendChild(editBtn);
actions.appendChild(delBtn);
tile.appendChild(actions);
```

Add `onOpen` to the opts contract; viewer wiring is in Task 8.

- [ ] **Step 3: Add minimal CSS**

Append to `src/ui/styles/photo-tabs.css`:

```css
.document-list-empty { text-align: center; padding: 2rem 1rem; color: #666; }
.document-list-header { display: flex; justify-content: flex-end; padding: 0.25rem 0; }
.document-count { font-size: 0.85rem; color: #555; }
.document-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
}
.document-tile {
  position: relative;
  background: transparent;
  border: 1px solid #e0e3e7;
  border-radius: 8px;
  padding: 0;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
}
.document-tile-thumb {
  width: 100%; aspect-ratio: 1; background: #f4f5f7 center / cover no-repeat;
  position: relative;
}
.document-tile-badge {
  position: absolute; top: 6px; right: 6px;
  background: #c0392b; color: #fff; padding: 2px 6px; border-radius: 4px;
  font-size: 0.7rem; font-weight: 600;
}
.document-tile-caption { padding: 0.5rem; }
.document-tile-title { font-weight: 500; font-size: 0.9rem; line-height: 1.3; }
.document-tile-year { font-size: 0.8rem; color: #666; margin-top: 2px; }
.document-tile-actions {
  position: absolute; top: 4px; left: 4px; display: none; gap: 2px;
}
.document-tile:hover .document-tile-actions,
.document-tile:focus-within .document-tile-actions { display: flex; }
.document-tile-actions button {
  background: rgba(0,0,0,0.6); color: #fff; border: 0; border-radius: 4px;
  width: 28px; height: 28px; cursor: pointer;
}
.document-add {
  width: 100%; aspect-ratio: 1; border: 2px dashed #c0c4ca; background: transparent;
  border-radius: 8px; cursor: pointer; color: #555; font-size: 0.95rem;
}
.document-add:disabled { cursor: not-allowed; opacity: 0.5; }
.document-editor-mount {
  margin-top: 1rem; padding: 1rem; background: #f8f9fa;
  border-radius: 8px; border: 1px solid #e0e3e7;
}
.document-field { display: block; margin-bottom: 0.75rem; }
.document-field span { display: block; font-size: 0.85rem; color: #555; margin-bottom: 0.25rem; }
.document-field input, .document-field textarea, .document-field select {
  width: 100%; padding: 0.5rem; border: 1px solid #d0d4d9; border-radius: 4px;
  font: inherit;
}
.document-metadata-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.75rem; }
```

- [ ] **Step 4: Smoke-test in dev**

Run: `npm run dev`. Open builder, add person, switch to Documents tab, click Add, upload an image, fill metadata, save. Verify tile appears.

- [ ] **Step 5: Commit**

```bash
git add src/features/photos/document-list.js src/features/photos/document-metadata-editor.js src/ui/styles/photo-tabs.css
git commit -m "feat(docs): upload pipeline and metadata editor wired to list"
```

---

## Task 7: Wire document-list mount in person modal

**Files:**
- Modify: `src/ui/modals/modal.js`

- [ ] **Step 1: Mount on modal open**

In `src/ui/modals/modal.js`, add the import:

```js
import { mountDocumentList } from '../../features/photos/document-list.js';
```

Add a top-level handle:

```js
let documentListHandle = null;
```

In `loadPersonForm` (after the avatar cropper mount), add:

```js
const docMount = document.getElementById('documentsListMount');
if (docMount) {
  if (documentListHandle) documentListHandle.destroy();
  const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
  if (repo && personData?.id) {
    documentListHandle = mountDocumentList({
      container: docMount,
      personId: personData.id,
      repo,
      t,
      onOpen: (doc) => openDocumentViewer(doc, documentListHandle)
    });
    documentListHandle.refresh();
  }
}
```

If `personData?.id` is missing (creating a new person), defer: skip the mount and re-mount after the first save. Add a hint in the empty state UI by passing a flag (or simply leave `docMount` blank — tests cover this).

- [ ] **Step 2: Update `clearForm` and `closeModal` to clean up**

In `clearForm`, append:

```js
if (documentListHandle) { documentListHandle.destroy(); documentListHandle = null; }
const docMount = document.getElementById('documentsListMount');
if (docMount) docMount.innerHTML = '';
```

- [ ] **Step 3: Update tree-engine GC to consider document mediaIds**

In `src/core/tree-engine.js`, find the `garbageCollectMedia` call (added in plan 1). Update the `referenced` set construction:

```js
const repo = this.cacheManager?.getIdbRepo?.();
if (repo) {
  const referenced = new Set();
  for (const p of this.personData.values()) {
    if (p?.photo?.mediaId) referenced.add(p.photo.mediaId);
  }
  const allDocs = await repo.getAllDocuments().catch(() => []);
  for (const d of allDocs) {
    if (d.mediaId) referenced.add(d.mediaId);
    if (d.thumbnailMediaId) referenced.add(d.thumbnailMediaId);
  }
  repo.garbageCollectMedia(referenced).catch((err) => {
    console.warn('[tree-engine] media GC failed:', err);
  });
}
```

- [ ] **Step 4: Cascade-delete documents on person delete**

In tree-engine's person-delete code (added in plan 1), extend the cleanup:

```js
const removed = this.personData.get(personId);
if (removed?.photo?.mediaId) {
  const repo = this.cacheManager?.getIdbRepo?.();
  repo?.deleteMedia(removed.photo.mediaId).catch(() => {});
  this.renderer?.clearMediaImage(removed.photo.mediaId);
}
const repo2 = this.cacheManager?.getIdbRepo?.();
if (repo2) {
  // Cascade documents — gather mediaIds first so we can clean blobs too
  repo2.getDocumentsForPerson(personId).then((docs) => {
    for (const d of docs) {
      if (d.mediaId) repo2.deleteMedia(d.mediaId).catch(() => {});
      if (d.thumbnailMediaId) repo2.deleteMedia(d.thumbnailMediaId).catch(() => {});
    }
    return repo2.deleteDocumentsForPerson(personId);
  }).catch(() => {});
}
```

- [ ] **Step 5: Smoke-test**

Run: `npm run dev`. Verify add-document round-trip, delete person → docs disappear, page reload → docs persist.

- [ ] **Step 6: Commit**

```bash
git add src/ui/modals/modal.js src/core/tree-engine.js
git commit -m "feat(docs): mount document-list in modal, cascade delete and GC"
```

---

## Task 8: Document viewer — image pan/zoom and PDF iframe

**Files:**
- Create: `src/features/photos/document-viewer.js`
- Modify: `src/ui/modals/modal.js` (add `openDocumentViewer`)

The image pan-zoom helper is reused from the cropper for consistency.

- [ ] **Step 1: Create the viewer module**

Create `src/features/photos/document-viewer.js`:

```js
import { SecurityUtils } from '../../utils/security-utils.js';

/**
 * @param {{
 *   doc: Object,
 *   docs: Object[],
 *   repo: any,
 *   onEdit: (doc: Object) => void,
 *   onDelete: (doc: Object) => void,
 *   onClose: () => void,
 *   t?: (key: string, fallback: string) => string
 * }} opts
 */
export function openDocumentLightbox(opts) {
  const t = opts.t ?? ((_, f) => f);
  let { doc } = opts;
  const overlay = document.createElement('div');
  overlay.className = 'document-viewer-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1;

  const previousFocus = document.activeElement;
  document.body.appendChild(overlay);

  function render() {
    overlay.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'document-viewer-header';
    const title = document.createElement('div');
    SecurityUtils.setTextContent(title, doc.title || '');
    if (doc.eventDate?.year) {
      const year = document.createElement('span');
      year.className = 'document-viewer-year';
      SecurityUtils.setTextContent(year, ` · ${doc.eventDate.year}`);
      title.appendChild(year);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'document-viewer-close';
    closeBtn.setAttribute('aria-label', t('builder.modals.person.documents.close', 'Close'));
    SecurityUtils.setTextContent(closeBtn, '✕');
    closeBtn.addEventListener('click', close);
    header.appendChild(title);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const body = document.createElement('div');
    body.className = 'document-viewer-body';
    overlay.appendChild(body);
    renderBody(body);

    const footer = document.createElement('div');
    footer.className = 'document-viewer-footer';
    const prev = document.createElement('button');
    prev.type = 'button';
    SecurityUtils.setTextContent(prev, t('builder.modals.person.documents.prev', '◀ Prev'));
    prev.addEventListener('click', () => navigate(-1));
    const editBtn = document.createElement('button');
    SecurityUtils.setTextContent(editBtn, t('builder.modals.person.documents.edit', 'Edit'));
    editBtn.addEventListener('click', () => { close(); opts.onEdit(doc); });
    const delBtn = document.createElement('button');
    SecurityUtils.setTextContent(delBtn, t('builder.modals.person.documents.delete', 'Delete'));
    delBtn.addEventListener('click', () => {
      if (window.confirm(t('builder.modals.person.documents.delete_confirm', 'Delete this document?'))) {
        const cur = doc;
        close();
        opts.onDelete(cur);
      }
    });
    const next = document.createElement('button');
    next.type = 'button';
    SecurityUtils.setTextContent(next, t('builder.modals.person.documents.next', 'Next ▶'));
    next.addEventListener('click', () => navigate(1));
    footer.appendChild(prev); footer.appendChild(editBtn); footer.appendChild(delBtn); footer.appendChild(next);
    overlay.appendChild(footer);
  }

  let pendingUrl = null;
  async function renderBody(body) {
    if (pendingUrl) { URL.revokeObjectURL(pendingUrl); pendingUrl = null; }
    const rec = await opts.repo.getMedia(doc.mediaId);
    if (!rec?.blob) {
      body.textContent = t('builder.modals.person.documents.missing', 'File missing.');
      return;
    }
    const url = URL.createObjectURL(rec.blob);
    pendingUrl = url;
    if (doc.kind === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.title = doc.title || 'PDF';
      iframe.className = 'document-viewer-pdf';
      body.appendChild(iframe);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.alt = doc.title || '';
      img.className = 'document-viewer-image';
      body.appendChild(img);
    }
  }

  function navigate(delta) {
    const idx = opts.docs.findIndex((d) => d.id === doc.id);
    const nextIdx = (idx + delta + opts.docs.length) % opts.docs.length;
    doc = opts.docs[nextIdx];
    render();
  }

  function close() {
    if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (previousFocus && previousFocus.focus) previousFocus.focus();
    opts.onClose?.();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
  }

  document.addEventListener('keydown', onKey);
  render();
  overlay.focus();
}
```

- [ ] **Step 2: Add CSS**

Append to `src/ui/styles/photo-tabs.css`:

```css
.document-viewer-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.85);
  display: flex; flex-direction: column;
}
.document-viewer-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.75rem 1.25rem; color: #fff; background: rgba(0,0,0,0.4);
}
.document-viewer-close {
  background: transparent; border: 0; color: #fff; font-size: 1.5rem; cursor: pointer;
}
.document-viewer-body {
  flex: 1; display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.document-viewer-image {
  max-width: 95%; max-height: 95%; object-fit: contain;
}
.document-viewer-pdf {
  width: 95%; height: 95%; border: 0; background: #fff;
}
.document-viewer-footer {
  display: flex; justify-content: space-between; padding: 0.75rem 1.25rem;
  background: rgba(0,0,0,0.4);
}
.document-viewer-footer button {
  background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.3);
  padding: 0.4rem 0.9rem; border-radius: 4px; cursor: pointer; font: inherit;
}
.document-viewer-footer button:hover { background: rgba(255,255,255,0.2); }
.document-viewer-year { color: #ccc; font-weight: 400; }
```

- [ ] **Step 3: Add `openDocumentViewer` helper in modal.js**

Add to `src/ui/modals/modal.js`:

```js
import { openDocumentLightbox } from '../../features/photos/document-viewer.js';

function openDocumentViewer(doc, listHandle) {
  const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
  if (!repo) return;
  // Capture the current sibling docs at click time
  const personId = doc.personId;
  repo.getDocumentsForPerson(personId).then((docs) => {
    openDocumentLightbox({
      doc,
      docs,
      repo,
      t,
      onEdit: (d) => listHandle?._addDocumentForTest ? null : null, // editor opens via list
      onDelete: async (d) => {
        if (d.mediaId) await repo.deleteMedia(d.mediaId).catch(() => {});
        if (d.thumbnailMediaId) await repo.deleteMedia(d.thumbnailMediaId).catch(() => {});
        await repo.deleteDocument(d.id);
        listHandle?.refresh();
      },
      onClose: () => {}
    });
  });
}
```

For Edit from the viewer: emit a custom event the list listens for, OR re-open the viewer's parent modal flow. Simplest: close the viewer and rely on the user clicking the ✎ icon on the tile. (Skipping inline-edit-from-viewer keeps the surface area small. Spec said Edit opens the metadata panel — implement by exposing `listHandle._openEditorForDoc(d)` and calling it from the viewer's onEdit.)

Add to `document-list.js` (return object):

```js
_openEditorForDoc: (doc) => openMetadataEditor(doc),
```

And update viewer wiring in modal.js:

```js
onEdit: (d) => listHandle?._openEditorForDoc?.(d),
```

- [ ] **Step 4: Smoke-test**

Run: `npm run dev`. Add a document, click its tile → viewer opens. Esc closes. ←/→ navigates between this person's docs. Edit and Delete work.

- [ ] **Step 5: Commit**

```bash
git add src/features/photos/document-viewer.js src/features/photos/document-list.js src/ui/modals/modal.js src/ui/styles/photo-tabs.css
git commit -m "feat(docs): lightbox viewer with image and pdf rendering"
```

---

## Task 9: Extend export/import to include documents

**Files:**
- Modify: `src/data/core-export.js`
- Modify: `tests/unit/data/core-export-media.test.js`

- [ ] **Step 1: Write failing test for documents round-trip**

Append to `tests/unit/data/core-export-media.test.js`:

```js
it('round-trips documents and their thumbnails', async () => {
  await repo.saveMedia({ id: 'm_main', blob: new Blob(['main']), mimeType: 'application/pdf', byteLength: 4 });
  await repo.saveMedia({ id: 'm_thumb', blob: new Blob(['thumb']), mimeType: 'image/jpeg', byteLength: 5, width: 256, height: 256 });
  await repo.saveDocument({
    id: 'd1', personId: 'p1', mediaId: 'm_main', thumbnailMediaId: 'm_thumb',
    kind: 'pdf', title: 'Cert', type: 'certificate',
    eventDate: { year: 1952 }, place: 'Riga', description: '',
    createdAt: 1, updatedAt: 1
  });
  await repo.savePerson({ id: 'p1', name: 'A' });
  const exported = await buildExport(repo);
  expect(exported.documents).toHaveLength(1);
  expect(exported.media.find((m) => m.id === 'm_main')).toBeTruthy();
  expect(exported.media.find((m) => m.id === 'm_thumb')).toBeTruthy();

  globalThis.indexedDB = new IDBFactory();
  const repo2 = new IndexedDBRepository('TestDB', 3);
  await repo2.initialize();
  await applyImport(repo2, exported);
  const docs = await repo2.getDocumentsForPerson('p1');
  expect(docs).toHaveLength(1);
  expect(docs[0].title).toBe('Cert');
});

it('drops document with missing media on import (warns)', async () => {
  const exported = {
    version: '2.2.0',
    persons: [{ id: 'p1', name: 'A' }],
    media: [],
    documents: [{ id: 'd1', personId: 'p1', mediaId: 'absent', kind: 'image', title: 'x', type: 'photo', createdAt: 1, updatedAt: 1 }]
  };
  globalThis.indexedDB = new IDBFactory();
  const repo2 = new IndexedDBRepository('TestDB', 3);
  await repo2.initialize();
  await applyImport(repo2, exported);
  const docs = await repo2.getDocumentsForPerson('p1');
  expect(docs).toHaveLength(0);
});
```

Update the existing tests' `IndexedDBRepository` instantiation to use version 3 (was 2 in plan 1).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/data/core-export-media.test.js`
Expected: FAIL — documents not in export, dangling docs not dropped.

- [ ] **Step 3: Update `buildExport` and `applyImport`**

In `src/data/core-export.js`, replace `listAllMediaIds`:

```js
async function listAllMediaIds(repo) {
  const ids = new Set();
  const persons = await repo.getAllPersons();
  for (const p of persons) if (p?.photo?.mediaId) ids.add(p.photo.mediaId);
  const docs = await repo.getAllDocuments();
  for (const d of docs) {
    if (d.mediaId) ids.add(d.mediaId);
    if (d.thumbnailMediaId) ids.add(d.thumbnailMediaId);
  }
  return Array.from(ids);
}
```

Update `buildExport` to include documents:

```js
export async function buildExport(repo) {
  const [persons, docs, allMediaIds] = await Promise.all([
    repo.getAllPersons(),
    repo.getAllDocuments(),
    listAllMediaIds(repo)
  ]);
  const media = [];
  for (const id of allMediaIds) {
    const rec = await repo.getMedia(id);
    if (!rec) continue;
    media.push({
      id: rec.id, mimeType: rec.mimeType, width: rec.width, height: rec.height,
      byteLength: rec.byteLength, base64: await blobToBase64(rec.blob)
    });
  }
  return { version: EXPORT_VERSION, cacheFormat: 'enhanced', persons, media, documents: docs };
}
```

Update `applyImport` to validate and import documents:

```js
export async function applyImport(repo, data) {
  if (!data?.persons) throw new Error('Invalid import: missing persons');
  const mediaIdsInImport = new Set();
  for (const m of data.media || []) {
    if (!m.id || !m.base64 || !m.mimeType) continue;
    if ((m.byteLength ?? 0) > 10 * 1024 * 1024) continue;
    await repo.saveMedia({
      id: m.id, blob: base64ToBlob(m.base64, m.mimeType),
      mimeType: m.mimeType, byteLength: m.byteLength ?? bin64Length(m.base64),
      width: m.width, height: m.height
    });
    mediaIdsInImport.add(m.id);
  }
  const personIdsInImport = new Set();
  for (const p of data.persons) {
    if (p.photo?.mediaId && !mediaIdsInImport.has(p.photo.mediaId)) {
      console.warn(`[import] dropping dangling photo for person ${p.id}`);
      p.photo = null;
    }
    await repo.savePerson(p);
    personIdsInImport.add(p.id);
  }
  for (const d of data.documents || []) {
    if (!personIdsInImport.has(d.personId)) {
      console.warn(`[import] dropping orphaned document ${d.id} (person ${d.personId} missing)`);
      continue;
    }
    if (d.mediaId && !mediaIdsInImport.has(d.mediaId)) {
      console.warn(`[import] dropping document ${d.id} (media ${d.mediaId} missing)`);
      continue;
    }
    if (d.thumbnailMediaId && !mediaIdsInImport.has(d.thumbnailMediaId)) {
      d.thumbnailMediaId = null; // thumbnail is optional; keep doc
    }
    await repo.saveDocument(d);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/data/core-export-media.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/core-export.js tests/unit/data/core-export-media.test.js
git commit -m "feat(docs): export/import bundles documents and thumbnails"
```

---

## Task 10: i18n — add document keys to all locales

**Files:**
- Modify: `public/assets/locales/{en,es,ru,de}.json`

- [ ] **Step 1: Update en.json**

Inside `builder.modals.person`, add:

```json
"documents": {
  "empty": "No documents yet. Add scans, certificates, letters, and other photos here.",
  "add": "+ Add document",
  "title": "Title",
  "type": "Type",
  "types": { "certificate": "Certificate", "photo": "Photo", "letter": "Letter", "other": "Other" },
  "date": "Date (YYYY or YYYY-MM-DD)",
  "place": "Place",
  "description": "Description",
  "save": "Save document",
  "cancel": "Cancel",
  "edit": "Edit",
  "delete": "Delete",
  "delete_confirm": "Delete this document?",
  "limit_reached": "Limit reached (30 per person)",
  "file_too_large": "File too large",
  "invalid_type": "File type not supported",
  "decode_failed": "Could not read this file",
  "missing": "File missing.",
  "prev": "◀ Prev",
  "next": "Next ▶",
  "close": "Close",
  "storage_full": "Storage full — export your tree and free up space"
}
```

- [ ] **Step 2: Update es.json**

```json
"documents": {
  "empty": "Aún no hay documentos. Añade escaneos, certificados, cartas y otras fotos aquí.",
  "add": "+ Añadir documento",
  "title": "Título",
  "type": "Tipo",
  "types": { "certificate": "Certificado", "photo": "Foto", "letter": "Carta", "other": "Otro" },
  "date": "Fecha (AAAA o AAAA-MM-DD)",
  "place": "Lugar",
  "description": "Descripción",
  "save": "Guardar documento",
  "cancel": "Cancelar",
  "edit": "Editar",
  "delete": "Eliminar",
  "delete_confirm": "¿Eliminar este documento?",
  "limit_reached": "Límite alcanzado (30 por persona)",
  "file_too_large": "Archivo demasiado grande",
  "invalid_type": "Tipo de archivo no admitido",
  "decode_failed": "No se pudo leer este archivo",
  "missing": "Archivo no encontrado.",
  "prev": "◀ Anterior",
  "next": "Siguiente ▶",
  "close": "Cerrar",
  "storage_full": "Almacenamiento lleno — exporta tu árbol y libera espacio"
}
```

- [ ] **Step 3: Update ru.json**

```json
"documents": {
  "empty": "Документов пока нет. Добавьте сканы, свидетельства, письма и другие фотографии здесь.",
  "add": "+ Добавить документ",
  "title": "Название",
  "type": "Тип",
  "types": { "certificate": "Свидетельство", "photo": "Фото", "letter": "Письмо", "other": "Другое" },
  "date": "Дата (ГГГГ или ГГГГ-ММ-ДД)",
  "place": "Место",
  "description": "Описание",
  "save": "Сохранить документ",
  "cancel": "Отмена",
  "edit": "Изменить",
  "delete": "Удалить",
  "delete_confirm": "Удалить этот документ?",
  "limit_reached": "Достигнут лимит (30 на человека)",
  "file_too_large": "Файл слишком большой",
  "invalid_type": "Тип файла не поддерживается",
  "decode_failed": "Не удалось прочитать файл",
  "missing": "Файл не найден.",
  "prev": "◀ Назад",
  "next": "Вперёд ▶",
  "close": "Закрыть",
  "storage_full": "Хранилище заполнено — экспортируйте дерево и освободите место"
}
```

- [ ] **Step 4: Update de.json**

```json
"documents": {
  "empty": "Noch keine Dokumente. Füge Scans, Urkunden, Briefe und andere Fotos hier hinzu.",
  "add": "+ Dokument hinzufügen",
  "title": "Titel",
  "type": "Typ",
  "types": { "certificate": "Urkunde", "photo": "Foto", "letter": "Brief", "other": "Sonstiges" },
  "date": "Datum (JJJJ oder JJJJ-MM-TT)",
  "place": "Ort",
  "description": "Beschreibung",
  "save": "Dokument speichern",
  "cancel": "Abbrechen",
  "edit": "Bearbeiten",
  "delete": "Löschen",
  "delete_confirm": "Dieses Dokument löschen?",
  "limit_reached": "Limit erreicht (30 pro Person)",
  "file_too_large": "Datei zu groß",
  "invalid_type": "Dateityp nicht unterstützt",
  "decode_failed": "Datei konnte nicht gelesen werden",
  "missing": "Datei nicht gefunden.",
  "prev": "◀ Zurück",
  "next": "Weiter ▶",
  "close": "Schließen",
  "storage_full": "Speicher voll — exportiere deinen Baum und gib Platz frei"
}
```

- [ ] **Step 5: Verify all four parse**

Run: `for f in public/assets/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "OK $f"; done`
Expected: 4 lines of `OK`.

- [ ] **Step 6: Commit**

```bash
git add public/assets/locales/*.json
git commit -m "i18n(docs): document tab translations for en/es/ru/de"
```

---

## Task 11: E2E — document upload, viewer, round-trip

**Files:**
- Create: `testing/tests/documents.spec.js`
- Modify: `testing/fixtures/` *(add a small PDF if missing)*

- [ ] **Step 1: Add a fixture PDF**

If `testing/fixtures/sample-doc.pdf` doesn't exist:

Run:
```bash
node -e "
const { writeFileSync } = require('fs');
// Minimal valid PDF (a single empty page)
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj xref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000053 00000 n \n0000000102 00000 n \ntrailer<</Size 4/Root 1 0 R>>startxref\n160\n%%EOF', 'utf8');
writeFileSync('testing/fixtures/sample-doc.pdf', pdf);
console.log('wrote pdf fixture');
"
```

- [ ] **Step 2: Write the E2E test**

Create `testing/tests/documents.spec.js`:

```js
import { test, expect } from '@playwright/test';
import path from 'path';

const IMG = path.resolve('testing/fixtures/sample-avatar.jpg');
const PDF = path.resolve('testing/fixtures/sample-doc.pdf');

test.describe('document attachments', () => {
  test('add image document with metadata, appears in grid', async ({ page }) => {
    await page.goto('/builder/');
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'Doc Owner');
    await page.click('#savePerson');               // create first to get an id
    await page.dblclick('text=Doc Owner');
    await page.click('#tab-documents-btn');
    await page.click('.document-add');
    await page.setInputFiles('input[type=file]', IMG);
    await expect(page.locator('.document-metadata-editor')).toBeVisible();
    await page.fill('input[name=title]', 'Family photo 1948');
    await page.selectOption('select[name=type]', 'photo');
    await page.fill('input[name=eventDate]', '1948');
    await page.click('text=Save document');
    await expect(page.locator('.document-tile')).toHaveCount(1);
    await expect(page.locator('.document-tile-title')).toHaveText('Family photo 1948');
    await expect(page.locator('.document-tile-year')).toHaveText('1948');
  });

  test('add PDF document, viewer opens iframe', async ({ page }) => {
    await page.goto('/builder/');
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'PDF Person');
    await page.click('#savePerson');
    await page.dblclick('text=PDF Person');
    await page.click('#tab-documents-btn');
    await page.click('.document-add');
    await page.setInputFiles('input[type=file]', PDF);
    await page.fill('input[name=title]', 'Birth cert');
    await page.click('text=Save document');
    await page.click('.document-tile');
    await expect(page.locator('.document-viewer-pdf')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.document-viewer-overlay')).toHaveCount(0);
  });

  test('export and re-import preserves documents', async ({ page }) => {
    await page.goto('/builder/');
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'Round Trip');
    await page.click('#savePerson');
    await page.dblclick('text=Round Trip');
    await page.click('#tab-documents-btn');
    await page.click('.document-add');
    await page.setInputFiles('input[type=file]', IMG);
    await page.fill('input[name=title]', 'Original');
    await page.click('text=Save document');
    // Export
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportJsonBtn')   // adjust selector to actual export button
    ]);
    const json = JSON.parse(await (await download.createReadStream()).read());
    expect(json.media.length).toBeGreaterThan(0);
    expect(json.documents).toHaveLength(1);
    expect(json.documents[0].title).toBe('Original');
  });
});
```

If `#exportJsonBtn` doesn't match the real selector, adjust before running. Find it with: `grep -rn "exportJson\|JSON Export\|Export.*JSON" src/pages/builder.astro src/features/export`.

- [ ] **Step 3: Run E2E**

Run: `npm run test:e2e -- documents.spec.js`
Expected: PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add testing/tests/documents.spec.js testing/fixtures/sample-doc.pdf
git commit -m "test(docs): e2e for upload, viewer, and export round-trip"
```

---

## Task 12: Final cleanup and full-suite verification

- [ ] **Step 1: Run all unit tests**

Run: `npm test -- --run`
Expected: ALL PASS. No regressions in existing tests.

- [ ] **Step 2: Run all E2E tests**

Run: `npm run test:e2e`
Expected: ALL PASS.

- [ ] **Step 3: Astro check**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 4: Manual smoke**

Start dev: `npm run dev`. Verify:
- Add a person, switch to Documents tab → empty state.
- Add image doc → metadata editor opens prefilled with file name.
- Save doc → tile appears in grid with thumbnail and year.
- Click tile → lightbox opens.
- ←/→ navigates between docs of the same person; Esc closes.
- Add a PDF → thumbnail generated, lightbox shows iframe.
- Hit cap by adding 30 docs → Add button disables.
- Delete a doc from tile → confirm, removed; storage GCs blob.
- Delete the person → all docs and media gone.
- Export JSON → contains `media` and `documents`. Reimport into a fresh tree → all preserved.

- [ ] **Step 5: Final commit (if any cleanup made changes)**

```bash
git add -A
git commit -m "chore(docs): final cleanup pass"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] `documents` IDB store with `personId` index (Task 1)
   - [x] Document CRUD (Task 2)
   - [x] Limits + validation + thumbnail generators (Task 3)
   - [x] Document-list render (Task 4)
   - [x] Add/edit/delete operations (Task 5)
   - [x] Upload + metadata editor (Task 6)
   - [x] Modal mount + GC + cascade delete (Task 7)
   - [x] Lightbox viewer (Task 8)
   - [x] Export/import round-trip (Task 9)
   - [x] i18n keys (Task 10)
   - [x] E2E coverage (Task 11)
   - [x] Cleanup sweep (Task 12)

2. **Plan 1 dependencies honored:**
   - [x] Reuses `saveMedia/getMedia/deleteMedia/garbageCollectMedia`
   - [x] Reuses `prepareImageUpload`
   - [x] Mounts in `#tab-documents` / `#documentsListMount` (created in plan 1, Task 10)
   - [x] Uses `getIdbRepo()` accessor (added in plan 1, Task 9)

3. **Out of scope (per spec):** drag-and-drop, OCR, multiple avatars, cloud sync, GEDCOM media, rotation, service-worker caching, photos-of-marriages. None creep in here.

4. **Naming consistency across plans:**
   - `documents` store, `documentsListMount` element, `mountDocumentList`, `getDocumentsForPerson`, `mediaId`, `thumbnailMediaId` — used identically across both plans. ✓
   - Document `kind` field is `'image'` or `'pdf'`. ✓
   - `eventDate` (matches existing birth/death `event` shape: `{ year, month?, day?, estimated, note? }`). ✓

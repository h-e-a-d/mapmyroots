# Avatar Cropper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the auto cover-fit avatar with a draggable, zoomable cropper. Original image is stored once as a Blob in IndexedDB; per-person `{x, y, scale}` transform is applied on every render.

**Architecture:** New IndexedDB `media` store holds image Blobs keyed by id. Person records gain `photo: { mediaId, transform }` (replacing `photoBase64`). A new `avatar-cropper` module renders a 400×400 canvas with a circular mask, supports pan/zoom/keyboard. Renderer applies the same transform math when drawing the node. Orphan media blobs are swept at app boot.

**Tech Stack:** Vanilla JS ES modules, Vitest + jsdom, fake-indexeddb (new devDep), Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-05-07-photos-and-documents-design.md`

**Branch:** `feat/avatar-cropper` (off `main`).

**Scope note:** This plan establishes the foundation (media store, photo schema, renderer transform) that the document-attachments plan will reuse. Document features are explicitly out of scope here — that's plan 2.

---

## Task 1: Setup test infrastructure for IndexedDB

**Why:** Tests for the new media store need a real IndexedDB. Existing tests mock `IndexedDBRepository`; the new repository tests will exercise the actual schema upgrade and CRUD.

**Files:**
- Modify: `package.json`
- Modify: `tests/setup.js`

- [ ] **Step 1: Install fake-indexeddb**

Run: `npm install --save-dev fake-indexeddb@^6.0.0`

Expected: `fake-indexeddb` appears under `devDependencies` in `package.json`.

- [ ] **Step 2: Wire fake-indexeddb into test setup**

Modify `tests/setup.js`. Add at the top (above the localStorage mock):

```js
import 'fake-indexeddb/auto';
```

This installs `indexedDB`, `IDBKeyRange`, etc. globally for jsdom-based tests.

- [ ] **Step 3: Verify setup**

Run: `npm test -- --run tests/unit/person-repository.test.js`
Expected: existing tests still pass (fake-indexeddb is additive, doesn't break mocked tests).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tests/setup.js
git commit -m "test(photos): add fake-indexeddb for media-store tests"
```

---

## Task 2: Bump DB_VERSION and add `media` store

**Files:**
- Create: `tests/unit/data/repositories/indexed-db-repository-media.test.js`
- Modify: `src/data/repositories/indexed-db-repository.js`

- [ ] **Step 1: Write failing test for schema upgrade**

Create `tests/unit/data/repositories/indexed-db-repository-media.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBRepository } from '../../../../src/data/repositories/indexed-db-repository.js';

describe('IndexedDBRepository media store', () => {
  beforeEach(() => {
    // Reset IDB between tests so onupgradeneeded fires
    globalThis.indexedDB = new IDBFactory();
  });

  it('creates media store on initialize at v2', async () => {
    const repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    const stores = Array.from(repo._dbForTest().objectStoreNames);
    expect(stores).toContain('media');
    expect(stores).toContain('persons');
  });

  it('media store keyPath is id', async () => {
    const repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    const tx = repo._dbForTest().transaction(['media'], 'readonly');
    expect(tx.objectStore('media').keyPath).toBe('id');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository-media.test.js`
Expected: FAIL — `media` not in object store names; `_dbForTest` is undefined.

- [ ] **Step 3: Update repository to v2 with media store**

Modify `src/data/repositories/indexed-db-repository.js`:

Change `DB_VERSION` constant:
```js
const DB_VERSION = 2;            // was 1
const STORE_MEDIA = 'media';
```

In `onupgradeneeded` (around line 66), add after the connections store creation:
```js
if (!db.objectStoreNames.contains(STORE_MEDIA)) {
  db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
}
```

Add a test-only accessor at the bottom of the class (above the closing `}`):
```js
/** @internal — for tests only */
_dbForTest() { return this.#db; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository-media.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/indexed-db-repository.js tests/unit/data/repositories/indexed-db-repository-media.test.js
git commit -m "feat(photos): add media store to IndexedDB schema (v2)"
```

---

## Task 3: Implement `saveMedia`, `getMedia`, `deleteMedia`

**Files:**
- Modify: `src/data/repositories/indexed-db-repository.js`
- Modify: `tests/unit/data/repositories/indexed-db-repository-media.test.js`

- [ ] **Step 1: Add failing CRUD tests**

Append to `tests/unit/data/repositories/indexed-db-repository-media.test.js` inside the `describe` block:

```js
it('saves and retrieves a media blob', async () => {
  const repo = new IndexedDBRepository('TestDB', 2);
  await repo.initialize();
  const blob = new Blob(['hello'], { type: 'image/jpeg' });
  const id = await repo.saveMedia({ id: 'm_1', blob, mimeType: 'image/jpeg', byteLength: 5, width: 10, height: 10 });
  expect(id).toBe('m_1');
  const got = await repo.getMedia('m_1');
  expect(got.mimeType).toBe('image/jpeg');
  expect(got.byteLength).toBe(5);
  expect(await got.blob.text()).toBe('hello');
});

it('returns null for missing media id', async () => {
  const repo = new IndexedDBRepository('TestDB', 2);
  await repo.initialize();
  expect(await repo.getMedia('missing')).toBeNull();
});

it('deletes media by id', async () => {
  const repo = new IndexedDBRepository('TestDB', 2);
  await repo.initialize();
  await repo.saveMedia({ id: 'm_2', blob: new Blob(['x']), mimeType: 'image/jpeg', byteLength: 1 });
  await repo.deleteMedia('m_2');
  expect(await repo.getMedia('m_2')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository-media.test.js`
Expected: FAIL — `saveMedia`, `getMedia`, `deleteMedia` not defined.

- [ ] **Step 3: Implement the three methods**

Add to `src/data/repositories/indexed-db-repository.js` (above `#ensureInitialized`):

```js
/**
 * Save a media record (image or PDF blob with metadata).
 * @param {{id: string, blob: Blob, mimeType: string, byteLength: number, width?: number, height?: number, createdAt?: number}} media
 * @returns {Promise<string>}
 */
async saveMedia(media) {
  await this.#ensureInitialized();
  const record = { createdAt: Date.now(), ...media };
  return new Promise((resolve, reject) => {
    const tx = this.#db.transaction([STORE_MEDIA], 'readwrite');
    const req = tx.objectStore(STORE_MEDIA).put(record);
    req.onsuccess = () => resolve(media.id);
    req.onerror = () => reject(new Error('Failed to save media'));
  });
}

/**
 * Get a media record by id.
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async getMedia(id) {
  await this.#ensureInitialized();
  return new Promise((resolve, reject) => {
    const tx = this.#db.transaction([STORE_MEDIA], 'readonly');
    const req = tx.objectStore(STORE_MEDIA).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(new Error('Failed to get media'));
  });
}

/**
 * Delete a media record by id. No-op if absent.
 * @param {string} id
 * @returns {Promise<void>}
 */
async deleteMedia(id) {
  await this.#ensureInitialized();
  return new Promise((resolve, reject) => {
    const tx = this.#db.transaction([STORE_MEDIA], 'readwrite');
    const req = tx.objectStore(STORE_MEDIA).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(new Error('Failed to delete media'));
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository-media.test.js`
Expected: PASS (5 tests total).

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/indexed-db-repository.js tests/unit/data/repositories/indexed-db-repository-media.test.js
git commit -m "feat(photos): saveMedia/getMedia/deleteMedia on repository"
```

---

## Task 4: Implement `garbageCollectMedia`

**Files:**
- Modify: `src/data/repositories/indexed-db-repository.js`
- Modify: `tests/unit/data/repositories/indexed-db-repository-media.test.js`

- [ ] **Step 1: Add failing test**

Append:

```js
it('garbageCollectMedia deletes only unreferenced ids', async () => {
  const repo = new IndexedDBRepository('TestDB', 2);
  await repo.initialize();
  for (const id of ['m_a', 'm_b', 'm_c']) {
    await repo.saveMedia({ id, blob: new Blob(['x']), mimeType: 'image/jpeg', byteLength: 1 });
  }
  const removed = await repo.garbageCollectMedia(new Set(['m_a', 'm_c']));
  expect(removed).toEqual(['m_b']);
  expect(await repo.getMedia('m_a')).not.toBeNull();
  expect(await repo.getMedia('m_b')).toBeNull();
  expect(await repo.getMedia('m_c')).not.toBeNull();
});

it('garbageCollectMedia is a no-op when all referenced', async () => {
  const repo = new IndexedDBRepository('TestDB', 2);
  await repo.initialize();
  await repo.saveMedia({ id: 'm_x', blob: new Blob(['x']), mimeType: 'image/jpeg', byteLength: 1 });
  const removed = await repo.garbageCollectMedia(new Set(['m_x']));
  expect(removed).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository-media.test.js`
Expected: FAIL — `garbageCollectMedia is not a function`.

- [ ] **Step 3: Implement**

Add to repository:

```js
/**
 * Delete every media row whose id is not in `referencedIds`.
 * Returns the list of deleted ids (for logging/tests).
 * @param {Set<string>} referencedIds
 * @returns {Promise<string[]>}
 */
async garbageCollectMedia(referencedIds) {
  await this.#ensureInitialized();
  const removed = [];
  return new Promise((resolve, reject) => {
    const tx = this.#db.transaction([STORE_MEDIA], 'readwrite');
    const store = tx.objectStore(STORE_MEDIA);
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(removed); return; }
      if (!referencedIds.has(cursor.value.id)) {
        removed.push(cursor.value.id);
        cursor.delete();
      }
      cursor.continue();
    };
    req.onerror = () => reject(new Error('GC scan failed'));
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/data/repositories/indexed-db-repository-media.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/indexed-db-repository.js tests/unit/data/repositories/indexed-db-repository-media.test.js
git commit -m "feat(photos): garbageCollectMedia for orphaned blobs"
```

---

## Task 5: Replace photo-utils.js with blob pipeline

**Files:**
- Modify: `src/features/photos/photo-utils.js`
- Create: `tests/unit/features/photos/photo-utils.test.js` *(only if it doesn't exist; otherwise replace)*

- [ ] **Step 1: Write failing tests for blob pipeline**

Create or replace `tests/unit/features/photos/photo-utils.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { prepareImageUpload, MAX_INPUT_BYTES } from '../../../../src/features/photos/photo-utils.js';

function makeFile(name, type, size) {
  const blob = new Blob([new Uint8Array(size)], { type });
  return new File([blob], name, { type });
}

describe('prepareImageUpload', () => {
  it('rejects non-image MIME', async () => {
    const file = makeFile('a.txt', 'text/plain', 100);
    await expect(prepareImageUpload(file)).rejects.toThrow(/type/i);
  });

  it('rejects files over MAX_INPUT_BYTES', async () => {
    const file = makeFile('big.jpg', 'image/jpeg', MAX_INPUT_BYTES + 1);
    await expect(prepareImageUpload(file)).rejects.toThrow(/too large/i);
  });

  it('accepts a JPEG within size', async () => {
    // jsdom can't decode actual image bytes, so we mock the decoder
    const fakeImage = { width: 1024, height: 768 };
    const result = await prepareImageUpload(makeFile('p.jpg', 'image/jpeg', 1000), {
      _decode: async () => fakeImage,
      _encode: async () => new Blob(['encoded'], { type: 'image/jpeg' })
    });
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.width).toBeLessThanOrEqual(2048);
    expect(result.blob).toBeInstanceOf(Blob);
  });

  it('downscales an oversize image to max 2048px on the longest edge', async () => {
    const fakeImage = { width: 4000, height: 2000 };
    let encodeCalledWith = null;
    await prepareImageUpload(makeFile('p.jpg', 'image/jpeg', 1000), {
      _decode: async () => fakeImage,
      _encode: async (canvas) => {
        encodeCalledWith = { width: canvas.width, height: canvas.height };
        return new Blob(['x'], { type: 'image/jpeg' });
      }
    });
    expect(encodeCalledWith.width).toBe(2048);
    expect(encodeCalledWith.height).toBe(1024);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/features/photos/photo-utils.test.js`
Expected: FAIL — old `resizePhotoToDataUrl` exists, new `prepareImageUpload` does not.

- [ ] **Step 3: Replace photo-utils.js**

Replace the entire contents of `src/features/photos/photo-utils.js`:

```js
const MAX_DIMENSION = 2048;
export const MAX_INPUT_BYTES = 10 * 1024 * 1024; // 10 MB raw input cap
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Validate, decode, and resize an image File into a JPEG Blob.
 *
 * @param {File} file
 * @param {object} [deps] — injection hooks for testing
 * @returns {Promise<{ blob: Blob, width: number, height: number, mimeType: 'image/jpeg' }>}
 */
export async function prepareImageUpload(file, deps = {}) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}`);
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`File too large (max ${MAX_INPUT_BYTES} bytes)`);
  }

  const decode = deps._decode ?? defaultDecode;
  const encode = deps._encode ?? defaultEncode;

  const img = await decode(file);
  const { width: outW, height: outH } = fitWithin(img.width, img.height, MAX_DIMENSION);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (img.draw) img.draw(ctx, outW, outH);
  else ctx.drawImage(img, 0, 0, outW, outH);

  const blob = await encode(canvas);
  return { blob, width: outW, height: outH, mimeType: 'image/jpeg' };
}

/**
 * Compute (w, h) preserving aspect ratio so the longest edge ≤ max.
 * @returns {{width: number, height: number}}
 */
function fitWithin(w, h, max) {
  if (w <= max && h <= max) return { width: w, height: h };
  const scale = max / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function defaultDecode(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function defaultEncode(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Encode failed'))),
      'image/jpeg',
      0.9
    );
  });
}

/**
 * @param {{ usage: number, quota: number }} estimate
 * @returns {boolean}
 */
export function shouldWarnAboutStorage({ usage, quota }) {
  if (!quota) return false;
  return usage / quota > 0.8;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/features/photos/photo-utils.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Verify nothing imports the old `resizePhotoToDataUrl`**

Run: `grep -rn "resizePhotoToDataUrl" src/ tests/ --include='*.js' --include='*.astro'`
Expected: only references in `src/pages/builder.astro:1081` (we'll fix in Task 12).

- [ ] **Step 6: Commit**

```bash
git add src/features/photos/photo-utils.js tests/unit/features/photos/photo-utils.test.js
git commit -m "feat(photos): blob-based prepareImageUpload pipeline"
```

---

## Task 6: Build the avatar-cropper module — pan/zoom math

**Files:**
- Create: `src/features/photos/avatar-cropper.js`
- Create: `tests/unit/features/photos/avatar-cropper.test.js`

This task focuses on the pure transform math. The DOM canvas wiring comes in Task 7.

- [ ] **Step 1: Write failing tests for transform math**

Create `tests/unit/features/photos/avatar-cropper.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { clampTransform, applyZoom, applyPan, DEFAULT_TRANSFORM } from '../../../../src/features/photos/avatar-cropper.js';

describe('clampTransform', () => {
  it('keeps default transform untouched', () => {
    const t = clampTransform(DEFAULT_TRANSFORM, { width: 1000, height: 1000 });
    expect(t).toEqual(DEFAULT_TRANSFORM);
  });

  it('clamps scale below 1.0 up to 1.0', () => {
    const t = clampTransform({ x: 0.5, y: 0.5, scale: 0.5 }, { width: 1000, height: 1000 });
    expect(t.scale).toBe(1.0);
  });

  it('clamps scale above 4.0 down to 4.0', () => {
    const t = clampTransform({ x: 0.5, y: 0.5, scale: 10 }, { width: 1000, height: 1000 });
    expect(t.scale).toBe(4.0);
  });

  it('clamps x/y so image always covers the circle (no gaps)', () => {
    // At scale 1 the image just covers; pan to x=0 (extreme left edge of image at center) leaves a gap
    const t = clampTransform({ x: 0, y: 0.5, scale: 1 }, { width: 1000, height: 1000 });
    // At scale 1 with square image and square viewport, x must be 0.5 exactly
    expect(t.x).toBe(0.5);
  });

  it('allows pan when zoomed in past cover', () => {
    const t = clampTransform({ x: 0.3, y: 0.5, scale: 2 }, { width: 1000, height: 1000 });
    expect(t.x).toBeCloseTo(0.3, 5);
  });
});

describe('applyZoom', () => {
  it('zooms in around the cursor anchor', () => {
    const before = { x: 0.5, y: 0.5, scale: 1 };
    const after = applyZoom(before, 1.5, { x: 0.5, y: 0.5 }, { width: 1000, height: 1000 });
    expect(after.scale).toBe(1.5);
    expect(after.x).toBeCloseTo(0.5, 5);
  });

  it('clamps zoom output', () => {
    const t = applyZoom({ x: 0.5, y: 0.5, scale: 1 }, 100, { x: 0.5, y: 0.5 }, { width: 1000, height: 1000 });
    expect(t.scale).toBe(4.0);
  });
});

describe('applyPan', () => {
  it('translates x/y by normalized delta', () => {
    const t = applyPan({ x: 0.5, y: 0.5, scale: 2 }, { dx: 0.1, dy: 0.0 }, { width: 1000, height: 1000 });
    expect(t.x).toBeCloseTo(0.6, 5);
    expect(t.y).toBeCloseTo(0.5, 5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/features/photos/avatar-cropper.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Create avatar-cropper.js with the math**

Create `src/features/photos/avatar-cropper.js`:

```js
export const DEFAULT_TRANSFORM = Object.freeze({ x: 0.5, y: 0.5, scale: 1.0 });
const MIN_SCALE = 1.0;
const MAX_SCALE = 4.0;

/**
 * Clamp a transform so:
 *  - scale is in [MIN_SCALE, MAX_SCALE]
 *  - x/y keep the image fully covering the unit circle
 * @param {{x: number, y: number, scale: number}} t
 * @param {{width: number, height: number}} imgSize
 * @returns {{x: number, y: number, scale: number}}
 */
export function clampTransform(t, imgSize) {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale ?? 1));

  // Compute the cover scale (in pixels) for a unit-radius circle.
  // Use ratio = imgWidth / coverWidth, where coverWidth = max(w, h) / min(w, h).
  // Working purely in normalized image space: at scale=1 the image just covers,
  // so x must equal 0.5 along the short axis. With scale > 1 there's slack.
  const aspect = imgSize.width / imgSize.height;
  // visibleX/Y = 1 / (scale * coverFactor)
  // coverFactor along x: if aspect >= 1, x is the short axis baseline -> 1; else aspect
  const coverX = aspect >= 1 ? 1 : aspect;
  const coverY = aspect >= 1 ? 1 / aspect : 1;
  const halfX = (1 / (scale * coverX)) / 2;
  const halfY = (1 / (scale * coverY)) / 2;

  const xMin = halfX, xMax = 1 - halfX;
  const yMin = halfY, yMax = 1 - halfY;
  const x = xMin > xMax ? 0.5 : Math.min(xMax, Math.max(xMin, t.x ?? 0.5));
  const y = yMin > yMax ? 0.5 : Math.min(yMax, Math.max(yMin, t.y ?? 0.5));

  return { x, y, scale };
}

/**
 * Apply a pan delta (in normalized image coordinates).
 * @param {{x: number, y: number, scale: number}} t
 * @param {{dx: number, dy: number}} delta
 * @param {{width: number, height: number}} imgSize
 */
export function applyPan(t, delta, imgSize) {
  return clampTransform({ x: t.x + delta.dx, y: t.y + delta.dy, scale: t.scale }, imgSize);
}

/**
 * Apply a zoom step around an anchor (a point in the image, normalized 0..1).
 * The point under the anchor stays under the anchor after zoom.
 * @param {{x: number, y: number, scale: number}} t
 * @param {number} newScale
 * @param {{x: number, y: number}} anchor
 * @param {{width: number, height: number}} imgSize
 */
export function applyZoom(t, newScale, anchor, imgSize) {
  const target = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
  // For zoom-around-anchor: keep the anchor fixed in viewport space.
  // Viewport is unit circle centered on (t.x, t.y). After scale change,
  // the new center must be such that the same image point lies at the anchor.
  // Anchor offset from center in image space: (anchor - t)
  // After zoom, that offset scales by (oldScale/newScale).
  const ratio = t.scale / target;
  const x = anchor.x - (anchor.x - t.x) * ratio;
  const y = anchor.y - (anchor.y - t.y) * ratio;
  return clampTransform({ x, y, scale: target }, imgSize);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/features/photos/avatar-cropper.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/photos/avatar-cropper.js tests/unit/features/photos/avatar-cropper.test.js
git commit -m "feat(photos): pan/zoom transform math for avatar cropper"
```

---

## Task 7: Avatar-cropper DOM mount + interactions

Now build the interactive component on top of the math.

**Files:**
- Modify: `src/features/photos/avatar-cropper.js`
- Modify: `tests/unit/features/photos/avatar-cropper.test.js`

- [ ] **Step 1: Write failing test for `mountCropper`**

Append to `tests/unit/features/photos/avatar-cropper.test.js`:

```js
import { mountCropper } from '../../../../src/features/photos/avatar-cropper.js';

describe('mountCropper', () => {
  function setupContainer() {
    const c = document.createElement('div');
    document.body.appendChild(c);
    return c;
  }

  it('mounts a canvas inside the container', () => {
    const handle = mountCropper({
      container: setupContainer(),
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      transform: DEFAULT_TRANSFORM,
      onChange: () => {}
    });
    expect(handle.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(handle.canvas.width).toBe(400);
    handle.destroy();
  });

  it('returns the current transform via getTransform()', () => {
    const handle = mountCropper({
      container: setupContainer(),
      blob: new Blob(['x'], { type: 'image/jpeg' }),
      transform: { x: 0.3, y: 0.4, scale: 2 },
      onChange: () => {}
    });
    expect(handle.getTransform()).toEqual({ x: 0.3, y: 0.4, scale: 2 });
    handle.destroy();
  });

  it('destroy() removes the canvas', () => {
    const container = setupContainer();
    const handle = mountCropper({
      container, blob: new Blob(['x']), transform: DEFAULT_TRANSFORM, onChange: () => {}
    });
    handle.destroy();
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('reset() restores DEFAULT_TRANSFORM and fires onChange', () => {
    const onChange = vi.fn();
    const handle = mountCropper({
      container: setupContainer(),
      blob: new Blob(['x']),
      transform: { x: 0.1, y: 0.1, scale: 3 },
      onChange
    });
    handle.reset();
    expect(handle.getTransform()).toEqual(DEFAULT_TRANSFORM);
    expect(onChange).toHaveBeenCalledWith(DEFAULT_TRANSFORM);
    handle.destroy();
  });
});
```

Add the `vi` import at the top of the file:
```js
import { describe, it, expect, vi } from 'vitest';
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/features/photos/avatar-cropper.test.js`
Expected: FAIL — `mountCropper is not a function`.

- [ ] **Step 3: Add `mountCropper` to the module**

Append to `src/features/photos/avatar-cropper.js`:

```js
const VIEWPORT_SIZE = 400;
const PAN_KEY_PX = 8;
const ZOOM_KEY_STEP = 0.1;

/**
 * @param {{
 *   container: HTMLElement,
 *   blob: Blob,
 *   transform?: {x: number, y: number, scale: number},
 *   onChange: (t: {x: number, y: number, scale: number}) => void
 * }} opts
 */
export function mountCropper(opts) {
  const { container, blob, onChange } = opts;
  let transform = { ...(opts.transform ?? DEFAULT_TRANSFORM) };
  let imgSize = { width: 1, height: 1 };
  let img = null;
  let dragging = false;
  let lastPointer = null;

  const canvas = document.createElement('canvas');
  canvas.width = VIEWPORT_SIZE;
  canvas.height = VIEWPORT_SIZE;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Drag to reposition photo, arrow keys to nudge, plus/minus to zoom');
  canvas.classList.add('avatar-cropper-canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Load the image
  const url = URL.createObjectURL(blob);
  const loaded = new Image();
  loaded.onload = () => {
    img = loaded;
    imgSize = { width: loaded.naturalWidth, height: loaded.naturalHeight };
    transform = clampTransform(transform, imgSize);
    redraw();
    onChange(transform);
  };
  loaded.onerror = () => { /* swallow — keep blank canvas */ };
  loaded.src = url;

  function redraw() {
    ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
    if (!img) return;
    const radius = VIEWPORT_SIZE / 2;
    const baseCover = Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height);
    const s = baseCover * transform.scale;
    const drawW = imgSize.width * s;
    const drawH = imgSize.height * s;
    const cx = radius - drawW * transform.x;
    const cy = radius - drawH * transform.y;
    ctx.drawImage(img, cx, cy, drawW, drawH);

    // Dim the area outside the circle
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Mask boundary stroke
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  function update(next) {
    transform = clampTransform(next, imgSize);
    redraw();
    onChange(transform);
  }

  function onPointerDown(e) {
    dragging = true;
    canvas.setPointerCapture(e.pointerId);
    lastPointer = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const dxPx = e.clientX - lastPointer.x;
    const dyPx = e.clientY - lastPointer.y;
    lastPointer = { x: e.clientX, y: e.clientY };
    // Convert pixel delta in viewport into normalized image delta
    const baseCover = Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height);
    const drawW = imgSize.width * baseCover * transform.scale;
    const drawH = imgSize.height * baseCover * transform.scale;
    const ratioX = rect.width / VIEWPORT_SIZE;
    const ratioY = rect.height / VIEWPORT_SIZE;
    const dx = -(dxPx / ratioX) / drawW;
    const dy = -(dyPx / ratioY) / drawH;
    update(applyPan(transform, { dx, dy }, imgSize));
  }
  function onPointerUp() { dragging = false; lastPointer = null; }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const rect = canvas.getBoundingClientRect();
    const ax = (e.clientX - rect.left) / rect.width;
    const ay = (e.clientY - rect.top) / rect.height;
    // Anchor in image space at current transform
    const anchor = imageSpaceFromViewport(ax, ay);
    update(applyZoom(transform, transform.scale * factor, anchor, imgSize));
  }

  function imageSpaceFromViewport(vx, vy) {
    // viewport (vx, vy) in [0..1] -> image-space normalized point under that pixel
    const baseCover = Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height);
    const s = baseCover * transform.scale;
    const drawW = imgSize.width * s, drawH = imgSize.height * s;
    const cx = VIEWPORT_SIZE / 2 - drawW * transform.x;
    const cy = VIEWPORT_SIZE / 2 - drawH * transform.y;
    const px = (vx * VIEWPORT_SIZE - cx) / drawW;
    const py = (vy * VIEWPORT_SIZE - cy) / drawH;
    return { x: px, y: py };
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowLeft') {
      const dx = -PAN_KEY_PX / (imgSize.width * Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height) * transform.scale);
      update(applyPan(transform, { dx, dy: 0 }, imgSize));
    } else if (e.key === 'ArrowRight') {
      const dx = PAN_KEY_PX / (imgSize.width * Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height) * transform.scale);
      update(applyPan(transform, { dx, dy: 0 }, imgSize));
    } else if (e.key === 'ArrowUp') {
      const dy = -PAN_KEY_PX / (imgSize.height * Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height) * transform.scale);
      update(applyPan(transform, { dx: 0, dy }, imgSize));
    } else if (e.key === 'ArrowDown') {
      const dy = PAN_KEY_PX / (imgSize.height * Math.max(VIEWPORT_SIZE / imgSize.width, VIEWPORT_SIZE / imgSize.height) * transform.scale);
      update(applyPan(transform, { dx: 0, dy }, imgSize));
    } else if (e.key === '+' || e.key === '=') {
      update(applyZoom(transform, transform.scale + ZOOM_KEY_STEP, { x: transform.x, y: transform.y }, imgSize));
    } else if (e.key === '-' || e.key === '_') {
      update(applyZoom(transform, transform.scale - ZOOM_KEY_STEP, { x: transform.x, y: transform.y }, imgSize));
    } else if (e.key === 'r' || e.key === 'R') {
      update(DEFAULT_TRANSFORM);
    } else {
      return;
    }
    e.preventDefault();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKeyDown);

  return {
    canvas,
    getTransform: () => ({ ...transform }),
    setZoom: (scale) => update({ ...transform, scale }),
    reset: () => update(DEFAULT_TRANSFORM),
    destroy: () => {
      URL.revokeObjectURL(url);
      canvas.remove();
    }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/features/photos/avatar-cropper.test.js`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/photos/avatar-cropper.js tests/unit/features/photos/avatar-cropper.test.js
git commit -m "feat(photos): mountCropper with pan/zoom/keyboard"
```

---

## Task 8: Update canvas-renderer to apply photo transform

**Files:**
- Modify: `src/core/canvas-renderer.js`

This is glue code that's hard to test in isolation (full renderer wiring). We rely on E2E coverage in Task 16. The change is small and surgical.

- [ ] **Step 1: Update `_getNodeImage` to read from mediaCache**

In `src/core/canvas-renderer.js`, replace the `_getNodeImage` method (around line 1166):

```js
_getNodeImage(id, node) {
  const mediaId = node?.photo?.mediaId;
  if (!mediaId) return null;
  return this._imageCache.get(mediaId) || null;
}

setMediaImage(mediaId, img) {
  this._imageCache.set(mediaId, img);
  this.needsRedraw = true;
}

clearMediaImage(mediaId) {
  this._imageCache.delete(mediaId);
  this.needsRedraw = true;
}
```

The cache is now keyed by `mediaId`, not personId, so identical images shared by multiple persons would dedupe (rare but free benefit).

- [ ] **Step 2: Apply transform in `drawCircleNode`**

Replace the photo block (lines ~1150-1163) with:

```js
const showPhotos = this.displayPreferences.showPhotos !== false;
const img = showPhotos ? this._getNodeImage(id, node) : null;
if (img && img.complete && img.naturalWidth > 0) {
  const transform = node.photo?.transform ?? { x: 0.5, y: 0.5, scale: 1 };
  const baseCover = Math.max((radius * 2) / img.naturalWidth, (radius * 2) / img.naturalHeight);
  const s = baseCover * transform.scale;
  const drawW = img.naturalWidth * s;
  const drawH = img.naturalHeight * s;
  const cx = node.x - drawW * transform.x;
  const cy = node.y - drawH * transform.y;
  ctx.save();
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, cx, cy, drawW, drawH);
  ctx.restore();
}

if (!node.photo?.mediaId || !showPhotos) {
  this.drawNodeText(ctx, node, radius * 1.8);
}
```

- [ ] **Step 3: Apply same change in `drawCircleNodeExport`**

Replace the photo block in `drawCircleNodeExport` (lines ~318-331):

```js
const showPhotos = this.displayPreferences.showPhotos !== false;
const exportImg = showPhotos ? this._getNodeImage(id, node) : null;
if (exportImg && exportImg.complete && exportImg.naturalWidth > 0) {
  const transform = node.photo?.transform ?? { x: 0.5, y: 0.5, scale: 1 };
  const baseCover = Math.max((radius * 2) / exportImg.naturalWidth, (radius * 2) / exportImg.naturalHeight);
  const s = baseCover * transform.scale;
  const drawW = exportImg.naturalWidth * s;
  const drawH = exportImg.naturalHeight * s;
  const cx = node.x - drawW * transform.x;
  const cy = node.y - drawH * transform.y;
  ctx.save();
  ctx.beginPath();
  ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(exportImg, cx, cy, drawW, drawH);
  ctx.restore();
}

if (!node.photo?.mediaId || !showPhotos) {
  this.drawNodeText(ctx, node, radius * 1.8);
}
```

- [ ] **Step 4: Remove `invalidateImageCache(id)` callers — replace with `clearMediaImage(mediaId)`**

Run: `grep -rn "invalidateImageCache" src/ --include='*.js'`

Update each call site to use `clearMediaImage(mediaId)`. If there are no current callers (likely — it was photoBase64-keyed), delete the `invalidateImageCache` method entirely.

- [ ] **Step 5: Verify nothing references `node.photoBase64` anymore in canvas-renderer.js**

Run: `grep -n "photoBase64" src/core/canvas-renderer.js`
Expected: no matches.

- [ ] **Step 6: Commit**

```bash
git add src/core/canvas-renderer.js
git commit -m "feat(photos): renderer uses mediaCache and applies photo transform"
```

---

## Task 9: Tree-engine — schema swap and media prefetch

**Files:**
- Modify: `src/core/tree-engine.js`

- [ ] **Step 1: Swap schema in formData consumer (`saveFromForm` flow)**

Find the personData literal that includes `photoBase64: formData.photoBase64 || ''` (line ~847). Replace that line with:

```js
photo: formData.photo || null,
```

Find the renderer node literal lines ~888 and ~922 that include `photoBase64: personData.photoBase64`. Replace each with:

```js
photo: personData.photo || null,
```

- [ ] **Step 2: Add media prefetch helper**

Add a method to the tree-engine class (place near `loadCachedState` around line 583):

```js
async _prefetchMedia() {
  if (!this.cacheManager?._idb && !this.cacheManager?._idbReady) return;
  const repo = this.cacheManager.getIdbRepo?.();
  if (!repo || !this.renderer) return;
  const referenced = new Set();
  for (const p of this.personData.values()) {
    if (p?.photo?.mediaId) referenced.add(p.photo.mediaId);
  }
  for (const mediaId of referenced) {
    const record = await repo.getMedia(mediaId).catch(() => null);
    if (!record || !record.blob) continue;
    const url = URL.createObjectURL(record.blob);
    const img = new Image();
    img.onload = () => {
      this.renderer.setMediaImage(mediaId, img);
      this.renderer.render();
    };
    img.src = url;
  }
}
```

- [ ] **Step 3: Expose IDB repo from CacheManager**

Modify `src/data/cache/core-cache.js`. Add a public accessor near the bottom of the class:

```js
getIdbRepo() {
  return this.#idbReady ? this.#idb : null;
}
```

- [ ] **Step 4: Call `_prefetchMedia` after a successful load**

In `tree-engine.js`, find the place where `loadCachedState` returns true (or `processLoadedData` completes — around line 583 or wherever the tree finishes loading). Add:

```js
const loaded = await this.loadCachedState();
if (loaded) {
  await this._prefetchMedia();
}
```

If there isn't an obvious single insertion point, add it inside `processLoadedData` at the end (after persons are populated).

- [ ] **Step 5: Boot-time orphan sweep**

In `tree-engine.js`, after the prefetch call, add:

```js
const repo = this.cacheManager?.getIdbRepo?.();
if (repo) {
  const referenced = new Set();
  for (const p of this.personData.values()) {
    if (p?.photo?.mediaId) referenced.add(p.photo.mediaId);
  }
  repo.garbageCollectMedia(referenced).catch((err) => {
    console.warn('[tree-engine] media GC failed:', err);
  });
}
```

- [ ] **Step 6: Cascade-delete media on person delete**

Find the person-delete code (search `delete this.personData` or `personData.delete`). Before the delete line, add:

```js
const removed = this.personData.get(personId);
if (removed?.photo?.mediaId) {
  const repo = this.cacheManager?.getIdbRepo?.();
  repo?.deleteMedia(removed.photo.mediaId).catch(() => {});
  this.renderer?.clearMediaImage(removed.photo.mediaId);
}
```

- [ ] **Step 7: Verify no `photoBase64` references remain in tree-engine**

Run: `grep -n "photoBase64" src/core/tree-engine.js`
Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add src/core/tree-engine.js src/data/cache/core-cache.js
git commit -m "feat(photos): tree-engine media prefetch, GC, and cascade delete"
```

---

## Task 10: Modal restructure — tab strip + Photo tab

**Files:**
- Modify: `src/ui/modals/modal.js`
- Modify: `src/pages/builder.astro`
- Create: `src/ui/styles/photo-tabs.css`
- Modify: `src/ui/styles/modal.css` *(if exists; else create — see CLAUDE.md "Modal CSS lives in src/ui/styles/modal.css")*

This task is integration glue; correctness is verified by E2E (Task 16) and manual smoke test.

- [ ] **Step 1: Update builder.astro markup**

In `src/pages/builder.astro`, replace the `<div class="form-group">` that contains the photo section (lines ~999-1011) with:

```html
<div role="tablist" class="person-modal-tabs" aria-label="Person sections">
  <button type="button" role="tab" id="tab-details-btn" aria-controls="tab-details" aria-selected="true" data-i18n="builder.modals.person.tabs.details">Details</button>
  <button type="button" role="tab" id="tab-photo-btn" aria-controls="tab-photo" aria-selected="false" tabindex="-1" data-i18n="builder.modals.person.tabs.photo">Photo</button>
  <button type="button" role="tab" id="tab-documents-btn" aria-controls="tab-documents" aria-selected="false" tabindex="-1" data-i18n="builder.modals.person.tabs.documents">Documents</button>
</div>
<div id="tab-photo" role="tabpanel" aria-labelledby="tab-photo-btn" hidden>
  <div id="avatarCropperMount"></div>
  <div class="cropper-controls">
    <label for="avatarZoom" data-i18n="builder.modals.person.cropper.zoom">Zoom</label>
    <input type="range" id="avatarZoom" min="1" max="4" step="0.05" value="1">
    <button type="button" id="avatarReset" data-i18n="builder.modals.person.cropper.reset">Reset</button>
  </div>
  <div class="cropper-actions">
    <input type="file" id="personPhotoInput" accept="image/jpeg,image/png,image/webp" data-i18n-aria-label="builder.modals.person.cropper.choose">
    <button type="button" id="personPhotoRemove" hidden data-i18n="builder.modals.person.photo.remove">Remove photo</button>
    <input type="hidden" id="personPhotoMediaId">
    <input type="hidden" id="personPhotoTransform">
  </div>
  <p class="cropper-hint" data-i18n="builder.modals.person.cropper.drag_hint">Drag to reposition · Scroll or pinch to zoom</p>
</div>
<div id="tab-documents" role="tabpanel" aria-labelledby="tab-documents-btn" hidden>
  <div id="documentsListMount"></div>
</div>
```

Wrap the existing form fields (above this block) with a `<div id="tab-details" role="tabpanel" aria-labelledby="tab-details-btn">` opening tag right after `<form id="personForm">`, and close with `</div>` before `</form>`.

- [ ] **Step 2: Remove the inline `setupPhotoUpload` IIFE**

In `src/pages/builder.astro`, delete the entire `(function setupPhotoUpload() { ... })()` block (lines ~1087-1131). Photo logic moves into modal.js (next steps).

Also delete the import line: `import { resizePhotoToDataUrl, shouldWarnAboutStorage } from '@/features/photos/photo-utils.js';` — the new flow lives in modal.js.

- [ ] **Step 3: Add tab-switching logic in modal.js**

In `src/ui/modals/modal.js`, add near the top (after existing imports):

```js
import { mountCropper, DEFAULT_TRANSFORM } from '../../features/photos/avatar-cropper.js';
import { prepareImageUpload, shouldWarnAboutStorage } from '../../features/photos/photo-utils.js';
```

Add a tab-switching helper inside the modal module:

```js
function setupTabs() {
  const tabs = document.querySelectorAll('.person-modal-tabs [role="tab"]');
  const panels = ['tab-details', 'tab-photo', 'tab-documents'].map((id) => document.getElementById(id));
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.id));
    tab.addEventListener('keydown', (e) => {
      const idx = Array.from(tabs).indexOf(tab);
      if (e.key === 'ArrowRight') tabs[(idx + 1) % tabs.length].focus();
      else if (e.key === 'ArrowLeft') tabs[(idx - 1 + tabs.length) % tabs.length].focus();
    });
  });
  function activateTab(tabBtnId) {
    tabs.forEach((tab) => {
      const isActive = tab.id === tabBtnId;
      tab.setAttribute('aria-selected', String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.getAttribute('aria-labelledby') !== tabBtnId;
    });
  }
}
```

Call `setupTabs()` from inside `showModalWithAnimation` (or wherever the modal opens) — once per modal open is fine; setting handlers more than once on the same buttons is harmless because click uses single-fire functions, but ideally guard with a `_tabsWired` flag on the modal element.

- [ ] **Step 4: Replace photo-load logic in `loadPersonForm`**

Find the photo block in `loadPersonForm` (lines ~238-256) and replace with:

```js
const photoMediaIdInput = document.getElementById('personPhotoMediaId');
const photoTransformInput = document.getElementById('personPhotoTransform');
const photo = personData?.photo || null;
if (photoMediaIdInput) photoMediaIdInput.value = photo?.mediaId || '';
if (photoTransformInput) photoTransformInput.value = JSON.stringify(photo?.transform || DEFAULT_TRANSFORM);
mountAvatarCropperForPerson(photo);
```

Add the helper inside the modal module (top-level, near `mountEvent`):

```js
let cropperHandle = null;

async function mountAvatarCropperForPerson(photo) {
  const mount = document.getElementById('avatarCropperMount');
  const removeBtn = document.getElementById('personPhotoRemove');
  if (cropperHandle) { cropperHandle.destroy(); cropperHandle = null; mount.innerHTML = ''; }

  if (!photo?.mediaId) {
    if (removeBtn) removeBtn.hidden = true;
    return;
  }

  const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
  const record = await repo?.getMedia(photo.mediaId).catch(() => null);
  if (!record?.blob) {
    if (removeBtn) removeBtn.hidden = true;
    return;
  }
  cropperHandle = mountCropper({
    container: mount,
    blob: record.blob,
    transform: photo.transform || DEFAULT_TRANSFORM,
    onChange: (t) => {
      const input = document.getElementById('personPhotoTransform');
      if (input) input.value = JSON.stringify(t);
      const zoomSlider = document.getElementById('avatarZoom');
      if (zoomSlider && Number(zoomSlider.value) !== t.scale) zoomSlider.value = String(t.scale);
    }
  });
  if (removeBtn) removeBtn.hidden = false;
}
```

- [ ] **Step 5: Replace upload handler**

Add inside the modal module (top-level), called once on module init:

```js
function setupAvatarUploadHandlers() {
  const fileInput = document.getElementById('personPhotoInput');
  const removeBtn = document.getElementById('personPhotoRemove');
  const zoomSlider = document.getElementById('avatarZoom');
  const resetBtn = document.getElementById('avatarReset');

  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const { blob, width, height, mimeType } = await prepareImageUpload(file);
      const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
      if (!repo) throw new Error('Storage unavailable');
      const id = `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await repo.saveMedia({ id, blob, mimeType, byteLength: blob.size, width, height });
      const photo = { mediaId: id, transform: { ...DEFAULT_TRANSFORM } };
      document.getElementById('personPhotoMediaId').value = id;
      document.getElementById('personPhotoTransform').value = JSON.stringify(photo.transform);
      await mountAvatarCropperForPerson(photo);
      // Storage warning hook
      if (navigator.storage?.estimate) {
        const est = await navigator.storage.estimate();
        if (shouldWarnAboutStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0 })) {
          const { notifications } = await import('../components/notifications.js');
          notifications.warning('Storage almost full', 'Consider exporting your tree.');
        }
      }
    } catch (err) {
      const { notifications } = await import('../components/notifications.js');
      notifications.error('Photo error', err.message);
      fileInput.value = '';
    }
  });

  removeBtn?.addEventListener('click', async () => {
    const id = document.getElementById('personPhotoMediaId').value;
    if (id) {
      const repo = window.treeCore?.cacheManager?.getIdbRepo?.();
      await repo?.deleteMedia(id).catch(() => {});
      window.treeCore?.renderer?.clearMediaImage(id);
    }
    document.getElementById('personPhotoMediaId').value = '';
    document.getElementById('personPhotoTransform').value = JSON.stringify(DEFAULT_TRANSFORM);
    fileInput.value = '';
    await mountAvatarCropperForPerson(null);
  });

  zoomSlider?.addEventListener('input', () => {
    if (cropperHandle) cropperHandle.setZoom(Number(zoomSlider.value));
  });
  resetBtn?.addEventListener('click', () => {
    if (cropperHandle) cropperHandle.reset();
  });
}
```

Call `setupAvatarUploadHandlers()` once at module init — find where the existing modal listeners are wired (search `addEventListener` near the top of the file) and call it there.

- [ ] **Step 6: Update `clearForm`**

In `clearForm` (lines ~451-460), replace the photo cleanup block with:

```js
const photoMediaIdInput = document.getElementById('personPhotoMediaId');
const photoTransformInput = document.getElementById('personPhotoTransform');
if (photoMediaIdInput) photoMediaIdInput.value = '';
if (photoTransformInput) photoTransformInput.value = JSON.stringify(DEFAULT_TRANSFORM);
const fileInput = document.getElementById('personPhotoInput');
if (fileInput) fileInput.value = '';
const removeBtn = document.getElementById('personPhotoRemove');
if (removeBtn) removeBtn.hidden = true;
if (cropperHandle) { cropperHandle.destroy(); cropperHandle = null; }
const mount = document.getElementById('avatarCropperMount');
if (mount) mount.innerHTML = '';
```

- [ ] **Step 7: Update form-data builder**

Find the line `photoBase64: document.getElementById('personPhotoBase64')?.value || ''` (line ~871). Replace with:

```js
photo: (() => {
  const mediaId = document.getElementById('personPhotoMediaId')?.value || '';
  if (!mediaId) return null;
  let transform = DEFAULT_TRANSFORM;
  try { transform = JSON.parse(document.getElementById('personPhotoTransform')?.value || ''); } catch {}
  return { mediaId, transform };
})()
```

- [ ] **Step 8: Add minimal CSS for the tabs**

Create `src/ui/styles/photo-tabs.css`:

```css
.person-modal-tabs {
  display: flex;
  gap: 0.25rem;
  border-bottom: 1px solid #d0d4d9;
  margin-bottom: 1rem;
}
.person-modal-tabs [role="tab"] {
  background: transparent;
  border: 0;
  border-bottom: 2px solid transparent;
  padding: 0.5rem 1rem;
  font-weight: 500;
  cursor: pointer;
  color: #555;
}
.person-modal-tabs [role="tab"][aria-selected="true"] {
  border-bottom-color: #3498db;
  color: #1a1a1a;
}
.person-modal-tabs [role="tab"]:focus-visible {
  outline: 2px solid #3498db;
  outline-offset: 2px;
}
.cropper-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.75rem 0;
}
.cropper-controls input[type=range] { flex: 1; }
.cropper-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.cropper-hint {
  margin-top: 0.5rem;
  font-size: 0.85rem;
  color: #666;
}
.avatar-cropper-canvas {
  display: block;
  margin: 0 auto;
  cursor: grab;
  touch-action: none;
  border-radius: 50%;
}
```

Import it in `src/pages/builder.astro` `<style>` block or via a `<link>` tag in the head — match how `modal.css` is loaded today. (Search `modal.css` to find the existing link and add the new one alongside.)

- [ ] **Step 9: Smoke test in dev**

Run: `npm run dev`. Open the builder, add a person, switch to the Photo tab, upload an image, drag/zoom, save. Reopen — transform retained.

- [ ] **Step 10: Commit**

```bash
git add src/ui/modals/modal.js src/pages/builder.astro src/ui/styles/photo-tabs.css
git commit -m "feat(photos): tabs in person modal, mount avatar cropper in Photo tab"
```

---

## Task 11: Update url-codec to strip new photo field

**Files:**
- Modify: `src/features/share/url-codec.js`
- Create: `tests/unit/features/share/url-codec.test.js`

- [ ] **Step 1: Write failing test**

Create `tests/unit/features/share/url-codec.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { encodeTreeToParam, decodeTreeFromParam } from '../../../../src/features/share/url-codec.js';

describe('url-codec strips media', () => {
  it('removes person.photo on encode', async () => {
    const tree = {
      version: '2.2.0',
      persons: [{ id: 'p1', name: 'A', photo: { mediaId: 'm1', transform: { x: 0.5, y: 0.5, scale: 1 } } }]
    };
    const param = await encodeTreeToParam(tree);
    const decoded = await decodeTreeFromParam(param);
    expect(decoded.persons[0].photo).toBeUndefined();
  });

  it('preserves other person fields', async () => {
    const tree = { version: '2.2.0', persons: [{ id: 'p1', name: 'Alice', surname: 'X' }] };
    const decoded = await decodeTreeFromParam(await encodeTreeToParam(tree));
    expect(decoded.persons[0].name).toBe('Alice');
    expect(decoded.persons[0].surname).toBe('X');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/features/share/url-codec.test.js`
Expected: FAIL — `photo` is preserved (currently only `photoBase64` is stripped).

- [ ] **Step 3: Update `stripPhotos`**

Modify `src/features/share/url-codec.js`:

```js
function stripPhotos(tree) {
  return {
    ...tree,
    persons: (tree.persons ?? []).map(({ photoBase64: _pb, photo: _p, ...rest }) => rest)
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/features/share/url-codec.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/share/url-codec.js tests/unit/features/share/url-codec.test.js
git commit -m "feat(photos): url-codec strips new photo field"
```

---

## Task 12: Export/import — include media as base64

**Files:**
- Modify: `src/data/core-export.js`
- Modify: `src/data/repositories/indexed-db-repository.js` *(if importAllData exists; otherwise here)*
- Create: `tests/unit/data/core-export-media.test.js`

- [ ] **Step 1: Read existing core-export.js**

Run: `cat src/data/core-export.js | head -80`. Note the export shape and the version constant location.

- [ ] **Step 2: Write failing round-trip test**

Create `tests/unit/data/core-export-media.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBRepository } from '../../../src/data/repositories/indexed-db-repository.js';
import { buildExport, applyImport } from '../../../src/data/core-export.js';

describe('export/import with media', () => {
  let repo;
  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
  });

  it('round-trips a person with a photo and media blob', async () => {
    await repo.saveMedia({ id: 'm1', blob: new Blob(['png'], { type: 'image/jpeg' }), mimeType: 'image/jpeg', byteLength: 3, width: 4, height: 4 });
    await repo.savePerson({ id: 'p1', name: 'A', photo: { mediaId: 'm1', transform: { x: 0.4, y: 0.6, scale: 2 } } });

    const exported = await buildExport(repo);
    expect(exported.media.length).toBe(1);
    expect(exported.media[0].id).toBe('m1');
    expect(exported.media[0].base64).toBeTruthy();
    expect(exported.persons[0].photo.transform.scale).toBe(2);

    // Wipe and re-import
    globalThis.indexedDB = new IDBFactory();
    const repo2 = new IndexedDBRepository('TestDB', 2);
    await repo2.initialize();
    await applyImport(repo2, exported);

    const got = await repo2.getMedia('m1');
    expect(got).not.toBeNull();
    expect(got.mimeType).toBe('image/jpeg');
    const persons = await repo2.getAllPersons();
    expect(persons[0].photo.transform.scale).toBe(2);
  });

  it('drops orphaned doc reference with warning (no doc exists)', async () => {
    // Sanity: photo.mediaId without matching media is set to null on import
    const exported = {
      version: '2.2.0',
      persons: [{ id: 'p1', name: 'A', photo: { mediaId: 'missing', transform: { x: 0.5, y: 0.5, scale: 1 } } }],
      media: [],
      documents: []
    };
    const repo2 = new IndexedDBRepository('TestDB', 2);
    await repo2.initialize();
    await applyImport(repo2, exported);
    const persons = await repo2.getAllPersons();
    expect(persons[0].photo).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- --run tests/unit/data/core-export-media.test.js`
Expected: FAIL — `buildExport`/`applyImport` either don't exist or don't handle media.

- [ ] **Step 4: Implement `buildExport` and `applyImport`**

Add (or update existing) in `src/data/core-export.js`:

```js
const EXPORT_VERSION = '2.2.0';

export async function buildExport(repo) {
  const [persons, allMediaIds] = await Promise.all([
    repo.getAllPersons(),
    listAllMediaIds(repo)
  ]);
  const media = [];
  for (const id of allMediaIds) {
    const rec = await repo.getMedia(id);
    if (!rec) continue;
    media.push({
      id: rec.id,
      mimeType: rec.mimeType,
      width: rec.width,
      height: rec.height,
      byteLength: rec.byteLength,
      base64: await blobToBase64(rec.blob)
    });
  }
  return { version: EXPORT_VERSION, cacheFormat: 'enhanced', persons, media, documents: [] };
}

async function listAllMediaIds(repo) {
  const ids = new Set();
  // For now, scan all persons' photos. Documents will be added in plan 2.
  const persons = await repo.getAllPersons();
  for (const p of persons) if (p?.photo?.mediaId) ids.add(p.photo.mediaId);
  return Array.from(ids);
}

async function blobToBase64(blob) {
  const buf = await blob.arrayBuffer();
  let s = '';
  const arr = new Uint8Array(buf);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

function base64ToBlob(b64, mimeType) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mimeType });
}

export async function applyImport(repo, data) {
  if (!data?.persons) throw new Error('Invalid import: missing persons');
  // Media first
  const mediaIdsInImport = new Set();
  for (const m of data.media || []) {
    if (!m.id || !m.base64 || !m.mimeType) continue;
    if ((m.byteLength ?? 0) > 10 * 1024 * 1024) continue;
    await repo.saveMedia({
      id: m.id,
      blob: base64ToBlob(m.base64, m.mimeType),
      mimeType: m.mimeType,
      byteLength: m.byteLength ?? bin64Length(m.base64),
      width: m.width,
      height: m.height
    });
    mediaIdsInImport.add(m.id);
  }
  // Persons (with dangling-photo cleanup)
  for (const p of data.persons) {
    if (p.photo?.mediaId && !mediaIdsInImport.has(p.photo.mediaId)) {
      console.warn(`[import] dropping dangling photo for person ${p.id}`);
      p.photo = null;
    }
    await repo.savePerson(p);
  }
}

function bin64Length(b64) {
  return Math.floor((b64.length * 3) / 4);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- --run tests/unit/data/core-export-media.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Wire `buildExport` / `applyImport` into existing exporter UI**

Find the existing exporter button handler (probably in `src/features/export/exporter.js` or in `src/data/core-export.js`) — search: `grep -rn "buildExport\|exportTree\|JSON.stringify.*persons" src/features/export src/data --include='*.js'`.

Replace its body with a call to `buildExport(repo)` and adjust import to call `applyImport(repo, data)`. Keep the file-download logic identical.

- [ ] **Step 7: Commit**

```bash
git add src/data/core-export.js tests/unit/data/core-export-media.test.js src/features/export/exporter.js
git commit -m "feat(photos): export/import bundles media as base64 in JSON"
```

---

## Task 13: i18n — add tab + cropper keys to all locales

**Files:**
- Modify: `public/assets/locales/en.json`
- Modify: `public/assets/locales/es.json`
- Modify: `public/assets/locales/ru.json`
- Modify: `public/assets/locales/de.json`

- [ ] **Step 1: Update en.json**

Inside `builder.modals.person`, add:

```json
"tabs": { "details": "Details", "photo": "Photo", "documents": "Documents" },
"cropper": {
  "drag_hint": "Drag to reposition · Scroll or pinch to zoom",
  "zoom": "Zoom",
  "reset": "Reset",
  "choose": "Choose photo..."
}
```

- [ ] **Step 2: Update es.json**

```json
"tabs": { "details": "Detalles", "photo": "Foto", "documents": "Documentos" },
"cropper": {
  "drag_hint": "Arrastra para reposicionar · Desplaza o pellizca para hacer zoom",
  "zoom": "Zoom",
  "reset": "Restablecer",
  "choose": "Elegir foto..."
}
```

- [ ] **Step 3: Update ru.json**

```json
"tabs": { "details": "Сведения", "photo": "Фото", "documents": "Документы" },
"cropper": {
  "drag_hint": "Перетащите для смещения · Прокрутите или сведите пальцы для масштаба",
  "zoom": "Масштаб",
  "reset": "Сбросить",
  "choose": "Выбрать фото..."
}
```

- [ ] **Step 4: Update de.json**

```json
"tabs": { "details": "Details", "photo": "Foto", "documents": "Dokumente" },
"cropper": {
  "drag_hint": "Ziehen zum Verschieben · Scrollen oder Zwei-Finger-Zoom",
  "zoom": "Zoom",
  "reset": "Zurücksetzen",
  "choose": "Foto wählen..."
}
```

- [ ] **Step 5: Verify JSON validity**

Run: `for f in public/assets/locales/*.json; do node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo "OK $f"; done`
Expected: 4 lines of `OK` output.

- [ ] **Step 6: Commit**

```bash
git add public/assets/locales/*.json
git commit -m "i18n(photos): tabs and cropper translations for en/es/ru/de"
```

---

## Task 14: E2E — avatar upload, crop, save, reload

**Files:**
- Create: `testing/tests/avatar-cropper.spec.js`

- [ ] **Step 1: Write the E2E test**

Create `testing/tests/avatar-cropper.spec.js`:

```js
import { test, expect } from '@playwright/test';
import path from 'path';

const FIXTURE = path.resolve('testing/fixtures/sample-avatar.jpg');

test.describe('avatar cropper', () => {
  test('upload, drag, save, reopen — transform retained', async ({ page }) => {
    await page.goto('/builder/');
    // Add a person
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'Test Avatar');
    // Switch to Photo tab
    await page.click('#tab-photo-btn');
    // Upload
    await page.setInputFiles('#personPhotoInput', FIXTURE);
    await expect(page.locator('.avatar-cropper-canvas')).toBeVisible();
    // Adjust zoom
    await page.fill('#avatarZoom', '2.5');
    // Save
    await page.click('#savePerson');
    // Verify the node now has a photo (canvas pixel snapshot or fall back to checking person record)
    const transform = await page.evaluate(() => {
      const persons = Array.from(window.treeCore.personData.values());
      return persons.find((p) => p.name === 'Test Avatar')?.photo?.transform;
    });
    expect(transform.scale).toBeCloseTo(2.5, 1);

    // Reopen and verify
    await page.dblclick('text=Test Avatar'); // or whatever opens the editor
    await page.click('#tab-photo-btn');
    expect(await page.inputValue('#avatarZoom')).toBe('2.5');
  });

  test('remove photo clears mediaId', async ({ page }) => {
    await page.goto('/builder/');
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'Removable');
    await page.click('#tab-photo-btn');
    await page.setInputFiles('#personPhotoInput', FIXTURE);
    await page.waitForSelector('.avatar-cropper-canvas');
    await page.click('#personPhotoRemove');
    expect(await page.locator('.avatar-cropper-canvas').count()).toBe(0);
  });
});
```

- [ ] **Step 2: Add the fixture image**

If `testing/fixtures/sample-avatar.jpg` doesn't exist, create it (any small JPEG, ≤ 100 KB will do):

Run: `ls testing/fixtures/ 2>/dev/null`. If no avatar fixture exists:

Run: `node -e "
const { writeFileSync } = require('fs');
const buf = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A//2Q==', 'base64');
writeFileSync('testing/fixtures/sample-avatar.jpg', buf);
console.log('wrote fixture');
"`

- [ ] **Step 3: Run the E2E test**

Run: `npm run test:e2e -- avatar-cropper.spec.js`
Expected: PASS (2 tests).

If the dev server isn't running, the Playwright config likely auto-starts it; check `testing/playwright.config.js`.

- [ ] **Step 4: Commit**

```bash
git add testing/tests/avatar-cropper.spec.js testing/fixtures/sample-avatar.jpg
git commit -m "test(photos): e2e for avatar upload, crop, save, reopen"
```

---

## Task 15: Final cleanup and unit-test sweep

**Files:**
- Modify: `src/core/canvas-renderer.js` *(if any photoBase64 leftovers)*
- Modify: `src/core/tree-engine.js` *(same)*
- Modify: `src/data/cache/core-cache.js` *(same)*

- [ ] **Step 1: Hunt for legacy field references**

Run: `grep -rn "photoBase64" src/ tests/ testing/ --include='*.js' --include='*.astro' --include='*.json'`
Expected: zero matches. Anything found should be removed (orphan code from a missed call site) — except possibly the URL-codec strip line, which we kept for safety.

If anything remains, delete it; it's dead code.

- [ ] **Step 2: Hunt for old element ids**

Run: `grep -rn "personPhotoBase64\|personPhotoPreview\|personPhotoPlaceholder" src/ --include='*.js' --include='*.astro'`
Expected: zero matches. The new ids are `personPhotoMediaId` and `personPhotoTransform`.

- [ ] **Step 3: Run the full unit suite**

Run: `npm test -- --run`
Expected: ALL PASS. No regressions.

- [ ] **Step 4: Run the linter / type check (if configured)**

Run: `npm run check`
Expected: 0 errors. Fix any issues introduced by the schema changes.

- [ ] **Step 5: Manual smoke**

Start dev server: `npm run dev`. Verify:
- Add a person, upload photo, drag/zoom, save, reopen → transform retained.
- Remove photo → tree node falls back to text.
- Toggle "Show Photos" preference → photo hides/shows.
- Export tree → JSON contains `media` array. Reimport → photo restored.

- [ ] **Step 6: Final commit (if any cleanup made changes)**

```bash
git add -A
git commit -m "chore(photos): remove residual photoBase64 references"
```

---

## Self-Review Checklist

Run these against the spec before declaring done:

1. **Spec coverage:**
   - [x] Schema upgrade (Task 2) ✓
   - [x] Media CRUD (Task 3) ✓
   - [x] Orphan GC (Task 4) ✓
   - [x] Blob upload pipeline (Task 5) ✓
   - [x] Cropper math (Task 6) + DOM (Task 7) ✓
   - [x] Renderer transform (Task 8) ✓
   - [x] Tree-engine schema swap, prefetch, GC, cascade (Task 9) ✓
   - [x] Modal tab strip + Photo tab wiring (Task 10) ✓
   - [x] url-codec stripping (Task 11) ✓
   - [x] Export/import round-trip (Task 12) ✓
   - [x] i18n keys (Task 13) ✓
   - [x] E2E coverage (Task 14) ✓
   - [x] Cleanup sweep (Task 15) ✓

2. **Out of scope (deferred to plan 2):** documents store, documents tab, document viewer, PDF.js thumbnails, document-related i18n keys. Spec section "Out of Scope" stays as written.

3. **No legacy migration:** Task 9 step 1 explicitly drops `photoBase64`. Per user direction.

4. **Naming consistency:**
   - `media` store, `mediaId` field, `mediaCache` map, `setMediaImage`/`clearMediaImage` methods. ✓
   - `transform.{x, y, scale}` everywhere. ✓
   - `DEFAULT_TRANSFORM = {0.5, 0.5, 1}` defined once, imported elsewhere. ✓

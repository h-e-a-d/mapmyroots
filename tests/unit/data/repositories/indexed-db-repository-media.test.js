// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBRepository } from '../../../../src/data/repositories/indexed-db-repository.js';

describe('IndexedDBRepository media store', () => {
  let repo;

  beforeEach(() => {
    // Reset IDB between tests so onupgradeneeded fires
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => { repo?.close(); });

  it('creates media store on initialize at v2', async () => {
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    const stores = Array.from(repo._dbForTest().objectStoreNames);
    expect(stores).toContain('media');
    expect(stores).toContain('persons');
  });

  it('media store keyPath is id', async () => {
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    const tx = repo._dbForTest().transaction(['media'], 'readonly');
    expect(tx.objectStore('media').keyPath).toBe('id');
  });

  it('saves and retrieves a media blob', async () => {
    repo = new IndexedDBRepository('TestDB', 2);
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
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    expect(await repo.getMedia('missing')).toBeNull();
  });

  it('deletes media by id', async () => {
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    await repo.saveMedia({ id: 'm_2', blob: new Blob(['x']), mimeType: 'image/jpeg', byteLength: 1 });
    await repo.deleteMedia('m_2');
    expect(await repo.getMedia('m_2')).toBeNull();
  });

  it('garbageCollectMedia deletes only unreferenced ids', async () => {
    repo = new IndexedDBRepository('TestDB', 2);
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
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    await repo.saveMedia({ id: 'm_x', blob: new Blob(['x']), mimeType: 'image/jpeg', byteLength: 1 });
    const removed = await repo.garbageCollectMedia(new Set(['m_x']));
    expect(removed).toEqual([]);
  });

  it('stores bytes as ArrayBuffer (not Blob) to avoid iOS Safari Blob/File errors', async () => {
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    await repo.saveMedia({ id: 'm_buf', blob: new Blob(['buffered'], { type: 'image/jpeg' }), mimeType: 'image/jpeg', byteLength: 8 });
    // Read raw record (bypassing getMedia) to confirm what was stored
    const raw = await new Promise((resolve, reject) => {
      const tx = repo._dbForTest().transaction(['media'], 'readonly');
      const req = tx.objectStore('media').get('m_buf');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    expect(raw.arrayBuffer).toBeInstanceOf(ArrayBuffer);
    expect(raw.blob).toBeUndefined();
    // getMedia should still hand callers a usable Blob
    const got = await repo.getMedia('m_buf');
    expect(got.blob).toBeInstanceOf(Blob);
    expect(got.blob.type).toBe('image/jpeg');
    expect(await got.blob.text()).toBe('buffered');
  });

  it('getMedia returns legacy Blob records unchanged (backward compat)', async () => {
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    // Write a legacy-shaped record directly (with blob, no arrayBuffer)
    await new Promise((resolve, reject) => {
      const tx = repo._dbForTest().transaction(['media'], 'readwrite');
      tx.objectStore('media').put({
        id: 'm_legacy',
        blob: new Blob(['legacy'], { type: 'image/png' }),
        mimeType: 'image/png',
        byteLength: 6,
        createdAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    const got = await repo.getMedia('m_legacy');
    expect(got.blob).toBeInstanceOf(Blob);
    expect(await got.blob.text()).toBe('legacy');
  });

  it('saveMedia surfaces the underlying error from the IDB layer', async () => {
    repo = new IndexedDBRepository('TestDB', 2);
    await repo.initialize();
    // Mock the db transaction to return a synthetic request that fires onerror
    // with a DOMException-like error object (iOS-style failure mode).
    const fakeTx = {
      onabort: null,
      onerror: null,
      error: null,
      objectStore() {
        return {
          put() {
            const req = { onsuccess: null, onerror: null, error: null };
            queueMicrotask(() => {
              req.error = { name: 'QuotaExceededError', message: 'storage full' };
              req.onerror?.({ target: req });
            });
            return req;
          }
        };
      }
    };
    const origDb = repo._dbForTest();
    origDb.transaction = () => fakeTx;
    let caught;
    try {
      await repo.saveMedia({ id: 'm_fail', blob: new Blob(['x']), mimeType: 'image/jpeg', byteLength: 1 });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(caught.message).toContain('QuotaExceededError');
    expect(caught.message).toContain('storage full');
    expect(caught.cause).toBeDefined();
    expect(caught.cause.name).toBe('QuotaExceededError');
  });
});

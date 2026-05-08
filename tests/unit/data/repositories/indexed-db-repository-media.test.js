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
});

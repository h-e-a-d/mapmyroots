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
});

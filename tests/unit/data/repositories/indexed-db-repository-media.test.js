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

// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBRepository } from '../../../../src/data/repositories/indexed-db-repository.js';

describe('IndexedDBRepository documents store', () => {
  let repo;

  beforeEach(() => {
    // Reset IDB between tests so onupgradeneeded fires
    globalThis.indexedDB = new IDBFactory();
  });

  afterEach(() => { repo?.close(); });

  it('creates documents store at v4', async () => {
    repo = new IndexedDBRepository('TestDocsDB', 4);
    await repo.initialize();
    const stores = Array.from(repo._dbForTest().objectStoreNames);
    expect(stores).toContain('documents');
    repo.close();
  });

  it('documents store has personId index', async () => {
    repo = new IndexedDBRepository('TestDocsDB', 4);
    await repo.initialize();
    const tx = repo._dbForTest().transaction(['documents'], 'readonly');
    expect(Array.from(tx.objectStore('documents').indexNames)).toContain('personId');
    repo.close();
  });
});

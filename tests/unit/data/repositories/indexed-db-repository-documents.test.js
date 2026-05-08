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

  it('creates documents store at v5', async () => {
    repo = new IndexedDBRepository('TestDocsDB', 5);
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

  it('saves and retrieves a document', async () => {
    const repo = new IndexedDBRepository('TestDocsDB', 4);
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
    repo.close();
  });

  it('returns empty array for person with no documents', async () => {
    const repo = new IndexedDBRepository('TestDocsDB', 4);
    await repo.initialize();
    expect(await repo.getDocumentsForPerson('nobody')).toEqual([]);
    repo.close();
  });

  it('deletes a document by id', async () => {
    const repo = new IndexedDBRepository('TestDocsDB', 4);
    await repo.initialize();
    await repo.saveDocument({ id: 'd2', personId: 'p2', mediaId: 'm', kind: 'image', title: 't', type: 'photo', eventDate: null, place: '', description: '', createdAt: 1, updatedAt: 1 });
    await repo.deleteDocument('d2');
    expect(await repo.getDocumentsForPerson('p2')).toEqual([]);
    repo.close();
  });

  it('deleteDocumentsForPerson removes all docs of a person', async () => {
    const repo = new IndexedDBRepository('TestDocsDB', 4);
    await repo.initialize();
    for (const id of ['d1', 'd2', 'd3']) {
      await repo.saveDocument({ id, personId: 'p3', mediaId: 'm', kind: 'image', title: id, type: 'photo', eventDate: null, place: '', description: '', createdAt: 1, updatedAt: 1 });
    }
    const removed = await repo.deleteDocumentsForPerson('p3');
    expect(removed.sort()).toEqual(['d1', 'd2', 'd3']);
    expect(await repo.getDocumentsForPerson('p3')).toEqual([]);
    repo.close();
  });

  it('getAllDocuments returns every document', async () => {
    const repo = new IndexedDBRepository('TestDocsDB', 4);
    await repo.initialize();
    await repo.saveDocument({ id: 'a', personId: 'p1', mediaId: 'm', kind: 'image', title: 't', type: 'photo', eventDate: null, place: '', description: '', createdAt: 1, updatedAt: 1 });
    await repo.saveDocument({ id: 'b', personId: 'p2', mediaId: 'm', kind: 'image', title: 't', type: 'photo', eventDate: null, place: '', description: '', createdAt: 1, updatedAt: 1 });
    const all = await repo.getAllDocuments();
    expect(all).toHaveLength(2);
    repo.close();
  });
});

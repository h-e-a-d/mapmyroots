// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { IndexedDBRepository } from '../../../src/data/repositories/indexed-db-repository.js';
import { buildExport, applyImport } from '../../../src/data/core-export.js';

describe('export/import with media', () => {
  let repo;
  beforeEach(async () => {
    globalThis.indexedDB = new IDBFactory();
    repo = new IndexedDBRepository('TestDB', 4);
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
    const repo2 = new IndexedDBRepository('TestDB', 4);
    await repo2.initialize();
    await applyImport(repo2, exported);

    const got = await repo2.getMedia('m1');
    expect(got).not.toBeNull();
    expect(got.mimeType).toBe('image/jpeg');
    const persons = await repo2.getAllPersons();
    expect(persons[0].photo.transform.scale).toBe(2);
  });

  it('sets photo to null for dangling mediaId on import', async () => {
    const exported = {
      version: '2.2.0',
      persons: [{ id: 'p1', name: 'A', photo: { mediaId: 'missing', transform: { x: 0.5, y: 0.5, scale: 1 } } }],
      media: [],
      documents: []
    };
    globalThis.indexedDB = new IDBFactory();
    const repo2 = new IndexedDBRepository('TestDB', 4);
    await repo2.initialize();
    await applyImport(repo2, exported);
    const persons = await repo2.getAllPersons();
    expect(persons[0].photo).toBeNull();
  });

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
    const repo2 = new IndexedDBRepository('TestDB', 4);
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
    const repo2 = new IndexedDBRepository('TestDB', 4);
    await repo2.initialize();
    await applyImport(repo2, exported);
    const docs = await repo2.getDocumentsForPerson('p1');
    expect(docs).toHaveLength(0);
  });
});

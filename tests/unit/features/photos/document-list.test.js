// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  afterEach(() => {
    container.remove();
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

  it('_addDocumentForTest appends doc and re-renders', async () => {
    const repo = makeRepo([], new Map());
    const handle = mountDocumentList({ container, personId: 'p1', repo });
    await handle.refresh();
    await handle._addDocumentForTest({
      mediaId: 'm1', thumbnailMediaId: 't1', kind: 'image',
      title: 'New', type: 'photo', eventDate: null, place: '', description: ''
    });
    expect(repo.saveDocument).toHaveBeenCalled();
    handle.destroy();
  });

  it('_removeDocumentForTest deletes doc and media', async () => {
    const docs = [{ id: 'd1', personId: 'p1', mediaId: 'm1', kind: 'image', title: 'X', type: 'photo' }];
    const repo = makeRepo(docs);
    const handle = mountDocumentList({ container, personId: 'p1', repo });
    await handle.refresh();
    await handle._removeDocumentForTest('d1');
    expect(repo.deleteDocument).toHaveBeenCalledWith('d1');
    expect(repo.deleteMedia).toHaveBeenCalledWith('m1');
    handle.destroy();
  });
});

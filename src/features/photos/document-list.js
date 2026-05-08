import { MAX_DOCS_PER_PERSON, validatePdfUpload, enforceDocumentLimit, defaultDocumentMetadata, generateImageThumbnail, generatePdfThumbnail } from './document-utils.js';
import { prepareImageUpload } from './photo-utils.js';
import { mountDocumentMetadataEditor } from './document-metadata-editor.js';
import { SecurityUtils } from '../../utils/security-utils.js';

/**
 * @param {{ container: HTMLElement, personId: string, repo: any, t?: (key: string, fallback: string) => string, onOpen?: (doc: object) => void }} opts
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

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/webp,application/pdf';
  fileInput.hidden = true;
  container.appendChild(fileInput);

  async function refresh() {
    docs = await repo.getDocumentsForPerson(personId);
    render();
  }

  function render() {
    revokeUrls();
    root.innerHTML = '';
    if (docs.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'document-list-empty';
      SecurityUtils.setTextContent(empty, t('builder.modals.person.documents.empty', 'No documents yet.'));
      root.appendChild(empty);
      root.appendChild(createAddButton());
      return;
    }
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
    tile.addEventListener('click', () => opts.onOpen?.(doc));

    const thumb = document.createElement('div');
    thumb.className = 'document-tile-thumb';
    if (doc.thumbnailMediaId) {
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

    return tile;
  }

  function createAddButton(disabled = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'document-add';
    btn.disabled = disabled;
    SecurityUtils.setTextContent(btn, t('builder.modals.person.documents.add', '+ Add document'));
    if (disabled) btn.title = t('builder.modals.person.documents.limit_reached', `Limit reached (${MAX_DOCS_PER_PERSON} per person)`);
    if (!disabled) {
      btn.addEventListener('click', () => {
        fileInput.value = '';
        fileInput.click();
      });
    }
    return btn;
  }

  function revokeUrls() {
    for (const url of urlCache.values()) URL.revokeObjectURL(url);
    urlCache = new Map();
  }

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
        thumbBlob = await generateImageThumbnail(blob).catch(() => null);
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
    import('../../ui/components/notifications.js').then(({ notifications }) => {
      notifications.error('Document error', msg);
    }).catch(() => console.error(msg));
  }

  return {
    refresh,
    destroy: () => { revokeUrls(); root.remove(); },
    _addDocumentForTest: addDocument,
    _removeDocumentForTest: removeDocument,
    _openEditorForDoc: (doc) => openMetadataEditor(doc)
  };
}

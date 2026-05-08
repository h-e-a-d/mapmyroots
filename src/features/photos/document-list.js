import { MAX_DOCS_PER_PERSON } from './document-utils.js';
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
    return tile;
  }

  function createAddButton(disabled = false) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'document-add';
    btn.disabled = disabled;
    SecurityUtils.setTextContent(btn, t('builder.modals.person.documents.add', '+ Add document'));
    if (disabled) btn.title = t('builder.modals.person.documents.limit_reached', `Limit reached (${MAX_DOCS_PER_PERSON} per person)`);
    return btn;
  }

  function revokeUrls() {
    for (const url of urlCache.values()) URL.revokeObjectURL(url);
    urlCache = new Map();
  }

  return {
    refresh,
    destroy: () => { revokeUrls(); root.remove(); }
  };
}

import { SecurityUtils } from '../../utils/security-utils.js';

/**
 * @param {{
 *   doc: Object,
 *   docs: Object[],
 *   repo: any,
 *   onEdit: (doc: Object) => void,
 *   onDelete: (doc: Object) => void,
 *   onClose: () => void,
 *   t?: (key: string, fallback: string) => string
 * }} opts
 */
export function openDocumentLightbox(opts) {
  const t = opts.t ?? ((_, f) => f);
  let { doc } = opts;
  const overlay = document.createElement('div');
  overlay.className = 'document-viewer-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.tabIndex = -1;

  const previousFocus = document.activeElement;
  document.body.appendChild(overlay);

  function render() {
    overlay.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'document-viewer-header';
    const titleEl = document.createElement('div');
    titleEl.className = 'document-viewer-title';
    SecurityUtils.setTextContent(titleEl, doc.title || '');
    if (doc.eventDate?.year) {
      const year = document.createElement('span');
      year.className = 'document-viewer-year';
      SecurityUtils.setTextContent(year, ` · ${doc.eventDate.year}`);
      titleEl.appendChild(year);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'document-viewer-close';
    closeBtn.setAttribute('aria-label', t('builder.modals.person.documents.close', 'Close'));
    SecurityUtils.setTextContent(closeBtn, '✕');
    closeBtn.addEventListener('click', close);
    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    overlay.appendChild(header);

    const body = document.createElement('div');
    body.className = 'document-viewer-body';
    overlay.appendChild(body);
    renderBody(body);

    const footer = document.createElement('div');
    footer.className = 'document-viewer-footer';
    const prev = document.createElement('button');
    prev.type = 'button';
    SecurityUtils.setTextContent(prev, t('builder.modals.person.documents.prev', '◀ Prev'));
    prev.addEventListener('click', () => navigate(-1));
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    SecurityUtils.setTextContent(editBtn, t('builder.modals.person.documents.edit', 'Edit'));
    editBtn.addEventListener('click', () => { close(); opts.onEdit?.(doc); });
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    SecurityUtils.setTextContent(delBtn, t('builder.modals.person.documents.delete', 'Delete'));
    delBtn.addEventListener('click', () => {
      if (window.confirm(t('builder.modals.person.documents.delete_confirm', 'Delete this document?'))) {
        const cur = doc;
        close();
        opts.onDelete?.(cur);
      }
    });
    const next = document.createElement('button');
    next.type = 'button';
    SecurityUtils.setTextContent(next, t('builder.modals.person.documents.next', 'Next ▶'));
    next.addEventListener('click', () => navigate(1));
    footer.appendChild(prev);
    footer.appendChild(editBtn);
    footer.appendChild(delBtn);
    footer.appendChild(next);
    overlay.appendChild(footer);
  }

  let pendingUrl = null;

  async function renderBody(body) {
    if (pendingUrl) { URL.revokeObjectURL(pendingUrl); pendingUrl = null; }
    const rec = await opts.repo.getMedia(doc.mediaId).catch(() => null);
    if (!rec?.blob) {
      const missing = document.createElement('p');
      SecurityUtils.setTextContent(missing, t('builder.modals.person.documents.missing', 'File missing.'));
      body.appendChild(missing);
      return;
    }
    const url = URL.createObjectURL(rec.blob);
    pendingUrl = url;
    if (doc.kind === 'pdf') {
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.title = doc.title || 'PDF';
      iframe.className = 'document-viewer-pdf';
      body.appendChild(iframe);
    } else {
      const img = document.createElement('img');
      img.src = url;
      img.alt = doc.title || '';
      img.className = 'document-viewer-image';
      body.appendChild(img);
    }
  }

  function navigate(delta) {
    if (pendingUrl) { URL.revokeObjectURL(pendingUrl); pendingUrl = null; }
    const idx = opts.docs.findIndex((d) => d.id === doc.id);
    const nextIdx = (idx + delta + opts.docs.length) % opts.docs.length;
    doc = opts.docs[nextIdx];
    render();
  }

  function close() {
    if (pendingUrl) { URL.revokeObjectURL(pendingUrl); pendingUrl = null; }
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    if (previousFocus?.focus) previousFocus.focus();
    opts.onClose?.();
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); navigate(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navigate(1); }
  }

  document.addEventListener('keydown', onKey);
  render();
  overlay.focus();
}

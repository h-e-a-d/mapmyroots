import { SecurityUtils } from '../../utils/security-utils.js';
import { DOCUMENT_TYPES } from './document-utils.js';

/**
 * @param {{
 *   container: HTMLElement,
 *   doc: Object,
 *   onSave: (updated: Object) => void,
 *   onCancel: () => void,
 *   t?: (key: string, fallback: string) => string
 * }} opts
 */
export function mountDocumentMetadataEditor(opts) {
  const { container, doc, onSave, onCancel } = opts;
  const t = opts.t ?? ((_, f) => f);

  container.innerHTML = '';
  const form = document.createElement('form');
  form.className = 'document-metadata-editor';
  form.setAttribute('aria-label', 'Edit document metadata');

  form.appendChild(field('title', t('builder.modals.person.documents.title', 'Title'), 'text', doc.title || ''));
  form.appendChild(typeField(t, doc.type || 'other'));
  form.appendChild(field('eventDate', t('builder.modals.person.documents.date', 'Date (YYYY or YYYY-MM-DD)'), 'text', formatDate(doc.eventDate)));
  form.appendChild(field('place', t('builder.modals.person.documents.place', 'Place'), 'text', doc.place || ''));
  form.appendChild(textarea('description', t('builder.modals.person.documents.description', 'Description'), doc.description || ''));

  const actions = document.createElement('div');
  actions.className = 'document-metadata-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  SecurityUtils.setTextContent(cancel, t('builder.modals.person.documents.cancel', 'Cancel'));
  cancel.addEventListener('click', () => onCancel());
  const save = document.createElement('button');
  save.type = 'submit';
  SecurityUtils.setTextContent(save, t('builder.modals.person.documents.save', 'Save document'));
  actions.appendChild(cancel);
  actions.appendChild(save);
  form.appendChild(actions);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const updated = {
      ...doc,
      title: SecurityUtils.sanitizeText(fd.get('title') || ''),
      type: fd.get('type') || 'other',
      eventDate: parseDate(fd.get('eventDate') || ''),
      place: SecurityUtils.sanitizeText(fd.get('place') || ''),
      description: SecurityUtils.sanitizeText(fd.get('description') || ''),
      updatedAt: Date.now()
    };
    onSave(updated);
  });

  container.appendChild(form);
}

function field(name, label, type, value) {
  const wrap = document.createElement('label');
  wrap.className = 'document-field';
  const lab = document.createElement('span');
  SecurityUtils.setTextContent(lab, label);
  const input = document.createElement('input');
  input.name = name;
  input.type = type;
  input.value = value;
  wrap.appendChild(lab);
  wrap.appendChild(input);
  return wrap;
}

function textarea(name, label, value) {
  const wrap = document.createElement('label');
  wrap.className = 'document-field';
  const lab = document.createElement('span');
  SecurityUtils.setTextContent(lab, label);
  const ta = document.createElement('textarea');
  ta.name = name;
  ta.rows = 3;
  ta.value = value;
  wrap.appendChild(lab);
  wrap.appendChild(ta);
  return wrap;
}

function typeField(t, current) {
  const wrap = document.createElement('label');
  wrap.className = 'document-field';
  const lab = document.createElement('span');
  SecurityUtils.setTextContent(lab, t('builder.modals.person.documents.type', 'Type'));
  const sel = document.createElement('select');
  sel.name = 'type';
  for (const type of DOCUMENT_TYPES) {
    const opt = document.createElement('option');
    opt.value = type;
    SecurityUtils.setTextContent(opt, t(`builder.modals.person.documents.types.${type}`, capitalize(type)));
    if (type === current) opt.selected = true;
    sel.appendChild(opt);
  }
  wrap.appendChild(lab);
  wrap.appendChild(sel);
  return wrap;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function formatDate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d;
  const { year, month, day } = d;
  if (year && month && day) return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (year) return String(year);
  return '';
}

function parseDate(s) {
  if (!s) return null;
  const trimmed = s.trim();
  const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return { year: Number(ymd[1]), month: Number(ymd[2]), day: Number(ymd[3]), estimated: false };
  const y = trimmed.match(/^(\d{4})$/);
  if (y) return { year: Number(y[1]), estimated: false };
  return { note: `Original: ${trimmed}` };
}

import { parse as parseGedcom } from 'parse-gedcom';
import { parseDateValue } from '../../utils/date-value.js';
import { makeMarriageId } from '../../utils/marriage-sync.js';

export function importFromGedcom(gedcomText) {
  const sessionSalt = Date.now().toString(36);
  const root = parseGedcom(gedcomText);
  const nodes = root.children ?? [];
  const personMap = new Map();
  const warnings = [];

  for (const node of nodes) {
    if (node.type === 'INDI') {
      personMap.set(node.data.xref_id, indiToPersonStub(node, sessionSalt));
    }
  }

  for (const node of nodes) {
    if (node.type === 'FAM') {
      linkFamily(node, personMap, warnings);
    }
  }

  return { persons: Array.from(personMap.values()), warnings };
}

function indiToPersonStub(indi, sessionSalt) {
  const children = indi.children ?? [];

  const nameNode = children.find((n) => n.type === 'NAME');
  const rawName = nameNode?.value ?? '';
  const { given, surname } = parseName(rawName);

  const sexNode = children.find((n) => n.type === 'SEX');
  const gender = sexNode?.value === 'M' ? 'male' : sexNode?.value === 'F' ? 'female' : '';

  return {
    id: pointerToId(indi.data.xref_id, sessionSalt),
    name: given,
    surname,
    fatherName: '',
    maidenName: '',
    gender,
    motherId: '',
    fatherId: '',
    spouseId: '',
    birth: extractEvent(children, 'BIRT'),
    death: extractEvent(children, 'DEAT'),
    marriages: [],
    notes: ''
  };
}

function extractEvent(siblings, type) {
  const node = siblings.find((n) => n.type === type);
  if (!node) return { date: null, place: '', note: '' };
  const dateNode = node.children?.find((c) => c.type === 'DATE');
  const placeNode = node.children?.find((c) => c.type === 'PLAC');
  const noteNodes = (node.children || []).filter((c) => c.type === 'NOTE');
  return {
    date: parseGedcomDate(dateNode?.value || ''),
    place: placeNode?.value || '',
    note: noteNodes.map((n) => n.value || '').filter(Boolean).join('\n')
  };
}

function parseGedcomDate(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  const estPrefixes = ['ABT', 'EST', 'CAL', 'BEF', 'AFT'];
  let estimated = false;
  let body = trimmed;
  for (const p of estPrefixes) {
    if (body.toUpperCase().startsWith(`${p} `)) {
      estimated = true;
      body = body.slice(p.length + 1);
      break;
    }
  }
  const monthShort = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const m = body.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
  if (m) {
    const month = monthShort.indexOf(m[2].toUpperCase()) + 1;
    if (month > 0) return { year: parseInt(m[3], 10), month, day: parseInt(m[1], 10), estimated };
  }
  const yMatch = body.match(/^(\d{4})$/);
  if (yMatch) return { year: parseInt(yMatch[1], 10), estimated };
  const parsed = parseDateValue(body, { estimated });
  if (parsed && !parsed.error) return parsed;
  return null;
}

function linkFamily(fam, personMap, warnings) {
  const children = fam.children ?? [];
  const husbNode = children.find((n) => n.type === 'HUSB');
  const wifeNode = children.find((n) => n.type === 'WIFE');
  const childNodes = children.filter((n) => n.type === 'CHIL');
  const marrNode = children.find((n) => n.type === 'MARR');

  const husb = husbNode ? personMap.get(husbNode.data.pointer) : null;
  const wife = wifeNode ? personMap.get(wifeNode.data.pointer) : null;

  if (husb && wife) {
    if (!husb.spouseId) husb.spouseId = wife.id;
    if (!wife.spouseId) wife.spouseId = husb.id;

    const marriage = {
      id: makeMarriageId(),
      date: null,
      place: '',
      note: ''
    };
    if (marrNode) {
      const dateNode = marrNode.children?.find((c) => c.type === 'DATE');
      const placeNode = marrNode.children?.find((c) => c.type === 'PLAC');
      const noteNodes = (marrNode.children || []).filter((c) => c.type === 'NOTE');
      marriage.date = parseGedcomDate(dateNode?.value || '');
      marriage.place = placeNode?.value || '';
      marriage.note = noteNodes.map((n) => n.value || '').filter(Boolean).join('\n');
    }

    husb.marriages.push({ ...marriage, spouseId: wife.id });
    wife.marriages.push({ ...marriage, spouseId: husb.id });
  }

  for (const childNode of childNodes) {
    const child = personMap.get(childNode.data.pointer);
    if (!child) {
      warnings.push(`Unknown child pointer: ${childNode.data.pointer}`);
      continue;
    }
    if (husb && !child.fatherId) child.fatherId = husb.id;
    if (wife && !child.motherId) child.motherId = wife.id;
  }
}

function parseName(raw) {
  const match = raw.match(/^(.*?)\s*\/([^/]*)\//);
  if (match) return { given: match[1].trim(), surname: match[2].trim() };
  return { given: raw.trim(), surname: '' };
}

function pointerToId(pointer, salt) {
  return `gedcom_${salt}_${pointer.replace(/@/g, '')}`;
}

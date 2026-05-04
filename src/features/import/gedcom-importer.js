import { parse as parseGedcom } from 'parse-gedcom';

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

  const nameNode = children.find(n => n.type === 'NAME');
  const rawName = nameNode?.value ?? '';
  const { given, surname } = parseName(rawName);

  const sexNode = children.find(n => n.type === 'SEX');
  const gender = sexNode?.value === 'M' ? 'male' : sexNode?.value === 'F' ? 'female' : '';

  const birtNode = children.find(n => n.type === 'BIRT');
  const dobNode = birtNode?.children?.find(n => n.type === 'DATE');
  const dob = dobNode?.value ?? '';

  const deatNode = children.find(n => n.type === 'DEAT');
  const dodNode = deatNode?.children?.find(n => n.type === 'DATE');
  const dod = dodNode?.value ?? '';

  return {
    id: pointerToId(indi.data.xref_id, sessionSalt),
    name: given,
    surname,
    fatherName: '',
    maidenName: '',
    dob,
    dod,
    gender,
    motherId: '',
    fatherId: '',
    spouseId: '',
  };
}

function linkFamily(fam, personMap, warnings) {
  const children = fam.children ?? [];
  const husbNode = children.find(n => n.type === 'HUSB');
  const wifeNode = children.find(n => n.type === 'WIFE');
  const childNodes = children.filter(n => n.type === 'CHIL');

  const husb = husbNode ? personMap.get(husbNode.data.pointer) : null;
  const wife = wifeNode ? personMap.get(wifeNode.data.pointer) : null;

  if (husb && wife) {
    if (!husb.spouseId) husb.spouseId = wife.id;
    if (!wife.spouseId) wife.spouseId = husb.id;
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

import { parseDateValue } from '../../utils/date-value.js';

const TARGET_VERSION = '2.2.0';

function makeMarriageId() {
  return `marr_${Math.random().toString(36).slice(2, 10)}`;
}

function migratePerson(person) {
  if (!person || typeof person !== 'object') return person;

  const out = { ...person };

  if (!out.birth || typeof out.birth !== 'object') {
    let birthDate = null;
    let birthNote = '';
    const rawDob = typeof out.dob === 'string' ? out.dob.trim() : '';
    if (rawDob) {
      const parsed = parseDateValue(rawDob);
      if (parsed && !parsed.error) {
        birthDate = parsed;
      } else {
        birthNote = `Original: ${rawDob}`;
      }
    }
    out.birth = { date: birthDate, place: '', note: birthNote };
  }

  if (!out.death || typeof out.death !== 'object') {
    out.death = { date: null, place: '', note: '' };
  }

  if (!Array.isArray(out.marriages)) {
    out.marriages = [];
  }
  if (out.marriages.length === 0 && typeof out.spouseId === 'string' && out.spouseId.trim()) {
    out.marriages.push({
      id: makeMarriageId(),
      spouseId: out.spouseId,
      date: null,
      place: '',
      note: ''
    });
  }

  if (typeof out.notes !== 'string') {
    out.notes = '';
  }

  return out;
}

export function migrateToV22(file) {
  if (!file || typeof file !== 'object') return file;
  const version = file.version || '0.0.0';
  if (compareVersions(version, TARGET_VERSION) >= 0) return file;

  const persons = Array.isArray(file.persons) ? file.persons.map(migratePerson) : [];

  return { ...file, version: TARGET_VERSION, persons };
}

function compareVersions(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}

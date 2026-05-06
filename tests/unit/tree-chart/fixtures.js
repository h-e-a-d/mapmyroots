// fixtures.js — Test fixture builders for tree-chart tests

let nextId = 1;

export function resetIds() {
  nextId = 1;
}

export function person(props = {}) {
  const id = props.id || `p${nextId++}`;
  return {
    id,
    name: props.name || `Person ${id}`,
    surname: props.surname || '',
    fatherName: props.fatherName || '',
    maidenName: props.maidenName || '',
    dob: props.dob || '',
    gender: props.gender || '',
    motherId: props.motherId || '',
    fatherId: props.fatherId || '',
    spouseId: props.spouseId || ''
  };
}

/**
 * Build a Map<id, Person> from an array of person objects.
 * Spouse links are bidirectional — pass spouseId on either side and it mirrors automatically.
 */
export function buildPersonMap(people) {
  const map = new Map();
  for (const p of people) {
    map.set(p.id, { ...p });
  }
  for (const [id, p] of map) {
    if (p.spouseId && map.has(p.spouseId)) {
      const partner = map.get(p.spouseId);
      if (!partner.spouseId) partner.spouseId = id;
    }
  }
  return map;
}

/**
 * Linear chain: grandparent -> parent -> child.
 * Returns { map, ids: [grandId, parentId, childId] }.
 */
export function chainTree() {
  resetIds();
  const grand = person({ id: 'grand', name: 'Grandparent' });
  const parent = person({ id: 'parent', name: 'Parent', fatherId: 'grand' });
  const child = person({ id: 'child', name: 'Child', fatherId: 'parent' });
  return {
    map: buildPersonMap([grand, parent, child]),
    ids: ['grand', 'parent', 'child']
  };
}

/**
 * Two unrelated families plus one parked person.
 */
export function twoFamiliesPlusParked() {
  resetIds();
  const fa = person({ id: 'fa', name: 'Family A Root' });
  const fa1 = person({ id: 'fa1', name: 'A Child', fatherId: 'fa' });
  const fb = person({ id: 'fb', name: 'Family B Root' });
  const fb1 = person({ id: 'fb1', name: 'B Child', motherId: 'fb' });
  const lone = person({ id: 'lone', name: 'Loner' });
  return {
    map: buildPersonMap([fa, fa1, fb, fb1, lone]),
    families: [['fa', 'fa1'], ['fb', 'fb1']],
    parked: ['lone']
  };
}

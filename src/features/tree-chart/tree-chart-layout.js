// tree-chart-layout.js — Layout primitives (pure)

/**
 * Connected components over parent-child AND spouse edges.
 * Each component is a "cluster" — one laid-out tree.
 *
 * @param {Map<string, Person>} personData
 * @returns {{ clusterByPerson: Map<string, number>, clusterCount: number, clusterSizes: Map<number, number> }}
 */
export function detectClusters(personData) {
  const clusterByPerson = new Map();
  const clusterSizes = new Map();
  let nextClusterId = 0;

  for (const [rootId] of personData) {
    if (clusterByPerson.has(rootId)) continue;

    const clusterId = nextClusterId++;
    const stack = [rootId];
    let size = 0;

    while (stack.length) {
      const id = stack.pop();
      if (clusterByPerson.has(id)) continue;
      const p = personData.get(id);
      if (!p) continue;

      clusterByPerson.set(id, clusterId);
      size++;

      // Parent edges
      if (p.fatherId && personData.has(p.fatherId) && !clusterByPerson.has(p.fatherId)) {
        stack.push(p.fatherId);
      }
      if (p.motherId && personData.has(p.motherId) && !clusterByPerson.has(p.motherId)) {
        stack.push(p.motherId);
      }
      // Spouse edge
      if (p.spouseId && personData.has(p.spouseId) && !clusterByPerson.has(p.spouseId)) {
        stack.push(p.spouseId);
      }
      // Child edges
      for (const [otherId, other] of personData) {
        if (clusterByPerson.has(otherId)) continue;
        if (other.fatherId === id || other.motherId === id) {
          stack.push(otherId);
        }
      }
    }

    clusterSizes.set(clusterId, size);
  }

  return { clusterByPerson, clusterCount: nextClusterId, clusterSizes };
}

/**
 * A person is parked iff: no motherId in map, no fatherId in map,
 * no spouseId in map, no incoming child edge.
 *
 * @param {Map<string, Person>} personData
 * @param {Set<string>} [hasLineOnly] — ids with line-only connections (excluded from parking)
 * @returns {Set<string>} ids of parked persons
 */
export function assignParking(personData, hasLineOnly = new Set()) {
  const hasChild = new Set();
  for (const [, p] of personData) {
    if (p.fatherId && personData.has(p.fatherId)) hasChild.add(p.fatherId);
    if (p.motherId && personData.has(p.motherId)) hasChild.add(p.motherId);
  }

  const parked = new Set();
  for (const [id, p] of personData) {
    const hasParent = (p.fatherId && personData.has(p.fatherId)) ||
                      (p.motherId && personData.has(p.motherId));
    const hasSpouse = p.spouseId && personData.has(p.spouseId);
    if (!hasParent && !hasSpouse && !hasChild.has(id) && !hasLineOnly.has(id)) {
      parked.add(id);
    }
  }
  return parked;
}

/**
 * Group persons into couple units (married pair or singleton).
 * Tolerant of one-sided spouseId data.
 *
 * @param {Map<string, Person>} personData
 * @returns {Array<{ id: string, members: string[], coupleByPerson: Map<string, string> }>}
 */
export function groupIntoCouples(personData) {
  const coupleOf = new Map();
  const couples = [];
  let nextId = 0;

  for (const [id, p] of personData) {
    if (coupleOf.has(id)) continue;

    if (p.spouseId && personData.has(p.spouseId) && !coupleOf.has(p.spouseId)) {
      const coupleId = `couple-${nextId++}`;
      coupleOf.set(id, coupleId);
      coupleOf.set(p.spouseId, coupleId);
      couples.push({ id: coupleId, members: [id, p.spouseId] });
    } else {
      const coupleId = `couple-${nextId++}`;
      coupleOf.set(id, coupleId);
      couples.push({ id: coupleId, members: [id] });
    }
  }

  for (const c of couples) c.coupleByPerson = coupleOf;
  return couples;
}

/**
 * Assign a generation number to every person (longest-path on couple-DAG).
 * Couples sit on the same row. Cycles are broken by ignoring back-edges.
 *
 * @param {Map<string, Person>} personData
 * @param {Array<{ id: string, members: string[], coupleByPerson: Map<string, string> }>} couples
 * @returns {Map<string, number>} personId -> generation
 */
export function assignGenerations(personData, couples) {
  if (!couples.length) return new Map();
  const coupleOf = couples[0].coupleByPerson;

  // Build couple-DAG: childCouple -> Set<parentCouple>
  const incoming = new Map();
  for (const c of couples) incoming.set(c.id, new Set());

  for (const [childId, p] of personData) {
    const childCouple = coupleOf.get(childId);
    if (!childCouple) continue;
    const parents = [];
    if (p.fatherId && personData.has(p.fatherId)) parents.push(p.fatherId);
    if (p.motherId && personData.has(p.motherId)) parents.push(p.motherId);
    for (const parentId of parents) {
      const parentCouple = coupleOf.get(parentId);
      if (parentCouple && parentCouple !== childCouple) {
        incoming.get(childCouple).add(parentCouple);
      }
    }
  }

  // Compute longest path generation for each couple, with cycle handling
  const coupleGen = new Map();
  const visiting = new Set();
  let cycleDetected = false;

  function gen(coupleId) {
    if (coupleGen.has(coupleId)) return coupleGen.get(coupleId);
    if (visiting.has(coupleId)) {
      cycleDetected = true;
      return 0;
    }
    visiting.add(coupleId);
    let maxParent = -1;
    for (const parentCouple of incoming.get(coupleId)) {
      const pg = gen(parentCouple);
      if (pg > maxParent) maxParent = pg;
    }
    visiting.delete(coupleId);
    const result = maxParent + 1;
    coupleGen.set(coupleId, result);
    return result;
  }

  for (const c of couples) gen(c.id);

  if (cycleDetected) {
    console.warn('[tree-chart] cyclic parent-child data detected; cycle was broken for layout.');
  }

  // Second pass: push parent couples UP so they sit exactly one level above
  // their deepest child. This handles the case where a spouse's family tree
  // is shallower — the parents get pulled to child_gen - 1.
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of couples) {
      const childGen = coupleGen.get(c.id);
      for (const parentCoupleId of incoming.get(c.id)) {
        const parentGen = coupleGen.get(parentCoupleId);
        const needed = childGen - 1;
        if (parentGen < needed) {
          coupleGen.set(parentCoupleId, needed);
          changed = true;
        }
      }
    }
  }

  const personGen = new Map();
  for (const c of couples) {
    const g = coupleGen.get(c.id);
    for (const memberId of c.members) personGen.set(memberId, g);
  }
  return personGen;
}

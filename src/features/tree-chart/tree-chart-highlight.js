// tree-chart-highlight.js — Bloodline computation (pure) + DOM toggle

/**
 * Compute the blood-line set: ancestors ∪ descendants ∪ {self}.
 * In-laws and siblings of ancestors are EXCLUDED.
 *
 * @param {string} personId
 * @param {Map<string, Person>} personData
 * @returns {Set<string>}
 */
export function computeBloodLine(personId, personData) {
  const result = new Set();
  if (!personData.has(personId)) return result;
  result.add(personId);

  // Ancestors (walk up via fatherId/motherId)
  const upStack = [personId];
  while (upStack.length) {
    const id = upStack.pop();
    const p = personData.get(id);
    if (!p) continue;
    for (const parentId of [p.fatherId, p.motherId]) {
      if (parentId && personData.has(parentId) && !result.has(parentId)) {
        result.add(parentId);
        upStack.push(parentId);
      }
    }
  }

  // Build child index
  const childrenOf = new Map();
  for (const [cid, c] of personData) {
    for (const parentId of [c.fatherId, c.motherId]) {
      if (!parentId) continue;
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId).push(cid);
    }
  }

  // Descendants of personId only (NOT descendants of all ancestors)
  const downStack = [personId];
  while (downStack.length) {
    const id = downStack.pop();
    const kids = childrenOf.get(id) || [];
    for (const kid of kids) {
      if (!result.has(kid)) {
        result.add(kid);
        downStack.push(kid);
      }
    }
  }

  return result;
}

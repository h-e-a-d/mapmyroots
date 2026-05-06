// tree-chart-layout.js — Layout primitives (pure)
import { generateEdges } from './tree-chart-edges.js';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_GAP_X,
  COUPLE_GAP,
  ROW_HEIGHT,
  CLUSTER_GAP,
  PARKING_GAP,
  PARKING_NODE_GAP_X,
  PARKING_NODE_GAP_Y
} from './tree-chart-config.js';

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

/**
 * Lay out one cluster horizontally using subtree-width centering (Reingold-Tilford adapted).
 * Returns per-person positions in cluster-local coordinates.
 *
 * @param {Map<string, Person>} personData
 * @param {Array} couples — output of groupIntoCouples
 * @param {Map<string, number>} generations — output of assignGenerations
 * @param {Set<string>} includeIds — only persons in this set are positioned
 * @returns {Map<string, { x: number, y: number, width: number, height: number }>}
 */
export function layoutCluster(personData, couples, generations, includeIds) {
  const localCouples = couples.filter(c => c.members.every(m => includeIds.has(m)));
  if (!localCouples.length) return new Map();

  const coupleOf = localCouples[0].coupleByPerson;

  // Build child relation among couples
  const childrenOf = new Map();
  for (const c of localCouples) childrenOf.set(c.id, []);
  for (const c of localCouples) {
    const childCouples = new Set();
    for (const memberId of c.members) {
      for (const [otherId, other] of personData) {
        if (!includeIds.has(otherId)) continue;
        if (other.fatherId === memberId || other.motherId === memberId) {
          const otherCouple = coupleOf.get(otherId);
          if (otherCouple && otherCouple !== c.id) childCouples.add(otherCouple);
        }
      }
    }
    childrenOf.set(c.id, Array.from(childCouples));
  }

  // Roots = couples with no incoming parent edge inside this cluster
  const isChild = new Set();
  for (const [, kids] of childrenOf) for (const k of kids) isChild.add(k);
  const roots = localCouples.filter(c => !isChild.has(c.id)).map(c => c.id);

  const coupleById = new Map(localCouples.map(c => [c.id, c]));

  // Width of a couple unit
  const coupleWidth = new Map();
  for (const c of localCouples) {
    coupleWidth.set(c.id, c.members.length === 2
      ? 2 * NODE_WIDTH + COUPLE_GAP
      : NODE_WIDTH);
  }

  // Recursively compute subtree widths
  const subtreeWidth = new Map();
  function computeSubtreeWidth(coupleId, visiting = new Set()) {
    if (subtreeWidth.has(coupleId)) return subtreeWidth.get(coupleId);
    if (visiting.has(coupleId)) return coupleWidth.get(coupleId);
    visiting.add(coupleId);
    const kids = childrenOf.get(coupleId) || [];
    let kidsTotal = 0;
    for (let i = 0; i < kids.length; i++) {
      kidsTotal += computeSubtreeWidth(kids[i], visiting);
      if (i < kids.length - 1) kidsTotal += NODE_GAP_X;
    }
    visiting.delete(coupleId);
    const w = Math.max(coupleWidth.get(coupleId), kidsTotal);
    subtreeWidth.set(coupleId, w);
    return w;
  }
  for (const r of roots) computeSubtreeWidth(r);

  // Place couples
  const coupleX = new Map();
  function place(coupleId, leftEdge, visiting = new Set()) {
    if (visiting.has(coupleId)) return;
    visiting.add(coupleId);
    const w = subtreeWidth.get(coupleId);
    const center = leftEdge + w / 2;
    coupleX.set(coupleId, center);

    const kids = childrenOf.get(coupleId) || [];
    const kidsWidth = kids.reduce((acc, k, i) =>
      acc + subtreeWidth.get(k) + (i > 0 ? NODE_GAP_X : 0), 0);
    let kidLeft = leftEdge + (w - kidsWidth) / 2;
    for (const k of kids) {
      place(k, kidLeft, visiting);
      kidLeft += subtreeWidth.get(k) + NODE_GAP_X;
    }
    visiting.delete(coupleId);
  }

  let cursorX = 0;
  for (const r of roots) {
    place(r, cursorX);
    cursorX += subtreeWidth.get(r) + NODE_GAP_X;
  }

  // Convert couple positions to per-person positions
  const positions = new Map();
  for (const c of localCouples) {
    const cx = coupleX.get(c.id);
    if (cx === undefined) continue;
    const g = generations.get(c.members[0]) ?? 0;
    const y = g * ROW_HEIGHT;
    if (c.members.length === 1) {
      positions.set(c.members[0], { x: cx - NODE_WIDTH / 2, y, width: NODE_WIDTH, height: NODE_HEIGHT });
    } else {
      const halfCouple = (NODE_WIDTH + COUPLE_GAP) / 2;
      positions.set(c.members[0], { x: cx - halfCouple - NODE_WIDTH / 2, y, width: NODE_WIDTH, height: NODE_HEIGHT });
      positions.set(c.members[1], { x: cx + halfCouple - NODE_WIDTH / 2, y, width: NODE_WIDTH, height: NODE_HEIGHT });
    }
  }
  return positions;
}

/**
 * Position parked persons in a grid below the chart, alphabetical by name.
 *
 * @param {string[]} parkedIds
 * @param {Map<string, Person>} personData
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} chartBounds
 * @returns {{ y: number, height: number, items: Array<{ id, x, y }> } | null}
 */
export function layoutParking(parkedIds, personData, chartBounds) {
  if (parkedIds.length === 0) return null;

  const sorted = [...parkedIds].sort((a, b) => {
    const na = (personData.get(a)?.name || '').toLowerCase();
    const nb = (personData.get(b)?.name || '').toLowerCase();
    return na.localeCompare(nb);
  });

  const left = chartBounds.minX;
  const top = chartBounds.maxY + PARKING_GAP;
  const maxRowWidth = Math.max(chartBounds.maxX - chartBounds.minX, NODE_WIDTH);

  const items = [];
  let rowX = left;
  let y = top;
  for (const id of sorted) {
    if (rowX > left && rowX + NODE_WIDTH > left + maxRowWidth) {
      rowX = left;
      y += NODE_HEIGHT + PARKING_NODE_GAP_Y;
    }
    items.push({ id, x: rowX, y });
    rowX += NODE_WIDTH + PARKING_NODE_GAP_X;
  }

  const lastY = items[items.length - 1].y;
  return {
    y: top,
    height: lastY + NODE_HEIGHT - top,
    items
  };
}

/**
 * Top-level layout entry point. Orchestrates all layout phases.
 *
 * @param {Map<string, Person>} personData
 * @param {{ hasLineOnly?: Set<string>, clanData?: { clanByPerson: Map<string, number> }, lineOnlyConnections?: Array }} [options]
 * @returns {{ nodes: Map<string, NodeData>, edges: Array, parking: Object|null, bounds: Object }}
 */
export function runLayout(personData, options = {}) {
  const { hasLineOnly = new Set(), clanData } = options;

  const clusters = detectClusters(personData);
  const parkedSet = assignParking(personData, hasLineOnly);
  const couples = groupIntoCouples(personData);
  const generations = assignGenerations(personData, couples);

  // Group person ids by clusterId, excluding parked
  const clusterMembers = new Map();
  for (const [id, clusterId] of clusters.clusterByPerson) {
    if (parkedSet.has(id)) continue;
    if (!clusterMembers.has(clusterId)) clusterMembers.set(clusterId, new Set());
    clusterMembers.get(clusterId).add(id);
  }

  // Sort clusters by size, largest first
  const orderedClusterIds = Array.from(clusterMembers.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .map(([id]) => id);

  const nodes = new Map();
  let cursorX = 0;
  let chartMinY = Infinity;
  let chartMaxY = -Infinity;

  for (const clusterId of orderedClusterIds) {
    const members = clusterMembers.get(clusterId);
    const clusterPositions = layoutCluster(personData, couples, generations, members);
    if (clusterPositions.size === 0) continue;

    let localMinX = Infinity, localMaxX = -Infinity, localMinY = Infinity, localMaxY = -Infinity;
    for (const [, pos] of clusterPositions) {
      if (pos.x < localMinX) localMinX = pos.x;
      if (pos.x + pos.width > localMaxX) localMaxX = pos.x + pos.width;
      if (pos.y < localMinY) localMinY = pos.y;
      if (pos.y + pos.height > localMaxY) localMaxY = pos.y + pos.height;
    }

    const dx = cursorX - localMinX;
    for (const [pid, pos] of clusterPositions) {
      nodes.set(pid, {
        x: pos.x + dx,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        generation: generations.get(pid) ?? 0,
        clusterId,
        clanId: clanData?.clanByPerson.get(pid) ?? null,
        isParked: false
      });
    }
    if (localMinY < chartMinY) chartMinY = localMinY;
    if (localMaxY > chartMaxY) chartMaxY = localMaxY;
    cursorX += (localMaxX - localMinX) + CLUSTER_GAP;
  }

  if (!Number.isFinite(chartMinY)) { chartMinY = 0; chartMaxY = 0; }
  const chartMaxX = cursorX > 0 ? cursorX - CLUSTER_GAP : 0;

  const parkedIds = Array.from(parkedSet);
  const parking = layoutParking(
    parkedIds,
    personData,
    { minX: 0, minY: chartMinY, maxX: chartMaxX, maxY: chartMaxY }
  );
  if (parking) {
    for (const item of parking.items) {
      nodes.set(item.id, {
        x: item.x,
        y: item.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        generation: null,
        clusterId: null,
        clanId: clanData?.clanByPerson.get(item.id) ?? null,
        isParked: true
      });
    }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [, n] of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  return {
    nodes,
    edges: generateEdges(personData, nodes, options.lineOnlyConnections || []),
    parking,
    bounds: { minX, minY, maxX, maxY }
  };
}

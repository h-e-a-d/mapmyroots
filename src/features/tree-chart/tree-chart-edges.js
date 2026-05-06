// tree-chart-edges.js — Edge path string generation (pure)

import { ROW_HEIGHT } from './tree-chart-config.js';

/**
 * Generate SVG path strings for parent-child, spouse, and line-only edges.
 *
 * @param {Map<string, Person>} personData
 * @param {Map<string, { x, y, width, height, isParked }>} nodes
 * @param {Array<{ from: string, to: string }>} lineOnlyConnections
 * @returns {Array<{ fromId, toId, type, path }>}
 */
export function generateEdges(personData, nodes, lineOnlyConnections = []) {
  const edges = [];
  const seenSpouse = new Set();

  for (const [id, p] of personData) {
    const childNode = nodes.get(id);
    if (!childNode || childNode.isParked) continue;

    for (const parentId of [p.fatherId, p.motherId]) {
      if (!parentId) continue;
      const parentNode = nodes.get(parentId);
      if (!parentNode || parentNode.isParked) continue;
      edges.push({
        fromId: parentId,
        toId: id,
        type: 'parent',
        path: elbowPath(parentNode, childNode)
      });
    }

    if (p.spouseId) {
      const spouseNode = nodes.get(p.spouseId);
      if (spouseNode && !spouseNode.isParked) {
        const key = [id, p.spouseId].sort().join('|');
        if (!seenSpouse.has(key)) {
          seenSpouse.add(key);
          edges.push({
            fromId: id,
            toId: p.spouseId,
            type: 'spouse',
            path: spousePath(childNode, spouseNode)
          });
        }
      }
    }
  }

  for (const conn of lineOnlyConnections) {
    const a = nodes.get(conn.from);
    const b = nodes.get(conn.to);
    if (!a || !b || a.isParked || b.isParked) continue;
    edges.push({
      fromId: conn.from,
      toId: conn.to,
      type: 'lineOnly',
      path: directPath(a, b)
    });
  }

  return edges;
}

function elbowPath(parent, child) {
  const px = parent.x + parent.width / 2;
  const py = parent.y + parent.height;
  const cx = child.x + child.width / 2;
  const cy = child.y;
  const busY = py + (cy - py) / 2;
  return `M ${px} ${py} L ${px} ${busY} L ${cx} ${busY} L ${cx} ${cy}`;
}

function spousePath(a, b) {
  const ay = a.y + a.height / 2;
  const ax = a.x + (a.x < b.x ? a.width : 0);
  const bx = b.x + (b.x < a.x ? b.width : 0);
  return `M ${ax} ${ay} L ${bx} ${ay}`;
}

function directPath(a, b) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return `M ${ax} ${ay} L ${bx} ${by}`;
}

// tree-chart-edges.js — Edge path string generation (pure)

/**
 * Generate SVG path strings for parent-child, spouse, and line-only edges.
 *
 * @param {Map<string, Person>} personData
 * @param {Map<string, { x, y, width, height, isParked }>} nodes
 * @param {Array<{ from: string, to: string }>} lineOnlyConnections
 * @returns {Array<{ fromId, toId, type, path, dotX?, dotY?, fromId2? }>}
 */
export function generateEdges(personData, nodes, lineOnlyConnections = []) {
  const edges = [];
  const seenSpouse = new Set();

  for (const [id, p] of personData) {
    const childNode = nodes.get(id);
    if (!childNode || childNode.isParked) continue;

    const fatherNode = p.fatherId ? nodes.get(p.fatherId) : null;
    const motherNode = p.motherId ? nodes.get(p.motherId) : null;
    const fatherOk = fatherNode && !fatherNode.isParked;
    const motherOk = motherNode && !motherNode.isParked;

    const parentsAreCouple = fatherOk && motherOk && (
      personData.get(p.fatherId)?.spouseId === p.motherId ||
      personData.get(p.motherId)?.spouseId === p.fatherId
    );

    if (parentsAreCouple) {
      const mx = (fatherNode.x + fatherNode.width / 2 + motherNode.x + motherNode.width / 2) / 2;
      const my = fatherNode.y + fatherNode.height / 2;
      edges.push({
        fromId: p.fatherId,
        fromId2: p.motherId,
        toId: id,
        type: 'familyDrop',
        path: coupleDropPath(mx, my, childNode)
      });
    } else {
      if (fatherOk) {
        edges.push({ fromId: p.fatherId, toId: id, type: 'parent', path: elbowPath(fatherNode, childNode) });
      }
      if (motherOk) {
        edges.push({ fromId: p.motherId, toId: id, type: 'parent', path: elbowPath(motherNode, childNode) });
      }
    }

    if (p.spouseId) {
      const spouseNode = nodes.get(p.spouseId);
      if (spouseNode && !spouseNode.isParked) {
        const key = [id, p.spouseId].sort().join('|');
        if (!seenSpouse.has(key)) {
          seenSpouse.add(key);
          const dotX = (childNode.x + childNode.width / 2 + spouseNode.x + spouseNode.width / 2) / 2;
          const dotY = childNode.y + childNode.height / 2;
          edges.push({
            fromId: id,
            toId: p.spouseId,
            type: 'spouse',
            path: spousePath(childNode, spouseNode),
            dotX,
            dotY
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

function coupleDropPath(mx, my, child) {
  const cx = child.x + child.width / 2;
  const cy = child.y;
  const busY = my + (cy - my) / 2;
  return `M ${mx} ${my} L ${mx} ${busY} L ${cx} ${busY} L ${cx} ${cy}`;
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

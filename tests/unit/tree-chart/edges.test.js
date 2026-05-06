// tests/unit/tree-chart/edges.test.js
import { describe, it, expect } from 'vitest';
import { generateEdges } from '../../../src/features/tree-chart/tree-chart-edges.js';
import { person, buildPersonMap } from './fixtures.js';

function fakeNodes(entries) {
  const m = new Map();
  for (const [id, x, y] of entries) {
    m.set(id, { x, y, width: 100, height: 60, isParked: false });
  }
  return m;
}

describe('generateEdges', () => {
  it('produces a parent-child elbow edge', () => {
    const par = person({ id: 'par' });
    const child = person({ id: 'child', fatherId: 'par' });
    const personData = buildPersonMap([par, child]);
    const nodes = fakeNodes([['par', 0, 0], ['child', 0, 140]]);

    const edges = generateEdges(personData, nodes, []);

    const parentChild = edges.filter(e => e.type === 'parent');
    expect(parentChild.length).toBe(1);
    expect(parentChild[0].fromId).toBe('par');
    expect(parentChild[0].toId).toBe('child');
    expect(parentChild[0].path.startsWith('M')).toBe(true);
  });

  it('produces a spouse edge between adjacent partners', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const personData = buildPersonMap([a, b]);
    const nodes = fakeNodes([['a', 0, 0], ['b', 110, 0]]);

    const edges = generateEdges(personData, nodes, []);

    const spouse = edges.filter(e => e.type === 'spouse');
    expect(spouse.length).toBe(1);
  });

  it('produces line-only edges from passed line-only connections', () => {
    const a = person({ id: 'a' });
    const b = person({ id: 'b' });
    const personData = buildPersonMap([a, b]);
    const nodes = fakeNodes([['a', 0, 0], ['b', 200, 200]]);
    const lineOnlyConnections = [{ from: 'a', to: 'b' }];

    const edges = generateEdges(personData, nodes, lineOnlyConnections);

    const lineOnly = edges.filter(e => e.type === 'lineOnly');
    expect(lineOnly.length).toBe(1);
  });

  it('skips edges whose endpoints are in the parking area', () => {
    const par = person({ id: 'par' });
    const child = person({ id: 'child', fatherId: 'par' });
    const personData = buildPersonMap([par, child]);
    const nodes = fakeNodes([['par', 0, 0], ['child', 0, 140]]);
    nodes.get('child').isParked = true;

    const edges = generateEdges(personData, nodes, []);
    expect(edges.length).toBe(0);
  });
});

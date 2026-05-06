// tests/unit/tree-chart/layout.test.js
import { describe, it, expect } from 'vitest';
import { detectClusters } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { assignParking } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { groupIntoCouples } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { assignGenerations } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { layoutCluster } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { NODE_WIDTH, ROW_HEIGHT } from '../../../src/features/tree-chart/tree-chart-config.js';
import { person, buildPersonMap } from './fixtures.js';

describe('detectClusters', () => {
  it('treats marriage between two families as ONE cluster', () => {
    const johnDad = person({ id: 'johnDad' });
    const john = person({ id: 'john', fatherId: 'johnDad', spouseId: 'maria' });
    const mariaMom = person({ id: 'mariaMom' });
    const maria = person({ id: 'maria', motherId: 'mariaMom', spouseId: 'john' });
    const map = buildPersonMap([johnDad, john, mariaMom, maria]);

    const result = detectClusters(map);

    expect(result.clusterCount).toBe(1);
    const cluster = result.clusterByPerson.get('john');
    expect(result.clusterByPerson.get('maria')).toBe(cluster);
    expect(result.clusterByPerson.get('johnDad')).toBe(cluster);
    expect(result.clusterByPerson.get('mariaMom')).toBe(cluster);
  });

  it('keeps unrelated people in separate clusters', () => {
    const a = person({ id: 'a' });
    const b = person({ id: 'b' });
    const map = buildPersonMap([a, b]);
    const result = detectClusters(map);
    expect(result.clusterCount).toBe(2);
  });
});

describe('assignParking', () => {
  it('parks people with no relations and no children pointing to them', () => {
    const lone = person({ id: 'lone' });
    const inFamily = person({ id: 'inFamily' });
    const child = person({ id: 'child', fatherId: 'inFamily' });
    const map = buildPersonMap([lone, inFamily, child]);

    const parkedSet = assignParking(map);

    expect(parkedSet.has('lone')).toBe(true);
    expect(parkedSet.has('inFamily')).toBe(false);
    expect(parkedSet.has('child')).toBe(false);
  });

  it('does not park people with only a spouse', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const map = buildPersonMap([a, b]);

    const parkedSet = assignParking(map);

    expect(parkedSet.size).toBe(0);
  });
});

describe('groupIntoCouples', () => {
  it('produces one couple unit for a married pair', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const map = buildPersonMap([a, b]);

    const couples = groupIntoCouples(map);

    expect(couples.length).toBe(1);
    expect(couples[0].members).toEqual(expect.arrayContaining(['a', 'b']));
    expect(couples[0].id).toMatch(/^couple-/);
  });

  it('produces a singleton couple for an unmarried person', () => {
    const a = person({ id: 'a' });
    const map = buildPersonMap([a]);

    const couples = groupIntoCouples(map);

    expect(couples.length).toBe(1);
    expect(couples[0].members).toEqual(['a']);
  });

  it('handles a one-sided spouseId (B does not point back to A)', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b' }); // no spouseId back
    const map = new Map();
    map.set('a', a);
    map.set('b', b);

    const couples = groupIntoCouples(map);

    expect(couples.length).toBe(1);
    expect(couples[0].members).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('shares the same coupleByPerson Map instance across all couple entries', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const c = person({ id: 'c' });
    const map = buildPersonMap([a, b, c]);

    const couples = groupIntoCouples(map);

    expect(couples.length).toBe(2);
    // All entries share the same Map object reference
    expect(couples[0].coupleByPerson).toBe(couples[1].coupleByPerson);
  });
});

describe('assignGenerations', () => {
  it('places spouses on the same row, pulling the shallower spouse down', () => {
    const grandJ = person({ id: 'grandJ' });
    const dadJ = person({ id: 'dadJ', fatherId: 'grandJ' });
    const john = person({ id: 'john', fatherId: 'dadJ', spouseId: 'maria' });
    const momM = person({ id: 'momM' });
    const maria = person({ id: 'maria', motherId: 'momM', spouseId: 'john' });
    const map = buildPersonMap([grandJ, dadJ, john, momM, maria]);

    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    expect(gens.get('john')).toBe(gens.get('maria'));
    expect(gens.get('john')).toBe(2);
    expect(gens.get('maria')).toBe(2);
    expect(gens.get('momM')).toBe(1);
    expect(gens.get('dadJ')).toBe(1);
    expect(gens.get('grandJ')).toBe(0);
  });

  it('handles a cyclic data error by breaking the cycle and still assigning generations', () => {
    const a = person({ id: 'a', fatherId: 'b' });
    const b = person({ id: 'b', fatherId: 'a' });
    const map = buildPersonMap([a, b]);

    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    expect(Number.isFinite(gens.get('a'))).toBe(true);
    expect(Number.isFinite(gens.get('b'))).toBe(true);
  });

  it('pulls up multiple ancestor levels when shallower spouse has a 2-level chain', () => {
    // John's chain: greatGrandJ -> grandJ -> dadJ -> john (gen 3)
    // Maria's chain: mariaMom -> maria (gen 1 before merge)
    // After merge: maria must be at gen 3, mariaMom at gen 2
    const greatGrandJ = person({ id: 'greatGrandJ' });
    const grandJ = person({ id: 'grandJ', fatherId: 'greatGrandJ' });
    const dadJ = person({ id: 'dadJ', fatherId: 'grandJ' });
    const john = person({ id: 'john', fatherId: 'dadJ', spouseId: 'maria' });
    const mariaMom = person({ id: 'mariaMom' });
    const maria = person({ id: 'maria', motherId: 'mariaMom', spouseId: 'john' });
    const map = buildPersonMap([greatGrandJ, grandJ, dadJ, john, mariaMom, maria]);

    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    expect(gens.get('john')).toBe(gens.get('maria'));
    expect(gens.get('john')).toBe(3);
    expect(gens.get('mariaMom')).toBe(2);
    expect(gens.get('dadJ')).toBe(2);
    expect(gens.get('grandJ')).toBe(1);
    expect(gens.get('greatGrandJ')).toBe(0);
  });
});

describe('layoutCluster', () => {
  it('lays out a 3-generation chain top-down', () => {
    const grand = person({ id: 'grand' });
    const par = person({ id: 'par', fatherId: 'grand' });
    const child = person({ id: 'child', fatherId: 'par' });
    const map = buildPersonMap([grand, par, child]);
    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    const positions = layoutCluster(map, couples, gens, new Set([...map.keys()]));

    expect(positions.get('grand').y).toBeLessThan(positions.get('par').y);
    expect(positions.get('par').y).toBeLessThan(positions.get('child').y);
    expect(positions.get('par').y - positions.get('grand').y).toBe(ROW_HEIGHT);
  });

  it('places spouses adjacent at the same y', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const map = buildPersonMap([a, b]);
    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    const positions = layoutCluster(map, couples, gens, new Set(['a', 'b']));

    expect(positions.get('a').y).toBe(positions.get('b').y);
    expect(Math.abs(positions.get('a').x - positions.get('b').x)).toBeGreaterThan(0);
    expect(Math.abs(positions.get('a').x - positions.get('b').x)).toBeLessThanOrEqual(NODE_WIDTH * 2);
  });

  it('does not overlap two sibling subtrees', () => {
    const parent = person({ id: 'parent' });
    const c1 = person({ id: 'c1', fatherId: 'parent' });
    const c2 = person({ id: 'c2', fatherId: 'parent' });
    const g1a = person({ id: 'g1a', fatherId: 'c1' });
    const g1b = person({ id: 'g1b', fatherId: 'c1' });
    const g2a = person({ id: 'g2a', fatherId: 'c2' });
    const g2b = person({ id: 'g2b', fatherId: 'c2' });
    const map = buildPersonMap([parent, c1, c2, g1a, g1b, g2a, g2b]);
    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    const positions = layoutCluster(map, couples, gens, new Set([...map.keys()]));

    const right1 = Math.max(positions.get('g1a').x, positions.get('g1b').x);
    const left2 = Math.min(positions.get('g2a').x, positions.get('g2b').x);
    expect(right1 + NODE_WIDTH).toBeLessThanOrEqual(left2);
  });
});

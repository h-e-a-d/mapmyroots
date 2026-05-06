// tests/unit/tree-chart/layout.test.js
import { describe, it, expect } from 'vitest';
import { detectClusters } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { assignParking } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { groupIntoCouples } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { assignGenerations } from '../../../src/features/tree-chart/tree-chart-layout.js';
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
});

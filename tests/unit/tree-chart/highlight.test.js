// tests/unit/tree-chart/highlight.test.js
import { describe, it, expect } from 'vitest';
import { computeBloodLine } from '../../../src/features/tree-chart/tree-chart-highlight.js';
import { person, buildPersonMap } from './fixtures.js';

describe('computeBloodLine', () => {
  it('includes ancestors, descendants, and self', () => {
    const grand = person({ id: 'grand' });
    const par = person({ id: 'par', fatherId: 'grand' });
    const me = person({ id: 'me', fatherId: 'par' });
    const kid = person({ id: 'kid', fatherId: 'me' });
    const map = buildPersonMap([grand, par, me, kid]);

    const line = computeBloodLine('me', map);

    expect(line.has('me')).toBe(true);
    expect(line.has('par')).toBe(true);
    expect(line.has('grand')).toBe(true);
    expect(line.has('kid')).toBe(true);
  });

  it('excludes in-laws (spouses of ancestors who are not on the line)', () => {
    const grand = person({ id: 'grand' });
    const par = person({ id: 'par', fatherId: 'grand', spouseId: 'inLaw' });
    const inLaw = person({ id: 'inLaw', spouseId: 'par' });
    const me = person({ id: 'me', fatherId: 'par' });
    const map = buildPersonMap([grand, par, inLaw, me]);

    const line = computeBloodLine('me', map);

    expect(line.has('inLaw')).toBe(false);
  });

  it('excludes siblings of ancestors (great-aunts/uncles, cousins)', () => {
    const grand = person({ id: 'grand' });
    const par = person({ id: 'par', fatherId: 'grand' });
    const auntie = person({ id: 'auntie', fatherId: 'grand' });
    const me = person({ id: 'me', fatherId: 'par' });
    const cousin = person({ id: 'cousin', fatherId: 'auntie' });
    const map = buildPersonMap([grand, par, auntie, me, cousin]);

    const line = computeBloodLine('me', map);

    expect(line.has('auntie')).toBe(false);
    expect(line.has('cousin')).toBe(false);
  });

  it('handles a childless leaf — bloodline is ancestors + self', () => {
    const grand = person({ id: 'grand' });
    const me = person({ id: 'me', fatherId: 'grand' });
    const map = buildPersonMap([grand, me]);

    const line = computeBloodLine('me', map);

    expect(line.has('me')).toBe(true);
    expect(line.has('grand')).toBe(true);
    expect(line.size).toBe(2);
  });
});

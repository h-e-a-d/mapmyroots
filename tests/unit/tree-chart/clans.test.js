// tests/unit/tree-chart/clans.test.js
import { describe, it, expect } from 'vitest';
import { detectClans } from '../../../src/features/tree-chart/tree-chart-clans.js';
import { person, buildPersonMap, twoFamiliesPlusParked } from './fixtures.js';

describe('detectClans', () => {
  it('groups three unrelated families as three clans', () => {
    const a = person({ id: 'a' });
    const b = person({ id: 'b', fatherId: 'a' });
    const c = person({ id: 'c' });
    const d = person({ id: 'd', motherId: 'c' });
    const e = person({ id: 'e' });
    const map = buildPersonMap([a, b, c, d, e]);

    const result = detectClans(map);

    expect(result.clanCount).toBe(3);
    expect(result.clanByPerson.get('a')).toBe(result.clanByPerson.get('b'));
    expect(result.clanByPerson.get('c')).toBe(result.clanByPerson.get('d'));
    expect(result.clanByPerson.get('a')).not.toBe(result.clanByPerson.get('c'));
    expect(result.clanByPerson.get('e')).not.toBe(result.clanByPerson.get('a'));
  });
});

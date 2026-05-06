// tests/unit/tree-chart/clans.test.js
import { describe, it, expect } from 'vitest';
import { detectClans, assignClanColors } from '../../../src/features/tree-chart/tree-chart-clans.js';
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
    // clanSizes should have 3 entries
    expect(result.clanSizes.size).toBe(3);
    // Each person is in exactly one clan
    expect(result.clanSizes.get(result.clanByPerson.get('a'))).toBeGreaterThanOrEqual(1);
  });

  it('keeps two clans separate when only joined by marriage (no shared child)', () => {
    const john = person({ id: 'john', spouseId: 'maria' });
    const johnDad = person({ id: 'johnDad' });
    const maria = person({ id: 'maria', spouseId: 'john' });
    const mariaMom = person({ id: 'mariaMom' });
    john.fatherId = 'johnDad';
    maria.motherId = 'mariaMom';
    const map = buildPersonMap([john, johnDad, maria, mariaMom]);

    const result = detectClans(map);

    expect(result.clanCount).toBe(2);
    expect(result.clanByPerson.get('john')).toBe(result.clanByPerson.get('johnDad'));
    expect(result.clanByPerson.get('maria')).toBe(result.clanByPerson.get('mariaMom'));
    expect(result.clanByPerson.get('john')).not.toBe(result.clanByPerson.get('maria'));
  });

  it('merges two clans when they share a child', () => {
    const johnDad = person({ id: 'johnDad' });
    const john = person({ id: 'john', fatherId: 'johnDad' });
    const mariaMom = person({ id: 'mariaMom' });
    const maria = person({ id: 'maria', motherId: 'mariaMom' });
    const anna = person({ id: 'anna', fatherId: 'john', motherId: 'maria' });
    const map = buildPersonMap([johnDad, john, mariaMom, maria, anna]);

    const result = detectClans(map);

    expect(result.clanCount).toBe(1);
  });

  it('returns zero clans for an empty map', () => {
    const result = detectClans(new Map());
    expect(result.clanCount).toBe(0);
    expect(result.clanByPerson.size).toBe(0);
  });
});

describe('assignClanColors', () => {
  it('returns one stable color per clan, ordered by size descending', () => {
    const clanSizes = new Map([[0, 3], [1, 7], [2, 1]]);

    const colors = assignClanColors(clanSizes);

    expect(colors.size).toBe(3);
    const c0 = colors.get(0);
    const c1 = colors.get(1);
    const c2 = colors.get(2);
    expect(c0).toMatch(/^hsl\(/);
    expect(c1).toMatch(/^hsl\(/);
    expect(c2).toMatch(/^hsl\(/);
    // Largest clan (id=1) gets palette index 0 → hue 0
    expect(c1).toBe('hsl(0, 65%, 55%)');
    // Clan 0 (size=3) is 2nd largest → palette index 1 → hue = 137.508
    expect(c0).toBe('hsl(137.508, 65%, 55%)');
    // Clan 2 (size=1) is smallest → palette index 2 → hue = (2 * 137.508) % 360 = 275.016
    expect(c2).toBe('hsl(275.016, 65%, 55%)');
  });

  it('returns empty map for one clan or fewer', () => {
    expect(assignClanColors(new Map([[0, 5]])).size).toBe(0);
    expect(assignClanColors(new Map()).size).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { syncMarriages, makeMarriageId } from '../../src/utils/marriage-sync.js';

function person(id, marriages = []) {
  return { id, name: id, marriages };
}

describe('makeMarriageId', () => {
  it('returns a marr_-prefixed string', () => {
    expect(makeMarriageId()).toMatch(/^marr_[a-z0-9]+$/);
  });
});

describe('syncMarriages', () => {
  it('mirrors a new marriage onto the spouse', () => {
    const id = 'marr_x1';
    const a = person('A', [{ id, spouseId: 'B', date: null, place: 'Riga', note: '' }]);
    const all = new Map([['A', a], ['B', person('B')]]);
    const result = syncMarriages('A', a.marriages, [], all);
    expect(result.get('B').marriages).toEqual([{ id, spouseId: 'A', date: null, place: 'Riga', note: '' }]);
  });

  it('updates an existing mirror by marriage.id when date changes', () => {
    const id = 'marr_x1';
    const a = person('A', [{ id, spouseId: 'B', date: { year: 1956, estimated: false }, place: '', note: '' }]);
    const b = person('B', [{ id, spouseId: 'A', date: null, place: 'Riga', note: '' }]);
    const all = new Map([['A', a], ['B', b]]);
    const previous = [{ id, spouseId: 'B', date: null, place: 'Riga', note: '' }];
    const result = syncMarriages('A', a.marriages, previous, all);
    expect(result.get('B').marriages[0]).toEqual({ id, spouseId: 'A', date: { year: 1956, estimated: false }, place: 'Riga', note: '' });
  });

  it('removes the mirror when a marriage is deleted from A', () => {
    const id = 'marr_x1';
    const a = person('A', []);
    const b = person('B', [{ id, spouseId: 'A', date: null, place: '', note: '' }]);
    const all = new Map([['A', a], ['B', b]]);
    const previous = [{ id, spouseId: 'B', date: null, place: '', note: '' }];
    const result = syncMarriages('A', a.marriages, previous, all);
    expect(result.get('B').marriages).toEqual([]);
  });

  it('removes the old mirror and creates a new one when spouse changes', () => {
    const id = 'marr_x1';
    const a = person('A', [{ id, spouseId: 'C', date: null, place: '', note: '' }]);
    const b = person('B', [{ id, spouseId: 'A', date: null, place: '', note: '' }]);
    const c = person('C', []);
    const all = new Map([['A', a], ['B', b], ['C', c]]);
    const previous = [{ id, spouseId: 'B', date: null, place: '', note: '' }];
    const result = syncMarriages('A', a.marriages, previous, all);
    expect(result.get('B').marriages).toEqual([]);
    expect(result.get('C').marriages).toEqual([{ id, spouseId: 'A', date: null, place: '', note: '' }]);
  });

  it('does not mirror marriages with empty spouseId', () => {
    const id = 'marr_x1';
    const a = person('A', [{ id, spouseId: '', date: null, place: 'Unknown', note: '' }]);
    const all = new Map([['A', a]]);
    const result = syncMarriages('A', a.marriages, [], all);
    expect(result.size).toBe(0);
  });

  it('handles two simultaneous marriages on A to different spouses', () => {
    const m1 = { id: 'm1', spouseId: 'B', date: null, place: '', note: '' };
    const m2 = { id: 'm2', spouseId: 'C', date: { year: 1970, estimated: false }, place: '', note: '' };
    const a = person('A', [m1, m2]);
    const all = new Map([['A', a], ['B', person('B')], ['C', person('C')]]);
    const result = syncMarriages('A', a.marriages, [], all);
    expect(result.get('B').marriages).toEqual([{ ...m1, spouseId: 'A' }]);
    expect(result.get('C').marriages).toEqual([{ ...m2, spouseId: 'A' }]);
  });
});

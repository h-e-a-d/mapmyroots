import { describe, it, expect } from 'vitest';
import { migrateToV22 } from '../../src/data/migrations/v2.2-rich-events.js';

const baseFile = (persons) => ({
  version: '2.1.0',
  cacheFormat: 'enhanced',
  persons,
  fontSettings: {},
  canvasState: {}
});

describe('migrateToV22', () => {
  it('parses legacy dob "30.10.1906" into birth.date', () => {
    const file = baseFile([{ id: 'p1', name: 'A', dob: '30.10.1906' }]);
    const out = migrateToV22(file);
    expect(out.persons[0].birth.date).toEqual({ year: 1906, month: 10, day: 30, estimated: false });
  });

  it('parses year-only dob "1906" into year-only birth.date', () => {
    const file = baseFile([{ id: 'p1', name: 'A', dob: '1906' }]);
    const out = migrateToV22(file);
    expect(out.persons[0].birth.date).toEqual({ year: 1906, estimated: false });
  });

  it('preserves unparseable dob into birth.note as "Original: ..."', () => {
    const file = baseFile([{ id: 'p1', name: 'A', dob: 'ca. 1895' }]);
    const out = migrateToV22(file);
    expect(out.persons[0].birth.date).toBeNull();
    expect(out.persons[0].birth.note).toBe('Original: ca. 1895');
  });

  it('initialises empty event objects when dob is absent', () => {
    const file = baseFile([{ id: 'p1', name: 'A' }]);
    const out = migrateToV22(file);
    expect(out.persons[0].birth).toEqual({ date: null, place: '', note: '' });
    expect(out.persons[0].death).toEqual({ date: null, place: '', note: '' });
    expect(out.persons[0].marriages).toEqual([]);
    expect(out.persons[0].notes).toBe('');
  });

  it('migrates legacy spouseId into marriages[0] with stable id', () => {
    const file = baseFile([
      { id: 'p1', name: 'A', spouseId: 'p2' },
      { id: 'p2', name: 'B', spouseId: 'p1' }
    ]);
    const out = migrateToV22(file);
    expect(out.persons[0].marriages).toHaveLength(1);
    expect(out.persons[0].marriages[0]).toMatchObject({ spouseId: 'p2', date: null, place: '', note: '' });
    expect(out.persons[0].marriages[0].id).toMatch(/^marr_/);
  });

  it('bumps version to 2.2.0', () => {
    const file = baseFile([{ id: 'p1', name: 'A' }]);
    const out = migrateToV22(file);
    expect(out.version).toBe('2.2.0');
  });

  it('is idempotent — running twice produces the same result', () => {
    const file = baseFile([{ id: 'p1', name: 'A', dob: '1906', spouseId: 'p2' }, { id: 'p2', name: 'B', spouseId: 'p1' }]);
    const once = migrateToV22(file);
    const twice = migrateToV22(once);
    expect(twice).toEqual(once);
  });

  it('returns input unchanged when version is already >= 2.2.0', () => {
    const file = { ...baseFile([{ id: 'p1', name: 'A' }]), version: '2.2.0' };
    file.persons[0].birth = { date: null, place: '', note: '' };
    file.persons[0].death = { date: null, place: '', note: '' };
    file.persons[0].marriages = [];
    file.persons[0].notes = '';
    const out = migrateToV22(file);
    expect(out).toEqual(file);
  });
});

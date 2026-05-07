import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importFromGedcom } from '../../../../src/features/import/gedcom-importer.js';

const fixture = (name) =>
  readFileSync(join(import.meta.dirname, '../../../fixtures/gedcom', name), 'utf-8');

describe('importFromGedcom', () => {
  it('returns persons array from tiny.ged', () => {
    const { persons } = importFromGedcom(fixture('tiny.ged'));
    expect(persons).toHaveLength(3);
  });

  it('maps given name and surname correctly', () => {
    const { persons } = importFromGedcom(fixture('tiny.ged'));
    const john = persons.find(p => p.name === 'John');
    expect(john).toBeDefined();
    expect(john.surname).toBe('Smith');
  });

  it('maps gender M → male, F → female', () => {
    const { persons } = importFromGedcom(fixture('tiny.ged'));
    expect(persons.find(p => p.name === 'John')?.gender).toBe('male');
    expect(persons.find(p => p.name === 'Mary')?.gender).toBe('female');
  });

  it('links child fatherId and motherId from FAM record', () => {
    const { persons } = importFromGedcom(fixture('tiny.ged'));
    const james = persons.find(p => p.name === 'James');
    expect(james?.fatherId).toBeTruthy();
    expect(james?.motherId).toBeTruthy();
  });

  it('links spouseId between husband and wife', () => {
    const { persons } = importFromGedcom(fixture('tiny.ged'));
    const john = persons.find(p => p.name === 'John');
    const mary = persons.find(p => p.name === 'Mary');
    expect(john?.spouseId).toBe(mary?.id);
    expect(mary?.spouseId).toBe(john?.id);
  });

  it('preserves ABT date qualifiers', () => {
    const { persons } = importFromGedcom(fixture('edge-cases.ged'));
    const pierre = persons.find(p => p.name === 'Pierre');
    expect(pierre?.birth?.date?.estimated).toBe(true);
  });

  it('preserves BEF date qualifiers', () => {
    const { persons } = importFromGedcom(fixture('edge-cases.ged'));
    const heinrich = persons.find(p => p.name === 'Heinrich');
    expect(heinrich?.birth?.date?.year).toBeDefined();
    expect(heinrich?.birth?.date?.estimated).toBe(true);
  });

  it('handles missing SEX tag gracefully (empty gender)', () => {
    const { persons } = importFromGedcom(fixture('edge-cases.ged'));
    const noSex = persons.find(p => p.gender === '');
    expect(noSex).toBeDefined();
  });

  it('returns warnings array (may be empty)', () => {
    const { warnings } = importFromGedcom(fixture('tiny.ged'));
    expect(Array.isArray(warnings)).toBe(true);
  });

  it('assigns a stable unique id to each person', () => {
    const { persons } = importFromGedcom(fixture('tiny.ged'));
    const ids = persons.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('parses medium.ged with 10 persons', () => {
    const { persons } = importFromGedcom(fixture('medium.ged'));
    expect(persons).toHaveLength(10);
  });

  it('links multiple children in medium.ged', () => {
    const { persons } = importFromGedcom(fixture('medium.ged'));
    const robert = persons.find(p => p.name === 'Robert');
    const william = persons.find(p => p.name === 'William');
    const susan = persons.find(p => p.name === 'Susan');
    expect(william?.fatherId).toBe(robert?.id);
    expect(susan?.fatherId).toBe(robert?.id);
  });

  it('handles special characters in name (François /Müller/)', () => {
    const { persons } = importFromGedcom(fixture('edge-cases.ged'));
    const francois = persons.find(p => p.name === 'François');
    expect(francois).toBeDefined();
    expect(francois?.surname).toBe('Müller');
  });

  it('handles FAM with only one spouse (no crash)', () => {
    const result = importFromGedcom(fixture('edge-cases.ged'));
    expect(result.persons).toBeDefined();
  });

  it('first spouse wins for multiple marriages', () => {
    const { persons } = importFromGedcom(fixture('edge-cases.ged'));
    const francois = persons.find(p => p.name === 'François');
    const anne = persons.find(p => p.name === 'Anne');
    expect(francois?.spouseId).toBe(anne?.id);
  });
});

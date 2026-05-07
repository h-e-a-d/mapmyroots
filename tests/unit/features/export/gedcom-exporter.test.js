import { describe, it, expect } from 'vitest';
import { generateGEDCOMText } from '../../../../src/features/export/exporter.js';

const base = (overrides = {}) => ({
  id: 'p1',
  name: 'John',
  surname: 'Smith',
  fatherName: '',
  maidenName: '',
  gender: 'male',
  motherId: '',
  fatherId: '',
  spouseId: '',
  birth: { date: null, place: '', note: '' },
  death: { date: null, place: '', note: '' },
  marriages: [],
  notes: '',
  ...overrides,
});

describe('generateGEDCOMText', () => {
  it('emits HEAD and TRLR', () => {
    const ged = generateGEDCOMText([]);
    expect(ged).toContain('0 HEAD');
    expect(ged).toContain('0 TRLR');
  });

  it('emits INDI record with NAME for each person', () => {
    const ged = generateGEDCOMText([base()]);
    expect(ged).toContain('INDI');
    expect(ged).toContain('1 NAME John /Smith/');
  });

  it('emits SEX M for male', () => {
    const ged = generateGEDCOMText([base({ gender: 'male' })]);
    expect(ged).toContain('1 SEX M');
  });

  it('emits SEX F for female', () => {
    const ged = generateGEDCOMText([base({ gender: 'female' })]);
    expect(ged).toContain('1 SEX F');
  });

  it('emits BIRT DATE for year-only birth date', () => {
    const ged = generateGEDCOMText([base({ birth: { date: { year: 1920 }, place: '', note: '' } })]);
    expect(ged).toContain('1 BIRT');
    expect(ged).toContain('2 DATE 1920');
  });

  it('emits full BIRT DATE with day and month', () => {
    const ged = generateGEDCOMText([base({ birth: { date: { year: 1920, month: 6, day: 15 }, place: '', note: '' } })]);
    expect(ged).toContain('2 DATE 15 JUN 1920');
  });

  it('emits ABT prefix for estimated birth date', () => {
    const ged = generateGEDCOMText([base({ birth: { date: { year: 1920, estimated: true }, place: '', note: '' } })]);
    expect(ged).toContain('2 DATE ABT 1920');
  });

  it('emits BIRT PLAC when birth place is set', () => {
    const ged = generateGEDCOMText([base({ birth: { date: { year: 1920 }, place: 'Paris', note: '' } })]);
    expect(ged).toContain('2 PLAC Paris');
  });

  it('emits BIRT NOTE when birth note is set', () => {
    const ged = generateGEDCOMText([base({ birth: { date: null, place: '', note: 'Twin birth' } })]);
    expect(ged).toContain('1 BIRT');
    expect(ged).toContain('2 NOTE Twin birth');
  });

  it('emits no BIRT when birth is empty', () => {
    const ged = generateGEDCOMText([base()]);
    expect(ged).not.toContain('1 BIRT');
  });

  it('emits DEAT block with date and place', () => {
    const ged = generateGEDCOMText([base({ death: { date: { year: 1980, month: 3, day: 10 }, place: 'London', note: '' } })]);
    expect(ged).toContain('1 DEAT');
    expect(ged).toContain('2 DATE 10 MAR 1980');
    expect(ged).toContain('2 PLAC London');
  });

  it('emits DEAT NOTE when death note is set', () => {
    const ged = generateGEDCOMText([base({ death: { date: null, place: '', note: 'In battle' } })]);
    expect(ged).toContain('1 DEAT');
    expect(ged).toContain('2 NOTE In battle');
  });

  it('emits no DEAT when death is empty', () => {
    const ged = generateGEDCOMText([base()]);
    expect(ged).not.toContain('1 DEAT');
  });

  it('emits FAM block for a married couple', () => {
    const husband = base({ id: 'p1', gender: 'male', marriages: [{ id: 'marr_1', spouseId: 'p2', date: null, place: '', note: '' }] });
    const wife = base({ id: 'p2', name: 'Jane', gender: 'female', marriages: [{ id: 'marr_1', spouseId: 'p1', date: null, place: '', note: '' }] });
    const ged = generateGEDCOMText([husband, wife]);
    expect(ged).toContain('FAM');
    expect(ged).toMatch(/1 HUSB @I\d+@/);
    expect(ged).toMatch(/1 WIFE @I\d+@/);
  });

  it('emits MARR DATE in FAM when marriage date is set', () => {
    const husband = base({ id: 'p1', gender: 'male', marriages: [{ id: 'marr_1', spouseId: 'p2', date: { year: 1950 }, place: '', note: '' }] });
    const wife = base({ id: 'p2', name: 'Jane', gender: 'female', marriages: [{ id: 'marr_1', spouseId: 'p1', date: { year: 1950 }, place: '', note: '' }] });
    const ged = generateGEDCOMText([husband, wife]);
    expect(ged).toContain('1 MARR');
    expect(ged).toContain('2 DATE 1950');
  });

  it('emits MARR PLAC in FAM when marriage place is set', () => {
    const husband = base({ id: 'p1', gender: 'male', marriages: [{ id: 'marr_1', spouseId: 'p2', date: null, place: 'Rome', note: '' }] });
    const wife = base({ id: 'p2', name: 'Jane', gender: 'female', marriages: [{ id: 'marr_1', spouseId: 'p1', date: null, place: 'Rome', note: '' }] });
    const ged = generateGEDCOMText([husband, wife]);
    expect(ged).toContain('1 MARR');
    expect(ged).toContain('2 PLAC Rome');
  });

  it('deduplicates FAM records using marriage.id', () => {
    const husband = base({ id: 'p1', gender: 'male', marriages: [{ id: 'marr_1', spouseId: 'p2', date: null, place: '', note: '' }] });
    const wife = base({ id: 'p2', name: 'Jane', gender: 'female', marriages: [{ id: 'marr_1', spouseId: 'p1', date: null, place: '', note: '' }] });
    const ged = generateGEDCOMText([husband, wife]);
    const famCount = ged.split('\n').filter(l => l.endsWith(' FAM')).length;
    expect(famCount).toBe(1);
  });

  it('emits CHIL in FAM for children with matching parents', () => {
    const father = base({ id: 'p1', gender: 'male', marriages: [{ id: 'marr_1', spouseId: 'p2', date: null, place: '', note: '' }] });
    const mother = base({ id: 'p2', name: 'Jane', gender: 'female', marriages: [{ id: 'marr_1', spouseId: 'p1', date: null, place: '', note: '' }] });
    const child = base({ id: 'p3', name: 'Billy', fatherId: 'p1', motherId: 'p2' });
    const ged = generateGEDCOMText([father, mother, child]);
    expect(ged).toContain('1 CHIL');
  });
});

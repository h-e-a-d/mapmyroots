import { describe, it, expect } from 'vitest';
import { parseDateValue, isValidDateValue } from '../../src/utils/date-value.js';

describe('parseDateValue', () => {
  it('parses dd.mm.yyyy into a full DateValue', () => {
    expect(parseDateValue('30.10.1906')).toEqual({ year: 1906, month: 10, day: 30, estimated: false });
  });

  it('parses dd/mm/yyyy and dd-mm-yyyy with the same result', () => {
    const expected = { year: 1906, month: 10, day: 30, estimated: false };
    expect(parseDateValue('30/10/1906')).toEqual(expected);
    expect(parseDateValue('30-10-1906')).toEqual(expected);
  });

  it('parses yyyy-only into a year-only DateValue', () => {
    expect(parseDateValue('1906')).toEqual({ year: 1906, estimated: false });
  });

  it('strips leading zeros and surrounding whitespace', () => {
    expect(parseDateValue('  05.06.1899 ')).toEqual({ year: 1899, month: 6, day: 5, estimated: false });
  });

  it('returns null for empty or whitespace input', () => {
    expect(parseDateValue('')).toBeNull();
    expect(parseDateValue('   ')).toBeNull();
    expect(parseDateValue(null)).toBeNull();
    expect(parseDateValue(undefined)).toBeNull();
  });

  it('returns { error: true } sentinel for unparseable input', () => {
    expect(parseDateValue('ca. 1895')).toEqual({ error: true, raw: 'ca. 1895' });
    expect(parseDateValue('garbage')).toEqual({ error: true, raw: 'garbage' });
    expect(parseDateValue('32.13.1900')).toEqual({ error: true, raw: '32.13.1900' });
  });

  it('preserves estimated flag when provided in options', () => {
    expect(parseDateValue('1906', { estimated: true })).toEqual({ year: 1906, estimated: true });
  });
});

describe('isValidDateValue', () => {
  it('accepts null', () => {
    expect(isValidDateValue(null)).toBe(true);
  });

  it('accepts year-only and full DateValue objects', () => {
    expect(isValidDateValue({ year: 1906, estimated: false })).toBe(true);
    expect(isValidDateValue({ year: 1906, month: 10, day: 30, estimated: true })).toBe(true);
  });

  it('rejects error sentinel', () => {
    expect(isValidDateValue({ error: true, raw: 'foo' })).toBe(false);
  });

  it('rejects half-dates (year+month-only or year+day-only)', () => {
    expect(isValidDateValue({ year: 1906, month: 10, estimated: false })).toBe(false);
    expect(isValidDateValue({ year: 1906, day: 30, estimated: false })).toBe(false);
  });
});

const FULL_DATE_RE = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$|^(\d{1,2})-(\d{1,2})-(\d{4})$/;
const YEAR_ONLY_RE = /^(\d{4})$/;

export function parseDateValue(input, options = {}) {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (trimmed === '') return null;

  const estimated = Boolean(options.estimated);

  const fullMatch = trimmed.match(FULL_DATE_RE);
  if (fullMatch) {
    const day = parseInt(fullMatch[1] ?? fullMatch[4], 10);
    const month = parseInt(fullMatch[2] ?? fullMatch[5], 10);
    const year = parseInt(fullMatch[3] ?? fullMatch[6], 10);
    if (
      day >= 1 && day <= 31 &&
      month >= 1 && month <= 12 &&
      year >= 1 && year <= 9999
    ) {
      return { year, month, day, estimated };
    }
    return { error: true, raw: trimmed };
  }

  const yearMatch = trimmed.match(YEAR_ONLY_RE);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    return { year, estimated };
  }

  return { error: true, raw: trimmed };
}

export function isValidDateValue(value) {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  if (value.error) return false;
  if (typeof value.year !== 'number') return false;

  const hasMonth = typeof value.month === 'number';
  const hasDay = typeof value.day === 'number';
  if (hasMonth !== hasDay) return false;

  return true;
}

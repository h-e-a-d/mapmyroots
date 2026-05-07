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

const MONTH_SHORT = {
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  de: ['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sept.','Okt.','Nov.','Dez.'],
  es: ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sept.','oct.','nov.','dic.'],
  ru: ['янв.','февр.','мар.','апр.','мая','июня','июля','авг.','сент.','окт.','нояб.','дек.']
};

const ESTIMATED_PREFIX = {
  en: 'est.',
  de: 'ca.',
  es: 'aprox.',
  ru: 'ок.'
};

const FULL_DATE_FORMAT = {
  en: (d, m, y) => `${d} ${m} ${y}`,
  de: (d, m, y) => `${d}. ${m} ${y}`,
  es: (d, m, y) => `${d} ${m} ${y}`,
  ru: (d, m, y) => `${d} ${m} ${y}`
};

function pickLocale(locale) {
  return MONTH_SHORT[locale] ? locale : 'en';
}

export function formatDateValue(value, locale = 'en') {
  if (!value || value.error) return '';
  const loc = pickLocale(locale);
  const prefix = value.estimated ? `${ESTIMATED_PREFIX[loc]} ` : '';

  const hasFull = typeof value.month === 'number' && typeof value.day === 'number';
  if (hasFull) {
    const monthName = MONTH_SHORT[loc][value.month - 1];
    return prefix + FULL_DATE_FORMAT[loc](value.day, monthName, value.year);
  }
  return prefix + String(value.year);
}

function yearOnly(value, loc) {
  if (!value || value.error) return '';
  const prefix = value.estimated ? `${ESTIMATED_PREFIX[loc]} ` : '';
  return prefix + String(value.year);
}

export function formatLifespanShort(birth, death, locale = 'en') {
  const loc = pickLocale(locale);
  const b = yearOnly(birth, loc);
  const d = yearOnly(death, loc);
  if (!b && !d) return '';
  if (b && !d) return b;
  if (!b && d) return `– ${d}`;
  return `${b} – ${d}`;
}

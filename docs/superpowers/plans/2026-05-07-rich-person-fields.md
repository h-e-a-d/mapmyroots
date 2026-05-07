# Rich Person Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add structured birth/death dates with locations, multi-marriage support with bidirectional auto-fill, per-event notes, and minimal canvas/tree-chart rendering for the new data.

**Architecture:** Vanilla JavaScript ES modules, additive schema migration (`2.1.0 → 2.2.0`), reusable `<date-input>` and `inline-reveal` UI primitives, marriage rows mirrored across spouse pairs by stable `marriage.id`. Card rendering changes are additive — birth–death range replaces the dob subline; marriage year sits as a label on the spouse connector.

**Tech Stack:** ES modules, Astro pages, Vitest+jsdom for unit tests, Playwright for E2E, Canvas API for tree view, SVG for tree-chart view, IndexedDB+LocalStorage for persistence, GEDCOM 5.5 for round-trip.

**Spec:** [`docs/superpowers/specs/2026-05-07-rich-person-fields-design.md`](../specs/2026-05-07-rich-person-fields-design.md)

---

## File Structure

### New files
- `src/utils/date-value.js` — `DateValue` parser/formatter, `formatLifespanShort` helper
- `src/ui/components/inline-reveal.js` — `+ add X` link → reveal helper
- `src/ui/components/date-input.js` — date-with-estimated input component
- `src/ui/components/marriage-row.js` — one row of the marriages list, owns auto-fill behaviour
- `src/ui/components/marriages-list.js` — manages marriage rows (add/remove)
- `src/data/migrations/v2.2-rich-events.js` — schema migration `2.1.0 → 2.2.0`
- `tests/unit/date-value.test.js`
- `tests/unit/migration-v2.2.test.js`
- `tests/unit/marriage-sync.test.js`
- `testing/tests/person-modal-rich-fields.spec.js`

### Modified files
- `src/pages/builder.astro` — modal HTML (new fields, reveal links, marriages section)
- `src/styles/modal.css` — new field, reveal-link, and marriage-row styles
- `src/ui/modals/modal.js` — populate/clear/save flow uses new components
- `src/core/tree-engine.js` — `handleSavePersonFromModal` schema, marriage bidirectional sync, derived `spouseId` recompute
- `src/core/canvas-renderer.js` — birth–death subline, marriage date label on spouse connector
- `src/features/tree-chart/tree-chart-renderer.js` — birth–death subline, marriage date label
- `src/features/import/gedcom-importer.js` — extract `PLAC`, `NOTE`, `MARR` events
- `src/features/export/exporter.js` — emit `PLAC`, `NOTE`, full `DEAT`, `MARR`
- `public/assets/locales/en.json`, `es.json`, `ru.json`, `de.json` — new keys (all four)

---

## Task 1: `DateValue` type and parser

**Files:**
- Create: `src/utils/date-value.js`
- Test: `tests/unit/date-value.test.js`

Defines a `DateValue` shape and a parser that accepts `dd.mm.yyyy`, `dd/mm/yyyy`, `dd-mm-yyyy`, and `yyyy`. Returns `null` for empty input and an `Error`-flagged sentinel for unparseable input so callers can surface validation feedback.

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/date-value.test.js
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
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/date-value.test.js`
Expected: FAIL — `parseDateValue is not a function` and `isValidDateValue is not a function`.

- [ ] **Step 3: Implement minimal `parseDateValue` + `isValidDateValue`**

```js
// src/utils/date-value.js

const FULL_DATE_RE = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/;
const YEAR_ONLY_RE = /^(\d{4})$/;

export function parseDateValue(input, options = {}) {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (trimmed === '') return null;

  const estimated = Boolean(options.estimated);

  const fullMatch = trimmed.match(FULL_DATE_RE);
  if (fullMatch) {
    const day = parseInt(fullMatch[1], 10);
    const month = parseInt(fullMatch[2], 10);
    const year = parseInt(fullMatch[3], 10);
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
  if (hasMonth !== hasDay) return false; // half-dates not allowed

  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/date-value.test.js`
Expected: PASS, all parse + validity tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/date-value.js tests/unit/date-value.test.js
git commit -m "feat(date-value): add DateValue parser and validator"
```

---

## Task 2: `formatDateValue` and `formatLifespanShort`

**Files:**
- Modify: `src/utils/date-value.js`
- Modify: `tests/unit/date-value.test.js`

Display formatters for `DateValue`. `formatDateValue(dv, locale)` returns the human-readable string ("30 Oct 1906", "est. 1906"). `formatLifespanShort(birth, death, locale)` returns the card subline ("1895 – 1956"). Locale resolves via short month names; fallback locale is `en`.

- [ ] **Step 1: Append failing tests**

```js
// tests/unit/date-value.test.js — APPEND to existing imports
import { formatDateValue, formatLifespanShort } from '../../src/utils/date-value.js';

describe('formatDateValue', () => {
  it('returns empty string for null', () => {
    expect(formatDateValue(null, 'en')).toBe('');
  });

  it('formats year-only DateValue', () => {
    expect(formatDateValue({ year: 1906, estimated: false }, 'en')).toBe('1906');
  });

  it('formats full DateValue in English short month form', () => {
    expect(formatDateValue({ year: 1906, month: 10, day: 30, estimated: false }, 'en')).toBe('30 Oct 1906');
  });

  it('prefixes "est." for estimated English', () => {
    expect(formatDateValue({ year: 1906, estimated: true }, 'en')).toBe('est. 1906');
    expect(formatDateValue({ year: 1906, month: 10, day: 30, estimated: true }, 'en')).toBe('est. 30 Oct 1906');
  });

  it('uses the German prefix and month forms', () => {
    expect(formatDateValue({ year: 1906, estimated: true }, 'de')).toBe('ca. 1906');
    expect(formatDateValue({ year: 1906, month: 10, day: 30, estimated: false }, 'de')).toBe('30. Okt. 1906');
  });

  it('falls back to English when locale is unknown', () => {
    expect(formatDateValue({ year: 1906, month: 10, day: 30, estimated: false }, 'xx')).toBe('30 Oct 1906');
  });
});

describe('formatLifespanShort', () => {
  it('returns empty string when both dates are null', () => {
    expect(formatLifespanShort(null, null, 'en')).toBe('');
  });

  it('returns birth year only when death is null', () => {
    expect(formatLifespanShort({ year: 1895, estimated: false }, null, 'en')).toBe('1895');
  });

  it('returns "– deathYear" when birth is null', () => {
    expect(formatLifespanShort(null, { year: 1956, estimated: false }, 'en')).toBe('– 1956');
  });

  it('joins both years with an en-dash', () => {
    expect(formatLifespanShort(
      { year: 1895, estimated: false },
      { year: 1956, estimated: false },
      'en'
    )).toBe('1895 – 1956');
  });

  it('prefixes "est." per side independently', () => {
    expect(formatLifespanShort(
      { year: 1895, estimated: true },
      { year: 1956, estimated: false },
      'en'
    )).toBe('est. 1895 – 1956');
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/date-value.test.js`
Expected: FAIL — `formatDateValue` and `formatLifespanShort` not exported.

- [ ] **Step 3: Implement formatters**

Append to `src/utils/date-value.js`:

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/date-value.test.js`
Expected: PASS, all parse + validity + format + lifespan tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/date-value.js tests/unit/date-value.test.js
git commit -m "feat(date-value): add formatDateValue and formatLifespanShort"
```

---

## Task 3: Schema migration `v2.2-rich-events`

**Files:**
- Create: `src/data/migrations/v2.2-rich-events.js`
- Test: `tests/unit/migration-v2.2.test.js`

Idempotent migration that adds `birth`, `death`, `marriages`, `notes` to every person, parses legacy `dob` into `birth.date`, and pushes legacy `spouseId` into `marriages[0]`.

- [ ] **Step 1: Write failing tests**

```js
// tests/unit/migration-v2.2.test.js
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
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/migration-v2.2.test.js`
Expected: FAIL — `migrateToV22 is not a function`.

- [ ] **Step 3: Implement migration**

```js
// src/data/migrations/v2.2-rich-events.js
import { parseDateValue } from '../../utils/date-value.js';

const TARGET_VERSION = '2.2.0';

function makeMarriageId() {
  return `marr_${Math.random().toString(36).slice(2, 10)}`;
}

function migratePerson(person) {
  if (!person || typeof person !== 'object') return person;

  const out = { ...person };

  // Birth
  if (!out.birth || typeof out.birth !== 'object') {
    let birthDate = null;
    let birthNote = '';
    const rawDob = typeof out.dob === 'string' ? out.dob.trim() : '';
    if (rawDob) {
      const parsed = parseDateValue(rawDob);
      if (parsed && !parsed.error) {
        birthDate = parsed;
      } else {
        birthNote = `Original: ${rawDob}`;
      }
    }
    out.birth = { date: birthDate, place: '', note: birthNote };
  }

  // Death
  if (!out.death || typeof out.death !== 'object') {
    out.death = { date: null, place: '', note: '' };
  }

  // Marriages
  if (!Array.isArray(out.marriages)) {
    out.marriages = [];
  }
  if (out.marriages.length === 0 && typeof out.spouseId === 'string' && out.spouseId.trim()) {
    out.marriages.push({
      id: makeMarriageId(),
      spouseId: out.spouseId,
      date: null,
      place: '',
      note: ''
    });
  }

  // General notes
  if (typeof out.notes !== 'string') {
    out.notes = '';
  }

  return out;
}

export function migrateToV22(file) {
  if (!file || typeof file !== 'object') return file;
  const version = file.version || '0.0.0';
  if (compareVersions(version, TARGET_VERSION) >= 0) return file;

  const persons = Array.isArray(file.persons) ? file.persons.map(migratePerson) : [];

  return { ...file, version: TARGET_VERSION, persons };
}

function compareVersions(a, b) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) - (pb[i] || 0);
  }
  return 0;
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/migration-v2.2.test.js`
Expected: PASS, all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/data/migrations/v2.2-rich-events.js tests/unit/migration-v2.2.test.js
git commit -m "feat(migration): add v2.2 migration parsing dob and spouseId into rich events"
```

---

## Task 4: `inline-reveal` helper

**Files:**
- Create: `src/ui/components/inline-reveal.js`

Tiny imperative helper (no test) — wires a "+ add X" link to hide itself and reveal a hidden field. Used by birth/death place+note, marriage place+note, and the general notes block.

- [ ] **Step 1: Implement**

```js
// src/ui/components/inline-reveal.js
// Wires a trigger link to reveal a hidden field. Auto-reveals if the field has a non-empty value at setup time.

export function setupInlineReveal({ trigger, target, focusOnReveal = true }) {
  if (!trigger || !target) return;

  const reveal = () => {
    target.hidden = false;
    target.removeAttribute('aria-hidden');
    trigger.hidden = true;
    if (focusOnReveal) {
      const focusTarget = target.matches('input, textarea, select, button')
        ? target
        : target.querySelector('input, textarea, select, button');
      focusTarget?.focus();
    }
  };

  // Auto-reveal if pre-populated
  if (hasValue(target)) {
    reveal();
  } else {
    target.hidden = true;
    target.setAttribute('aria-hidden', 'true');
    trigger.hidden = false;
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    reveal();
  });
}

function hasValue(target) {
  const inputs = target.matches('input, textarea')
    ? [target]
    : target.querySelectorAll('input, textarea');
  for (const el of inputs) {
    if (el.value && el.value.trim() !== '') return true;
    if (el.type === 'checkbox' && el.checked) return true;
  }
  return false;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/inline-reveal.js
git commit -m "feat(ui): add inline-reveal helper"
```

---

## Task 5: `<date-input>` component

**Files:**
- Create: `src/ui/components/date-input.js`
- Test: `tests/unit/date-value.test.js` (append integration tests with jsdom)

Imperative component that wires a text input + estimated checkbox into a `DateValue` getter/setter. Validates on `blur`, sets `aria-invalid` and an inline hint on parse failure, dispatches `date-change` when the value changes.

- [ ] **Step 1: Append failing test (DOM-driven)**

```js
// tests/unit/date-value.test.js — APPEND
import { createDateInput } from '../../src/ui/components/date-input.js';

describe('createDateInput', () => {
  it('returns null DateValue when input is empty', () => {
    document.body.innerHTML = '';
    const handle = createDateInput({ idPrefix: 'birth', container: document.body });
    expect(handle.getValue()).toBeNull();
  });

  it('parses on blur and reports a valid DateValue', () => {
    document.body.innerHTML = '';
    const handle = createDateInput({ idPrefix: 'birth', container: document.body });
    handle.text.value = '30.10.1906';
    handle.text.dispatchEvent(new Event('blur'));
    expect(handle.getValue()).toEqual({ year: 1906, month: 10, day: 30, estimated: false });
    expect(handle.text.getAttribute('aria-invalid')).toBeNull();
  });

  it('marks aria-invalid on parse failure and exposes invalid=true', () => {
    document.body.innerHTML = '';
    const handle = createDateInput({ idPrefix: 'birth', container: document.body });
    handle.text.value = 'garbage';
    handle.text.dispatchEvent(new Event('blur'));
    expect(handle.text.getAttribute('aria-invalid')).toBe('true');
    expect(handle.isInvalid()).toBe(true);
  });

  it('honours the estimated checkbox', () => {
    document.body.innerHTML = '';
    const handle = createDateInput({ idPrefix: 'birth', container: document.body });
    handle.text.value = '1906';
    handle.checkbox.checked = true;
    handle.text.dispatchEvent(new Event('blur'));
    expect(handle.getValue()).toEqual({ year: 1906, estimated: true });
  });

  it('setValue populates the text and checkbox', () => {
    document.body.innerHTML = '';
    const handle = createDateInput({ idPrefix: 'birth', container: document.body });
    handle.setValue({ year: 1906, month: 10, day: 30, estimated: true });
    expect(handle.text.value).toBe('30.10.1906');
    expect(handle.checkbox.checked).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run tests/unit/date-value.test.js`
Expected: FAIL — `createDateInput is not exported`.

- [ ] **Step 3: Implement `createDateInput`**

```js
// src/ui/components/date-input.js
import { parseDateValue, isValidDateValue } from '../../utils/date-value.js';

export function createDateInput({ idPrefix, container, placeholder = 'dd.mm.yyyy or yyyy', estLabel = 'est.' }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'date-input';

  const text = document.createElement('input');
  text.type = 'text';
  text.id = `${idPrefix}Date`;
  text.className = 'date-input-text';
  text.placeholder = placeholder;
  text.autocomplete = 'off';
  wrapper.appendChild(text);

  const checkboxLabel = document.createElement('label');
  checkboxLabel.className = 'date-input-est';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `${idPrefix}Estimated`;
  const estText = document.createTextNode(` ${estLabel}`);
  checkboxLabel.appendChild(checkbox);
  checkboxLabel.appendChild(estText);
  wrapper.appendChild(checkboxLabel);

  const hint = document.createElement('div');
  hint.className = 'date-input-hint';
  hint.hidden = true;
  wrapper.appendChild(hint);

  if (container) container.appendChild(wrapper);

  let lastValue = null;
  let invalid = false;

  function recompute() {
    const raw = text.value.trim();
    if (raw === '') {
      lastValue = null;
      invalid = false;
      text.removeAttribute('aria-invalid');
      hint.hidden = true;
      return;
    }
    const parsed = parseDateValue(raw, { estimated: checkbox.checked });
    if (parsed && parsed.error) {
      invalid = true;
      lastValue = null;
      text.setAttribute('aria-invalid', 'true');
      hint.hidden = false;
      hint.textContent = 'Use dd.mm.yyyy or yyyy';
    } else {
      invalid = false;
      lastValue = parsed;
      text.removeAttribute('aria-invalid');
      hint.hidden = true;
    }
  }

  text.addEventListener('blur', () => {
    recompute();
    wrapper.dispatchEvent(new CustomEvent('date-change', { detail: { value: lastValue, invalid } }));
  });
  checkbox.addEventListener('change', () => {
    recompute();
    wrapper.dispatchEvent(new CustomEvent('date-change', { detail: { value: lastValue, invalid } }));
  });

  return {
    wrapper,
    text,
    checkbox,
    getValue() {
      recompute();
      return lastValue;
    },
    isInvalid() {
      return invalid;
    },
    setValue(dv) {
      if (!isValidDateValue(dv)) {
        text.value = '';
        checkbox.checked = false;
        recompute();
        return;
      }
      if (dv === null) {
        text.value = '';
        checkbox.checked = false;
      } else if (typeof dv.month === 'number') {
        text.value = `${pad2(dv.day)}.${pad2(dv.month)}.${dv.year}`;
        checkbox.checked = !!dv.estimated;
      } else {
        text.value = String(dv.year);
        checkbox.checked = !!dv.estimated;
      }
      recompute();
    }
  };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/date-value.test.js`
Expected: PASS, all date-value + createDateInput tests green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/date-input.js tests/unit/date-value.test.js
git commit -m "feat(ui): add date-input component with estimated checkbox"
```

---

## Task 6: Marriage sync engine (pure-function module)

**Files:**
- Create: `src/utils/marriage-sync.js`
- Test: `tests/unit/marriage-sync.test.js`

Pure functions that produce updated `marriages` arrays for both spouses given a save. Lifted out of `tree-engine.js` so the logic is testable without IndexedDB or the renderer. The engine layer wraps these in Step 11.

- [ ] **Step 1: Write failing tests**

```js
// tests/unit/marriage-sync.test.js
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
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx vitest run tests/unit/marriage-sync.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `syncMarriages`**

```js
// src/utils/marriage-sync.js
// Pure functions for marriage list synchronisation across spouse pairs.

export function makeMarriageId() {
  return `marr_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Compute updated marriage arrays for every spouse affected by saving person `personId`.
 *
 * @param {string} personId               id of the person being saved
 * @param {Array}  newMarriages           marriages array on the saved person AFTER edit
 * @param {Array}  previousMarriages      marriages array on the saved person BEFORE edit
 * @param {Map}    personData             Map<id, person> for resolving spouses (read-only)
 * @returns {Map<string, {id, marriages}>} entries that need to be persisted (key = spouse id)
 */
export function syncMarriages(personId, newMarriages, previousMarriages, personData) {
  const updates = new Map();

  // Build helpers
  const newById = new Map(newMarriages.filter((m) => m.spouseId).map((m) => [m.id, m]));
  const prevById = new Map((previousMarriages || []).filter((m) => m.spouseId).map((m) => [m.id, m]));

  // Step 1: handle removals — entries that were in previous but not in new (or had spouseId removed)
  for (const [id, prev] of prevById) {
    const current = newMarriages.find((m) => m.id === id);
    if (!current || !current.spouseId) {
      removeFromSpouse(updates, personData, prev.spouseId, id);
    } else if (current.spouseId !== prev.spouseId) {
      // Spouse changed — drop mirror from old spouse
      removeFromSpouse(updates, personData, prev.spouseId, id);
    }
  }

  // Step 2: write/update mirrors for current marriages
  for (const [id, current] of newById) {
    addOrUpdateMirror(updates, personData, current, personId);
  }

  return updates;
}

function getOrInitUpdate(updates, personData, spouseId) {
  if (!updates.has(spouseId)) {
    const spouse = personData.get(spouseId);
    if (!spouse) return null; // unknown spouse — skip
    updates.set(spouseId, { id: spouseId, marriages: Array.isArray(spouse.marriages) ? [...spouse.marriages] : [] });
  }
  return updates.get(spouseId);
}

function removeFromSpouse(updates, personData, spouseId, marriageId) {
  const update = getOrInitUpdate(updates, personData, spouseId);
  if (!update) return;
  update.marriages = update.marriages.filter((m) => m.id !== marriageId);
}

function addOrUpdateMirror(updates, personData, marriage, savingPersonId) {
  const update = getOrInitUpdate(updates, personData, marriage.spouseId);
  if (!update) return;
  const idx = update.marriages.findIndex((m) => m.id === marriage.id);
  const mirrored = {
    id: marriage.id,
    spouseId: savingPersonId,
    date: marriage.date,
    place: marriage.place,
    note: marriage.note
  };
  if (idx === -1) {
    update.marriages.push(mirrored);
  } else {
    update.marriages[idx] = mirrored;
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `npx vitest run tests/unit/marriage-sync.test.js`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/utils/marriage-sync.js tests/unit/marriage-sync.test.js
git commit -m "feat(marriage-sync): add pure marriage mirror engine"
```

---

## Task 7: `marriage-row` component

**Files:**
- Create: `src/ui/components/marriage-row.js`

Manages the DOM for one marriage entry: spouse picker, date input, place input (revealed), note textarea (revealed), remove button. Owns the `marriage.id` from creation. Auto-fill prefills date/place/note from the selected spouse's existing record when applicable.

The auto-fill DOM event flow is exercised in the E2E test (Task 18). Unit tests for the imperative DOM glue would be high-cost, low-value — `syncMarriages` already covers the data path.

- [ ] **Step 1: Implement**

```js
// src/ui/components/marriage-row.js
import { createDateInput } from './date-input.js';
import { setupInlineReveal } from './inline-reveal.js';
import { isValidDateValue } from '../../utils/date-value.js';

export function createMarriageRow({ marriage, allPersons, currentPersonId, onSpouseChange, onRemove, t }) {
  const row = document.createElement('div');
  row.className = 'marriage-row';
  row.dataset.marriageId = marriage.id;

  // Header row: spouse select + remove button
  const header = document.createElement('div');
  header.className = 'marriage-row-header';

  const spouseLabel = document.createElement('label');
  spouseLabel.textContent = t('builder.form.spouse', 'Spouse');
  header.appendChild(spouseLabel);

  const spouseSelect = document.createElement('select');
  spouseSelect.className = 'marriage-spouse-select';
  spouseSelect.appendChild(option('', t('builder.form.select_spouse', 'Select Spouse')));
  for (const p of allPersons) {
    if (p.id === currentPersonId) continue;
    const fullName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.id;
    spouseSelect.appendChild(option(p.id, fullName));
  }
  spouseSelect.value = marriage.spouseId || '';
  header.appendChild(spouseSelect);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'marriage-row-remove';
  removeBtn.setAttribute('aria-label', t('builder.form.remove_marriage', 'Remove marriage'));
  removeBtn.textContent = '✕';
  header.appendChild(removeBtn);

  row.appendChild(header);

  // Date input
  const dateLabel = document.createElement('label');
  dateLabel.textContent = t('builder.form.marriage_date', 'Marriage date');
  row.appendChild(dateLabel);
  const dateHandle = createDateInput({ idPrefix: `marr-${marriage.id}`, container: row });
  dateHandle.setValue(isValidDateValue(marriage.date) ? marriage.date : null);

  // Place (revealed)
  const placeWrapper = document.createElement('div');
  placeWrapper.className = 'marriage-place-wrapper';
  const placeLabel = document.createElement('label');
  placeLabel.textContent = t('builder.form.marriage_place', 'Marriage place');
  const placeInput = document.createElement('input');
  placeInput.type = 'text';
  placeInput.className = 'marriage-place';
  placeInput.value = marriage.place || '';
  placeWrapper.appendChild(placeLabel);
  placeWrapper.appendChild(placeInput);

  const placeReveal = document.createElement('button');
  placeReveal.type = 'button';
  placeReveal.className = 'reveal-link';
  placeReveal.textContent = `+ ${t('builder.form.add_place', 'add place')}`;
  row.appendChild(placeReveal);
  row.appendChild(placeWrapper);
  setupInlineReveal({ trigger: placeReveal, target: placeWrapper });

  // Note (revealed)
  const noteWrapper = document.createElement('div');
  noteWrapper.className = 'marriage-note-wrapper';
  const noteLabel = document.createElement('label');
  noteLabel.textContent = t('builder.form.marriage_note', 'Marriage note');
  const noteTextarea = document.createElement('textarea');
  noteTextarea.className = 'marriage-note';
  noteTextarea.rows = 2;
  noteTextarea.value = marriage.note || '';
  noteWrapper.appendChild(noteLabel);
  noteWrapper.appendChild(noteTextarea);

  const noteReveal = document.createElement('button');
  noteReveal.type = 'button';
  noteReveal.className = 'reveal-link';
  noteReveal.textContent = `+ ${t('builder.form.add_note', 'add note')}`;
  row.appendChild(noteReveal);
  row.appendChild(noteWrapper);
  setupInlineReveal({ trigger: noteReveal, target: noteWrapper });

  // Hint container for auto-fill messages
  const hint = document.createElement('div');
  hint.className = 'marriage-row-hint';
  hint.hidden = true;
  row.appendChild(hint);

  // Wire interactions
  spouseSelect.addEventListener('change', () => {
    if (typeof onSpouseChange === 'function') {
      onSpouseChange({
        marriageId: marriage.id,
        previousSpouseId: marriage.spouseId,
        newSpouseId: spouseSelect.value,
        applyAutofill: (mirror) => applyAutofill(mirror, { dateHandle, placeInput, noteTextarea, placeReveal, placeWrapper, noteReveal, noteWrapper, hint, t }),
        revertSpouseSelection: () => { spouseSelect.value = marriage.spouseId || ''; }
      });
    }
    marriage.spouseId = spouseSelect.value;
  });

  removeBtn.addEventListener('click', () => {
    if (typeof onRemove === 'function') onRemove({ marriageId: marriage.id, spouseId: marriage.spouseId });
  });

  return {
    element: row,
    getValue() {
      return {
        id: marriage.id,
        spouseId: spouseSelect.value || '',
        date: dateHandle.getValue(),
        place: placeInput.value.trim(),
        note: noteTextarea.value.trim()
      };
    },
    isInvalid() {
      return dateHandle.isInvalid();
    },
    setRemovable(removable) {
      removeBtn.hidden = !removable;
    }
  };
}

function applyAutofill(mirror, { dateHandle, placeInput, noteTextarea, placeReveal, placeWrapper, noteReveal, noteWrapper, hint, t }) {
  const userTouched = (dateHandle.getValue() !== null) ||
    (placeInput.value.trim() !== '') ||
    (noteTextarea.value.trim() !== '');

  if (userTouched) {
    hint.hidden = false;
    hint.textContent = t('builder.form.marriage_autofill_offer', 'Use spouse\'s saved values');
    return;
  }

  if (mirror.date) dateHandle.setValue(mirror.date);
  if (mirror.place) {
    placeInput.value = mirror.place;
    placeReveal.hidden = true;
    placeWrapper.hidden = false;
  }
  if (mirror.note) {
    noteTextarea.value = mirror.note;
    noteReveal.hidden = true;
    noteWrapper.hidden = false;
  }
  hint.hidden = false;
  hint.textContent = t('builder.form.marriage_autofilled', 'Filled from spouse\'s record');
}

function option(value, text) {
  const o = document.createElement('option');
  o.value = value;
  o.textContent = text;
  return o;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/marriage-row.js
git commit -m "feat(ui): add marriage-row component with auto-fill scaffolding"
```

---

## Task 8: `marriages-list` controller

**Files:**
- Create: `src/ui/components/marriages-list.js`

Container for marriage rows. Manages add/remove, exposes `getValue()` returning the array, queries the global `treeCore.personData` for spouses on autofill, and wires the spouse-change confirmation dialog through a callback.

- [ ] **Step 1: Implement**

```js
// src/ui/components/marriages-list.js
import { createMarriageRow } from './marriage-row.js';
import { makeMarriageId } from '../../utils/marriage-sync.js';

export function createMarriagesList({ container, marriages, getAllPersons, currentPersonId, confirmSpouseChange, t }) {
  container.innerHTML = '';

  const list = document.createElement('div');
  list.className = 'marriages-list';
  container.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'reveal-link marriages-add';
  addBtn.textContent = `+ ${t('builder.form.add_marriage', 'add another marriage')}`;
  container.appendChild(addBtn);

  const handles = [];

  function refreshRemovable() {
    handles.forEach((h) => h.setRemovable(handles.length > 1));
  }

  function addRow(marriage, { previouslySaved = true } = {}) {
    const handle = createMarriageRow({
      marriage,
      allPersons: getAllPersons(),
      currentPersonId,
      t,
      onSpouseChange: ({ marriageId, previousSpouseId, newSpouseId, applyAutofill, revertSpouseSelection }) => {
        // 1) Confirm if this row was already saved with a different spouse
        if (previouslySaved && previousSpouseId && previousSpouseId !== newSpouseId) {
          confirmSpouseChange({
            previousSpouseId,
            newSpouseId,
            confirm: () => {
              if (newSpouseId) tryAutofill(newSpouseId, currentPersonId, marriageId, applyAutofill);
            },
            cancel: () => revertSpouseSelection()
          });
          return;
        }
        // 2) No prior save — just attempt auto-fill
        if (newSpouseId) tryAutofill(newSpouseId, currentPersonId, marriageId, applyAutofill);
      },
      onRemove: ({ marriageId }) => {
        const idx = handles.findIndex((h) => h.element.dataset.marriageId === marriageId);
        if (idx >= 0) {
          handles[idx].element.remove();
          handles.splice(idx, 1);
          refreshRemovable();
        }
      }
    });
    list.appendChild(handle.element);
    handles.push(handle);
    refreshRemovable();
  }

  function tryAutofill(newSpouseId, currentId, marriageId, applyAutofill) {
    const spouse = getAllPersons().find((p) => p.id === newSpouseId);
    if (!spouse || !Array.isArray(spouse.marriages)) return;
    const mirror = spouse.marriages.find((m) => m.id === marriageId || m.spouseId === currentId);
    if (mirror) applyAutofill(mirror);
  }

  // Seed
  if (Array.isArray(marriages) && marriages.length > 0) {
    marriages.forEach((m) => addRow(m, { previouslySaved: true }));
  } else {
    addRow({ id: makeMarriageId(), spouseId: '', date: null, place: '', note: '' }, { previouslySaved: false });
  }

  addBtn.addEventListener('click', () => {
    addRow({ id: makeMarriageId(), spouseId: '', date: null, place: '', note: '' }, { previouslySaved: false });
  });

  return {
    getValue() {
      return handles.map((h) => h.getValue());
    },
    hasInvalidDate() {
      return handles.some((h) => h.isInvalid());
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/components/marriages-list.js
git commit -m "feat(ui): add marriages-list controller with add/remove and confirm-on-spouse-change"
```

---

## Task 9: Modal HTML markup updates

**Files:**
- Modify: `src/pages/builder.astro` (lines 925-1002)

Replace the existing single `personDob` field with the birth event block, add a death event block, replace the single spouse select with a marriages container, and add a general notes block.

- [ ] **Step 1: Replace the modal body block**

Replace the `<form id="personForm">…</form>` block in `src/pages/builder.astro` with the new structure. Find the existing block (lines 931-992) and replace its inner content as follows.

The replacement block (everything inside `<form id="personForm">`):

```html
<div class="form-group">
  <label data-i18n="builder.form.gender">Gender <span class="required">*</span></label>
  <div class="gender-radio-group">
    <div class="gender-radio-option">
      <input type="radio" id="genderMale" name="personGender" value="male" required />
      <label for="genderMale" data-i18n="builder.form.gender_male">Male</label>
    </div>
    <div class="gender-radio-option">
      <input type="radio" id="genderFemale" name="personGender" value="female" required />
      <label for="genderFemale" data-i18n="builder.form.gender_female">Female</label>
    </div>
  </div>
</div>
<div class="form-group">
  <label for="personName" data-i18n="builder.form.given_name">Given Name <span class="required">*</span></label>
  <input type="text" id="personName" required />
</div>
<div class="form-group">
  <label for="personFatherName" data-i18n="builder.form.father_name">Father's Name</label>
  <input type="text" id="personFatherName" placeholder="Father's given name" data-i18n="builder.form.father_name_placeholder" />
  <small class="help-text" data-i18n="builder.form.father_name_help">Father's given name (not surname)</small>
</div>
<div class="form-group">
  <label for="personSurname" data-i18n="builder.form.surname">Surname</label>
  <input type="text" id="personSurname" />
</div>
<div class="form-group">
  <label for="personMaidenName" data-i18n="builder.form.maiden_name">Maiden Name</label>
  <input type="text" id="personMaidenName" />
</div>

<!-- Birth event -->
<div class="form-group form-event" id="personBirthGroup">
  <label data-i18n="builder.form.birth_date">Birth date</label>
  <div id="personBirthDateMount"></div>
  <button type="button" class="reveal-link" id="personBirthPlaceReveal">+ <span data-i18n="builder.form.add_place">add place</span></button>
  <div class="event-place" id="personBirthPlaceWrapper" hidden>
    <label for="personBirthPlace" data-i18n="builder.form.birth_place">Birth place</label>
    <input type="text" id="personBirthPlace" />
  </div>
  <button type="button" class="reveal-link" id="personBirthNoteReveal">+ <span data-i18n="builder.form.add_note">add note</span></button>
  <div class="event-note" id="personBirthNoteWrapper" hidden>
    <label for="personBirthNote" data-i18n="builder.form.birth_note">Birth note</label>
    <textarea id="personBirthNote" rows="2"></textarea>
  </div>
</div>

<!-- Death event -->
<div class="form-group form-event" id="personDeathGroup">
  <label data-i18n="builder.form.death_date">Death date</label>
  <div id="personDeathDateMount"></div>
  <button type="button" class="reveal-link" id="personDeathPlaceReveal">+ <span data-i18n="builder.form.add_place">add place</span></button>
  <div class="event-place" id="personDeathPlaceWrapper" hidden>
    <label for="personDeathPlace" data-i18n="builder.form.death_place">Death place</label>
    <input type="text" id="personDeathPlace" />
  </div>
  <button type="button" class="reveal-link" id="personDeathNoteReveal">+ <span data-i18n="builder.form.add_note">add note</span></button>
  <div class="event-note" id="personDeathNoteWrapper" hidden>
    <label for="personDeathNote" data-i18n="builder.form.death_note">Death note</label>
    <textarea id="personDeathNote" rows="2"></textarea>
  </div>
</div>

<div class="form-group">
  <label data-i18n="builder.modals.person.photo.label">Photo</label>
  <div class="photo-section">
    <div class="photo-preview-wrap">
      <img id="personPhotoPreview" alt="" hidden style="width:80px;height:80px;object-fit:cover;border-radius:50%;" />
      <span id="personPhotoPlaceholder" aria-hidden="true" style="font-size:2rem;">📷</span>
    </div>
    <input type="file" id="personPhotoInput" accept="image/jpeg,image/png,image/webp" aria-label="Upload person photo" style="margin:.5rem 0;" />
    <input type="hidden" id="personPhotoBase64" />
    <button type="button" id="personPhotoRemove" hidden data-i18n="builder.modals.person.photo.remove">Remove photo</button>
    <p class="help-text" data-i18n="builder.modals.person.photo.hint">JPG, PNG or WebP · max 500 KB · stored locally</p>
  </div>
</div>

<div class="form-group">
  <label data-i18n="builder.form.mother">Mother</label>
  <div class="searchable-select" id="motherSelect"></div>
</div>
<div class="form-group">
  <label data-i18n="builder.form.father">Father</label>
  <div class="searchable-select" id="fatherSelect"></div>
</div>

<!-- Marriages -->
<div class="form-group">
  <label data-i18n="builder.form.marriages">Marriages</label>
  <div id="personMarriagesMount"></div>
</div>

<!-- General notes -->
<div class="form-group form-general-note">
  <button type="button" class="reveal-link" id="personNotesReveal">+ <span data-i18n="builder.form.add_general_note">add general note</span></button>
  <div id="personNotesWrapper" hidden>
    <label for="personNotes" data-i18n="builder.form.general_notes">General notes</label>
    <textarea id="personNotes" rows="3"></textarea>
  </div>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/builder.astro
git commit -m "feat(modal): replace dob+spouse with birth/death/marriages markup"
```

---

## Task 10: Modal CSS for new elements

**Files:**
- Modify: `src/styles/modal.css`

Add styles for `.reveal-link`, `.date-input`, `.marriage-row`, `.marriages-list`, `.marriage-row-hint`, `.event-place`, `.event-note`. Match existing modal palette (greys, blues for primary, soft red for `aria-invalid`).

- [ ] **Step 1: Append styles**

Append to `src/styles/modal.css`:

```css
/* Inline reveal links */
.modal .reveal-link {
  display: inline-block;
  background: none;
  border: none;
  color: #3498db;
  cursor: pointer;
  font-size: 13px;
  padding: 4px 0;
  margin: 4px 0;
  text-align: left;
}
.modal .reveal-link:hover { text-decoration: underline; }
.modal .reveal-link[hidden] { display: none; }

/* Date input component */
.modal .date-input {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.modal .date-input-text {
  flex: 1 1 180px;
  padding: 8px 10px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}
.modal .date-input-text[aria-invalid="true"] {
  border-color: #dc3545;
  background-color: #fff5f5;
}
.modal .date-input-est {
  font-size: 13px;
  color: #555;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.modal .date-input-hint {
  flex: 1 1 100%;
  color: #dc3545;
  font-size: 12px;
}

/* Event blocks (birth, death) */
.modal .form-event .event-place,
.modal .form-event .event-note {
  margin-top: 6px;
}
.modal .form-event .event-place[hidden],
.modal .form-event .event-note[hidden] {
  display: none;
}

/* Marriages list */
.modal .marriages-list { display: flex; flex-direction: column; gap: 12px; }
.modal .marriage-row {
  border: 1px solid #e2e6ea;
  border-radius: 8px;
  padding: 12px;
  background: #fafbfc;
}
.modal .marriage-row-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.modal .marriage-spouse-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #d0d7de;
  border-radius: 6px;
}
.modal .marriage-row-remove {
  background: none;
  border: none;
  color: #b94a48;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
}
.modal .marriage-row-remove[hidden] { display: none; }
.modal .marriage-place-wrapper[hidden],
.modal .marriage-note-wrapper[hidden] { display: none; }
.modal .marriage-row-hint {
  font-size: 12px;
  color: #555;
  margin-top: 6px;
}
.modal .marriage-row-hint[hidden] { display: none; }
.modal .marriages-add { padding-top: 0; }
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/modal.css
git commit -m "feat(modal): add styles for inline-reveal, date-input, and marriage rows"
```

---

## Task 11: Wire modal.js to new components

**Files:**
- Modify: `src/ui/modals/modal.js`

Replace dob handling, spouse single-picker handling, and the form data shape with:
- `<date-input>` mounts for birth and death
- inline reveals for birth/death place + note
- `marriages-list` mount
- inline reveal for general notes
- `formData` payload reflects the new schema

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of `src/ui/modals/modal.js` (lines 6-9) with:

```js
import { updateSearchableSelects } from '../components/searchableSelect.js';
import { SecurityUtils, DOMUtils } from '../../utils/security-utils.js';
import { RetryManager } from '../../utils/error-handling.js';
import { appContext, EVENTS } from '../../utils/event-bus.js';
import { createDateInput } from '../components/date-input.js';
import { setupInlineReveal } from '../components/inline-reveal.js';
import { createMarriagesList } from '../components/marriages-list.js';
import { isValidDateValue } from '../../utils/date-value.js';
```

- [ ] **Step 2: Replace `populateFormFields` to use new components**

Replace `populateFormFields(node, personData)` (lines 189-228) with:

```js
let birthDateHandle = null;
let deathDateHandle = null;
let marriagesListHandle = null;

function populateFormFields(node, personData) {
  document.getElementById('personName').value = node?.name || personData?.name || '';
  document.getElementById('personFatherName').value = node?.fatherName || personData?.fatherName || '';
  document.getElementById('personSurname').value = node?.surname || personData?.surname || '';
  document.getElementById('personMaidenName').value = node?.maidenName || personData?.maidenName || '';

  const gender = node?.gender || personData?.gender || '';
  const maleRadio = document.getElementById('genderMale');
  const femaleRadio = document.getElementById('genderFemale');
  if (maleRadio && femaleRadio) {
    maleRadio.checked = gender === 'male';
    femaleRadio.checked = gender === 'female';
    updateGenderRadioStyles();
  }

  // Birth/death event blocks
  const birth = personData?.birth || { date: null, place: '', note: '' };
  const death = personData?.death || { date: null, place: '', note: '' };
  mountEvent('Birth', birth, (h) => { birthDateHandle = h; });
  mountEvent('Death', death, (h) => { deathDateHandle = h; });

  // Marriages list
  const allPersons = Array.from(window.treeCore?.personData?.values() || []);
  const marriagesMount = document.getElementById('personMarriagesMount');
  marriagesMount.innerHTML = '';
  marriagesListHandle = createMarriagesList({
    container: marriagesMount,
    marriages: Array.isArray(personData?.marriages) ? personData.marriages : [],
    getAllPersons: () => Array.from(window.treeCore?.personData?.values() || []),
    currentPersonId: personData?.id || node?.id || '',
    confirmSpouseChange: showSpouseChangeConfirmation,
    t
  });

  // General notes
  const notesEl = document.getElementById('personNotes');
  if (notesEl) notesEl.value = personData?.notes || '';
  setupInlineReveal({
    trigger: document.getElementById('personNotesReveal'),
    target: document.getElementById('personNotesWrapper')
  });

  // Photo (unchanged)
  const storedPhoto = personData?.photoBase64 || '';
  const photoPreview = document.getElementById('personPhotoPreview');
  const photoPlaceholder = document.getElementById('personPhotoPlaceholder');
  const photoBase64Input = document.getElementById('personPhotoBase64');
  const removeBtn = document.getElementById('personPhotoRemove');
  if (photoBase64Input) photoBase64Input.value = storedPhoto;
  if (photoPreview) {
    if (storedPhoto) {
      photoPreview.src = storedPhoto;
      photoPreview.hidden = false;
      if (photoPlaceholder) photoPlaceholder.hidden = true;
      if (removeBtn) removeBtn.hidden = false;
    } else {
      photoPreview.hidden = true;
      if (photoPlaceholder) photoPlaceholder.hidden = false;
      if (removeBtn) removeBtn.hidden = true;
    }
  }
}

function mountEvent(kind, event, setHandle) {
  const dateMount = document.getElementById(`person${kind}DateMount`);
  if (dateMount) {
    dateMount.innerHTML = '';
    const handle = createDateInput({ idPrefix: `person${kind}`, container: dateMount });
    handle.setValue(isValidDateValue(event.date) ? event.date : null);
    setHandle(handle);
  }

  const placeInput = document.getElementById(`person${kind}Place`);
  if (placeInput) placeInput.value = event.place || '';
  setupInlineReveal({
    trigger: document.getElementById(`person${kind}PlaceReveal`),
    target: document.getElementById(`person${kind}PlaceWrapper`)
  });

  const noteInput = document.getElementById(`person${kind}Note`);
  if (noteInput) noteInput.value = event.note || '';
  setupInlineReveal({
    trigger: document.getElementById(`person${kind}NoteReveal`),
    target: document.getElementById(`person${kind}NoteWrapper`)
  });
}

function showSpouseChangeConfirmation({ previousSpouseId, newSpouseId, confirm, cancel }) {
  const oldSpouse = window.treeCore?.personData?.get(previousSpouseId);
  const oldName = oldSpouse ? `${oldSpouse.name || ''} ${oldSpouse.surname || ''}`.trim() : t('builder.notifications.unknown_person', 'Unknown');
  const message = t('builder.modals.confirm_change_spouse.body', `Changing the spouse will remove this marriage from {{name}}'s record. Continue?`).replace('{{name}}', oldName);
  if (window.confirm(message)) {
    confirm();
  } else {
    cancel();
  }
}
```

- [ ] **Step 3: Update `clearForm`**

Replace `clearForm()` (lines 349-384) with:

```js
function clearForm() {
  const form = document.getElementById('personForm');
  if (form) form.reset();

  ['personName', 'personFatherName', 'personSurname', 'personMaidenName'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Reset event mounts
  if (birthDateHandle) birthDateHandle.setValue(null);
  if (deathDateHandle) deathDateHandle.setValue(null);
  ['personBirthPlace', 'personBirthNote', 'personDeathPlace', 'personDeathNote', 'personNotes'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['personBirthPlaceWrapper', 'personBirthNoteWrapper', 'personDeathPlaceWrapper', 'personDeathNoteWrapper', 'personNotesWrapper'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
  ['personBirthPlaceReveal', 'personBirthNoteReveal', 'personDeathPlaceReveal', 'personDeathNoteReveal', 'personNotesReveal'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = false;
  });

  // Marriages
  const marriagesMount = document.getElementById('personMarriagesMount');
  if (marriagesMount) marriagesMount.innerHTML = '';
  marriagesListHandle = null;

  const maleRadio = document.getElementById('genderMale');
  const femaleRadio = document.getElementById('genderFemale');
  if (maleRadio) maleRadio.checked = false;
  if (femaleRadio) femaleRadio.checked = false;
  updateGenderRadioStyles();
  clearErrorStates();

  const photoBase64Input = document.getElementById('personPhotoBase64');
  const photoPreview = document.getElementById('personPhotoPreview');
  const photoPlaceholder = document.getElementById('personPhotoPlaceholder');
  const personPhotoRemove = document.getElementById('personPhotoRemove');
  const personPhotoInput = document.getElementById('personPhotoInput');
  if (photoBase64Input) photoBase64Input.value = '';
  if (photoPreview) { photoPreview.src = ''; photoPreview.hidden = true; }
  if (photoPlaceholder) photoPlaceholder.hidden = false;
  if (personPhotoRemove) personPhotoRemove.hidden = true;
  if (personPhotoInput) personPhotoInput.value = '';
}
```

- [ ] **Step 4: Update save button payload**

Replace the inner block of the save button click handler (lines 759-789) — the part that builds `formData` — with:

```js
// Build new-shape payload
const birthVal = birthDateHandle?.getValue?.() || null;
const deathVal = deathDateHandle?.getValue?.() || null;
const formData = {
  name: document.getElementById('personName')?.value.trim() || '',
  fatherName: document.getElementById('personFatherName')?.value.trim() || '',
  surname: document.getElementById('personSurname')?.value.trim() || '',
  maidenName: document.getElementById('personMaidenName')?.value.trim() || '',
  gender: getSelectedGender(),
  motherId: document.querySelector('#motherSelect input[type="hidden"]')?.value || '',
  fatherId: document.querySelector('#fatherSelect input[type="hidden"]')?.value || '',
  birth: {
    date: birthVal,
    place: document.getElementById('personBirthPlace')?.value.trim() || '',
    note: document.getElementById('personBirthNote')?.value.trim() || ''
  },
  death: {
    date: deathVal,
    place: document.getElementById('personDeathPlace')?.value.trim() || '',
    note: document.getElementById('personDeathNote')?.value.trim() || ''
  },
  marriages: marriagesListHandle ? marriagesListHandle.getValue() : [],
  notes: document.getElementById('personNotes')?.value.trim() || '',
  editingId: modal.dataset.editingId || null,
  photoBase64: document.getElementById('personPhotoBase64')?.value || ''
};
```

Also update `validateForm()` (lines 495-528) — append a date-validity check after the gender check:

```js
// Reject invalid date inputs
const dateInvalid = (birthDateHandle?.isInvalid?.()) ||
  (deathDateHandle?.isInvalid?.()) ||
  (marriagesListHandle?.hasInvalidDate?.());
if (dateInvalid) {
  errors.push({
    field: document.querySelector('.date-input-text[aria-invalid="true"]') || document.getElementById('personBirthDate'),
    message: t('builder.validation.invalid_date_format', 'Use dd.mm.yyyy or yyyy.')
  });
  isValid = false;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/ui/modals/modal.js
git commit -m "feat(modal): wire date-input, marriages-list, and inline reveals"
```

---

## Task 12: tree-engine.js — accept new payload and run marriage sync

**Files:**
- Modify: `src/core/tree-engine.js` (function `handleSavePersonFromModal`, lines ~782-920)

Update the save handler to accept the new payload shape, persist `birth`/`death`/`marriages`/`notes`, recompute the legacy `spouseId` from `marriages[0]`, and apply `syncMarriages` mirrors to all affected spouses.

- [ ] **Step 1: Add the import**

Add at the top of `src/core/tree-engine.js` (near other imports):

```js
import { syncMarriages, makeMarriageId } from '../utils/marriage-sync.js';
```

- [ ] **Step 2: Replace the personData construction inside `handleSavePersonFromModal`**

Replace lines 806-846 (the `personData` object literal and the spouse-sync block) with:

```js
// Capture pre-edit marriages for diff
const previousMarriages = isEdit ? (this.personData.get(personId)?.marriages || []) : [];

// Normalise marriages: assign ids to anything missing one, drop fully-empty rows
const normalisedMarriages = (formData.marriages || [])
  .map((m) => ({
    id: m.id || makeMarriageId(),
    spouseId: m.spouseId || '',
    date: m.date || null,
    place: m.place || '',
    note: m.note || ''
  }))
  .filter((m) => m.spouseId || m.date || m.place || m.note);

// Build personData (NEW shape)
const personData = {
  id: personId,
  name: formData.name.trim(),
  fatherName: formData.fatherName ? formData.fatherName.trim() : '',
  surname: formData.surname ? formData.surname.trim() : '',
  maidenName: formData.maidenName ? formData.maidenName.trim() : '',
  gender: formData.gender,
  motherId: formData.motherId || '',
  fatherId: formData.fatherId || '',
  birth: {
    date: formData.birth?.date || null,
    place: formData.birth?.place || '',
    note: formData.birth?.note || ''
  },
  death: {
    date: formData.death?.date || null,
    place: formData.death?.place || '',
    note: formData.death?.note || ''
  },
  marriages: normalisedMarriages,
  notes: formData.notes || '',
  // Legacy mirrors (derived for backward compat)
  spouseId: normalisedMarriages[0]?.spouseId || '',
  dob: '', // dob is now read from birth.date by display layer; keep field for back-compat
  photoBase64: formData.photoBase64 || ''
};

this.personData.set(personId, personData);

// Mirror marriages onto every affected spouse
const spouseUpdates = syncMarriages(personId, normalisedMarriages, previousMarriages, this.personData);
for (const [spouseId, update] of spouseUpdates) {
  const spouse = this.personData.get(spouseId);
  if (!spouse) continue;
  spouse.marriages = update.marriages;
  spouse.spouseId = spouse.marriages[0]?.spouseId || '';
  this.personData.set(spouseId, spouse);
}
```

- [ ] **Step 3: Update node sync (around lines 858-915)**

Replace the renderer node update block to also copy birth/death/marriages onto the rendered node so the canvas can read them:

```js
// Handle canvas node creation/update
if (this.renderer) {
  let nodeData;
  if (isEdit && this.renderer.nodes.has(personId)) {
    nodeData = this.renderer.nodes.get(personId);
    Object.assign(nodeData, {
      name: personData.name,
      fatherName: personData.fatherName,
      surname: personData.surname,
      maidenName: personData.maidenName,
      gender: personData.gender,
      birth: personData.birth,
      death: personData.death,
      marriages: personData.marriages,
      photoBase64: personData.photoBase64
    });
  } else {
    const existingNodes = Array.from(this.renderer.nodes.values());
    let x = 400, y = 300;
    if (existingNodes.length > 0) {
      const position = this.calculateNewNodePosition(existingNodes);
      x = position.x;
      y = position.y;
    }
    nodeData = {
      id: personId,
      name: personData.name,
      fatherName: personData.fatherName,
      surname: personData.surname,
      maidenName: personData.maidenName,
      gender: personData.gender,
      birth: personData.birth,
      death: personData.death,
      marriages: personData.marriages,
      photoBase64: personData.photoBase64,
      x, y
    };
    this.renderer.addNode(nodeData);
  }
}

// Refresh affected spouses' rendered nodes too
for (const [spouseId] of spouseUpdates) {
  const spouse = this.personData.get(spouseId);
  const spouseNode = this.renderer?.nodes.get(spouseId);
  if (spouse && spouseNode) {
    spouseNode.marriages = spouse.marriages;
  }
}

this.regenerateConnections();
this.undoRedoManager?.pushUndoState?.();
```

> The original `handleSavePersonFromModal` body had additional surrounding code (analytics events, photo handling, error handling). **Keep that surrounding code intact** — only the personData construction and the node-sync section change. Read the full function before editing to confirm the boundaries.

- [ ] **Step 4: Hook the migration into the load path**

Find the function in `src/core/tree-engine.js` that loads cached state (search for `cacheFormat` reads — around line 654 / 715, or the IndexedDB load path). Wrap the loaded file through the migration:

```js
import { migrateToV22 } from '../data/migrations/v2.2-rich-events.js';

// At the spot where the cached file is parsed into memory:
const migrated = migrateToV22(parsedFile);
// then continue using `migrated` as before
```

The exact insertion line will be in the `loadFromCache` / `restoreFromState` path. Add the import once at the top of the file. The migration is idempotent so calling it on already-migrated files is safe.

- [ ] **Step 5: Commit**

```bash
git add src/core/tree-engine.js
git commit -m "feat(tree-engine): persist rich event fields and run marriage sync on save"
```

---

## Task 13: Canvas renderer — birth–death subline and connector label

**Files:**
- Modify: `src/core/canvas-renderer.js`

Replace the dob subline with `formatLifespanShort(node.birth?.date, node.death?.date, locale)`. Add a small label centered on spouse connectors that shows `formatDateValue(marriage.date, locale)` when `marriages[0]` exists.

- [ ] **Step 1: Add import at top of `src/core/canvas-renderer.js`**

```js
import { formatLifespanShort, formatDateValue } from '../utils/date-value.js';
```

- [ ] **Step 2: Update `getNodeWidth` and `getNodeHeight` to use the lifespan string**

Replace the dob block in `getNodeWidth` (lines 421-424):

```js
// Lifespan width (replaces former DOB-only width)
if (this.displayPreferences.showDateOfBirth) {
  const lifespan = formatLifespanShort(node.birth?.date, node.death?.date, this.getLocale());
  if (lifespan) {
    const w = ctx.measureText(lifespan).width;
    maxWidth = Math.max(maxWidth, w + 20);
  }
}
```

Replace the equivalent block in `getNodeHeight` (lines 446-448):

```js
if (this.displayPreferences.showDateOfBirth) {
  const lifespan = formatLifespanShort(node.birth?.date, node.death?.date, this.getLocale());
  if (lifespan) lines += 1;
}
```

- [ ] **Step 3: Add a `getLocale()` helper to the renderer (single source of truth)**

Add as a method on the renderer class:

```js
getLocale() {
  return (window.i18n?.currentLocale || 'en').slice(0, 2);
}
```

- [ ] **Step 4: Replace the dob render call in `drawRectangleNode`**

Find the existing block that draws the dob subline (around line 1228 — `ctx.fillText(\`(${node.maidenName})\`, ...)` is nearby). Replace the dob `fillText` call with:

```js
if (this.displayPreferences.showDateOfBirth) {
  const lifespan = formatLifespanShort(node.birth?.date, node.death?.date, this.getLocale());
  if (lifespan) {
    ctx.fillText(lifespan, node.x, y);
    y += lineHeight;
  }
}
```

> Keep using the existing `ctx.fillText` font and y-tracking from the surrounding code — the only change is the string and its source. Read lines 1190-1240 to confirm the `y` and `lineHeight` variable names in the surrounding scope.

- [ ] **Step 5: Add the marriage date label in `drawConnections`**

Replace the spouse branch in `drawConnections` (lines 1020-1038) with a labelled draw:

```js
drawConnections(ctx) {
  const locale = this.getLocale();
  for (const conn of this.connections) {
    const fromNode = this.nodes.get(conn.from);
    const toNode = this.nodes.get(conn.to);
    if (!fromNode || !toNode) continue;

    if (conn.type === 'spouse') {
      ctx.strokeStyle = this.settings.spouseLineColor;
      ctx.lineWidth = this.settings.spouseLineThickness;
      this.setLineDash(ctx, this.settings.spouseLineStyle);
    } else if (conn.type === 'line-only') {
      ctx.strokeStyle = this.settings.lineOnlyColor;
      ctx.lineWidth = this.settings.lineOnlyThickness;
      this.setLineDash(ctx, this.settings.lineOnlyStyle);
    } else {
      ctx.strokeStyle = this.settings.familyLineColor;
      ctx.lineWidth = this.settings.familyLineThickness;
      this.setLineDash(ctx, this.settings.familyLineStyle);
    }

    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);
    ctx.stroke();

    // Spouse connector: draw marriage date label (year-only)
    if (conn.type === 'spouse') {
      const marriage = (fromNode.marriages || []).find((m) => m.spouseId === conn.to)
        || (toNode.marriages || []).find((m) => m.spouseId === conn.from);
      if (marriage?.date?.year) {
        const labelDV = { year: marriage.date.year, estimated: !!marriage.date.estimated };
        const label = formatDateValue(labelDV, locale);
        const cx = (fromNode.x + toNode.x) / 2;
        const cy = (fromNode.y + toNode.y) / 2;
        ctx.save();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 22, cy - 8, 44, 16);
        ctx.fillStyle = '#555';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, cy);
        ctx.restore();
      }
    }
  }
  ctx.setLineDash([]);
}
```

- [ ] **Step 6: Commit**

```bash
git add src/core/canvas-renderer.js
git commit -m "feat(canvas): birth-death subline and marriage year on spouse connector"
```

---

## Task 14: Tree-chart renderer — birth–death subline and marriage label

**Files:**
- Modify: `src/features/tree-chart/tree-chart-renderer.js` (lines ~125-145, ~211-216)

Replace the `b. ${p.dob}` sublabel with `formatLifespanShort`. Append a `<text>` next to the existing `⚭` symbol for the marriage year.

- [ ] **Step 1: Import the formatter**

Add at the top of `src/features/tree-chart/tree-chart-renderer.js`:

```js
import { formatLifespanShort, formatDateValue } from '../../utils/date-value.js';
```

- [ ] **Step 2: Replace the `dob` sublabel logic**

Replace line 126 (`const dob = p.dob ? \`b. ${p.dob}\` : '';`) and the conditional that renders it (lines 138-145) with:

```js
const locale = (window.i18n?.currentLocale || 'en').slice(0, 2);
const lifespan = formatLifespanShort(p.birth?.date, p.death?.date, locale);

SecurityUtils.setTextContent(label, fullName);
label.setAttribute('x', cx);

if (lifespan) {
  label.setAttribute('y', n.height / 2 - 2);
  SecurityUtils.setTextContent(sublabel, lifespan);
  sublabel.setAttribute('x', cx);
  sublabel.setAttribute('y', n.height / 2 + 13);
} else {
  label.setAttribute('y', n.height / 2 + 5);
  SecurityUtils.setTextContent(sublabel, '');
}
```

- [ ] **Step 3: Add a marriage year label next to ⚭**

In the same file, find the spouse symbol creation block (lines 200-218 — the function that builds `path` + `symBg` + `sym`). After `g.appendChild(sym);` add:

```js
const marriageLabel = document.createElementNS(SVG_NS, 'text');
marriageLabel.setAttribute('class', 'tc-spouse-date-label');
marriageLabel.setAttribute('text-anchor', 'middle');
marriageLabel.setAttribute('dominant-baseline', 'central');
g.appendChild(marriageLabel);
```

Then locate the function that updates the spouse edge geometry (search for `tc-spouse-symbol` writes — typically a sibling function that positions `symBg`, `sym` based on the midpoint between two nodes). After it positions `sym`, add:

```js
// Update marriage date label position + text
const marriageLabel = g.querySelector('.tc-spouse-date-label');
if (marriageLabel) {
  const fromPerson = personById.get(edge.from);
  const toPerson = personById.get(edge.to);
  const marriage = (fromPerson?.marriages || []).find((m) => m.spouseId === edge.to)
    || (toPerson?.marriages || []).find((m) => m.spouseId === edge.from);
  if (marriage?.date?.year) {
    const text = formatDateValue({ year: marriage.date.year, estimated: !!marriage.date.estimated }, locale);
    SecurityUtils.setTextContent(marriageLabel, text);
    marriageLabel.setAttribute('x', mx);
    marriageLabel.setAttribute('y', my + 16);
  } else {
    SecurityUtils.setTextContent(marriageLabel, '');
  }
}
```

> The exact `personById`, `edge`, `mx`, `my` variable names depend on the surrounding function. **Read 50 lines above and below the `sym` positioning block** to identify the correct names before pasting. The intent: read the marriage date for the rendered edge, format it, position it slightly below the ⚭ symbol.

- [ ] **Step 4: Add a CSS rule for the marriage date label**

Append to `src/features/tree-chart/styles/tree-chart.css`:

```css
.tc-spouse-date-label {
  font-size: 10px;
  fill: #6b7280;
  pointer-events: none;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-renderer.js src/features/tree-chart/styles/tree-chart.css
git commit -m "feat(tree-chart): birth-death subline and marriage year label"
```

---

## Task 15: GEDCOM importer — extract PLAC, NOTE, MARR

**Files:**
- Modify: `src/features/import/gedcom-importer.js`

Extend `indiToPersonStub` to read `BIRT/PLAC`, `BIRT/NOTE`, `DEAT/PLAC`, `DEAT/NOTE`. Extend `linkFamily` to capture `MARR` events into both spouses' `marriages` arrays with a stable `marr_` id.

- [ ] **Step 1: Replace `indiToPersonStub`**

Replace lines 25-56 of `src/features/import/gedcom-importer.js` with:

```js
import { parseDateValue } from '../../utils/date-value.js';
import { makeMarriageId } from '../../utils/marriage-sync.js';

function indiToPersonStub(indi, sessionSalt) {
  const children = indi.children ?? [];

  const nameNode = children.find((n) => n.type === 'NAME');
  const rawName = nameNode?.value ?? '';
  const { given, surname } = parseName(rawName);

  const sexNode = children.find((n) => n.type === 'SEX');
  const gender = sexNode?.value === 'M' ? 'male' : sexNode?.value === 'F' ? 'female' : '';

  return {
    id: pointerToId(indi.data.xref_id, sessionSalt),
    name: given,
    surname,
    fatherName: '',
    maidenName: '',
    gender,
    motherId: '',
    fatherId: '',
    spouseId: '',
    birth: extractEvent(children, 'BIRT'),
    death: extractEvent(children, 'DEAT'),
    marriages: [],
    notes: ''
  };
}

function extractEvent(siblings, type) {
  const node = siblings.find((n) => n.type === type);
  if (!node) return { date: null, place: '', note: '' };
  const dateNode = node.children?.find((c) => c.type === 'DATE');
  const placeNode = node.children?.find((c) => c.type === 'PLAC');
  const noteNodes = (node.children || []).filter((c) => c.type === 'NOTE');
  return {
    date: parseGedcomDate(dateNode?.value || ''),
    place: placeNode?.value || '',
    note: noteNodes.map((n) => n.value || '').filter(Boolean).join('\n')
  };
}

function parseGedcomDate(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  // GEDCOM 5.5 qualifier prefixes
  const estPrefixes = ['ABT', 'EST', 'CAL'];
  let estimated = false;
  let body = trimmed;
  for (const p of estPrefixes) {
    if (body.toUpperCase().startsWith(`${p} `)) {
      estimated = true;
      body = body.slice(p.length + 1);
      break;
    }
  }
  // Try DD MON YYYY
  const monthShort = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const m = body.match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
  if (m) {
    const month = monthShort.indexOf(m[2].toUpperCase()) + 1;
    if (month > 0) return { year: parseInt(m[3], 10), month, day: parseInt(m[1], 10), estimated };
  }
  const yMatch = body.match(/^(\d{4})$/);
  if (yMatch) return { year: parseInt(yMatch[1], 10), estimated };
  // Fallback to numeric form
  const parsed = parseDateValue(body, { estimated });
  if (parsed && !parsed.error) return parsed;
  return null;
}
```

- [ ] **Step 2: Extend `linkFamily` to extract MARR events**

Replace lines 58-81 with:

```js
function linkFamily(fam, personMap, warnings) {
  const children = fam.children ?? [];
  const husbNode = children.find((n) => n.type === 'HUSB');
  const wifeNode = children.find((n) => n.type === 'WIFE');
  const childNodes = children.filter((n) => n.type === 'CHIL');
  const marrNode = children.find((n) => n.type === 'MARR');

  const husb = husbNode ? personMap.get(husbNode.data.pointer) : null;
  const wife = wifeNode ? personMap.get(wifeNode.data.pointer) : null;

  if (husb && wife) {
    if (!husb.spouseId) husb.spouseId = wife.id;
    if (!wife.spouseId) wife.spouseId = husb.id;

    const marriage = {
      id: makeMarriageId(),
      date: null,
      place: '',
      note: ''
    };
    if (marrNode) {
      const dateNode = marrNode.children?.find((c) => c.type === 'DATE');
      const placeNode = marrNode.children?.find((c) => c.type === 'PLAC');
      const noteNodes = (marrNode.children || []).filter((c) => c.type === 'NOTE');
      marriage.date = parseGedcomDate(dateNode?.value || '');
      marriage.place = placeNode?.value || '';
      marriage.note = noteNodes.map((n) => n.value || '').filter(Boolean).join('\n');
    }

    husb.marriages.push({ ...marriage, spouseId: wife.id });
    wife.marriages.push({ ...marriage, spouseId: husb.id });
  }

  for (const childNode of childNodes) {
    const child = personMap.get(childNode.data.pointer);
    if (!child) {
      warnings.push(`Unknown child pointer: ${childNode.data.pointer}`);
      continue;
    }
    if (husb && !child.fatherId) child.fatherId = husb.id;
    if (wife && !child.motherId) child.motherId = wife.id;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/import/gedcom-importer.js
git commit -m "feat(gedcom-import): extract birth/death PLAC and NOTE, MARR events"
```

---

## Task 16: GEDCOM exporter — emit PLAC, NOTE, full DEAT, MARR

**Files:**
- Modify: `src/features/export/exporter.js`

Extend the individual export to emit `2 PLAC` and `2 NOTE` under `BIRT`, a full `1 DEAT` block, and to attach `1 MARR` to family records.

- [ ] **Step 1: Add formatters for the new fields**

Add a helper near the top of `exporter.js`:

```js
function formatGedcomDateValue(dv) {
  if (!dv) return '';
  const monthShort = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const prefix = dv.estimated ? 'EST ' : '';
  if (typeof dv.month === 'number' && typeof dv.day === 'number') {
    return `${prefix}${dv.day} ${monthShort[dv.month - 1]} ${dv.year}`;
  }
  return `${prefix}${dv.year}`;
}
```

- [ ] **Step 2: Update the BIRT block in the individual export**

Find the BIRT emission (around line 824-828) and replace with:

```js
// Birth event
const birth = personData.birth || {};
const birthDateStr = formatGedcomDateValue(birth.date);
if (birthDateStr || birth.place || birth.note) {
  lines.push('1 BIRT');
  if (birthDateStr) lines.push(`2 DATE ${birthDateStr}`);
  if (birth.place) lines.push(`2 PLAC ${birth.place}`);
  if (birth.note) for (const noteLine of birth.note.split('\n')) lines.push(`2 NOTE ${noteLine}`);
}

// Death event
const death = personData.death || {};
const deathDateStr = formatGedcomDateValue(death.date);
if (deathDateStr || death.place || death.note) {
  lines.push('1 DEAT');
  if (deathDateStr) lines.push(`2 DATE ${deathDateStr}`);
  if (death.place) lines.push(`2 PLAC ${death.place}`);
  if (death.note) for (const noteLine of death.note.split('\n')) lines.push(`2 NOTE ${noteLine}`);
}
```

> The existing block uses `node.dob || personData.dob`. Remove the `dob`-based emission entirely — `birth.date` is now authoritative. Confirm nothing else in the export depends on `dob`.

- [ ] **Step 3: Emit MARR inside FAM blocks**

Find the FAM emission block (around line 850-882). Inside the family record (after `lines.push(\`0 ${famId} FAM\`);` and the HUSB/WIFE/CHIL writes), append:

```js
// Locate the marriage record on either spouse (prefer the husband's entry, fallback to wife's)
const marriage = (individual.personData.marriages || []).find((m) => m.spouseId === spouse.originalId)
  || (spouse.personData.marriages || []).find((m) => m.spouseId === individual.originalId);
if (marriage) {
  const marrDateStr = formatGedcomDateValue(marriage.date);
  if (marrDateStr || marriage.place || marriage.note) {
    lines.push('1 MARR');
    if (marrDateStr) lines.push(`2 DATE ${marrDateStr}`);
    if (marriage.place) lines.push(`2 PLAC ${marriage.place}`);
    if (marriage.note) for (const noteLine of marriage.note.split('\n')) lines.push(`2 NOTE ${noteLine}`);
  }
}
```

> The export currently iterates spouse pairs once via `processedFamilies`. The MARR block belongs inside that loop, before the `1 CHIL` writes. Confirm the variable names (`individual`, `spouse`) match the surrounding scope before pasting.

- [ ] **Step 4: Commit**

```bash
git add src/features/export/exporter.js
git commit -m "feat(gedcom-export): emit PLAC, NOTE, full DEAT, MARR blocks"
```

---

## Task 17: i18n — new keys in all four locales

**Files:**
- Modify: `public/assets/locales/en.json`
- Modify: `public/assets/locales/es.json`
- Modify: `public/assets/locales/ru.json`
- Modify: `public/assets/locales/de.json`

Per CLAUDE.md, every new user-visible string must exist in all four locales.

- [ ] **Step 1: Add keys to `en.json`**

Inside `builder.form` (around line 502-523), insert after `dob_help`:

```json
"birth_date": "Birth date",
"birth_place": "Birth place",
"birth_note": "Birth note",
"death_date": "Death date",
"death_place": "Death place",
"death_note": "Death note",
"estimated": "est.",
"add_place": "add place",
"add_note": "add note",
"add_marriage": "add another marriage",
"remove_marriage": "Remove marriage",
"add_general_note": "add general note",
"general_notes": "General notes",
"marriage": "Marriage",
"marriage_date": "Marriage date",
"marriage_place": "Marriage place",
"marriage_note": "Marriage note",
"marriages": "Marriages",
"marriage_autofill_offer": "Use spouse's saved values",
"marriage_autofilled": "Filled from spouse's record",
```

Inside `builder.validation`, add:

```json
"invalid_date_format": "Use dd.mm.yyyy or yyyy.",
```

Inside `builder.modals` (after the `person` sub-block), add:

```json
"confirm_change_spouse": {
  "title": "Change spouse?",
  "body": "Changing the spouse will remove this marriage from {{name}}'s record. Continue?"
},
```

- [ ] **Step 2: Add keys to `de.json` (German)**

```json
"birth_date": "Geburtsdatum",
"birth_place": "Geburtsort",
"birth_note": "Notiz zur Geburt",
"death_date": "Sterbedatum",
"death_place": "Sterbeort",
"death_note": "Notiz zum Tod",
"estimated": "ca.",
"add_place": "Ort hinzufügen",
"add_note": "Notiz hinzufügen",
"add_marriage": "weitere Ehe hinzufügen",
"remove_marriage": "Ehe entfernen",
"add_general_note": "allgemeine Notiz hinzufügen",
"general_notes": "Allgemeine Notizen",
"marriage": "Ehe",
"marriage_date": "Hochzeitsdatum",
"marriage_place": "Hochzeitsort",
"marriage_note": "Notiz zur Ehe",
"marriages": "Ehen",
"marriage_autofill_offer": "Werte des Ehepartners übernehmen",
"marriage_autofilled": "Vom Eintrag des Ehepartners übernommen",
```

Validation:

```json
"invalid_date_format": "Format: tt.mm.jjjj oder jjjj.",
```

Modal:

```json
"confirm_change_spouse": {
  "title": "Ehepartner ändern?",
  "body": "Wenn Sie den Ehepartner ändern, wird diese Ehe aus dem Datensatz von {{name}} entfernt. Fortfahren?"
}
```

- [ ] **Step 3: Add keys to `es.json` (Spanish)**

```json
"birth_date": "Fecha de nacimiento",
"birth_place": "Lugar de nacimiento",
"birth_note": "Nota de nacimiento",
"death_date": "Fecha de fallecimiento",
"death_place": "Lugar de fallecimiento",
"death_note": "Nota de fallecimiento",
"estimated": "aprox.",
"add_place": "añadir lugar",
"add_note": "añadir nota",
"add_marriage": "añadir otro matrimonio",
"remove_marriage": "Eliminar matrimonio",
"add_general_note": "añadir nota general",
"general_notes": "Notas generales",
"marriage": "Matrimonio",
"marriage_date": "Fecha de matrimonio",
"marriage_place": "Lugar de matrimonio",
"marriage_note": "Nota de matrimonio",
"marriages": "Matrimonios",
"marriage_autofill_offer": "Usar los valores guardados del cónyuge",
"marriage_autofilled": "Tomado del registro del cónyuge",
```

Validation:

```json
"invalid_date_format": "Use dd.mm.aaaa o aaaa.",
```

Modal:

```json
"confirm_change_spouse": {
  "title": "¿Cambiar cónyuge?",
  "body": "Cambiar el cónyuge eliminará este matrimonio del registro de {{name}}. ¿Continuar?"
}
```

- [ ] **Step 4: Add keys to `ru.json` (Russian)**

```json
"birth_date": "Дата рождения",
"birth_place": "Место рождения",
"birth_note": "Примечание о рождении",
"death_date": "Дата смерти",
"death_place": "Место смерти",
"death_note": "Примечание о смерти",
"estimated": "ок.",
"add_place": "добавить место",
"add_note": "добавить примечание",
"add_marriage": "добавить ещё один брак",
"remove_marriage": "Удалить брак",
"add_general_note": "добавить общее примечание",
"general_notes": "Общие примечания",
"marriage": "Брак",
"marriage_date": "Дата брака",
"marriage_place": "Место брака",
"marriage_note": "Примечание о браке",
"marriages": "Браки",
"marriage_autofill_offer": "Использовать значения супруга",
"marriage_autofilled": "Заполнено из записи супруга",
```

Validation:

```json
"invalid_date_format": "Используйте дд.мм.гггг или гггг.",
```

Modal:

```json
"confirm_change_spouse": {
  "title": "Сменить супруга?",
  "body": "Смена супруга удалит этот брак из записи {{name}}. Продолжить?"
}
```

- [ ] **Step 5: Verify JSON validity**

Run:

```bash
node -e "['en','es','ru','de'].forEach(l => JSON.parse(require('fs').readFileSync('public/assets/locales/' + l + '.json', 'utf8')))"
```

Expected: command completes silently (no parse error).

- [ ] **Step 6: Commit**

```bash
git add public/assets/locales/en.json public/assets/locales/es.json public/assets/locales/ru.json public/assets/locales/de.json
git commit -m "i18n: add rich-event keys to all four locales"
```

---

## Task 18: E2E test for the rich modal

**Files:**
- Create: `testing/tests/person-modal-rich-fields.spec.js`

Smoke-level Playwright spec covering reveal, save+reload, multiple marriages, and spouse-mirror auto-fill.

- [ ] **Step 1: Write the spec**

```js
// testing/tests/person-modal-rich-fields.spec.js
import { test, expect } from '@playwright/test';

test.describe('Person modal — rich fields', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/builder');
    await page.waitForSelector('#personModal', { state: 'attached' });
  });

  test('birth place reveal opens on click and persists', async ({ page }) => {
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'Alice');
    await page.click('#genderFemale');
    await page.fill('#personBirthDate', '30.10.1906');

    const placeReveal = page.locator('#personBirthPlaceReveal');
    await expect(placeReveal).toBeVisible();
    await placeReveal.click();
    await page.fill('#personBirthPlace', 'Riga');

    await page.click('#savePerson');

    // Reopen
    await page.dblclick('canvas#treeCanvas');
    await expect(page.locator('#personBirthPlace')).toHaveValue('Riga');
    await expect(page.locator('#personBirthPlaceReveal')).toBeHidden();
  });

  test('garbage in date input disables save', async ({ page }) => {
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'Bob');
    await page.click('#genderMale');
    await page.fill('#personBirthDate', 'garbage');
    await page.locator('#personBirthDate').blur();

    await expect(page.locator('#personBirthDate')).toHaveAttribute('aria-invalid', 'true');
    await page.click('#savePerson');
    await expect(page.locator('.error-message')).toContainText(/dd\.mm\.yyyy/);
  });

  test('estimated checkbox round-trips', async ({ page }) => {
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'Carla');
    await page.click('#genderFemale');
    await page.fill('#personBirthDate', '1895');
    await page.check('#personBirthEstimated');
    await page.click('#savePerson');

    await page.dblclick('canvas#treeCanvas');
    await expect(page.locator('#personBirthEstimated')).toBeChecked();
    await expect(page.locator('#personBirthDate')).toHaveValue('1895');
  });

  test('second marriage row appears via add button', async ({ page }) => {
    await page.click('#addPersonBtn');
    await page.fill('#personName', 'Dimitri');
    await page.click('#genderMale');
    await page.click('.marriages-add');
    const rows = page.locator('.marriage-row');
    await expect(rows).toHaveCount(2);
  });
});
```

- [ ] **Step 2: Run the spec**

Run: `npm run test:e2e -- person-modal-rich-fields.spec.js`
Expected: PASS (some tests may need to wait for Tasks 9-12 to be fully integrated; if a test fails because the renderer hasn't yet wired a node-double-click for editing, mark that test as `test.skip` and add it back during the smoke pass).

- [ ] **Step 3: Commit**

```bash
git add testing/tests/person-modal-rich-fields.spec.js
git commit -m "test(e2e): rich person fields — reveal, validation, estimated, multi-marriage"
```

---

## Task 19: Manual smoke test

**Files:** None (manual verification)

Per CLAUDE.md ("test in browser before reporting complete"). The unit and E2E suites cover behaviour; this task verifies the visual integration.

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

Open `http://localhost:4321/builder/`.

- [ ] **Step 2: Verify each surface**

- [ ] Modal: open Add Person → all fields collapsed except gender, name, surname, dates. Reveals work for place + note + general note.
- [ ] Save a person with birth `30.10.1906` (full date) → close modal → card subline shows `30 Oct 1906` — wait, **lifespan helper returns year only**, so card shows `1906`. Confirm.
- [ ] Save another person with birth `1895` and death `1956` → card shows `1895 – 1956`.
- [ ] Tick `est.` on birth `1895` → reload → card shows `est. 1895`.
- [ ] Add two persons, link as spouses, set marriage date `1956` on one of them → reload → reopen the OTHER person → marriage row already shows `1956` on its date input.
- [ ] Switch language to German → labels read `Geburtsdatum`, `Hochzeitsdatum`, etc. Card shows `ca. 1895 – 1956` for an estimated birth.
- [ ] Export GEDCOM → open downloaded `.ged` in a text editor → verify `1 BIRT`, `2 DATE`, `2 PLAC`, `2 NOTE`, `1 DEAT`, `1 MARR` blocks present.
- [ ] Re-import the same GEDCOM into a fresh tree → verify dates, places, notes, and marriages survived.

- [ ] **Step 3: Report**

If any item above fails, file a follow-up and do not mark this task complete. The whole plan is "complete" only when all 19 boxes are ticked and the smoke pass is clean.

---

## Self-Review Notes

Spec coverage check:

- Data model (DateValue, person schema, marriage list) → Tasks 1–3.
- Inline-reveal helper → Task 4.
- `<date-input>` → Task 5.
- Marriage sync (pure logic) → Task 6.
- `marriage-row` and `marriages-list` → Tasks 7–8.
- Modal HTML/CSS → Tasks 9–10.
- Modal wiring → Task 11.
- Tree-engine save flow with mirror writes → Task 12.
- Card rendering minimal (canvas + tree-chart) → Tasks 13–14.
- GEDCOM round-trip → Tasks 15–16.
- i18n → Task 17.
- E2E + manual smoke → Tasks 18–19.

No spec section is unrepresented. Type names (`DateValue`, `marriages`, `birth.date`, `death.date`) are consistent across all tasks. Function names used in later tasks (`syncMarriages`, `makeMarriageId`, `formatLifespanShort`, `formatDateValue`, `parseDateValue`, `createDateInput`, `setupInlineReveal`, `createMarriageRow`, `createMarriagesList`, `migrateToV22`) all match their definitions. All steps contain runnable commands or complete code blocks. Task 12 explicitly marks two areas where the engineer must read the surrounding code to confirm boundaries before pasting (the `handleSavePersonFromModal` body and the GEDCOM exporter pair-iteration loop) — this is intentional because the surrounding code in those files is too long to inline verbatim.

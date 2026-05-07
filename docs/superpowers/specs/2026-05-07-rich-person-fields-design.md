# Rich Person Fields — Design

**Date:** 2026-05-07
**Branch:** `feat/tree-chart-view` (or sibling feature branch — see Implementation Order)
**Status:** Draft, awaiting plan
**Scope:** Phase 1 — data + modal + minimal card update

## Goal

Make the person modal capture the genealogical detail users actually have: birth and death dates with locations, multiple marriages with dates and locations, and per-event notes. Surface the highest-impact fields on the canvas card and tree-chart card without redesigning the card layout.

The reference image the user shared (rich multi-line cards with date · location · source notes, marriage info on the connector) defines the long-term visual target. This design ships the data foundation and a minimal card update; full reference-image fidelity is a deliberate Phase 2.

## Out of scope

- Ethnicity, religion, occupation, citizenship status, source/cert IDs (visible in the reference image but not in the user's ask).
- Full multi-line card redesign with text wrapping and dynamic heights.
- Cloud sync of any kind (deferred to roadmap Phase 6).
- Date precision finer than year+month+day (no time-of-day, no half-dates like year+month-only in v1).

## Decisions locked from brainstorming

| # | Decision | Choice |
|---|---|---|
| 1 | Multi-marriage model | Schema is a list; UI shows one + "+ add another marriage" reveal |
| 2 | Modal layout | Inline reveal per optional field ("+ add place", "+ add note") |
| 3 | Comments | Per-event notes (birth/death/marriage) + general fallback note |
| 4 | Date format | Structured `{ year, month?, day?, estimated }` with `est.` checkbox; locations free text |
| 5 | Scope | Data + modal + minimal card update (death year on card, marriage date on connector) |

## Data model

### `DateValue` type

A `DateValue` is one of:

- `null` — no date set
- `{ year: 1906, estimated: false }` — year-only
- `{ year: 1906, month: 10, day: 30, estimated: false }` — full date
- The same object with `estimated: true` — renders with `est.` prefix

Constraints:

- `year` is a number when present; range hint 1000–2100 (warn outside, don't block).
- `month` ∈ `[1, 12]` and `day` ∈ `[1, 31]`. **Both must be present together** — no half-dates.
- `estimated` is always a boolean.

Display rules (locale-aware via existing i18n month names):

| Input | English | German | Russian |
|---|---|---|---|
| `{ year: 1906 }` | `1906` | `1906` | `1906` |
| `{ year: 1906, estimated: true }` | `est. 1906` | `ca. 1906` | `ок. 1906` |
| `{ year: 1906, month: 10, day: 30 }` | `30 Oct 1906` | `30. Okt. 1906` | `30 окт. 1906` |
| same + `estimated: true` | `est. 30 Oct 1906` | `ca. 30. Okt. 1906` | `ок. 30 окт. 1906` |

### Person schema (additions)

Existing `personData` keeps every current field (`id`, `name`, `fatherName`, `surname`, `maidenName`, `gender`, `motherId`, `fatherId`, `spouseId`, `photoBase64`). New fields:

```js
{
  birth: {
    date: DateValue|null,
    place: '',          // free text
    note: ''            // free text, longer-form
  },
  death: {
    date: DateValue|null,
    place: '',
    note: ''
  },
  marriages: [
    {
      id: 'marr_<rand>',     // stable client id, used for cross-spouse mirror
      spouseId: '<personId>',// '' allowed (marriage with spouse not in tree)
      date: DateValue|null,
      place: '',
      note: ''
    }
  ],
  notes: ''               // general fallback notes (revealed via "+ add general note")
}
```

### Why a stable `marriage.id`

The auto-fill / mirror logic mirrors a marriage onto both spouses' `marriages` arrays. Pairing by `(spouseA.id, spouseB.id)` is fragile when the user changes spouse mid-edit or deletes a row. A stable `marriage.id` survives those edits — both halves of the same marriage carry the same id, so updates always find their counterpart.

### Legacy `dob` and `spouseId`

Both fields stay in the schema for backward compatibility during this PR.

- `dob` becomes a derived/legacy field. New writes do not touch it. Migration parses it once into `birth.date` (best-effort: `dd.mm.yyyy`, `yyyy`). On parse failure, the raw string is preserved into `birth.note` as `Original: {raw}` so nothing is lost.
- `spouseId` becomes a derived value: `personData.spouseId = marriages[0]?.spouseId ?? ''`. Migration pushes any existing `spouseId` into `marriages[0]` with empty date/place/note. The legacy field is recomputed on every save so existing canvas/connection/searchable-select code keeps working unchanged.

### Schema version

- `version`: `2.1.0` → `2.2.0`
- `cacheFormat`: stays `enhanced`
- Migration code: `src/data/migrations/v2.2-rich-events.js` (new), follows the existing `localstorage-to-indexeddb.js` pattern. Runs on load when version `< 2.2.0`.
- Migration is idempotent — safe to run twice.

## Modal UI

### Layout (top to bottom)

```
Gender *  [Male] [Female]
Given Name *
Father's Name
Surname
Maiden Name

Birth date  [dd.mm.yyyy or yyyy]   ☐ est.
  + add place                      → reveals "Birth place" text
  + add note                       → reveals "Birth note" textarea (2 rows)

Death date  [dd.mm.yyyy or yyyy]   ☐ est.
  + add place / + add note

[Photo block — unchanged]

Mother    [searchable select]
Father    [searchable select]

Marriages
  ┌────────────────────────────────────────────────┐
  │ Spouse              [searchable select]    ✕   │  ← ✕ shown only if >1 marriage
  │ Date  [dd.mm.yyyy or yyyy]   ☐ est.            │
  │ + add place / + add note                       │
  └────────────────────────────────────────────────┘
  + add another marriage

+ add general note                  → reveals "Notes" textarea (3 rows)
```

The current `#personDob` input is renamed to `#personBirthDate` and rewired to the new `<date-input>` component. The current single `#spouseSelect` is replaced by the Marriages section.

### `<date-input>` component (new, `src/ui/components/date-input.js`)

- Markup: `<input type="text" placeholder="dd.mm.yyyy or yyyy">` plus an `est.` checkbox to its right.
- On blur: parses the text to `DateValue`. Parse failure → `aria-invalid="true"`, inline hint "Use dd.mm.yyyy or yyyy". Save is **blocked** while any date input is `aria-invalid`.
- Empty input → no error; field returns `null`.
- The checkbox writes only to `dateValue.estimated`; it does not affect parsing.
- API: `getValue() → DateValue|null`, `setValue(dv)`, dispatches a `change` CustomEvent. Used identically by birth, death, and each marriage row.
- Acceptable input formats: `dd.mm.yyyy`, `dd/mm/yyyy`, `dd-mm-yyyy`, `yyyy`. Leading zeros optional (`5.6.1899` works). Whitespace trimmed.
- Trade-off: structured dates mean "circa 1895" cannot be typed directly. The `est.` checkbox is the explicit escape hatch — user types `1895` and ticks the box. This is the deliberate consequence of the question 4 choice.

### Inline reveal helper

A small link button (`+ add place`) that, when clicked, hides itself and reveals the wrapped field, then focuses it. On modal open: if the wrapped field has a non-empty saved value, the field auto-reveals (no manual click required when editing a populated person). Implemented as a thin wrapper, not a Custom Element — vanilla DOM matching the existing modal style.

### Marriage row component (new, `src/ui/components/marriage-row.js`)

Each row owns one entry in `personData.marriages`. Each row has a stable client-side `id` from the moment it's added — the same id is later persisted as `marriage.id`.

**Auto-fill on spouse selection:**

- When the spouse dropdown changes to a person who already has a marriage record pointing to the person being edited (same `marriage.id` somewhere in their `marriages[]`), the row pre-fills date / place / note from that record.
- If the user has already typed any of those three fields, we **do not overwrite**. Instead, we show an inline hint: `Filled from {Spouse name}'s record.` with a `Use {spouse}'s values` link to opt in.

**Spouse change / row removal with prior-saved counterpart:**

- If the user changes the spouse on a row whose marriage was previously saved (so a mirror exists on the old spouse), or clicks ✕ to remove such a row, show a confirm dialog:
  > Changing the spouse will remove this marriage from {Old Spouse}'s record. Continue?
- Cancel reverts the action. This is a small modal-on-modal — only shown when needed, only for previously-saved marriages.

**Empty-spouse case:**

A row with date/place filled but spouse empty is allowed and saved as-is. This matches genealogy reality (you may know someone married in 1856 but not their partner). The marriage is not mirrored anywhere; it lives only on this person.

### Save flow

1. Validate (name, gender, every `<date-input>` either parses or is empty).
2. Build the person's new `personData` including `marriages[]`.
3. **Mirror writes**: for each marriage with a non-empty `spouseId`, locate the spouse's `personData.marriages`. Find an existing entry by `marriage.id` → update date/place/note and set `spouseId` to the saved person's id. If not found → push a mirrored entry with the same id.
4. **Mirror deletes**: for each marriage that was *removed* from the saved person's list (compared to their pre-edit state), delete the matching entry from the former spouse's marriages array (keyed by `marriage.id`).
5. Recompute the legacy single-`spouseId` derived field: `personData.spouseId = marriages[0]?.spouseId ?? ''`.
6. Existing event-bus emits (`tree:person:updated` / `tree:person:added`) fire as today; an additional event `tree:marriage:synced` fires for each mirrored spouse so the canvas/tree-chart can refresh those nodes' connectors.

### Validation

- **Required** (unchanged): name, gender.
- **No new requireds.** Birth date, death date, marriages, locations, notes — all optional.
- Each `<date-input>` must parse or be empty. Save button disabled while any is `aria-invalid`.
- Validation UI matches the existing `.form-group.error` + slide-down message pattern.

### Internationalisation

Every new user-visible string lives in all four locales (`en`, `es`, `ru`, `de`). New keys (illustrative):

```
builder.form.birth_date / birth_place / birth_note
builder.form.death_date / death_place / death_note
builder.form.estimated
builder.form.add_place / add_note / add_marriage / remove_marriage / add_general_note
builder.form.marriage / marriage_date / marriage_place / marriage_note
builder.form.general_notes
builder.modals.confirm_change_spouse.title
builder.modals.confirm_change_spouse.body
builder.validation.invalid_date_format
builder.tree.estimated_prefix      // "est." in en, "ca." in de, "ок." in ru, "aprox." in es
builder.dates.month_short.{1..12}  // already partially present; extended
```

`SecurityUtils.setTextContent` and `SecurityUtils.createElement` are used for all DOM writes — no `innerHTML`. Per-locale month names drive the `formatDateValue` display function.

## Card rendering (Phase 1 minimal)

Two changes only:

1. **Birth–death range on the card subline.** Today the canvas card shows `dob` (year). New behavior:
   - Birth only → `1895` (or `est. 1895` if estimated)
   - Birth + death → `1895 – 1956` (with prefixes if either is estimated, e.g., `est. 1895 – 1956`)
   - Death only → `– 1956`
   - Neither → no subline (unchanged)
   - Implementation: a `formatLifespanShort(birthDate, deathDate)` helper in `src/utils/date-value.js` returns the string. Both `canvas-renderer.js` and the tree-chart SVG view consume it.
2. **Marriage date on the spouse connector.** Render the *primary* marriage's year (or full date if `displayPreferences.showFullDates` is set — out of scope for this PR, default to year) as a small label centered on the spouse connector segment. "Primary" means `marriages[0]` — the first entry in the array. The pair's connector reflects only that entry; multi-marriage pairs are not shown distinctly in this PR.
   - Implementation: extend the connection drawing in `canvas-renderer.js` to accept an optional `label` field on spouse connections. Same change in tree-chart's SVG link rendering. Label uses the existing connection styling tokens.

Out of scope for Phase 1 (deferred to a follow-up):

- Multi-line card layout with location, occupation, source notes
- Per-event source/cert ID lines
- Card width auto-sizing for longer names
- Marriage-info bubble centered on the connector with date · location · note

## Migration

Single one-shot migration on file load when `version < 2.2.0`. Path: `src/data/migrations/v2.2-rich-events.js`.

For each person:

1. Initialize empty `birth`, `death` objects and empty `marriages` array, empty `notes` string if missing.
2. Parse legacy `dob` string → `birth.date`:
   - Match `dd.mm.yyyy` (and `dd/mm/yyyy`, `dd-mm-yyyy`) → full date.
   - Match `yyyy` → year-only.
   - Anything else → `birth.date = null`, append `Original: {raw}\n` to `birth.note`.
3. If legacy `spouseId` is non-empty and `marriages` is empty, push `{ id: <random>, spouseId, date: null, place: '', note: '' }`. The id is generated the same way as person ids today (`tree-engine.js#generateId`-style: short random string with a `marr_` prefix).
4. Leave `dob` and `spouseId` in place (read-only legacy mirrors).

After migration: bump file `version` to `2.2.0` and persist. Idempotent — running twice produces the same result.

GEDCOM imports targeted at fresh trees skip migration (they already produce v2.2 shape).

## GEDCOM round-trip

### Import (`src/features/import/gedcom-importer.js`)

Already extracts `BIRT/DATE` and `DEAT/DATE`. Extend:

- Pull `BIRT/PLAC` → `birth.place`.
- Pull `BIRT/NOTE` → `birth.note` (concatenated if multiple `NOTE` sub-records).
- Same for `DEAT`.
- For each `FAM` record, pull `MARR/DATE`, `MARR/PLAC`, `MARR/NOTE` → push a `marriage` entry into both partners' `marriages[]` with a freshly generated stable `id`. GEDCOM models multiple marriages as separate `FAM` records, so the loop naturally handles multi-marriage.
- Date strings from GEDCOM are parsed via the same `DateValue` parser; `ABT 1895` / `EST 1895` set `estimated: true`.

### Export (`src/features/export/exporter.js`)

Today emits `1 BIRT` + `2 DATE`. Extend:

- Emit `2 PLAC` and `2 NOTE` under `BIRT` when present.
- Emit a full `1 DEAT` block with `2 DATE` / `2 PLAC` / `2 NOTE` when `death.date` or `death.place` or `death.note` is set.
- For each marriage on the person (deduplicated across the spouse pair), emit a `1 MARR` block under the corresponding `0 FAM` record with `2 DATE` / `2 PLAC` / `2 NOTE`.
- Estimated dates serialize as `2 DATE EST {…}` per the GEDCOM 5.5 date qualifier.

## Files affected

### New

- `src/utils/date-value.js` — `DateValue` parser/formatter, `formatLifespanShort` helper
- `src/ui/components/date-input.js` — reusable date-with-estimated input component
- `src/ui/components/inline-reveal.js` — `+ add X` link → reveal helper
- `src/ui/components/marriage-row.js` — one row in the marriages list with auto-fill
- `src/ui/components/marriages-list.js` — manages add/remove of marriage rows
- `src/data/migrations/v2.2-rich-events.js` — schema migration
- `tests/unit/date-value.test.js`
- `tests/unit/marriage-sync.test.js`
- `tests/unit/migration-v2.2.test.js`
- `testing/tests/person-modal-rich-fields.spec.js` — Playwright E2E

### Modified

- `src/pages/builder.astro` — modal HTML markup (new fields, reveal links, marriage list scaffold)
- `src/ui/modals/modal.js` — populate / clear / save flow uses new components and DateValue
- `src/styles/modal.css` — new field styles, reveal-link styles, marriage row styles. (CLAUDE.md says modal CSS lives in `src/ui/styles/modal.css`; the file actually lives at `src/styles/modal.css` today. Edit it where it is — moving the file is unrelated cleanup, deliberately out of scope for this PR.)
- `src/core/tree-engine.js` — `handleSavePersonFromModal` updated for new schema, marriage bidirectional sync, derived `spouseId` recompute
- `src/core/canvas-renderer.js` — birth–death range subline; marriage date label on spouse connector
- `src/features/tree-chart/tree-chart-view.js` and accompanying CSS — same subline + connector label changes
- `src/features/import/gedcom-importer.js` — extract `PLAC`, `NOTE`, `MARR`
- `src/features/export/exporter.js` — emit `PLAC`, `NOTE`, full `DEAT`, `MARR`
- `public/assets/locales/{en,es,ru,de}.json` — new keys (all four locales updated together)

## Testing strategy

### Unit (Vitest + jsdom, `tests/unit/`)

- **`date-value.test.js`** — parser accepts `dd.mm.yyyy`, `dd/mm/yyyy`, `dd-mm-yyyy`, `yyyy`; rejects garbage; formatter produces locale-correct output for all four locales × {year-only, full, estimated}; `formatLifespanShort` covers all four combinations of present/absent birth/death.
- **`marriage-sync.test.js`** — saving person A with a marriage to B mirrors the entry on B; editing the date on A updates B's mirror by `marriage.id`; removing the marriage on A removes B's mirror; changing spouse from B to C deletes B's mirror and creates C's mirror; empty-spouse marriages stay solo (no mirroring).
- **`migration-v2.2.test.js`** — `dob: '30.10.1906'` → `birth.date: { year: 1906, month: 10, day: 30 }`; `dob: '1906'` → year-only; `dob: 'ca. 1895'` → `birth.date: null` + `birth.note: 'Original: ca. 1895'`; legacy `spouseId` migrates into `marriages[0]`; running migration twice is a no-op.

Each test file covers expected use, edge case, failure case (per CLAUDE.md testing expectations).

### E2E (Playwright, `testing/tests/`)

`person-modal-rich-fields.spec.js`:

- Open person modal → birth date input, death date input, marriages section all visible.
- "+ add place" reveals the place input and focuses it.
- Type `30.10.1906` → blur → input retains parsed display.
- Type `garbage` → save button disabled with inline error visible.
- Tick `est.` → save → reload → checkbox still ticked, value preserved.
- Add a second marriage → save → reload → both marriages visible.
- Edit person A's marriage to B (date `1956`) → open person B → marriage row pre-filled with `1956`.
- Change spouse on a previously-saved marriage → confirm dialog appears.

### Card rendering smoke test

Manual verification (per CLAUDE.md "test in browser before reporting complete"):

- Person with birth + death → card shows `1895 – 1956`.
- Person with `est.` birth → card shows `est. 1895`.
- Spouse pair with marriage date → connector shows year label.

## Implementation order (suggested, kept for the plan)

The detailed plan is the writing-plans skill's job, but a rough order:

1. `DateValue` utility + tests
2. Schema migration + tests
3. `<date-input>` + `inline-reveal` components
4. Modal: birth + death sections + per-event reveal
5. `marriage-row` + `marriages-list` + auto-fill + tests
6. Modal: marriages section integrated
7. Persistence + spouse-pair sync wired into `handleSavePersonFromModal`
8. Card subline (birth–death) on canvas + tree-chart
9. Marriage date label on spouse connector (canvas + tree-chart)
10. GEDCOM import/export extensions
11. i18n (all four locales)
12. E2E spec
13. Manual smoke + UI test in browser

## Open questions for the plan stage

Implementation-detail questions deferred to the plan stage (none affect the design):

- Where `formatDateValue` reads its locale — should pull from `window.i18n` if available, fall back to `'en'`. Verify the i18n API surface during implementation.
- Whether the marriage connector label requires a separate render pass in `canvas-renderer.js` or piggybacks on the existing connection draw call.

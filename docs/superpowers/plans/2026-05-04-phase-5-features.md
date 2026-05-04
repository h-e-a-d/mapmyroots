# Phase 5: Feature Parity & Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build/restore functionality that's currently claimed-but-missing or genuinely valuable: a working contact form, GEDCOM import (the #1 missing genealogy feature), photos per person, IndexedDB migration to unlock larger storage, and share-by-link to bridge the gap until cloud sync ships.

**Architecture:** Each task is independent and ships on its own branch. The contact form is the only addition that requires server-side execution (a Cloudflare Pages Function); the others are pure client-side enhancements that fit the existing event-driven architecture (`EventBus`, `SecurityUtils`, `RetryManager`). GEDCOM parsing happens client-side via `parse-gedcom`. Photos are stored as base64 in IndexedDB (after Task 5.4 migration) — no cloud storage. Share-by-link encodes small trees in the URL hash; large trees use Cloudflare R2 with anonymous 30-day expiry.

**Tech Stack:** `parse-gedcom` (MIT, ~10KB), Cloudflare Pages Functions, Resend (email), Cloudflare Turnstile (captcha), Cloudflare R2 (large-tree share-by-link), existing IndexedDB repository at `src/data/repositories/indexed-db-repository.js`.

**Parent Roadmap:** [`docs/ROADMAP.md`](../../ROADMAP.md) (Phase 5).

**Prerequisite:** Phase 4 (PWA & performance) merged. The site is on Cloudflare Pages with security headers, sitemap, OG images, and the service worker active.

---

## Out of scope for this phase

These come later — do not attempt them in Phase 5:

- **Cloud accounts / authentication** — explicitly deferred indefinitely (roadmap "Deferred — Cloud Foundation"). Better Auth + D1 wiring is out.
- **Real-time multi-user editing** — depends on cloud accounts; not on the roadmap.
- **GEDCOM export** — the export side is already covered by JSON export; GEDCOM export ships in Phase 6 if there's demand.
- **Photo storage in R2** — for Phase 5, photos go in IndexedDB only. R2 storage requires accounts (auth) for ownership.
- **Background sync / push notifications** — deferred indefinitely (roadmap Phase 4 "Out of scope").
- **Translating new feature UIs** — new strings are added EN-only initially; a separate translation pass syncs locales (locale parity is enforced, but translations can be EN-placeholder).

---

## Information you need before starting

These come from outside the repo and have to be obtained or decided manually.

- **Cloudflare Turnstile site.** Required for Task 5.1. Sign up at [dash.cloudflare.com/?to=/:account/turnstile](https://dash.cloudflare.com/?to=/:account/turnstile), create a widget for `mapmyroots.com`, copy the **site key** (public, used in the form) and **secret key** (private, used by the Pages Function).
- **Resend account + verified domain.** Required for Task 5.1. Sign up at [resend.com](https://resend.com/), verify `mapmyroots.com` (or use the default sender), copy the **API key**. Free tier is 3,000 emails/month — plenty for a contact form.
- **`support@mapmyroots.com` inbox.** Required for Task 5.1. Set up a forwarding email or full inbox via Cloudflare Email Routing (free, [dash.cloudflare.com/?to=/:account/:zone/email-routing](https://dash.cloudflare.com/?to=/:account/:zone/email-routing)) or the user's preferred provider before the contact form ships, or messages will bounce.
- **GEDCOM fixture files.** Required for Task 5.2. Download a few public-domain `.ged` files from FamilySearch ([familysearch.org/library/sample-gedcoms](https://www.familysearch.org/)) or use the bundled `parse-gedcom` test fixtures. Store at `tests/fixtures/gedcom/*.ged`. Need at least: a tiny family (5–10 people), a medium family (~50 people), and one with edge cases (multiple marriages, unknown parents, ABT/BEF date qualifiers).
- **Cloudflare R2 bucket.** Required for Task 5.5 (only if shipping the large-tree share path). Create a bucket at [dash.cloudflare.com/?to=/:account/r2](https://dash.cloudflare.com/?to=/:account/r2) named `mapmyroots-shares` with public read access disabled (we'll use signed URLs from a Pages Function). Skip this if Task 5.5 is descoped to URL-encoded trees only.
- **Decision: which subset of tasks to ship.** Tasks are listed in priority order: 5.4 (IndexedDB migration) and 5.2 (GEDCOM import) are highest value; 5.1 (contact form) is small and important for legitimacy; 5.3 (photos) and 5.5 (share-by-link) are nice-to-have. Default recommendation: ship 5.4 → 5.2 → 5.1 first, defer 5.3 and 5.5 to follow-up branches.

If any of the above isn't available, pause the relevant task and unblock the rest. Tasks are independent — they can ship in any order on separate branches.

---

## Branching strategy

Unlike Phases 1–4, Phase 5 does **not** ship on a single branch. Each task gets its own branch and PR:

| Task | Branch | Effort |
|------|--------|--------|
| 5.4 IndexedDB migration audit | `feat/indexeddb-migration` | 0.5 day |
| 5.2 GEDCOM import | `feat/gedcom-import` | 2–3 days |
| 5.1 Contact form | `feat/contact-form` | 0.5 day |
| 5.3 Photos per person | `feat/person-photos` | 1–2 days |
| 5.5 Share-by-link | `feat/share-by-link` | 1 day |

Recommended order: **5.4 first** (unlocks photo storage), then **5.2** (highest user value), then **5.1**, then **5.3**, then **5.5**. Each branches off `main` (after Phase 4 merges), not off the previous Phase 5 branch.

---

## Pre-flight (per-task)

Before starting any task:

- [ ] **P1: Confirm Phase 4 has merged to main.**

```bash
git checkout main
git pull
test -f dist/sw.js || npm run build
test -f dist/sw.js && echo "Phase 4 SW present"
```

- [ ] **P2: Working tree clean.**

```bash
git status  # expect: nothing to commit, working tree clean
```

- [ ] **P3: All tests still green.**

```bash
npm test -- --run  # expect: 40 unit tests passing (Phase 4 baseline)
```

---

## Task 5.4: IndexedDB Migration Audit

**Why first:** Photos (Task 5.3) require >5 MB of storage per tree, which exceeds localStorage's per-origin quota. Switching the storage layer to IndexedDB before adding photos avoids a "your tree was too big to save" failure mode users would hit immediately.

**Why now:** A repository file (`src/data/repositories/indexed-db-repository.js`) exists, but it's not clear from a static read whether it's the actual storage layer or a deprecated path. We audit and either confirm it's live (no work) or migrate.

**Files (after audit):**
- Read-only audit: `src/data/repositories/indexed-db-repository.js`, `src/data/repositories/local-storage-repository.js`, `src/core/cache/core-cache.js`, `src/core/cache/enhanced-cache.js`
- If migration needed: modify the cache layer to write to IndexedDB; add a one-time migration script that reads from localStorage on first load and writes to IndexedDB

### Step 1: Audit the current storage path

- [ ] **Step 1.1: Read the existing repository files and the cache layer.**

```bash
ls src/data/repositories/
grep -rn "localStorage\|indexedDB" src/core/cache/ src/data/repositories/ src/features/ | head -30
```

Identify: which file is responsible for `save()` calls during auto-save, and where it writes. Specifically check:
- `core-cache.js`: which repository does it call?
- `enhanced-cache.js`: which storage layer is it built on?
- Are tests in `tests/unit/data/repositories/` testing both paths or just one?

- [ ] **Step 1.2: Run the existing app and inspect DevTools storage.**

```bash
npm run dev
# Open http://localhost:4321/builder, add a person, watch what gets written.
# DevTools → Application → Storage:
#   - LocalStorage: any `mapmyroots_*` keys?
#   - IndexedDB: any database visible?
```

Document the findings as a comment in `src/data/repositories/indexed-db-repository.js` — current state of "is this active or deprecated."

- [ ] **Step 1.3: Decide the path forward.**

Three possible outcomes:
- **(a)** IndexedDB is already the active path → no migration needed, this task ships as a documentation update only. Skip to Step 4 (commit the doc).
- **(b)** localStorage is the active path; IndexedDB exists but unused → migration needed. Continue with Step 2.
- **(c)** Both are active, weirdly inconsistent → fix the inconsistency, pick one (IndexedDB), continue with Step 2.

### Step 2: Implement the migration (if needed)

- [ ] **Step 2.1: Write a unit test for the migration first.**

Create `tests/unit/data/migrations/localstorage-to-indexeddb.test.js`. Test cases:
- Empty localStorage → no-op, IndexedDB stays empty.
- Single tree in localStorage → migrated to IndexedDB, localStorage entry kept (don't delete on first migration).
- Multiple trees → all migrated.
- Tree already exists in IndexedDB → preserved; no overwrite.
- Run twice → idempotent (second run is a no-op).

- [ ] **Step 2.2: Implement `src/data/migrations/localstorage-to-indexeddb.js`.**

Pattern:
```javascript
import { LocalStorageRepository } from '../repositories/local-storage-repository.js';
import { IndexedDbRepository } from '../repositories/indexed-db-repository.js';

const MIGRATION_FLAG_KEY = 'mapmyroots_migration_v1';

export async function migrateLocalStorageToIndexedDb() {
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'done') return;
  const ls = new LocalStorageRepository();
  const idb = new IndexedDbRepository();
  await idb.open();
  const trees = await ls.listAll();
  for (const tree of trees) {
    const existing = await idb.findById(tree.id);
    if (!existing) await idb.save(tree);
  }
  localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
}
```

- [ ] **Step 2.3: Wire migration into app boot.**

In `src/pages/builder.astro`'s init script (after the imports), call:
```javascript
import { migrateLocalStorageToIndexedDb } from '@/data/migrations/localstorage-to-indexeddb.js';
await migrateLocalStorageToIndexedDb().catch((err) => console.error('[migration] failed:', err));
```

The `.catch()` is critical — a migration failure must not block the builder from loading.

- [ ] **Step 2.4: Switch `core-cache.js` to use `IndexedDbRepository`.**

Find the repository instantiation in `core-cache.js` (or `enhanced-cache.js`) and swap `LocalStorageRepository` for `IndexedDbRepository`. Keep the localStorage path importable (for the migration step), but stop using it for new writes.

### Step 3: Verify

- [ ] **Step 3.1: All existing tests pass.**

```bash
npm test -- --run
```

- [ ] **Step 3.2: E2E smoke test.**

```bash
npx playwright test --grep "auto-save" --headed
```

Manually: load the builder; create a tree; refresh; tree persists. Open DevTools → IndexedDB → confirm the database `mapmyroots` (or whatever the existing repo names it) has the new entry.

- [ ] **Step 3.3: Migration smoke test.**

```bash
# 1. Check out main (pre-migration) and load the builder; create a tree there.
git checkout main
npm run dev
# Browser: create tree, save, close.

# 2. Switch back to feat branch with migration.
git checkout feat/indexeddb-migration
npm run dev
# Browser: load builder. Tree should appear without manual import.

# Inspect:
#   DevTools → LocalStorage: original keys still there
#   DevTools → IndexedDB: same tree present
#   DevTools → LocalStorage[mapmyroots_migration_v1]: 'done'
```

### Step 4: Commit

- [ ] **Step 4.1: Stage and commit.**

```bash
git add src/data/migrations src/data/repositories src/core/cache tests/unit/data/migrations
git commit -m "feat(storage): migrate persistence from localStorage to IndexedDB"
```

---

## Task 5.2: GEDCOM Import

**Why:** GEDCOM is the universal genealogy interchange format. Import is the #1 missing feature for users migrating from Ancestry / MyHeritage / FamilySearch — currently the FAQ apologizes for not supporting it.

**Files:**
- Modify: `package.json` (add `parse-gedcom`)
- Create: `src/features/import/gedcom-importer.js` (GEDCOM AST → MapMyRoots person/relationship mapping)
- Create: `src/features/import/gedcom-importer.test.js` (unit tests with fixture files)
- Create: `tests/fixtures/gedcom/{tiny,medium,edge-cases}.ged` (test fixtures)
- Create: `src/ui/modals/import-gedcom-modal.js` + `src/ui/modals/import-gedcom-modal.html` (UI)
- Modify: `src/pages/builder.astro` (add Import button to toolbar; wire modal)
- Modify: `public/assets/locales/{en,de,es,ru}.json` (new strings: `import.gedcom.title`, `import.gedcom.button`, etc.)
- Modify: `src/pages/index.astro` (FAQ — remove "we don't support GEDCOM" answer; replace with import instructions)

### Step 1: Install dependencies and gather fixtures

- [ ] **Step 1.1: Install `parse-gedcom`.**

```bash
npm install parse-gedcom
```

- [ ] **Step 1.2: Add GEDCOM fixture files.**

```bash
mkdir -p tests/fixtures/gedcom
# Download/copy at least three .ged files:
#   - tests/fixtures/gedcom/tiny.ged (5–10 INDI records)
#   - tests/fixtures/gedcom/medium.ged (~50 INDI records, several FAMs)
#   - tests/fixtures/gedcom/edge-cases.ged (multiple marriages, ABT/BEF dates, missing fields, special chars)
```

If no public-domain fixtures are available, write minimal ones by hand (GEDCOM is plain text — see Step 1.3 for the format).

- [ ] **Step 1.3: Document the GEDCOM tags this importer will support.**

Create or update `src/features/import/SUPPORTED_TAGS.md`:

```markdown
# Supported GEDCOM Tags

## Required (MUST be present for any meaningful import)
- `0 @<id>@ INDI`    — Individual record (becomes a Person)
- `1 NAME <given> /<surname>/`  — Person name
- `0 @<id>@ FAM`     — Family record (becomes parent-child relationships)
- `1 HUSB @<id>@`, `1 WIFE @<id>@`, `1 CHIL @<id>@`  — Family connections

## Supported (extracted if present)
- `1 BIRT` / `2 DATE` — Date of birth (with ABT/BEF/AFT qualifiers preserved)
- `1 DEAT` / `2 DATE` — Date of death
- `1 MARR` / `2 DATE` — Marriage date (on the FAM record)
- `1 SEX M|F`         — Gender; mapped to MapMyRoots gender field
- `1 BIRT` / `2 PLAC` — Birth place (mapped to MapMyRoots `placeOfBirth`)
- `1 DEAT` / `2 PLAC` — Death place
- `1 NOTE`            — Notes (mapped to MapMyRoots `notes`)

## Ignored (not yet mapped)
- `1 SOUR`, `1 OBJE`, `1 RIN`, `1 _UID`, `1 CHAN`, etc. — sources, multimedia, IDs, change records.
  These are silently dropped on import; preserved as raw GEDCOM in a `gedcom_raw` field on each Person for round-trip-ability.
```

### Step 2: Implement the importer (TDD)

- [ ] **Step 2.1: Write the test file first.**

Create `tests/unit/features/import/gedcom-importer.test.js`:

```javascript
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importFromGedcom } from '../../../../src/features/import/gedcom-importer.js';

const fixture = (name) => readFileSync(join(__dirname, '..', '..', '..', 'fixtures', 'gedcom', name), 'utf-8');

describe('importFromGedcom', () => {
  it('parses a tiny GEDCOM into MapMyRoots persons', () => {
    const result = importFromGedcom(fixture('tiny.ged'));
    expect(result.persons).toHaveLength(/* expected count from tiny.ged */);
    expect(result.persons[0]).toMatchObject({
      id: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String)
    });
  });

  it('extracts birth dates with qualifiers preserved', () => {
    const result = importFromGedcom(fixture('edge-cases.ged'));
    const withAbtBirth = result.persons.find(p => p.birthDate?.startsWith('ABT'));
    expect(withAbtBirth).toBeDefined();
  });

  it('builds parent-child relationships from FAM records', () => {
    const result = importFromGedcom(fixture('tiny.ged'));
    const child = result.persons.find(p => p.fatherId || p.motherId);
    expect(child).toBeDefined();
  });

  it('handles multiple marriages', () => {
    const result = importFromGedcom(fixture('edge-cases.ged'));
    const personWithMultipleSpouses = result.persons.find(p => Array.isArray(p.spouseIds) && p.spouseIds.length > 1);
    expect(personWithMultipleSpouses).toBeDefined();
  });

  it('preserves raw GEDCOM record on each person', () => {
    const result = importFromGedcom(fixture('tiny.ged'));
    expect(result.persons[0].gedcom_raw).toMatch(/^0 @\w+@ INDI/);
  });

  it('returns parse warnings for unrecognized tags without throwing', () => {
    const result = importFromGedcom(fixture('edge-cases.ged'));
    expect(result.warnings).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 2.2: Implement `src/features/import/gedcom-importer.js`.**

Skeleton:
```javascript
import { parse as parseGedcom } from 'parse-gedcom';

/**
 * Parse a GEDCOM string and return MapMyRoots-shaped persons + warnings.
 * @param {string} gedcomText
 * @returns {{ persons: Person[], warnings: string[] }}
 */
export function importFromGedcom(gedcomText) {
  const ast = parseGedcom(gedcomText);
  const persons = new Map();
  const families = new Map();
  const warnings = [];

  for (const node of ast) {
    if (node.tag === 'INDI') persons.set(node.pointer, indiToPerson(node, gedcomText));
    if (node.tag === 'FAM') families.set(node.pointer, node);
  }

  for (const fam of families.values()) {
    linkFamily(fam, persons, warnings);
  }

  return { persons: Array.from(persons.values()), warnings };
}

function indiToPerson(indi, gedcomText) {
  // Extract NAME, SEX, BIRT/DATE, BIRT/PLAC, DEAT/DATE, DEAT/PLAC, NOTE
  // Generate a MapMyRoots ID (UUID or stable hash of pointer)
  // Set gedcom_raw to the substring of gedcomText covering this record
  // ...
}

function linkFamily(fam, persons, warnings) {
  // For each CHIL @<id>@, set fatherId/motherId based on HUSB/WIFE
  // For HUSB+WIFE, push into spouseIds[] on each
  // ...
}
```

Iterate against the test file until all tests pass.

### Step 3: Build the import modal UI

- [ ] **Step 3.1: Create modal HTML and JS.**

`src/ui/modals/import-gedcom-modal.html`:
```html
<div id="importGedcomModal" class="modal" role="dialog" aria-modal="true" aria-labelledby="importGedcomTitle" hidden>
  <div class="modal-content">
    <header>
      <h2 id="importGedcomTitle" data-i18n="import.gedcom.title">Import from GEDCOM</h2>
      <button type="button" class="modal-close" aria-label="Close">&times;</button>
    </header>
    <div class="modal-body">
      <p data-i18n="import.gedcom.intro">Import a family tree from a GEDCOM file (.ged). GEDCOM is the universal interchange format used by Ancestry, MyHeritage, FamilySearch, and most genealogy software.</p>

      <input type="file" id="gedcomFileInput" accept=".ged,text/plain" />

      <div id="gedcomPreview" hidden>
        <h3 data-i18n="import.gedcom.preview">Preview</h3>
        <ul id="gedcomPreviewList"></ul>
        <p id="gedcomPreviewSummary"></p>
      </div>

      <div id="gedcomConflicts" hidden>
        <h3 data-i18n="import.gedcom.conflicts">Existing tree detected</h3>
        <p data-i18n="import.gedcom.conflictsBody">Choose how to handle the existing tree:</p>
        <label><input type="radio" name="conflictMode" value="replace" checked /> <span data-i18n="import.gedcom.replace">Replace it</span></label>
        <label><input type="radio" name="conflictMode" value="merge" /> <span data-i18n="import.gedcom.merge">Merge new persons</span></label>
      </div>
    </div>
    <footer class="modal-actions">
      <button type="button" id="gedcomCancel" class="btn-secondary" data-i18n="common.cancel">Cancel</button>
      <button type="button" id="gedcomImport" class="btn-primary" disabled data-i18n="import.gedcom.button">Import</button>
    </footer>
  </div>
</div>
```

`src/ui/modals/import-gedcom-modal.js`:
- File picker → `FileReader.readAsText()` → call `importFromGedcom`
- Show preview list (first 10 persons + total count)
- Detect conflict (existing tree has persons): show conflict-mode radios
- On Import click: emit `EVENTS.TREE_GEDCOM_IMPORTED` with persons + conflictMode
- Use `SecurityUtils.setTextContent()` for any user-supplied strings

- [ ] **Step 3.2: Wire the modal into `builder.astro`.**

Add an Import button next to existing Save/Load. On click, open the modal. Listen for `EVENTS.TREE_GEDCOM_IMPORTED` in the tree core; apply the persons via existing `addPerson()` / `addRelationship()` helpers.

### Step 4: Localization

- [ ] **Step 4.1: Add the new strings to all four locale JSONs.**

Keys to add: `import.gedcom.title`, `import.gedcom.intro`, `import.gedcom.button`, `import.gedcom.preview`, `import.gedcom.conflicts`, `import.gedcom.conflictsBody`, `import.gedcom.replace`, `import.gedcom.merge`.

Add EN translations in `en.json`. Add identical EN values in `de.json`, `es.json`, `ru.json` as placeholder — flag for translator follow-up. (The build-time `t()` helper will warn in dev about the missing translation; that's expected.)

### Step 5: FAQ updates

- [ ] **Step 5.1: Update the FAQ in `src/pages/index.astro`.**

Find the FAQ entry "Can I import data from Ancestry.com or other services?" and update both the question text and the FAQPage JSON-LD entry. New answer:

```
Yes! Use the Import button in the builder to load a GEDCOM file (.ged) — the universal genealogy format supported by Ancestry, MyHeritage, FamilySearch, and most genealogy software. From those services, export your tree as GEDCOM, then import it here.
```

Update all four locale JSONs to mirror.

### Step 6: Verify

- [ ] **Step 6.1: All unit tests green.**

```bash
npm test -- --run
```

- [ ] **Step 6.2: E2E smoke test.**

Add a Playwright test at `testing/tests/import-gedcom.spec.js` that:
1. Loads the builder.
2. Clicks Import.
3. Uploads `tests/fixtures/gedcom/tiny.ged`.
4. Confirms the preview shows the right person count.
5. Clicks Import.
6. Confirms the canvas has the right number of nodes.

```bash
npm run test:e2e -- --grep "GEDCOM"
```

- [ ] **Step 6.3: Manual real-world test.**

Export a real tree from Ancestry.com (or MyHeritage), import it, confirm names/dates/relationships are correct. (This is a manual gate — automated fixtures can't catch every real-world quirk.)

### Step 7: Commit

```bash
git add package.json package-lock.json src/features/import src/ui/modals/import-gedcom-modal.* src/pages/builder.astro src/pages/index.astro public/assets/locales tests
git commit -m "feat(import): GEDCOM import via parse-gedcom with modal UI"
```

---

## Task 5.1: Contact Form (Cloudflare Pages Function + Resend + Turnstile)

**Why:** The contact page currently has no form — users must `mailto:` directly, which is friction. A real form with anti-spam (Turnstile) and email forwarding (Resend) is small to build and meaningful for legitimacy.

**Files:**
- Create: `functions/api/contact.ts` (Cloudflare Pages Function)
- Modify: `src/pages/contact.astro` (add form HTML + Turnstile widget)
- Modify: `public/_headers` (allow Turnstile in CSP)
- Modify: `public/assets/locales/{en,de,es,ru}.json` (form strings)

### Step 1: Set up Cloudflare Pages Functions scaffolding

- [ ] **Step 1.1: Verify `functions/` directory.**

Cloudflare Pages auto-detects `functions/` at the project root (sibling of `src/` and `public/`). No build config needed beyond the existing Astro setup.

```bash
mkdir -p functions/api
```

- [ ] **Step 1.2: Create `functions/api/contact.ts`.**

```typescript
interface Env {
  TURNSTILE_SECRET_KEY: string;
  RESEND_API_KEY: string;
  CONTACT_TO_EMAIL: string;  // e.g. "support@mapmyroots.com"
  CONTACT_FROM_EMAIL: string; // e.g. "noreply@mapmyroots.com" (must be Resend-verified)
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: { name?: string; email?: string; message?: string; cfToken?: string; honeypot?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError(400, 'Invalid JSON');
  }

  // Honeypot — if filled, silently 200 (don't tell the bot)
  if (body.honeypot) return new Response(JSON.stringify({ ok: true }), { status: 200 });

  // Validate fields
  if (!body.name || !body.email || !body.message || !body.cfToken) {
    return jsonError(400, 'Missing required fields');
  }
  if (!isValidEmail(body.email)) return jsonError(400, 'Invalid email');
  if (body.message.length > 5000) return jsonError(400, 'Message too long');

  // Verify Turnstile
  const tsResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: env.TURNSTILE_SECRET_KEY,
      response: body.cfToken,
      remoteip: request.headers.get('CF-Connecting-IP') ?? ''
    })
  });
  const tsResult = await tsResponse.json<{ success: boolean }>();
  if (!tsResult.success) return jsonError(403, 'Turnstile verification failed');

  // Send via Resend
  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.CONTACT_FROM_EMAIL,
      to: env.CONTACT_TO_EMAIL,
      reply_to: body.email,
      subject: `Contact form: ${body.name}`,
      text: `From: ${body.name} <${body.email}>\n\n${body.message}`
    })
  });

  if (!resendResponse.ok) {
    const err = await resendResponse.text();
    console.error('Resend error:', err);
    return jsonError(502, 'Email delivery failed');
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
};

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
```

### Step 2: Add the form to `contact.astro`

- [ ] **Step 2.1: Replace the static contact info with a real form.**

Find the contact card section in `src/pages/contact.astro` and add (in addition to or instead of the email link):

```astro
<form id="contactForm" class="contact-form" novalidate>
  <label>
    <span data-i18n="contact.form.name">Your name</span>
    <input type="text" name="name" required maxlength="100" autocomplete="name" />
  </label>
  <label>
    <span data-i18n="contact.form.email">Email</span>
    <input type="email" name="email" required maxlength="200" autocomplete="email" />
  </label>
  <label>
    <span data-i18n="contact.form.message">Message</span>
    <textarea name="message" required minlength="10" maxlength="5000" rows="6"></textarea>
  </label>

  <!-- Honeypot — hidden from users, attractive to bots -->
  <input type="text" name="honeypot" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px;" aria-hidden="true" />

  <!-- Turnstile widget -->
  <div class="cf-turnstile" data-sitekey="__TURNSTILE_SITE_KEY__" data-theme="light"></div>

  <button type="submit" id="contactSubmit" class="btn-primary" data-i18n="contact.form.submit">Send</button>
  <p id="contactStatus" role="status" aria-live="polite"></p>
</form>

<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer is:inline></script>

<script>
  const form = document.getElementById('contactForm');
  const status = document.getElementById('contactStatus');
  const submitBtn = document.getElementById('contactSubmit');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    status.textContent = 'Sending...';

    const data = Object.fromEntries(new FormData(form));
    const cfToken = form.querySelector('input[name="cf-turnstile-response"]')?.value;

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, cfToken })
      });
      const body = await res.json();
      if (body.ok) {
        status.textContent = 'Message sent. We\'ll reply soon.';
        form.reset();
        if (window.turnstile) window.turnstile.reset();
      } else {
        status.textContent = `Error: ${body.error}`;
      }
    } catch (err) {
      status.textContent = 'Network error — please try again.';
    } finally {
      submitBtn.disabled = false;
    }
  });
</script>
```

Replace `__TURNSTILE_SITE_KEY__` with the real site key from Cloudflare. (Public — fine to commit.)

### Step 3: Update CSP to allow Turnstile

- [ ] **Step 3.1: Edit `public/_headers`.**

Add `https://challenges.cloudflare.com` to `script-src` and `frame-src` in the global CSP. The Turnstile widget loads from there and renders in an iframe.

### Step 4: Set Cloudflare Pages env vars

- [ ] **Step 4.1: Document the manual env-var setup in `docs/CLOUDFLARE_PAGES_SETUP.md`.**

Append:
```markdown
## Phase 5 environment variables

After the contact form ships, set these in Cloudflare Pages → Settings → Environment Variables:

| Variable | Scope | Value |
|----------|-------|-------|
| `TURNSTILE_SECRET_KEY` | Production + Preview | (from Cloudflare Turnstile dashboard) |
| `RESEND_API_KEY` | Production only | (from Resend dashboard; preview env can use a test key) |
| `CONTACT_TO_EMAIL` | Production + Preview | `support@mapmyroots.com` |
| `CONTACT_FROM_EMAIL` | Production + Preview | `noreply@mapmyroots.com` (must be Resend-verified) |
```

### Step 5: Verify

- [ ] **Step 5.1: Local dev with `wrangler pages dev`.**

```bash
npx wrangler pages dev dist --port 4321 \
  --binding TURNSTILE_SECRET_KEY=<dev-key> \
  --binding RESEND_API_KEY=<dev-key> \
  --binding CONTACT_TO_EMAIL=test@example.com \
  --binding CONTACT_FROM_EMAIL=noreply@mapmyroots.com
```

(`astro preview` doesn't run Pages Functions — `wrangler pages dev` does.)

- [ ] **Step 5.2: Submit the form, watch logs.**

The form should display the Turnstile widget; on submit, the function should be invoked, Turnstile verified, and an email sent (or a test response).

- [ ] **Step 5.3: PR preview test.**

Open a PR on the `feat/contact-form` branch. Cloudflare Pages auto-deploys a preview URL. Submit the form on the preview URL; confirm the email arrives at `support@mapmyroots.com`.

### Step 6: Commit

```bash
git add functions src/pages/contact.astro public/_headers public/assets/locales docs/CLOUDFLARE_PAGES_SETUP.md
git commit -m "feat(contact): contact form via Cloudflare Pages Function + Resend + Turnstile"
```

---

## Task 5.3: Photos Per Person

**Why:** Photos make family trees visceral. Every genealogy product has them. Currently MapMyRoots has zero photo support — adding it closes a major usability gap.

**Prerequisite:** Task 5.4 (IndexedDB migration) must merge first. localStorage's 5 MB quota is too small for even a few photos.

**Files:**
- Modify: `src/data/schemas/person.js` (add `photoBase64` field, validate)
- Modify: `src/ui/modals/person-modal.js` + `.html` (add file picker + preview)
- Modify: `src/core/canvas/render.js` (or wherever the node fill is drawn — render photo as node fill)
- Modify: existing JSON schema validators
- Modify: `src/pages/index.astro` (FAQ — add "Can I add photos?" answer; remove "photos planned but not shipped" note)

### Step 1: Schema and storage

- [ ] **Step 1.1: Update the Person schema to allow `photoBase64`.**

Add field to `src/data/schemas/person.js`:
```javascript
photoBase64: z.string().optional() // data URL: "data:image/jpeg;base64,/9j/..."
```

Validate the data URL format (`data:image/(jpeg|png|webp);base64,...`).

- [ ] **Step 1.2: Limit photo size in the schema.**

Reject photos larger than ~500 KB after base64 encoding. Show a user-facing error in the modal if this fails.

- [ ] **Step 1.3: Add migration for trees without photos.**

Existing trees have no `photoBase64` field; the schema accepts that (field is optional). No migration script needed — but add a unit test confirming the load path is unchanged.

### Step 2: Modal UI

- [ ] **Step 2.1: Add photo upload to the person modal.**

```html
<div class="photo-section">
  <label data-i18n="person.photo.label">Photo</label>
  <div class="photo-preview">
    <img id="personPhotoPreview" alt="" hidden />
    <span id="personPhotoPlaceholder" aria-hidden="true">📷</span>
  </div>
  <input type="file" id="personPhotoInput" accept="image/jpeg,image/png,image/webp" />
  <button type="button" id="personPhotoRemove" hidden data-i18n="person.photo.remove">Remove</button>
  <p class="photo-hint" data-i18n="person.photo.hint">JPG, PNG, or WebP. Max 500 KB. Photos are stored locally.</p>
</div>
```

JS:
- On file select: read with `FileReader.readAsDataURL`; if size > 500 KB, show error; otherwise resize to 256×256 via `<canvas>` and store the result as the `photoBase64`.
- Resize logic: load → draw to off-screen canvas at 256×256 (cover fit) → `toDataURL('image/jpeg', 0.85)` → that's what gets stored. Keeps storage tight.
- On Remove: clear `photoBase64`, reset preview.

### Step 3: Canvas render

- [ ] **Step 3.1: Render photos as the node fill.**

In the canvas renderer (`src/core/canvas/render.js` or similar), when a node has `photoBase64`, draw the photo clipped to the node circle:

```javascript
if (person.photoBase64) {
  const img = imageCache.get(person.id) ?? loadImage(person.photoBase64);
  if (img.complete) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, node.x - node.radius, node.y - node.radius, node.radius * 2, node.radius * 2);
    ctx.restore();
  }
}
```

Cache decoded `Image` objects keyed by person ID; invalidate cache entry on photo change.

- [ ] **Step 3.2: Performance check.**

For a 50-person tree with all photos: rendering should stay above 30fps during pan/zoom. If it drops, add OffscreenCanvas-based pre-decoded images.

### Step 4: Storage warning

- [ ] **Step 4.1: Add a localStorage/IDB usage indicator.**

Estimate `navigator.storage.estimate()` (returns `{ quota, usage }`). If usage > 80% of quota, show a non-blocking toast: "Storage almost full. Consider exporting your tree."

### Step 5: FAQ update

- [ ] **Step 5.1: Add or update the FAQ entry on photos.**

Update `src/pages/index.astro` and the matching `meta.faq.*` keys in all four locales. Replace any "Photos are planned but not yet shipped" copy with "Yes — add a photo when you create or edit a person. Photos are stored on your device."

### Step 6: Verify

- [ ] **Step 6.1: Unit tests for the schema.**
- [ ] **Step 6.2: E2E test for upload + render.**
- [ ] **Step 6.3: Manual: import a tree, add photos to 5 people, refresh, confirm photos persist.**
- [ ] **Step 6.4: Visual regression: existing tree without photos still renders identically.**

### Step 7: Commit

```bash
git commit -m "feat(person): add photo support — file upload, canvas render, storage warning"
```

---

## Task 5.5: Share-by-Link

**Why:** Lets users share a read-only view of their tree without creating an account. Bridges the gap until full cloud sync ships (which is deferred indefinitely).

**Files:**
- Create: `src/pages/view.astro` (read-only tree viewer)
- Modify: `src/ui/modals/share-modal.js` + `.html` (Share button → modal with link)
- Conditionally create: `functions/api/share.ts` (R2 upload for large trees)
- Conditionally create: `functions/api/share/[id].ts` (R2 download)

### Step 1: Decide URL-only vs URL + R2

- [ ] **Step 1.1: Audit max URL size that browsers accept.**

Most browsers cap URLs at ~8 KB; some at ~32 KB. After base64 + URL encoding, raw tree JSON of ~5 KB fits comfortably; beyond ~10 KB persons start to overflow.

Decision: ship URL-only first (Phase 5.5a). Defer R2 to Phase 5.5b only if usage data shows trees are routinely larger than that. Most users have <50 persons, well under 5 KB JSON.

### Step 2: URL-only sharing

- [ ] **Step 2.1: Create `src/pages/view.astro`.**

```astro
---
import BuilderLayout from '@/layouts/BuilderLayout.astro';
---

<BuilderLayout
  title="View family tree - MapMyRoots"
  description="View a shared family tree."
  canonicalPath="/view"
>
  <div id="viewContainer">
    <div id="viewLoading">Loading tree...</div>
    <canvas id="viewCanvas"></canvas>
  </div>

  <script>
    import { decodeTreeFromHash } from '@/features/share/url-codec.js';
    import { renderReadOnly } from '@/features/share/read-only-render.js';

    const params = new URLSearchParams(window.location.search);
    const data = params.get('d');
    if (data) {
      try {
        const tree = decodeTreeFromHash(data);
        renderReadOnly(document.getElementById('viewCanvas'), tree);
      } catch (err) {
        document.getElementById('viewLoading').textContent = 'Invalid share link.';
      }
    } else {
      document.getElementById('viewLoading').textContent = 'No tree data in URL.';
    }
  </script>
</BuilderLayout>
```

- [ ] **Step 2.2: Implement the codec.**

`src/features/share/url-codec.js`:
- `encodeTreeToHash(tree)`: JSON-stringify → gzip via `CompressionStream` (Web API, native) → base64url-encode.
- `decodeTreeFromHash(s)`: base64url-decode → gunzip via `DecompressionStream` → JSON.parse.

Compression is ~5× for tree JSON (lots of repeated keys), making URLs feasible for trees up to ~40 persons.

- [ ] **Step 2.3: Implement the read-only renderer.**

Reuse the existing canvas rendering pipeline but without selection / drag / edit handlers. Just `render()` once.

- [ ] **Step 2.4: Share modal.**

Add a Share button in the builder. Modal generates the URL, shows a copy field, and offers a "Show in new tab" button. Optional: QR code via `qrcode-svg` (~2 KB).

### Step 3: (Optional, defer) R2 path for large trees

If shipping the R2 path:
- [ ] Create R2 bucket `mapmyroots-shares`.
- [ ] `functions/api/share.ts`: POST endpoint accepts compressed tree, generates random ID, writes to R2, returns ID.
- [ ] `functions/api/share/[id].ts`: GET returns the tree (or 404 / 410 expired).
- [ ] R2 lifecycle policy: delete after 30 days.
- [ ] Update share modal to use this path when tree size > URL threshold.

### Step 4: Verify

- [ ] Share a tiny tree → URL works → recipient sees identical tree (read-only).
- [ ] Share a tree at the URL size limit → still works.
- [ ] Try to edit on `/view` → no edit handlers fire (UI is correctly read-only).
- [ ] Lighthouse on `/view` ≥ 90.

### Step 5: Commit

```bash
git commit -m "feat(share): read-only tree share via compressed URL hash"
```

---

## Final verification (per task)

For each Phase 5 task PR, before merging:

- [ ] **Step 1: Tests pass.** `npm test -- --run` and `npm run test:e2e`.
- [ ] **Step 2: Lighthouse-CI green.** Phase 4's tightened thresholds (0.95 across all categories) still pass on PR preview.
- [ ] **Step 3: A11y audit green.** Run the axe-core audit from Phase 4 on any new pages/modals; zero serious/critical violations.
- [ ] **Step 4: Locale parity.** New strings present in all four locale JSONs (EN-placeholder OK).
- [ ] **Step 5: FAQ updated.** Any user-visible feature change is reflected in the FAQ on the homepage and in all four locale JSONs.
- [ ] **Step 6: PR preview tested manually.**

---

## Phase 5 complete (per task)

Each task's PR is independent. Merge order recommendation:

1. `feat/indexeddb-migration` → unblocks 5.3
2. `feat/gedcom-import` → highest user value
3. `feat/contact-form` → small, ships when external setup ready
4. `feat/person-photos` → requires #1 above
5. `feat/share-by-link` → optional polish

After all five: tag `v2.2.0` (or whatever version captures the new features), update README to mention GEDCOM import + photos + sharing.

Phase 6 (content growth) runs in parallel with all of these — it doesn't block on any Phase 5 task.

---

## Self-review

**1. Spec coverage** vs. roadmap Phase 5:
- [x] 5.1 Contact form (CF Pages Function + Resend + Turnstile) — Task 5.1
- [x] 5.2 GEDCOM import — Task 5.2
- [x] 5.3 Photos per person — Task 5.3
- [x] 5.4 IndexedDB migration audit — Task 5.4
- [x] 5.5 Share-by-link (no accounts needed) — Task 5.5

**2. Placeholders.** Real placeholders the executor must resolve manually:
- Cloudflare Turnstile site key + secret (Task 5.1)
- Resend API key + verified sender domain (Task 5.1)
- `support@mapmyroots.com` inbox configured (Task 5.1)
- GEDCOM fixture files (Task 5.2)
- Cloudflare R2 bucket (Task 5.5b only — deferred)

These are explicit and called out in "Information you need before starting."

**3. Type/path consistency.** Pages Functions live at `functions/` (root sibling), per Cloudflare convention. Each feature's UI logic lives at `src/features/<name>/` matching existing conventions (e.g., `src/features/i18n/`, `src/features/export/`). Modals live at `src/ui/modals/` matching existing patterns. Tests live at `tests/unit/<matching path>/`.

**4. Sequencing.**
- Tasks are independent across branches; no inter-task deps EXCEPT Task 5.3 (photos) requires Task 5.4 (IndexedDB) merged first.
- Within each task: schema/storage → UI → wiring → tests → verification — TDD-style.
- Task 5.5 has an optional R2 sub-step that's intentionally split into 5.5a (URL-only) and 5.5b (R2) to ship the simpler path first.

**5. Testing strategy.** Each task has unit + E2E coverage. Phase 4's Lighthouse-CI and axe-core gates apply automatically on PR preview deploys.

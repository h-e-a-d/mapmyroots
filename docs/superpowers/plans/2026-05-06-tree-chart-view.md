# Tree Chart View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third view to the builder — an automatically-laid-out, org-chart-style genealogy view alongside the existing Graphic and Table views, with clan coloring, lineage highlighting on click, and a parking area for unrelated persons.

**Architecture:** New SVG-based module under `src/features/tree-chart/`. Six pure-function/renderer files plus CSS. Builder integration replaces the existing 2-state view toggle with a 3-way segmented control. The existing `CanvasRenderer`, `GenerationCalculator`, `TreeEngine`, and data model are untouched.

**Tech Stack:** Vanilla JS ES modules, SVG (no canvas for this view), Vitest + jsdom for unit tests, Playwright for E2E. Existing EventBus (`src/utils/event-bus.js`) for data-change notifications. Existing i18n loader resolves `data-i18n` attributes from `public/assets/locales/{en,es,ru,de}.json`.

**Spec:** `docs/superpowers/specs/2026-05-06-tree-chart-view-design.md`

**Note on commits:** Each task ends with a commit step per standard practice. If the user wants to defer commits, mark steps complete and run a single batched commit at the end of each phase.

---

## File map

**Created:**
- `src/features/tree-chart/tree-chart-config.js` — tunable constants
- `src/features/tree-chart/tree-chart-clans.js` — clan detection + color palette (pure)
- `src/features/tree-chart/tree-chart-layout.js` — generation/cluster/parking/positioning (pure)
- `src/features/tree-chart/tree-chart-edges.js` — edge path string generation (pure)
- `src/features/tree-chart/tree-chart-highlight.js` — bloodline computation (pure) + DOM toggle
- `src/features/tree-chart/tree-chart-renderer.js` — diff-based SVG DOM construction
- `src/features/tree-chart/tree-chart-view.js` — init entry point, lifecycle, EventBus glue
- `src/features/tree-chart/styles/tree-chart.css` — SVG styles
- `tests/unit/tree-chart/fixtures.js` — shared fixture builders for tests
- `tests/unit/tree-chart/clans.test.js`
- `tests/unit/tree-chart/layout.test.js`
- `tests/unit/tree-chart/edges.test.js`
- `tests/unit/tree-chart/highlight.test.js`
- `testing/tests/tree-chart.spec.js`

**Modified:**
- `src/pages/builder.astro` — sidebar selector, container element, `setView()` function, zoom + export integration, `initTreeChartView` call
- `public/assets/locales/en.json`
- `public/assets/locales/es.json`
- `public/assets/locales/ru.json`
- `public/assets/locales/de.json`

---

## Phase 0 — Scaffolding

### Task 0.1: Create directories and empty module files

**Files:**
- Create (empty): `src/features/tree-chart/tree-chart-config.js`
- Create (empty): `src/features/tree-chart/tree-chart-clans.js`
- Create (empty): `src/features/tree-chart/tree-chart-layout.js`
- Create (empty): `src/features/tree-chart/tree-chart-edges.js`
- Create (empty): `src/features/tree-chart/tree-chart-highlight.js`
- Create (empty): `src/features/tree-chart/tree-chart-renderer.js`
- Create (empty): `src/features/tree-chart/tree-chart-view.js`
- Create (empty): `src/features/tree-chart/styles/tree-chart.css`
- Create directory: `tests/unit/tree-chart/`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/features/tree-chart/styles tests/unit/tree-chart
```

- [ ] **Step 2: Create empty module files with header comments**

For each module file, write a single-line header so the file isn't truly empty (helps editors):

```js
// tree-chart-config.js — Tunable constants for the tree chart view
```

Repeat the pattern for all six other JS files (`tree-chart-clans.js`, `tree-chart-layout.js`, `tree-chart-edges.js`, `tree-chart-highlight.js`, `tree-chart-renderer.js`, `tree-chart-view.js`) each with their own descriptive header.

For `styles/tree-chart.css`, write:

```css
/* tree-chart.css — Styles for the tree chart view (SVG nodes, edges, fades, parking area) */
```

- [ ] **Step 3: Verify Vitest can find the new test directory**

Run: `npx vitest run tests/unit/tree-chart/ --reporter=verbose`
Expected: `No test files found, exiting with code 1` (acceptable — directory exists but is empty)

- [ ] **Step 4: Commit**

```bash
git add src/features/tree-chart tests/unit/tree-chart
git commit -m "chore: scaffold tree-chart module directories"
```

---

### Task 0.2: Add tunable constants

**Files:**
- Modify: `src/features/tree-chart/tree-chart-config.js`

- [ ] **Step 1: Write the config**

```js
// tree-chart-config.js — Tunable constants for the tree chart view

export const ROW_HEIGHT = 140;
export const NODE_WIDTH = 100;
export const NODE_HEIGHT = 60;
export const NODE_GAP_X = 20;
export const COUPLE_GAP = 10;
export const CLUSTER_GAP = 80;
export const PARKING_GAP = 100;
export const PARKING_NODE_GAP_X = 24;
export const PARKING_NODE_GAP_Y = 24;

export const HIGHLIGHT_FADE_OPACITY = 0.25;
export const HIGHLIGHT_EDGE_FADE_OPACITY = 0.15;

export const DEBOUNCE_MS = 100;
export const TRANSITION_MS = 250;

// Clan palette generation
export const CLAN_HUE_STEP_DEG = 137.508;
export const CLAN_SATURATION = 65;
export const CLAN_LIGHTNESS = 55;
```

- [ ] **Step 2: Commit**

```bash
git add src/features/tree-chart/tree-chart-config.js
git commit -m "feat(tree-chart): add tunable layout constants"
```

---

### Task 0.3: Add fixture helper for tests

**Files:**
- Create: `tests/unit/tree-chart/fixtures.js`

- [ ] **Step 1: Write fixture helpers**

```js
// fixtures.js — Test fixture builders for tree-chart tests

let nextId = 1;

export function resetIds() {
  nextId = 1;
}

export function person(props = {}) {
  const id = props.id || `p${nextId++}`;
  return {
    id,
    name: props.name || `Person ${id}`,
    surname: props.surname || '',
    fatherName: props.fatherName || '',
    maidenName: props.maidenName || '',
    dob: props.dob || '',
    gender: props.gender || '',
    motherId: props.motherId || '',
    fatherId: props.fatherId || '',
    spouseId: props.spouseId || ''
  };
}

/**
 * Build a Map<id, Person> from an array of person objects.
 * Spouse links are bidirectional — pass spouseId on either side and it mirrors automatically.
 */
export function buildPersonMap(people) {
  const map = new Map();
  for (const p of people) {
    map.set(p.id, { ...p });
  }
  for (const [id, p] of map) {
    if (p.spouseId && map.has(p.spouseId)) {
      const partner = map.get(p.spouseId);
      if (!partner.spouseId) partner.spouseId = id;
    }
  }
  return map;
}

/**
 * Linear chain: grandparent -> parent -> child.
 * Returns { map, ids: [grandId, parentId, childId] }.
 */
export function chainTree() {
  resetIds();
  const grand = person({ id: 'grand', name: 'Grandparent' });
  const parent = person({ id: 'parent', name: 'Parent', fatherId: 'grand' });
  const child = person({ id: 'child', name: 'Child', fatherId: 'parent' });
  return {
    map: buildPersonMap([grand, parent, child]),
    ids: ['grand', 'parent', 'child']
  };
}

/**
 * Two unrelated families plus one parked person.
 */
export function twoFamiliesPlusParked() {
  resetIds();
  const fa = person({ id: 'fa', name: 'Family A Root' });
  const fa1 = person({ id: 'fa1', name: 'A Child', fatherId: 'fa' });
  const fb = person({ id: 'fb', name: 'Family B Root' });
  const fb1 = person({ id: 'fb1', name: 'B Child', motherId: 'fb' });
  const lone = person({ id: 'lone', name: 'Loner' });
  return {
    map: buildPersonMap([fa, fa1, fb, fb1, lone]),
    families: [['fa', 'fa1'], ['fb', 'fb1']],
    parked: ['lone']
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add tests/unit/tree-chart/fixtures.js
git commit -m "test(tree-chart): add shared fixture helpers"
```

---

## Phase 1 — Clan detection (pure)

### Task 1.1: Test clan detection — three separate families produce three clans

**Files:**
- Create: `tests/unit/tree-chart/clans.test.js`
- Modify: `src/features/tree-chart/tree-chart-clans.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/tree-chart/clans.test.js
import { describe, it, expect } from 'vitest';
import { detectClans } from '../../../src/features/tree-chart/tree-chart-clans.js';
import { person, buildPersonMap, twoFamiliesPlusParked } from './fixtures.js';

describe('detectClans', () => {
  it('groups three unrelated families as three clans', () => {
    const a = person({ id: 'a' });
    const b = person({ id: 'b', fatherId: 'a' });
    const c = person({ id: 'c' });
    const d = person({ id: 'd', motherId: 'c' });
    const e = person({ id: 'e' });
    const map = buildPersonMap([a, b, c, d, e]);

    const result = detectClans(map);

    expect(result.clanCount).toBe(3);
    expect(result.clanByPerson.get('a')).toBe(result.clanByPerson.get('b'));
    expect(result.clanByPerson.get('c')).toBe(result.clanByPerson.get('d'));
    expect(result.clanByPerson.get('a')).not.toBe(result.clanByPerson.get('c'));
    expect(result.clanByPerson.get('e')).not.toBe(result.clanByPerson.get('a'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/tree-chart/clans.test.js`
Expected: FAIL — `detectClans is not a function`

- [ ] **Step 3: Implement minimal `detectClans`**

```js
// src/features/tree-chart/tree-chart-clans.js — Clan detection + color palette (pure)

/**
 * Connected components over parent-child edges only.
 * Spouses do NOT merge clans; shared children DO (handled naturally by the walk).
 *
 * @param {Map<string, Person>} personData
 * @returns {{ clanByPerson: Map<string, number>, clanCount: number, clanSizes: Map<number, number> }}
 *   clanByPerson — personId -> clanId (0..N-1)
 *   clanCount    — total distinct clans
 *   clanSizes    — clanId -> member count
 */
export function detectClans(personData) {
  const clanByPerson = new Map();
  const clanSizes = new Map();
  let nextClanId = 0;

  for (const [rootId] of personData) {
    if (clanByPerson.has(rootId)) continue;

    const clanId = nextClanId++;
    const stack = [rootId];
    let size = 0;

    while (stack.length) {
      const id = stack.pop();
      if (clanByPerson.has(id)) continue;
      const p = personData.get(id);
      if (!p) continue;

      clanByPerson.set(id, clanId);
      size++;

      // Walk parent edges (up)
      if (p.fatherId && personData.has(p.fatherId) && !clanByPerson.has(p.fatherId)) {
        stack.push(p.fatherId);
      }
      if (p.motherId && personData.has(p.motherId) && !clanByPerson.has(p.motherId)) {
        stack.push(p.motherId);
      }
      // Walk child edges (down) — find anyone whose parent is `id`
      for (const [otherId, other] of personData) {
        if (clanByPerson.has(otherId)) continue;
        if (other.fatherId === id || other.motherId === id) {
          stack.push(otherId);
        }
      }
    }

    clanSizes.set(clanId, size);
  }

  return { clanByPerson, clanCount: nextClanId, clanSizes };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tree-chart/clans.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-clans.js tests/unit/tree-chart/clans.test.js
git commit -m "feat(tree-chart): detect clans via connected-component over parent-child edges"
```

---

### Task 1.2: Test marriage between clans does NOT merge them

**Files:**
- Modify: `tests/unit/tree-chart/clans.test.js`

- [ ] **Step 1: Add the test**

Append to the `describe('detectClans', ...)` block:

```js
it('keeps two clans separate when only joined by marriage (no shared child)', () => {
  // John (clan 1) marries Maria (clan 2); they have no children together yet.
  const john = person({ id: 'john', spouseId: 'maria' });
  const johnDad = person({ id: 'johnDad' });
  const maria = person({ id: 'maria', spouseId: 'john' });
  const mariaMom = person({ id: 'mariaMom' });
  // Wire parent links
  john.fatherId = 'johnDad';
  maria.motherId = 'mariaMom';
  const map = buildPersonMap([john, johnDad, maria, mariaMom]);

  const result = detectClans(map);

  expect(result.clanCount).toBe(2);
  expect(result.clanByPerson.get('john')).toBe(result.clanByPerson.get('johnDad'));
  expect(result.clanByPerson.get('maria')).toBe(result.clanByPerson.get('mariaMom'));
  expect(result.clanByPerson.get('john')).not.toBe(result.clanByPerson.get('maria'));
});
```

- [ ] **Step 2: Run and verify it passes (no implementation change needed)**

Run: `npx vitest run tests/unit/tree-chart/clans.test.js`
Expected: PASS — `detectClans` already ignores `spouseId`.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/tree-chart/clans.test.js
git commit -m "test(tree-chart): assert marriage alone does not merge clans"
```

---

### Task 1.3: Test that a shared child merges two parents' clans

**Files:**
- Modify: `tests/unit/tree-chart/clans.test.js`

- [ ] **Step 1: Add the test**

```js
it('merges two clans when they share a child', () => {
  const johnDad = person({ id: 'johnDad' });
  const john = person({ id: 'john', fatherId: 'johnDad' });
  const mariaMom = person({ id: 'mariaMom' });
  const maria = person({ id: 'maria', motherId: 'mariaMom' });
  // Shared child: Anna has both John as father AND Maria as mother
  const anna = person({ id: 'anna', fatherId: 'john', motherId: 'maria' });
  const map = buildPersonMap([johnDad, john, mariaMom, maria, anna]);

  const result = detectClans(map);

  expect(result.clanCount).toBe(1);
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/unit/tree-chart/clans.test.js`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/tree-chart/clans.test.js
git commit -m "test(tree-chart): assert shared child merges parent clans"
```

---

### Task 1.4: Test empty input returns zero clans

**Files:**
- Modify: `tests/unit/tree-chart/clans.test.js`

- [ ] **Step 1: Add the test**

```js
it('returns zero clans for an empty map', () => {
  const result = detectClans(new Map());
  expect(result.clanCount).toBe(0);
  expect(result.clanByPerson.size).toBe(0);
});
```

- [ ] **Step 2: Run and commit**

Run: `npx vitest run tests/unit/tree-chart/clans.test.js`
Expected: PASS

```bash
git add tests/unit/tree-chart/clans.test.js
git commit -m "test(tree-chart): handle empty input"
```

---

### Task 1.5: Add `assignClanColors` (palette generator)

**Files:**
- Modify: `src/features/tree-chart/tree-chart-clans.js`
- Modify: `tests/unit/tree-chart/clans.test.js`

- [ ] **Step 1: Write the failing test**

Append to `clans.test.js`:

```js
import { assignClanColors } from '../../../src/features/tree-chart/tree-chart-clans.js';

describe('assignClanColors', () => {
  it('returns one stable color per clan, ordered by size descending', () => {
    const clanSizes = new Map([[0, 3], [1, 7], [2, 1]]);

    const colors = assignClanColors(clanSizes);

    expect(colors.size).toBe(3);
    // Stable color per clan id
    const c0 = colors.get(0);
    const c1 = colors.get(1);
    const c2 = colors.get(2);
    expect(c0).toMatch(/^hsl\(/);
    expect(c1).toMatch(/^hsl\(/);
    expect(c2).toMatch(/^hsl\(/);
    // Largest clan (id=1) gets palette index 0 → hue 0
    expect(c1).toBe('hsl(0, 65%, 55%)');
  });

  it('returns empty map for one clan or fewer', () => {
    expect(assignClanColors(new Map([[0, 5]])).size).toBe(0);
    expect(assignClanColors(new Map()).size).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/clans.test.js`
Expected: FAIL — `assignClanColors is not a function`

- [ ] **Step 3: Implement `assignClanColors`**

Append to `tree-chart-clans.js`:

```js
import {
  CLAN_HUE_STEP_DEG,
  CLAN_SATURATION,
  CLAN_LIGHTNESS
} from './tree-chart-config.js';

/**
 * Assign a CSS HSL color string to each clan, ordered by size (largest first).
 * Returns empty Map when only 1 clan exists (no color needed).
 *
 * @param {Map<number, number>} clanSizes — clanId -> member count
 * @returns {Map<number, string>} clanId -> "hsl(h, s%, l%)"
 */
export function assignClanColors(clanSizes) {
  if (clanSizes.size < 2) return new Map();

  const sortedClans = Array.from(clanSizes.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([clanId]) => clanId);

  const colors = new Map();
  for (let i = 0; i < sortedClans.length; i++) {
    const hue = (i * CLAN_HUE_STEP_DEG) % 360;
    colors.set(sortedClans[i], `hsl(${hue}, ${CLAN_SATURATION}%, ${CLAN_LIGHTNESS}%)`);
  }
  return colors;
}
```

Note the test expects `hue 0` for the largest clan (palette index 0 → `0 * 137.508 % 360 = 0`). Verified.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/tree-chart/clans.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-clans.js tests/unit/tree-chart/clans.test.js
git commit -m "feat(tree-chart): generate stable HSL clan palette by size"
```

---

## Phase 2 — Cluster, parking, generation reassignment

### Task 2.1: Test cluster detection (parent-child + spouse edges)

**Files:**
- Create: `tests/unit/tree-chart/layout.test.js`
- Modify: `src/features/tree-chart/tree-chart-layout.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/unit/tree-chart/layout.test.js
import { describe, it, expect } from 'vitest';
import { detectClusters } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { person, buildPersonMap } from './fixtures.js';

describe('detectClusters', () => {
  it('treats marriage between two families as ONE cluster', () => {
    // Two families joined only by John-Maria marriage; no shared child
    const johnDad = person({ id: 'johnDad' });
    const john = person({ id: 'john', fatherId: 'johnDad', spouseId: 'maria' });
    const mariaMom = person({ id: 'mariaMom' });
    const maria = person({ id: 'maria', motherId: 'mariaMom', spouseId: 'john' });
    const map = buildPersonMap([johnDad, john, mariaMom, maria]);

    const result = detectClusters(map);

    expect(result.clusterCount).toBe(1);
    const cluster = result.clusterByPerson.get('john');
    expect(result.clusterByPerson.get('maria')).toBe(cluster);
    expect(result.clusterByPerson.get('johnDad')).toBe(cluster);
    expect(result.clusterByPerson.get('mariaMom')).toBe(cluster);
  });

  it('keeps unrelated people in separate clusters', () => {
    const a = person({ id: 'a' });
    const b = person({ id: 'b' });
    const map = buildPersonMap([a, b]);
    const result = detectClusters(map);
    expect(result.clusterCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: FAIL — `detectClusters is not a function`

- [ ] **Step 3: Implement `detectClusters`**

```js
// src/features/tree-chart/tree-chart-layout.js — Layout primitives (pure)

/**
 * Connected components over parent-child AND spouse edges.
 * Each component is a "cluster" — one laid-out tree.
 *
 * @param {Map<string, Person>} personData
 * @returns {{ clusterByPerson: Map<string, number>, clusterCount: number, clusterSizes: Map<number, number> }}
 */
export function detectClusters(personData) {
  const clusterByPerson = new Map();
  const clusterSizes = new Map();
  let nextClusterId = 0;

  for (const [rootId] of personData) {
    if (clusterByPerson.has(rootId)) continue;

    const clusterId = nextClusterId++;
    const stack = [rootId];
    let size = 0;

    while (stack.length) {
      const id = stack.pop();
      if (clusterByPerson.has(id)) continue;
      const p = personData.get(id);
      if (!p) continue;

      clusterByPerson.set(id, clusterId);
      size++;

      // Parent edges
      if (p.fatherId && personData.has(p.fatherId) && !clusterByPerson.has(p.fatherId)) {
        stack.push(p.fatherId);
      }
      if (p.motherId && personData.has(p.motherId) && !clusterByPerson.has(p.motherId)) {
        stack.push(p.motherId);
      }
      // Spouse edge
      if (p.spouseId && personData.has(p.spouseId) && !clusterByPerson.has(p.spouseId)) {
        stack.push(p.spouseId);
      }
      // Child edges
      for (const [otherId, other] of personData) {
        if (clusterByPerson.has(otherId)) continue;
        if (other.fatherId === id || other.motherId === id) {
          stack.push(otherId);
        }
      }
    }

    clusterSizes.set(clusterId, size);
  }

  return { clusterByPerson, clusterCount: nextClusterId, clusterSizes };
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-layout.js tests/unit/tree-chart/layout.test.js
git commit -m "feat(tree-chart): cluster detection via parent+spouse edges"
```

---

### Task 2.2: Test parking-area assignment

**Files:**
- Modify: `src/features/tree-chart/tree-chart-layout.js`
- Modify: `tests/unit/tree-chart/layout.test.js`

- [ ] **Step 1: Write the failing test**

Append to `layout.test.js`:

```js
import { assignParking } from '../../../src/features/tree-chart/tree-chart-layout.js';

describe('assignParking', () => {
  it('parks people with no relations and no children pointing to them', () => {
    const lone = person({ id: 'lone' });
    const inFamily = person({ id: 'inFamily' });
    const child = person({ id: 'child', fatherId: 'inFamily' });
    const map = buildPersonMap([lone, inFamily, child]);

    const parkedSet = assignParking(map);

    expect(parkedSet.has('lone')).toBe(true);
    expect(parkedSet.has('inFamily')).toBe(false);
    expect(parkedSet.has('child')).toBe(false);
  });

  it('does not park people with only a spouse', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const map = buildPersonMap([a, b]);

    const parkedSet = assignParking(map);

    expect(parkedSet.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: FAIL — `assignParking is not a function`

- [ ] **Step 3: Implement `assignParking`**

Append to `tree-chart-layout.js`:

```js
/**
 * A person is parked iff:
 *   - no motherId in map
 *   - no fatherId in map
 *   - no spouseId in map
 *   - no incoming child edge (no person has them as parent)
 *
 * Note: line-only connections are tracked separately on connection objects, not on
 * person fields. The view module passes a Set of person ids that have line-only
 * connections to exclude them from parking. For unit-test purity we accept an
 * optional second arg.
 *
 * @param {Map<string, Person>} personData
 * @param {Set<string>} [hasLineOnly] — optional set of ids with line-only connections
 * @returns {Set<string>} ids of parked persons
 */
export function assignParking(personData, hasLineOnly = new Set()) {
  // Build "has child" set
  const hasChild = new Set();
  for (const [, p] of personData) {
    if (p.fatherId && personData.has(p.fatherId)) hasChild.add(p.fatherId);
    if (p.motherId && personData.has(p.motherId)) hasChild.add(p.motherId);
  }

  const parked = new Set();
  for (const [id, p] of personData) {
    const hasParent = (p.fatherId && personData.has(p.fatherId)) ||
                      (p.motherId && personData.has(p.motherId));
    const hasSpouse = p.spouseId && personData.has(p.spouseId);
    if (!hasParent && !hasSpouse && !hasChild.has(id) && !hasLineOnly.has(id)) {
      parked.add(id);
    }
  }
  return parked;
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-layout.js tests/unit/tree-chart/layout.test.js
git commit -m "feat(tree-chart): assign no-relation persons to parking set"
```

---

### Task 2.3: Test couple grouping

**Files:**
- Modify: `src/features/tree-chart/tree-chart-layout.js`
- Modify: `tests/unit/tree-chart/layout.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { groupIntoCouples } from '../../../src/features/tree-chart/tree-chart-layout.js';

describe('groupIntoCouples', () => {
  it('produces one couple unit for a married pair', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const map = buildPersonMap([a, b]);

    const couples = groupIntoCouples(map);

    expect(couples.length).toBe(1);
    expect(couples[0].members).toEqual(expect.arrayContaining(['a', 'b']));
    expect(couples[0].id).toMatch(/^couple-/);
  });

  it('produces a singleton couple for an unmarried person', () => {
    const a = person({ id: 'a' });
    const map = buildPersonMap([a]);

    const couples = groupIntoCouples(map);

    expect(couples.length).toBe(1);
    expect(couples[0].members).toEqual(['a']);
  });

  it('handles a one-sided spouseId (B does not point back to A)', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b' }); // no spouseId back
    const map = new Map();
    map.set('a', a);
    map.set('b', b);

    const couples = groupIntoCouples(map);

    expect(couples.length).toBe(1);
    expect(couples[0].members).toEqual(expect.arrayContaining(['a', 'b']));
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `groupIntoCouples`**

Append to `tree-chart-layout.js`:

```js
/**
 * Group persons into couple units. Each unit is either:
 *   - a couple of two people whose spouseIds point to each other, OR
 *   - a singleton (a person without a spouse-in-map).
 *
 * Tolerant of one-sided spouseId data (only one partner has it set).
 *
 * @param {Map<string, Person>} personData
 * @returns {Array<{ id: string, members: string[], coupleByPerson: Map<string, string> }>}
 */
export function groupIntoCouples(personData) {
  const coupleOf = new Map();   // personId -> coupleId
  const couples = [];
  let nextId = 0;

  for (const [id, p] of personData) {
    if (coupleOf.has(id)) continue;

    if (p.spouseId && personData.has(p.spouseId) && !coupleOf.has(p.spouseId)) {
      const coupleId = `couple-${nextId++}`;
      coupleOf.set(id, coupleId);
      coupleOf.set(p.spouseId, coupleId);
      couples.push({ id: coupleId, members: [id, p.spouseId] });
    } else {
      const coupleId = `couple-${nextId++}`;
      coupleOf.set(id, coupleId);
      couples.push({ id: coupleId, members: [id] });
    }
  }

  // Attach reverse map for caller convenience
  for (const c of couples) c.coupleByPerson = coupleOf;
  return couples;
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-layout.js tests/unit/tree-chart/layout.test.js
git commit -m "feat(tree-chart): group persons into couple units"
```

---

### Task 2.4: Test generation reassignment via longest-path

**Files:**
- Modify: `src/features/tree-chart/tree-chart-layout.js`
- Modify: `tests/unit/tree-chart/layout.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { assignGenerations } from '../../../src/features/tree-chart/tree-chart-layout.js';

describe('assignGenerations', () => {
  it('places spouses on the same row, pulling the shallower spouse down', () => {
    // Maria's only family: just her and her mother. Mother = gen 0, Maria = gen 1.
    // John's family: grandfather, father, John. John = gen 2.
    // Maria marries John. After alignment: both should be on gen 2.
    // Maria's mom shifts down to gen 1.
    const grandJ = person({ id: 'grandJ' });
    const dadJ = person({ id: 'dadJ', fatherId: 'grandJ' });
    const john = person({ id: 'john', fatherId: 'dadJ', spouseId: 'maria' });
    const momM = person({ id: 'momM' });
    const maria = person({ id: 'maria', motherId: 'momM', spouseId: 'john' });
    const map = buildPersonMap([grandJ, dadJ, john, momM, maria]);

    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    expect(gens.get('john')).toBe(gens.get('maria'));
    expect(gens.get('john')).toBe(2);
    expect(gens.get('maria')).toBe(2);
    expect(gens.get('momM')).toBe(1);   // shifted down to keep parent-above-child
    expect(gens.get('dadJ')).toBe(1);
    expect(gens.get('grandJ')).toBe(0);
  });

  it('handles a cyclic data error by breaking the cycle and still assigning generations', () => {
    // Pathological: a is its own grandparent
    const a = person({ id: 'a', fatherId: 'b' });
    const b = person({ id: 'b', fatherId: 'a' });
    const map = buildPersonMap([a, b]);

    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    // Both must be assigned; specific values are implementation-defined but must be finite.
    expect(Number.isFinite(gens.get('a'))).toBe(true);
    expect(Number.isFinite(gens.get('b'))).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `assignGenerations`**

Append to `tree-chart-layout.js`:

```js
/**
 * Assign a generation number to every person such that:
 *   - couples sit on the same row (same generation)
 *   - parents are above children (parent.gen + 1 <= child.gen, equality desired)
 *
 * Algorithm: longest path on a couple-DAG. Edges go from couple-of-parent to
 * couple-of-child. Multiple incoming edges → take the max + 1.
 *
 * Cycles (malformed data): broken by ignoring back-edges during traversal; a
 * console.warn is emitted. All persons end up with a finite generation.
 *
 * @param {Map<string, Person>} personData
 * @param {Array<{ id: string, members: string[], coupleByPerson: Map<string, string> }>} couples
 * @returns {Map<string, number>} personId -> generation
 */
export function assignGenerations(personData, couples) {
  if (!couples.length) return new Map();
  const coupleOf = couples[0].coupleByPerson;

  // Build couple-DAG: childCouple -> Set<parentCouple>
  const incoming = new Map();
  for (const c of couples) incoming.set(c.id, new Set());

  for (const [childId, p] of personData) {
    const childCouple = coupleOf.get(childId);
    if (!childCouple) continue;
    const parents = [];
    if (p.fatherId && personData.has(p.fatherId)) parents.push(p.fatherId);
    if (p.motherId && personData.has(p.motherId)) parents.push(p.motherId);
    for (const parentId of parents) {
      const parentCouple = coupleOf.get(parentId);
      if (parentCouple && parentCouple !== childCouple) {
        incoming.get(childCouple).add(parentCouple);
      }
    }
  }

  // Compute longest path generation for each couple, with cycle handling.
  const coupleGen = new Map();
  const visiting = new Set();
  let cycleDetected = false;

  function gen(coupleId) {
    if (coupleGen.has(coupleId)) return coupleGen.get(coupleId);
    if (visiting.has(coupleId)) {
      cycleDetected = true;
      return 0; // break cycle
    }
    visiting.add(coupleId);
    let maxParent = -1;
    for (const parentCouple of incoming.get(coupleId)) {
      const pg = gen(parentCouple);
      if (pg > maxParent) maxParent = pg;
    }
    visiting.delete(coupleId);
    const result = maxParent + 1;
    coupleGen.set(coupleId, result);
    return result;
  }

  for (const c of couples) gen(c.id);

  if (cycleDetected) {
    console.warn('[tree-chart] cyclic parent-child data detected; cycle was broken for layout.');
  }

  // Project couple generation back to each person
  const personGen = new Map();
  for (const c of couples) {
    const g = coupleGen.get(c.id);
    for (const memberId of c.members) personGen.set(memberId, g);
  }
  return personGen;
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-layout.js tests/unit/tree-chart/layout.test.js
git commit -m "feat(tree-chart): assign generations via longest-path on couple-DAG"
```

---

## Phase 3 — In-cluster horizontal layout (Reingold-Tilford)

### Task 3.1: Test single-cluster horizontal layout produces non-overlapping rows

**Files:**
- Modify: `src/features/tree-chart/tree-chart-layout.js`
- Modify: `tests/unit/tree-chart/layout.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { layoutCluster } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { NODE_WIDTH, ROW_HEIGHT } from '../../../src/features/tree-chart/tree-chart-config.js';

describe('layoutCluster', () => {
  it('lays out a 3-generation chain top-down', () => {
    const grand = person({ id: 'grand' });
    const par = person({ id: 'par', fatherId: 'grand' });
    const child = person({ id: 'child', fatherId: 'par' });
    const map = buildPersonMap([grand, par, child]);
    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    const positions = layoutCluster(map, couples, gens, new Set([...map.keys()]));

    // grand is at gen 0, par at gen 1, child at gen 2 → y values strictly increasing
    expect(positions.get('grand').y).toBeLessThan(positions.get('par').y);
    expect(positions.get('par').y).toBeLessThan(positions.get('child').y);
    // Each row spaced by ROW_HEIGHT
    expect(positions.get('par').y - positions.get('grand').y).toBe(ROW_HEIGHT);
  });

  it('places spouses adjacent at the same y', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const map = buildPersonMap([a, b]);
    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    const positions = layoutCluster(map, couples, gens, new Set(['a', 'b']));

    expect(positions.get('a').y).toBe(positions.get('b').y);
    expect(Math.abs(positions.get('a').x - positions.get('b').x)).toBeGreaterThan(0);
    expect(Math.abs(positions.get('a').x - positions.get('b').x)).toBeLessThanOrEqual(NODE_WIDTH * 2);
  });

  it('does not overlap two sibling subtrees', () => {
    // Parent has two children; each child has two children of their own.
    const parent = person({ id: 'parent' });
    const c1 = person({ id: 'c1', fatherId: 'parent' });
    const c2 = person({ id: 'c2', fatherId: 'parent' });
    const g1a = person({ id: 'g1a', fatherId: 'c1' });
    const g1b = person({ id: 'g1b', fatherId: 'c1' });
    const g2a = person({ id: 'g2a', fatherId: 'c2' });
    const g2b = person({ id: 'g2b', fatherId: 'c2' });
    const map = buildPersonMap([parent, c1, c2, g1a, g1b, g2a, g2b]);
    const couples = groupIntoCouples(map);
    const gens = assignGenerations(map, couples);

    const positions = layoutCluster(map, couples, gens, new Set([...map.keys()]));

    // Right edge of c1's subtree must be left of left edge of c2's subtree
    const right1 = Math.max(positions.get('g1a').x, positions.get('g1b').x);
    const left2 = Math.min(positions.get('g2a').x, positions.get('g2b').x);
    expect(right1 + NODE_WIDTH).toBeLessThanOrEqual(left2);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: FAIL — `layoutCluster is not a function`

- [ ] **Step 3: Implement `layoutCluster`**

Reingold-Tilford with couple-aware positioning. Append to `tree-chart-layout.js`:

```js
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  NODE_GAP_X,
  COUPLE_GAP,
  ROW_HEIGHT
} from './tree-chart-config.js';

/**
 * Lay out one cluster horizontally and vertically.
 *
 * Algorithm:
 *   1. Build a couple-tree (a forest) where each couple-node has children = couple-nodes
 *      whose at-least-one parent belongs to this couple.
 *   2. Recursively compute subtree widths.
 *   3. Place from leftmost root rightward, centering each parent over its children.
 *   4. Use a "shift" pass to ensure no overlap between subtrees of the same row.
 *
 * Returns a Map of personId -> { x, y } in cluster-local coordinates.
 *
 * @param {Map<string, Person>} personData
 * @param {Array} couples — output of groupIntoCouples
 * @param {Map<string, number>} generations — output of assignGenerations
 * @param {Set<string>} includeIds — only persons in this set are positioned
 * @returns {Map<string, { x: number, y: number, width: number, height: number }>}
 */
export function layoutCluster(personData, couples, generations, includeIds) {
  // Filter couples to those whose members are all in includeIds
  const localCouples = couples.filter(c => c.members.every(m => includeIds.has(m)));
  if (!localCouples.length) return new Map();

  const coupleOf = localCouples[0].coupleByPerson;

  // Build child relation among couples
  const childrenOf = new Map();
  for (const c of localCouples) childrenOf.set(c.id, []);
  for (const c of localCouples) {
    const childCouples = new Set();
    for (const memberId of c.members) {
      for (const [otherId, other] of personData) {
        if (!includeIds.has(otherId)) continue;
        if (other.fatherId === memberId || other.motherId === memberId) {
          const otherCouple = coupleOf.get(otherId);
          if (otherCouple && otherCouple !== c.id) childCouples.add(otherCouple);
        }
      }
    }
    childrenOf.set(c.id, Array.from(childCouples));
  }

  // Roots = couples with no incoming parent edge inside this cluster
  const isChild = new Set();
  for (const [, kids] of childrenOf) for (const k of kids) isChild.add(k);
  const roots = localCouples.filter(c => !isChild.has(c.id)).map(c => c.id);

  // Compute couple-unit width: 1 person → NODE_WIDTH, 2 persons → 2*NODE_WIDTH + COUPLE_GAP
  const coupleWidth = new Map();
  const coupleById = new Map(localCouples.map(c => [c.id, c]));
  for (const c of localCouples) {
    coupleWidth.set(c.id, c.members.length === 2
      ? 2 * NODE_WIDTH + COUPLE_GAP
      : NODE_WIDTH);
  }

  // Recursively compute subtree widths (max of children-row width and own width)
  const subtreeWidth = new Map();
  function computeSubtreeWidth(coupleId, visiting = new Set()) {
    if (subtreeWidth.has(coupleId)) return subtreeWidth.get(coupleId);
    if (visiting.has(coupleId)) return coupleWidth.get(coupleId);
    visiting.add(coupleId);
    const kids = childrenOf.get(coupleId) || [];
    let kidsTotal = 0;
    for (let i = 0; i < kids.length; i++) {
      kidsTotal += computeSubtreeWidth(kids[i], visiting);
      if (i < kids.length - 1) kidsTotal += NODE_GAP_X;
    }
    visiting.delete(coupleId);
    const w = Math.max(coupleWidth.get(coupleId), kidsTotal);
    subtreeWidth.set(coupleId, w);
    return w;
  }
  for (const r of roots) computeSubtreeWidth(r);

  // Place couples; couple centerX = midpoint of their subtree allotment
  const coupleX = new Map();
  function place(coupleId, leftEdge, visiting = new Set()) {
    if (visiting.has(coupleId)) return;
    visiting.add(coupleId);
    const w = subtreeWidth.get(coupleId);
    const center = leftEdge + w / 2;
    coupleX.set(coupleId, center);

    const kids = childrenOf.get(coupleId) || [];
    let kidLeft = leftEdge + (w - kids.reduce((acc, k, i) =>
      acc + subtreeWidth.get(k) + (i > 0 ? NODE_GAP_X : 0), 0)) / 2;
    for (const k of kids) {
      place(k, kidLeft, visiting);
      kidLeft += subtreeWidth.get(k) + NODE_GAP_X;
    }
    visiting.delete(coupleId);
  }

  // Place roots side-by-side
  let cursorX = 0;
  for (const r of roots) {
    place(r, cursorX);
    cursorX += subtreeWidth.get(r) + NODE_GAP_X;
  }

  // Convert couple positions to per-person positions
  const positions = new Map();
  for (const c of localCouples) {
    const cx = coupleX.get(c.id);
    if (cx === undefined) continue;
    const g = generations.get(c.members[0]) ?? 0;
    const y = g * ROW_HEIGHT;
    if (c.members.length === 1) {
      positions.set(c.members[0], {
        x: cx - NODE_WIDTH / 2,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
    } else {
      positions.set(c.members[0], {
        x: cx - (NODE_WIDTH + COUPLE_GAP / 2) - NODE_WIDTH / 2 + NODE_WIDTH / 2,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
      // Simpler: a is to the left of center by half-couple-width; b to the right.
      const halfCouple = (NODE_WIDTH + COUPLE_GAP) / 2;
      positions.set(c.members[0], {
        x: cx - halfCouple - NODE_WIDTH / 2,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
      positions.set(c.members[1], {
        x: cx + halfCouple - NODE_WIDTH / 2,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
    }
  }
  return positions;
}
```

Note: the redundant first assignment to `c.members[0]` inside the `else` branch is overwritten by the second; cleaning that up is the next step's job during refactor. Tests guard against regressions.

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: PASS

- [ ] **Step 5: Tidy the redundant assignment**

Replace the `else` branch in the position-conversion loop with a clean version:

```js
    } else {
      const halfCouple = (NODE_WIDTH + COUPLE_GAP) / 2;
      positions.set(c.members[0], {
        x: cx - halfCouple - NODE_WIDTH / 2,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
      positions.set(c.members[1], {
        x: cx + halfCouple - NODE_WIDTH / 2,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT
      });
    }
```

- [ ] **Step 6: Re-run tests**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/tree-chart/tree-chart-layout.js tests/unit/tree-chart/layout.test.js
git commit -m "feat(tree-chart): in-cluster Reingold-Tilford layout for couples"
```

---

## Phase 4 — Cluster placement, parking layout, full `runLayout`

### Task 4.1: Implement parking-area positioning

**Files:**
- Modify: `src/features/tree-chart/tree-chart-layout.js`
- Modify: `tests/unit/tree-chart/layout.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { layoutParking } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { PARKING_GAP, PARKING_NODE_GAP_X, PARKING_NODE_GAP_Y, NODE_WIDTH, NODE_HEIGHT }
  from '../../../src/features/tree-chart/tree-chart-config.js';

describe('layoutParking', () => {
  it('returns null when there are no parked persons', () => {
    expect(layoutParking([], new Map(), { minX: 0, maxX: 100, minY: 0, maxY: 100 }))
      .toBeNull();
  });

  it('places parked persons in a left-to-right grid below the chart', () => {
    const parked = ['p1', 'p2', 'p3'];
    const personData = buildPersonMap([
      person({ id: 'p1', name: 'Alpha' }),
      person({ id: 'p2', name: 'Bravo' }),
      person({ id: 'p3', name: 'Charlie' })
    ]);
    const chartBounds = { minX: 0, minY: 0, maxX: 500, maxY: 100 };

    const result = layoutParking(parked, personData, chartBounds);

    expect(result).not.toBeNull();
    expect(result.items.length).toBe(3);
    // First item below chart with PARKING_GAP
    expect(result.items[0].y).toBe(100 + PARKING_GAP);
    // Items left to right (alphabetical by name)
    expect(result.items[0].id).toBe('p1');
    expect(result.items[1].id).toBe('p2');
    expect(result.items[2].id).toBe('p3');
    // Spaced by NODE_WIDTH + PARKING_NODE_GAP_X
    expect(result.items[1].x - result.items[0].x).toBe(NODE_WIDTH + PARKING_NODE_GAP_X);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `layoutParking`**

```js
import {
  PARKING_GAP,
  PARKING_NODE_GAP_X,
  PARKING_NODE_GAP_Y
} from './tree-chart-config.js';

/**
 * Position parked persons in a grid below the chart.
 * Items are sorted alphabetically by name (case-insensitive).
 * Wraps to a new row when the row width would exceed `chartBounds.maxX - chartBounds.minX`.
 *
 * @param {string[]} parkedIds
 * @param {Map<string, Person>} personData
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} chartBounds
 * @returns {{ y: number, height: number, items: Array<{ id, x, y }> } | null}
 */
export function layoutParking(parkedIds, personData, chartBounds) {
  if (parkedIds.length === 0) return null;

  const sorted = [...parkedIds].sort((a, b) => {
    const na = (personData.get(a)?.name || '').toLowerCase();
    const nb = (personData.get(b)?.name || '').toLowerCase();
    return na.localeCompare(nb);
  });

  const left = chartBounds.minX;
  const top = chartBounds.maxY + PARKING_GAP;
  const maxRowWidth = Math.max(chartBounds.maxX - chartBounds.minX, NODE_WIDTH);

  const items = [];
  let rowX = left;
  let y = top;
  for (const id of sorted) {
    if (rowX > left && rowX + NODE_WIDTH > left + maxRowWidth) {
      rowX = left;
      y += NODE_HEIGHT + PARKING_NODE_GAP_Y;
    }
    items.push({ id, x: rowX, y });
    rowX += NODE_WIDTH + PARKING_NODE_GAP_X;
  }

  const lastY = items[items.length - 1].y;
  return {
    y: top,
    height: lastY + NODE_HEIGHT - top,
    items
  };
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-layout.js tests/unit/tree-chart/layout.test.js
git commit -m "feat(tree-chart): grid-wrap parked persons below the chart"
```

---

### Task 4.2: Compose the full `runLayout`

**Files:**
- Modify: `src/features/tree-chart/tree-chart-layout.js`
- Modify: `tests/unit/tree-chart/layout.test.js`

- [ ] **Step 1: Write the failing test**

```js
import { runLayout } from '../../../src/features/tree-chart/tree-chart-layout.js';
import { CLUSTER_GAP } from '../../../src/features/tree-chart/tree-chart-config.js';

describe('runLayout', () => {
  it('produces nodes, parking, bounds for a 2-cluster + 1-parked tree', () => {
    const fa = person({ id: 'fa' });
    const fa1 = person({ id: 'fa1', fatherId: 'fa' });
    const fb = person({ id: 'fb' });
    const fb1 = person({ id: 'fb1', motherId: 'fb' });
    const lone = person({ id: 'lone' });
    const map = buildPersonMap([fa, fa1, fb, fb1, lone]);

    const layout = runLayout(map);

    expect(layout.nodes.size).toBe(5);
    expect(layout.parking).not.toBeNull();
    expect(layout.parking.items.length).toBe(1);
    expect(layout.parking.items[0].id).toBe('lone');
    // Bounds enclose all positioned nodes
    expect(layout.bounds.minX).toBeLessThanOrEqual(layout.nodes.get('fa').x);
    expect(layout.bounds.maxX).toBeGreaterThanOrEqual(layout.nodes.get('fb').x);
  });

  it('places clusters side-by-side, larger first', () => {
    // Cluster A: 3 people (chain)
    const a1 = person({ id: 'a1' });
    const a2 = person({ id: 'a2', fatherId: 'a1' });
    const a3 = person({ id: 'a3', fatherId: 'a2' });
    // Cluster B: 1 person (with a child to keep it out of parking)
    const b1 = person({ id: 'b1' });
    const b2 = person({ id: 'b2', fatherId: 'b1' });
    const map = buildPersonMap([a1, a2, a3, b1, b2]);

    const layout = runLayout(map);

    // All members of cluster A should be left of all members of cluster B
    const aXs = ['a1', 'a2', 'a3'].map(id => layout.nodes.get(id).x);
    const bXs = ['b1', 'b2'].map(id => layout.nodes.get(id).x);
    const maxA = Math.max(...aXs);
    const minB = Math.min(...bXs);
    expect(maxA).toBeLessThan(minB);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: FAIL — `runLayout is not a function`

- [ ] **Step 3: Implement `runLayout`**

```js
/**
 * Top-level layout entry. Orchestrates clustering, parking, generation, in-cluster
 * layout, cluster placement, and bounds.
 *
 * @param {Map<string, Person>} personData
 * @param {{ hasLineOnly?: Set<string>, clanData?: { clanByPerson: Map<string, number> } }} [options]
 * @returns {Layout}
 */
export function runLayout(personData, options = {}) {
  const { hasLineOnly = new Set(), clanData } = options;

  const clusters = detectClusters(personData);
  const parkedSet = assignParking(personData, hasLineOnly);
  const couples = groupIntoCouples(personData);
  const generations = assignGenerations(personData, couples);

  // Group person ids by clusterId, excluding parked
  const clusterMembers = new Map();
  for (const [id, clusterId] of clusters.clusterByPerson) {
    if (parkedSet.has(id)) continue;
    if (!clusterMembers.has(clusterId)) clusterMembers.set(clusterId, new Set());
    clusterMembers.get(clusterId).add(id);
  }

  // Sort clusters by size, largest first
  const orderedClusterIds = Array.from(clusterMembers.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .map(([id]) => id);

  // Layout each cluster, then translate to its column on the canvas
  const nodes = new Map();
  let cursorX = 0;
  let chartMinY = Infinity;
  let chartMaxY = -Infinity;

  for (const clusterId of orderedClusterIds) {
    const members = clusterMembers.get(clusterId);
    const clusterPositions = layoutCluster(personData, couples, generations, members);
    if (clusterPositions.size === 0) continue;

    // Compute local bounds of this cluster
    let localMinX = Infinity, localMaxX = -Infinity, localMinY = Infinity, localMaxY = -Infinity;
    for (const [, pos] of clusterPositions) {
      if (pos.x < localMinX) localMinX = pos.x;
      if (pos.x + pos.width > localMaxX) localMaxX = pos.x + pos.width;
      if (pos.y < localMinY) localMinY = pos.y;
      if (pos.y + pos.height > localMaxY) localMaxY = pos.y + pos.height;
    }

    // Shift cluster so its left edge is at cursorX
    const dx = cursorX - localMinX;
    for (const [pid, pos] of clusterPositions) {
      const node = {
        x: pos.x + dx,
        y: pos.y,
        width: pos.width,
        height: pos.height,
        generation: generations.get(pid) ?? 0,
        clusterId,
        clanId: clanData?.clanByPerson.get(pid) ?? null,
        isParked: false
      };
      nodes.set(pid, node);
    }
    if (localMinY < chartMinY) chartMinY = localMinY;
    if (localMaxY > chartMaxY) chartMaxY = localMaxY;
    cursorX += (localMaxX - localMinX) + CLUSTER_GAP;
  }

  // Sentinel for empty chart
  if (!Number.isFinite(chartMinY)) { chartMinY = 0; chartMaxY = 0; }
  const chartMaxX = cursorX > 0 ? cursorX - CLUSTER_GAP : 0;

  // Parking
  const parkedIds = Array.from(parkedSet);
  const parking = layoutParking(
    parkedIds,
    personData,
    { minX: 0, minY: chartMinY, maxX: chartMaxX, maxY: chartMaxY }
  );
  if (parking) {
    for (const item of parking.items) {
      nodes.set(item.id, {
        x: item.x,
        y: item.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        generation: null,
        clusterId: null,
        clanId: clanData?.clanByPerson.get(item.id) ?? null,
        isParked: true
      });
    }
  }

  // Final bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [, n] of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x + n.width > maxX) maxX = n.x + n.width;
    if (n.y + n.height > maxY) maxY = n.y + n.height;
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

  return {
    nodes,
    edges: [],   // edges produced by tree-chart-edges.js in a later phase
    parking,
    bounds: { minX, minY, maxX, maxY }
  };
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/layout.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-layout.js tests/unit/tree-chart/layout.test.js
git commit -m "feat(tree-chart): compose full runLayout with cluster placement and bounds"
```

---

## Phase 5 — Edge path generation

### Task 5.1: Test edge generation produces parent, spouse, line-only paths

**Files:**
- Create: `tests/unit/tree-chart/edges.test.js`
- Modify: `src/features/tree-chart/tree-chart-edges.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/tree-chart/edges.test.js
import { describe, it, expect } from 'vitest';
import { generateEdges } from '../../../src/features/tree-chart/tree-chart-edges.js';
import { person, buildPersonMap } from './fixtures.js';

function fakeNodes(entries) {
  // entries: [[id, x, y]]
  const m = new Map();
  for (const [id, x, y] of entries) {
    m.set(id, { x, y, width: 100, height: 60, isParked: false });
  }
  return m;
}

describe('generateEdges', () => {
  it('produces a parent-child elbow edge', () => {
    const par = person({ id: 'par' });
    const child = person({ id: 'child', fatherId: 'par' });
    const personData = buildPersonMap([par, child]);
    const nodes = fakeNodes([['par', 0, 0], ['child', 0, 140]]);

    const edges = generateEdges(personData, nodes, []);

    const parentChild = edges.filter(e => e.type === 'parent');
    expect(parentChild.length).toBe(1);
    expect(parentChild[0].fromId).toBe('par');
    expect(parentChild[0].toId).toBe('child');
    expect(parentChild[0].path.startsWith('M')).toBe(true);
  });

  it('produces a spouse edge between adjacent partners', () => {
    const a = person({ id: 'a', spouseId: 'b' });
    const b = person({ id: 'b', spouseId: 'a' });
    const personData = buildPersonMap([a, b]);
    const nodes = fakeNodes([['a', 0, 0], ['b', 110, 0]]);

    const edges = generateEdges(personData, nodes, []);

    const spouse = edges.filter(e => e.type === 'spouse');
    expect(spouse.length).toBe(1);
  });

  it('produces line-only edges from passed line-only connections', () => {
    const a = person({ id: 'a' });
    const b = person({ id: 'b' });
    const personData = buildPersonMap([a, b]);
    const nodes = fakeNodes([['a', 0, 0], ['b', 200, 200]]);
    const lineOnlyConnections = [{ from: 'a', to: 'b' }];

    const edges = generateEdges(personData, nodes, lineOnlyConnections);

    const lineOnly = edges.filter(e => e.type === 'lineOnly');
    expect(lineOnly.length).toBe(1);
  });

  it('skips edges whose endpoints are in the parking area', () => {
    const par = person({ id: 'par' });
    const child = person({ id: 'child', fatherId: 'par' });
    const personData = buildPersonMap([par, child]);
    const nodes = fakeNodes([['par', 0, 0], ['child', 0, 140]]);
    nodes.get('child').isParked = true;

    const edges = generateEdges(personData, nodes, []);
    expect(edges.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/edges.test.js`
Expected: FAIL — `generateEdges is not a function`

- [ ] **Step 3: Implement `generateEdges`**

```js
// src/features/tree-chart/tree-chart-edges.js — Edge path string generation (pure)

import { ROW_HEIGHT } from './tree-chart-config.js';

/**
 * Generate edges with org-chart "elbow" SVG path strings.
 *
 * @param {Map<string, Person>} personData
 * @param {Map<string, { x, y, width, height, isParked }>} nodes
 * @param {Array<{ from: string, to: string }>} lineOnlyConnections
 * @returns {Array<{ fromId, toId, type, path }>}
 */
export function generateEdges(personData, nodes, lineOnlyConnections = []) {
  const edges = [];
  const seenSpouse = new Set();

  for (const [id, p] of personData) {
    const childNode = nodes.get(id);
    if (!childNode || childNode.isParked) continue;

    // Parent-child edges
    for (const parentId of [p.fatherId, p.motherId]) {
      if (!parentId) continue;
      const parentNode = nodes.get(parentId);
      if (!parentNode || parentNode.isParked) continue;
      edges.push({
        fromId: parentId,
        toId: id,
        type: 'parent',
        path: elbowPath(parentNode, childNode)
      });
    }

    // Spouse edge (deduplicate)
    if (p.spouseId) {
      const spouseNode = nodes.get(p.spouseId);
      if (spouseNode && !spouseNode.isParked) {
        const key = [id, p.spouseId].sort().join('|');
        if (!seenSpouse.has(key)) {
          seenSpouse.add(key);
          edges.push({
            fromId: id,
            toId: p.spouseId,
            type: 'spouse',
            path: spousePath(childNode, spouseNode)
          });
        }
      }
    }
  }

  // Line-only connections
  for (const conn of lineOnlyConnections) {
    const a = nodes.get(conn.from);
    const b = nodes.get(conn.to);
    if (!a || !b || a.isParked || b.isParked) continue;
    edges.push({
      fromId: conn.from,
      toId: conn.to,
      type: 'lineOnly',
      path: directPath(a, b)
    });
  }

  return edges;
}

function elbowPath(parent, child) {
  const px = parent.x + parent.width / 2;
  const py = parent.y + parent.height;
  const cx = child.x + child.width / 2;
  const cy = child.y;
  const busY = py + (cy - py) / 2;
  return `M ${px} ${py} L ${px} ${busY} L ${cx} ${busY} L ${cx} ${cy}`;
}

function spousePath(a, b) {
  const ay = a.y + a.height / 2;
  const ax = a.x + (a.x < b.x ? a.width : 0);
  const bx = b.x + (b.x < a.x ? b.width : 0);
  return `M ${ax} ${ay} L ${bx} ${ay}`;
}

function directPath(a, b) {
  const ax = a.x + a.width / 2;
  const ay = a.y + a.height / 2;
  const bx = b.x + b.width / 2;
  const by = b.y + b.height / 2;
  return `M ${ax} ${ay} L ${bx} ${by}`;
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/edges.test.js`
Expected: PASS

- [ ] **Step 5: Wire `generateEdges` into `runLayout`**

In `tree-chart-layout.js`, change the import block at the top to include `generateEdges`:

```js
import { generateEdges } from './tree-chart-edges.js';
```

Replace the line `edges: [],   // edges produced by tree-chart-edges.js in a later phase` in `runLayout` with:

```js
    edges: generateEdges(personData, nodes, options.lineOnlyConnections || []),
```

- [ ] **Step 6: Run all layout tests to confirm nothing broke**

Run: `npx vitest run tests/unit/tree-chart/`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add src/features/tree-chart/tree-chart-edges.js src/features/tree-chart/tree-chart-layout.js tests/unit/tree-chart/edges.test.js
git commit -m "feat(tree-chart): generate elbow/spouse/line-only edges"
```

---

## Phase 6 — Lineage highlight (pure)

### Task 6.1: Test bloodline computation

**Files:**
- Create: `tests/unit/tree-chart/highlight.test.js`
- Modify: `src/features/tree-chart/tree-chart-highlight.js`

- [ ] **Step 1: Write the failing tests**

```js
// tests/unit/tree-chart/highlight.test.js
import { describe, it, expect } from 'vitest';
import { computeBloodLine } from '../../../src/features/tree-chart/tree-chart-highlight.js';
import { person, buildPersonMap } from './fixtures.js';

describe('computeBloodLine', () => {
  it('includes ancestors, descendants, and self', () => {
    const grand = person({ id: 'grand' });
    const par = person({ id: 'par', fatherId: 'grand' });
    const me = person({ id: 'me', fatherId: 'par' });
    const kid = person({ id: 'kid', fatherId: 'me' });
    const map = buildPersonMap([grand, par, me, kid]);

    const line = computeBloodLine('me', map);

    expect(line.has('me')).toBe(true);
    expect(line.has('par')).toBe(true);
    expect(line.has('grand')).toBe(true);
    expect(line.has('kid')).toBe(true);
  });

  it('excludes in-laws (spouses of ancestors who are not on the line)', () => {
    // grand -> par. par marries inLaw. me is par's child. inLaw is NOT my blood.
    const grand = person({ id: 'grand' });
    const par = person({ id: 'par', fatherId: 'grand', spouseId: 'inLaw' });
    const inLaw = person({ id: 'inLaw', spouseId: 'par' });
    const me = person({ id: 'me', fatherId: 'par' });
    const map = buildPersonMap([grand, par, inLaw, me]);

    const line = computeBloodLine('me', map);

    expect(line.has('inLaw')).toBe(false);
  });

  it('excludes siblings of ancestors (great-aunts/uncles, cousins)', () => {
    const grand = person({ id: 'grand' });
    const par = person({ id: 'par', fatherId: 'grand' });
    const auntie = person({ id: 'auntie', fatherId: 'grand' });
    const me = person({ id: 'me', fatherId: 'par' });
    const cousin = person({ id: 'cousin', fatherId: 'auntie' });
    const map = buildPersonMap([grand, par, auntie, me, cousin]);

    const line = computeBloodLine('me', map);

    expect(line.has('auntie')).toBe(false);
    expect(line.has('cousin')).toBe(false);
  });

  it('handles a childless leaf — bloodline is ancestors + self', () => {
    const grand = person({ id: 'grand' });
    const me = person({ id: 'me', fatherId: 'grand' });
    const map = buildPersonMap([grand, me]);

    const line = computeBloodLine('me', map);

    expect(line.has('me')).toBe(true);
    expect(line.has('grand')).toBe(true);
    expect(line.size).toBe(2);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `npx vitest run tests/unit/tree-chart/highlight.test.js`
Expected: FAIL

- [ ] **Step 3: Implement `computeBloodLine`**

```js
// src/features/tree-chart/tree-chart-highlight.js — Lineage highlight (pure logic + DOM toggle)

/**
 * Compute the blood-line set for a person:
 *   ancestors (recursive parents) ∪ descendants (recursive children) ∪ {self}
 *
 * In-laws and siblings of ancestors are EXCLUDED.
 *
 * @param {string} personId
 * @param {Map<string, Person>} personData
 * @returns {Set<string>}
 */
export function computeBloodLine(personId, personData) {
  const result = new Set();
  if (!personData.has(personId)) return result;
  result.add(personId);

  // Ancestors
  const upStack = [personId];
  while (upStack.length) {
    const id = upStack.pop();
    const p = personData.get(id);
    if (!p) continue;
    for (const parentId of [p.fatherId, p.motherId]) {
      if (parentId && personData.has(parentId) && !result.has(parentId)) {
        result.add(parentId);
        upStack.push(parentId);
      }
    }
  }

  // Build child index once
  const childrenOf = new Map();
  for (const [cid, c] of personData) {
    for (const parentId of [c.fatherId, c.motherId]) {
      if (!parentId) continue;
      if (!childrenOf.has(parentId)) childrenOf.set(parentId, []);
      childrenOf.get(parentId).push(cid);
    }
  }

  // Descendants of `personId` only (NOT descendants of ancestors)
  const downStack = [personId];
  while (downStack.length) {
    const id = downStack.pop();
    const kids = childrenOf.get(id) || [];
    for (const kid of kids) {
      if (!result.has(kid)) {
        result.add(kid);
        downStack.push(kid);
      }
    }
  }

  return result;
}
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run tests/unit/tree-chart/highlight.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/tree-chart/tree-chart-highlight.js tests/unit/tree-chart/highlight.test.js
git commit -m "feat(tree-chart): compute blood-line set (ancestors + descendants + self)"
```

---

## Phase 7 — SVG renderer

### Task 7.1: Implement diff-based renderer

**Files:**
- Modify: `src/features/tree-chart/tree-chart-renderer.js`

This phase is rendering, not algorithm; tests are deferred to E2E (Phase 11) because jsdom's SVG support is partial. We rely on TypeScript-style discipline with code review here.

- [ ] **Step 1: Implement the renderer**

```js
// src/features/tree-chart/tree-chart-renderer.js — SVG DOM construction + diff update

import { SecurityUtils } from '../../utils/security-utils.js';
import { TRANSITION_MS } from './tree-chart-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export class TreeChartRenderer {
  constructor(svgElement) {
    this.svg = svgElement;
    this.svg.setAttribute('xmlns', SVG_NS);
    this.svg.setAttribute('class', 'tc-svg');

    // Layered groups so edges render below nodes
    this.edgeLayer = this._g('tc-edges');
    this.nodeLayer = this._g('tc-nodes');
    this.parkingDivider = this._g('tc-parking-divider');
    this.svg.appendChild(this.edgeLayer);
    this.svg.appendChild(this.parkingDivider);
    this.svg.appendChild(this.nodeLayer);

    this._nodeEls = new Map();   // personId -> <g>
    this._edgeEls = new Map();   // edgeKey   -> <path>
  }

  _g(className) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', className);
    return g;
  }

  /**
   * Diff-update the SVG to reflect the new layout + person data.
   * @param {Layout} layout
   * @param {Map<string, Person>} personData
   * @param {Map<number, string>} clanColors — clanId -> css hsl string
   * @param {string} parkingLabel — i18n string for the parking divider
   */
  render(layout, personData, clanColors, parkingLabel) {
    this._updateViewBox(layout.bounds);
    this._updateNodes(layout.nodes, personData, clanColors);
    this._updateEdges(layout.edges);
    this._updateParkingDivider(layout, parkingLabel);
  }

  _updateViewBox(bounds) {
    const pad = 60;
    const w = Math.max(bounds.maxX - bounds.minX + pad * 2, 1);
    const h = Math.max(bounds.maxY - bounds.minY + pad * 2, 1);
    this.svg.setAttribute('viewBox', `${bounds.minX - pad} ${bounds.minY - pad} ${w} ${h}`);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  }

  _updateNodes(nodes, personData, clanColors) {
    const seen = new Set();

    for (const [id, n] of nodes) {
      seen.add(id);
      let g = this._nodeEls.get(id);
      if (!g) {
        g = this._buildNodeElement(id);
        this.nodeLayer.appendChild(g);
        this._nodeEls.set(id, g);
      }
      this._applyNodeAttributes(g, id, n, personData, clanColors);
    }

    // Remove nodes no longer present
    for (const [id, el] of this._nodeEls) {
      if (!seen.has(id)) {
        el.remove();
        this._nodeEls.delete(id);
      }
    }
  }

  _buildNodeElement(personId) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('class', 'tc-node');
    g.setAttribute('tabindex', '0');
    g.setAttribute('role', 'button');
    g.dataset.personId = personId;
    g.style.transition = `transform ${TRANSITION_MS}ms ease-out`;

    const ring = document.createElementNS(SVG_NS, 'rect');
    ring.setAttribute('class', 'tc-node-ring');
    g.appendChild(ring);

    const body = document.createElementNS(SVG_NS, 'rect');
    body.setAttribute('class', 'tc-node-body');
    g.appendChild(body);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('class', 'tc-node-label');
    label.setAttribute('text-anchor', 'middle');
    g.appendChild(label);

    return g;
  }

  _applyNodeAttributes(g, id, n, personData, clanColors) {
    g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
    g.classList.toggle('tc-node--parked', !!n.isParked);

    const ring = g.querySelector('.tc-node-ring');
    const body = g.querySelector('.tc-node-body');
    const label = g.querySelector('.tc-node-label');

    body.setAttribute('width', n.width);
    body.setAttribute('height', n.height);
    body.setAttribute('rx', '8');

    ring.setAttribute('x', '-4');
    ring.setAttribute('y', '-4');
    ring.setAttribute('width', n.width + 8);
    ring.setAttribute('height', n.height + 8);
    ring.setAttribute('rx', '12');

    if (n.clanId !== null && clanColors.has(n.clanId)) {
      g.dataset.clan = String(n.clanId);
      g.style.setProperty('--clan-color', clanColors.get(n.clanId));
    } else {
      delete g.dataset.clan;
      g.style.removeProperty('--clan-color');
    }

    const p = personData.get(id) || {};
    const fullName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.id || '';
    SecurityUtils.setTextContent(label, fullName);
    label.setAttribute('x', n.width / 2);
    label.setAttribute('y', n.height / 2 + 4);

    const genStr = n.generation === null ? 'unassigned' : `generation ${n.generation}`;
    g.setAttribute('aria-label', `${fullName}, ${genStr}, click to highlight lineage`);
  }

  _updateEdges(edges) {
    const seen = new Set();
    for (const e of edges) {
      const key = `${e.fromId}|${e.toId}|${e.type}`;
      seen.add(key);
      let pathEl = this._edgeEls.get(key);
      if (!pathEl) {
        pathEl = document.createElementNS(SVG_NS, 'path');
        pathEl.setAttribute('class', `tc-edge tc-edge--${e.type}`);
        pathEl.setAttribute('fill', 'none');
        pathEl.dataset.fromId = e.fromId;
        pathEl.dataset.toId = e.toId;
        this.edgeLayer.appendChild(pathEl);
        this._edgeEls.set(key, pathEl);
      }
      pathEl.setAttribute('d', e.path);
    }
    for (const [key, el] of this._edgeEls) {
      if (!seen.has(key)) {
        el.remove();
        this._edgeEls.delete(key);
      }
    }
  }

  _updateParkingDivider(layout, parkingLabel) {
    while (this.parkingDivider.firstChild) {
      this.parkingDivider.removeChild(this.parkingDivider.firstChild);
    }
    if (!layout.parking) return;

    const y = layout.parking.y - 30;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', 'tc-parking-line');
    line.setAttribute('x1', layout.bounds.minX);
    line.setAttribute('x2', layout.bounds.maxX);
    line.setAttribute('y1', y);
    line.setAttribute('y2', y);
    this.parkingDivider.appendChild(line);

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('class', 'tc-parking-label');
    text.setAttribute('x', layout.bounds.minX);
    text.setAttribute('y', y - 8);
    SecurityUtils.setTextContent(text, parkingLabel);
    this.parkingDivider.appendChild(text);
  }

  /**
   * Apply highlight class set to nodes and edges.
   * @param {Set<string>|null} bloodLine — null clears highlight
   */
  applyHighlight(bloodLine) {
    if (!bloodLine) {
      this.svg.classList.remove('tc-has-highlight');
      for (const [, el] of this._nodeEls) el.classList.remove('tc-on-line');
      for (const [, el] of this._edgeEls) el.classList.remove('tc-on-line');
      return;
    }
    this.svg.classList.add('tc-has-highlight');
    for (const [id, el] of this._nodeEls) {
      el.classList.toggle('tc-on-line', bloodLine.has(id));
    }
    for (const [, el] of this._edgeEls) {
      const a = bloodLine.has(el.dataset.fromId);
      const b = bloodLine.has(el.dataset.toId);
      el.classList.toggle('tc-on-line', a && b);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/tree-chart/tree-chart-renderer.js
git commit -m "feat(tree-chart): SVG renderer with diff-based update and highlight"
```

---

### Task 7.2: Add CSS for the SVG view

**Files:**
- Modify: `src/features/tree-chart/styles/tree-chart.css`

- [ ] **Step 1: Write the styles**

```css
/* tree-chart.css — Styles for the tree chart view (SVG nodes, edges, fades, parking area) */

#treeChartView {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #fafafa;
}

#treeChartView.hidden { display: none; }

#treeChartView .tc-svg {
  width: 100%;
  height: 100%;
  cursor: grab;
  user-select: none;
}

#treeChartView .tc-svg:active { cursor: grabbing; }

/* Nodes */
.tc-node-body {
  fill: #3498db;
  stroke: #2c3e50;
  stroke-width: 2;
}

.tc-node-label {
  font-family: Inter, sans-serif;
  font-size: 12px;
  fill: #ffffff;
  pointer-events: none;
}

.tc-node {
  cursor: pointer;
}

.tc-node:focus { outline: none; }
.tc-node:focus .tc-node-body {
  stroke: #2980b9;
  stroke-width: 3;
}

/* Clan ring (only rendered when data-clan is present) */
.tc-node-ring {
  fill: none;
  stroke: transparent;
  stroke-width: 4;
}
.tc-node[data-clan] .tc-node-ring {
  stroke: var(--clan-color, transparent);
}

/* Edges */
.tc-edge {
  stroke: #7f8c8d;
  stroke-width: 2;
  fill: none;
}
.tc-edge--spouse {
  stroke: #e74c3c;
  stroke-dasharray: 6 4;
}
.tc-edge--lineOnly {
  stroke: #9b59b6;
  stroke-dasharray: 4 2 1 2;
}

/* Highlight fades */
.tc-has-highlight .tc-node:not(.tc-on-line) { opacity: 0.25; }
.tc-has-highlight .tc-edge:not(.tc-on-line) { opacity: 0.15; }

/* Parking */
.tc-parking-line {
  stroke: #cccccc;
  stroke-width: 1;
  stroke-dasharray: 6 6;
}
.tc-parking-label {
  font-family: Inter, sans-serif;
  font-size: 14px;
  fill: #888;
  font-style: italic;
}

/* Node fade transition (transform animates via inline style in renderer) */
.tc-node-body, .tc-node-ring, .tc-edge {
  transition: opacity 200ms ease-out;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/tree-chart/styles/tree-chart.css
git commit -m "feat(tree-chart): add SVG view styles"
```

---

## Phase 8 — View shell (`initTreeChartView`)

### Task 8.1: Implement the view shell with EventBus glue

**Files:**
- Modify: `src/features/tree-chart/tree-chart-view.js`

- [ ] **Step 1: Write the view module**

```js
// tree-chart-view.js — Init entry point, lifecycle, EventBus glue

import { appContext, EVENTS } from '../../utils/event-bus.js';
import { runLayout } from './tree-chart-layout.js';
import { detectClans, assignClanColors } from './tree-chart-clans.js';
import { computeBloodLine } from './tree-chart-highlight.js';
import { TreeChartRenderer } from './tree-chart-renderer.js';
import { DEBOUNCE_MS } from './tree-chart-config.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

export function initTreeChartView(containerEl) {
  if (!containerEl) {
    console.error('[tree-chart] container element missing');
    return null;
  }

  const svg = document.createElementNS(SVG_NS, 'svg');
  containerEl.appendChild(svg);
  const renderer = new TreeChartRenderer(svg);

  const state = {
    dirty: true,
    visible: !containerEl.classList.contains('hidden'),
    debounceTimer: null,
    highlightedId: null,
    viewBox: null,           // {x, y, w, h} for pan/zoom
    isPanning: false,
    panStart: null
  };

  function getPersonData() {
    return window.treeCore?.personData || new Map();
  }

  function getLineOnlyConnections() {
    const conns = window.treeCore?.renderer?.connections || [];
    return conns.filter(c => c.type === 'lineOnly');
  }

  function getParkingLabel() {
    return getI18nText('builder.tree_chart.parking_area', 'No relation defined');
  }

  function getI18nText(key, fallback) {
    if (typeof window.t === 'function') {
      try { return window.t(key) || fallback; } catch { /* */ }
    }
    return fallback;
  }

  function rebuild() {
    state.dirty = false;
    const personData = getPersonData();
    const clans = detectClans(personData);
    const clanColors = assignClanColors(clans.clanSizes);
    const layout = runLayout(personData, {
      hasLineOnly: new Set(getLineOnlyConnections().flatMap(c => [c.from, c.to])),
      clanData: clans,
      lineOnlyConnections: getLineOnlyConnections()
    });
    renderer.render(layout, personData, clanColors, getParkingLabel());

    if (state.highlightedId && personData.has(state.highlightedId)) {
      renderer.applyHighlight(computeBloodLine(state.highlightedId, personData));
    } else {
      state.highlightedId = null;
      renderer.applyHighlight(null);
    }
  }

  function scheduleRebuild() {
    if (!state.visible) {
      state.dirty = true;
      return;
    }
    if (state.debounceTimer) clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(rebuild, DEBOUNCE_MS);
  }

  // EventBus subscriptions
  const bus = appContext.getEventBus();
  const events = [
    EVENTS.TREE_PERSON_ADDED,
    EVENTS.TREE_PERSON_UPDATED,
    EVENTS.TREE_PERSON_DELETED,
    EVENTS.TREE_RELATIONSHIP_ADDED,
    EVENTS.TREE_RELATIONSHIP_REMOVED,
    EVENTS.TREE_LOADED
  ];
  for (const e of events) bus.on(e, scheduleRebuild);

  // Visibility tracking via custom event from setView in builder.astro
  document.addEventListener('view:changed', (ev) => {
    const { name } = ev.detail || {};
    state.visible = (name === 'treeChart');
    if (state.visible && state.dirty) rebuild();
  });

  // Click handlers — node click sets highlight; empty canvas clears
  svg.addEventListener('click', (ev) => {
    const nodeEl = ev.target.closest('.tc-node');
    if (nodeEl) {
      const personId = nodeEl.dataset.personId;
      if (state.highlightedId === personId) {
        state.highlightedId = null;
        renderer.applyHighlight(null);
        announceHighlight(null);
      } else {
        state.highlightedId = personId;
        const line = computeBloodLine(personId, getPersonData());
        renderer.applyHighlight(line);
        announceHighlight(personId, line);
      }
    } else {
      // Click on empty canvas clears highlight
      if (state.highlightedId) {
        state.highlightedId = null;
        renderer.applyHighlight(null);
        announceHighlight(null);
      }
    }
  });

  // Keyboard activation on focused node
  svg.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && state.highlightedId) {
      state.highlightedId = null;
      renderer.applyHighlight(null);
      announceHighlight(null);
      return;
    }
    if (ev.key === 'Enter' || ev.key === ' ') {
      const nodeEl = ev.target.closest && ev.target.closest('.tc-node');
      if (nodeEl) {
        ev.preventDefault();
        nodeEl.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }
  });

  // ARIA-live announcer
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('class', 'tc-live-region');
  liveRegion.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
  containerEl.appendChild(liveRegion);

  function announceHighlight(personId, line) {
    if (!personId) {
      liveRegion.textContent = getI18nText('builder.tree_chart.highlight_cleared', 'Highlight cleared');
      return;
    }
    const personData = getPersonData();
    const p = personData.get(personId);
    if (!p) return;
    const ancestors = countAncestors(personId, personData);
    const descendants = line.size - ancestors - 1; // total - ancestors - self
    const fullName = [p.name, p.surname].filter(Boolean).join(' ').trim() || p.id;
    const template = getI18nText('builder.tree_chart.lineage_announce',
      "Showing {name}'s lineage: {ancestors} ancestors, {descendants} descendants");
    liveRegion.textContent = template
      .replace('{name}', fullName)
      .replace('{ancestors}', String(ancestors))
      .replace('{descendants}', String(descendants));
  }

  function countAncestors(personId, personData) {
    const seen = new Set();
    const stack = [personId];
    while (stack.length) {
      const id = stack.pop();
      const p = personData.get(id);
      if (!p) continue;
      for (const parentId of [p.fatherId, p.motherId]) {
        if (parentId && personData.has(parentId) && !seen.has(parentId)) {
          seen.add(parentId);
          stack.push(parentId);
        }
      }
    }
    return seen.size;
  }

  // Pan via drag on empty SVG
  svg.addEventListener('mousedown', (ev) => {
    if (ev.target.closest('.tc-node')) return;
    state.isPanning = true;
    state.panStart = { x: ev.clientX, y: ev.clientY, vb: svg.viewBox.baseVal };
  });
  window.addEventListener('mousemove', (ev) => {
    if (!state.isPanning) return;
    const vb = svg.viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    const sx = vb.width / rect.width;
    const sy = vb.height / rect.height;
    const dx = (ev.clientX - state.panStart.x) * sx;
    const dy = (ev.clientY - state.panStart.y) * sy;
    svg.setAttribute('viewBox',
      `${state.panStart.vb.x - dx} ${state.panStart.vb.y - dy} ${vb.width} ${vb.height}`);
  });
  window.addEventListener('mouseup', () => { state.isPanning = false; });

  // Zoom via wheel
  svg.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const vb = svg.viewBox.baseVal;
    const factor = ev.deltaY > 0 ? 1.1 : 1 / 1.1;
    const rect = svg.getBoundingClientRect();
    const mx = ev.clientX - rect.left;
    const my = ev.clientY - rect.top;
    const px = vb.x + (mx / rect.width) * vb.width;
    const py = vb.y + (my / rect.height) * vb.height;
    const newW = vb.width * factor;
    const newH = vb.height * factor;
    const newX = px - (mx / rect.width) * newW;
    const newY = py - (my / rect.height) * newH;
    svg.setAttribute('viewBox', `${newX} ${newY} ${newW} ${newH}`);
  }, { passive: false });

  // Initial build (no-op until visible + treeCore exists)
  if (state.visible) rebuild();

  return { rebuild };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/tree-chart/tree-chart-view.js
git commit -m "feat(tree-chart): view shell with EventBus, click highlight, pan/zoom"
```

---

## Phase 9 — Builder integration

### Task 9.1: Add new container, segmented selector, setView function

**Files:**
- Modify: `src/pages/builder.astro`

- [ ] **Step 1: Replace the existing single `viewToggle` button with a 3-way selector**

Find the `viewToggle` button in `src/pages/builder.astro` (around line 310):

```html
    <button class="sidebar-btn" id="viewToggle" data-i18n-title="builder.sidebar.toggle_view">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
```

Replace the entire `<button id="viewToggle">...</button>` (the whole opening tag, SVG content, and closing tag) with:

```html
    <div id="viewSelector" class="view-selector" role="tablist" data-i18n-aria-label="builder.sidebar.view_selector_label">
      <button class="sidebar-btn view-btn active" id="viewGraphicBtn" data-view="graphic" role="tab" aria-selected="true" data-i18n-title="builder.sidebar.view_graphic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="6" cy="6" r="2"/>
          <circle cx="18" cy="6" r="2"/>
          <circle cx="6" cy="18" r="2"/>
          <circle cx="18" cy="18" r="2"/>
          <line x1="12" y1="12" x2="6" y2="6"/>
          <line x1="12" y1="12" x2="18" y2="6"/>
          <line x1="12" y1="12" x2="6" y2="18"/>
          <line x1="12" y1="12" x2="18" y2="18"/>
        </svg>
      </button>
      <button class="sidebar-btn view-btn" id="viewTreeChartBtn" data-view="treeChart" role="tab" aria-selected="false" data-i18n-title="builder.sidebar.view_tree_chart">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="2" width="6" height="4" rx="1"/>
          <rect x="3" y="14" width="6" height="4" rx="1"/>
          <rect x="9" y="14" width="6" height="4" rx="1"/>
          <rect x="15" y="14" width="6" height="4" rx="1"/>
          <line x1="12" y1="6" x2="12" y2="10"/>
          <line x1="6" y1="14" x2="6" y2="10"/>
          <line x1="6" y1="10" x2="18" y2="10"/>
          <line x1="18" y1="14" x2="18" y2="10"/>
          <line x1="12" y1="14" x2="12" y2="10"/>
        </svg>
      </button>
      <button class="sidebar-btn view-btn" id="viewTableBtn" data-view="table" role="tab" aria-selected="false" data-i18n-title="builder.sidebar.view_table">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <line x1="3" y1="9" x2="21" y2="9"/>
          <line x1="3" y1="15" x2="21" y2="15"/>
          <line x1="9" y1="3" x2="9" y2="21"/>
          <line x1="15" y1="3" x2="15" y2="21"/>
        </svg>
      </button>
    </div>
```

- [ ] **Step 2: Add the new container element**

Find `<div id="tableView" class="hidden">` (around line 651). Immediately above it, add:

```html
    <div id="treeChartView" class="hidden" role="tabpanel"></div>
```

The full `#mainContainer` block now contains three sibling views.

- [ ] **Step 3: Replace the `toggleView()` function with `setView(name)`**

Find `let currentView = 'graphic';` (around line 1267). Find the entire `function toggleView() { ... }` (around line 1330–1352). Replace `toggleView()` with the following block, and update `viewToggle` references:

```js
    let currentView = 'graphic';

    function setView(name) {
      const containers = {
        graphic: document.getElementById('graphicView'),
        treeChart: document.getElementById('treeChartView'),
        table: document.getElementById('tableView')
      };
      const buttons = {
        graphic: document.getElementById('viewGraphicBtn'),
        treeChart: document.getElementById('viewTreeChartBtn'),
        table: document.getElementById('viewTableBtn')
      };
      if (!containers[name]) return;

      currentView = name;
      for (const [key, el] of Object.entries(containers)) {
        if (!el) continue;
        el.classList.toggle('hidden', key !== name);
      }
      for (const [key, btn] of Object.entries(buttons)) {
        if (!btn) continue;
        btn.classList.toggle('active', key === name);
        btn.setAttribute('aria-selected', key === name ? 'true' : 'false');
      }

      document.dispatchEvent(new CustomEvent('view:changed', { detail: { name } }));

      if (name === 'table') setTimeout(() => rebuildTableView(), 100);
    }
```

- [ ] **Step 4: Update sidebar wiring**

Find this block in `initializeSidebar()` (around line 1310):

```js
      const viewToggle = document.getElementById('viewToggle');
      if (viewToggle) viewToggle.addEventListener('click', () => toggleView());
```

Replace with:

```js
      document.querySelectorAll('#viewSelector .view-btn').forEach((btn) => {
        btn.addEventListener('click', () => setView(btn.dataset.view));
      });
```

- [ ] **Step 5: Import and initialize the tree-chart view**

Find the existing import:

```js
    import { rebuildTableView } from '@/ui/components/table.js';
```

Below it, add:

```js
    import { initTreeChartView } from '@/features/tree-chart/tree-chart-view.js';
    import '@/features/tree-chart/styles/tree-chart.css';
```

Find the place where `treeCore` and other initialization happens. Look for the function or block where `window.treeCore` is set or where init happens after DOM ready. Add after `treeCore` is initialized:

```js
    initTreeChartView(document.getElementById('treeChartView'));
```

If you can't find the exact init block: search for `window.treeCore =` or `new TreeCore(`. Add the `initTreeChartView` call immediately after that assignment.

- [ ] **Step 6: Build and verify the page renders**

Run: `npm run build`
Expected: build completes successfully, no errors mentioning `tree-chart`.

- [ ] **Step 7: Commit**

```bash
git add src/pages/builder.astro
git commit -m "feat(tree-chart): integrate selector and container into builder.astro"
```

---

### Task 9.2: Style the segmented selector

**Files:**
- Modify: `src/styles/global.css` (or wherever sidebar styles live — search for `.sidebar-btn`)

- [ ] **Step 1: Locate sidebar styles**

Run: `grep -rn '\.sidebar-btn' src/styles src/ui` to find the file containing sidebar button styles.

- [ ] **Step 2: Append `.view-selector` styles in the located file**

```css
.view-selector {
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 2px;
}
.view-selector .view-btn { background: transparent; }
.view-selector .view-btn.active {
  background: var(--surface, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}
```

Adjust selectors to match the codebase's existing convention if `.sidebar-btn` already has a hover/active state — keep the active visual consistent with that pattern.

- [ ] **Step 3: Run dev server and visually confirm**

Run: `npm run dev`
Open the builder page. Confirm three icon buttons appear in the sidebar where the single toggle used to be. Click each — `#graphicView`, `#treeChartView`, `#tableView` should show/hide correctly. The tree-chart view should render an SVG (with empty data, the SVG will be near-empty but present).

- [ ] **Step 4: Commit**

```bash
git add <styles-file>
git commit -m "style(tree-chart): segmented view selector"
```

---

### Task 9.3: Hook zoom controls and export menu to active view

**Files:**
- Modify: `src/pages/builder.astro`

- [ ] **Step 1: Update `triggerCanvasZoom`**

Find `function triggerCanvasZoom(deltaY: number)` (around line 1314). Replace its body with:

```js
    function triggerCanvasZoom(deltaY: number) {
      let target: Element | null = null;
      if (currentView === 'graphic') {
        const graphicView = document.getElementById('graphicView');
        target = graphicView?.querySelector('canvas') || document.getElementById('svgArea');
      } else if (currentView === 'treeChart') {
        target = document.querySelector('#treeChartView svg');
      } else {
        return; // table view: nothing to zoom
      }
      if (target) {
        const rect = target.getBoundingClientRect();
        target.dispatchEvent(new WheelEvent('wheel', {
          deltaY,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          bubbles: true,
          cancelable: true
        }));
      }
    }
```

- [ ] **Step 2: Find existing export logic and add a tree-chart branch**

Search: `grep -n "exportMenu\|data-format" src/pages/builder.astro`

Locate the click handler for the export menu options. The current handler probably calls a canvas export function. Add a guard at the top:

```js
    if (currentView === 'treeChart') {
      const svgEl = document.querySelector('#treeChartView svg');
      if (!svgEl) return;
      const format = (this as HTMLElement).dataset.format;
      if (format === 'svg') {
        exportSvgFromElement(svgEl as SVGElement, 'family-tree.svg');
      } else if (format === 'png' || format === 'png-transparent') {
        rasterizeSvgToPng(svgEl as SVGElement, format === 'png-transparent');
      } else {
        alert('This format is not supported for the tree chart view.');
      }
      return;
    }
```

Then add helper functions in the same script block (above the export click handler):

```js
    function exportSvgFromElement(svgEl: SVGElement, filename: string) {
      const serializer = new XMLSerializer();
      const xml = serializer.serializeToString(svgEl);
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    }

    function rasterizeSvgToPng(svgEl: SVGElement, transparent: boolean) {
      const serializer = new XMLSerializer();
      const xml = serializer.serializeToString(svgEl);
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const vb = svgEl.viewBox.baseVal;
        const canvas = document.createElement('canvas');
        canvas.width = vb.width;
        canvas.height = vb.height;
        const ctx = canvas.getContext('2d');
        if (!transparent && ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx?.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => {
          if (!blob) return;
          const dlUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = dlUrl;
          a.download = transparent ? 'family-tree-transparent.png' : 'family-tree.png';
          a.click();
          URL.revokeObjectURL(dlUrl);
        }, 'image/png');
      };
      img.src = url;
    }
```

- [ ] **Step 3: Build to confirm no TypeScript errors**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/builder.astro
git commit -m "feat(tree-chart): wire zoom controls and export menu to active view"
```

---

## Phase 10 — i18n strings

### Task 10.1: Add new keys to all four locales

**Files:**
- Modify: `public/assets/locales/en.json`
- Modify: `public/assets/locales/es.json`
- Modify: `public/assets/locales/ru.json`
- Modify: `public/assets/locales/de.json`

- [ ] **Step 1: Add keys to `en.json`**

Find the `"sidebar"` block under `"builder"`. Add three new keys to it:

```json
      "view_graphic": "Graphic view",
      "view_tree_chart": "Tree chart",
      "view_table": "Table view",
      "view_selector_label": "Choose view mode",
```

After the closing brace of `"sidebar"`, add a new sibling `"tree_chart"` block:

```json
    "tree_chart": {
      "parking_area": "No relation defined",
      "empty_state": "Add your first person to see the tree chart",
      "lineage_announce": "Showing {name}'s lineage: {ancestors} ancestors, {descendants} descendants",
      "highlight_cleared": "Highlight cleared"
    },
```

- [ ] **Step 2: Add equivalent keys to `es.json`**

Use these translations:

```json
      "view_graphic": "Vista gráfica",
      "view_tree_chart": "Árbol genealógico",
      "view_table": "Vista de tabla",
      "view_selector_label": "Elegir modo de vista",
```

```json
    "tree_chart": {
      "parking_area": "Sin relación definida",
      "empty_state": "Añade a tu primera persona para ver el árbol",
      "lineage_announce": "Mostrando el linaje de {name}: {ancestors} antepasados, {descendants} descendientes",
      "highlight_cleared": "Resaltado eliminado"
    },
```

- [ ] **Step 3: Add equivalent keys to `ru.json`**

```json
      "view_graphic": "Графический вид",
      "view_tree_chart": "Древо",
      "view_table": "Таблица",
      "view_selector_label": "Выберите режим просмотра",
```

```json
    "tree_chart": {
      "parking_area": "Связи не определены",
      "empty_state": "Добавьте первого человека, чтобы увидеть древо",
      "lineage_announce": "Показана линия {name}: {ancestors} предков, {descendants} потомков",
      "highlight_cleared": "Выделение снято"
    },
```

- [ ] **Step 4: Add equivalent keys to `de.json`**

```json
      "view_graphic": "Grafische Ansicht",
      "view_tree_chart": "Stammbaum",
      "view_table": "Tabellenansicht",
      "view_selector_label": "Ansichtsmodus wählen",
```

```json
    "tree_chart": {
      "parking_area": "Keine Beziehung definiert",
      "empty_state": "Füge deine erste Person hinzu, um den Stammbaum zu sehen",
      "lineage_announce": "Zeige {name}s Linie: {ancestors} Vorfahren, {descendants} Nachkommen",
      "highlight_cleared": "Hervorhebung entfernt"
    },
```

- [ ] **Step 5: Validate JSON syntax**

Run: `for f in public/assets/locales/*.json; do echo "$f"; node -e "JSON.parse(require('fs').readFileSync('$f','utf8'))" && echo OK; done`
Expected: each filename followed by `OK`.

- [ ] **Step 6: Commit**

```bash
git add public/assets/locales/en.json public/assets/locales/es.json public/assets/locales/ru.json public/assets/locales/de.json
git commit -m "i18n(tree-chart): add view labels and tree-chart strings (en/es/ru/de)"
```

---

## Phase 11 — E2E tests

### Task 11.1: Add Playwright test for tree-chart view

**Files:**
- Create: `testing/tests/tree-chart.spec.js`

- [ ] **Step 1: Look at an existing Playwright spec for setup pattern**

Run: `head -60 testing/tests/mapmyroots-comprehensive.spec.js` and note how the page fixture, beforeEach, and selectors are structured. Match that style.

- [ ] **Step 2: Write the spec**

```js
// testing/tests/tree-chart.spec.js
import { test, expect } from '@playwright/test';

test.describe('Tree Chart view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/builder');
    // Wait for tree core to be initialized
    await page.waitForFunction(() => !!window.treeCore?.renderer);
  });

  test('switching to tree chart shows the SVG view', async ({ page }) => {
    await page.click('#viewTreeChartBtn');
    await expect(page.locator('#treeChartView')).toBeVisible();
    await expect(page.locator('#treeChartView svg.tc-svg')).toBeVisible();
    await expect(page.locator('#viewTreeChartBtn')).toHaveClass(/active/);
  });

  test('adding a person renders a node in the tree chart', async ({ page }) => {
    // Add a person via existing UI flow (adapt to whatever the builder uses)
    await page.evaluate(() => {
      const id = window.treeCore.addPerson({ name: 'Test', surname: 'Person' });
      return id;
    });

    await page.click('#viewTreeChartBtn');
    await page.waitForTimeout(200); // allow debounced rebuild
    const nodes = page.locator('#treeChartView .tc-node');
    await expect(nodes).toHaveCount(1);
  });

  test('clicking a node fades unrelated nodes', async ({ page }) => {
    await page.evaluate(() => {
      const a = window.treeCore.addPerson({ name: 'Alpha' });
      const b = window.treeCore.addPerson({ name: 'Bravo' });
      // a unrelated to b
    });
    await page.click('#viewTreeChartBtn');
    await page.waitForTimeout(200);

    const firstNode = page.locator('#treeChartView .tc-node').first();
    await firstNode.click();

    await expect(page.locator('#treeChartView svg')).toHaveClass(/tc-has-highlight/);
    await expect(page.locator('#treeChartView .tc-node.tc-on-line')).toHaveCount(1);
  });

  test('Escape clears the highlight', async ({ page }) => {
    await page.evaluate(() => window.treeCore.addPerson({ name: 'Alpha' }));
    await page.click('#viewTreeChartBtn');
    await page.waitForTimeout(200);

    await page.locator('#treeChartView .tc-node').first().click();
    await expect(page.locator('#treeChartView svg')).toHaveClass(/tc-has-highlight/);

    await page.keyboard.press('Escape');
    await expect(page.locator('#treeChartView svg')).not.toHaveClass(/tc-has-highlight/);
  });

  test('switching from table back to tree chart preserves added persons', async ({ page }) => {
    await page.evaluate(() => window.treeCore.addPerson({ name: 'X' }));
    await page.click('#viewTableBtn');
    await page.evaluate(() => window.treeCore.addPerson({ name: 'Y' }));
    await page.click('#viewTreeChartBtn');
    await page.waitForTimeout(200);
    await expect(page.locator('#treeChartView .tc-node')).toHaveCount(2);
  });
});
```

If `window.treeCore.addPerson` doesn't exist with that exact signature, replace those calls with the codebase's actual person-add API (search `treeCore.add` or `addPerson` in `src/core/tree-engine.js`).

- [ ] **Step 3: Run the spec**

Run: `npm run test:e2e -- testing/tests/tree-chart.spec.js`
Expected: all tests PASS. If any fail because of `addPerson` signature mismatches, update calls to match the actual API.

- [ ] **Step 4: Commit**

```bash
git add testing/tests/tree-chart.spec.js
git commit -m "test(tree-chart): E2E coverage for view switching, highlight, persistence"
```

---

## Phase 12 — Final verification

### Task 12.1: Run full unit + E2E test suites

- [ ] **Step 1: Run all unit tests**

Run: `npm test`
Expected: all green, including new `tests/unit/tree-chart/*.test.js`.

- [ ] **Step 2: Run all E2E tests**

Run: `npm run test:e2e`
Expected: all green. If pre-existing E2E tests fail due to the sidebar selector change (e.g., a test still clicking `#viewToggle`), update those tests to use the new `#viewGraphicBtn`/`#viewTableBtn` ids.

- [ ] **Step 3: Run TypeScript check**

Run: `npm run check`
Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run: `npm run dev` and open the builder page. Manually verify:
- All three view buttons are present and styled.
- Each view switches without console errors.
- Adding a person via the modal updates the tree-chart on next view switch.
- Clicking a tree-chart node fades unrelated nodes.
- Pressing Escape or clicking empty canvas clears the fade.
- For a tree with ≥2 unrelated families: each shows a different colored ring.
- A loose person appears in the parking area at the bottom.
- Pan and zoom on the tree-chart work.
- Export menu produces an SVG file when in tree-chart view.

- [ ] **Step 5: Commit any test fixes from steps 2-4**

```bash
git add -A
git commit -m "test: update for new 3-way view selector"
```

(Skip if no fixes needed.)

---

## Self-review checklist

After all phases are implemented, look at the spec with fresh eyes and verify each requirement maps to a task:

- [ ] Spec section "Decisions log" — every decision is reflected in code or tests.
- [ ] Spec section "Architecture" — `src/features/tree-chart/` exists with all listed files.
- [ ] Spec section "Layout algorithm" steps 1–10 — each step has a corresponding function and test.
- [ ] Spec section "View integration" — selector replaced, container added, `setView` works, zoom and export integrate.
- [ ] Spec section "Clan colors" — palette generation, CSS rule, single-clan skip.
- [ ] Spec section "Lineage highlight" — bloodline computation, click-to-highlight, Escape clears, ARIA-live.
- [ ] Spec section "i18n" — all 7 new keys present in 4 locales.
- [ ] Spec section "Testing" — unit tests for clans, layout, edges, highlight; E2E tests for view-switching, click-fade, persistence.
- [ ] Spec section "Edge cases" — empty tree, single person, cyclic data, same-sex couples, parking area all handled.
- [ ] Spec section "Migration awareness" — no backend deps, follows `src/features/` pattern.

If any checkbox cannot be ticked, return to the relevant phase and add the missing task.

---

**Plan complete.**

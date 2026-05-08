# SVG Tree Node Edit Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Double-clicking any node in the SVG tree chart opens the person edit modal for that person.

**Architecture:** Add a `TREE_NODE_EDIT_REQUESTED` event constant to the EventBus EVENTS map, emit it from a new `dblclick` listener in `tree-chart-view.js`, and subscribe to it inside `modal.js`'s existing `DOMContentLoaded` init block. The single-click bloodline highlight is unchanged.

**Tech Stack:** Vanilla JS ES modules, Vitest + jsdom unit tests, existing EventBus (`src/utils/event-bus.js`).

---

## Files

| Action | File | What changes |
|--------|------|-------------|
| Modify | `src/utils/event-bus.js:218-255` | Add `TREE_NODE_EDIT_REQUESTED` constant |
| Modify | `src/features/tree-chart/tree-chart-view.js:144-166` | Add `dblclick` listener after existing `click` listener |
| Modify | `src/ui/modals/modal.js:968-983` | Subscribe to event inside DOMContentLoaded block |
| Modify | `src/features/tree-chart/tree-chart-renderer.js:149` | Update aria-label string |
| Create | `tests/unit/tree-chart/view-dblclick.test.js` | Unit test for dblclick event emission |

---

### Task 1: Add event constant and write failing test

**Files:**
- Modify: `src/utils/event-bus.js:254`
- Create: `tests/unit/tree-chart/view-dblclick.test.js`

- [ ] **Step 1: Add the new event constant to `src/utils/event-bus.js`**

  In `src/utils/event-bus.js`, add one line after the `ERROR_RECOVERED` entry (line 254):

  ```js
  // Error events
  ERROR_OCCURRED: 'error:occurred',
  ERROR_RECOVERED: 'error:recovered',

  // Tree chart UI events
  TREE_NODE_EDIT_REQUESTED: 'tree:node:edit:requested'
  };
  ```

  The file currently ends the object on line 255 with `};`. Change the last two lines from:
  ```js
    ERROR_RECOVERED: 'error:recovered'
  };
  ```
  to:
  ```js
    ERROR_RECOVERED: 'error:recovered',

    // Tree chart UI events
    TREE_NODE_EDIT_REQUESTED: 'tree:node:edit:requested'
  };
  ```

- [ ] **Step 2: Create the failing unit test**

  Create `tests/unit/tree-chart/view-dblclick.test.js`:

  ```js
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  // vi.hoisted ensures these are available inside vi.mock factory closures
  const { emitMock, onMock } = vi.hoisted(() => ({
    emitMock: vi.fn(),
    onMock: vi.fn()
  }));

  vi.mock('../../../src/utils/event-bus.js', () => ({
    appContext: {
      getEventBus: () => ({ emit: emitMock, on: onMock })
    },
    EVENTS: {
      TREE_PERSON_ADDED: 'tree:person:added',
      TREE_PERSON_UPDATED: 'tree:person:updated',
      TREE_PERSON_DELETED: 'tree:person:deleted',
      TREE_RELATIONSHIP_ADDED: 'tree:relationship:added',
      TREE_RELATIONSHIP_REMOVED: 'tree:relationship:removed',
      TREE_LOADED: 'tree:loaded',
      TREE_NODE_EDIT_REQUESTED: 'tree:node:edit:requested'
    }
  }));

  vi.mock('../../../src/features/tree-chart/tree-chart-renderer.js', () => ({
    TreeChartRenderer: vi.fn().mockImplementation(() => ({
      render: vi.fn(),
      applyHighlight: vi.fn()
    }))
  }));
  vi.mock('../../../src/features/tree-chart/tree-chart-layout.js', () => ({
    runLayout: vi.fn().mockReturnValue({ nodes: [], edges: [] })
  }));
  vi.mock('../../../src/features/tree-chart/tree-chart-clans.js', () => ({
    detectClans: vi.fn().mockReturnValue({ clanSizes: new Map() }),
    assignClanColors: vi.fn().mockReturnValue(new Map())
  }));
  vi.mock('../../../src/features/tree-chart/tree-chart-highlight.js', () => ({
    computeBloodLine: vi.fn().mockReturnValue(new Set())
  }));
  vi.mock('../../../src/features/tree-chart/tree-chart-config.js', () => ({
    DEBOUNCE_MS: 0
  }));

  import { initTreeChartView } from '../../../src/features/tree-chart/tree-chart-view.js';

  const SVG_NS = 'http://www.w3.org/2000/svg';

  describe('tree-chart-view dblclick', () => {
    let container;
    let svg;

    beforeEach(() => {
      emitMock.mockClear();
      onMock.mockClear();
      container = document.createElement('div');
      container.classList.add('hidden'); // prevent rebuild() from running
      document.body.appendChild(container);
      initTreeChartView(container);
      svg = container.querySelector('svg');
    });

    it('emits TREE_NODE_EDIT_REQUESTED with personId when a node is double-clicked', () => {
      const node = document.createElementNS(SVG_NS, 'g');
      node.classList.add('tc-node');
      node.dataset.personId = 'person-abc';
      svg.appendChild(node);

      node.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      expect(emitMock).toHaveBeenCalledWith(
        'tree:node:edit:requested',
        { personId: 'person-abc' }
      );
    });

    it('does not emit TREE_NODE_EDIT_REQUESTED when SVG background is double-clicked', () => {
      svg.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

      const editCalls = emitMock.mock.calls.filter(
        ([name]) => name === 'tree:node:edit:requested'
      );
      expect(editCalls).toHaveLength(0);
    });
  });
  ```

- [ ] **Step 3: Run the test and confirm it fails**

  ```bash
  npx vitest run tests/unit/tree-chart/view-dblclick.test.js
  ```

  Expected: FAIL — "emits TREE_NODE_EDIT_REQUESTED" fails because the `dblclick` listener does not exist yet.

---

### Task 2: Add the dblclick listener in tree-chart-view.js

**Files:**
- Modify: `src/features/tree-chart/tree-chart-view.js:166`

- [ ] **Step 1: Add the dblclick listener after the existing click listener**

  In `src/features/tree-chart/tree-chart-view.js`, the existing `click` listener block ends at line 166 with `});`. Insert the following block immediately after it (after line 166):

  ```js
  svg.addEventListener('dblclick', (ev) => {
    const nodeEl = ev.target.closest('.tc-node');
    if (!nodeEl) return;
    bus.emit(EVENTS.TREE_NODE_EDIT_REQUESTED, { personId: nodeEl.dataset.personId });
  });
  ```

  The section of the file should now look like:

  ```js
  // Click handlers
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
      if (state.highlightedId) {
        state.highlightedId = null;
        renderer.applyHighlight(null);
        announceHighlight(null);
      }
    }
  });

  svg.addEventListener('dblclick', (ev) => {
    const nodeEl = ev.target.closest('.tc-node');
    if (!nodeEl) return;
    bus.emit(EVENTS.TREE_NODE_EDIT_REQUESTED, { personId: nodeEl.dataset.personId });
  });
  ```

- [ ] **Step 2: Run the test and confirm it passes**

  ```bash
  npx vitest run tests/unit/tree-chart/view-dblclick.test.js
  ```

  Expected: PASS — both test cases green.

- [ ] **Step 3: Run full unit test suite to check for regressions**

  ```bash
  npm test
  ```

  Expected: all tests pass.

---

### Task 3: Wire up modal subscription

**Files:**
- Modify: `src/ui/modals/modal.js:968-983`

- [ ] **Step 1: Add EventBus subscription inside the DOMContentLoaded block**

  In `src/ui/modals/modal.js`, the `DOMContentLoaded` listener starts at line 968. `appContext` and `EVENTS` are already imported at line 9. Add the subscription after the `isModalOpen = false` line (around line 982), inside the same callback:

  Change this block (lines 977-983):

  ```js
  // Force modal to be hidden initially
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    isModalOpen = false;
    devLog('Modal initialized as hidden');
  }
  ```

  to:

  ```js
  // Force modal to be hidden initially
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
    isModalOpen = false;
    devLog('Modal initialized as hidden');
  }

  // Open modal when SVG tree node is double-clicked
  const bus = appContext.getEventBus();
  bus.on(EVENTS.TREE_NODE_EDIT_REQUESTED, ({ personId }) => openModalForEdit(personId));
  ```

- [ ] **Step 2: Run full unit test suite**

  ```bash
  npm test
  ```

  Expected: all tests pass (no new failures).

---

### Task 4: Update aria-label and commit

**Files:**
- Modify: `src/features/tree-chart/tree-chart-renderer.js:149`

- [ ] **Step 1: Update the aria-label string in tree-chart-renderer.js**

  At line 149, change:

  ```js
  g.setAttribute('aria-label', `${fullName}, ${genStr}, click to highlight lineage`);
  ```

  to:

  ```js
  g.setAttribute('aria-label', `${fullName}, ${genStr}, click to highlight lineage, double-click to edit`);
  ```

- [ ] **Step 2: Run tests one final time**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 3: Commit**

  ```bash
  git add src/utils/event-bus.js \
          src/features/tree-chart/tree-chart-view.js \
          src/features/tree-chart/tree-chart-renderer.js \
          src/ui/modals/modal.js \
          tests/unit/tree-chart/view-dblclick.test.js
  git commit -m "feat(tree-chart): double-click SVG node to open person edit modal"
  ```

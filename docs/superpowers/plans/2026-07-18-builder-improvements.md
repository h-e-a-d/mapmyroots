# Builder Hardening & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three correctness bugs in the family tree builder (undo corruption, macOS shortcuts, production logging), remove ~1,300 lines of dead code, and land four cheap render/persistence optimizations plus three small UX fixes.

**Architecture:** All changes stay inside the existing vanilla-JS ES-module structure. No new dependencies, no new subsystems. The renderer keeps its dirty-flag rAF loop; we add per-node caches and culling inside it. Persistence keeps the IndexedDB-primary/localStorage-backup design; we gate it behind a dirty flag.

**Tech Stack:** Vanilla JS ES modules, Astro 5 + Vite build, Vitest + jsdom unit tests (`npm test`), Playwright e2e (`npm run test:e2e`).

## Global Constraints

- Never use `innerHTML`; DOM building goes through `SecurityUtils` (`src/utils/security-utils.js`) — CLAUDE.md rule.
- New user-visible strings require entries in **all four** locale files: `public/assets/locales/{en,es,ru,de}.json` — CLAUDE.md rule.
- Runtime builder strings use `data-i18n` attributes resolved by `src/features/i18n/i18n.js` (not the build-time `t()` helper).
- Cross-module communication uses the `EventBus` from `src/utils/event-bus.js`, not window globals.
- Every commit message ends with the trailer: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Run `npm test` (Vitest) after each task; it must pass before committing.
- Unit tests live in `tests/unit/`; the shared jsdom setup is `tests/setup.js` (mocks localStorage, canvas 2D context, fake-indexeddb).

---

### Task 1: Fix undo-history corruption from shared object references

**Why:** `UndoRedoManager.pushUndoState` snapshots `personData` with a shallow `new Map(...)` — snapshot entries are the *same objects* as live data. Saving a person mutates spouses in place (`spouse.marriages = ...` in `tree-engine.js:921`), which silently rewrites every prior snapshot. `restoreState` has the mirror-image bug: it hands the snapshot's own objects back to live use, so post-undo edits corrupt the redo stack.

**Files:**
- Modify: `src/data/cache/core-undoRedo.js` (`pushUndoState` ~line 38, `restoreState` ~line 92)
- Test: `tests/unit/undo-redo-snapshots.test.js` (new)

**Interfaces:**
- Consumes: `UndoRedoManager(treeCore, notifications)` constructor as-is.
- Produces: no signature changes; snapshots become deep copies via `structuredClone`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/undo-redo-snapshots.test.js`:

```javascript
// undo-redo-snapshots.test.js
// Snapshots must be isolated from in-place mutation of live data (both directions).

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UndoRedoManager } from '../../src/data/cache/core-undoRedo.js';

function makeTreeCore() {
  const personData = new Map([
    ['p1', { id: 'p1', name: 'Anna', marriages: [{ id: 'm1', spouseId: 'p2' }] }],
    ['p2', { id: 'p2', name: 'Boris', marriages: [{ id: 'm1', spouseId: 'p1' }] }]
  ]);
  const rendererNodes = new Map([
    ['p1', { id: 'p1', x: 100, y: 100, marriages: [{ id: 'm1', spouseId: 'p2' }] }],
    ['p2', { id: 'p2', x: 300, y: 100, marriages: [{ id: 'm1', spouseId: 'p1' }] }]
  ]);
  return {
    personData,
    hiddenConnections: new Set(),
    lineOnlyConnections: new Set(),
    displayPreferences: { showMaidenName: true },
    nodeStyle: 'circle',
    nodeRadius: 50,
    defaultColor: '#3498db',
    fontFamily: 'Inter',
    fontSize: 11,
    nameColor: '#ffffff',
    dateColor: '#f0f0f0',
    enhancedCacheIndicator: null,
    autoSave: vi.fn(),
    updateRendererSettings: vi.fn(),
    regenerateConnections: vi.fn(),
    clearSelection: vi.fn(),
    renderer: {
      nodes: rendererNodes,
      settings: {},
      getCamera: () => ({ x: 0, y: 0, scale: 1 }),
      setCamera: vi.fn(),
      setNode(id, data) { rendererNodes.set(id, data); }
    }
  };
}

describe('UndoRedoManager snapshot isolation', () => {
  let tc, mgr;

  beforeEach(() => {
    // restoreState writes .value on these style inputs without null checks
    document.body.textContent = '';
    for (const id of ['nodeColorPicker', 'nodeSizeInput', 'fontSelect',
                      'fontSizeInput', 'nameColorPicker', 'dateColorPicker']) {
      const el = document.createElement(id === 'fontSelect' ? 'select' : 'input');
      el.id = id;
      document.body.appendChild(el);
    }
    tc = makeTreeCore();
    mgr = new UndoRedoManager(tc, { info: vi.fn() });
  });

  it('in-place mutation of a person after push does not alter the snapshot', () => {
    mgr.pushUndoState();
    const spouse = tc.personData.get('p2');
    spouse.marriages = [{ id: 'm9', spouseId: 'p3' }]; // the marriage-sync mutation path
    const snap = mgr.undoStack[0];
    expect(snap.personData.get('p2').marriages).toEqual([{ id: 'm1', spouseId: 'p1' }]);
  });

  it('mutating live data after restore does not alter the stored snapshot', () => {
    mgr.pushUndoState();               // state A
    tc.personData.get('p1').name = 'Anna Edited';
    mgr.pushUndoState();               // state B
    mgr.undo();                        // live data now restored from state A
    tc.personData.get('p1').name = 'Corrupted';
    const stateA = mgr.undoStack[0];
    expect(stateA.personData.get('p1').name).toBe('Anna');
  });

  it('renderer node snapshots are isolated from nested mutation', () => {
    mgr.pushUndoState();
    tc.renderer.nodes.get('p1').marriages[0].spouseId = 'p9';
    expect(mgr.undoStack[0].nodes.get('p1').marriages[0].spouseId).toBe('p2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/undo-redo-snapshots.test.js`
Expected: FAIL — all three tests fail with `expected [ { id: 'm9', … } ] to deeply equal [ { id: 'm1', … } ]` style mismatches (shared references).

- [ ] **Step 3: Deep-clone snapshots in both directions**

In `src/data/cache/core-undoRedo.js`, `pushUndoState()` — replace the shallow copies:

```javascript
    const state = {
      nodes: new Map(),
      personData: structuredClone(tc.personData),
      camera: tc.renderer ? tc.renderer.getCamera() : { x: 0, y: 0, scale: 1 },
```

and the node loop below it:

```javascript
    if (tc.renderer) {
      for (const [id, node] of tc.renderer.nodes) {
        state.nodes.set(id, structuredClone(node));
      }
    }
```

In `restoreState(state)` — clone on the way out so live mutation can't reach the stored snapshot:

```javascript
    tc.renderer.nodes.clear();
    for (const [id, node] of state.nodes) {
      tc.renderer.setNode(id, structuredClone(node));
    }
    tc.personData = structuredClone(state.personData);
```

Note: `structuredClone` handles `Map` natively; person/node objects are plain data (photos are `{ mediaId, transform }` references, never blobs — blobs live in IndexedDB).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/undo-redo-snapshots.test.js`
Expected: PASS (3 tests). Then run the full suite: `npm test -- --run` — expected all green.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/undo-redo-snapshots.test.js src/data/cache/core-undoRedo.js
git commit -m "fix: deep-clone undo snapshots to stop shared-reference corruption

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Make Cmd work as the primary modifier on macOS

**Why:** Shortcut matching reads only `event.ctrlKey` (`src/features/accessibility/accessibility.js:98`, `tree.js:121,139`). Mac users pressing Cmd+Z get the browser default instead of undo.

**Files:**
- Modify: `src/features/accessibility/accessibility.js` (lines ~73, ~95–101)
- Modify: `tree.js` (lines ~121, ~139)
- Test: `tests/unit/keyboard-combo.test.js` (new)

**Interfaces:**
- Produces: exported pure function `comboFromEvent(event)` → `{ key, ctrl, shift, alt }` in `accessibility.js`, where `ctrl` is true for either Ctrl or Cmd. `KEYBOARD_SHORTCUTS` in `src/config/config.js` is unchanged — its `ctrl: true` now means "primary modifier".

- [ ] **Step 1: Write the failing test**

Create `tests/unit/keyboard-combo.test.js`:

```javascript
// keyboard-combo.test.js — Cmd (metaKey) must act as the primary modifier on macOS.

import { describe, it, expect } from 'vitest';
import { comboFromEvent } from '../../src/features/accessibility/accessibility.js';
import { KEYBOARD_SHORTCUTS } from '../../src/config/config.js';

const matches = (combo, shortcut) =>
  combo.key === shortcut.key &&
  !!combo.ctrl === !!shortcut.ctrl &&
  !!combo.shift === !!shortcut.shift &&
  !!combo.alt === !!shortcut.alt;

describe('comboFromEvent', () => {
  it('maps Ctrl+Z to the UNDO shortcut', () => {
    const combo = comboFromEvent({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false });
    expect(matches(combo, KEYBOARD_SHORTCUTS.UNDO)).toBe(true);
  });

  it('maps Cmd+Z (macOS) to the UNDO shortcut', () => {
    const combo = comboFromEvent({ key: 'z', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false });
    expect(matches(combo, KEYBOARD_SHORTCUTS.UNDO)).toBe(true);
  });

  it('does not treat a bare keypress as modified', () => {
    const combo = comboFromEvent({ key: 'z', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false });
    expect(matches(combo, KEYBOARD_SHORTCUTS.UNDO)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/keyboard-combo.test.js`
Expected: FAIL with `comboFromEvent is not a function` (not yet exported).

- [ ] **Step 3: Extract and export `comboFromEvent`; wire metaKey through**

In `src/features/accessibility/accessibility.js`, add above the class:

```javascript
// Cmd on macOS is the platform's primary modifier; treat it as "ctrl" for shortcut matching.
export function comboFromEvent(event) {
  return {
    key: event.key,
    ctrl: event.ctrlKey || event.metaKey,
    shift: event.shiftKey,
    alt: event.altKey
  };
}
```

Replace the inline combo in `handleKeyboardShortcut` (line ~96):

```javascript
  handleKeyboardShortcut(event) {
    const combo = comboFromEvent(event);
```

Update the form-field guard (line ~73) so Cmd combos are not swallowed inside inputs:

```javascript
      if (isInFormField && !event.ctrlKey && !event.metaKey && !event.altKey) return;
```

In `tree.js`, line ~121:

```javascript
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
```

and line ~139:

```javascript
  if ((e.ctrlKey || e.metaKey) && e.key === '/') {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/keyboard-combo.test.js`
Expected: PASS (3 tests). Full suite: `npm test -- --run` — green.

- [ ] **Step 5: Manual smoke check (macOS)**

Run: `npm run dev`, open `http://localhost:4321/builder`, add a person, press **Cmd+Z**.
Expected: the add is undone (undo toast/button state changes) and the browser does not intercept the key.

- [ ] **Step 6: Commit**

```bash
git add tests/unit/keyboard-combo.test.js src/features/accessibility/accessibility.js tree.js
git commit -m "fix: treat Cmd as primary shortcut modifier on macOS

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Make dev-only logging actually dev-only

**Why:** `devLog`/`devWarn`/`devError` gate on `window.NODE_ENV !== 'production'`, but nothing ever assigns `window.NODE_ENV`, so they always fire. Separately, 200+ raw `console.log` calls ship to production. Fix the guard with Vite's build-time flag and strip bare info-level logs at build time.

**Files:**
- Modify: every file containing `window.NODE_ENV` (find with grep — known: `src/core/canvas-renderer.js`, `src/ui/modals/modal.js`, `src/ui/components/homepage.js`, `src/features/search/search.js`; the grep is authoritative)
- Modify: `astro.config.mjs` (vite section)

**Interfaces:**
- Produces: `devLog`/`devWarn`/`devError` helpers gated on `import.meta.env.DEV`. Production bundles contain no `console.log`/`console.debug`/`console.info` calls; `console.warn`/`console.error` are kept.

- [ ] **Step 1: Find every occurrence**

Run: `grep -rln "window.NODE_ENV" src/ tree.js`
Expected output: the list of files to edit (at minimum the four named above).

- [ ] **Step 2: Replace the guard in each file**

In each listed file, change every occurrence of:

```javascript
  if (window.NODE_ENV !== 'production') {
```

to:

```javascript
  if (import.meta.env.DEV) {
```

(All of these files are Vite-bundled ES modules, so `import.meta.env` is statically replaced at build time.)

- [ ] **Step 3: Strip info-level console calls from production bundles**

In `astro.config.mjs`, extend the existing `vite` block:

```javascript
  vite: {
    build: {
      sourcemap: true
    },
    esbuild: {
      // Mark info-level logging as pure so minification drops it from prod bundles.
      // console.warn / console.error are intentionally kept.
      pure: ['console.log', 'console.debug', 'console.info']
    }
  }
```

- [ ] **Step 4: Verify**

Run: `grep -rn "window.NODE_ENV" src/ tree.js`
Expected: no matches.

Run: `npm run build && grep -o "console\.log" dist/_astro/*.js | wc -l`
Expected: `0` (dev server behavior is unchanged — esbuild only drops pure calls during minified builds).

Run: `npm test -- --run`
Expected: green (Vitest defines `import.meta.env` natively).

- [ ] **Step 5: Commit**

```bash
git add -A src/ tree.js astro.config.mjs
git commit -m "fix: gate dev logging on import.meta.env.DEV and strip console.log from prod builds

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Delete dead code inside TreeEngine

**Why:** `tree-engine.js` carries deprecated duplicates that shadow or mislead: an empty `handleSavePersonFromModal` placeholder silently overridden by the real one at line ~850, `loadInitialStateOld`, `autoSaveOld`, `getCurrentStateOld` (~130 lines), a no-op `savePersonFromModal`, and `undoStack`/`redoStack`/`maxUndoSize` fields duplicating `UndoRedoManager`'s state.

**Files:**
- Modify: `src/core/tree-engine.js`

**Interfaces:**
- Consumes: nothing new. The live save path is the `savePersonFromModal` **document event** → `handleSavePersonFromModal(detail)` (the ~line-850 definition). The form `submit` listener exists only to block native submission.
- Produces: no exported-surface changes (`TreeEngine` / `TreeCoreCanvas` aliases unchanged).

- [ ] **Step 1: Confirm the dead code has no callers**

Run: `grep -rn "loadInitialStateOld\|autoSaveOld\|getCurrentStateOld\|savePersonFromModal()" src/ tree.js | grep -v "tree-engine.js"`
Expected: no matches.

Run: `grep -n "this.undoStack\|this.redoStack\|this.maxUndoSize" src/core/tree-engine.js`
Expected: only the constructor assignments at ~lines 57–59 (all other undo state lives in `UndoRedoManager`). If any other reference appears, stop and reroute it through `this.undoRedoManager` before deleting.

- [ ] **Step 2: Delete the dead members**

In `src/core/tree-engine.js` remove:

1. Constructor fields (~lines 56–59) — keep `selectedCircles`, delete the three below it:

```javascript
    // State management
    this.selectedCircles = new Set();
```

(delete `this.undoStack = [];`, `this.redoStack = [];`, `this.maxUndoSize = 50;`)

2. The whole `loadInitialStateOld()` method (~lines 210–229, marked DEPRECATED).

3. The placeholder pair (~lines 437–445) including its comment:

```javascript
  // Placeholder methods - to be implemented with full functionality
  savePersonFromModal() { ... }
  handleSavePersonFromModal(detail) { ... }
```

4. In `setupUI()` (~line 180), the form submit handler currently calls the placeholder. Replace the listener body so it only blocks native submission:

```javascript
    // Block native form submission; the actual save is dispatched by the modal
    // via the 'savePersonFromModal' document event handled below.
    const personForm = document.getElementById('personForm');
    if (personForm) {
      personForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    }
```

5. The `autoSaveOld()` method (~lines 578–581).

6. The `getCurrentStateOld()` method (starts ~line 687, ends just before `cleanOldBackups()` at ~line 817). Verify the boundary by reading the file before deleting.

- [ ] **Step 3: Verify nothing broke**

Run: `grep -n "loadInitialStateOld\|autoSaveOld\|getCurrentStateOld" src/core/tree-engine.js`
Expected: no matches.

Run: `npm test -- --run` → green. Then `npm run build` → succeeds.

- [ ] **Step 4: Manual smoke check**

Run: `npm run dev`, open `/builder`, add a person via the modal, edit them, press the save button inside the modal.
Expected: person appears/updates on canvas (the document-event save path still works; native submit is still suppressed — no page reload).

- [ ] **Step 5: Commit**

```bash
git add src/core/tree-engine.js
git commit -m "refactor: remove deprecated duplicate methods and unused undo fields from TreeEngine

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Delete the unused CommandManager and QuadTree modules

**Why:** Both are complete, tested, and imported by nothing in the app. The live undo system is snapshot-based (`UndoRedoManager`); hit-testing is a linear scan that is fine at family-tree scale. Keeping them (with passing tests) falsely signals they are load-bearing. Git history preserves them if ever needed.

**Files:**
- Delete: `src/core/commands/command-manager.js`
- Delete: `src/core/spatial/quad-tree.js`
- Delete: `tests/unit/command-manager.test.js`
- Delete: `tests/unit/quad-tree.test.js`

- [ ] **Step 1: Confirm they are unreferenced**

Run: `grep -rn "command-manager\|CommandManager\|quad-tree\|QuadTree" src/ tree.js tests/ testing/ | grep -v "src/core/commands/\|src/core/spatial/\|tests/unit/command-manager.test.js\|tests/unit/quad-tree.test.js"`
Expected: no matches. If anything shows up, stop — do not delete; report the reference instead.

- [ ] **Step 2: Delete**

```bash
git rm src/core/commands/command-manager.js src/core/spatial/quad-tree.js \
       tests/unit/command-manager.test.js tests/unit/quad-tree.test.js
rmdir src/core/commands src/core/spatial 2>/dev/null || true
```

- [ ] **Step 3: Verify**

Run: `npm test -- --run` → green (two fewer test files). `npm run build` → succeeds.

- [ ] **Step 4: Commit**

```bash
git commit -m "refactor: delete unused CommandManager and QuadTree (snapshot undo and linear hit-test are the live implementations)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Remove the connection-loss polling monitor; await engine init

**Why:** `tree.js` polls every 10s through `window` globals to toast "connections disappeared" — a band-aid over a bug that regenerate-on-load fixed. It violates the no-window-globals rule and wakes the CPU forever. Also `treeCore.initialize()` is async but un-awaited, so init failures escape the surrounding try/catch.

**Files:**
- Modify: `tree.js` (delete `initializeConnectionMonitoring` ~lines 66–109 and its call; await init at ~line 52)

- [ ] **Step 1: Make the edits**

In `tree.js`:

1. Change line ~52:

```javascript
    const treeCore = new TreeCoreCanvas();
    await treeCore.initialize();
```

2. Delete the call `initializeConnectionMonitoring();` (~line 67) and the entire `function initializeConnectionMonitoring() { ... }` definition (~lines 75–109).

- [ ] **Step 2: Verify**

Run: `grep -n "initializeConnectionMonitoring\|_connectionMonitor" tree.js`
Expected: no matches.

Run: `npm run dev`, open `/builder` with an existing tree.
Expected: tree loads, connections render, no console errors.

Run: `npm test -- --run` → green.

- [ ] **Step 3: Commit**

```bash
git add tree.js
git commit -m "refactor: drop connection-loss polling monitor and await TreeEngine init

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Dirty-flag the autosave pipeline

**Why:** Every 30s — even fully idle — `saveToCache` serializes the whole tree, allocates a `Blob` to size-check it, and writes localStorage twice. Gate the periodic/lifecycle saves behind a dirty flag; explicit post-mutation saves force it.

**Files:**
- Modify: `src/data/cache/core-cache.js`
- Modify: `src/core/tree-engine.js` (the real `autoSave()` at ~line 2364; direct `this.cacheManager.autoSave()` call sites at ~lines 1020, 1622, 1779, 1931)
- Test: `tests/unit/cache-manager-dirty.test.js` (new)

**Interfaces:**
- Produces: `CacheManager.markDirty()` (new); `CacheManager.autoSave()` becomes a no-op while clean; `saveToCache()` clears the flag on success. `TreeEngine.autoSave()` = mark dirty + save (the "a mutation just happened" entry point).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cache-manager-dirty.test.js`:

```javascript
// cache-manager-dirty.test.js — periodic autosave must be a no-op while the tree is clean.

import { describe, it, expect, vi } from 'vitest';
import { CacheManager } from '../../src/data/cache/core-cache.js';

function makeTreeCore() {
  return {
    getCurrentState: vi.fn(() => ({ version: '2.1.0', persons: [] })),
    getCompressedState: vi.fn(() => ({ version: '2.1.0', persons: [] })),
    cleanOldBackups: vi.fn(),
    enhancedCacheIndicator: null
  };
}

describe('CacheManager dirty flag', () => {
  it('skips autosave while clean', () => {
    const tc = makeTreeCore();
    const cm = new CacheManager(tc);
    cm.autoSave();
    expect(tc.getCurrentState).not.toHaveBeenCalled();
  });

  it('saves once after markDirty, then returns to clean', () => {
    const tc = makeTreeCore();
    const cm = new CacheManager(tc);
    cm.markDirty();
    cm.autoSave();
    expect(tc.getCurrentState).toHaveBeenCalledTimes(1);
    cm.autoSave(); // clean again — no second serialization
    expect(tc.getCurrentState).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/cache-manager-dirty.test.js`
Expected: FAIL — first test fails because `getCurrentState` *was* called (no gating), second fails on `markDirty is not a function`.

- [ ] **Step 3: Implement in CacheManager**

In `src/data/cache/core-cache.js`:

Constructor — add:

```javascript
    this.lastSaveTime = null;
    this.dirty = false;
```

Add the method:

```javascript
  /** Mark the tree as having unsaved changes; the next autosave will persist. */
  markDirty() {
    this.dirty = true;
  }
```

Gate `autoSave()` (top of method):

```javascript
  autoSave() {
    if (!this.dirty) return;
    try {
```

Clear the flag in `saveToCache()` just before `return true;`:

```javascript
      this.dirty = false;
      return true;
```

Gate the lifecycle listeners in `setupCaching()`:

```javascript
  setupCaching() {
    this.startAutoSave();
    window.addEventListener('beforeunload', () => {
      if (this.dirty) this.saveToCache();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.dirty) this.saveToCache();
    });
  }
```

- [ ] **Step 4: Route mutations through the dirty flag in TreeEngine**

In `src/core/tree-engine.js`, replace the body of the real `autoSave()` (~line 2364) so post-mutation saves always persist:

```javascript
  autoSave() {
    if (!this.cacheManager) return;
    this.cacheManager.markDirty();
    this.cacheManager.autoSave();
  }
```

Then find the direct calls and route them through it:

Run: `grep -n "this.cacheManager.autoSave()" src/core/tree-engine.js`

At each match (~lines 1020, 1622, 1779, 1931 — but trust the grep, not these numbers), replace:

```javascript
      this.cacheManager.autoSave();
```

with:

```javascript
      this.autoSave();
```

(`UndoRedoManager.pushUndoState` already calls `tc.autoSave()`, so every undo-tracked mutation marks dirty automatically. The 30s interval and tab-hide/unload handlers now only do work when something actually changed.)

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/cache-manager-dirty.test.js` → PASS.
Run: `npm test -- --run` → green.

- [ ] **Step 6: Manual smoke check**

Run: `npm run dev`, open `/builder`. Add a person → the "Last saved" indicator updates within ~30s. Leave the tab idle 60s → the indicator timestamp does **not** keep refreshing. Reload → the person is still there.

- [ ] **Step 7: Commit**

```bash
git add tests/unit/cache-manager-dirty.test.js src/data/cache/core-cache.js src/core/tree-engine.js
git commit -m "perf: skip autosave serialization while tree is unchanged

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Silence the per-action undo/redo toasts

**Why:** "Action undone" fires on every undo — interrupting exactly the flow where users press undo repeatedly. Boundary messages ("Nothing to undo") stay; button disabled-state already communicates availability.

**Files:**
- Modify: `src/data/cache/core-undoRedo.js` (lines ~22 and ~34)
- Test: extend `tests/unit/undo-redo-snapshots.test.js`

- [ ] **Step 1: Write the failing test**

Append to the `describe` block in `tests/unit/undo-redo-snapshots.test.js`:

```javascript
  it('successful undo/redo is silent; empty stacks still notify', () => {
    const notifications = { info: vi.fn() };
    mgr = new UndoRedoManager(tc, notifications);
    mgr.pushUndoState();
    mgr.pushUndoState();
    mgr.undo();
    mgr.redo();
    expect(notifications.info).not.toHaveBeenCalled();
    mgr.redo(); // redo stack now empty
    expect(notifications.info).toHaveBeenCalledWith('Redo', 'Nothing to redo');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/undo-redo-snapshots.test.js`
Expected: FAIL — `info` was called with `('Undo', 'Action undone')`.

- [ ] **Step 3: Remove the two success toasts**

In `src/data/cache/core-undoRedo.js` delete the line in `undo()`:

```javascript
    this.notifications.info('Undo', 'Action undone');
```

and in `redo()`:

```javascript
    this.notifications.info('Redo', 'Action redone');
```

(Keep both "Nothing to undo/redo" notifications.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/undo-redo-snapshots.test.js` → PASS. `npm test -- --run` → green.

- [ ] **Step 5: Commit**

```bash
git add src/data/cache/core-undoRedo.js tests/unit/undo-redo-snapshots.test.js
git commit -m "ux: stop toasting on every successful undo/redo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Size the marriage-year label background to its text

**Why:** The white backing rect is hardcoded 44px wide (`canvas-renderer.js:1063`); estimated dates and non-English locale prefixes (e.g. "ок. 1985") overflow it.

**Files:**
- Modify: `src/core/canvas-renderer.js` (`drawConnections`, the spouse-label block ~lines 1052–1070)

- [ ] **Step 1: Replace the label block**

In `drawConnections`, replace the body of `if (marriage?.date?.year) { ... }` with (font must be set *before* measuring):

```javascript
        if (marriage?.date?.year) {
          const labelDV = { year: marriage.date.year, estimated: !!marriage.date.estimated };
          const label = formatDateValue(labelDV, locale);
          const cx = (fromNode.x + toNode.x) / 2;
          const cy = (fromNode.y + toNode.y) / 2;
          ctx.save();
          ctx.setLineDash([]);
          ctx.font = '11px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const halfWidth = ctx.measureText(label).width / 2 + 4;
          ctx.fillStyle = '#fff';
          ctx.fillRect(cx - halfWidth, cy - 8, halfWidth * 2, 16);
          ctx.fillStyle = '#555';
          ctx.fillText(label, cx, cy);
          ctx.restore();
        }
```

- [ ] **Step 2: Verify**

Run: `npm test -- --run` → green (no behavioral tests cover this; the jsdom canvas mock returns width 0, so a unit assertion would be meaningless).

Manual: `npm run dev` → `/builder` → create two people, link as spouses, set a marriage year with "estimated" checked, switch language to Russian (label becomes wider). Expected: the white backing box hugs the text with ~4px padding, no overflow.

- [ ] **Step 3: Commit**

```bash
git add src/core/canvas-renderer.js
git commit -m "fix: size marriage-year label background from measured text

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Batch grid strokes and cut the grid at low zoom

**Why:** Grid line count grows with 1/zoom² and each line pays a full `beginPath()/stroke()`. Zoomed far out, the grid is solid sub-pixel noise costing hundreds of strokes per frame.

**Files:**
- Modify: `src/core/canvas-renderer.js` (`drawGrid`, ~lines 990–1023)
- Modify: `tests/setup.js` (add `setLineDash` to the canvas ctx mock — needed by renderer tests)
- Test: `tests/unit/canvas-grid.test.js` (new)

**Interfaces:**
- Produces: `drawGrid(ctx, width, height)` signature unchanged; draws nothing below `camera.scale < 0.3`; exactly two strokes otherwise (minor pass, major pass).

- [ ] **Step 1: Add `setLineDash` to the shared ctx mock**

In `tests/setup.js`, inside the mocked context object, add alongside the other `vi.fn()` entries:

```javascript
  setLineDash: vi.fn(),
  getLineDash: vi.fn(() => []),
```

- [ ] **Step 2: Write the failing test**

Create `tests/unit/canvas-grid.test.js`:

```javascript
// canvas-grid.test.js — grid must draw in two batched strokes, and skip entirely at low zoom.

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CanvasRenderer } from '../../src/core/canvas-renderer.js';

function mockCtx() {
  return {
    beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
    stroke: vi.fn(), setLineDash: vi.fn(),
    strokeStyle: '', lineWidth: 0
  };
}

describe('CanvasRenderer.drawGrid', () => {
  let renderer;
  afterEach(() => renderer?.destroy());

  it('skips the grid entirely below the zoom threshold', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    renderer.camera = { x: 0, y: 0, scale: 0.2 };
    const ctx = mockCtx();
    renderer.drawGrid(ctx, 800, 600);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws the whole grid in exactly two strokes (minor + major)', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    renderer.camera = { x: 0, y: 0, scale: 1 };
    const ctx = mockCtx();
    renderer.drawGrid(ctx, 800, 600);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.moveTo.mock.calls.length).toBeGreaterThan(4); // still drew many lines
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/canvas-grid.test.js`
Expected: FAIL — stroke is called once per line (dozens of times), and low zoom still draws.

- [ ] **Step 4: Rewrite `drawGrid`**

Replace the whole method in `src/core/canvas-renderer.js`:

```javascript
  drawGrid(ctx, width, height) {
    const scale = this.camera.scale;
    // Below this zoom the grid is sub-pixel noise; line count grows with 1/scale².
    if (scale < 0.3) return;

    const gridSize = this.settings.gridSize;
    const offsetX = -this.camera.x / scale;
    const offsetY = -this.camera.y / scale;
    const startX = Math.floor(offsetX / gridSize) * gridSize;
    const startY = Math.floor(offsetY / gridSize) * gridSize;
    const endX = offsetX + width / scale;
    const endY = offsetY + height / scale;
    const majorEvery = gridSize * 4;

    ctx.lineWidth = 1 / scale;

    // Minor lines — one batched path
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      if (x % majorEvery === 0) continue;
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      if (y % majorEvery === 0) continue;
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.strokeStyle = this.settings.gridColor;
    ctx.stroke();

    // Major lines — one batched path
    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      if (x % majorEvery !== 0) continue;
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      if (y % majorEvery !== 0) continue;
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.strokeStyle = this.settings.gridMajorColor;
    ctx.stroke();
  }
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/unit/canvas-grid.test.js` → PASS. `npm test -- --run` → green.

Manual: `npm run dev` → `/builder` → zoom far out. Expected: grid fades out (disappears) instead of becoming solid noise; panning stays smooth.

- [ ] **Step 6: Commit**

```bash
git add tests/setup.js tests/unit/canvas-grid.test.js src/core/canvas-renderer.js
git commit -m "perf: batch grid strokes and skip grid below 0.3x zoom

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Cache per-node text layout and the z-order sort

**Why:** Every frame, every node re-wraps its name (`measureText` per word) and the full node list is re-sorted by z-index. Both results are stable between edits; cache them.

**Files:**
- Modify: `src/core/canvas-renderer.js` (constructor, `drawNodeText`, `drawNodes`, `drawNodesOnly`, `setNode`, `removeNode`)
- Modify: `src/core/tree-engine.js` (bring-to-front handler where `node.zIndex` is assigned, ~line 1920)
- Test: `tests/unit/canvas-text-cache.test.js` (new)

**Interfaces:**
- Produces: `drawNodeText(ctx, id, node, maxWidth)` — **signature gains the `id` parameter** (update all call sites: `drawCircleNode`, `drawRectangleNode`, and the export variants `drawCircleNodeExport`/`drawRectangleNodeExport` if they call it — grep for `drawNodeText(`). New renderer methods: `invalidateZOrder()` and internal `_getSortedNodes()`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/canvas-text-cache.test.js`:

```javascript
// canvas-text-cache.test.js — text wrapping must not re-measure on every frame.

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { CanvasRenderer } from '../../src/core/canvas-renderer.js';

function mockCtx() {
  return {
    measureText: vi.fn(() => ({ width: 40 })),
    fillText: vi.fn(),
    font: '', fillStyle: '', textAlign: '', textBaseline: ''
  };
}

describe('drawNodeText layout cache', () => {
  let renderer;
  afterEach(() => renderer?.destroy());

  it('re-renders a stable node without re-measuring text', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    const node = { id: 'p1', name: 'Anna Maria Theresia', surname: 'Keller', x: 0, y: 0 };
    const ctx = mockCtx();
    renderer.drawNodeText(ctx, 'p1', node, 90);
    const measured = ctx.measureText.mock.calls.length;
    expect(measured).toBeGreaterThan(0);
    renderer.drawNodeText(ctx, 'p1', node, 90);
    renderer.drawNodeText(ctx, 'p1', node, 90);
    expect(ctx.measureText.mock.calls.length).toBe(measured); // no growth
  });

  it('recomputes when the name changes', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    const node = { id: 'p1', name: 'Anna', surname: 'Keller', x: 0, y: 0 };
    const ctx = mockCtx();
    renderer.drawNodeText(ctx, 'p1', node, 90);
    const measured = ctx.measureText.mock.calls.length;
    node.name = 'Anna-Louise';
    renderer.drawNodeText(ctx, 'p1', node, 90);
    expect(ctx.measureText.mock.calls.length).toBeGreaterThan(measured);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/canvas-text-cache.test.js`
Expected: FAIL — first test fails because `measureText` calls grow on every draw. (It may also fail on the two-arg signature; that confirms the call-site change is needed.)

- [ ] **Step 3: Implement the caches**

In `src/core/canvas-renderer.js` constructor, next to `_imageCache`:

```javascript
    this._textLayoutCache = new Map(); // nodeId -> { sig, nameLines, maiden, lifespan }
    this._sortedNodes = null;          // cached z-ordered [id, node] entries
```

Replace `drawNodeText` with the cached version:

```javascript
  drawNodeText(ctx, id, node, maxWidth) {
    const locale = this.getLocale();
    const sig = [
      node.name, node.fatherName, node.surname, node.maidenName,
      node.birth?.date ? JSON.stringify(node.birth.date) : '',
      node.death?.date ? JSON.stringify(node.death.date) : '',
      this.settings.nameFontSize, this.settings.dobFontSize, this.settings.fontFamily,
      this.displayPreferences.showMaidenName, this.displayPreferences.showFatherName,
      this.displayPreferences.showDateOfBirth,
      maxWidth, locale
    ].join('|');

    let layout = this._textLayoutCache.get(id);
    if (!layout || layout.sig !== sig) {
      ctx.font = `600 ${this.settings.nameFontSize}px ${this.settings.fontFamily}`;
      const fullName = this.buildFullName(node);
      const nameLines = fullName ? this.wrapText(ctx, fullName, maxWidth) : [];
      const maiden = (this.displayPreferences.showMaidenName &&
                      node.maidenName && node.maidenName !== node.surname)
        ? `(${node.maidenName})` : '';
      const lifespan = this.displayPreferences.showDateOfBirth
        ? (formatLifespanShort(node.birth?.date, node.death?.date, locale) || '') : '';
      layout = { sig, nameLines, maiden, lifespan };
      this._textLayoutCache.set(id, layout);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lineHeight = 12;
    const totalLines = layout.nameLines.length + (layout.maiden ? 1 : 0) + (layout.lifespan ? 1 : 0);
    let y = node.y - (totalLines - 1) * lineHeight / 2;

    if (layout.nameLines.length) {
      ctx.font = `600 ${this.settings.nameFontSize}px ${this.settings.fontFamily}`;
      ctx.fillStyle = this.settings.nameColor;
      for (const line of layout.nameLines) {
        ctx.fillText(line, node.x, y);
        y += lineHeight;
      }
    }
    if (layout.maiden) {
      ctx.font = `italic ${this.settings.dobFontSize}px ${this.settings.fontFamily}`;
      ctx.fillStyle = this.settings.nameColor;
      ctx.fillText(layout.maiden, node.x, y);
      y += 10;
    }
    if (layout.lifespan) {
      ctx.font = `${this.settings.dobFontSize}px ${this.settings.fontFamily}`;
      ctx.fillStyle = this.settings.dobColor;
      ctx.fillText(layout.lifespan, node.x, y + 5);
    }
  }
```

Update every call site to pass the id — run `grep -n "drawNodeText(" src/core/canvas-renderer.js` and change each caller, e.g. in `drawCircleNode`:

```javascript
      this.drawNodeText(ctx, id, node, radius * 1.8);
```

and in `drawRectangleNode`:

```javascript
    this.drawNodeText(ctx, id, node, width - 20);
```

(Same pattern in the export node drawers if the grep shows them.)

Add the sorted-list cache and invalidation:

```javascript
  _getSortedNodes() {
    if (!this._sortedNodes) {
      this._sortedNodes = Array.from(this.nodes.entries())
        .sort((a, b) => (a[1].zIndex || 0) - (b[1].zIndex || 0));
    }
    return this._sortedNodes;
  }

  invalidateZOrder() {
    this._sortedNodes = null;
  }
```

In `drawNodes` and `drawNodesOnly`, replace the inline `Array.from(...).sort(...)` with:

```javascript
    const sortedNodes = this._getSortedNodes();
```

In `setNode`, before the final `this.needsRedraw = true;` add:

```javascript
    this._sortedNodes = null;
```

In `removeNode`, alongside the existing deletions add:

```javascript
    this._textLayoutCache.delete(id);
    this._sortedNodes = null;
```

In `src/core/tree-engine.js`, in the bring-to-front handler (find with `grep -n "node.zIndex = maxZIndex" src/core/tree-engine.js`), after the zIndex assignment loop add:

```javascript
    this.renderer.invalidateZOrder();
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/canvas-text-cache.test.js` → PASS. `npm test -- --run` → green.

Manual: `npm run dev` → `/builder` — rename a person (label updates immediately), toggle "show date of birth" (labels update), use bring-to-front on an overlapped node (stacking order changes).

- [ ] **Step 5: Commit**

```bash
git add tests/unit/canvas-text-cache.test.js src/core/canvas-renderer.js src/core/tree-engine.js
git commit -m "perf: cache per-node text layout and z-order sort between frames

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Viewport culling for nodes and connections

**Why:** Every frame draws every node and connection even when far off-screen. A bounds check against the camera rect skips that work during pan/zoom on large trees.

**Files:**
- Modify: `src/core/canvas-renderer.js` (`draw`, `drawNodes`, `drawConnections`; new helpers)
- Test: `tests/unit/canvas-culling.test.js` (new)

**Interfaces:**
- Produces: `getVisibleWorldRect(width, height)` → `{ left, top, right, bottom }` (world coords); static `CanvasRenderer.rectVisible(minX, minY, maxX, maxY, view)` → boolean. `drawNodes(ctx, view = null)` / `drawConnections(ctx, view = null)` — `null` view means "no culling", which keeps the export paths (`drawNodesOnly`/`drawConnectionsOnly`) untouched.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/canvas-culling.test.js`:

```javascript
// canvas-culling.test.js — visible-rect math and the cull predicate.

// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { CanvasRenderer } from '../../src/core/canvas-renderer.js';

describe('viewport culling', () => {
  let renderer;
  afterEach(() => renderer?.destroy());

  it('computes the visible world rect from camera pan and zoom', () => {
    renderer = new CanvasRenderer(document.createElement('div'));
    renderer.camera = { x: -100, y: 50, scale: 2 };
    const view = renderer.getVisibleWorldRect(800, 600);
    expect(view).toEqual({ left: 50, top: -25, right: 450, bottom: 275 });
  });

  it('rectVisible accepts overlapping and rejects disjoint rects', () => {
    const view = { left: 0, top: 0, right: 100, bottom: 100 };
    expect(CanvasRenderer.rectVisible(90, 90, 150, 150, view)).toBe(true);   // corner overlap
    expect(CanvasRenderer.rectVisible(-50, 20, -10, 80, view)).toBe(false);  // fully left
    expect(CanvasRenderer.rectVisible(20, 120, 80, 180, view)).toBe(false);  // fully below
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/canvas-culling.test.js`
Expected: FAIL — `getVisibleWorldRect is not a function`.

- [ ] **Step 3: Implement**

In `src/core/canvas-renderer.js` add near the camera methods:

```javascript
  // World-space rect currently visible through the camera.
  getVisibleWorldRect(width, height) {
    const s = this.camera.scale;
    return {
      left: -this.camera.x / s,
      top: -this.camera.y / s,
      right: (width - this.camera.x) / s,
      bottom: (height - this.camera.y) / s
    };
  }

  static rectVisible(minX, minY, maxX, maxY, view) {
    return maxX >= view.left && minX <= view.right &&
           maxY >= view.top && minY <= view.bottom;
  }
```

In `draw()`, compute the view once and pass it down:

```javascript
    const view = this.getVisibleWorldRect(width, height);
    this.drawGrid(ctx, width, height);
    this.drawConnections(ctx, view);
    this.drawNodes(ctx, view);
```

Change `drawConnections(ctx)` → `drawConnections(ctx, view = null)` and add right after the `if (!fromNode || !toNode) continue;` guard:

```javascript
      if (view && !CanvasRenderer.rectVisible(
        Math.min(fromNode.x, toNode.x), Math.min(fromNode.y, toNode.y),
        Math.max(fromNode.x, toNode.x), Math.max(fromNode.y, toNode.y),
        view
      )) continue;
```

Change `drawNodes(ctx)` → `drawNodes(ctx, view = null)` and add at the top of the per-node loop:

```javascript
      // Conservative pad: rectangles are width-capped at 200 in getNodeWidth.
      const pad = this.settings.nodeStyle === 'rectangle'
        ? 120
        : (node.radius || this.settings.nodeRadius) + 10;
      if (view && !CanvasRenderer.rectVisible(
        node.x - pad, node.y - pad, node.x + pad, node.y + pad, view
      )) continue;
```

(`drawNodesOnly`/`drawConnectionsOnly` for export never pass a view, so exports always render everything.)

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/unit/canvas-culling.test.js` → PASS. `npm test -- --run` → green.

Manual: `npm run dev` → `/builder` — pan so nodes leave and re-enter the screen at various zooms; nodes must never pop in late or clip at the edges. Export a PNG; off-screen people must still appear in the export.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/canvas-culling.test.js src/core/canvas-renderer.js
git commit -m "perf: cull off-screen nodes and connections from the render loop

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Empty-canvas onboarding overlay

**Why:** A first-time visitor sees a blank grid with an unlabeled `+` button. A centered, non-interactive hint targets the funnel's most fragile moment. GEDCOM import already exists in the UI (import modal in `builder.astro:184`), so the hint can point to both paths.

**Files:**
- Create: `src/ui/components/empty-state.js`
- Modify: `src/pages/builder.astro` (inside `#graphicView`, ~line 682)
- Modify: `src/styles/global.css` (builder styles live here — `floating-buttons` precedent)
- Modify: `src/core/tree-engine.js` (import + call in `regenerateConnections`)
- Modify: `public/assets/locales/en.json`, `es.json`, `ru.json`, `de.json`
- Test: `tests/unit/empty-state.test.js` (new)

**Interfaces:**
- Produces: `syncEmptyState(personCount)` exported from `src/ui/components/empty-state.js` — toggles `#emptyState` visibility; no-op when the element is absent.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/empty-state.test.js`:

```javascript
// empty-state.test.js — onboarding overlay shows only while the tree is empty.

import { describe, it, expect, beforeEach } from 'vitest';
import { syncEmptyState } from '../../src/ui/components/empty-state.js';

describe('syncEmptyState', () => {
  beforeEach(() => {
    document.body.textContent = '';
  });

  it('shows the overlay when the tree is empty', () => {
    const el = document.createElement('div');
    el.id = 'emptyState';
    el.classList.add('hidden');
    document.body.appendChild(el);
    syncEmptyState(0);
    expect(el.classList.contains('hidden')).toBe(false);
  });

  it('hides the overlay when people exist', () => {
    const el = document.createElement('div');
    el.id = 'emptyState';
    document.body.appendChild(el);
    syncEmptyState(3);
    expect(el.classList.contains('hidden')).toBe(true);
  });

  it('does not throw when the element is missing', () => {
    expect(() => syncEmptyState(0)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/empty-state.test.js`
Expected: FAIL — module `src/ui/components/empty-state.js` does not exist.

- [ ] **Step 3: Create the module**

Create `src/ui/components/empty-state.js`:

```javascript
// empty-state.js — first-run overlay shown while the tree has no people.

export function syncEmptyState(personCount) {
  const el = document.getElementById('emptyState');
  if (!el) return;
  el.classList.toggle('hidden', personCount > 0);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/empty-state.test.js` → PASS (3 tests).

- [ ] **Step 5: Add markup, styles, and the engine hook**

In `src/pages/builder.astro`, inside `#graphicView` (after `<svg id="svgArea">`, ~line 683):

```html
      <div id="emptyState" class="empty-state" aria-hidden="true">
        <p class="empty-state-title" data-i18n="builder.empty_state.title">Start your family tree</p>
        <p class="empty-state-hint" data-i18n="builder.empty_state.hint">Tap the + button to add your first person, or import a GEDCOM file.</p>
      </div>
```

(Visible by default so it paints before JS loads; the engine hides it once people load. `pointer-events: none` keeps all canvas interaction working underneath.)

In `src/styles/global.css` (builder section, near other `#graphicView`-related rules):

```css
/* First-run empty-state overlay (builder canvas) */
#graphicView {
  position: relative;
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem;
  text-align: center;
  pointer-events: none;
  z-index: 5;
}

.empty-state.hidden {
  display: none;
}

.empty-state-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #4a5568;
}

.empty-state-hint {
  font-size: 0.95rem;
  color: #718096;
  max-width: 28rem;
}
```

(If `#graphicView` already has a `position` rule in `global.css`, skip the duplicate block.)

In `src/core/tree-engine.js`:

```javascript
import { syncEmptyState } from '../ui/components/empty-state.js';
```

and at the very end of `regenerateConnections()` (after `this.recalculateGenerations();`):

```javascript
    syncEmptyState(this.personData.size);
```

Also add the same call at the end of `initialize()` (after `loadInitialState` resolves) so a genuinely empty first visit shows the overlay even though `regenerateConnections` may not run:

```javascript
    syncEmptyState(this.personData.size);
```

- [ ] **Step 6: Add all four locale strings**

In each of `public/assets/locales/{en,es,ru,de}.json`, add under the existing `"builder"` object (sibling of `"buttons"`, `"search"`, etc.):

`en.json`:

```json
    "empty_state": {
      "title": "Start your family tree",
      "hint": "Tap the + button to add your first person, or import a GEDCOM file."
    }
```

`es.json`:

```json
    "empty_state": {
      "title": "Comienza tu árbol genealógico",
      "hint": "Pulsa el botón + para añadir a tu primera persona o importa un archivo GEDCOM."
    }
```

`ru.json`:

```json
    "empty_state": {
      "title": "Начните своё семейное древо",
      "hint": "Нажмите кнопку +, чтобы добавить первого человека, или импортируйте файл GEDCOM."
    }
```

`de.json`:

```json
    "empty_state": {
      "title": "Beginnen Sie Ihren Stammbaum",
      "hint": "Tippen Sie auf +, um die erste Person hinzuzufügen, oder importieren Sie eine GEDCOM-Datei."
    }
```

Validate: `for f in public/assets/locales/*.json; do python3 -m json.tool "$f" > /dev/null && echo "$f OK"; done`
Expected: four `OK` lines.

- [ ] **Step 7: Verify end-to-end**

Run: `npm test -- --run` → green. `npm run build` → succeeds.

Manual: `npm run dev` → `/builder` in a private window (empty storage). Expected: centered hint visible; clicking/panning the canvas still works through it; adding a person hides it; Clear All brings it back; switching language re-translates it.

- [ ] **Step 8: Commit**

```bash
git add src/ui/components/empty-state.js tests/unit/empty-state.test.js \
        src/pages/builder.astro src/styles/global.css src/core/tree-engine.js \
        public/assets/locales/en.json public/assets/locales/es.json \
        public/assets/locales/ru.json public/assets/locales/de.json
git commit -m "ux: add first-run empty-state overlay to builder canvas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final Verification (after all tasks)

- [ ] `npm test -- --run` — full unit suite green.
- [ ] `npm run build` — production build succeeds; `grep -o "console\.log" dist/_astro/*.js | wc -l` → 0.
- [ ] `npm run test:e2e` — Playwright suite green (exercises builder flows end-to-end).
- [ ] Manual pass on `/builder`: add → edit → connect → undo (Cmd+Z) → redo → export PNG → reload (state persists) → Clear All (empty state returns).

## Explicitly Out of Scope (follow-up plans if wanted)

- Splitting `tree-engine.js` / `canvas-renderer.js` / `modal.js` per the 500-line rule — mechanical but large; deserves its own plan after this one lands so the diffs don't collide.
- Connection-key separator hardening (`split('-')` fragility) — touches persisted state format; needs a load-time migration design.
- Rectangle-mode `getNodeWidth`/`getNodeHeight` measurement caching — circle mode is the default; do it if rectangle-mode profiling warrants.

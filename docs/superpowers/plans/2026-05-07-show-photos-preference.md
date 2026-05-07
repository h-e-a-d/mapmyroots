# Show Photos Display Preference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Show Photos" checkbox to the settings panel Display Preferences section that globally toggles photo rendering on canvas nodes.

**Architecture:** Add `showPhotos: true` to `displayPreferences` in `TreeEngine` and `CanvasRenderer`. Wire a new checkbox through the existing display preferences loop in `ui-settings.js`. Guard the image draw call in `drawCircleNode` with the flag.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D API, Vitest (unit tests), Astro (builder page template), runtime i18n via `data-i18n` attributes.

---

## File Map

| File | Change |
|------|--------|
| `public/assets/locales/en.json` | Add `show_photos` key |
| `public/assets/locales/es.json` | Add `show_photos` key |
| `public/assets/locales/ru.json` | Add `show_photos` key |
| `public/assets/locales/de.json` | Add `show_photos` key |
| `src/core/tree-engine.js` | Add `showPhotos: true` to `displayPreferences` |
| `src/core/canvas-renderer.js` | Add `showPhotos: true` to defaults; guard image draw |
| `src/pages/builder.astro` | Add checkbox HTML to Display Preferences section |
| `src/ui/components/ui-settings.js` | Add `'showPhotos'` to preferences array |
| `tests/unit/features/photos/show-photos-pref.test.js` | New unit test |

---

### Task 1: Add i18n keys to all four locale files

**Files:**
- Modify: `public/assets/locales/en.json:425`
- Modify: `public/assets/locales/es.json:425`
- Modify: `public/assets/locales/ru.json:315`
- Modify: `public/assets/locales/de.json:315`

Each locale has `"show_father_name"` on the line referenced above. Insert `"show_photos"` immediately after it.

- [ ] **Step 1: Add key to en.json**

In `public/assets/locales/en.json`, find:
```json
      "show_father_name": "Show Father's Name",
```
Change to:
```json
      "show_father_name": "Show Father's Name",
      "show_photos": "Show Photos",
```

- [ ] **Step 2: Add key to es.json**

In `public/assets/locales/es.json`, find:
```json
      "show_father_name": "Mostrar Nombre del Padre",
```
Change to:
```json
      "show_father_name": "Mostrar Nombre del Padre",
      "show_photos": "Mostrar Fotos",
```

- [ ] **Step 3: Add key to ru.json**

In `public/assets/locales/ru.json`, find:
```json
      "show_father_name": "Показать имя отца",
```
Change to:
```json
      "show_father_name": "Показать имя отца",
      "show_photos": "Показывать фото",
```

- [ ] **Step 4: Add key to de.json**

In `public/assets/locales/de.json`, find:
```json
      "show_father_name": "Vatername anzeigen",
```
Change to:
```json
      "show_father_name": "Vatername anzeigen",
      "show_photos": "Fotos anzeigen",
```

- [ ] **Step 5: Commit**

```bash
git add public/assets/locales/en.json public/assets/locales/es.json public/assets/locales/ru.json public/assets/locales/de.json
git commit -m "feat(i18n): add show_photos key to all four locales"
```

---

### Task 2: Add `showPhotos` default to TreeEngine and CanvasRenderer + unit test

**Files:**
- Modify: `src/core/tree-engine.js:39`
- Modify: `src/core/canvas-renderer.js:91`
- Create: `tests/unit/features/photos/show-photos-pref.test.js`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/features/photos/show-photos-pref.test.js`:

```js
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all heavy imports that TreeEngine pulls in
vi.mock('../../../../src/core/canvas-renderer.js', () => ({ CanvasRenderer: vi.fn() }));
vi.mock('../../../../src/ui/modals/modal.js', () => ({
  openModalForEdit: vi.fn(), closeModal: vi.fn(), getSelectedGender: vi.fn()
}));
vi.mock('../../../../src/utils/marriage-sync.js', () => ({
  syncMarriages: vi.fn(), makeMarriageId: vi.fn()
}));
vi.mock('../../../../src/data/migrations/v2.2-rich-events.js', () => ({ migrateToV22: vi.fn() }));
vi.mock('../../../../src/ui/components/table.js', () => ({ rebuildTableView: vi.fn() }));
vi.mock('../../../../src/features/export/exporter.js', () => ({
  exportTree: vi.fn(), exportGEDCOM: vi.fn(), exportCanvasPDF: vi.fn()
}));
vi.mock('../../../../src/ui/components/notifications.js', () => ({ notifications: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../../../../src/data/cache/core-undoRedo.js', () => ({ UndoRedoManager: vi.fn() }));
vi.mock('../../../../src/data/cache/core-cache.js', () => ({ CacheManager: vi.fn() }));
vi.mock('../../../../src/ui/components/ui-buttons.js', () => ({ setupButtons: vi.fn() }));
vi.mock('../../../../src/ui/components/ui-settings.js', () => ({ setupSettings: vi.fn() }));
vi.mock('../../../../src/ui/components/ui-modals.js', () => ({ setupModals: vi.fn() }));
vi.mock('../../../../src/data/core-export.js', () => ({ setupExport: vi.fn() }));
vi.mock('../../../../src/utils/event-bus.js', () => ({ appContext: { getEventBus: vi.fn(() => ({ on: vi.fn(), emit: vi.fn() })) } }));
vi.mock('../../../../src/utils/generation-calculator.js', () => ({ GenerationCalculator: vi.fn() }));

import { TreeEngine } from '../../../../src/core/tree-engine.js';

describe('TreeEngine displayPreferences', () => {
  it('includes showPhotos: true by default', () => {
    const engine = new TreeEngine();
    expect(engine.displayPreferences.showPhotos).toBe(true);
  });

  it('includes all existing display preference keys', () => {
    const engine = new TreeEngine();
    expect(engine.displayPreferences).toMatchObject({
      showMaidenName: true,
      showDateOfBirth: true,
      showFatherName: true,
      showPhotos: true
    });
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test tests/unit/features/photos/show-photos-pref.test.js
```

Expected: FAIL — `expect(received).toBe(true)` with `received: undefined`

- [ ] **Step 3: Add `showPhotos: true` to TreeEngine**

In `src/core/tree-engine.js`, find:
```js
    this.displayPreferences = {
      showMaidenName: true,
      showDateOfBirth: true,
      showFatherName: true
    };
```
Change to:
```js
    this.displayPreferences = {
      showMaidenName: true,
      showDateOfBirth: true,
      showFatherName: true,
      showPhotos: true
    };
```

- [ ] **Step 4: Add `showPhotos: true` to CanvasRenderer defaults**

In `src/core/canvas-renderer.js`, find:
```js
    this.displayPreferences = {
      showMaidenName: true,
      showDateOfBirth: true,
      showFatherName: true
    };
```
Change to:
```js
    this.displayPreferences = {
      showMaidenName: true,
      showDateOfBirth: true,
      showFatherName: true,
      showPhotos: true
    };
```

- [ ] **Step 5: Run test to confirm it passes**

```bash
npm test tests/unit/features/photos/show-photos-pref.test.js
```

Expected: PASS — 2 tests

- [ ] **Step 6: Run full unit suite to check for regressions**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 7: Commit**

```bash
git add src/core/tree-engine.js src/core/canvas-renderer.js tests/unit/features/photos/show-photos-pref.test.js
git commit -m "feat(photos): add showPhotos display preference default"
```

---

### Task 3: Guard photo rendering in CanvasRenderer

**Files:**
- Modify: `src/core/canvas-renderer.js:1148-1160`

- [ ] **Step 1: Update `drawCircleNode` image draw block**

In `src/core/canvas-renderer.js`, find:
```js
    const img = this._getNodeImage(id, node);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, node.x - radius, node.y - radius, radius * 2, radius * 2);
      ctx.restore();
    }

    if (!node.photoBase64) {
      this.drawNodeText(ctx, node, radius * 1.8);
    }
```
Change to:
```js
    const showPhotos = this.displayPreferences.showPhotos !== false;
    const img = showPhotos ? this._getNodeImage(id, node) : null;
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, node.x - radius, node.y - radius, radius * 2, radius * 2);
      ctx.restore();
    }

    if (!node.photoBase64 || !showPhotos) {
      this.drawNodeText(ctx, node, radius * 1.8);
    }
```

- [ ] **Step 2: Run full unit suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/core/canvas-renderer.js
git commit -m "feat(photos): skip photo render when showPhotos preference is false"
```

---

### Task 4: Add checkbox to builder.astro

**Files:**
- Modify: `src/pages/builder.astro:406-409`

- [ ] **Step 1: Add checkbox HTML after showFatherName**

In `src/pages/builder.astro`, find:
```html
          <div class="checkbox-item">
            <input type="checkbox" id="showFatherName" checked>
            <label for="showFatherName" data-i18n="builder.settings.show_father_name">Show Father's Name</label>
          </div>
        </div>
      </div>
    </div>
```
Change to:
```html
          <div class="checkbox-item">
            <input type="checkbox" id="showFatherName" checked>
            <label for="showFatherName" data-i18n="builder.settings.show_father_name">Show Father's Name</label>
          </div>
          <div class="checkbox-item">
            <input type="checkbox" id="showPhotos" checked>
            <label for="showPhotos" data-i18n="builder.settings.show_photos">Show Photos</label>
          </div>
        </div>
      </div>
    </div>
```

- [ ] **Step 2: Run full unit suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/pages/builder.astro
git commit -m "feat(photos): add Show Photos checkbox to Display Preferences"
```

---

### Task 5: Wire showPhotos in ui-settings.js

**Files:**
- Modify: `src/ui/components/ui-settings.js:263`

- [ ] **Step 1: Add 'showPhotos' to preferences array**

In `src/ui/components/ui-settings.js`, find:
```js
  const preferences = ['showMaidenName', 'showDateOfBirth', 'showFatherName'];
```
Change to:
```js
  const preferences = ['showMaidenName', 'showDateOfBirth', 'showFatherName', 'showPhotos'];
```

The existing `forEach` loop already handles syncing the checkbox to `treeCore.displayPreferences`, calling `renderer.updateDisplayPreferences()`, showing a notification toast, and pushing an undo state — no further code changes needed.

- [ ] **Step 2: Run full unit suite**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 3: Commit**

```bash
git add src/ui/components/ui-settings.js
git commit -m "feat(photos): wire showPhotos preference in settings panel"
```

---

### Task 6: Build and smoke test

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: build completes with no errors

- [ ] **Step 2: Manual smoke test**

```bash
npm run preview
```

Open the builder, then verify:

1. Settings panel → Display Preferences → "Show Photos" checkbox is present and checked by default.
2. Add a person with a photo. Confirm the photo fills the circle node.
3. Uncheck "Show Photos". Confirm all photo circles switch to name text immediately.
4. Re-check "Show Photos". Confirm photos return immediately.
5. Uncheck, reload the page, confirm photos remain hidden (preference persisted).
6. Undo (Ctrl+Z) after toggling — confirm the toggle reverses.
7. Switch language to ES/RU/DE — confirm the label translates correctly.

- [ ] **Step 3: Commit build artifacts if dist is tracked**

```bash
git add dist/
git commit -m "build: rebuild dist with show-photos preference"
```

Only run this step if `dist/` is committed to the repo (check `git status`).

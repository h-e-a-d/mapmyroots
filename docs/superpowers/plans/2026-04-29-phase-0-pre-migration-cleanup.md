# Phase 0: Pre-Migration Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix correctness issues, contradictions, and stale metadata in the existing static site before the Astro migration begins, so we don't carry the mess forward.

**Architecture:** Pure content/config edits. No code execution paths change. No new dependencies introduced. The site keeps running as raw static HTML throughout this phase.

**Tech Stack:** N/A — this phase touches only `README.md`, `CLAUDE.md`, `package.json`, `index.html`, `builder.html`, `CNAME`, `public/sitemap.xml`, and creates `docs/CHANGELOG.md`.

**Parent Roadmap:** `docs/ROADMAP.md` (Phase 0).

---

## Pre-flight

These steps run once at the start; they aren't part of any task and don't need commits.

- [ ] **P1: Verify working directory.**

Run: `pwd`
Expected output (or equivalent absolute path of the project root):
```
/Users/egalvans/Downloads/Head/Claude/mapmyroots-main
```

- [ ] **P2: Verify git status.** This phase commits per task; git must be initialized and clean.

Run: `git status`

If "fatal: not a git repository", run:
```bash
git init
git add -A
git commit -m "chore: initial commit before phase 0 cleanup"
```

If git is initialized but has uncommitted changes, commit or stash them before starting.

Expected after: working tree clean (`nothing to commit, working tree clean`).

- [ ] **P3: Install dependencies.** Tests can't run without `node_modules`.

Run: `npm install`
Expected: completes without errors. `node_modules/` directory exists afterward.

- [ ] **P4: Establish test baseline.** We need to know what passes today so we can confirm Phase 0 doesn't regress anything.

Run: `npm test -- --run`
Expected: a pass/fail report. Note whichever tests pass today — at end of Phase 0 we re-run and confirm the same set still passes.

If tests fail to run at all (config error etc.), that's a Phase 1 problem, not a Phase 0 problem. Note the failure mode but proceed — Phase 0 doesn't change any tested code.

---

## Task 1: Create `docs/CHANGELOG.md` from README's historical content

**Why first:** README rewrite (Task 2) deletes this content. Move it before deleting it.

**Files:**
- Create: `docs/CHANGELOG.md`

- [ ] **Step 1: Create the changelog file with extracted historical content.**

Write the following exact content to `docs/CHANGELOG.md`:

````markdown
# Changelog

Historical record of significant changes. Going forward, prefer Git history + release notes over this file.

## January 2025 — Critical Fixes

### Export System Improvements
- **Outline Export Fix:** "Show outline" feature now applies to exported files (PNG, SVG, PDF). Updated `drawCircleNodeExport()` and `drawRectangleNodeExport()` in `canvas-renderer.js` to respect outline settings. SVG export styling made conditional based on `window.treeCore.renderer.settings.showNodeOutline`.
- **Connection Lines Export Restoration:** Fixed connection lines disappearing in exports after the outline fix. `drawConnectionsOnly()` was using hardcoded colors instead of user settings; now mirrors browser display logic.

### Connection Modal Implementation
- Added `setupConnectionModal()`, `openConnectionModal()`, `closeConnectionModal()`, `createConnectionWithType()`, `createLineOnlyConnection()` methods.
- Full support for Mother, Father, Child, Spouse, and Line-only connection types.
- Personalized modal text showing actual person names; proper notifications.
- **Line-Only Connection Fix:** Corrected `createConnectionWithType()` parameter handling — was passing person objects instead of IDs.

### Cache Indicator UX
- **Auto-Close Prevention:** Cache indicator no longer closes immediately when editing tree name.
- Added `clearCollapseTimer()` with hover protection.
- Input field interactions no longer trigger parent element handlers.

## December 2024 — Modal UX/UI Redesign

- Complete redesign of Add Person and Edit Person modals.
- Three-tier button system with gradients, animations, and visual hierarchy.
- Mobile-first single-row button arrangement.
- Confirmation modals with consequence lists.
- Resolved CSS conflicts between `ui-modals.js` automatic enhancement and `modal.css` styles by exempting `personModal` from automatic enhancement.

## December 2024 — Critical Bug Fixes

- **Button State Management:** Fixed conflict between multiple button management systems. Save/Delete buttons no longer become permanently disabled after one use.
- **Race Condition Fix:** Eliminated timing conflicts between competing button-loading-state managers.
- Comprehensive button state reset on modal open/close.

## December 2024 — Modal System Refactoring

- Extracted all modal CSS from `style.css` into dedicated `modal.css`.
- `builder.html` now references both `style.css` and `modal.css`.

## December 2024 — Legacy Code Removal

- Removed all support for legacy data formats. Application now only accepts the current JSON schema.
- Removed `processLegacyData()` and `checkForLegacyData()` methods.
- Removed legacy import modal and related UI elements.
- Removed legacy-related translations from all locale files.

## December 2024 — Smart Node Positioning Fix

- New nodes appear at the current viewport center for immediate visibility.
- Camera auto-centers on loaded JSON content when no saved position exists.

## 2024 — Security & Architecture Overhaul

- All `innerHTML` usage replaced with safe DOM manipulation via `SecurityUtils`.
- Comprehensive input sanitization and data validation.
- Event-driven architecture (`event-bus.js`) replacing window globals.
- `RetryManager` for resilient operations.
- Full keyboard navigation and screen reader support.
- Centralized configuration with feature flags (`config.js`).
````

- [ ] **Step 2: Verify the file was created and is well-formed markdown.**

Run: `wc -l docs/CHANGELOG.md`
Expected: roughly 50–60 lines.

Run: `head -3 docs/CHANGELOG.md`
Expected:
```
# Changelog

Historical record of significant changes. Going forward, prefer Git history + release notes over this file.
```

- [ ] **Step 3: Commit.**

```bash
git add docs/CHANGELOG.md
git commit -m "docs: extract historical changelog from README"
```

---

## Task 2: Replace `README.md` with a focused public README

**Files:**
- Modify (full rewrite): `README.md`

- [ ] **Step 1: Overwrite `README.md` with the new content.**

Write the following exact content to `README.md`:

````markdown
# MapMyRoots

> Free online family tree builder and genealogy software. Build interactive, drag-and-drop family trees in your browser. Your data stays on your device.

**Live site:** [mapmyroots.com](https://mapmyroots.com)

![MapMyRoots screenshot](assets/images/tree.webp)

## Features

- **Interactive canvas builder** — drag-and-drop family tree with pan, zoom, and multi-select
- **Rich person profiles** — names, dates, places, photos, custom notes
- **Multiple views** — graphic canvas + sortable table, switch any time
- **Multi-format export** — PNG, SVG, PDF, GEDCOM (export only; import on roadmap)
- **Auto-save** — your tree persists locally; nothing leaves your device
- **Internationalization** — English, Spanish, Russian, German
- **Search** — instant filter across all family members
- **Undo / redo** — full state history
- **Accessibility** — keyboard navigation, screen reader support, WCAG-aligned
- **Responsive** — works on desktop, tablet, and mobile

## Quick start

The site is currently a vanilla static site. Any HTTP server will do:

```bash
# Python (built-in)
python3 -m http.server 8000

# Node
npx serve .
```

Then open http://localhost:8000 in a modern browser.

> **Migration in progress:** the site is being rebuilt on Astro + Cloudflare Pages. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the plan. Once Phase 1 lands, `npm run dev` will replace the commands above.

## Tech stack

- HTML5, CSS3, vanilla JavaScript (ES modules)
- Canvas API for rendering
- LocalStorage / IndexedDB for persistence
- Vitest (unit) + Playwright (e2e) for tests
- Hosted on Cloudflare Pages

## Project structure

```
.
├── index.html, about.html, contact.html, ...   # Marketing pages
├── builder.html                                 # Family tree builder app
├── tree.js                                      # App entry point
├── src/
│   ├── core/                                    # Tree engine, canvas renderer, commands, spatial index
│   ├── ui/                                      # Components, modals, styles
│   ├── features/                                # Export, search, i18n, accessibility
│   ├── data/                                    # Cache, repositories (localStorage + IndexedDB)
│   ├── shapes/                                  # Visual layout strategies
│   ├── utils/                                   # Event bus, security, error handling
│   ├── analytics/                               # Analytics service + integration
│   └── config/                                  # Feature flags + constants
├── assets/
│   ├── fonts/                                   # Self-hosted Inter + Playfair
│   ├── images/
│   ├── locales/                                 # Translation JSON
│   └── glossary/                                # Genealogy glossary
├── public/                                      # Static files served as-is
└── docs/                                        # Architecture, roadmap, changelog
```

For deeper architecture detail, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Testing

```bash
npm install
npm test                # Vitest unit tests
npm run test:ui         # Vitest with UI
npm run test:coverage   # Coverage report
npm run test:e2e        # Playwright end-to-end
```

## Browser support

Chrome 80+, Firefox 75+, Safari 13+, Edge 80+. Mobile Safari 13+ and Chrome Mobile 80+. Older browsers degrade gracefully.

## Contributing

Issues and pull requests are welcome. For agent-assisted contributions, see [`CLAUDE.md`](CLAUDE.md) for the conventions this codebase uses.

## License

MIT — see [`LICENSE`](LICENSE) (or the `license` field in `package.json` until the file is added).
````

- [ ] **Step 2: Verify line count is reasonable.**

Run: `wc -l README.md`
Expected: roughly 70–90 lines (versus 505 lines in the original).

Run: `grep -c "Recent\|Refactoring\|workflow:" README.md`
Expected: `0` (all the historical/workflow content was removed).

- [ ] **Step 3: Commit.**

```bash
git add README.md
git commit -m "docs: rewrite README to focus on public-facing project info"
```

---

## Task 3: Create `CLAUDE.md` at repo root with workflows + agent guidance

**Why:** the existing `docs/CLAUDE.md` is unrelated Python/FastAPI boilerplate. Replace it. The Claude workflow instructions (Standard, Prepared Task) currently live in `README.md` — move them here.

**Files:**
- Create: `CLAUDE.md` (at repo root)
- Modify (full rewrite): `docs/CLAUDE.md`

- [ ] **Step 1: Create root `CLAUDE.md`.**

Write the following exact content to `CLAUDE.md`:

````markdown
# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## Project at a glance

MapMyRoots is a free, client-side family tree builder. Vanilla JavaScript with ES modules, Canvas-based rendering, LocalStorage/IndexedDB persistence. No backend (until Phase 6 of the roadmap, deferred). Currently being migrated to Astro + Cloudflare Pages — see [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Workflows

When the user prefixes a request with `workflow: <name>`, follow the named workflow exactly.

### Standard

Default workflow. Use when in doubt.

1. Read the user's request carefully and gather context (read relevant files, check existing patterns).
2. Ask clarifying questions if anything is ambiguous.
3. Save a plan to `task.md` (or, for multi-phase work, `docs/superpowers/plans/YYYY-MM-DD-<name>.md`).
4. Summarize the plan and your understanding in 2–3 lines.
5. **Wait for explicit approval before implementing.**

### Prepared Task

Use when the user points you at an existing task file.

1. Read the task file.
2. Investigate referenced files for context.
3. Ask clarifying questions.
4. Summarize your understanding for approval.
5. Implement only after approval.

## Code conventions

### Architecture patterns

- **Event-driven communication.** Use the `EventBus` from `src/utils/event-bus.js` instead of window globals.
- **Security first.** Never use `innerHTML` directly. Use `SecurityUtils` (`src/utils/security-utils.js`) for DOM manipulation and `SecurityUtils.sanitizeText()` for any user input.
- **Resilient operations.** Wrap fallible operations in `RetryManager` (`src/utils/error-handling.js`).
- **Validate at boundaries.** All loaded data must pass schema validation before processing or storage.
- **Accessibility.** Keyboard navigation and ARIA labels on every interactive element. WCAG 2.1 AA target.

### File organization

- Modal CSS lives in `src/ui/styles/modal.css`, never in `style.css`.
- Homepage-only CSS lives in `homepage.css`, never in `style.css`.
- Translation strings live in `assets/locales/*.json`. New user-visible strings require all four locales (en, es, ru, de).
- Files over 500 lines are a smell — prefer splitting by responsibility.

### Code patterns

```javascript
// EventBus instead of window globals
import { appContext, EVENTS } from './src/utils/event-bus.js';

appContext.getEventBus().emit(EVENTS.TREE_PERSON_ADDED, { person });
appContext.getEventBus().on(EVENTS.CANVAS_NODE_SELECTED, (data) => {
  // ...
});

// Safe DOM manipulation
import { SecurityUtils } from './src/utils/security-utils.js';

SecurityUtils.setTextContent(element, userInput);
const button = SecurityUtils.createElement('button', {
  className: 'btn-primary',
  'aria-label': 'Save family tree'
}, 'Save');

// Retry on failure
import { RetryManager } from './src/utils/error-handling.js';

const result = await RetryManager.retry(async () => riskyOperation(), {
  maxRetries: 3,
  baseDelay: 1000
});
```

## Data format

Only the current JSON format is accepted. Legacy formats were removed in December 2024.

```javascript
{
  "version": "2.1.0",
  "cacheFormat": "enhanced",
  "persons": [...],
  "fontSettings": {...},
  "canvasState": {...}
}
```

Loaded data must include `version` or `persons`. Anything else is rejected with a user-facing error.

## Testing expectations

- Unit tests live in `tests/unit/` and run via `npm test` (Vitest + jsdom).
- E2E tests live in `testing/tests/` and run via `npm run test:e2e` (Playwright). Note: this path will be reorganized in the Phase 1 migration.
- Adding a new module: add at least one expected-use test, one edge case, one failure case.
- Adding a user-visible string: confirm all four locales have a translation.

## Migration awareness

The site is mid-migration. When working on this codebase:

- Don't introduce new patterns that contradict the Astro target structure in [`docs/ROADMAP.md`](docs/ROADMAP.md).
- Don't add cloud/backend dependencies — that's deferred to Phase 6.
- If unsure whether a change belongs in current static structure or the future Astro structure, ask.
````

- [ ] **Step 2: Replace `docs/CLAUDE.md` with a pointer to the root one.**

Overwrite `docs/CLAUDE.md` with:

````markdown
# CLAUDE.md (moved)

The agent guidance for this project now lives at the repo root: [`/CLAUDE.md`](../CLAUDE.md).

This file is retained as a redirect for any tools that look for `docs/CLAUDE.md`.
````

- [ ] **Step 3: Verify both files exist and the root one is substantial.**

Run: `wc -l CLAUDE.md docs/CLAUDE.md`
Expected: `CLAUDE.md` ~80–110 lines, `docs/CLAUDE.md` ~5 lines.

- [ ] **Step 4: Commit.**

```bash
git add CLAUDE.md docs/CLAUDE.md
git commit -m "docs: move Claude workflows + agent guidance to root CLAUDE.md"
```

---

## Task 4: `package.json` cleanup

**Files:**
- Modify: `package.json`

The current `package.json` has wrong project name, wrong main entry, dev tool listed as runtime dependency, and a license that contradicts the README claim.

- [ ] **Step 1: Apply targeted edits.**

Find this in `package.json`:
```json
  "name": "familytree-2",
  "version": "1.0.0",
  "description": "A modern, interactive web application for creating and managing family trees with a beautiful visual interface.",
  "main": "accessibility.js",
```

Replace with:
```json
  "name": "mapmyroots",
  "version": "1.0.0",
  "description": "Free online family tree builder and genealogy software with interactive canvas-based visualization.",
```

(The `"main"` line is removed entirely — static sites don't need it, and the value pointed at a moved/non-existent file.)

Find this:
```json
  "license": "ISC",
```

Replace with:
```json
  "license": "MIT",
```

Find this:
```json
  "dependencies": {
    "@anthropic-ai/claude-code": "^2.0.19"
  }
```

Replace with:
```json
  "dependencies": {}
```

(`@anthropic-ai/claude-code` is a developer CLI tool, not a runtime dependency. Move-or-remove: if any team member uses it locally they install it globally; we don't ship it with the site. Phase 1 will introduce real runtime deps via Astro.)

Find this:
```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/h-e-a-d/familytree-2.git"
  },
```

Replace with:
```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/h-e-a-d/mapmyroots.git"
  },
```

> **Note for executor:** verify `h-e-a-d/mapmyroots` matches the actual GitHub org/repo. If the repo lives elsewhere, update this URL and the two below to match before committing.

Find this:
```json
  "bugs": {
    "url": "https://github.com/h-e-a-d/familytree-2/issues"
  },
  "homepage": "https://github.com/h-e-a-d/familytree-2#readme",
```

Replace with:
```json
  "bugs": {
    "url": "https://github.com/h-e-a-d/mapmyroots/issues"
  },
  "homepage": "https://mapmyroots.com",
```

- [ ] **Step 2: Verify JSON is valid.**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))" && echo OK`
Expected: `OK` (no errors).

- [ ] **Step 3: Verify name change took effect.**

Run: `node -e "console.log(require('./package.json').name)"`
Expected: `mapmyroots`

- [ ] **Step 4: Reinstall to refresh the lockfile.**

Run: `npm install`
Expected: completes without errors. `package-lock.json` updates to reflect the renamed package and removed dependency.

- [ ] **Step 5: Confirm tests still run.**

Run: `npm test -- --run`
Expected: same pass/fail set as the Pre-flight P4 baseline.

- [ ] **Step 6: Commit.**

```bash
git add package.json package-lock.json
git commit -m "chore: rename package to mapmyroots, clean up metadata"
```

---

## Task 5: Remove fabricated structured data from `index.html`

**Why:** The `aggregateRating` (4.8 / 2,847 ratings) and the `Sarah Martinez` review aren't backed by a real review-collection system. Google's structured-data policy treats fake aggregate ratings as a violation that can trigger a manual action stripping all rich results from the site.

**Files:**
- Modify: `index.html` (lines ~71–85)

- [ ] **Step 1: Apply the edit.**

Find this exact block in `index.html`:

```html
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "2847",
      "bestRating": "5",
      "worstRating": "1"
    },
    "review": [
      {
        "@type": "Review",
        "author": {"@type": "Person", "name": "Sarah Martinez"},
        "reviewRating": {"@type": "Rating", "ratingValue": "5"},
        "reviewBody": "This tool made creating our family tree so much easier than I expected. The drag-and-drop interface is intuitive and the results are beautiful."
      }
    ],
    "featureList": [
```

Replace with (just the `featureList` line remains):

```html
    "featureList": [
```

- [ ] **Step 2: Verify the JSON-LD is still valid.**

Run: `node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const matches = html.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g);
matches.forEach((m, i) => {
  const json = m.replace(/<script type=\"application\/ld\+json\">/, '').replace(/<\/script>/, '');
  try { JSON.parse(json); console.log('Block', i+1, 'OK'); }
  catch (e) { console.error('Block', i+1, 'FAIL:', e.message); process.exit(1); }
});
"`
Expected: every JSON-LD block reports `OK`.

- [ ] **Step 3: Verify the fabricated content is gone.**

Run: `grep -c "Sarah Martinez\|aggregateRating\|reviewBody" index.html`
Expected: `0`.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "fix(seo): remove fabricated aggregateRating and review from schema"
```

---

## Task 6: FAQ corrections in `index.html`

**Why:** The "do I need to register" answer claims a free account enables cloud sync — that feature doesn't exist (and is deferred to Phase 6 of the roadmap). Currently misleading.

**Files:**
- Modify: `index.html` (lines ~178–182 in the FAQPage schema; lines ~875–878 in the visible FAQ markup)

- [ ] **Step 1: Update the answer in the FAQPage schema (lines ~178–182).**

Find this in `index.html`:
```html
        "name": "Do I need to register or create an account?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No registration required! You can start building your family tree immediately. However, creating a free account lets you save your trees online and access them from any device."
        }
```

Replace with:
```html
        "name": "Do I need to register or create an account?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No registration required and no account needed. You can start building your family tree immediately. All your data is stored locally on your device, so you keep full control."
        }
```

- [ ] **Step 2: Update the visible FAQ markup (lines ~874–879).**

Find this in `index.html`:
```html
          <div class="faq-item fade-in">
            <h3 class="faq-question" data-i18n="faq.register.question">Do I need to register or create an account?</h3>
            <div class="faq-answer">
              <p data-i18n="faq.register.answer">No registration required! You can start building your family tree immediately. However, creating a free account lets you save your trees online and access them from any device.</p>
            </div>
          </div>
```

Replace with:
```html
          <div class="faq-item fade-in">
            <h3 class="faq-question" data-i18n="faq.register.question">Do I need to register or create an account?</h3>
            <div class="faq-answer">
              <p data-i18n="faq.register.answer">No registration required and no account needed. You can start building your family tree immediately. All your data is stored locally on your device, so you keep full control.</p>
            </div>
          </div>
```

- [ ] **Step 3: Update locale JSON files.**

Each locale has a `faq.register.answer` key that needs updating. Locales:

```bash
ls assets/locales/
```
Expected: `de.json  en.json  es.json  ru.json`

For **`assets/locales/en.json`**, find:
```json
    "register": {
      "question": "Do I need to register or create an account?",
      "answer": "No registration required! You can start building your family tree immediately. However, creating a free account lets you save your trees online and access them from any device."
    }
```

Replace with:
```json
    "register": {
      "question": "Do I need to register or create an account?",
      "answer": "No registration required and no account needed. You can start building your family tree immediately. All your data is stored locally on your device, so you keep full control."
    }
```

For **`assets/locales/es.json`**, find the corresponding `faq.register.answer` key (Spanish translation of the old answer) and replace its value with:
```
"No requiere registro ni cuenta. Puedes empezar a construir tu árbol genealógico inmediatamente. Todos tus datos se almacenan localmente en tu dispositivo, así que mantienes el control completo."
```

For **`assets/locales/de.json`**, replace with:
```
"Keine Registrierung und kein Konto erforderlich. Du kannst sofort mit dem Aufbau deines Stammbaums beginnen. Alle deine Daten werden lokal auf deinem Gerät gespeichert, du behältst die volle Kontrolle."
```

For **`assets/locales/ru.json`**, replace with:
```
"Регистрация и аккаунт не требуются. Вы можете сразу начать строить семейное древо. Все данные хранятся локально на вашем устройстве — вы полностью контролируете их."
```

> **Note for executor:** confirm the actual JSON key path in each locale file before editing — translation files sometimes use different nesting. The English structure shown above is the reference; mirror it.

- [ ] **Step 4: Verify JSON validity for all four locales.**

Run:
```bash
for f in assets/locales/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f', 'utf8'))" && echo "$f OK" || echo "$f FAIL"
done
```
Expected: all four report `OK`.

- [ ] **Step 5: Verify the misleading "creating a free account" claim is gone everywhere.**

Run: `grep -rn "creating a free account\|save your trees online\|access them from any device" index.html assets/locales/`
Expected: `0` matches (no output).

- [ ] **Step 6: Commit.**

```bash
git add index.html assets/locales/
git commit -m "fix(faq): remove unsupported cloud-account claim from FAQ across all locales"
```

---

## Task 7: Set canonical host to apex (`mapmyroots.com`)

**Why:** All canonical URLs, OG tags, and sitemap entries use the apex `mapmyroots.com`, but the `CNAME` file (which Cloudflare Pages uses to set the production hostname) says `www.mapmyroots.com`. Pick one — apex is the decision per `docs/ROADMAP.md`. The `www → apex` 301 redirect is handled in Phase 2 via `_redirects`.

**Files:**
- Modify: `CNAME`

- [ ] **Step 1: Update `CNAME` to apex.**

Run: `cat CNAME`
Expected current content: `www.mapmyroots.com`

Overwrite `CNAME` with this exact content (no trailing newline issues — single line):

```
mapmyroots.com
```

- [ ] **Step 2: Verify.**

Run: `cat CNAME`
Expected: `mapmyroots.com`

- [ ] **Step 3: Commit.**

```bash
git add CNAME
git commit -m "chore: set canonical host to apex mapmyroots.com (www redirect handled in Phase 2)"
```

> **Note:** Cloudflare Pages dashboard may also need its custom-domain settings adjusted to make `mapmyroots.com` the primary domain and `www.mapmyroots.com` a redirect alias. That's a manual step in the Pages UI when Phase 2 deploys, not a repo change.

---

## Task 8: Drop dead `meta http-equiv` security headers

**Why:** `<meta http-equiv="X-Frame-Options">` and `<meta http-equiv="X-XSS-Protection">` are silently ignored by browsers — these only work as real HTTP headers. Real headers come in Phase 2 via `_headers`. `X-XSS-Protection` is also formally deprecated (Chrome dropped it). Keep CSP as meta for now since browsers do honor that.

**Files:**
- Modify: `index.html` (lines ~10–11)
- Modify: `builder.html` (lines ~10–11)

- [ ] **Step 1: Edit `index.html`.**

Find this in `index.html`:
```html
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <meta http-equiv="X-XSS-Protection" content="1; mode=block">
  <meta name="referrer" content="strict-origin-when-cross-origin">
```

Replace with:
```html
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta name="referrer" content="strict-origin-when-cross-origin">
```

(`X-Content-Type-Options` is the only `http-equiv` browsers actually honor in meta form here; keep it.)

- [ ] **Step 2: Edit `builder.html`.**

Find this in `builder.html`:
```html
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-Frame-Options" content="DENY">
  <meta http-equiv="X-XSS-Protection" content="1; mode=block">
  <meta name="referrer" content="strict-origin-when-cross-origin">
```

Replace with:
```html
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta name="referrer" content="strict-origin-when-cross-origin">
```

- [ ] **Step 3: Verify removals.**

Run: `grep -n "X-Frame-Options\|X-XSS-Protection" index.html builder.html`
Expected: no output (no matches).

- [ ] **Step 4: Commit.**

```bash
git add index.html builder.html
git commit -m "chore(security): drop dead meta http-equiv headers (real headers come in Phase 2)"
```

---

## Task 9: Drop `<meta name="keywords">` from `index.html`

**Why:** Google has ignored the keywords meta tag since 2009. Yandex sometimes treats keyword-stuffed meta as a spam signal. Pure liability with zero upside.

**Files:**
- Modify: `index.html` (line ~15)

- [ ] **Step 1: Apply the edit.**

Find this in `index.html`:
```html
  <meta name="description" content="Create beautiful, interactive family trees with MapMyRoots - the free online genealogy software. Build unlimited family trees, visualize ancestry, connect relatives, and preserve your family history forever. No hidden costs, intuitive drag-and-drop interface." data-i18n-content="meta.description">
  <meta name="keywords" content="free family tree maker, genealogy software online, interactive family tree builder, family history visualization tool, ancestry tracking, lineage mapping, heritage preservation, genealogical research, family tree creator, online genealogy, family connections" data-i18n-content="meta.keywords">
  <meta name="author" content="MapMyRoots">
```

Replace with:
```html
  <meta name="description" content="Create beautiful, interactive family trees with MapMyRoots - the free online genealogy software. Build unlimited family trees, visualize ancestry, connect relatives, and preserve your family history forever. No hidden costs, intuitive drag-and-drop interface." data-i18n-content="meta.description">
  <meta name="author" content="MapMyRoots">
```

- [ ] **Step 2: Check no other HTML files have the keywords meta.**

Run: `grep -rn 'name="keywords"' --include="*.html" .`
Expected: no output (only `index.html` had it — verified during planning).

- [ ] **Step 3: Verify.**

Run: `grep -c 'name="keywords"' index.html`
Expected: `0`.

- [ ] **Step 4: Commit.**

```bash
git add index.html
git commit -m "chore(seo): drop ignored meta keywords tag"
```

---

## Task 10: Remove section-anchor URLs from `public/sitemap.xml`

**Why:** Search engines strip the fragment from URLs before indexing — `https://mapmyroots.com/#features` is just `https://mapmyroots.com/` in the index. Having the fragments listed creates duplicate sitemap entries that waste crawl budget and dilute signals. Phase 3 replaces this entire file with an auto-generated sitemap; this is a stop-gap fix for the live site in the meantime.

**Files:**
- Modify: `public/sitemap.xml` (removing six `<url>` blocks containing `#`-anchors)

- [ ] **Step 1: Apply the edit.**

Find this exact block in `public/sitemap.xml` (starts after `<priority>0.3</priority>` of the Terms entry, includes all six anchor `<url>` blocks, ends before `</urlset>`):

```xml
  <!-- Section anchors for better SEO (optional but helpful) -->
  <url>
    <loc>https://mapmyroots.com/#features</loc>
    <lastmod>2025-01-18</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

  <url>
    <loc>https://mapmyroots.com/#how-it-works</loc>
    <lastmod>2025-01-18</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

  <url>
    <loc>https://mapmyroots.com/#examples</loc>
    <lastmod>2025-01-18</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>https://mapmyroots.com/#testimonials</loc>
    <lastmod>2025-01-18</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

  <url>
    <loc>https://mapmyroots.com/#faq</loc>
    <lastmod>2025-01-18</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>

  <url>
    <loc>https://mapmyroots.com/#comparison</loc>
    <lastmod>2025-01-18</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>

</urlset>
```

Replace with (just the closing tag remains):

```xml

</urlset>
```

- [ ] **Step 2: Update remaining `lastmod` dates to today.**

Today is `2026-04-29` (per the active session date). Update all remaining `lastmod` values that say `2025-01-18` to `2026-04-29`.

Run:
```bash
sed -i.bak 's/<lastmod>2025-01-18<\/lastmod>/<lastmod>2026-04-29<\/lastmod>/g' public/sitemap.xml && rm public/sitemap.xml.bak
```

(The `.bak` dance is for cross-platform `sed -i` portability — macOS `sed` requires an extension for `-i`. Linux GNU `sed` accepts `-i.bak` too.)

- [ ] **Step 3: Verify.**

Run: `grep -c "<url>" public/sitemap.xml`
Expected: `7` (homepage, builder, glossary, about, contact, privacy, terms — anchors removed).

Run: `grep -c "#" public/sitemap.xml`
Expected: `0` (no hash characters anywhere — comments containing `#` were already removed).

Run: `grep -c "2025-01-18" public/sitemap.xml`
Expected: `0`.

Run: `grep -c "2026-04-29" public/sitemap.xml`
Expected: `7`.

- [ ] **Step 4: XML validity check.**

Run: `xmllint --noout public/sitemap.xml && echo OK`
Expected: `OK`.

(If `xmllint` isn't installed, alternative: `node -e "const x = require('fs').readFileSync('public/sitemap.xml', 'utf8'); if (x.includes('<urlset') && x.includes('</urlset>')) console.log('OK')"`.)

- [ ] **Step 5: Commit.**

```bash
git add public/sitemap.xml
git commit -m "fix(seo): remove section-anchor URLs from sitemap and refresh lastmod dates"
```

---

## Task 11: Final verification

After all tasks above are complete, run the full Phase 0 verification suite.

- [ ] **Step 1: Tests still pass.**

Run: `npm test -- --run`
Expected: same pass/fail set as Pre-flight P4 baseline. Phase 0 made no functional code changes, so any regression here is a bug.

- [ ] **Step 2: All HTML files parse as valid HTML.**

Run:
```bash
for f in *.html; do
  node -e "
    const html = require('fs').readFileSync('$f', 'utf8');
    if (html.includes('<html') && html.includes('</html>')) console.log('$f OK');
    else { console.error('$f FAIL'); process.exit(1); }
  "
done
```
Expected: every HTML file reports `OK`.

- [ ] **Step 3: All JSON-LD blocks still parse.**

Run:
```bash
for f in *.html; do
  node -e "
    const html = require('fs').readFileSync('$f', 'utf8');
    const blocks = html.match(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g) || [];
    blocks.forEach((b, i) => {
      const json = b.replace(/<script type=\"application\/ld\+json\">/, '').replace(/<\/script>/, '');
      try { JSON.parse(json); }
      catch (e) { console.error('$f block', i+1, 'FAIL:', e.message); process.exit(1); }
    });
    console.log('$f', blocks.length, 'JSON-LD blocks OK');
  "
done
```
Expected: every HTML file reports the count of its blocks as `OK`.

- [ ] **Step 4: No fabricated review content remains anywhere.**

Run: `grep -rn "Sarah Martinez\|aggregateRating\|2847" --include="*.html" .`
Expected: no output.

- [ ] **Step 5: README and CLAUDE.md hygiene.**

Run:
```bash
test -f CLAUDE.md && echo "root CLAUDE.md exists"
test -f docs/CHANGELOG.md && echo "CHANGELOG exists"
grep -c "workflow:\|## Standard\|## Prepared Task" README.md
```
Expected:
```
root CLAUDE.md exists
CHANGELOG exists
0
```
(README no longer contains the Claude workflow blocks.)

- [ ] **Step 6: package.json sanity.**

Run: `node -e "const p=require('./package.json'); console.log(p.name, p.license); if(p.name!=='mapmyroots'||p.license!=='MIT') process.exit(1)"`
Expected: `mapmyroots MIT`.

Run: `node -e "const p=require('./package.json'); if(p.dependencies['@anthropic-ai/claude-code']) process.exit(1); else console.log('clean')"`
Expected: `clean`.

- [ ] **Step 7: Verify git log shows the expected commit count.**

Run: `git log --oneline | head -15`
Expected: at least 9 commits from Phase 0 (one per task that committed: Tasks 1–10 minus Task 11 which is verification only).

- [ ] **Step 8: Smoke test the live experience.**

Run: `python3 -m http.server 8000` (or `npx serve .`).

Open http://localhost:8000 in a browser. Verify:
- Homepage renders with no console errors.
- FAQ section shows the corrected "register" answer.
- Click through to `/builder.html` — canvas loads, can add a person, save works.
- Open browser DevTools → Console → no JavaScript errors.
- View page source → no `Sarah Martinez`, no `aggregateRating`, no `name="keywords"`, no `X-Frame-Options` meta.

Expected: all checks pass.

- [ ] **Step 9: Stop the dev server.**

`Ctrl+C` in the terminal running the server.

---

## Phase 0 complete

When all checks above pass, Phase 0 is done. The repo is in a clean, accurate state and ready for Phase 1 (Astro migration).

Update [`docs/ROADMAP.md`](../../ROADMAP.md) Phase 0 section by checking off the tasks (manual; or leave the roadmap unchanged and use git log as the record of completion).

Next step: write `docs/superpowers/plans/YYYY-MM-DD-phase-1-astro-migration.md` using the writing-plans skill.

---

## Self-review (run after writing the plan, before execution)

This section is the plan author's checklist; the executor can ignore it.

**1. Spec coverage.** Cross-check against `docs/ROADMAP.md` Phase 0 task list:
- [x] README rewrite — Task 2
- [x] CLAUDE.md at repo root — Task 3
- [x] package.json cleanup — Task 4
- [x] Remove fabricated structured data — Task 5
- [x] FAQ corrections — Task 6
- [x] Pick canonical host — Task 7
- [x] Drop dead security meta tags — Task 8
- [x] Drop meta keywords — Task 9
- [x] Sitemap section-anchor cleanup — Task 10
- [x] CHANGELOG extraction (implicit prerequisite for README rewrite) — Task 1

**2. Placeholder scan.** Searched for "TBD", "TODO", "fill in", "appropriate", "etc." in step bodies. The two notes labeled "Note for executor" (Task 4 GitHub URL verification, Task 6 locale JSON key path verification) are explicit verification asks, not placeholders — they identify concrete things to confirm before committing.

**3. Type/path consistency.** All file paths used are real, verified paths in this repo. Locale JSON files were confirmed to exist at `assets/locales/{en,es,ru,de}.json`. Sitemap path is `public/sitemap.xml` (confirmed). README and CLAUDE.md targets are at repo root.

**4. Sequencing.** Task 1 (CHANGELOG) runs before Task 2 (README) because README deletes the historical content. Task 5 (remove fabricated reviews) runs before Task 11 (verification) so the grep check has something to verify against. All other tasks are independent and can run in any order without conflict.

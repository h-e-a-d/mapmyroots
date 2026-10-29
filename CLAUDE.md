# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## Project at a glance

MapMyRoots is a free, client-side family tree builder. Vanilla JavaScript with ES modules, Canvas-based rendering, LocalStorage/IndexedDB persistence. Built on Astro + Cloudflare Pages. No backend (the "Deferred — Cloud Foundation" track in [`docs/ROADMAP.md`](docs/ROADMAP.md) is deferred indefinitely). Active work is Phase 5 feature development; Phase 6 (SEO content) runs in parallel.

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
- **Security first.** Never put dynamic values into `innerHTML` (`tests/unit/innerhtml-guard.test.js` enforces this). Build nodes and set `textContent`, or use `SecurityUtils` (`src/utils/security-utils.js`). `SecurityUtils.sanitizeText()` HTML-escapes, so use it only when the result goes into HTML markup. Never pass its output to `textContent` or `.value`, or users will see literal entities like `&#39;`.
- **Resilient operations.** Wrap fallible operations in `RetryManager` (`src/utils/error-handling.js`).
- **Validate at boundaries.** All loaded data must pass schema validation before processing or storage.
- **Accessibility.** Keyboard navigation and ARIA labels on every interactive element. WCAG 2.1 AA target.

### File organization

- Modal CSS lives in `src/styles/modal.css`, never in `src/styles/global.css`.
- Homepage-only CSS lives in `src/styles/homepage.css`, never in `global.css`.
- Translation strings live in `public/assets/locales/*.json`. New user-visible strings require all four locales (en, es, ru, de).
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
- E2E tests live in `testing/tests/` and run via `npm run test:e2e` (Playwright).
- Adding a new module: add at least one expected-use test, one edge case, one failure case.
- Adding a user-visible string: confirm all four locales have a translation.

### Translation strings

- Build-time strings (Astro pages) use `t(locale, 'key.path')` from `src/i18n/`. Static-page text lives under `pages.<page>.*`. Don't add `data-i18n` to static pages: the language switcher navigates to `/de/...` and the other localized URLs instead of translating in place.
- Runtime strings (builder UI) continue to use the existing `data-i18n` attributes resolved by `src/features/i18n/i18n.js`.
- `tests/unit/i18n-keys.test.js` fails if a `data-i18n*` or `t(locale, '…')` key is missing, or if the four locale files' key sets differ.
- Missing keys fall back to English with a dev-mode warning. Adding a new user-visible string still requires updating all four locale JSONs (Phase 0 rule unchanged).

## Roadmap awareness

Phases 0–4 of [`docs/ROADMAP.md`](docs/ROADMAP.md) (pre-migration cleanup, Astro, Cloudflare Pages, SEO, PWA) are complete. Current work is Phase 5 (feature parity and improvements). Cloud/accounts are deferred indefinitely — don't introduce cloud/backend dependencies.

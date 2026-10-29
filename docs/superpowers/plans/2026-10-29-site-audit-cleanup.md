# Site audit: cleanup, refactoring, documentation gaps (2026-10-29)

## Baseline (state at f245467)

- `npm test`: 33 files, 262 tests pass.
- `npm run build`: succeeds, with one Vite warning (`search.js` is imported both statically and dynamically).
- Locale JSONs: en/es/ru/de all have 500 keys and match each other.

## Findings

### A. Bugs (user-visible)

1. **PDF export is blocked by the CSP in production (confirmed with `curl -I https://mapmyroots.com/builder`).**
   `public/_headers` has a `/builder` rule and a `/*` rule. Cloudflare sends both CSP headers, and the
   browser enforces both. The `/*` policy doesn't allow `cdnjs`, `unpkg` or `jsdelivr`, so
   `loadJsPDF()` (`src/features/export/exporter.js:191`) can't load jsPDF. The loader also pulls
   `jspdf@latest` from unpkg/jsdelivr, which is an unpinned supply-chain risk.
2. **About/Contact/Privacy/Terms show raw keys in the browser (high confidence, still needs a browser check).**
   226 `data-i18n` keys used on these pages are missing from `en.json` (about 42, contact 12,
   privacy 75, terms 96, languages 1). `Header.astro` loads `i18n.js` on every page, and
   `updatePageContent()` sets `textContent = key` when a key is missing. So static English text
   like "About MapMyRoots" is replaced with `about.hero.title`.

### B. Security / convention violations (CLAUDE.md rules)

3. Non-trivial `innerHTML` writes: `searchableSelect.js:120`, `ui-settings.js:404,621`,
   `ui-modals.js:97`, `notifications.js:44-124`, `search.js:303`, `language-switcher.js:340`,
   `i18n.js:395` (`data-i18n-html`). Check each for user data and move to `SecurityUtils`.
4. About 18 `window.*` globals (`window.treeCore`, `window.notifications`, `window.modalUtils`, …).
   Remove dead ones (`window.testJsPDFLoading`). Keep the ones e2e tests depend on and document them.
   Don't do a full EventBus migration in this pass.

### C. Dead code / stale files

5. Legacy social-image tooling in `public/` is shipped to `dist/`: `og-image.html`,
   `twitter-image.html`, `generate-images.js`, `SOCIAL-IMAGES-README.md`. `astro-og-canvas`
   (`src/pages/og/[slug].ts`) has replaced them, and nothing references them.
6. `scripts/fix-innerhtml.sh` is a one-off audit script. Delete it, or replace it with a Vitest guard test
   that fails on new unsafe `innerHTML` writes (recommended).
7. Unused direct devDependencies: `happy-dom`, `cssnano`, `postcss-cli`, `@axe-core/cli`
   (check CI first). `canvaskit-wasm` is only a transitive dependency of `astro-og-canvas`, so drop the direct entry.
8. About 190 `console.log` calls remain (tree-engine 83, exporter 22, modal 16, …). Prod builds
   strip them (fdb4e0d), but they add noise in dev. Remove the noisy per-frame/per-action ones.
9. The `search.js` mixed static/dynamic import in `tree.js`: use the static import only.

### D. Refactoring (files > 500 lines; CLAUDE.md "smell")

10. Biggest offenders: `tree-engine.js` 2294, `builder.astro` 1605, `modal.js` 1523,
    `canvas-renderer.js` 1411, `ui-modals.js` 1273, `exporter.js` 1085, `homepage.js` 972,
    `analytics-service.js` 892. **Proposal for this pass:** only `exporter.js`, where splitting out
    the PDF path is needed for fix #1 anyway, plus moving inline scripts out of `builder.astro`.
    Splitting `tree-engine.js` and `modal.js` gets its own plan later, because the risk is high and the e2e coverage is thin.

### E. Documentation gaps

11. `docs/ARCHITECTURE.md` still describes `CommandManager` and `QuadTree`, both deleted in
    7f2d14d (lines 10, 47, 60, 261-277, 323-360, 459, 476, 522, 566-589). Rewrite those sections
    to describe snapshot undo and viewport culling (cd23b4a).
12. `docs/CHANGELOG.md` stops at January 2025. Either add entries for 2026 (Phase 5 features, PR #1,
    the GTM fix), or say plainly that it's frozen and point to git history.
13. `README.md` doesn't cover analytics/GTM, the privacy implications, the test commands, or the
    deploy flow. Link `docs/CLOUDFLARE_PAGES_SETUP.md`.
14. `src/analytics/README.md` (699 lines) is far larger than the code it documents. Trim it to the event
    taxonomy plus GTM setup.
15. `docs/ROADMAP.md`: update the Phase 5 status (the only open checkbox is the contact form).
16. `task.md` (your uncommitted edit) holds the finished GTM plan. Leave it for you to decide.

### F. Possible improvements (not in this pass unless you want them)

- Cookie consent / Consent Mode v2 for EU visitors now that GA4 is live (legal exposure).
- Contact form (Phase 5.1, still open).
- Guard tests: locale-key coverage for `data-i18n` (would have caught #2), and the innerHTML lint (#6).
- e2e smoke test for PNG/SVG/PDF export (would have caught #1).

## Plan (execution order, one commit each)

1. **Fix PDF export:** add `jspdf` as a pinned npm dependency, lazy-load it with `import('jspdf')`,
   and delete the CDN loader. Then drop the CDN hosts from the `/builder` CSP if nothing else needs them.
   Add a unit test for the loader and check it in the browser.
2. **Fix static-page i18n:** add the 226 missing keys to `en.json`, taking the English text from the
   current markup, plus es/ru/de translations. Add a Vitest guard that every `data-i18n*` key in
   `src/` exists in `en.json`. Check /about in the browser.
3. **innerHTML hardening** (#3) and the guard test that replaces `fix-innerhtml.sh` (#6).
4. **Dead code:** remove the legacy public files (#5), unused deps (#7), noisy logs (#8), the import warning (#9),
   and dead globals (#4).
5. **Exporter split + builder.astro inline-script extraction** (#10, limited scope).
6. **Docs:** ARCHITECTURE, CHANGELOG, README, the analytics README and ROADMAP (#11-15).
7. Verify: `npm test`, `npm run build` (no warnings), `npm run test:e2e`, and a manual browser check of
   /about, /de/about and the builder PDF export.

## Open questions

- Should the scope include translating the static pages into es/ru/de, or only English keys for now
  (the fallback still shows English)? Translating 226 strings × 3 locales is the largest chunk of work.
- Should cookie consent be part of this pass?
- Are you OK deferring the `tree-engine.js` / `modal.js` split to a separate plan?

## Outcome (executed 2026-10-29 on `chore/site-audit-cleanup`)

Approved scope: translate all four locales, skip cookie consent, defer the tree-engine/modal split. One commit per step: a61d55f (PDF/CSP), f85f31d (i18n), b712ec3 (security), df8e18c (analytics double-count + dead code), 3114560 (refactor), 682106d (docs).

Found during execution, beyond the original findings:
- Builder analytics were sent to GA4 twice (duplicate `AnalyticsIntegration` from f245467). Fixed.
- Ctrl/Cmd+/, Ctrl/Cmd+Shift+P and `familyTreeAPI.search` called non-existent exports. Fixed.
- `SecurityUtils.setTextContent` double-escaped text (O&#39;Brien), and the language menu built non-existent `languages.de`/`languages.ru` keys. Fixed.
- Search regex crashed on `(`. Fixed.
- **Not fixed (needs a decision):** header/nav/footer CSS lives only in `homepage.css`, so every non-home static page renders unstyled in production. See ARCHITECTURE "Known debt" #4.
- **Not fixed (pre-existing):** 13 of 29 Desktop Chrome e2e tests fail on `main` as well. Modal elements are "not stable" (still moving), so clicks time out. Tree-chart specs are flaky.
- **Not fixed:** `npm audit` reports critical/high advisories in `astro` (≤7.3.1) and transitive build deps, which need an Astro major upgrade.

Verification: 284 unit tests pass; `astro check` reports 0 errors; the build has no warnings. Browser check against a local preview: `/de/about` renders German, PDF export via Ctrl+Shift+P produces `family-tree.pdf` from the bundled jsPDF, Ctrl+/ focuses search, a `(` query doesn't throw. E2E failure set matches the `main` baseline apart from flaky tests.

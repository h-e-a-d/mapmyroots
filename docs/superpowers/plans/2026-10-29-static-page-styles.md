# Static-page styling (2026-10-29)

Follow-up to `2026-10-29-site-audit-cleanup.md` (PR #2), from ARCHITECTURE "Known debt" #4.

## Problem (confirmed on production `/privacy`)

`BaseLayout.astro` loads only `global.css` (builder styles) and the footer's scoped styles. The site chrome lives in `homepage.css`, which only `index.astro` imports. That covers the skip link, header, nav, CTA button, hamburger, mobile menu, mobile language switcher, `.sr-only`, `.btn-primary`/`.btn-secondary`, and their responsive rules. So on About, Contact, Privacy, Terms, Glossary and Offline:

- The header renders as a bare list of links, the skip link is always visible, and the mobile menu is always expanded.
- About/Contact/Privacy/Terms content classes (`about-container`, `value-card`, `stats-grid`, `contact-grid`, `contact-card`, `legal-container`, `highlight-box`, …) have no rules at all.

The footer, language dropdown, offline page and glossary already have scoped styles and work.

## Plan

Branch `fix/static-page-styles`, stacked on `chore/site-audit-cleanup`. The PR targets that branch, or `main` once PR #2 merges.

1. **Shared chrome stylesheet.** Create `src/styles/site.css` and **move** the following rules out of `homepage.css` (not copy):
   - skip link, `.sr-only`, header/nav/hamburger/mobile menu/mobile language switcher, `.btn-primary`/`.btn-secondary`
   - their rules inside the 1024px and 480px media blocks
   - the reduced-motion rules that apply to them

   Import `site.css` from `BaseLayout.astro`. The homepage keeps its look because it renders through BaseLayout too. The builder is unaffected because it uses `BuilderLayout`.
2. **Content-page stylesheet.** Create `src/styles/content-pages.css`. It holds the layouts for the about, contact and legal pages: a readable max-width column, hero, card grids, stats, highlight box, translation notice and last-updated line. It uses the existing tokens (`--primary-color`, `--border-radius-card`, `--shadow-card`, `--font-display`) so it matches the homepage. Import it only from `about`, `contact`, `privacy` and `terms`, so the homepage's own `.cta-section` and similar classes can't collide. Rules are scoped under each page's container class.
3. **Guard test.** Add `tests/unit/static-page-styles.test.js`. It fails if a class used in `Header.astro` or in the four content pages has no rule in a stylesheet those pages load. The test is a regex scan, like the other guard tests.
4. **Docs.** Update the CLAUDE.md file-organization rules: `site.css` holds shared chrome, `content-pages.css` holds static content pages, and `homepage.css` holds only homepage sections. Mark ARCHITECTURE known debt #4 resolved, and add a CHANGELOG line.
5. **Verify:**
   - `npm test`, `npm run check` and `npm run build` pass.
   - In a local preview, compare screenshots at 1440px and 375px for `/`, `/about`, `/de/contact`, `/privacy`, `/terms`, `/glossary` and `/offline`. Check the homepage before and after the move for regressions.
   - Check the mobile menu toggle and the language dropdown on a content page.

## Out of scope

- Redesigning the homepage or the builder.
- Dark mode (homepage dark mode is deliberately disabled).
- Moving the builder-only rules out of `global.css`. Static pages still load it; that adds weight but causes no visual problem.

## Outcome (executed 2026-10-30 on `fix/static-page-styles`)

- `site.css` holds the chrome moved out of `homepage.css`. The homepage's responsive button overrides are now scoped under `.page-home`, because `site.css` loads after `homepage.css` and would otherwise win. A computed-style snapshot of every homepage element at 1440px and 390px matched the baseline exactly after the move.
- `content-pages.css` styles About/Contact/Privacy/Terms. The inline `style` on the About lists moved into it.
- Found and fixed during verification:
  - **The mobile menu had zero height on every page, homepage included.** The header's `backdrop-filter` makes `.header` the containing block for the fixed-position `.mobile-menu`, so `top: 80px; bottom: 0` collapsed it. The menu now has an explicit height.
  - The skip link (41.6px tall at the homepage line-height) peeked out from `top: -40px`. Now `-100px`.
- Guard test: `tests/unit/static-page-styles.test.js`. It was checked to fail with `site.css` emptied.

# MapMyRoots Rebuild Roadmap

> **Scope note:** This is the umbrella roadmap covering multiple independent subsystems. Each phase below will get its own detailed step-by-step implementation plan before execution (saved to `docs/superpowers/plans/`). This document locks decisions, sequences phases, and defines scope per phase.

**Goal:** Migrate MapMyRoots from raw static HTML to an Astro-based site on Cloudflare Pages, fix existing SEO/security/correctness issues, ship as a real installable PWA, and keep the architecture ready for cloud features (accounts, share-by-link, sync) without building them now.

**Architecture:** Astro (Vite under the hood) with the Cloudflare adapter in static mode. Marketing/content pages prerender to HTML with zero JS. The canvas builder app lives as one client-loaded island, importing the existing `src/` modules unchanged. i18n via real prerendered routes (`/de/`, `/es/`, `/ru/`). When cloud features arrive, switch to hybrid output and add Workers routes incrementally.

**Tech Stack:** Astro 5.x, `@astrojs/cloudflare`, `@vite-pwa/astro`, Cloudflare Pages, Cloudflare Web Analytics (replaces GTM/GA4), Cloudflare Pages Functions (for contact form), Vitest, Playwright, GitHub Actions for CI/CD + Lighthouse-CI.

---

## Decisions Locked

These were the open questions from planning. Decisions made and rationale recorded below — no further discussion needed unless circumstances change.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | **Canonical host: apex (`mapmyroots.com`)** — `www` 301s to apex | Cleaner branding, shorter URLs, modern convention. Cloudflare DNS handles apex flattening. |
| 2 | **i18n: real prerendered routes** (`/de/`, `/es/`, `/ru/`, `/`) — not `?lang=` querystrings | Current `?lang=` setup is client-side string swap; Google can't credit it for hreflang. Astro's i18n routing emits real translated HTML. |
| 3 | **Remove fabricated `aggregateRating` and the Sarah Martinez review** from schema | Risk of Google manual action for fake structured data. Add back later if/when real reviews are collected. |
| 4 | **Build pipeline: Astro** (Vite under the hood, no functionality rewrites) | Solves bundling, i18n routing, content collections, and deduplicated layouts in one tool. First-party Cloudflare adapter. |
| 5 | **Analytics: Cloudflare Web Analytics**, drop GTM/GA4 | Cookieless → no consent banner needed for EU users. Free. Privacy-aligned with the local-first product positioning. GA4 can be added later behind consent if detailed funnel tracking is needed. |
| 6 | **PWA: real installable PWA with service worker** via `@vite-pwa/astro` | Genealogy use case fits perfectly: multi-session edits, offline editing, mobile install. Currently the manifest is referenced but no service worker exists, so install prompts don't fire. |
| 7 | **Contact form: Cloudflare Pages Function + Resend + Turnstile**, forwarding to `support@mapmyroots.com` | Stays in the Cloudflare ecosystem. Turnstile is free and replaces reCAPTCHA. Resend has a free tier (3,000 emails/mo). |
| 8 | **Accounts/cloud: deferred.** Remove the FAQ claim that creating an account enables cloud save | User explicitly deferred cloud. Architecture stays ready (Astro hybrid mode + Cloudflare bindings). |
| 9 | **GEDCOM import: high-priority feature**, scheduled in Phase 5 (post-migration) | Currently the FAQ apologizes for not having it. It's the #1 missing feature for genealogy users (migration path from Ancestry/MyHeritage/FamilySearch). |
| 10 | **Move Claude workflows from `README.md` to `CLAUDE.md` at repo root** | Workflows ("Standard", "Prepared Task") are agent instructions, not public README content. |

---

## Phase Sequence & Dependencies

```
Phase 0  ─┬→  Phase 1  ─→  Phase 2  ─┬→  Phase 3  ─┬→  Phase 4  ─→  Phase 5
          │   (Astro)     (CF Pages)  │   (SEO)     │   (PWA)        (Features)
          │                           │             │
          │                           │             └→  Phase 6 (Content) — runs in parallel
          │                           │
Pre-mig   │                           └→  can start once Astro routing is live
cleanup   │
          └→  some items also fine to do early in Phase 1
```

**Critical path:** Phase 0 → 1 → 2 → 3 → 4. Phase 5 features ship independently. Phase 6 (content/SEO growth) is ongoing once SEO infra in Phase 3 is live. Cloud is deferred indefinitely.

**Estimated total effort to end of Phase 4 (production-ready new site):** 8–13 working days.

---

## Phase 0 — Pre-Migration Cleanup

**Effort:** 0.5–1 day. **Branch:** `chore/pre-migration-cleanup`. **Independence:** framework-agnostic; can ship before Astro work starts.

### Scope
Fix correctness issues, contradictions, and stale metadata that would otherwise carry into the new site. No build/framework changes here.

### Tasks (file-level)

- **`README.md` rewrite.** Strip the embedded changelog (lines 50–224), the workflow instructions (lines 5–30), and the duplicate "Family Tree Builder" section (lines 447–end). New README covers: tagline → live URL + screenshot → key features (one list) → quick start → tech stack → project structure (matching actual `src/` layout) → testing → contributing → license. Move historical content to `docs/CHANGELOG.md`.
- **`CLAUDE.md` at repo root.** Move "Standard" and "Prepared Task" workflows here from README. Add the architecture/patterns sections currently in README that are agent-relevant (event-driven architecture, SecurityUtils usage, RetryManager pattern).
- **`package.json` cleanup.** Rename `"familytree-2"` → `"mapmyroots"`. Remove `"main": "accessibility.js"` (wrong path; not needed for static site). Update `repository.url`, `homepage`, `bugs.url` to MapMyRoots GitHub. Move `@anthropic-ai/claude-code` from `dependencies` to `devDependencies` (or remove if not used at runtime). Set `"license": "MIT"` to match README claim.
- **Remove fabricated structured data from `index.html`.** Delete the `aggregateRating` object (lines ~71–77) and the `review` array containing Sarah Martinez (lines ~78–85). Keep the SoftwareApplication shell. Same review for any other page that has them.
- **FAQ corrections in `index.html`.** Update Q "Do I need to register?" — remove the second sentence about creating a free account enabling cloud save (we're not building that yet). Update Q "Can I import data from Ancestry?" wording to be future-facing without committing to a date.
- **Pick one canonical host.** Update `CNAME` from `www.mapmyroots.com` to `mapmyroots.com`. The www→apex 301 will be set in Phase 2 via `_redirects`.
- **Fix the meta-tag-only security headers.** Drop `<meta http-equiv="X-Frame-Options">` and `<meta http-equiv="X-XSS-Protection">` from all HTML files — these don't work as meta tags (browsers ignore them) and X-XSS-Protection is deprecated. Real security headers come in Phase 2 via `_headers`. Keep CSP as meta for now (it does work, but we'll move it to a header later).
- **Drop `<meta name="keywords">`.** Ignored by Google, treated as spam signal by Yandex. Same change across all HTML pages.
- **Remove sitemap section anchors** (`#features`, `#how-it-works`, etc.) from `public/sitemap.xml`. Google strips fragments — these dupe `/`. Sitemap will be auto-generated post-Astro anyway, but blunt fix now keeps the deployed site clean.

### Verification
- `README.md` reads cleanly to a new contributor with no MapMyRoots context.
- `npm install` still works; `npm test` still works.
- `view-source:mapmyroots.com` after deploy shows no `aggregateRating`, no fake review.
- Sitemap validator (e.g., xml-sitemaps.com) returns no errors.
- `package.json` passes `npm pkg fix`.

### Detailed plan
**Required before execution:** `docs/superpowers/plans/YYYY-MM-DD-phase-0-pre-migration-cleanup.md`. (Small enough that a single plan file covers all tasks.)

---

## Phase 1 — Astro Migration

**Effort:** 3–5 days. **Branch:** `feat/astro-migration`. **Critical dependency:** Phase 0 should land first (cleaner starting point).

### Scope
Move the existing site into Astro without changing what it does. Marketing pages migrate to `.astro` files with shared layouts. The canvas builder app stays a single page that imports its existing JS unchanged. All current tests must still pass at the end.

**Out of scope:** i18n route generation (Phase 3), service worker (Phase 4), Cloudflare config (Phase 2), feature work (Phase 5).

### Target structure

```
src/
├── layouts/
│   ├── BaseLayout.astro          # html, head, header, footer; props-driven SEO
│   └── BuilderLayout.astro       # minimal wrapper for canvas app
├── components/
│   ├── SEO.astro                 # meta tags + JSON-LD, single source of truth
│   ├── Header.astro              # nav + language switcher
│   ├── Footer.astro
│   ├── FAQ.astro                 # FAQ section + FAQPage schema in one place
│   └── HowItWorks.astro          # HowTo section + HowTo schema in one place
├── pages/
│   ├── index.astro
│   ├── about.astro
│   ├── contact.astro
│   ├── privacy.astro
│   ├── terms.astro
│   ├── builder.astro             # imports tree.js as client:load
│   └── glossary/
│       ├── index.astro
│       └── [slug].astro          # generated from content collection
├── content/
│   ├── config.ts                 # collection schemas
│   └── glossary/                 # markdown files (one per term)
├── styles/                        # moved from src/ui/styles/
│   ├── global.css                 # was style.css
│   ├── homepage.css
│   └── modal.css
└── (existing src/core/, src/ui/, src/features/, src/utils/, src/data/, src/shapes/, src/analytics/, src/config/ — unchanged)

public/                            # served as-is
├── favicon.ico
├── og-image.jpg                   # generated in Phase 3
├── robots.txt                     # rewritten in Phase 2
└── ...

astro.config.mjs                   # new
tsconfig.json                      # new (loose; supports @ts-check on existing JS)
```

### Tasks (file-level)

1. **Install Astro.** `npm create astro@latest` into a temp directory, copy `astro.config.mjs` and `tsconfig.json` over, install `@astrojs/cloudflare`, `@astrojs/sitemap`. Configure `output: 'static'`, adapter, `site: 'https://mapmyroots.com'`.
2. **Create `BaseLayout.astro`.** Move `<html>`, `<head>`, GTM-replacement script slot (Cloudflare Web Analytics tag added in Phase 2), header/footer slots, body classes. Accepts SEO props.
3. **Create `SEO.astro` component.** Single source of truth for: title, description, canonical, OG tags, Twitter tags, hreflang, JSON-LD blocks (SoftwareApplication, Organization, BreadcrumbList, FAQPage, HowTo, VideoObject). Driven by props per page.
4. **Create `Header.astro` and `Footer.astro`.** Extract from current `index.html` (mobile menu + language switcher live in Header).
5. **Migrate `index.html` → `src/pages/index.astro`.** Use `BaseLayout` + `SEO` + `Header` + `HowItWorks` + `FAQ`. Body content stays HTML.
6. **Migrate `about.html`, `contact.html`, `privacy.html`, `terms.html`.** Same pattern as index.
7. **Migrate `builder.html` → `src/pages/builder.astro`.** Wrap in `BuilderLayout`. Move all the inline modal HTML into the page body. Import `tree.js` via `<script>` tag with `is:client` so Astro processes it through Vite. The 30+ files in `src/core`, `src/ui`, etc. don't move.
8. **Move CSS files** from `src/ui/styles/` to `src/styles/`. Update imports in components.
9. **Move static assets to `public/`.** `assets/fonts/` → `public/fonts/`. `assets/images/` → `public/images/`. `assets/locales/` stays where it is (loaded at runtime via fetch). `assets/glossary/` becomes `src/content/glossary/` (markdown migration in Phase 3 — for now keep as-is and link from new glossary index page).
10. **Set up content collection scaffolding.** `src/content/config.ts` with a `glossary` collection schema (title, slug, description, body). Empty for now — real migration in Phase 3.
11. **Update `package.json` scripts.** `"dev": "astro dev"`, `"build": "astro build"`, `"preview": "astro preview"`. Keep `test` and `test:e2e` pointing at vitest/playwright.
12. **Fix vitest config paths.** `vitest.config.js` may need updates if module paths shift. The unit tests in `tests/unit/` test files in `src/core/commands/`, `src/core/spatial/`, `src/data/repositories/` — those don't move, so most should still pass.
13. **Fix playwright config path mismatch.** `package.json` says `playwright test` but config is `testing/playwright.config.js`. Move config to `tests/playwright.config.js` or fix the script.
14. **Local smoke test.** `npm run dev` opens the site; click through every page; open the builder; add a person; export a PNG; run search; switch language. All should work identically to the pre-migration site.
15. **Run all tests.** `npm test` (vitest unit) + `npm run test:e2e` (playwright) — both green.
16. **Bundle size check.** `npm run build` and verify the marketing pages emit ~zero JS (only the GTM/Web Analytics tag and any small enhancers). Verify the builder page bundles correctly with code-splitting on the lazy `import()` calls.

### Verification
- All current functionality works in `npm run dev`.
- Vitest + Playwright suites both pass.
- Lighthouse on `index.astro` after build: Performance ≥ 95 (was likely ~70–80 before due to unminified JS).
- No 404s in browser network tab.
- Visual diff on each page: matches pre-migration screenshot.

### Detailed plan
**Required before execution:** `docs/superpowers/plans/YYYY-MM-DD-phase-1-astro-migration.md`. This phase is large enough that the detailed plan should break tasks into TDD-style steps with file-level diffs.

---

## Phase 2 — Cloudflare Pages Production Setup

**Effort:** 1 day. **Branch:** `chore/cloudflare-pages-config`. **Dependency:** Phase 1 must be deployable.

### Scope
Wire up Cloudflare Pages properly: real HTTP security headers, redirects, host canonicalization, drop GTM/GA4 in favor of Cloudflare Web Analytics, add CI/CD via GitHub Actions for preview deploys.

### Tasks

1. **`public/_headers`.** Add HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`), CSP as a real header (not meta), `Permissions-Policy` (deny camera/microphone/geolocation/etc.), `Referrer-Policy: strict-origin-when-cross-origin`, `Cross-Origin-Opener-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`. Per-asset `Cache-Control`: `public, max-age=31536000, immutable` for `/assets/*` and hashed bundles in `/_astro/*`; `no-cache` for HTML.
2. **`public/_redirects`.** `https://www.mapmyroots.com/* https://mapmyroots.com/:splat 301`. Plus `.html` stripping if Astro doesn't already (e.g., `/about.html /about 301`).
3. **Remove inline CSP `<meta>` from all pages.** Now redundant with the header.
4. **Switch from GTM/GA4 to Cloudflare Web Analytics.** Add the CWA snippet (one-line `<script defer>`) in `BaseLayout.astro`. Remove GTM script and `<noscript>` iframe from all pages. Remove GTM-related entries from CSP.
5. **Cloudflare Pages dashboard setup** (manual): connect GitHub repo, set build command `npm run build`, output directory `dist`, Node version 20+. Enable preview deploys for PRs.
6. **`.github/workflows/ci.yml`.** Run on PR: install, vitest, playwright (with browser cache), `astro check`, `astro build`. No Cloudflare-side build is triggered until merge to `main`.
7. **`.github/workflows/lighthouse.yml`.** Lighthouse-CI runs against the Cloudflare preview URL on PR. Budget thresholds: Performance ≥ 90, A11y ≥ 95, SEO ≥ 95, Best Practices ≥ 95.
8. **DNS verification.** Confirm in Cloudflare DNS dashboard that apex `mapmyroots.com` resolves to Pages, and `www` is a CNAME or flattened to apex.
9. **Test with `securityheaders.com`** post-deploy. Target grade A or A+.

### Verification
- `curl -I https://mapmyroots.com` shows all security headers as real HTTP headers.
- `https://www.mapmyroots.com` 301s to `https://mapmyroots.com`.
- securityheaders.com grade A+.
- Cloudflare Web Analytics dashboard shows pageviews; no GTM/GA requests in browser network tab.
- Lighthouse-CI passes thresholds on a PR preview URL.

### Detailed plan
**Required before execution:** `docs/superpowers/plans/YYYY-MM-DD-phase-2-cloudflare-config.md`.

---

## Phase 3 — SEO Infrastructure

**Effort:** 2–3 days. **Branch:** `feat/seo-infrastructure`. **Dependency:** Phase 1 (Astro routing) live.

### Scope
Make the SEO setup correct and complete: real i18n routes, auto-generated sitemap, real OG/Twitter/icon images, glossary as content collection with markdown sources, llms.txt for AI search.

### Tasks

1. **Astro i18n config.** `astro.config.mjs` `i18n: { defaultLocale: 'en', locales: ['en', 'de', 'es', 'ru'], routing: { prefixDefaultLocale: false } }`. Generates `/`, `/de/`, `/es/`, `/ru/` as real prerendered routes.
2. **Translate top-level pages.** Index, about, contact each duplicated under `src/pages/de/`, `src/pages/es/`, `src/pages/ru/`. Body content can come from existing `assets/locales/*.json` strings — pulled into Astro components at build time, not at runtime. Privacy/terms can stay English-only initially (note in roadmap).
3. **Update `SEO.astro` to emit correct hreflang per page.** Each page declares its locale; component computes alternate URLs.
4. **Auto-generated sitemap.** `@astrojs/sitemap` integration. Drop `public/sitemap.xml` (replaced). Configure i18n in sitemap so all locale variants are listed with proper `alternate` entries.
5. **Generate real OG/Twitter images.** Currently `og-image.jpg`, `twitter-image.jpg`, `logo.png`, `video-thumbnail.jpg`, `screenshots/family-tree-builder.jpg` are all 404s. Options: (a) render from the existing `public/og-image.html` and `public/twitter-image.html` templates using Puppeteer once at build time; (b) use `astro-og-canvas` for per-page dynamic generation. Pick (b) for variety per page. Add to `astro.config.mjs`.
6. **Generate PWA icon set.** Need `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180×180), `favicon.svg`, `favicon-16.png`, `favicon-32.png`. Source from a single SVG of the 🌳 logo. Use `pwa-asset-generator` or Sharp script. Place in `public/`.
7. **Update `manifest.json`.** Move from `public/manifest.json` to `public/site.webmanifest` (more conventional). Update icon paths, drop reference to nonexistent `screenshots/family-tree-builder.jpg` until real screenshot is generated in step 8.
8. **Take real product screenshot.** Open the builder, build a sample tree (use the 50-person template), screenshot at 1280×720. Save to `public/screenshots/builder.jpg`. Reference from manifest and SoftwareApplication schema.
9. **Migrate glossary to content collection.** Convert `assets/glossary/` HTML pages into individual markdown files under `src/content/glossary/<slug>.md` with frontmatter (title, description, related terms). Generate pages from `[slug].astro`. Auto-add to sitemap.
10. **`public/llms.txt`.** Top-level summary + sitemap-style index of canonical URLs and what they cover, for AI crawlers (ChatGPT, Perplexity, Claude). See [llmstxt.org](https://llmstxt.org/) for format.
11. **`public/robots.txt` cleanup.** Drop the `Disallow: /*.json$` line — that blocks legitimate locale JSONs. Drop the noisy "block aggressive crawlers" section (controversial, low value). Keep sitemap reference, keep the malicious-bot block.
12. **Schema audit pass.** Now that fabricated review is gone (Phase 0), re-validate every page's JSON-LD with Google's Rich Results Test. Fix any warnings.

### Verification
- `https://mapmyroots.com/de/` serves real German HTML, not English with JS-swapped strings.
- View-source on each locale shows correct `<link rel="alternate" hreflang="...">` for all peers + `x-default`.
- `https://mapmyroots.com/sitemap-index.xml` lists all pages including locale variants.
- Sharing the URL on Twitter/Slack/Discord shows real OG image.
- Mobile install prompt fires (icon set complete).
- Google Rich Results Test passes for SoftwareApplication, FAQPage, HowTo on every page.
- `https://mapmyroots.com/llms.txt` returns valid llms.txt content.

### Detailed plan
**Required before execution:** `docs/superpowers/plans/YYYY-MM-DD-phase-3-seo-infrastructure.md`.

---

## Phase 4 — PWA & Performance

**Effort:** 1–2 days. **Branch:** `feat/pwa-and-perf`.

### Scope
Make the site a real installable PWA with offline support for the builder. Add print stylesheet. Lock in performance budgets.

### Tasks

1. **Install `@vite-pwa/astro`.** Add to integrations in `astro.config.mjs`.
2. **Service worker config.** Strategy: precache marketing pages + builder shell + locale JSONs + fonts. Runtime cache for any user-uploaded photos (when that feature lands in Phase 5).
3. **Offline page.** `src/pages/offline.astro` — minimal "you're offline, but the builder still works" page. Service worker serves this when navigation fails.
4. **Update `BuilderLayout.astro` for offline-aware UI.** Show a small "offline" badge when `navigator.onLine === false`. Builder is fully functional offline today (everything is localStorage-based) — just need user-facing confirmation.
5. **Print stylesheet.** `@media print` block in `src/styles/global.css`. Hide nav/footer; ensure tree canvas prints at full resolution; A4 + Letter friendly margins.
6. **Audit `index.astro` for performance.** Move inline `<style>` for language switcher into `homepage.css`. Inline only the critical above-the-fold CSS. Defer anything below the fold.
7. **Image optimization pass.** Convert `assets/images/tree.webp` and the builder screenshot to AVIF + WebP via Astro's `<Image>` component. Lazy-load below-the-fold images (already on most).
8. **Self-hosted font subsetting.** Current Inter and Playfair WOFF2s are full-Latin sets. Subset to actually-used glyphs with `glyphhanger` or similar. Should drop ~30% font weight.
9. **Lighthouse-CI budget enforcement.** Update `lighthouserc.js` thresholds to: Performance ≥ 95, A11y ≥ 95, SEO ≥ 95, Best Practices ≥ 100, total JS ≤ 50KB on marketing pages, total JS ≤ 300KB gzipped on builder page.
10. **A11y audit.** Run `axe-core` against every page. Fix any violations. Confirm keyboard navigation works on builder modals (the README claims this — verify).

### Verification
- Mobile Safari/Chrome shows "Add to Home Screen" / install prompt.
- App installs and launches standalone.
- Disconnect from network → builder still loads and is usable.
- Print preview renders cleanly on every page.
- Lighthouse-CI green at the new thresholds.
- axe-core reports zero serious/critical violations.

### Detailed plan
**Required before execution:** `docs/superpowers/plans/YYYY-MM-DD-phase-4-pwa-and-perf.md`.

---

## Phase 5 — Feature Parity & Improvements

**Effort:** Variable; tasks ship independently. **Branch per feature.**

### Scope
Build/restore functionality that's claimed but missing, or genuinely valuable. Each task is independent and can ship on its own branch.

### Task 5.1 — Contact form (Cloudflare Pages Function + Resend + Turnstile)

**Effort:** 0.5 day.

- `functions/api/contact.ts` — Pages Function that validates Turnstile token, posts to Resend.
- Add Turnstile widget to `contact.astro` (free, no consent banner).
- Resend API key bound as Cloudflare Pages env var.
- Forwards to `support@mapmyroots.com`. (Set up the inbox first if it doesn't exist.)
- Honeypot field as a fallback.

### Task 5.2 — GEDCOM import

**Effort:** 2–3 days. **High priority — #1 missing feature for genealogy users.**

- Library: `parse-gedcom` (MIT, ~10KB) handles GEDCOM 5.5/5.5.1 parsing.
- New module: `src/features/import/gedcom-importer.js` — converts GEDCOM AST to MapMyRoots person/relationship objects.
- UI: new "Import" button in builder; modal with file picker + preview; conflict resolution if names clash.
- Tests: unit tests against fixture `.ged` files (sample files from FamilySearch public domain).
- Docs: update FAQ to remove the "we don't support GEDCOM import yet" answer.

### Task 5.3 — Photos per person

**Effort:** 1–2 days.

- Person modal gains a photo upload field (file → base64 in localStorage for now; R2 later when cloud arrives).
- Canvas renderer draws photo as the node fill (round nodes already perfect for this).
- Migration: existing trees without photos render unchanged.
- Storage size warning when total localStorage approaches limit (~5MB).

### Task 5.4 — IndexedDB migration audit

**Effort:** 0.5 day.

- `src/data/repositories/indexed-db-repository.js` exists but unclear if active path. Confirm in `core-cache.js` whether IndexedDB is the actual storage layer or whether localStorage is still primary.
- If still localStorage: write migration that reads localStorage, writes to IndexedDB, deprecates the localStorage path. IndexedDB has no 5MB limit — required for photos (Task 5.3).
- Tests: existing tree loads after migration; auto-save still works.

### Task 5.5 — Share-by-link (no accounts needed)

**Effort:** 1 day. **Optional but high-value.**

- Encode the entire tree JSON as a base64 query param: `https://mapmyroots.com/view?d=...`. Works for trees up to ~50KB.
- For larger trees: Cloudflare R2 upload (anonymous, expires in 30 days), URL like `/view?id=<r2-key>`.
- View-only mode in builder (no editing UI).
- This bridges the gap until full cloud sync arrives.

### Verification per task
Each task: feature works in dev, has tests if it's logic-heavy, FAQ/docs updated if user-facing, Lighthouse still passing.

### Detailed plan
**Required before execution:** one detailed plan per task at `docs/superpowers/plans/YYYY-MM-DD-phase-5-<task-name>.md`.

---

## Phase 6 — SEO Content Growth

**Effort:** Ongoing. Runs in parallel with Phase 5.

### Scope
Content work that drives organic traffic. Not engineering-heavy — the framework (Phase 3 content collections) makes this mostly markdown authoring.

### Tasks

- **Article series.** "How to start a family tree", "Understanding GEDCOM", "How far back can you trace your ancestry?", "Genealogy research checklist". Each as a markdown file in `src/content/articles/` with auto-generated `Article` schema.
- **Cousin calculator.** A `/tools/cousin-calculator` page that programmatically generates explanations for "first cousin once removed", "second cousin twice removed", etc. — high-volume, low-competition queries.
- **Programmatic glossary expansion.** Currently a small set of terms. Expand to ~200 terms covering all major genealogy vocabulary. Each gets a markdown file.
- **Internal linking.** Every glossary page links to the builder + 3 related articles. Every article links to relevant glossary terms + the builder.
- **Backlink outreach (off-platform).** Not roadmap material; flag for separate marketing work.

### Verification
- Google Search Console shows the article/glossary pages indexing.
- Click-through data (via Cloudflare Web Analytics) confirms organic traffic to long-tail content.

### Detailed plan
Per-content-piece, no formal plan required; just author + commit.

---

## Deferred — Cloud Foundation

Not scheduled. Architecture stays ready. When greenlit:

- Switch `astro.config.mjs` to `output: 'hybrid'`.
- Add `wrangler.toml` with bindings for D1 (database), R2 (file storage), KV (sessions).
- Auth: **Better Auth** with D1 adapter. Open source, runs on Cloudflare Workers, ~200 lines of integration code. (Considered Clerk, Supabase, Auth.js, Lucia — picked Better Auth for fit with the Cloudflare-first stack and minimal vendor lock.)
- Sync routes: `src/pages/api/trees/[id].ts` with `export const prerender = false`. Static pages stay static (and free).
- Update FAQ to mention optional cloud save.

This phase will need its own roadmap document when it's time. For now: do not scaffold any of it. YAGNI.

---

## Success Criteria (end of Phase 4)

- [ ] Site deploys to Cloudflare Pages on every `main` push; PR previews work.
- [ ] securityheaders.com grade A+ on the production URL.
- [ ] Lighthouse-CI green: Performance ≥ 95, A11y ≥ 95, SEO ≥ 95, Best Practices ≥ 95.
- [ ] Google Rich Results Test passes for every page's structured data — no warnings, no fabricated content.
- [ ] All four locales (`/`, `/de/`, `/es/`, `/ru/`) serve real prerendered HTML with correct hreflang.
- [ ] Real OG/Twitter/icon images present; sharing previews correctly on Slack, Twitter, Discord, iMessage.
- [ ] PWA installable on iOS/Android/desktop; offline mode works for the builder.
- [ ] All existing tests (vitest + playwright) green.
- [ ] No GTM/GA4 in network tab; Cloudflare Web Analytics tracking pageviews.
- [ ] Contact form deferred to Phase 5; for now `contact.html` remains a static page with a `mailto:` link as fallback.

---

## How to use this roadmap

1. **Pick a phase** in priority order (0 → 1 → 2 → 3 → 4, then 5/6 in parallel).
2. **Write the detailed plan** for that phase using the writing-plans skill, saved to `docs/superpowers/plans/`.
3. **Execute** the detailed plan task-by-task (subagent-driven or inline — your call per phase).
4. **Verify** against the verification checklist before moving on.
5. **Update this roadmap** if a decision changes or scope shifts.

The roadmap is the source of truth for *what* and *why*. The per-phase plans are the source of truth for *how*.

# Astro upgrade and dependency audit (2026-10-30)

Goal: get off Astro 5 (`npm audit` flags `astro <=7.3.1` as critical) and clear the audit noise, without regressions on a site that is live.

## Findings

### The audit, honestly

`npm audit` reports 69 advisories (6 critical, 40 high). Almost none can reach a visitor:

- **What ships to browsers** is static HTML/CSS/JS plus `dompurify`, `fflate`, `jspdf`, `pdfjs-dist`, `parse-gedcom`. The only advisory on these is **`fflate` 0.8.2 (moderate)**: `unzipSync` can loop on malformed ZIP64 input. We use fflate for share-link compression, not ZIP parsing, and 0.8.3 fixes it.
- **Astro's critical/high advisories** are about SSR, server islands, MDX/JSX rendering, AVIF image optimization (RCE), view transitions and `base` stripping. This site is `output: 'static'` and uses none of those. The one nearby feature is `define:vars` in `GoogleTagManager.astro`, where the value is a constant container ID. So the realistic exposure is **build time and supply chain**, not visitors.
- **Dev tooling** (vitest/tinypool, playwright, `@lhci/cli`, `@axe-core/cli`, their proxies and zip/tar helpers) accounts for most of the 69. It runs only on the developer's machine and in CI.

So this is hygiene and risk reduction, not an emergency. The plan is staged so the cheap, safe part lands first.

### What blocks and what breaks

| Item | Detail |
|---|---|
| **Target version** | Astro 7.4.4. The fixes for the high/critical advisories are in 7.x (RCE via AVIF `<7.2.8`, base-strip bypass `<=7.2.3`, JSX/MDX XSS `<7.3.2`). Astro 6.x would stay flagged. |
| **Node** | Astro 7 needs Node `>=22.23.4` (Astro 6: `>=22.12`). CI runs Node 20 and Cloudflare Pages has `NODE_VERSION=20` (`docs/CLOUDFLARE_PAGES_SETUP.md`). **Production builds fail until the Cloudflare variable is changed.** Local is Node 24. |
| **PWA plugin** | `@vite-pwa/astro@1.2.0` declares `astro` peer `^1..^5`, so npm refuses Astro 6/7. Upstream issue vite-pwa/astro#72 is still open, with no release. Commenters report an `overrides` entry that widens the peer works with Astro 7.0.4. `vite-plugin-pwa` 2.0.0 supports Vite 8. Needs a spike here. |
| **Content collections** | `src/content/config.ts` uses the legacy `type: 'content'` format, which Astro 6 removed. Needs `src/content.config.ts` with the `glob()` loader, `term.slug` to `term.id`, and `term.render()` to `render(term)`. Touches `glossary/index.astro`, `glossary/[slug].astro` and the 12 term files' ids. |
| **Rust compiler (7)** | Unclosed tags and invalid nesting (e.g. `<div>` in `<p>`) are now build errors, no longer auto-corrected. `builder.astro` is about 1,100 lines of hand-written markup, so this is the likeliest source of surprises. |
| **`compressHTML` (7)** | Default changed to `'jsx'`, which can drop spaces between adjacent inline elements. Set `compressHTML: true` to keep today's output. |
| **Vite 7 and 8** | Check the Vite config and plugin chain. `astro-og-canvas` must move from 0.11.1 to 0.13.2 (supports Astro 7). |
| **Zod 4** | The glossary schema (`z.string().length(1)`, `z.array().default([])`, `z.coerce.date()`) is Zod-4-safe, but import `z` from `astro/zod`. |
| **Not affected** | `i18n` (we use `prefixDefaultLocale: false`), no `ViewTransitions`, no `Astro.glob`, no MDX, no adapter, no `src/fetch.ts`, no `@astrojs/db`. |

## Plan

### PR 1: safe dependency patches (no major versions)

Branch `chore/deps-safe`.

1. `npm audit fix` (non-breaking only), `fflate` to 0.8.3, `astro` to 5.18.2 (latest 5.x), and `@astrojs/check`/`@astrojs/sitemap` to latest minors.
2. Measured in a scratch copy: this takes the audit from 69 to about 35 and prod-only from 18 to 5, with no code changes.
3. Verify: `npm test`, `npm run check`, build with no warnings, the 29 e2e tests, Lighthouse CI.

### PR 2: Astro 7

Branch `chore/astro-7`. Steps in order; each is verified before the next.

0. **Prerequisite (you, in the Cloudflare dashboard):** change `NODE_VERSION` from `20` to `22` for Production and Preview. I'll add `.nvmrc` (`22`) and `engines` in the repo, but I can't confirm Pages prefers it over the dashboard variable, so check the PR's preview deploy for a Node error before merging.
1. **Baseline snapshot:** build on Astro 5 and keep a copy of `dist/` (HTML pages, `sitemap-*.xml`, `sw.js`, the `og/*.png` list) to diff against.
2. **Node 22** in `.github/workflows/*.yml` (`node-version: '22'`) and `.nvmrc`.
3. **Upgrade** `astro@7.4.4`, `astro-og-canvas@^0.13.2`, plus `overrides` for `@vite-pwa/astro` (widen its `astro` peer, and `vite-plugin-pwa` to `^2.0.0` for Vite 8 if the build needs it).
4. **Content collections:** move to `src/content.config.ts` with `glob()`, update the two glossary pages. Check all 12 `/glossary/<id>` URLs are unchanged.
5. **Fix build errors** from the Rust compiler (invalid nesting, unclosed tags), and set `compressHTML: true`.
6. **Verify against the baseline:**
   - normalized HTML diff of every page (expect only hashed asset names), sitemap and hreflang unchanged, 12 glossary pages and the OG image set the same
   - **PWA:** `sw.js` generated, precache list comparable, `/offline` served as the navigate fallback (check in a browser with the network off), registration script still inlined
   - **CSP:** load `/`, `/builder`, `/de/about`, `/glossary/abstract` and check there are no `securitypolicyviolation` events (Astro 7 emits inline scripts differently; `_headers` restricts script sources)
   - `npm test`, `npm run check`, 29/29 e2e (3 runs), Lighthouse CI, `npm audit` (expect Astro's advisories gone)
7. **Fallback if the overrides approach fails the PWA checks:** replace `@vite-pwa/astro` with a small local integration that runs `workbox-build`'s `generateSW` in the `astro:build:done` hook, reusing the existing `workbox` options. It has no Astro-version peer. That is a larger change, so I'd stop and ask first.
8. **Rollout:** merge only after the preview deploy looks right. Cloudflare Pages keeps previous deployments, so rollback is one click in the dashboard. After deploy, repeat the PDF export, offline page, sitemap and OG image spot checks on production.

### PR 3 (optional, dev tooling only)

The remaining advisories are dev-only: vitest 3.2.4 (`tinypool` critical, fixed in newer vitest; latest is 5.0.5, peers on Vite 6.4/7/8), `@axe-core/cli` (kept only for a roadmap audit, and it pulls in `chromedriver`, `extract-zip` and proxy libraries), and `@lhci/cli` (npm's suggested "fix" is a nonsensical downgrade, so those stay). I'd upgrade vitest and decide about `@axe-core/cli` with you. Low value; do it after PR 2.

## Out of scope

- Cookie consent, the other CI browser projects, new features.
- Changing the deploy target or output mode.

## Decisions for you

1. Are you OK changing `NODE_VERSION` in the Cloudflare dashboard (step 0)? Without it, production builds will fail after merge.
2. If the `overrides` approach doesn't hold up for the PWA plugin, should I stop at Astro 5.18 plus PR 1, or proceed to the local `workbox-build` integration?
3. Remove `@axe-core/cli` (PR 3)?

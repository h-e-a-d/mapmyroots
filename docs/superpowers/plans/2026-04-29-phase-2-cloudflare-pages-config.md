# Phase 2: Cloudflare Pages Production Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Astro-built site into Cloudflare Pages with real HTTP security headers, host canonicalization, and a privacy-friendly analytics stack. Replace GTM/GA4 with Cloudflare Web Analytics. Add GitHub Actions for CI and Lighthouse-CI on preview deploys.

**Architecture:** Cloudflare Pages serves the static `dist/` output. `public/_headers` and `public/_redirects` are special files Pages reads at deploy time — they govern HTTP response headers and URL rewrites/redirects. CSP moves from `<meta http-equiv>` (which most browsers ignore for headers other than `Content-Type`) to a real `Content-Security-Policy` HTTP header. Cloudflare Web Analytics replaces GTM at the BaseLayout/BuilderLayout level — cookieless, no consent banner needed for EU.

**Tech Stack:** Cloudflare Pages, Cloudflare Web Analytics, GitHub Actions, Lighthouse CI (`@lhci/cli`).

**Parent Roadmap:** [`docs/ROADMAP.md`](../../ROADMAP.md) (Phase 2).

**Prerequisite:** Phase 1 complete — repo is on the `feat/astro-migration` branch (or merged to main) with a working Astro build.

---

## Out of scope for this phase

- **i18n routes** (`/de/`, `/es/`, etc.) — Phase 3
- **Real OG/Twitter/icon images** — Phase 3
- **Service worker / PWA** — Phase 4
- **Contact form Pages Function** — Phase 5
- **D1/R2/KV bindings** — Phase 6 (cloud, deferred)

---

## Information you need before starting

These come from outside the repo and have to be obtained manually. Block on them — don't guess.

- **Cloudflare Web Analytics token.** Sign in to Cloudflare → Analytics & Logs → Web Analytics → "Add a site" → use `mapmyroots.com` → copy the `data-cf-beacon` token (a 32-char hex string). Used in Task 4.
- **Cloudflare Pages project name.** Decide: probably `mapmyroots`. Used in Task 5 (manual setup).
- **GitHub repo URL.** Used to wire the GitHub Actions workflows. The Phase 0 plan assumed `h-e-a-d/mapmyroots`; verify this matches your actual repo.

If any of the above isn't available, either obtain it before starting, or pause the phase at the task that needs it.

---

## Pre-flight

- [ ] **P1: Verify Phase 1 landed.**

```bash
test -d src/pages && echo "Astro pages OK"
test -f astro.config.mjs && echo "Astro config OK"
test ! -f index.html && echo "old HTML deleted OK"
npm run build && echo "build OK"
```
Expected: four `OK` lines.

- [ ] **P2: Create the phase branch.**

```bash
git checkout -b chore/cloudflare-pages-config
```

- [ ] **P3: Confirm `dist/` builds cleanly.**

```bash
rm -rf dist/
npm run build
ls dist/
```
Expected: `_astro/`, `about/`, `builder/`, `contact/`, `index.html`, `manifest.json`, `privacy/`, `sitemap-0.xml`, `sitemap-index.xml`, `terms/`, plus the `assets/`, `favicon.ico`, etc.

---

## Task 1: Create `public/_headers`

**Why:** Cloudflare Pages reads `public/_headers` at deploy time and emits the listed headers on matching responses. This is where real HTTP security headers (HSTS, CSP, Permissions-Policy) belong — `<meta http-equiv>` only works for a handful of headers and not the security ones we care about.

**Files:**
- Create: `public/_headers`

- [ ] **Step 1: Write `public/_headers`.**

Write the following exact content to `public/_headers`:

```
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin

/_astro/*
  Cache-Control: public, max-age=31536000, immutable

/assets/fonts/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *

/assets/images/*
  Cache-Control: public, max-age=2592000

/assets/locales/*
  Cache-Control: public, max-age=86400

/*.html
  Cache-Control: public, max-age=0, must-revalidate

/sitemap*.xml
  Cache-Control: public, max-age=3600

/robots.txt
  Cache-Control: public, max-age=86400
```

Notes:
- The CSP allows `https://static.cloudflareinsights.com` (the Web Analytics beacon script) — this replaces the GTM allowlist. The `https://www.googletagmanager.com` and `https://www.google-analytics.com` entries are gone.
- `'unsafe-inline'` for scripts is still required because Astro inlines small bootstrap scripts and the GTM-replacement script (Cloudflare Web Analytics) is loaded inline. A nonce-based CSP would require build-time integration; deferred for now.
- HSTS preload directive — only enable preload if you're certain you'll never serve plain HTTP on this domain. Once submitted to the HSTS preload list, the change is hard to reverse (12+ months). If unsure, drop the `; preload` token.
- `Cross-Origin-Resource-Policy: same-origin` blocks other origins from embedding our resources. If we ever want to allow our images on partner sites, change to `cross-origin` for `/assets/images/*`.

- [ ] **Step 2: Verify Cloudflare Pages syntax.**

There's no offline validator for `_headers`, but the format rules are:
- Path patterns one per stanza, leading `/`, glob `*` allowed.
- Headers indented two spaces, `Header-Name: value` per line.
- Blank line between stanzas.

Run: `grep -c "^/" public/_headers`
Expected: `7` (seven path stanzas: `/*`, `/_astro/*`, `/assets/fonts/*`, `/assets/images/*`, `/assets/locales/*`, `/*.html`, `/sitemap*.xml`, `/robots.txt`).

Wait — that's 8. Adjust expected: `8`.

- [ ] **Step 3: Commit.**

```bash
git add public/_headers
git commit -m "feat(cloudflare): add _headers with security headers + caching rules"
```

---

## Task 2: Create `public/_redirects`

**Why:** Cloudflare Pages reads `public/_redirects` for URL rewrites. We need:
- `www.mapmyroots.com` → `mapmyroots.com` (host canonicalization, decision from Phase 0).
- Old `.html` URLs → clean URLs (so legacy bookmarks and external links keep working).

**Files:**
- Create: `public/_redirects`

- [ ] **Step 1: Write `public/_redirects`.**

Write the following exact content to `public/_redirects`:

```
# Host canonicalization: www → apex
https://www.mapmyroots.com/* https://mapmyroots.com/:splat 301!

# Legacy .html URLs → clean URLs
/index.html / 301
/about.html /about 301
/contact.html /contact 301
/privacy.html /privacy 301
/terms.html /terms 301
/builder.html /builder 301

# Legacy assets/glossary path stays (no migration in this phase)
# /assets/glossary/glossary.html — unchanged, served as-is
```

Notes:
- The trailing `!` on the host canonicalization rule forces the redirect even if there's a matching file, ensuring `www.` is always rewritten.
- Since Astro emits directory-style URLs (`/about/index.html`), the redirects from `.html` URLs send users to the new directory URLs.
- Internal nav already points at the clean URLs (Phase 1 page migration replaced `.html` with no-extension paths).

- [ ] **Step 2: Verify the file is well-formed.**

Run: `wc -l public/_redirects`
Expected: ≥ 8 lines.

Run: `grep -cE "^[^#].*301" public/_redirects`
Expected: `7` (7 redirect rules: 1 host + 6 legacy URL).

- [ ] **Step 3: Commit.**

```bash
git add public/_redirects
git commit -m "feat(cloudflare): add _redirects for www→apex and legacy .html URLs"
```

---

## Task 3: Remove inline CSP `<meta>` from BaseLayout and BuilderLayout

**Why:** With CSP now set as a real HTTP header in `_headers`, the inline `<meta http-equiv="Content-Security-Policy">` is redundant — and worse, if the two ever drift, browsers honor the more-restrictive of the two. Single source of truth: the `_headers` file.

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/layouts/BuilderLayout.astro`

- [ ] **Step 1: Edit `BaseLayout.astro`.**

Find this in `src/layouts/BaseLayout.astro`:
```astro
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" />
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
```

Replace with:
```astro
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
```

(The `X-Content-Type-Options` meta and `referrer` meta stay as a defense-in-depth backup. CSP is removed because the header version is authoritative and the inline fallback would be out of sync the moment we update one or the other.)

- [ ] **Step 2: Edit `BuilderLayout.astro`.**

Find this in `src/layouts/BuilderLayout.astro`:
```astro
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';" />
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
```

Replace with:
```astro
    <meta http-equiv="X-Content-Type-Options" content="nosniff" />
    <meta name="referrer" content="strict-origin-when-cross-origin" />
```

- [ ] **Step 3: Note the difference between BaseLayout and BuilderLayout CSPs.**

The builder needed `blob:` for image sources (canvas-generated blobs for export) and `cdnjs.cloudflare.com` (jsPDF / similar). The unified `_headers` CSP from Task 1 should be expanded to allow these on `/builder/*`:

Find this in `public/_headers`:
```
/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: https:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests
```

Add a per-path override block **above** the `/*` rule (Cloudflare evaluates `_headers` rules top-to-bottom, with the most-specific match winning per header name):

```
/builder/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self'; img-src 'self' data: blob: https:; connect-src 'self' https://cloudflareinsights.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests

/*
  Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
  ...
```

Apply the change to `public/_headers` now: insert the `/builder/*` block before the `/*` block. Other headers (HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP, CORP) inherit from `/*` for unspecified paths and don't need duplication.

Verify:
```bash
grep -c "Content-Security-Policy" public/_headers
```
Expected: `2` (one for `/builder/*`, one for `/*`).

- [ ] **Step 4: Build and verify the meta CSP is gone from output.**

```bash
npm run build
grep -l "http-equiv=\"Content-Security-Policy\"" dist/**/*.html
```
Expected: empty output (no files match).

- [ ] **Step 5: Commit.**

```bash
git add src/layouts/BaseLayout.astro src/layouts/BuilderLayout.astro public/_headers
git commit -m "refactor(security): move CSP from meta tag to _headers (real HTTP header)"
```

---

## Task 4: Replace GTM with Cloudflare Web Analytics

**Why:** Decision locked in the roadmap. Cookieless analytics, no EU consent banner needed, free, fits the privacy positioning. GTM and GA4 are removed entirely.

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/layouts/BuilderLayout.astro`

- [ ] **Step 1: Get the Cloudflare Web Analytics token.**

If not already in hand: Cloudflare dashboard → Analytics & Logs → Web Analytics → Add a site → `mapmyroots.com` → copy the `data-cf-beacon` token. It's a 32-char hex string. The snippet Cloudflare shows you looks like:

```html
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "abc123..."}'></script>
```

Extract just the token value (the `abc123...` part). Replace `__YOUR_CF_BEACON_TOKEN__` in the snippets below with the real token.

- [ ] **Step 2: Edit `BaseLayout.astro`.**

Find this in `src/layouts/BaseLayout.astro`:
```astro
    <!-- Google Tag Manager (replaced by Cloudflare Web Analytics in Phase 2) -->
    <script is:inline>
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM-MNZ4MJB7');
    </script>
```

Replace with:
```astro
    <!-- Cloudflare Web Analytics (cookieless, no EU consent banner needed) -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "__YOUR_CF_BEACON_TOKEN__"}'></script>
```

Then find the GTM `<noscript>` block:
```astro
    <noscript>
      <iframe
        src="https://www.googletagmanager.com/ns.html?id=GTM-MNZ4MJB7"
        height="0"
        width="0"
        style="display:none;visibility:hidden"
      ></iframe>
    </noscript>
```

Delete it entirely (Cloudflare Web Analytics has no `noscript` fallback because it doesn't need one — it tracks without JS via its CDN).

Also drop the GTM-related `dns-prefetch`. Find:
```astro
<!-- Resource hints -->
<link rel="dns-prefetch" href="https://www.googletagmanager.com" />
```

(This is in `src/components/SEO.astro`, not BaseLayout — open SEO.astro and remove it. Replace with a Cloudflare Insights prefetch to keep the warm-up benefit.)

Find in `src/components/SEO.astro`:
```astro
<!-- Resource hints -->
<link rel="dns-prefetch" href="https://www.googletagmanager.com" />
```

Replace with:
```astro
<!-- Resource hints -->
<link rel="dns-prefetch" href="https://static.cloudflareinsights.com" />
```

- [ ] **Step 3: Edit `BuilderLayout.astro`.**

Same change. Find the GTM script:
```astro
    <!-- GTM (replaced in Phase 2) -->
    <script is:inline>
      (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
      new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
      j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
      'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
      })(window,document,'script','dataLayer','GTM-MNZ4MJB7');
    </script>
```

Replace with:
```astro
    <!-- Cloudflare Web Analytics -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "__YOUR_CF_BEACON_TOKEN__"}'></script>
```

And remove the GTM `<noscript>` block:
```astro
    <noscript>
      <iframe src="https://www.googletagmanager.com/ns.html?id=GTM-MNZ4MJB7" height="0" width="0" style="display:none;visibility:hidden"></iframe>
    </noscript>
```

Delete entirely.

- [ ] **Step 4: Verify GTM is fully removed from the source.**

```bash
grep -rn "GTM-\|googletagmanager\|google-analytics" src/ public/ --include="*.astro" --include="*.html" --include="*.js"
```
Expected: zero matches.

- [ ] **Step 5: Build and verify token is in the output.**

```bash
npm run build
grep -l "static.cloudflareinsights.com" dist/index.html dist/builder/index.html
```
Expected: both files match.

```bash
grep -c "GTM\|googletagmanager" dist/index.html dist/builder/index.html
```
Expected: `0` for each file.

- [ ] **Step 6: Test with a local preview.**

```bash
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 2
# In a browser: open http://localhost:4321/, open DevTools → Network → filter "cloudflareinsights"
# You should see one request to beacon.min.js after page load.
# If the request shows a 401/403, the token is wrong.
echo "Open http://localhost:4321/ in browser; press Enter when verified"
read
kill $PREVIEW_PID
```

- [ ] **Step 7: Commit.**

```bash
git add src/layouts/BaseLayout.astro src/layouts/BuilderLayout.astro src/components/SEO.astro
git commit -m "feat(analytics): replace GTM/GA4 with Cloudflare Web Analytics"
```

---

## Task 5: Cloudflare Pages dashboard setup (manual)

**Why:** This is configuration that lives in Cloudflare's dashboard, not the repo. Document it for traceability and so the next person doing the deploy doesn't have to figure it out.

**Files:**
- Create: `docs/CLOUDFLARE_PAGES_SETUP.md`

- [ ] **Step 1: Write the setup doc.**

Write the following exact content to `docs/CLOUDFLARE_PAGES_SETUP.md`:

````markdown
# Cloudflare Pages Setup

One-time setup for deploying the MapMyRoots site to Cloudflare Pages. Most of these steps happen in the Cloudflare dashboard, not in the repo.

## Initial project creation

1. **Cloudflare dashboard** → Workers & Pages → Create → Pages → Connect to Git
2. Choose the GitHub repo (e.g., `h-e-a-d/mapmyroots`).
3. Project name: `mapmyroots` (this becomes the `*.pages.dev` subdomain).
4. Production branch: `main`.

## Build configuration

| Setting | Value |
|---------|-------|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | (leave blank — repo root) |
| Node version | `20` |

If "Astro" preset isn't available, use "None" with the values above.

Environment variables (production):

| Variable | Value | Notes |
|----------|-------|-------|
| `NODE_VERSION` | `20` | Some build environments need this set explicitly |

## Custom domains

1. Pages project → Custom domains → Set up a custom domain
2. Add `mapmyroots.com` (apex) — Cloudflare prompts to add a CNAME-flattened record at the apex; accept.
3. Add `www.mapmyroots.com` — Cloudflare adds a CNAME → `mapmyroots.pages.dev`.
4. The `_redirects` file in the repo handles `www → apex` 301 — Cloudflare's domain attachment handles SSL for both.

## Preview deploys

Enabled by default for every PR. The preview URL pattern is `<branch-hash>.<project>.pages.dev`. Used by the Lighthouse-CI workflow (Task 7).

## Web Analytics

Cloudflare → Analytics & Logs → Web Analytics → Add a site → `mapmyroots.com`. The token is already inserted into `BaseLayout.astro` and `BuilderLayout.astro` (Phase 2 Task 4).

## Verifying the deploy

After the first build:

```bash
curl -I https://mapmyroots.com
```

Expected headers (subset):
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
- `Content-Security-Policy: default-src 'self'; ...`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), ...`

Check `https://www.mapmyroots.com` — should 301 to `https://mapmyroots.com`.

Check legacy URL: `curl -I https://mapmyroots.com/about.html` should 301 to `/about`.

## Common issues

- **Build fails with "command not found: astro":** the build command tries to run `astro` directly. Use `npm run build` (which invokes `astro build` via npm script).
- **404 on every page:** output directory mismatch. Confirm "Build output directory" is `dist` not `dist/static` or anything else.
- **`_headers` not applied:** confirm the file is at `public/_headers` in the repo. Astro copies `public/` to `dist/` verbatim, so it lands at `dist/_headers` for Cloudflare to read.
- **Preview URL works but custom domain shows old GTM:** browser cache. Try in private window.
````

- [ ] **Step 2: Commit.**

```bash
git add docs/CLOUDFLARE_PAGES_SETUP.md
git commit -m "docs(cloudflare): document Pages dashboard setup"
```

---

## Task 6: GitHub Actions CI workflow

**Why:** Run vitest + playwright + `astro check` + `astro build` on every PR. Catches breaking changes before the Cloudflare preview deploy goes up.

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the CI workflow.**

Write the following exact content to `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  unit:
    name: Unit tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm test -- --run

  typecheck:
    name: Astro check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run check

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run build

      - name: Upload dist
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 7

  e2e:
    name: E2E tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Cache Playwright browsers
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

      - run: npx playwright install --with-deps chromium

      - run: npm run build

      - run: |
          npx astro preview --port 4321 &
          sleep 3
          PLAYWRIGHT_BASE_URL=http://localhost:4321 npm run test:e2e
```

Notes:
- Four parallel jobs: unit, typecheck, build, e2e. Build artifact is uploaded for downstream jobs (Lighthouse-CI in Task 7).
- E2E tests run against the preview server. The `PLAYWRIGHT_BASE_URL` env var lets tests target the right URL — make sure the playwright tests respect it (if they hard-code `http://localhost:8000`, that needs a fix; document in the e2e job's task list rather than fixing here).
- `concurrency` cancels in-progress runs when a PR gets a new push. Saves CI minutes.

- [ ] **Step 2: Commit.**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions workflow for unit, typecheck, build, and e2e tests"
```

---

## Task 7: Lighthouse-CI workflow

**Why:** Performance regressions don't show up in unit tests. Lighthouse-CI runs against the Cloudflare preview URL on every PR and fails the check if scores drop below the budget.

**Files:**
- Create: `.github/workflows/lighthouse.yml`
- Create: `lighthouserc.cjs`

- [ ] **Step 1: Install Lighthouse-CI as a dev dependency.**

```bash
npm install --save-dev @lhci/cli@^0.13
```

- [ ] **Step 2: Create `lighthouserc.cjs` at the repo root.**

Write the following exact content:

```javascript
module.exports = {
  ci: {
    collect: {
      url: [
        'http://localhost:4321/',
        'http://localhost:4321/about',
        'http://localhost:4321/builder'
      ],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        skipAudits: ['uses-http2']
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['warn', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }]
      }
    },
    upload: {
      target: 'temporary-public-storage'
    }
  }
};
```

Notes:
- Three URLs: home, about (representative content page), builder (the JS-heavy page). Adjust if you want broader coverage.
- `numberOfRuns: 3` — Lighthouse averages across runs. More runs = more stable scores, slower CI. 3 is a balance.
- `preset: 'desktop'` — desktop scoring. For mobile, change to `mobile` (typically yields lower scores).
- `categories:performance` is `warn` (not `error`) at 0.9 because the JS-heavy builder page may not always hit it. Tighten in Phase 4 once we have the service worker + bundle audit.
- `categories:accessibility` is `error` at 0.95 — non-negotiable.
- `temporary-public-storage` uploads reports to a public Lighthouse server (free, unauthenticated, retained ~7 days). Switch to your own storage if you want longer retention.

- [ ] **Step 3: Write `.github/workflows/lighthouse.yml`.**

Write the following exact content:

```yaml
name: Lighthouse CI

on:
  pull_request:

concurrency:
  group: lighthouse-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lighthouse:
    name: Lighthouse audits
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run build

      - name: Start preview server
        run: |
          npx astro preview --port 4321 &
          sleep 3

      - name: Run Lighthouse CI
        run: npx lhci autorun
        env:
          LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }}
```

Notes:
- `LHCI_GITHUB_APP_TOKEN` is optional — without it, Lighthouse CI runs but doesn't post a status check on the PR. To set it up: install the [Lighthouse CI GitHub App](https://github.com/apps/lighthouse-ci) on the repo, then copy the token to repo secrets. If skipping, the workflow still runs and fails the job on threshold violations.

- [ ] **Step 4: Commit.**

```bash
git add .github/workflows/lighthouse.yml lighthouserc.cjs package.json package-lock.json
git commit -m "ci: add Lighthouse CI for performance/a11y/SEO budget enforcement"
```

---

## Task 8: First production deploy and post-deploy verification

**Why:** Configuration matters less than what actually shows up at the production URL. Walk through the verification once.

**Files:** None modified — this is a runtime verification task.

- [ ] **Step 1: Push the branch.**

```bash
git push -u origin chore/cloudflare-pages-config
```

- [ ] **Step 2: Open a PR.** Cloudflare Pages should automatically build a preview deploy. The PR check should appear within ~1–2 minutes labeled `Cloudflare Pages` with a preview URL.

- [ ] **Step 3: Verify preview deploy headers.**

```bash
PREVIEW_URL=https://<branch-hash>.mapmyroots.pages.dev   # from the Cloudflare PR check
curl -sI "$PREVIEW_URL" | grep -iE "strict-transport|content-security|x-frame|x-content|referrer|permissions"
```
Expected: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy headers all present.

- [ ] **Step 4: Verify www→apex redirect (only works on production domain, not preview).**

After merging to `main` and the production deploy completes:
```bash
curl -sI https://www.mapmyroots.com/ | grep -i location
```
Expected: `location: https://mapmyroots.com/`.

- [ ] **Step 5: Verify legacy URL redirects.**

```bash
curl -sI https://mapmyroots.com/about.html | grep -iE "HTTP|location"
```
Expected:
```
HTTP/2 301
location: /about
```

- [ ] **Step 6: Run securityheaders.com check.**

Open `https://securityheaders.com/?q=https://mapmyroots.com&followRedirects=on` in a browser. Target grade: **A** or **A+**.

If the grade is lower:
- **B-:** missing one of the headers — re-check `_headers` content.
- **C or worse:** something is wrong with how Cloudflare is reading the file. Open the deploy logs in Cloudflare dashboard → Pages project → the latest deploy → "Build log" — look for `_headers` references.

- [ ] **Step 7: Verify Web Analytics is collecting.**

Cloudflare dashboard → Analytics & Logs → Web Analytics → `mapmyroots.com` → wait 5–10 minutes after first traffic. Expect to see at least one pageview from your test.

- [ ] **Step 8: Verify CSP isn't breaking anything.**

Open `https://mapmyroots.com/` in browser → DevTools → Console. Look for any `Refused to load... because it violates the following Content Security Policy directive` errors. If present, the CSP needs adjustment — note which directive is blocking and update `_headers` accordingly.

Common CSP issues:
- A third-party script that wasn't in our scope analysis — drop it or whitelist it.
- Inline event handlers (`onclick="..."`) in legacy code — refactor to addEventListener (out of scope here; document in a follow-up issue).

- [ ] **Step 9: Verify the builder still works in production.**

Open `https://mapmyroots.com/builder` → add a person → save → export PNG. All should work without console errors.

- [ ] **Step 10: Merge the PR.**

After verifications pass on the preview URL (and the production domain post-merge), merge to main.

---

## Task 9: Final verification

- [ ] **Step 1: All workflow files build.**

```bash
ls .github/workflows/
test -f .github/workflows/ci.yml && echo "ci.yml OK"
test -f .github/workflows/lighthouse.yml && echo "lighthouse.yml OK"
test -f lighthouserc.cjs && echo "lighthouserc OK"
```
Expected: three `OK` lines.

- [ ] **Step 2: Public files all present.**

```bash
test -f public/_headers && echo "_headers OK"
test -f public/_redirects && echo "_redirects OK"
test -f docs/CLOUDFLARE_PAGES_SETUP.md && echo "setup doc OK"
```
Expected: three `OK` lines.

- [ ] **Step 3: GTM is gone everywhere.**

```bash
grep -rn "GTM-\|googletagmanager\|gtm.js" src/ public/ --include="*.astro" --include="*.html" --include="*.js" 2>/dev/null
```
Expected: zero matches.

- [ ] **Step 4: Cloudflare Web Analytics token is present.**

```bash
grep -c "static.cloudflareinsights.com" src/layouts/BaseLayout.astro src/layouts/BuilderLayout.astro
```
Expected: `1` (one match per file × 2 files = 2 matches total, but `grep -c` reports per-file).

```bash
grep -E "data-cf-beacon" src/layouts/BaseLayout.astro
```
Expected: a line containing `data-cf-beacon='{"token": "..."}'` with a real token (not the placeholder `__YOUR_CF_BEACON_TOKEN__`).

If the placeholder is still present, **replace it with the real token before merging.**

- [ ] **Step 5: Commit count.**

```bash
git log --oneline chore/cloudflare-pages-config ^main 2>/dev/null
```
Expected: roughly 7–10 commits from Phase 2.

- [ ] **Step 6: Production URL responds correctly.**

(Only after the PR is merged and Cloudflare Pages deploys to the production domain.)

```bash
curl -sI https://mapmyroots.com/ | head -20
```
Expected: 200 OK, all security headers present, `Cache-Control: public, max-age=0, must-revalidate` for the HTML.

- [ ] **Step 7: securityheaders.com grade A+.**

Open `https://securityheaders.com/?q=mapmyroots.com&followRedirects=on`. Grade: **A** at minimum, **A+** target.

If A+ isn't achievable, note which header is missing and decide whether to fix or accept (e.g., `Expect-CT` is deprecated and shouldn't be added even though securityheaders.com still flags it).

---

## Phase 2 complete

The site is now deployed to Cloudflare Pages with proper security headers, host canonicalization, privacy-friendly analytics, and CI/CD on every PR. Performance, a11y, and SEO budgets are enforced by Lighthouse-CI.

Next step: write `docs/superpowers/plans/YYYY-MM-DD-phase-3-seo-infrastructure.md`.

---

## Self-review

**1. Spec coverage** vs. roadmap Phase 2:
- [x] `_headers` for security + caching — Task 1
- [x] `_redirects` for www→apex and `.html` cleanup — Task 2
- [x] Remove inline CSP meta — Task 3
- [x] Cloudflare Web Analytics replacing GTM — Task 4
- [x] Cloudflare Pages dashboard setup (manual instructions) — Task 5
- [x] GitHub Actions CI — Task 6
- [x] Lighthouse-CI — Task 7
- [x] DNS/headers verification — Task 8
- [x] securityheaders.com grade A+ target — Task 9 Step 7

**2. Placeholders.** The `__YOUR_CF_BEACON_TOKEN__` token placeholder is explicit and called out in two tasks (Step 1 of Task 4 and Step 4 of Task 9 — the latter explicitly verifies the placeholder isn't left in). This is a real value the executor must obtain from Cloudflare; can't be hard-coded in the plan.

**3. Type/path consistency.** `_headers` and `_redirects` referenced consistently. `BaseLayout.astro` and `BuilderLayout.astro` paths consistent with Phase 1. Workflow files at `.github/workflows/*.yml` consistent with GitHub conventions.

**4. Sequencing.** `_headers` (Task 1) lands before CSP-meta removal (Task 3) so the header version is in place before the meta version is gone. CWA token swap (Task 4) lands after CSP allowlist update (Task 1, with `static.cloudflareinsights.com` already allowed). Manual dashboard setup (Task 5) and CI workflows (Tasks 6–7) are independent and can run in any order. Verification (Task 8) requires a deploy, which requires Tasks 1–4 + Task 5's manual setup.

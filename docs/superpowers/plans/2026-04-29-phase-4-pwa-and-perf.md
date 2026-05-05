# Phase 4: PWA & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the site a real installable PWA with offline support for the builder, add a print stylesheet, optimize images and fonts, and lock in performance budgets via Lighthouse-CI.

**Architecture:** `@vite-pwa/astro` adds a Workbox-generated service worker as part of the Astro build. The service worker precaches the marketing shell, locale JSONs, fonts, and the builder's JS bundles; any request that misses the cache and fails the network falls through to the offline page. The builder is already 100% client-side and localStorage-backed — it works offline today; the SW just makes that explicit and survives across sessions. Image optimization uses Astro's first-party `<Image>` component (Sharp under the hood) to emit modern formats (AVIF + WebP). Font subsetting uses `glyphhanger` to inspect the built site and emit Latin-subset WOFF2 files.

**Tech Stack:** `@vite-pwa/astro` (Workbox), Astro `<Image>` component (Sharp), `glyphhanger` (Puppeteer-based font subsetter), `@axe-core/cli` for the a11y pass, Lighthouse CI (already installed in Phase 2).

**Parent Roadmap:** [`docs/ROADMAP.md`](../../ROADMAP.md) (Phase 4).

**Prerequisite:** Phase 3 (SEO infrastructure) complete. The PWA work depends on the real icon set from Phase 3 Task 6 — install prompts won't fire without it.

---

## Out of scope for this phase

These come later — do not attempt them in Phase 4:

- **Background sync / push notifications** — no use case until accounts ship (deferred indefinitely).
- **R2-hosted user photos** — Phase 5 Task 5.3 (photos per person feature).
- **Offline mutation queue** — also tied to cloud sync, deferred.
- **i18n routing for the offline page** — `/offline` is English-only; the locale fallback handles it.
- **GEDCOM import / contact form / share-by-link** — Phase 5.
- **Replacing the runtime i18n in the builder** — still out of scope per Phase 3.

---

## Information you need before starting

Most of this is automatable. Two manual decisions:

- **Mobile vs. desktop Lighthouse scoring.** The current `lighthouserc.cjs` uses `preset: 'desktop'`. Phase 4 tightens the budget — decide whether to also switch to `preset: 'mobile'` (more representative of real users, lower scores). Recommendation: keep desktop for now, add a separate mobile audit run that's `warn`-level only.
- **PWA install promotion.** Should the homepage show an "Install MapMyRoots" button when `beforeinstallprompt` fires? Phase 4 ships the capability; whether to surface it to users is a UX call. Recommendation: yes, with an unobtrusive banner that dismisses to localStorage. Implemented in Task 4.

If unsure on either, default to the recommendation and revisit.

---

## Pre-flight

- [ ] **P1: Verify Phase 3 landed.**

```bash
test -d src/pages/de && echo "i18n routes OK"
test -f public/icon-192.png && echo "icons OK"
test -f public/llms.txt && echo "llms.txt OK"
test -d src/content/glossary && ls src/content/glossary/*.md | wc -l && echo "glossary OK"
npm run build && echo "build OK"
```
Expected: five `OK` lines and a count of 12 glossary markdown files.

- [ ] **P2: Capture pre-Phase-4 Lighthouse baseline.**

```bash
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 3
npx lhci autorun --collect.url=http://localhost:4321/ --collect.url=http://localhost:4321/builder --upload.target=temporary-public-storage 2>&1 | tee /tmp/phase4-lh-baseline.txt
kill $PREVIEW_PID
```

Note the Performance, A11y, SEO, and Best Practices scores. After Phase 4, all four should improve or hold. Specifically: Performance ≥ 95 on `/`, ≥ 80 on `/builder` (improved from baseline).

- [ ] **P3: Create the migration branch.**

```bash
git checkout -b feat/pwa-and-perf
```

- [ ] **P4: Capture pre-Phase-4 dist size.**

```bash
du -sh dist/
du -sh dist/_astro/
du -sh dist/assets/fonts/
du -sh dist/assets/images/
```
Note the sizes. Phase 4 should reduce font and image sizes; total dist may grow slightly because of the service worker precache manifest.

---

## Task 1: Install and configure `@vite-pwa/astro`

**Why:** This integration owns the service worker and manifest generation. It plays well with Astro's static output and emits a Workbox-built SW with precaching configurable per asset type.

**Files:**
- Modify: `package.json` (add `@vite-pwa/astro`, `workbox-window`)
- Modify: `astro.config.mjs` (register the integration)

- [ ] **Step 1: Install.**

```bash
npm install --save-dev @vite-pwa/astro workbox-window
```

- [ ] **Step 2: Update `astro.config.mjs`.**

Find:
```javascript
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
```

Add:
```javascript
import AstroPWA from '@vite-pwa/astro';
```

Find:
```javascript
  integrations: [
    sitemap({...})
  ],
```

Add a `pwa` integration call after `sitemap`:

```javascript
  integrations: [
    sitemap({...}),
    AstroPWA({
      mode: 'production',
      base: '/',
      scope: '/',
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      manifest: false, // we ship our own public/manifest.json (from Phase 3)
      workbox: {
        globPatterns: ['**/*.{html,js,css,woff2,svg,png,jpg,json}'],
        globIgnores: ['**/og/**', '**/screenshots/**'],
        navigateFallback: '/offline',
        navigateFallbackDenylist: [/^\/builder/, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/static\.cloudflareinsights\.com\/.*/,
            handler: 'NetworkOnly'
          },
          {
            urlPattern: /\/assets\/locales\/.*\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'locales',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          },
          {
            urlPattern: /\.(?:woff2|woff|ttf)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    })
  ],
```

Notes:
- `manifest: false` — we already wrote `public/manifest.json` in Phase 3 Task 6. The integration would otherwise generate a competing one.
- `globPatterns` precaches everything in the build output **except** `og/` (per-page OG images, ~50–100 KB each) and `screenshots/` (the 1280×720 builder screenshot). These don't need to be offline-available.
- `navigateFallback` serves `/offline` for any URL that fails network. `navigateFallbackDenylist` excludes the builder (it should return its real 404 if missing) and any future API routes.
- Cloudflare Insights beacon is `NetworkOnly` so we never serve a stale beacon and cache cleanup is trivial.
- Locale JSONs are `StaleWhileRevalidate` — instant load from cache, refresh in background. Aligns with the runtime i18n switching in the builder.
- Fonts are `CacheFirst` — they're already hashed/immutable.

- [ ] **Step 3: Verify the build emits a service worker.**

```bash
npm run build 2>&1 | tail -20
ls dist/sw.js dist/registerSW.js dist/workbox-*.js 2>/dev/null
```
Expected: `sw.js`, `registerSW.js`, and one `workbox-<hash>.js` chunk. A `manifest-<hash>.webmanifest` may also appear — ignore it (we use the static one).

- [ ] **Step 4: Commit.**

```bash
git add package.json package-lock.json astro.config.mjs
git commit -m "feat(pwa): install @vite-pwa/astro and configure Workbox precache"
```

---

## Task 2: Create the offline page

**Why:** When a navigation fails (no network, network glitch), Workbox serves a fallback. We render a minimal page that explains the situation and reminds the user the builder works offline.

**Files:**
- Create: `src/pages/offline.astro`

- [ ] **Step 1: Write `src/pages/offline.astro`.**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
---

<BaseLayout
  title="Offline - MapMyRoots"
  description="You are currently offline. The family tree builder still works without an internet connection."
  canonicalPath="/offline"
  showLanguageSwitcher={false}
>
  <div class="offline-container">
    <div class="offline-icon">📡</div>
    <h1>You're offline</h1>
    <p class="lead">No worries — your family tree data lives on your device, so the builder still works.</p>

    <div class="offline-actions">
      <a href="/builder" class="btn-primary">Open the builder</a>
      <button id="retryBtn" class="btn-secondary">Retry network</button>
    </div>

    <details class="offline-details">
      <summary>What works while offline?</summary>
      <ul>
        <li>The full family tree builder — add people, edit, save, load, export PNG/PDF/JSON.</li>
        <li>Pages you've already visited (cached automatically).</li>
        <li>The genealogy glossary, if visited at least once.</li>
      </ul>
      <p>What doesn't work: visiting pages you haven't loaded before, sharing previews, the language switcher fetching new locale files.</p>
    </details>
  </div>

  <script is:inline>
    document.getElementById('retryBtn')?.addEventListener('click', () => {
      window.location.reload();
    });
    window.addEventListener('online', () => {
      window.location.href = '/';
    });
  </script>
</BaseLayout>

<style>
  .offline-container { max-width: 600px; margin: 4rem auto; padding: 0 1.5rem; text-align: center; }
  .offline-icon { font-size: 4rem; margin-bottom: 1rem; }
  .offline-container h1 { font-size: 2rem; margin-bottom: 0.5rem; }
  .lead { font-size: 1.1rem; color: var(--text-secondary, #4a5568); margin-bottom: 2rem; }
  .offline-actions { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-bottom: 2rem; }
  .btn-primary, .btn-secondary { padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: 1px solid transparent; font-size: 1rem; cursor: pointer; text-decoration: none; }
  .btn-primary { background: var(--primary-color, #0f866c); color: white; }
  .btn-secondary { background: white; border-color: var(--border-color, #e2e8f0); color: var(--text-primary); }
  .offline-details { text-align: left; background: var(--background-alt, #f8f9fa); padding: 1.5rem; border-radius: 0.5rem; }
  .offline-details summary { cursor: pointer; font-weight: 600; }
</style>
```

- [ ] **Step 2: Verify the offline page builds.**

```bash
npm run build
test -f dist/offline/index.html && echo OK
```

- [ ] **Step 3: Verify the sitemap excludes /offline.**

The sitemap integration's `filter: (page) => !page.includes('/offline')` from Phase 1 Task 2 already handles this. Confirm:

```bash
grep -c "/offline" dist/sitemap-0.xml
```
Expected: `0`.

- [ ] **Step 4: Commit.**

```bash
git add src/pages/offline.astro
git commit -m "feat(pwa): add offline fallback page"
```

---

## Task 3: Online/offline UI hints

**Why:** Builder users editing offline benefit from a small visual cue confirming they're offline (so they know save means localStorage, not cloud). Marketing pages don't need this.

**Files:**
- Modify: `src/layouts/BuilderLayout.astro`

- [ ] **Step 1: Edit `BuilderLayout.astro` to add an offline badge.**

Find the `<body>` opening tag and add a badge element + script after it:

```astro
<body>
  <div id="offlineBadge" class="offline-badge hidden" role="status" aria-live="polite">
    <span aria-hidden="true">📡</span>
    <span>Offline — your tree is saved locally</span>
  </div>
```

Add a `<style>` block at the end of the file:

```astro
<style is:global>
  .offline-badge {
    position: fixed;
    bottom: 1rem;
    left: 1rem;
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #fef3c7;
    color: #78350f;
    border: 1px solid #fcd34d;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .offline-badge.hidden { display: none; }
</style>
```

Add an inline script at the end of the body (before `</body>`):

```astro
  <script is:inline>
    (function() {
      var badge = document.getElementById('offlineBadge');
      function update() { badge.classList.toggle('hidden', navigator.onLine); }
      window.addEventListener('online', update);
      window.addEventListener('offline', update);
      update();
    })();
  </script>
</body>
```

- [ ] **Step 2: Build and verify.**

```bash
npm run build
grep -c "offlineBadge" dist/builder/index.html
```
Expected: `≥ 2` (the element + the script reference).

- [ ] **Step 3: Manual smoke test.**

```bash
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 2
# Open http://localhost:4321/builder
# DevTools → Network → "Offline" toggle → confirm badge appears
# Toggle back online → badge disappears
kill $PREVIEW_PID
```

- [ ] **Step 4: Commit.**

```bash
git add src/layouts/BuilderLayout.astro
git commit -m "feat(pwa): add offline badge to builder layout"
```

---

## Task 4: Install prompt UI

**Why:** PWA install discoverability is poor — most users won't know to use the browser's "Install" menu. We surface a small banner the first time `beforeinstallprompt` fires, dismissible to localStorage.

**Files:**
- Modify: `src/components/Footer.astro` (add the banner element)
- Create: `src/scripts/install-prompt.js` (logic)
- Modify: `src/layouts/BaseLayout.astro` (load the script)

- [ ] **Step 1: Create `src/scripts/install-prompt.js`.**

```javascript
const DISMISSED_KEY = 'mapmyroots_install_dismissed';
const PROMPT_DELAY_MS = 5000;

let deferredPrompt = null;

function shouldShow() {
  return !localStorage.getItem(DISMISSED_KEY);
}

function showBanner() {
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  banner.classList.remove('hidden');
}

function hideBanner() {
  const banner = document.getElementById('installBanner');
  if (!banner) return;
  banner.classList.add('hidden');
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (shouldShow()) {
    setTimeout(showBanner, PROMPT_DELAY_MS);
  }
});

window.addEventListener('appinstalled', () => {
  localStorage.setItem(DISMISSED_KEY, '1');
  hideBanner();
  deferredPrompt = null;
});

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('installBtn');
  const dismissBtn = document.getElementById('installDismissBtn');

  installBtn?.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(DISMISSED_KEY, '1');
    }
    deferredPrompt = null;
    hideBanner();
  });

  dismissBtn?.addEventListener('click', () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    hideBanner();
  });
});
```

- [ ] **Step 2: Add the banner element to `Footer.astro` (or a more central location).**

At the end of `src/components/Footer.astro`, **before** the closing `</footer>`, add:

```astro
<div id="installBanner" class="install-banner hidden" role="region" aria-label="Install app">
  <div class="install-banner-inner">
    <span aria-hidden="true">📲</span>
    <div>
      <strong>Install MapMyRoots</strong>
      <p>Use as an app — works offline, no app store needed.</p>
    </div>
    <div class="install-banner-actions">
      <button id="installBtn" type="button">Install</button>
      <button id="installDismissBtn" type="button" aria-label="Dismiss">×</button>
    </div>
  </div>
</div>
```

Add styles at the end of the existing `<style>` block in Footer.astro:

```css
.install-banner {
  position: fixed;
  bottom: 1rem;
  right: 1rem;
  max-width: 360px;
  background: white;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 0.75rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  padding: 1rem;
  z-index: 1000;
}
.install-banner.hidden { display: none; }
.install-banner-inner { display: flex; align-items: flex-start; gap: 0.75rem; }
.install-banner-inner > span { font-size: 1.5rem; }
.install-banner-inner strong { display: block; margin-bottom: 0.25rem; }
.install-banner-inner p { margin: 0; font-size: 0.875rem; color: var(--text-secondary, #4a5568); }
.install-banner-actions { display: flex; gap: 0.5rem; align-items: center; margin-left: auto; }
.install-banner-actions button:first-child { padding: 0.5rem 1rem; background: var(--primary-color, #0f866c); color: white; border: none; border-radius: 0.5rem; cursor: pointer; }
.install-banner-actions button:last-child { background: none; border: none; font-size: 1.5rem; cursor: pointer; padding: 0 0.5rem; line-height: 1; }
```

- [ ] **Step 3: Load the install-prompt script from `BaseLayout.astro`.**

Find the existing font-load detection script near the bottom of `BaseLayout.astro`. After it, add:

```astro
<script>
  import '@/scripts/install-prompt.js';
</script>
```

(Vite-processed; this gets bundled with code-splitting.)

- [ ] **Step 4: Build and smoke test.**

```bash
npm run build
grep -c "installBanner" dist/index.html
```
Expected: `≥ 2` (banner element + style references). The Vite-built script will live in `_astro/install-prompt.<hash>.js`.

Manual test: open `http://localhost:4321/` in Chrome → DevTools → Application → Service Workers → confirm SW registered → wait 5 seconds → install banner should NOT appear automatically (it requires `beforeinstallprompt`, which Chrome only fires when the install criteria are met). Use Chrome's Application → Manifest → "Install" link to verify the install dialog uses the right name + icon.

- [ ] **Step 5: Commit.**

```bash
git add src/components/Footer.astro src/scripts/install-prompt.js src/layouts/BaseLayout.astro
git commit -m "feat(pwa): add install prompt banner with dismiss-to-localStorage"
```

---

## Task 5: Print stylesheet

**Why:** Users print family trees. The current builder canvas is interactive and doesn't print well — sidebar takes up half the page, the canvas crops, controls overlap. A `@media print` block hides chrome and forces the canvas to fit a page.

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Append a print block to `src/styles/global.css`.**

At the end of `src/styles/global.css`, add:

```css
/* Print styles */
@media print {
  /* Hide all interactive chrome */
  .header,
  .site-footer,
  .sidebar,
  .top-toolbar,
  .floating-buttons,
  .zoom-controls,
  .header-controls,
  .cache-indicator,
  .install-banner,
  .offline-badge,
  #settingsPanel,
  .modal,
  .notifications-container,
  .search-container,
  .skip-link {
    display: none !important;
  }

  /* Reset body and main */
  body {
    background: white !important;
    color: black !important;
    font-size: 10pt;
  }

  main, #main, #mainContainer, #graphicView {
    margin: 0 !important;
    padding: 0 !important;
    width: 100% !important;
    height: auto !important;
    position: static !important;
    overflow: visible !important;
    background: white !important;
  }

  /* Builder canvas: scale to fit page */
  #graphicView canvas,
  #graphicView svg {
    max-width: 100% !important;
    height: auto !important;
    page-break-inside: avoid;
  }

  /* Don't break headings across pages */
  h1, h2, h3 { page-break-after: avoid; }

  /* Page setup */
  @page {
    size: A4 landscape;
    margin: 1cm;
  }

  @page :first {
    size: A4 landscape;
    margin-top: 1cm;
  }

  /* Inline links: show their URL on print */
  a[href^="http"]::after {
    content: " (" attr(href) ")";
    font-size: 80%;
    color: #555;
  }

  /* But NOT for in-page anchors or mailto */
  a[href^="#"]::after,
  a[href^="mailto:"]::after {
    content: "";
  }
}
```

Notes:
- `@page { size: A4 landscape; }` favors landscape because trees are usually wider than tall. Users on US Letter still get a sensible result (the browser falls back to Letter when A4 isn't available).
- `page-break-inside: avoid` on the canvas keeps it on one page if it fits; otherwise the browser handles paginating large trees.
- Showing link URLs after anchors is print-convention — disabled for fragment and mailto links to avoid noise.

- [ ] **Step 2: Test in browser.**

```bash
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 2
# Open http://localhost:4321/about → File → Print preview → confirm:
#   - No nav, footer, etc.
#   - Body text reflows
#   - Background is white
# Open http://localhost:4321/builder → Print preview → confirm:
#   - Canvas fills the page
#   - No sidebar/toolbar
kill $PREVIEW_PID
```

- [ ] **Step 3: Commit.**

```bash
git add src/styles/global.css
git commit -m "feat(print): add print stylesheet for marketing pages and builder canvas"
```

---

## Task 6: Image optimization

**Why:** `assets/images/tree.webp` (the homepage hero image) and `assets/images/Screenshot 2025-07-03 at 9.27.02 PM.png` (an old screenshot, 2.3MB) ship as-is. Astro's `<Image>` component generates AVIF + WebP at build time and emits `<picture>` elements with proper `srcset`, cutting image weight by ~60% on supporting browsers.

**Files:**
- Modify: `public/assets/images/` (move to `src/assets/images/` for Astro processing)
- Modify: `src/pages/index.astro` (use `<Image>` for tree.webp)

- [ ] **Step 1: Move processable images to `src/assets/`.**

```bash
mkdir -p src/assets/images
git mv public/assets/images/tree.webp src/assets/images/tree.webp
```

Astro processes images under `src/assets/`. Images in `public/` are passed through verbatim — no AVIF/WebP variants generated.

The old screenshot is unused (it's an artifact from an earlier hand-off) — delete it:

```bash
git rm "public/assets/images/Screenshot 2025-07-03 at 9.27.02 PM.png"
```

- [ ] **Step 2: Update `src/pages/index.astro` to use `<Image>`.**

Find the `<img>` reference to `/assets/images/tree.webp` in `src/pages/index.astro` (likely in the about section or features section). Replace:

```html
<img src="/assets/images/tree.webp" alt="Family tree visualization" />
```

with:

```astro
---
// at the top of the frontmatter, alongside other imports
import { Image } from 'astro:assets';
import treeImg from '@/assets/images/tree.webp';
---

<Image src={treeImg} alt="Family tree visualization" widths={[480, 800, 1200]} sizes="(max-width: 768px) 100vw, 800px" />
```

Astro will emit AVIF + WebP variants and a `<picture>` element with `<source>` for each format.

- [ ] **Step 3: Verify the build emits optimized variants.**

```bash
npm run build
ls dist/_astro/ | grep -E "tree.*\.(avif|webp|png|jpg)" | head -10
grep -c "<source" dist/index.html
```
Expected: 2+ tree variants in `_astro/` (one per width × format), and `<source>` elements in the HTML.

- [ ] **Step 4: Verify image weight dropped.**

```bash
du -sh dist/assets/images/  # leftover non-processed images
du -sh dist/_astro/  # processed images live here too
# Compare to pre-Phase-4 baseline (P4 in pre-flight)
```
Expected: `dist/assets/images/` is now empty or tiny; `dist/_astro/` grew slightly but the per-format sizes are smaller than the original.

- [ ] **Step 5: Commit.**

```bash
git add src/assets src/pages/index.astro public/assets/images
git commit -m "perf(images): use Astro <Image> for AVIF/WebP variants on hero image"
```

---

## Task 7: Font subsetting

**Why:** The current Inter and Playfair Display WOFF2s are full-Latin sets — they include glyphs the site never uses (Vietnamese diacritics, Polish nasals, etc. are fine; symbols and punctuation extras add weight). Subsetting to actually-rendered glyphs typically drops font weight by 30–50%.

**Files:**
- Modify: `public/assets/fonts/*.woff2` (regenerated as subsets)
- Modify: `package.json` (add a `subset-fonts` script)

- [ ] **Step 1: Install glyphhanger.**

```bash
npm install --save-dev glyphhanger
```

`glyphhanger` requires Puppeteer's Chromium for the build-the-site-and-collect-glyphs step. The `--save-dev` install also pulls in Puppeteer.

- [ ] **Step 2: Capture the current font sizes for comparison.**

```bash
ls -la public/assets/fonts/*.woff2
```
Note each file size.

- [ ] **Step 3: Add a `subset-fonts` script to `package.json`.**

In the `scripts` section, add:

```json
"subset-fonts": "glyphhanger https://localhost:4321 --subset='public/assets/fonts/*.woff2' --formats=woff2 --output='public/assets/fonts/' --family='Inter, Playfair Display'"
```

Note: glyphhanger needs a running site. The full workflow:

1. Build: `npm run build`
2. Preview: `npx astro preview --port 4321 &`
3. Subset: `npm run subset-fonts`
4. Stop preview.

Wrap this in a higher-level script:

```json
"subset-fonts:run": "npm run build && (npx astro preview --port 4321 & echo $! > /tmp/preview.pid; sleep 3) && npm run subset-fonts; kill $(cat /tmp/preview.pid) 2>/dev/null"
```

(The shell-quoting can be finicky — if it doesn't work cleanly, document the manual three-step process in CLAUDE.md instead.)

- [ ] **Step 4: Run the subsetter.**

```bash
npm run subset-fonts:run
```

If the wrapper script gives trouble, run manually:

```bash
npm run build
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 3
npm run subset-fonts
kill $PREVIEW_PID
```

The subsetter overwrites the WOFF2 files in place. The full Latin-set file is replaced with a glyph-subset file containing only the characters actually rendered on the site.

- [ ] **Step 5: Verify font sizes dropped.**

```bash
ls -la public/assets/fonts/*.woff2
```
Expected: each WOFF2 should be 30–50% smaller than the pre-subset size.

- [ ] **Step 6: Visual smoke test.**

```bash
npx astro preview --port 4321
# Open http://localhost:4321/ → confirm fonts render
# Open http://localhost:4321/de/ → check German umlauts (ä, ö, ü, ß)
# Open http://localhost:4321/ru/ → check Cyrillic — IF Russian uses a different font fallback, this is fine; otherwise, the subset must include Cyrillic glyphs
```

If Cyrillic is broken on `/ru/`, the subset missed it. Re-run `glyphhanger` with the locale routes explicitly listed and `--unicode-range='U+0400-04FF'` appended.

If Cyrillic was never rendered (the locale's text on `/ru/` uses a system font fallback), this is fine — accept and document.

- [ ] **Step 7: Commit.**

```bash
git add public/assets/fonts package.json package-lock.json
git commit -m "perf(fonts): subset Inter and Playfair to glyphs actually used"
```

---

## Task 8: Audit homepage for performance regressions

**Why:** Phase 1 inlined the language switcher styles in `Header.astro`. The roadmap says these should move to `homepage.css` and be deferred. Also, any leftover unused CSS / inline scripts deserve a pass.

**Files:**
- Modify: `src/components/Header.astro` (move inline styles to `homepage.css`)
- Modify: `src/styles/homepage.css` (receive the moved styles)
- Modify: `src/pages/index.astro` (verify critical CSS only)

- [ ] **Step 1: Move language-switcher styles from `Header.astro` to `homepage.css`.**

Open `src/components/Header.astro`. Find the `<style>` block at the end (lines ~67–112 from Phase 1). Cut all the rules it contains.

Open `src/styles/homepage.css`. Append the cut rules (with a comment marking the section).

- [ ] **Step 2: Verify the build.**

```bash
npm run build
ls dist/_astro/*.css | head -5
```
The Header's per-component CSS file should disappear; the homepage CSS file grows slightly.

```bash
# Visual check
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 2
# Open / → language switcher should still be styled
kill $PREVIEW_PID
```

- [ ] **Step 3: Commit.**

```bash
git add src/components/Header.astro src/styles/homepage.css
git commit -m "perf(css): move Header inline styles to homepage.css for proper bundling"
```

---

## Task 9: Tighten Lighthouse-CI budgets

**Why:** Phase 2 set conservative thresholds. With Phase 4's optimizations, we can lock in tighter targets so future regressions are caught.

**Files:**
- Modify: `lighthouserc.cjs`

- [ ] **Step 1: Update `lighthouserc.cjs`.**

Replace the existing `assert.assertions` block with:

```javascript
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices': ['error', { minScore: 0.95 }],
        'categories:seo': ['error', { minScore: 0.95 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 300000 }],
        'resource-summary:total:size': ['warn', { maxNumericValue: 1500000 }]
      }
    },
```

Notes:
- All four categories raised to `error` at 0.95.
- Performance went from `warn` (Phase 2) → `error`. The optimizations from Tasks 6 and 7 should make this achievable.
- Resource budgets added: total JS ≤ 300 KB and total page weight ≤ 1.5 MB. These are `warn` so they don't block on the JS-heavy builder page.

- [ ] **Step 2: Add the builder page to the URL list with a separate, more lenient assertion.**

The builder is unavoidably JS-heavy. Either: (a) drop it from the asserted URLs and audit it manually; (b) define a separate config for the builder. Do (a) for simplicity:

```javascript
    collect: {
      url: [
        'http://localhost:4321/',
        'http://localhost:4321/about',
        'http://localhost:4321/contact',
        'http://localhost:4321/glossary'
      ],
      numberOfRuns: 3,
      ...
    },
```

The builder's perf is checked manually via DevTools, not gated.

- [ ] **Step 3: Run locally to confirm the new budget passes.**

```bash
npm run build
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 3
npx lhci autorun --upload.target=temporary-public-storage 2>&1 | tee /tmp/phase4-lh-final.txt
kill $PREVIEW_PID
```
Expected: all four categories ≥ 0.95 on each of the four URLs. If any URL falls short, investigate that page specifically.

- [ ] **Step 4: Commit.**

```bash
git add lighthouserc.cjs
git commit -m "ci: tighten Lighthouse-CI budgets to 0.95 on all categories"
```

---

## Task 10: Accessibility audit with axe-core

**Why:** The homepage and builder claim WCAG 2.1 AA compliance. Verify with an automated tool, fix any violations.

**Files:**
- Modify: `package.json` (add `@axe-core/cli`)
- (Possibly modify): `src/components/*.astro`, `src/pages/*.astro` for fixes

- [ ] **Step 1: Install `@axe-core/cli`.**

```bash
npm install --save-dev @axe-core/cli
```

- [ ] **Step 2: Run axe against each main URL.**

```bash
npm run build
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 3

mkdir -p /tmp/axe
for path in / /about /contact /privacy /terms /builder /glossary /glossary/abstract; do
  slug=$(echo $path | sed 's|/|_|g; s|^_||; s|^$|home|')
  npx axe "http://localhost:4321${path}" --save "/tmp/axe/${slug}.json" 2>&1 | tail -5
done

kill $PREVIEW_PID
```

- [ ] **Step 3: Inspect the JSON output for violations.**

```bash
for f in /tmp/axe/*.json; do
  echo "=== $f ==="
  cat "$f" | jq '.[] | {url, violations: (.violations | length)}'
done
```
Expected: violation counts of 0 or 1 per page. Expected non-issues: color contrast on disabled buttons (sometimes flagged but acceptable), `landmark-unique` on multiple `<nav>` elements (low-severity, can be deferred).

- [ ] **Step 4: Fix any serious/critical violations.**

For each violation reported as severity `serious` or `critical`:
- Check the rule ID and selector in the JSON.
- Apply the fix to the relevant component.
- Re-run axe on that page to confirm fixed.

Common findings and fixes:
- **Missing `alt` on images** → add descriptive `alt` text.
- **Form input without label** → add `<label for="...">` or `aria-label`.
- **Buttons without accessible name** → add inner text or `aria-label`.
- **Color contrast failures** → adjust foreground/background colors or use a darker variant.

- [ ] **Step 5: Commit fixes.**

```bash
git add src/...
git commit -m "fix(a11y): resolve axe-core violations from Phase 4 audit"
```

If there were no violations, no commit — Task 10 is a verification gate.

- [ ] **Step 6: Document acceptable warnings.**

If any violations are deferred (e.g., a third-party widget that you can't control), add a note to `CLAUDE.md` under "Code conventions":

```markdown
### Known accessibility deferrals

- (None at end of Phase 4 — update if any fixes are deferred)
```

---

## Task 11: Final verification

- [ ] **Step 1: Working tree clean.**

```bash
git status
```

- [ ] **Step 2: Reproducible build.**

```bash
rm -rf dist/ .astro/
npm run build
```

- [ ] **Step 3: All target files exist.**

```bash
test -f dist/sw.js && echo "service worker OK"
test -f dist/registerSW.js && echo "SW registration OK"
test -f dist/offline/index.html && echo "offline page OK"
test -f dist/manifest.json && echo "manifest OK"
test -f dist/icon-192.png && echo "icon OK"
ls dist/_astro/*.avif 2>/dev/null | head -1 && echo "AVIF variants OK"
ls dist/_astro/*.webp 2>/dev/null | head -1 && echo "WebP variants OK"
```
Expected: 7 `OK` lines.

- [ ] **Step 4: Service worker registers in browser.**

```bash
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 3
# Open http://localhost:4321/ in browser
# DevTools → Application → Service Workers → confirm sw.js is "activated and running"
# DevTools → Network → reload → most resources should be from "(ServiceWorker)"
# DevTools → Network → "Offline" → reload → page should still load
# Visit a never-loaded URL (e.g. /glossary/banns) while offline → /offline should display
kill $PREVIEW_PID
```

- [ ] **Step 5: Lighthouse pass.**

```bash
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 3
npx lhci autorun --upload.target=temporary-public-storage
kill $PREVIEW_PID
```
Expected: all asserts pass.

- [ ] **Step 6: PWA install dialog.**

Manual: Chrome → `localhost:4321` → DevTools → Application → Manifest → confirm:
- Name "MapMyRoots - Free Family Tree Builder"
- Theme color `#0f866c`
- 192 + 512 icons present
- "Install" button enabled

Click Install → app launches standalone → confirm offline mode works inside standalone window.

- [ ] **Step 7: Bundle size compare.**

```bash
du -sh dist/
du -sh dist/_astro/
du -sh dist/assets/fonts/
```

Compare against pre-Phase-4 baseline (P4 in pre-flight). Expected: fonts down ~30%, images down ~50% on AVIF-supporting browsers, total dist roughly flat (SW + precache manifest add ~20 KB).

- [ ] **Step 8: All tests still green.**

```bash
npm test -- --run
```
Expected: all 40 unit tests pass (Phase 4 didn't touch their code paths).

- [ ] **Step 9: Commit count.**

```bash
git log --oneline feat/pwa-and-perf ^feat/seo-infrastructure 2>/dev/null | wc -l
```
Expected: roughly 9–12 commits.

- [ ] **Step 10: Push branch.**

```bash
git push -u origin feat/pwa-and-perf
```

---

## Phase 4 complete

The site is now an installable PWA with offline support. Marketing pages survive an offline reload via the service worker; the builder works fully offline (it always did, but now the SW makes it explicit). Print stylesheet renders cleanly. Images and fonts are optimized. Lighthouse-CI budgets locked at 0.95 across all categories.

This is the **end of the critical path** in the roadmap. Phase 5 features (GEDCOM import, contact form, share-by-link) and Phase 6 content growth ship independently from here.

Next step: write `docs/superpowers/plans/YYYY-MM-DD-phase-5-<task-name>.md` for whichever Phase 5 task ships first — recommended start: GEDCOM import (Phase 5 Task 5.2) per the roadmap's "high priority" flag.

---

## Self-review

**1. Spec coverage** vs. roadmap Phase 4:
- [x] Install `@vite-pwa/astro` — Task 1
- [x] Service worker config — Task 1 Step 2
- [x] Offline page — Task 2
- [x] Offline-aware UI — Task 3 (badge), Task 4 (install prompt is bonus)
- [x] Print stylesheet — Task 5
- [x] Audit `index.astro` for performance — Task 8
- [x] Image optimization pass — Task 6
- [x] Self-hosted font subsetting — Task 7
- [x] Lighthouse-CI budget enforcement — Task 9
- [x] A11y audit with axe-core — Task 10

**2. Placeholders.** No external secrets, tokens, or hand-drawn assets. Every step is automatable except for the manual print preview check (Task 5 Step 2) and PWA install verification (Task 11 Step 6) — both are verification gates, not implementation.

**3. Type/path consistency.** Image paths consistent: processable images at `src/assets/images/`, public-served at `public/assets/`. Service worker scope `/`. The `CLAUDE.md` reference in Task 7 Step 3 and Task 10 Step 6 stays a single source of truth for project conventions.

**4. Sequencing.**
- Task 1 (PWA install + config) before Task 2 (offline page must exist for the SW's navigateFallback to resolve, and the SW config must reference `/offline`).
- Task 2 before Task 3 (badge logic doesn't depend on offline page, but reading both at once helps reviewers).
- Task 4 (install prompt) requires Task 1 (manifest + SW must be valid for install dialog to enable).
- Tasks 5, 6, 7 are independent perf optimizations — can run in parallel with each other or with Tasks 1–4.
- Task 8 (CSS cleanup) depends on Phase 1 work; does not depend on other Phase 4 tasks.
- Task 9 (budget tightening) MUST run after Tasks 6 and 7 — those are what enable the tighter budget.
- Task 10 (a11y) is independent; could land first or last.
- Task 11 (final verification) is the gate.

The plan order respects this. With subagents, parallel execution of {1+2+3+4} ‖ {5} ‖ {6} ‖ {7} ‖ {8} ‖ {10} → {9} → {11} would shorten wall time.

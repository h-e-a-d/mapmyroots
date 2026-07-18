# Task: Site-wide fixes from the 2026-07-18 website audit

This plan implements the confirmed findings of a structural/technical/UX/SEO/GEO/performance audit.
Every phase is independent and safe to commit on its own. Do the phases **in order** — later
phases assume earlier ones (e.g., the CSP edits in Phase 4 and Phase 5 touch the same file).

## Rules for the implementing agent (read first)

- Follow `CLAUDE.md`. In particular:
  - Never use `innerHTML`; use `SecurityUtils` for DOM manipulation.
  - Any changed user-visible string must be updated in **all four** locale files:
    `public/assets/locales/en.json`, `es.json`, `ru.json`, `de.json`. Exact translations are
    provided in this plan — use them verbatim, do not invent your own.
- After **each** phase: run `npm test` (unit tests must pass) and the phase's own verification
  commands. After the **last** phase: run `npm run build` and the build-output checks.
- Make one git commit per phase using the message given in the phase header. Do not push.
- If an instruction references a line number, treat it as a hint — always locate the code by
  its content (a `grep` command is given), since line numbers may have drifted.
- If anything doesn't match what this plan describes (a file is missing, a grep returns
  nothing, a test fails for an unrelated reason), STOP and report instead of improvising.
- Do NOT touch `task.md` — it holds an unrelated prepared task.

---

## Phase 1 — Fix stale `llms.txt` (GEO-critical)
**Commit:** `docs: correct llms.txt to reflect shipped features`

`public/llms.txt` claims GEDCOM import and per-person photos are "not yet shipped". Both are
shipped (`src/features/import/gedcom-importer.js`, `src/features/photos/`), and the homepage FAQ
schema already says GEDCOM import works. AI search engines read this file verbatim, so it is
actively telling them the product lacks features it has.

**Steps:**
1. Open `public/llms.txt`. Find the section starting with `## Out of scope (not yet documented)`
   and delete that entire section (heading + intro sentence + the three bullets about GEDCOM,
   cloud sync, and photos).
2. In its place insert exactly:

```
## Feature summary

- GEDCOM import: supported. Use the Import button in the builder to load a `.ged` file
  exported from Ancestry, MyHeritage, FamilySearch, or any genealogy software.
- Photos and documents: supported. Each person can have photos and scanned documents
  (including PDFs) attached, stored locally in the browser.
- Share by link: supported. Trees can be shared as a self-contained URL; recipients view
  them at `/view` without an account.
- Export: JSON (backup), PNG/JPG (image), PDF (print).
- Offline: the site is an installable PWA; the builder works without an internet connection.
- Cloud sync / accounts: intentionally not offered. All data stays on the user's device.
```

3. In the top summary line (starts with `> MapMyRoots is a free, browser-based…`), change
   `Trees are stored locally in the browser` to
   `Trees are stored locally in the browser (IndexedDB)` — keep the rest of the sentence.

**Verify:** `grep -n "not yet shipped\|planned for a future release" public/llms.txt` returns nothing.

---

## Phase 2 — Remove the render-blocking `visibility: hidden` on content pages
**Commit:** `perf: stop hiding body until fonts load`

`src/layouts/BaseLayout.astro` hides the whole `<body>` until a JS handler adds `.fonts-loaded`.
This delays FCP/LCP on every content page, defeats the `font-display: swap` already declared in
`public/assets/fonts/fonts.css`, and leaves no-JS users with a permanently blank page.
Confirmed: no CSS file references `.fonts-loaded`, so removing it breaks nothing.

**Steps:**
1. In `src/layouts/BaseLayout.astro`, find the inline `<style>` block commented
   `<!-- Critical CSS to prevent FOUC -->`.
   - Delete the line `visibility: hidden;` from the `body { … }` rule.
   - Delete the entire `body.fonts-loaded { visibility: visible; }` rule.
   - Keep the `body` font-family/colors and the `.no-animations *` rule unchanged.
2. In the same file, find the `<script is:inline>` commented `<!-- Font load detection -->`.
   Replace the whole script so it only handles animation gating (the `fonts-loaded` class no
   longer exists in CSS):

```html
<script is:inline>
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      setTimeout(() => document.body.classList.remove('no-animations'), 100);
    });
  } else {
    window.addEventListener('load', () => {
      setTimeout(() => document.body.classList.remove('no-animations'), 100);
    });
  }
</script>
```

3. Do **not** touch `BuilderLayout.astro` (it never hid the body). In
   `src/pages/builder.astro` there is a similar `<!-- Font loading optimization -->` inline
   script that toggles `fonts-loaded` / `no-animations` classes — leave it alone; it is
   harmless there and out of scope.

**Verify:** `grep -rn "visibility: hidden" src/layouts/` returns nothing.
`grep -n "fonts-loaded" src/layouts/BaseLayout.astro` returns nothing.

---

## Phase 3 — Replace fabricated trust signals with truthful ones
**Commit:** `fix: replace unverifiable trust claims with factual ones`

The hero shows "15,000+ Families Trust Us" and "4.8★ User Rating". The product has no accounts,
backend, or rating mechanism, so these numbers have no source. Replace them with claims that are
true: free forever, no account required, works offline (it's a PWA).

**Steps:**
1. In `src/pages/index.astro`, find the `<div class="trust-signals">` block (three
   `trust-item` divs). Replace the whole block with:

```astro
        <div class="trust-signals">
          <div class="trust-item">
            <span class="trust-number">100%</span>
            <span class="trust-label" data-i18n="hero.trust.free">{t(locale, 'hero.trust.free')}</span>
          </div>
          <div class="trust-item">
            <span class="trust-number" data-i18n="hero.trust.account_value">{t(locale, 'hero.trust.account_value')}</span>
            <span class="trust-label" data-i18n="hero.trust.account_label">{t(locale, 'hero.trust.account_label')}</span>
          </div>
          <div class="trust-item">
            <span class="trust-number" data-i18n="hero.trust.offline_value">{t(locale, 'hero.trust.offline_value')}</span>
            <span class="trust-label" data-i18n="hero.trust.offline_label">{t(locale, 'hero.trust.offline_label')}</span>
          </div>
        </div>
```

2. In each locale file, find the `hero` → `trust` object. It currently has keys
   `families`, `free`, `rating`. Delete `families` and `rating`, keep `free` with its existing
   value, and add the four new keys. Use these translations verbatim:

   - `en.json`:
     ```json
     "trust": {
       "free": "Free Forever",
       "account_value": "No",
       "account_label": "Account Required",
       "offline_value": "Offline",
       "offline_label": "Works Without Internet"
     }
     ```
   - `es.json`:
     ```json
     "trust": {
       "free": "Gratis Para Siempre",
       "account_value": "Sin",
       "account_label": "cuenta ni registro",
       "offline_value": "Offline",
       "offline_label": "Funciona sin conexión"
     }
     ```
   - `ru.json`:
     ```json
     "trust": {
       "free": "Бесплатно навсегда",
       "account_value": "Без",
       "account_label": "регистрации и аккаунта",
       "offline_value": "Офлайн",
       "offline_label": "Работает без интернета"
     }
     ```
   - `de.json`:
     ```json
     "trust": {
       "free": "Kostenlos für immer",
       "account_value": "Ohne",
       "account_label": "Konto nutzbar",
       "offline_value": "Offline",
       "offline_label": "Funktioniert ohne Internet"
     }
     ```

3. Search for other occurrences of the fabricated numbers:
   `grep -rn "15,000\|15000\|4\.8" src/ public/assets/locales/ --include="*.astro" --include="*.json"`
   For any hit that is a trust/rating claim (ignore unrelated numeric hits such as version
   numbers or CSS values), remove or replace it the same way. List what you changed in the
   commit message body.

**Verify:** `grep -rn "hero.trust.families\|hero.trust.rating" src/ public/` returns nothing.
`python3 -c "import json; [json.load(open(f'public/assets/locales/{l}.json')) for l in ['en','es','ru','de']]"` exits 0 (valid JSON).

---

## Phase 4 — Make the privacy policy truthful; drop unused Google CSP entries
**Commit:** `fix: privacy policy describes actual (cookieless) analytics; tighten CSP`

The privacy page claims Google Tag Manager / Google Analytics cookies. Nothing on the site loads
GTM or GA: no container snippet exists anywhere, so `window.dataLayer` is never created and all
`gtmTrack()`/analytics-service calls are silent no-ops (confirmed: `src/analytics/analytics-service.js`
only *checks* for `gtag`/`dataLayer`, never injects them). The only real analytics is Cloudflare
Web Analytics (cookieless), injected by Cloudflare Pages.

**Steps:**
1. In `src/pages/privacy.astro`, find section **"2.2 Analytics Data"**
   (`grep -n "Analytics Data" src/pages/privacy.astro`). Replace the paragraph that mentions
   "Google Tag Manager and Google Analytics", and the `<ul>` that follows it, with:

```html
        <p>We use Cloudflare Web Analytics, a privacy-first, cookieless analytics service, to collect anonymous, aggregate usage statistics that help us improve the Service. This includes:</p>
        <ul>
          <li>Pages visited</li>
          <li>Referring website</li>
          <li>Device type and browser</li>
          <li>Country-level location</li>
        </ul>
        <p><strong>Important:</strong> Cloudflare Web Analytics does not use cookies and does not fingerprint devices. Analytics data never includes any personal information from your family tree.</p>
```

   Note: drop the `data-i18n` attributes on the lines you replace — the `privacy.*` keys do
   not exist in any locale file (confirmed), so they were dead attributes.
2. In the cookies section of the same file, find the list item
   `Analytics Cookies: … Google Analytics cookies …`
   (`grep -n "Analytics Cookies" src/pages/privacy.astro`) and delete that `<li>` entirely.
   If the surrounding text says the site uses analytics *cookies*, reword that sentence to
   say analytics is cookieless (keep any mention of strictly-necessary/localStorage items).
3. Read the rest of `privacy.astro` and fix any other Google Analytics/GTM mention the same
   way (e.g., the GDPR section). Do not touch unrelated content.
4. In `public/_headers`, in the `/*` block's `Content-Security-Policy`:
   - Remove `https://www.googletagmanager.com` from `script-src`.
   - Remove `https://www.google-analytics.com https://www.googletagmanager.com https://www.google.com`
     from `connect-src`.
   - Keep both `cloudflareinsights` entries exactly as they are.
5. Leave `src/analytics/` and `tree.js` untouched — the no-op analytics plumbing is used by
   the builder and its removal is out of scope.

**Verify:** `grep -n "googletagmanager\|google-analytics" public/_headers src/pages/privacy.astro` returns nothing.

---

## Phase 5 — Bundle DOMPurify instead of loading it from jsdelivr
**Commit:** `fix: bundle DOMPurify; drop CDN dependency and CSP allowances`

`src/pages/builder.astro` loads `dompurify@3.0.6` from cdn.jsdelivr.net while `package.json`
already has `^3.3.0`. The CDN is a third-party point of failure (blocked in some regions) and
pins an outdated sanitizer. `SecurityUtils.getDOMPurify()` currently reads `window.DOMPurify`.

**Steps:**
1. In `package.json`, move `"dompurify"` from `devDependencies` to `dependencies` (keep the
   same version range). Run `npm install` to refresh the lockfile.
2. In `src/utils/security-utils.js`, add at the top of the file:
   ```js
   import DOMPurify from 'dompurify';
   ```
   Then change `getDOMPurify()` so the bundled copy is the primary source with the old
   global as fallback:
   ```js
   static getDOMPurify() {
     if (DOMPurify && typeof DOMPurify.sanitize === 'function') {
       return DOMPurify;
     }
     if (typeof window !== 'undefined' && window.DOMPurify) {
       return window.DOMPurify;
     }
     return null;
   }
   ```
   Keep the rest of the file (fallback to `sanitizeText` when null) unchanged.
3. In `src/pages/builder.astro`, delete the CDN script tag
   (`grep -n "cdn.jsdelivr.net" src/pages/builder.astro`) and the `<!-- DOMPurify for XSS
   Protection -->` comment above it.
4. In `public/_headers`, in **both** the `/builder` and `/builder/*` CSP blocks:
   - Remove `https://cdnjs.cloudflare.com https://cdn.jsdelivr.net` from `script-src`.
   - Remove `https://cdnjs.cloudflare.com` from `style-src`.
   (Nothing loads from cdnjs — it's a leftover.)
5. `npm test` — if any unit test stubs `window.DOMPurify`, it still passes because of the
   fallback chain. If a test fails on the new import, report rather than patching tests.

**Verify:** `grep -rn "jsdelivr\|cdnjs" src/ public/_headers` returns nothing.
After the final build: `grep -n "jsdelivr" dist/builder/index.html` returns nothing.

---

## Phase 6 — Fonts cleanup: remove dead Roboto / `.woff` references and unused Ardeco.ttf
**Commit:** `fix: remove font declarations pointing at missing files`

`public/assets/fonts/fonts.css` declares Roboto 400/500 pointing at `roboto-v30-latin-*.woff2`
files that do not exist (runtime 404s — `src/styles/global.css` uses `'Roboto'` in one place),
and every `@font-face` lists a `.woff` fallback that was never shipped. `Ardeco.ttf` is
referenced by nothing.

**Steps:**
1. In `public/assets/fonts/fonts.css`:
   - Delete both Roboto `@font-face` blocks (weights 400 and 500) and their comments.
   - In each remaining `@font-face` (Inter 400/600/700, Playfair 600/700), delete the
     `url('./….woff') format('woff')` source line and fix the trailing comma/semicolon on the
     `woff2` line so the `src:` list stays valid.
   - Delete the two large commented-out blocks at the bottom of the file
     ("Font Loading Strategy" script and "Critical CSS for preventing FOUT") — they document
     the pattern removed in Phase 2.
2. In `src/styles/global.css`, find the one `font-family: 'Roboto', …` declaration
   (`grep -n "Roboto" src/styles/global.css`) and change it to
   `font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;`.
3. Confirm nothing references Ardeco: `grep -rn "Ardeco" src/ public/ tree.js` must return
   nothing. Then delete `public/assets/fonts/Ardeco.ttf`.
4. Do **not** touch the `<option value="Roboto">` entries in `src/pages/builder.astro` — those
   are canvas font choices resolved by the OS font stack and are out of scope.

**Verify:** `grep -in "roboto" public/assets/fonts/fonts.css` returns nothing and
`grep -n "\.woff'" public/assets/fonts/fonts.css` returns nothing. `npm test` passes.

---

## Phase 7 — Stop precaching the entire builder app on every page
**Commit:** `perf: precache content assets only; runtime-cache JS chunks`

The service worker (`astro.config.mjs`, `AstroPWA` → `workbox.globPatterns`) precaches
`**/*.js`, so a first-time visitor to any glossary article downloads pdf.js (334 KB), the
builder bundles, and tree-engine in the background. Hashed `/_astro/` chunks are immutable, so
`CacheFirst` runtime caching gives the same offline behavior for pages the user actually visits,
without the up-front download. (Trade-off, accepted: the builder is only available offline after
it has been opened online once — which is already required to have a tree to work on.)

**Steps:**
1. In `astro.config.mjs`, change:
   ```js
   globPatterns: ['**/*.{html,js,css,woff2,svg,png,jpg,json}'],
   ```
   to:
   ```js
   globPatterns: ['**/*.{html,css,woff2,svg,png,jpg,json}'],
   ```
2. In the same `workbox` object, add a new entry at the **start** of `runtimeCaching`
   (before the cloudflareinsights rule):
   ```js
   {
     urlPattern: /\/_astro\/.+\.m?js$/,
     handler: 'CacheFirst',
     options: {
       cacheName: 'astro-js',
       expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 365 }
     }
   },
   ```
   Note the `m?js` — this also covers the pdf.js worker (`pdf.worker.*.mjs`, 2.2 MB), which
   the old glob missed entirely (PDF viewing was broken offline even though pdf.js was
   precached; now both are cached consistently on first use).

**Verify (after final `npm run build`):**
- `grep -o '"[^"]*\.js"' dist/sw.js | grep _astro | wc -l` → `0` (no precached JS chunks).
- `grep -o 'astro-js' dist/sw.js | head -1` → prints `astro-js` (runtime cache registered).

---

## Phase 8 — `/view`: noindex, out of sitemap, working og:image
**Commit:** `seo: noindex /view, exclude from sitemap, add its OG image`

`/view` renders "No tree data in URL." without a `?d=` parameter — an empty page for crawlers —
yet it is in the sitemap, is indexable, and its auto-derived `og:image` (`/og/view.png`) 404s.
The og:image matters because share links *are* posted socially.

**Steps:**
1. `src/components/SEO.astro`:
   - Add `noindex?: boolean;` to `Props` and `noindex = false` to the destructuring.
   - Change the robots meta line (`grep -n 'name="robots"' src/components/SEO.astro`) to:
     ```astro
     <meta name="robots" content={noindex ? 'noindex, follow' : 'index, follow'} />
     ```
2. `src/layouts/BuilderLayout.astro`: add `noindex?: boolean;` to `Props`, destructure it
   with default `false`, and pass `noindex={noindex}` to the `<SEO …/>` component.
3. `src/pages/view.astro`: add `noindex` to the `<BuilderLayout …>` props.
4. `astro.config.mjs`, sitemap integration: change the filter to
   ```js
   filter: (page) => !page.includes('/offline') && !page.includes('/view'),
   ```
5. `src/pages/og/[slug].ts`: add to the `pages` object:
   ```ts
   'view.png': {
     title: 'Shared Family Tree',
     description: 'Someone shared their family tree with you — view it free on MapMyRoots'
   },
   ```

**Verify (after final build):**
- `grep -c "/view" dist/sitemap-0.xml` → `0`.
- `grep -o 'name="robots" content="[^"]*"' dist/view/index.html` → contains `noindex`.
- `ls dist/og/view.png` → exists.
- `grep -o 'name="robots" content="[^"]*"' dist/index.html` → still `index, follow`.

---

## Phase 9 — Schema & FAQ accuracy (IndexedDB, build-time dateModified)
**Commit:** `seo: correct storage claims and stale dates in structured data`

**Steps:**
1. In `src/pages/index.astro`, in the `faqSchema` JSON-LD, find the answer containing
   `browser LocalStorage` and replace the whole answer text with:
   `Absolutely! Your family tree data is stored locally on your device in your browser's storage (IndexedDB). It never leaves your device and we never see or access it.`
2. Update the visible FAQ answer key `faq.privacy.answer` in **all four** locale files
   (locate the key; replace the whole value verbatim):
   - `en.json`: `Absolutely! Your family tree data is stored locally on your device in your browser's storage (IndexedDB). It never leaves your device and we never see or access it.`
   - `es.json`: `¡Absolutamente! Los datos de tu árbol genealógico se almacenan localmente en tu dispositivo, en el almacenamiento de tu navegador (IndexedDB). Nunca salen de tu dispositivo y nosotros nunca los vemos ni accedemos a ellos.`
   - `ru.json`: `Абсолютно! Данные вашего генеалогического древа хранятся локально на вашем устройстве в хранилище браузера (IndexedDB). Они никогда не покидают ваше устройство, и мы никогда их не видим.`
   - `de.json`: `Absolut! Die Daten Ihres Stammbaums werden lokal auf Ihrem Gerät im Browser-Speicher (IndexedDB) gespeichert. Sie verlassen niemals Ihr Gerät und wir sehen sie nie.`
3. Search for remaining wrong storage claims:
   `grep -rn "LocalStorage" src/pages/ public/assets/locales/ public/llms.txt`
   Fix claims about *family tree data* the same way (browser storage / IndexedDB). Leave
   technically correct mentions alone (e.g., preferences genuinely stored in localStorage);
   when unsure, list the hit in the commit body instead of changing it.
4. In `src/pages/index.astro` `softwareSchema`, replace the hardcoded
   `"dateModified": "2026-04-29"` with a build-time value — the object is plain JS being
   stringified, so use: `"dateModified": new Date().toISOString().split('T')[0],`

**Verify:** `grep -n "LocalStorage" src/pages/index.astro` returns nothing;
locale JSONs still parse (same python one-liner as Phase 3). `npm test` passes.

---

## Phase 10 — Retire the legacy duplicate glossary
**Commit:** `seo: redirect legacy glossary page to /glossary`

`public/assets/glossary/glossary.html` (plus `sitemap-glossary.xml` beside it) duplicates the
new `/glossary` content collection, and the contact page still links to the legacy file.

**Steps:**
1. In `public/_redirects`, replace the two comment lines about the legacy glossary
   (`# Legacy assets/glossary path stays …` and the comment line under it) with:
   ```
   # Legacy standalone glossary → content-collection glossary
   /assets/glossary/glossary.html /glossary 301
   ```
   (On Cloudflare Pages, `_redirects` rules are evaluated before static assets, so the rule
   would win even while the file exists; we delete the file anyway.)
2. Delete the directory `public/assets/glossary/` (both files in it).
3. Fix every internal link to it: `grep -rn "assets/glossary" src/` — expect at least
   `src/pages/contact.astro` and possibly `src/pages/es|ru|de/contact.astro`. Change each
   `href` to `/glossary`. Keep link text and `data-i18n` attributes unchanged.

**Verify:** `grep -rn "assets/glossary" src/ public/` returns only the `_redirects` rule.
`ls public/assets/glossary` fails (directory gone).

---

## Phase 11 — Allow pinch-zoom in the builder (WCAG 1.4.4)
**Commit:** `a11y: remove user-scalable=no from builder viewport`

**Steps:**
1. In `src/layouts/BuilderLayout.astro`, change the viewport meta from
   `content="width=device-width, initial-scale=1.0, user-scalable=no"` to
   `content="width=device-width, initial-scale=1.0"`.
   (iOS already ignores `user-scalable=no`; the canvas keeps its own gesture handling via
   `touch-action: manipulation`, which still prevents double-tap zoom on the canvas.)

**Verify:** `grep -rn "user-scalable" src/` returns nothing.

---

## Phase 12 (OPTIONAL — do last, needs manual browser verification) — Stop runtime re-translation on static pages
**Commit:** `perf: load runtime i18n only in the builder`

Every content page is fully translated at build time, yet `src/components/Header.astro` loads
`src/features/i18n/i18n.js`, which fetches `/assets/locales/{locale}.json` (33–54 KB) on every
page view and re-applies every `data-i18n` attribute to already-correct text. The runtime system
is only needed in the builder, and `src/pages/builder.astro` imports it independently (confirmed).
Both `language-switcher.js` and `homepage.js` guard every `window.i18n` use with
`if (window.i18n)`, and the switcher navigates between locales via `window.location.href`
for non-builder pages, so they keep working without the runtime.

**Steps:**
1. In `src/components/Header.astro`, in the `<script>` block near the bottom, delete only the
   line `import '/src/features/i18n/i18n.js';`. Keep the `language-switcher.js` and
   `homepage.js` imports.
2. Run `npm run build && npm run preview`, then manually verify in a browser:
   - `/`, `/de/`, `/es/`, `/ru/` each render fully translated (build-time text).
   - The header language dropdown opens, and switching navigates to the right locale URL.
   - No console errors on any of those pages.
   - `/builder` still translates its UI (it loads i18n itself) and its language switcher works.
3. If any manual check fails, revert this phase
   (`git checkout -- src/components/Header.astro`) and report the failure — the earlier
   phases stand on their own.

---

## Final verification (after all phases)

```bash
npm test                # all unit tests pass
npm run build           # build succeeds
# Phase-specific build checks:
grep -o '"[^"]*\.js"' dist/sw.js | grep _astro | wc -l     # 0        (Phase 7)
grep -c "/view" dist/sitemap-0.xml                          # 0        (Phase 8)
ls dist/og/view.png                                         # exists   (Phase 8)
grep -n "jsdelivr" dist/builder/index.html                  # nothing  (Phase 5)
grep -rn "15,000" dist/index.html                           # nothing  (Phase 3)
grep -o 'name="robots" content="[^"]*"' dist/view/index.html  # noindex (Phase 8)
```

Optionally run `npm run test:e2e` if Playwright browsers are installed locally; report
(don't fix) pre-existing failures.

## Explicitly OUT of scope (needs human input — do not attempt)

- Homepage product screenshot / demo video (needs a real capture and a design decision).
- Expanding the glossary beyond 12 terms (content writing task).
- Converting the homepage FAQ to `<details>/<summary>` (interacts with `homepage.js` handlers).
- Deleting `src/analytics/` (imported by `tree.js`; live no-op plumbing, larger refactor).
- Shipping or removing production sourcemaps (deliberate choice; the repo is public anyway).
- The prepared analytics-tracking task in `task.md` (separate task, untouched).

# Phase 3: SEO Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SEO setup correct and complete: real prerendered i18n routes, auto-generated sitemap with locale `alternate` entries, real OG/Twitter/icon images, glossary as a content collection with markdown sources, and `llms.txt` for AI search crawlers.

**Architecture:** Astro 5.x i18n routing emits `/`, `/de/`, `/es/`, `/ru/` as real prerendered HTML directories — no runtime locale switching, no client-side string-swap. The existing `assets/locales/*.json` files stay in `public/` for the live language switcher in the UI, but build-time translation strings come from a new `src/i18n/` module that imports the same JSON. OG images render at build time via `astro-og-canvas` (Satori-based, no headless browser). Icons generate from a single SVG source via Sharp. The glossary becomes 12 markdown files under `src/content/glossary/` consumed by a dynamic `[slug].astro` page.

**Tech Stack:** Astro 5.x i18n, `@astrojs/sitemap` (already installed, just reconfigured), `astro-og-canvas`, `sharp` (already a transitive dep via Astro), markdown content collections (scaffolded in Phase 1).

**Parent Roadmap:** [`docs/ROADMAP.md`](../../ROADMAP.md) (Phase 3).

**Prerequisite:** Phase 1 (Astro migration) and Phase 2 (Cloudflare Pages config) complete. The Cloudflare beacon token may still be a placeholder — Phase 3 doesn't depend on it.

---

## Out of scope for this phase

These come later — do not attempt them in Phase 3:

- **Service worker / PWA / offline mode** — Phase 4
- **Print stylesheet** — Phase 4
- **Image optimization (AVIF/WebP conversion of `tree.webp`)** — Phase 4
- **Font subsetting** — Phase 4
- **Glossary expansion beyond the existing 12 terms** — Phase 6 (content growth runs in parallel)
- **Translating privacy/terms pages** — they stay English-only per roadmap; the i18n switcher just hides the language menu on those pages or links to the English version
- **Article series (`/articles/*`)** — Phase 6
- **Cousin calculator tool** — Phase 6
- **Replacing the runtime i18n in the builder** — the builder continues to use the existing `i18n.js` runtime for now; Phase 3 only adds prerendered marketing routes

---

## Information you need before starting

These come from outside the repo and have to be obtained or decided manually.

- **Locale completeness audit.** Some keys in `de.json` (361 lines), `es.json` (649 lines), and `ru.json` (414 lines) may be missing relative to `en.json` (630 lines). If a key is missing, the build-time component for that locale either falls back to English or fails to compile — pick a behavior and document it (Task 2 Step 4). Recommended: explicit fallback with a build warning.
- **OG image style decision.** `astro-og-canvas` accepts a configuration: title font, gradient or solid background, logo placement. Pick one before Task 5 starts. Default suggested: dark green gradient (`#0f866c` → `#1a4d3e`), white title in Playfair Display, bottom-right logo.
- **Icon source SVG.** The current logo is the 🌳 emoji. For a real PWA icon set we need a real SVG. Either commission/draw one, or use a stylized SVG of a tree (suggestion: `bonsai` from Heroicons / Tabler / similar MIT-licensed icon library). Decide before Task 6 starts.
- **Real product screenshot.** A 1280×720 screenshot of the builder with a populated tree (suggestion: load the `50-person-template`). Take this manually before Task 8.

If any of the above isn't available, pause the relevant task and unblock the rest. Tasks are mostly independent — most can run before the OG style or icon source is finalized.

---

## Pre-flight

- [ ] **P1: Verify Phase 1 + Phase 2 landed.**

```bash
test -d src/pages && echo "Astro pages OK"
test -f public/_headers && echo "_headers OK"
test -f public/_redirects && echo "_redirects OK"
grep -q "static.cloudflareinsights.com" src/layouts/BaseLayout.astro && echo "CWA tag OK"
npm run build && echo "build OK"
```
Expected: five `OK` lines.

- [ ] **P2: Create the migration branch.**

```bash
git checkout -b feat/seo-infrastructure
```

- [ ] **P3: Capture pre-Phase-3 baseline metrics.**

```bash
# Page count in dist/
find dist -name "index.html" | wc -l
# Sitemap URLs
grep -c "<loc>" dist/sitemap-0.xml 2>/dev/null || echo "0"
```

Note the values. After Phase 3 they should rise: ~6 → ~16 pages (3 locales × 5 marketing pages added), and sitemap URLs grow proportionally plus glossary terms.

---

## Task 1: Configure Astro i18n routing

**Why:** Astro's `i18n` config emits real prerendered directories per locale. With `prefixDefaultLocale: false`, English stays at `/` while other locales prefix the path: `/de/`, `/es/`, `/ru/`.

**Files:**
- Modify: `astro.config.mjs`

- [ ] **Step 1: Update `astro.config.mjs`.**

Find:
```javascript
export default defineConfig({
  site: 'https://mapmyroots.com',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    assets: '_astro'
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/offline'),
      changefreq: 'weekly',
      priority: 0.7
    })
  ],
```

Replace with:
```javascript
export default defineConfig({
  site: 'https://mapmyroots.com',
  output: 'static',
  trailingSlash: 'ignore',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'de', 'es', 'ru'],
    routing: {
      prefixDefaultLocale: false
    },
    fallback: {
      de: 'en',
      es: 'en',
      ru: 'en'
    }
  },
  build: {
    format: 'directory',
    assets: '_astro'
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/offline'),
      changefreq: 'weekly',
      priority: 0.7,
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'en-US',
          de: 'de-DE',
          es: 'es-ES',
          ru: 'ru-RU'
        }
      }
    })
  ],
```

Notes:
- `fallback` declares: if a German page doesn't exist, serve the English version. Used for privacy/terms which stay EN-only.
- Sitemap `i18n` option emits `<xhtml:link rel="alternate" hreflang="...">` for each page across locales.

- [ ] **Step 2: Verify the config still parses.**

```bash
npm run build 2>&1 | tail -10
```
Expected: build succeeds. The output is unchanged (no locale folders yet — those land in Tasks 2–4).

- [ ] **Step 3: Commit.**

```bash
git add astro.config.mjs
git commit -m "feat(i18n): configure Astro i18n routing for en/de/es/ru locales"
```

---

## Task 2: Create the build-time translation helper

**Why:** Astro pages need translation strings at build time, not at runtime. The existing `assets/locales/*.json` files in `public/` work for the runtime i18n script (the language switcher), but a `.astro` page can't `fetch()` at build time. We import the JSONs directly into a typed helper module.

**Files:**
- Create: `src/i18n/index.ts`
- Create: `src/i18n/locales/en.ts` (re-exports `public/assets/locales/en.json` for typing)

- [ ] **Step 1: Create `src/i18n/index.ts`.**

Write the following exact content:

```typescript
import en from '../../public/assets/locales/en.json';
import de from '../../public/assets/locales/de.json';
import es from '../../public/assets/locales/es.json';
import ru from '../../public/assets/locales/ru.json';

export type Locale = 'en' | 'de' | 'es' | 'ru';

export const locales: Locale[] = ['en', 'de', 'es', 'ru'];
export const defaultLocale: Locale = 'en';

const dictionaries = { en, de, es, ru } as const;

/**
 * Look up a translation key like "hero.title". Falls back to English if the
 * locale-specific key is missing. If English is also missing, returns the key
 * itself (visible breadcrumb in the page so the bug is obvious).
 */
export function t(locale: Locale, key: string): string {
  const get = (dict: any) => key.split('.').reduce((acc, part) => acc?.[part], dict);
  const value = get(dictionaries[locale]);
  if (typeof value === 'string') return value;
  const fallback = get(dictionaries.en);
  if (typeof value !== 'string' && typeof fallback === 'string') {
    if (import.meta.env.DEV) console.warn(`[i18n] Missing key "${key}" for locale "${locale}", falling back to en`);
    return fallback;
  }
  return key;
}

/**
 * Build the canonical path for a page in a given locale.
 * t(en, 'about') → '/about', t(de, 'about') → '/de/about'.
 */
export function localizedPath(locale: Locale, path: string): string {
  if (locale === defaultLocale) return path;
  return `/${locale}${path === '/' ? '' : path}`;
}

/**
 * Returns the locale prefix for a URL path. Used by Astro pages to know which
 * locale they're rendering for when only the URL is available.
 */
export function detectLocale(url: URL): Locale {
  const segment = url.pathname.split('/').filter(Boolean)[0];
  if ((locales as string[]).includes(segment)) return segment as Locale;
  return defaultLocale;
}

/**
 * Returns the path with the locale prefix stripped. Used to compute alternate
 * URLs across locales (hreflang).
 */
export function pathWithoutLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && (locales as string[]).includes(parts[0])) {
    parts.shift();
  }
  return '/' + parts.join('/');
}
```

- [ ] **Step 2: Verify TypeScript imports resolve.**

```bash
npm run check 2>&1 | head -20
```
Expected: no errors related to `src/i18n/index.ts`. Astro's preset with `allowJs: true` accepts `.ts` files.

- [ ] **Step 3: Smoke test the helper.**

```bash
node -e "
import('./src/i18n/index.ts').catch(() => {
  // tsx/native ts not available — use vitest for the actual test
  console.log('skip — verified at build time')
})
"
```

(This step is optional — the real verification is Task 4 where we build a page that uses `t()`.)

- [ ] **Step 4: Decide and document missing-key behavior.**

The helper falls back to English with a `[i18n]` warning in dev. Document this in `CLAUDE.md`:

Find the "Code conventions" section in `CLAUDE.md`. Add at the end:

```markdown
### Translation strings

- Build-time strings (Astro pages) use `t(locale, 'key.path')` from `src/i18n/`.
- Runtime strings (builder UI) continue to use the existing `data-i18n` attributes resolved by `src/features/i18n/i18n.js`.
- Missing keys fall back to English with a dev-mode warning. Adding a new user-visible string still requires updating all four locale JSONs (Phase 0 rule unchanged).
```

- [ ] **Step 5: Commit.**

```bash
git add src/i18n/index.ts CLAUDE.md
git commit -m "feat(i18n): add build-time translation helper for Astro pages"
```

---

## Task 3: Update `SEO.astro` to emit hreflang

**Why:** Each locale page needs `<link rel="alternate" hreflang="...">` pointing at every other locale variant of the same page, plus an `x-default` pointing at English. Google uses these to serve the right locale to the right region.

**Files:**
- Modify: `src/components/SEO.astro`

- [ ] **Step 1: Edit `src/components/SEO.astro`.**

Find:
```astro
---
export interface Props {
  title: string;
  description: string;
  canonicalPath: string;
  ogImage?: string;
  twitterImage?: string;
  jsonLd?: string[];
}

const {
  title,
  description,
  canonicalPath,
  ogImage = 'https://mapmyroots.com/og-image.jpg',
  twitterImage = 'https://mapmyroots.com/twitter-image.jpg',
  jsonLd = []
} = Astro.props;

const canonicalUrl = new URL(canonicalPath, Astro.site).toString();
---
```

Replace with:
```astro
---
import { locales, defaultLocale, localizedPath, type Locale } from '@/i18n';

export interface Props {
  title: string;
  description: string;
  /** Path WITHOUT a locale prefix, e.g. "/" or "/about". Per-locale prefixes are added automatically. */
  canonicalPath: string;
  /** Page locale; defaults to English. */
  locale?: Locale;
  ogImage?: string;
  twitterImage?: string;
  jsonLd?: string[];
}

const {
  title,
  description,
  canonicalPath,
  locale = defaultLocale,
  ogImage = 'https://mapmyroots.com/og-image.jpg',
  twitterImage = 'https://mapmyroots.com/twitter-image.jpg',
  jsonLd = []
} = Astro.props;

const canonicalUrl = new URL(localizedPath(locale, canonicalPath), Astro.site).toString();

const alternates = locales.map((alt) => ({
  hreflang: alt,
  href: new URL(localizedPath(alt, canonicalPath), Astro.site).toString()
}));
---
```

Then find:
```astro
<link rel="canonical" href={canonicalUrl} />

<!-- Resource hints -->
<link rel="dns-prefetch" href="https://static.cloudflareinsights.com" />
```

Replace with:
```astro
<link rel="canonical" href={canonicalUrl} />

{alternates.map(({ hreflang, href }) => (
  <link rel="alternate" hreflang={hreflang} href={href} />
))}
<link rel="alternate" hreflang="x-default" href={new URL(canonicalPath, Astro.site).toString()} />

<!-- Resource hints -->
<link rel="dns-prefetch" href="https://static.cloudflareinsights.com" />
```

Notes:
- `x-default` always points at the default-locale URL (no prefix).
- The component now accepts an optional `locale` prop. Pages that don't pass it default to English — same behavior as before, no breakage.

- [ ] **Step 2: Update `BaseLayout.astro` to forward the locale prop.**

Find in `src/layouts/BaseLayout.astro`:
```astro
export interface Props {
  title: string;
  description: string;
  canonicalPath: string;
  showLanguageSwitcher?: boolean;
  jsonLd?: string[];
  bodyClass?: string;
}

const {
  title,
  description,
  canonicalPath,
  showLanguageSwitcher = true,
  jsonLd = [],
  bodyClass = ''
} = Astro.props;
```

Replace with:
```astro
import type { Locale } from '@/i18n';

export interface Props {
  title: string;
  description: string;
  canonicalPath: string;
  locale?: Locale;
  showLanguageSwitcher?: boolean;
  jsonLd?: string[];
  bodyClass?: string;
}

const {
  title,
  description,
  canonicalPath,
  locale = 'en',
  showLanguageSwitcher = true,
  jsonLd = [],
  bodyClass = ''
} = Astro.props;
```

Find:
```astro
    <SEO
      title={title}
      description={description}
      canonicalPath={canonicalPath}
      jsonLd={jsonLd}
    />
```

Replace with:
```astro
    <SEO
      title={title}
      description={description}
      canonicalPath={canonicalPath}
      locale={locale}
      jsonLd={jsonLd}
    />
```

Find:
```astro
<html lang="en">
```

Replace with:
```astro
<html lang={locale}>
```

- [ ] **Step 3: Same for `BuilderLayout.astro`.**

Find the Props interface and add `locale`. Find `<html lang="en">` and change to `<html lang={locale}>`. The builder will only ever be EN in Phase 3, so the default works — no caller changes needed.

- [ ] **Step 4: Build and verify hreflang appears in output.**

```bash
npm run build
grep -c "rel=\"alternate\" hreflang" dist/index.html
```
Expected: `5` (en, de, es, ru, x-default).

- [ ] **Step 5: Commit.**

```bash
git add src/components/SEO.astro src/layouts/BaseLayout.astro src/layouts/BuilderLayout.astro
git commit -m "feat(seo): emit hreflang alternates for all locales in SEO component"
```

---

## Task 4: Create localized page versions

**Why:** Each marketing page (index, about, contact) needs three locale variants: `/de/`, `/es/`, `/ru/`. Privacy/terms stay English-only per roadmap — the `fallback` config in Task 1 handles those.

**Files:**
- Create: `src/pages/de/index.astro`, `src/pages/de/about.astro`, `src/pages/de/contact.astro`
- Create: `src/pages/es/index.astro`, `src/pages/es/about.astro`, `src/pages/es/contact.astro`
- Create: `src/pages/ru/index.astro`, `src/pages/ru/about.astro`, `src/pages/ru/contact.astro`

That's 9 new files. They share a pattern.

- [ ] **Step 1: Refactor `src/pages/index.astro` to use the t() helper.**

This serves two purposes: it proves the pattern works, and it lets us copy the new English page as the template for the others.

Find this in `src/pages/index.astro`:
```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import '@/styles/homepage.css';

const softwareSchema = JSON.stringify({...});
// ... rest of frontmatter
---

<BaseLayout
  title="MapMyRoots - Free Family Tree Builder & Online Genealogy Software"
  description="Create beautiful, interactive family trees with MapMyRoots..."
  canonicalPath="/"
  jsonLd={[...]}
>
```

Replace the title/description hard-coded strings with calls to `t()`. The frontmatter becomes:

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import '@/styles/homepage.css';
import { t, type Locale } from '@/i18n';

export interface Props {
  locale?: Locale;
}

const { locale = 'en' } = Astro.props;

const title = t(locale, 'meta.title');
const description = t(locale, 'meta.description');

// ... existing JSON-LD blocks unchanged
---

<BaseLayout
  title={title}
  description={description}
  canonicalPath="/"
  locale={locale}
  jsonLd={[softwareSchema, orgSchema, faqSchema, howToSchema, breadcrumbSchema]}
>
```

The body content of the page stays English for now — full body translation happens incrementally. Just title + description go through `t()`. Hero copy translation is a follow-up; this step ships the framework.

- [ ] **Step 2: Create the 9 locale page files.**

For each `<lang>` in `de`, `es`, `ru` and each `<page>` in `index`, `about`, `contact`:

Write `src/pages/<lang>/<page>.astro` with the following content (substituting `__LANG__` with the locale code):

```astro
---
import Page from '../<page>.astro';
---

<Page locale="__LANG__" />
```

Concretely, `src/pages/de/index.astro`:

```astro
---
import Index from '../index.astro';
---

<Index locale="de" />
```

This pattern leans on Astro's component-as-page support. The locale-specific page just imports the English page and passes a different `locale` prop. The English page's frontmatter then resolves all translatable strings via `t(locale, ...)`.

Note: Astro components used as pages do NOT inherit the `Astro.props` from a parent automatically — passing the prop explicitly is required.

- [ ] **Step 3: Apply the t() refactor to `about.astro` and `contact.astro`.**

Same pattern as Step 1: introduce `Props` with optional `locale`, replace hard-coded `title`/`description` with `t()` calls. Both pages already accept simple `BaseLayout` props — minimal change.

For `about.astro`, the relevant keys in `en.json` are `meta.title`-style. Audit by reading `public/assets/locales/en.json` for matching about keys; if specific about meta strings don't exist, add them to all four locale files (with English values for missing locales as a placeholder; flag for translator follow-up).

For `contact.astro`, same audit.

- [ ] **Step 4: Verify the build emits all locale routes.**

```bash
npm run build 2>&1 | grep "/de\|/es\|/ru" | head -20
ls dist/de/ dist/es/ dist/ru/
```
Expected: `dist/de/index.html`, `dist/de/about/index.html`, `dist/de/contact/index.html`, plus `es/` and `ru/` parallels — 9 new index.html files.

- [ ] **Step 5: Verify hreflang is correct on a localized page.**

```bash
grep "rel=\"alternate\"" dist/de/index.html | head -10
```
Expected: 5 lines — hreflang `en`, `de`, `es`, `ru`, `x-default`. The `de` href should point at `https://mapmyroots.com/de/`. The `en` href should be `https://mapmyroots.com/`. The `x-default` should match `en`.

- [ ] **Step 6: Commit.**

```bash
git add src/pages/index.astro src/pages/about.astro src/pages/contact.astro src/pages/de src/pages/es src/pages/ru
git commit -m "feat(i18n): add de/es/ru locale routes for index, about, contact"
```

---

## Task 5: Generate OG/Twitter images at build time

**Why:** Currently `og-image.jpg` and `twitter-image.jpg` 404. When someone shares a MapMyRoots URL on Slack/Twitter/Discord, no preview card renders — or worse, browsers show the broken-image icon. We render real PNG images at build time, one per page, with the page title baked in.

**Files:**
- Modify: `package.json` (add `astro-og-canvas`)
- Modify: `astro.config.mjs` (no integration; we use it as a library inside a dynamic route)
- Create: `src/pages/og/[...slug].png.ts` (Astro endpoint)
- Modify: `src/components/SEO.astro` (point at the dynamic OG URL)

- [ ] **Step 1: Install `astro-og-canvas`.**

```bash
npm install astro-og-canvas canvaskit-wasm
```

`canvaskit-wasm` is the rendering engine used by `astro-og-canvas` (Skia-based, no headless browser).

- [ ] **Step 2: Create `src/pages/og/[...slug].png.ts`.**

Write the following content:

```typescript
import { OGImageRoute } from 'astro-og-canvas';

const pages = {
  '/': {
    title: 'MapMyRoots',
    description: 'Free Family Tree Builder & Genealogy Software'
  },
  '/about': {
    title: 'About MapMyRoots',
    description: 'Our mission: free, privacy-focused family tree software'
  },
  '/contact': {
    title: 'Contact MapMyRoots',
    description: 'Get in touch with our team'
  },
  '/builder': {
    title: 'Family Tree Builder',
    description: 'Create interactive family trees — free, no registration'
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'Your data stays on your device'
  },
  '/terms': {
    title: 'Terms of Service',
    description: 'Free, fair, simple terms'
  }
};

export const { getStaticPaths, GET } = OGImageRoute({
  param: 'slug',
  pages,
  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,
    bgGradient: [[15, 134, 108], [26, 77, 62]], // primary green → darker green
    border: { color: [255, 255, 255], width: 2 },
    padding: 60,
    logo: {
      path: './public/favicon.ico',
      size: [80]
    },
    font: {
      title: {
        families: ['Playfair Display'],
        weight: 'Bold',
        color: [255, 255, 255]
      },
      description: {
        families: ['Inter'],
        weight: 'Normal',
        color: [220, 230, 220]
      }
    }
  })
});
```

Notes:
- The route emits `dist/og/<page-slug>.png` for each entry in `pages`.
- The `slug` for the homepage is the empty string — Astro emits `dist/og/.png` which is a slightly weird name. Workaround: alias the homepage to `/og/home.png` by adding a `home` key in `pages` and pointing the SEO component at it for `/`.

Refine:
```typescript
const pages = {
  'home': { title: 'MapMyRoots', description: '...' },
  'about': { title: 'About MapMyRoots', description: '...' },
  'contact': { ... },
  'builder': { ... },
  'privacy': { ... },
  'terms': { ... }
};
```

This emits `dist/og/home.png`, `dist/og/about.png`, etc.

- [ ] **Step 3: Update `SEO.astro` to point at the dynamic OG URL.**

The component currently accepts `ogImage` as a prop with a default of `https://mapmyroots.com/og-image.jpg`. Change the default to a per-page computed URL based on the canonical path.

Find:
```astro
const {
  title,
  description,
  canonicalPath,
  locale = defaultLocale,
  ogImage = 'https://mapmyroots.com/og-image.jpg',
  twitterImage = 'https://mapmyroots.com/twitter-image.jpg',
  jsonLd = []
} = Astro.props;
```

Replace with:
```astro
const {
  title,
  description,
  canonicalPath,
  locale = defaultLocale,
  jsonLd = []
} = Astro.props;

const slug = canonicalPath === '/' ? 'home' : canonicalPath.replace(/^\/+|\/+$/g, '').replace(/\//g, '-');
const ogImage = Astro.props.ogImage ?? new URL(`/og/${slug}.png`, Astro.site).toString();
const twitterImage = Astro.props.twitterImage ?? ogImage;
```

(Pulling `ogImage`/`twitterImage` from `Astro.props` directly — not destructured — keeps the override capability without overriding the computed default.)

- [ ] **Step 4: Build and inspect the OG images.**

```bash
npm run build
ls dist/og/
```
Expected: `home.png`, `about.png`, `contact.png`, `builder.png`, `privacy.png`, `terms.png`.

```bash
file dist/og/home.png
```
Expected: `PNG image data, 1200 x 630, 8-bit/color RGB, non-interlaced` or similar.

Open `dist/og/home.png` visually and confirm: gradient background, white "MapMyRoots" title, description below, logo somewhere visible.

- [ ] **Step 5: Verify a page references the new OG URL.**

```bash
grep "og:image" dist/index.html
```
Expected: `<meta property="og:image" content="https://mapmyroots.com/og/home.png" />` or similar.

- [ ] **Step 6: Commit.**

```bash
git add package.json package-lock.json src/pages/og src/components/SEO.astro
git commit -m "feat(seo): generate OG/Twitter images at build time via astro-og-canvas"
```

---

## Task 6: Generate the icon set

**Why:** PWA install requires `icon-192.png`, `icon-512.png`, and (for iOS) `apple-touch-icon.png`. The current `manifest.json` references all three but none exist. The favicon also wants modern variants (`favicon.svg`, `favicon-16.png`, `favicon-32.png`).

**Files:**
- Create: `public/icon.svg` (the source SVG — a real tree icon)
- Create: `public/icon-192.png`, `public/icon-512.png`
- Create: `public/apple-touch-icon.png` (180×180)
- Create: `public/favicon-16.png`, `public/favicon-32.png`
- Create: `public/favicon.svg`
- Create: `scripts/generate-icons.mjs`
- Modify: `package.json` (add `generate-icons` script)
- Modify: `public/manifest.json` (fix paths and remove broken screenshot reference)

- [ ] **Step 1: Create the source `public/icon.svg`.**

Either commission a real one or use a placeholder tree icon. The plan can't draw an SVG, so the executor either:
- (a) Pulls a permissively-licensed tree icon from a library (Heroicons, Tabler, Lucide all have one). Save it as `public/icon.svg` after wrapping in a green background to match the brand:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f866c" />
  <g transform="translate(64, 64)" fill="white" stroke="white" stroke-width="2">
    <!-- Inline a tree path here from a chosen icon library -->
  </g>
</svg>
```

- (b) Falls back to a stylized "M" wordmark.

Decide before this task starts. The plan assumes (a).

- [ ] **Step 2: Create `scripts/generate-icons.mjs`.**

Write the following content:

```javascript
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const src = join(root, 'public', 'icon.svg');
const out = join(root, 'public');

const targets = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 }
];

const svg = await readFile(src);

for (const { name, size } of targets) {
  await sharp(svg)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(join(out, name));
  console.log(`✓ ${name}`);
}

// favicon.svg is just the source SVG copied verbatim (already vector)
await writeFile(join(out, 'favicon.svg'), svg);
console.log('✓ favicon.svg');
```

- [ ] **Step 3: Add the generate-icons script to `package.json`.**

Find the scripts section and add:

```json
"generate-icons": "node scripts/generate-icons.mjs"
```

- [ ] **Step 4: Run the script.**

```bash
npm run generate-icons
```
Expected: 6 lines of `✓` output, files appear in `public/`.

```bash
ls -la public/icon-*.png public/apple-touch-icon.png public/favicon-*.png public/favicon.svg
file public/icon-512.png
```
Expected: PNG image data, 512 x 512.

- [ ] **Step 5: Update `public/manifest.json`.**

The current manifest references paths starting with `/public/` which would 404 (Pages serves `public/` at the root). Fix the paths and remove the broken screenshot.

Read the current `public/manifest.json` and replace it with:

```json
{
  "name": "MapMyRoots - Free Family Tree Builder",
  "short_name": "MapMyRoots",
  "description": "Create beautiful, interactive family trees with our free drag-and-drop genealogy software. Build unlimited family trees, preserve memories, and discover your family story.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0f866c",
  "orientation": "any",
  "scope": "/",
  "icons": [
    {
      "src": "/favicon.ico",
      "sizes": "48x48",
      "type": "image/x-icon",
      "purpose": "any"
    },
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["productivity", "utilities", "lifestyle"],
  "shortcuts": [
    {
      "name": "Build Family Tree",
      "short_name": "Builder",
      "description": "Open the family tree builder",
      "url": "/builder",
      "icons": [{ "src": "/favicon.ico", "sizes": "48x48" }]
    },
    {
      "name": "Genealogy Glossary",
      "short_name": "Glossary",
      "description": "View genealogy terms",
      "url": "/glossary",
      "icons": [{ "src": "/favicon.ico", "sizes": "48x48" }]
    }
  ]
}
```

Note: the `screenshots` array is removed for now. It returns in Task 8 with a real screenshot.

- [ ] **Step 6: Update `BaseLayout.astro` and `BuilderLayout.astro` to reference the new icons.**

Both layouts have:
```astro
<link rel="apple-touch-icon" href="/icon-192.png" />
```

Update to add favicon variants:
```astro
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
```

(Keep the existing `/favicon.ico` reference for legacy browser support.)

- [ ] **Step 7: Build and confirm icons land in dist/.**

```bash
npm run build
ls dist/icon-*.png dist/apple-touch-icon.png dist/favicon*
```
Expected: all 7 icon files present.

- [ ] **Step 8: Commit.**

```bash
git add public/icon.svg public/icon-*.png public/apple-touch-icon.png public/favicon-*.png public/favicon.svg public/manifest.json scripts/generate-icons.mjs package.json src/layouts/BaseLayout.astro src/layouts/BuilderLayout.astro
git commit -m "feat(pwa): generate icon set + favicon variants from single SVG source"
```

---

## Task 7: Migrate glossary to a content collection

**Why:** The current glossary is one HTML file (`public/assets/glossary/glossary.html`) with 12 inline term definitions. Phase 1 scaffolded an empty `src/content/glossary/` collection; now we populate it with real markdown files and generate routes.

**Files:**
- Create: `src/content/glossary/abstract.md`, `affinity.md`, `ahnentafel.md`, `ancestor.md`, `ancestry.md`, `autosomal-dna.md`, `banns.md`, `birth-record.md`, `brick-wall.md`, `census.md`, `family-tree.md`, `genealogy.md` (12 files)
- Create: `src/pages/glossary/index.astro` (term list)
- Create: `src/pages/glossary/[slug].astro` (per-term page)
- Modify: `src/content/config.ts` (already exists from Phase 1 — verify schema matches)
- Delete (eventually): `public/assets/glossary/glossary.html` and `public/assets/glossary/sitemap-glossary.xml`. **Defer the delete** until Task 9 — the existing nav still links to the old URL. We replace the link first.

- [ ] **Step 1: Verify `src/content/config.ts` schema.**

Read the file. The existing schema:

```typescript
const glossary = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    relatedTerms: z.array(z.string()).default([]),
    publishedAt: z.coerce.date().optional()
  })
});
```

Add a `letter` field to support the alphabetical letter-jump nav and an `aka` (also-known-as) field that the old glossary used. Update to:

```typescript
const glossary = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    /** First letter for alphabetical grouping. Auto-derivable from title; here for convenience. */
    letter: z.string().length(1),
    /** Synonyms / alternate names ("also known as"). */
    aka: z.array(z.string()).default([]),
    relatedTerms: z.array(z.string()).default([]),
    publishedAt: z.coerce.date().optional()
  })
});
```

- [ ] **Step 2: Create the 12 markdown files.**

For each term, extract the definition from `public/assets/glossary/glossary.html` (search for `data-term="<slug>"`), and write a markdown file.

Example — `src/content/glossary/abstract.md`:

```markdown
---
title: Abstract
description: An abbreviated transcription of a document that includes the date of the record and every name it contains.
letter: A
relatedTerms: [transcript, extract]
publishedAt: 2026-04-29
---

An abstract is an abbreviated transcription of a document that includes the date of the record and every name it contains. May also provide relationships or descriptions of the people mentioned.

Abstracts are commonly used by genealogists to capture the essential information from a longer document — wills, deeds, court records — without transcribing the entire text. They are particularly useful for cataloging large collections of records.

## Related terms

- **Transcript:** A word-for-word copy of an original document.
- **Extract:** A partial copy that includes specific portions of a document.
```

Repeat for the other 11 terms. The body content beyond the frontmatter `description` can be expanded later (Phase 6); a one-paragraph definition is the minimum.

The 12 slugs are: `abstract`, `affinity`, `ahnentafel`, `ancestor`, `ancestry`, `autosomal-dna`, `banns`, `birth-record`, `brick-wall`, `census`, `family-tree`, `genealogy`.

(Note: `autosomal_dna` in HTML uses underscore. The markdown filename uses dash for URL friendliness: `autosomal-dna.md` → `/glossary/autosomal-dna`. Same for `birth_record` → `birth-record`, `brick_wall` → `brick-wall`, `family_tree` → `family-tree`.)

- [ ] **Step 3: Create `src/pages/glossary/index.astro`.**

The list page that shows all terms grouped by letter:

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import { getCollection } from 'astro:content';

const terms = await getCollection('glossary');
const grouped = terms
  .sort((a, b) => a.data.title.localeCompare(b.data.title))
  .reduce<Record<string, typeof terms>>((acc, term) => {
    const letter = term.data.letter.toUpperCase();
    (acc[letter] ||= []).push(term);
    return acc;
  }, {});

const letters = Object.keys(grouped).sort();

const breadcrumbSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://mapmyroots.com/" },
    { "@type": "ListItem", "position": 2, "name": "Glossary", "item": "https://mapmyroots.com/glossary" }
  ]
});

const definedTermSetSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "DefinedTermSet",
  "name": "Genealogy Glossary",
  "description": "Comprehensive glossary of genealogical terms and definitions for family history research.",
  "url": "https://mapmyroots.com/glossary",
  "hasDefinedTerm": terms.map((t) => ({
    "@type": "DefinedTerm",
    "name": t.data.title,
    "description": t.data.description,
    "url": `https://mapmyroots.com/glossary/${t.slug}`
  }))
});
---

<BaseLayout
  title="Genealogy Glossary - Essential Terms for Family History Research | MapMyRoots"
  description="Comprehensive glossary of genealogical terms and definitions. Learn essential vocabulary for family history research and family tree building."
  canonicalPath="/glossary"
  jsonLd={[breadcrumbSchema, definedTermSetSchema]}
>
  <div class="glossary-container">
    <h1>Genealogy Glossary</h1>
    <p class="glossary-intro">Master the language of family history research with our collection of genealogical terms and definitions.</p>

    <nav class="glossary-letters" aria-label="Jump to letter">
      {letters.map((letter) => (
        <a href={`#letter-${letter}`}>{letter}</a>
      ))}
    </nav>

    {letters.map((letter) => (
      <section id={`letter-${letter}`} class="glossary-section">
        <h2>{letter}</h2>
        <ul class="glossary-list">
          {grouped[letter].map((term) => (
            <li>
              <a href={`/glossary/${term.slug}`}>
                <strong>{term.data.title}</strong>
                <span>{term.data.description}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
    ))}
  </div>
</BaseLayout>

<style>
  .glossary-container { max-width: 900px; margin: 2rem auto; padding: 0 1.5rem; }
  .glossary-letters { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 1rem; background: var(--background-alt); border-radius: 0.5rem; margin: 2rem 0; }
  .glossary-letters a { padding: 0.5rem 0.75rem; background: white; border-radius: 0.25rem; text-decoration: none; font-weight: 600; }
  .glossary-section h2 { font-size: 2rem; margin: 2rem 0 1rem; color: var(--primary-color); }
  .glossary-list { list-style: none; padding: 0; }
  .glossary-list li { margin-bottom: 1rem; }
  .glossary-list a { display: block; padding: 1rem; border-radius: 0.5rem; text-decoration: none; color: inherit; transition: background 0.2s; }
  .glossary-list a:hover { background: var(--background-alt); }
  .glossary-list strong { display: block; color: var(--primary-color); margin-bottom: 0.25rem; }
</style>
```

- [ ] **Step 4: Create `src/pages/glossary/[slug].astro`.**

```astro
---
import BaseLayout from '@/layouts/BaseLayout.astro';
import { getCollection, getEntry } from 'astro:content';

export async function getStaticPaths() {
  const terms = await getCollection('glossary');
  return terms.map((term) => ({
    params: { slug: term.slug },
    props: { term }
  }));
}

const { term } = Astro.props;
const { Content } = await term.render();

const breadcrumbSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://mapmyroots.com/" },
    { "@type": "ListItem", "position": 2, "name": "Glossary", "item": "https://mapmyroots.com/glossary" },
    { "@type": "ListItem", "position": 3, "name": term.data.title, "item": `https://mapmyroots.com/glossary/${term.slug}` }
  ]
});

const definedTermSchema = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "DefinedTerm",
  "name": term.data.title,
  "description": term.data.description,
  "url": `https://mapmyroots.com/glossary/${term.slug}`,
  "inDefinedTermSet": "https://mapmyroots.com/glossary"
});

const related = term.data.relatedTerms.length > 0
  ? await Promise.all(term.data.relatedTerms.map((slug) => getEntry('glossary', slug)))
  : [];
---

<BaseLayout
  title={`${term.data.title} - Genealogy Glossary | MapMyRoots`}
  description={term.data.description}
  canonicalPath={`/glossary/${term.slug}`}
  jsonLd={[breadcrumbSchema, definedTermSchema]}
>
  <article class="glossary-term">
    <nav aria-label="Breadcrumb"><a href="/glossary">← Back to glossary</a></nav>
    <h1>{term.data.title}</h1>
    {term.data.aka.length > 0 && (
      <p class="aka">Also known as: {term.data.aka.join(', ')}</p>
    )}
    <Content />
    {related.length > 0 && (
      <section class="related">
        <h2>Related terms</h2>
        <ul>
          {related.filter(Boolean).map((r) => (
            <li><a href={`/glossary/${r.slug}`}>{r.data.title}</a></li>
          ))}
        </ul>
      </section>
    )}
  </article>
</BaseLayout>

<style>
  .glossary-term { max-width: 800px; margin: 2rem auto; padding: 0 1.5rem; }
  .glossary-term h1 { color: var(--primary-color); }
  .aka { color: var(--text-secondary); font-style: italic; }
  .related { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--border-color); }
</style>
```

- [ ] **Step 5: Update `Footer.astro` and `Header.astro` to link to `/glossary`.**

Find references to `/assets/glossary/glossary.html` and replace with `/glossary` in:
- `src/components/Footer.astro` (one match)
- `src/components/Header.astro` (two matches — desktop nav + mobile menu)

- [ ] **Step 6: Build and verify glossary pages.**

```bash
npm run build
ls dist/glossary/
```
Expected: `index.html`, then 12 directories (one per slug) each containing an `index.html`.

```bash
curl -sL http://localhost:4321/glossary/abstract -o /tmp/abstract.html  # only after starting preview
# or just open dist/glossary/abstract/index.html in browser
```

- [ ] **Step 7: Commit.**

```bash
git add src/content/config.ts src/content/glossary/*.md src/pages/glossary src/components/Footer.astro src/components/Header.astro
git commit -m "feat(content): migrate glossary to content collection with markdown sources"
```

---

## Task 8: Take and integrate the real product screenshot

**Why:** The PWA manifest currently references `/screenshots/family-tree-builder.jpg` which 404s. The SoftwareApplication schema in `index.astro` doesn't reference it explicitly, but a real screenshot makes the install dialog and store listings (if we ever distribute via TWA / iOS PWA) actually compelling.

**Files:**
- Create: `public/screenshots/builder.jpg` (1280×720, real screenshot)
- Modify: `public/manifest.json` (re-add screenshots section)
- Modify: `src/pages/index.astro` (add screenshot to SoftwareApplication schema)

- [ ] **Step 1: Take the screenshot.**

Run `npm run dev`, navigate to `http://localhost:4321/builder`, click Settings → Reset → select "Large Template (50 People)" → Load Template. Wait for the layout to settle, then take a 1280×720 screenshot with the canvas centered.

Save as `public/screenshots/builder.jpg`. Target file size < 200 KB; if larger, run through ImageOptim / `sharp` JPEG quality 80.

- [ ] **Step 2: Update `public/manifest.json`.**

Add back the `screenshots` array (just before the closing brace):

```json
  "screenshots": [
    {
      "src": "/screenshots/builder.jpg",
      "sizes": "1280x720",
      "type": "image/jpeg",
      "form_factor": "wide",
      "label": "Family tree builder with a 50-person sample tree"
    }
  ]
```

- [ ] **Step 3: Update SoftwareApplication schema.**

In `src/pages/index.astro`, find the `softwareSchema` definition and add:

```javascript
"screenshot": "https://mapmyroots.com/screenshots/builder.jpg",
```

- [ ] **Step 4: Build and verify.**

```bash
npm run build
test -f dist/screenshots/builder.jpg && echo OK
```

- [ ] **Step 5: Commit.**

```bash
git add public/screenshots/builder.jpg public/manifest.json src/pages/index.astro
git commit -m "feat(pwa): add real product screenshot to manifest + schema"
```

---

## Task 9: `public/llms.txt`

**Why:** AI search crawlers (ChatGPT, Perplexity, Claude) prefer a concise, content-focused summary of the site. `llms.txt` is the emerging standard ([llmstxt.org](https://llmstxt.org/)). We have nothing to lose by adding one.

**Files:**
- Create: `public/llms.txt`

- [ ] **Step 1: Write `public/llms.txt`.**

Write the following exact content:

```
# MapMyRoots

> MapMyRoots is a free, browser-based family tree builder. Trees are stored locally in the browser (no account, no server). Export to JSON, PNG, or PDF. The product is fully free with no premium tier or subscription.

## Documentation

- [Home page](https://mapmyroots.com/): product overview, key features, FAQ.
- [About](https://mapmyroots.com/about): mission, technology stack, why the product is free.
- [Builder](https://mapmyroots.com/builder): the family tree editor itself (interactive — JS required).
- [Privacy](https://mapmyroots.com/privacy): privacy policy, GDPR/CCPA compliance.
- [Terms](https://mapmyroots.com/terms): terms of service.

## Glossary

The glossary at [/glossary](https://mapmyroots.com/glossary) defines essential genealogy terms. Each term has its own page with a structured `DefinedTerm` schema for AI consumption:

- [Abstract](https://mapmyroots.com/glossary/abstract): abbreviated transcription of a document.
- [Affinity](https://mapmyroots.com/glossary/affinity): relationship by marriage.
- [Ahnentafel](https://mapmyroots.com/glossary/ahnentafel): German "ancestor table" numbering system.
- [Ancestor](https://mapmyroots.com/glossary/ancestor): a person from whom one is descended.
- [Ancestry](https://mapmyroots.com/glossary/ancestry): the line of one's ancestors collectively.
- [Autosomal DNA](https://mapmyroots.com/glossary/autosomal-dna): inherited from both parents, used in genetic genealogy.
- [Banns](https://mapmyroots.com/glossary/banns): public announcement of an upcoming marriage.
- [Birth record](https://mapmyroots.com/glossary/birth-record): official document recording a birth.
- [Brick wall](https://mapmyroots.com/glossary/brick-wall): research term for an ancestor whose origins can't be traced further.
- [Census](https://mapmyroots.com/glossary/census): periodic government enumeration of population.
- [Family tree](https://mapmyroots.com/glossary/family-tree): visual or organized representation of family lineage.
- [Genealogy](https://mapmyroots.com/glossary/genealogy): the study and tracing of family history.

## Localization

The site is available in English (default), German (`/de/`), Spanish (`/es/`), and Russian (`/ru/`). Hreflang annotations on every page link locale variants.

## Out of scope (not yet documented)

The following are mentioned in the FAQ but not currently supported. They are on the roadmap but not yet shipped:

- GEDCOM import: planned for a future release (genealogy interchange format).
- Cloud sync / accounts: explicitly not supported. Data lives on the user's device.
- Photos per person: planned but not yet shipped.

## Optional

- [Sitemap](https://mapmyroots.com/sitemap-index.xml): full URL index for crawlers.
- [Robots](https://mapmyroots.com/robots.txt): crawler rules.
- [Source](https://github.com/h-e-a-d/mapmyroots): open source on GitHub.
```

- [ ] **Step 2: Add a cache rule for llms.txt to `_headers`.**

Find in `public/_headers`:
```
/robots.txt
  Cache-Control: public, max-age=86400
```

Append:
```

/llms.txt
  Cache-Control: public, max-age=86400
```

- [ ] **Step 3: Verify.**

```bash
npm run build
test -f dist/llms.txt && echo OK
head -3 dist/llms.txt
```

- [ ] **Step 4: Commit.**

```bash
git add public/llms.txt public/_headers
git commit -m "feat(seo): add llms.txt for AI search crawler discovery"
```

---

## Task 10: Clean up `public/robots.txt`

**Why:** The current `robots.txt` (155 lines) was bulk-copied from a template. It blocks `/*.json$` (which would 404 the locale files), has a long noisy "block aggressive crawlers" section, and includes deprecated bot blocks. We trim it to essentials.

**Files:**
- Modify: `public/robots.txt`

- [ ] **Step 1: Replace `public/robots.txt` with this concise version:**

```
# robots.txt for MapMyRoots
# https://mapmyroots.com/robots.txt

User-agent: *
Allow: /

# Block common malicious / abusive scrapers
User-agent: SiteSnagger
Disallow: /

User-agent: HTTrack
Disallow: /

User-agent: WebReaper
Disallow: /

User-agent: WebStripper
Disallow: /

User-agent: WebCopier
Disallow: /

User-agent: Offline Explorer
Disallow: /

User-agent: Teleport
Disallow: /

User-agent: TeleportPro
Disallow: /

# Sitemap
Sitemap: https://mapmyroots.com/sitemap-index.xml
```

Removed:
- The `Disallow: /*.json$` rule (blocked legitimate locale fetches).
- All `Crawl-delay` rules (largely ignored by major crawlers).
- The Yandex/Bing/DuckDuckGo per-bot allow rules (default `User-agent: *` already allows them).
- The `Allow: /*.css` etc. rules (default behavior already).
- Obscure bot blocks (WebZip, larbin, MJ12bot — kept the most-cited malicious ones).

- [ ] **Step 2: Test.**

```bash
npm run build
diff <(grep -c "User-agent" public/robots.txt) <(echo "10")
```
Expected: matches (10 User-agent lines in the trimmed version).

- [ ] **Step 3: Commit.**

```bash
git add public/robots.txt
git commit -m "chore(seo): trim robots.txt to essentials, remove json block"
```

---

## Task 11: Schema validation pass

**Why:** With locale routes, glossary pages, OG images, and sitemap changes, every JSON-LD block emitted by the site should be re-validated. Google's Rich Results Test ([search.google.com/test/rich-results](https://search.google.com/test/rich-results)) is the authoritative tool. We don't automate this — it's a manual pass, documented as a checklist.

**Files:** None modified — this is a runtime verification task.

- [ ] **Step 1: Build and start preview.**

```bash
npm run build
npx astro preview --port 4321 &
PREVIEW_PID=$!
sleep 3
```

- [ ] **Step 2: Validate each page's structured data.**

For each URL below, paste the URL into Google's Rich Results Test (or use `curl ${URL} | head -200` to inspect the JSON-LD):

| URL | Expected schemas |
|-----|------------------|
| `/` | SoftwareApplication, Organization, FAQPage, HowTo, BreadcrumbList |
| `/about` | Organization, BreadcrumbList |
| `/contact` | BreadcrumbList |
| `/builder` | (none — that's fine; builder is an app) |
| `/privacy` | (none) |
| `/terms` | (none) |
| `/glossary` | DefinedTermSet, BreadcrumbList |
| `/glossary/abstract` | DefinedTerm, BreadcrumbList |
| `/de/`, `/es/`, `/ru/` | Same schemas as `/`, with localized `name`/`description` if present |

Open each URL in a browser, run the validator, confirm zero errors and zero warnings (or document warnings that are acceptable, e.g., missing optional fields like `aggregateRating`).

- [ ] **Step 3: Verify hreflang.**

```bash
curl -s http://localhost:4321/de/ | grep "rel=\"alternate\""
curl -s http://localhost:4321/de/about | grep "rel=\"alternate\""
```
Expected: 5 alternate links per page (en, de, es, ru, x-default).

- [ ] **Step 4: Verify sitemap.**

```bash
curl -s http://localhost:4321/sitemap-index.xml
curl -s http://localhost:4321/sitemap-0.xml | head -40
```
Expected: sitemap-index points at sitemap-0; sitemap-0 lists all pages including localized variants. Each `<url>` block has `xhtml:link rel="alternate"` entries.

- [ ] **Step 5: Stop preview and commit any fixes from the audit.**

```bash
kill $PREVIEW_PID
```

If the audit found schema errors, fix them in the relevant page's frontmatter and commit:

```bash
git add src/pages/...
git commit -m "fix(seo): correct JSON-LD validation issues found in audit"
```

If no fixes needed, no commit — Task 11 is just a verification gate.

---

## Task 12: Final verification

- [ ] **Step 1: Working tree clean.**

```bash
git status
```
Expected: `nothing to commit, working tree clean`.

- [ ] **Step 2: Build is reproducible.**

```bash
rm -rf dist/ .astro/
npm run build
```
Expected: completes without error.

- [ ] **Step 3: All target files exist.**

```bash
test -f dist/de/index.html && echo "de OK"
test -f dist/es/index.html && echo "es OK"
test -f dist/ru/index.html && echo "ru OK"
test -f dist/glossary/index.html && echo "glossary OK"
test -f dist/glossary/abstract/index.html && echo "glossary entry OK"
test -f dist/og/home.png && echo "og OK"
test -f dist/icon-192.png && echo "icon OK"
test -f dist/manifest.json && echo "manifest OK"
test -f dist/llms.txt && echo "llms OK"
test -f dist/sitemap-index.xml && echo "sitemap OK"
```
Expected: 10 `OK` lines.

- [ ] **Step 4: GTM is still gone.**

```bash
grep -rn "GTM-\|googletagmanager" src/ public/ --include="*.astro" --include="*.html" --include="*.js" 2>/dev/null | grep -v glossary.html
```
Expected: zero matches (the legacy `glossary.html` is now obsolete and could be deleted in a follow-up; for Phase 3 we leave it as a fallback for any in-flight bookmarks).

- [ ] **Step 5: Page count.**

```bash
find dist -name "index.html" | wc -l
```
Expected: ≥ 22 — 6 root pages × 1 EN + 3 marketing × 3 locales + 1 glossary index + 12 glossary entries = ~28.

- [ ] **Step 6: Commit count.**

```bash
git log --oneline feat/seo-infrastructure ^chore/cloudflare-pages-config 2>/dev/null | wc -l
```
Expected: roughly 11–14 commits.

- [ ] **Step 7: Push the branch (optional).**

```bash
git push -u origin feat/seo-infrastructure
```

---

## Phase 3 complete

The site now serves real prerendered HTML for `/`, `/de/`, `/es/`, `/ru/` with proper hreflang. OG/Twitter previews work. Real PWA icons. The glossary is in markdown content collections. AI crawlers have an `llms.txt` to consume.

Next step: write `docs/superpowers/plans/YYYY-MM-DD-phase-4-pwa-and-perf.md`.

---

## Self-review

**1. Spec coverage** vs. roadmap Phase 3:
- [x] Astro i18n config — Task 1
- [x] Translate top-level pages (index, about, contact for de/es/ru) — Task 4
- [x] Update SEO.astro for hreflang — Task 3
- [x] Auto-generated sitemap with locale variants — Task 1 Step 1 (sitemap i18n config)
- [x] Generate real OG/Twitter images — Task 5
- [x] Generate PWA icon set — Task 6
- [x] Update manifest.json — Task 6 Step 5
- [x] Real product screenshot — Task 8
- [x] Migrate glossary to content collection — Task 7
- [x] llms.txt — Task 9
- [x] robots.txt cleanup — Task 10
- [x] Schema audit pass — Task 11

**2. Placeholders.** Two real placeholders the executor must resolve manually:
- `public/icon.svg` source — Task 6 Step 1 says "decide before this task starts" and offers two paths. Cannot ship without a real SVG.
- `public/screenshots/builder.jpg` — Task 8 Step 1 requires a manual screenshot.

These are explicit and called out in the "Information you need before starting" section.

**3. Type/path consistency.** All locale codes (`en`, `de`, `es`, `ru`) used consistently. Glossary slug convention (dashes, not underscores) called out in Task 7 Step 2. `localizedPath` helper centralizes path-with-locale logic so paths can't drift.

**4. Sequencing.**
- Task 1 (i18n config) and Task 2 (translation helper) both need to land before Task 4 (locale pages reference both).
- Task 3 (SEO hreflang) needs Task 1 (i18n locales registered) but NOT Task 4 (the alternate URLs render even before pages exist; they 404 until Task 4 fills them in).
- Task 5 (OG images) is independent — can run in parallel with Tasks 2–4.
- Task 6 (icons) is independent.
- Task 7 (glossary) only depends on Phase 1's content collection scaffolding.
- Task 8 (screenshot) depends on Task 6 (manifest path is right) but can run earlier if the screenshot exists.
- Task 9 (llms.txt) depends on Task 7 (glossary URLs referenced).
- Task 10 (robots.txt) is independent.
- Task 11 (schema audit) depends on everything before it.

The plan order respects this — feel free to parallelize Tasks 5/6 with 1/2/3/4 if working with subagents.

# MapMyRoots

> Free online family tree builder and genealogy software. Build interactive, drag-and-drop family trees in your browser. Your data stays on your device.

**Live site:** [mapmyroots.com](https://mapmyroots.com)

![MapMyRoots screenshot](public/assets/images/tree.webp)

## Features

- **Interactive canvas builder** — drag-and-drop family tree with pan, zoom, and multi-select
- **Rich person profiles** — names, dates, places, photos, custom notes
- **Multiple views** — graphic canvas + sortable table, switch any time
- **Multi-format export and import** — PNG, JPEG, SVG, PDF, JSON, GEDCOM (import + export)
- **Share by link** — compressed read-only link to your tree, no account needed
- **Auto-save** — your tree persists locally in IndexedDB; tree data never leaves your device
- **Internationalization** — English, Spanish, Russian, German (static pages are pre-rendered per locale)
- **Search** — instant filter across all family members
- **Undo / redo** — full state history
- **Accessibility** — keyboard navigation, screen reader support, WCAG-aligned
- **Responsive** — works on desktop, tablet, and mobile

## Quick start

```bash
npm install
npm run dev       # http://localhost:4321
```

`npm run build` produces a static `dist/` for Cloudflare Pages. `npm run preview` serves the build locally.

## Tech stack

- Astro 5 (Vite-based) on Cloudflare Pages
- HTML5, CSS3, vanilla JavaScript (ES modules)
- Canvas API for rendering; IndexedDB for persistence
- `@vite-pwa/astro` for installable PWA + offline support
- `parse-gedcom` for GEDCOM import; `pdfjs-dist` for document attachments
- Vitest (unit) + Playwright (e2e) for tests

## Project structure

```
.
├── astro.config.mjs                             # Astro + sitemap + PWA config
├── tree.js                                      # Builder app entry (imported by builder.astro)
├── src/
│   ├── pages/                                   # Astro routes — index, about, contact, privacy, terms, builder, view, glossary, og/; de/, es/, ru/ wrappers
│   ├── layouts/                                 # BaseLayout, BuilderLayout
│   ├── components/                              # SEO, Header, Footer, GoogleTagManager (Astro)
│   ├── content/                                 # Astro content collections (glossary)
│   ├── i18n/                                    # Build-time translation helpers
│   ├── styles/                                  # global.css, homepage.css, modal.css
│   ├── core/                                    # Tree engine (TreeCoreCanvas) and canvas renderer
│   ├── ui/                                      # Builder page scripts (ui/builder), runtime components, modals
│   ├── features/                                # Export, import (GEDCOM), search, i18n, accessibility, photos, share, tree-chart
│   ├── data/                                    # Cache/autosave, undo/redo, IndexedDB repository, migrations
│   ├── shapes/                                  # Visual layout strategies
│   ├── utils/                                   # Event bus, security, error handling
│   ├── analytics/                               # EventBus → GTM dataLayer (GA4) integration
│   └── config/                                  # Feature flags + constants
├── public/                                      # Static files served verbatim (fonts, icons, _headers, _redirects, manifest)
├── tests/unit/                                  # Vitest unit tests
├── testing/tests/                               # Playwright e2e tests
└── docs/                                        # Architecture, roadmap, changelog, per-feature plans
```


## Testing

```bash
npm install
npm test                # Vitest unit tests (watch mode; add -- --run for a single pass)
npm run test:ui         # Vitest with UI
npm run test:coverage   # Coverage report
npm run check           # astro check (types)
```

End-to-end tests (Playwright) default to the **live site** (`https://mapmyroots.com`). To test your local changes, build and point them at a local preview:

```bash
npm run build
npx astro preview --port 4321 &
PLAYWRIGHT_BASE_URL=http://localhost:4321 npm run test:e2e
```

Unit tests include guards for cross-cutting rules: translation keys exist in all four locales, no dynamic `innerHTML`, and a single CSP without third-party CDNs.

## Deployment

Pushes to `main` deploy to Cloudflare Pages (`npm run build` → `dist/`). Security headers and redirects live in `public/_headers` and `public/_redirects`. See [`docs/CLOUDFLARE_PAGES_SETUP.md`](docs/CLOUDFLARE_PAGES_SETUP.md).

## Analytics and privacy

Family tree data stays in the browser. The site loads Google Tag Manager (`GTM-MNZ4MJB7` → GA4) and Cloudflare Web Analytics for anonymous usage statistics; builder events record that an action happened, never tree content. See [`src/analytics/README.md`](src/analytics/README.md) and the [privacy policy](https://mapmyroots.com/privacy). There is no cookie-consent banner yet.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — conventions and workflows (for people and AI agents)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the code fits together, known debt
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — phases and status
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — per-feature implementation plans

## Browser support

Chrome 80+, Firefox 75+, Safari 13+, Edge 80+. Mobile Safari 13+ and Chrome Mobile 80+. Older browsers degrade gracefully.

## Contributing

Issues and pull requests are welcome. For agent-assisted contributions, see [`CLAUDE.md`](CLAUDE.md) for the conventions this codebase uses.

## License

MIT — see [`LICENSE`](LICENSE) (or the `license` field in `package.json` until the file is added).

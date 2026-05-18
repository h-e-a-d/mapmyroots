# MapMyRoots

> Free online family tree builder and genealogy software. Build interactive, drag-and-drop family trees in your browser. Your data stays on your device.

**Live site:** [mapmyroots.com](https://mapmyroots.com)

![MapMyRoots screenshot](assets/images/tree.webp)

## Features

- **Interactive canvas builder** — drag-and-drop family tree with pan, zoom, and multi-select
- **Rich person profiles** — names, dates, places, photos, custom notes
- **Multiple views** — graphic canvas + sortable table, switch any time
- **Multi-format export and import** — PNG, SVG, PDF, GEDCOM (import + export)
- **Auto-save** — your tree persists locally; nothing leaves your device
- **Internationalization** — English, Spanish, Russian, German
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
│   ├── pages/                                   # Astro routes — index, about, builder, view, glossary, de/, es/, ru/
│   ├── layouts/                                 # BaseLayout, BuilderLayout
│   ├── components/                              # SEO, Header, Footer, FAQ, HowItWorks (Astro)
│   ├── content/                                 # Astro content collections (glossary)
│   ├── i18n/                                    # Build-time translation helpers
│   ├── styles/                                  # global.css, homepage.css, modal.css
│   ├── core/                                    # Tree engine, canvas renderer, commands, spatial index
│   ├── ui/                                      # Runtime components, modals
│   ├── features/                                # Export, import (GEDCOM), search, i18n, accessibility, photos, share, tree-chart
│   ├── data/                                    # Repositories (IndexedDB) + migrations
│   ├── shapes/                                  # Visual layout strategies
│   ├── utils/                                   # Event bus, security, error handling
│   ├── analytics/                               # Cloudflare Web Analytics integration
│   └── config/                                  # Feature flags + constants
├── public/                                      # Static files served verbatim (fonts, icons, _headers, _redirects, manifest)
├── tests/unit/                                  # Vitest unit tests
├── testing/tests/                               # Playwright e2e tests
└── docs/                                        # Architecture, roadmap, changelog, per-feature plans
```

For deeper architecture detail, see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Testing

```bash
npm install
npm test                # Vitest unit tests
npm run test:ui         # Vitest with UI
npm run test:coverage   # Coverage report
npm run test:e2e        # Playwright end-to-end
```

## Browser support

Chrome 80+, Firefox 75+, Safari 13+, Edge 80+. Mobile Safari 13+ and Chrome Mobile 80+. Older browsers degrade gracefully.

## Contributing

Issues and pull requests are welcome. For agent-assisted contributions, see [`CLAUDE.md`](CLAUDE.md) for the conventions this codebase uses.

## License

MIT — see [`LICENSE`](LICENSE) (or the `license` field in `package.json` until the file is added).

# MapMyRoots

> Free online family tree builder and genealogy software. Build interactive, drag-and-drop family trees in your browser. Your data stays on your device.

**Live site:** [mapmyroots.com](https://mapmyroots.com)

![MapMyRoots screenshot](assets/images/tree.webp)

## Features

- **Interactive canvas builder** — drag-and-drop family tree with pan, zoom, and multi-select
- **Rich person profiles** — names, dates, places, photos, custom notes
- **Multiple views** — graphic canvas + sortable table, switch any time
- **Multi-format export** — PNG, SVG, PDF, GEDCOM (export only; import on roadmap)
- **Auto-save** — your tree persists locally; nothing leaves your device
- **Internationalization** — English, Spanish, Russian, German
- **Search** — instant filter across all family members
- **Undo / redo** — full state history
- **Accessibility** — keyboard navigation, screen reader support, WCAG-aligned
- **Responsive** — works on desktop, tablet, and mobile

## Quick start

The site is currently a vanilla static site. Any HTTP server will do:

```bash
# Python (built-in)
python3 -m http.server 8000

# Node
npx serve .
```

Then open http://localhost:8000 in a modern browser.

> **Migration in progress:** the site is being rebuilt on Astro + Cloudflare Pages. See [`docs/ROADMAP.md`](docs/ROADMAP.md) for the plan. Once Phase 1 lands, `npm run dev` will replace the commands above.

## Tech stack

- HTML5, CSS3, vanilla JavaScript (ES modules)
- Canvas API for rendering
- LocalStorage / IndexedDB for persistence
- Vitest (unit) + Playwright (e2e) for tests
- Hosted on Cloudflare Pages

## Project structure

```
.
├── index.html, about.html, contact.html, ...   # Marketing pages
├── builder.html                                 # Family tree builder app
├── tree.js                                      # App entry point
├── src/
│   ├── core/                                    # Tree engine, canvas renderer, commands, spatial index
│   ├── ui/                                      # Components, modals, styles
│   ├── features/                                # Export, search, i18n, accessibility
│   ├── data/                                    # Cache, repositories (localStorage + IndexedDB)
│   ├── shapes/                                  # Visual layout strategies
│   ├── utils/                                   # Event bus, security, error handling
│   ├── analytics/                               # Analytics service + integration
│   └── config/                                  # Feature flags + constants
├── assets/
│   ├── fonts/                                   # Self-hosted Inter + Playfair
│   ├── images/
│   ├── locales/                                 # Translation JSON
│   └── glossary/                                # Genealogy glossary
├── public/                                      # Static files served as-is
└── docs/                                        # Architecture, roadmap, changelog
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

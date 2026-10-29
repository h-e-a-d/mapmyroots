import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const read = (p) => readFileSync(resolve(root, p), 'utf8');

const classesIn = (source) =>
  new Set([...source.matchAll(/\bclass="([^"{}]+)"/g)].flatMap((m) => m[1].split(/\s+/).filter(Boolean)));

const scopedStyles = (source) => [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');

const hasRule = (css, cls) => new RegExp(`\\.${cls.replace(/[-]/g, '\\-')}(?![\\w-])`).test(css);

// Stylesheets every BaseLayout page loads (BaseLayout imports global.css and site.css).
const layoutCss = read('src/styles/global.css') + read('src/styles/site.css');

// Classes that are only JS hooks or wrappers and intentionally carry no styles.
const UNSTYLED = new Set(['stat-item']);

const missing = (markupFile, css) =>
  [...classesIn(read(markupFile))].filter((cls) => !UNSTYLED.has(cls) && !hasRule(css, cls));

describe('static page styles', () => {
  // The header CSS once lived only in homepage.css, so every other page rendered it unstyled.
  it('styles every Header class from stylesheets BaseLayout loads', () => {
    const header = read('src/components/Header.astro');
    expect(missing('src/components/Header.astro', layoutCss + scopedStyles(header))).toEqual([]);
  });

  it('does not rely on homepage.css for shared chrome', () => {
    const homepage = read('src/styles/homepage.css');
    for (const cls of ['header', 'nav', 'nav-link', 'mobile-menu', 'skip-link', 'btn-primary {']) {
      expect(homepage).not.toMatch(new RegExp(`^\\.${cls}`, 'm'));
    }
  });

  for (const page of ['about', 'contact', 'privacy', 'terms']) {
    it(`styles every class on /${page}`, () => {
      const file = `src/pages/${page}.astro`;
      expect(read(file)).toContain("import '@/styles/content-pages.css'");
      expect(missing(file, layoutCss + read('src/styles/content-pages.css'))).toEqual([]);
    });
  }
});

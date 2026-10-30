import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sitemapFilter, LOCALIZED_PAGES } from '../../src/config/sitemap-filter.mjs';

const site = 'https://mapmyroots.com';

describe('sitemapFilter', () => {
  it('keeps English pages and real localized pages', () => {
    for (const path of ['/', '/builder/', '/glossary/', '/glossary/abstract/', '/de/', '/es/about/', '/ru/terms/']) {
      expect(sitemapFilter(site + path), path).toBe(true);
    }
  });

  it('drops i18n fallback redirects (Astro 7 passes them to the sitemap)', () => {
    for (const path of ['/de/builder/', '/es/glossary/', '/ru/glossary/abstract/']) {
      expect(sitemapFilter(site + path), path).toBe(false);
    }
  });

  it('drops /offline and /view', () => {
    expect(sitemapFilter(`${site}/offline/`)).toBe(false);
    expect(sitemapFilter(`${site}/view/`)).toBe(false);
  });

  it('lists exactly the pages that have localized routes', () => {
    const pages = readdirSync(resolve(__dirname, '../../src/pages/de'))
      .map((f) => f.replace(/\.astro$/, ''))
      .map((name) => (name === 'index' ? '' : name));
    expect(new Set(pages)).toEqual(LOCALIZED_PAGES);
  });
});

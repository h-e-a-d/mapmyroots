// Pages that exist in every locale (src/pages/<locale>/*.astro). Any other /de/, /es/ or /ru/
// URL is an i18n fallback redirect to the English page (noindex), and must stay out of the
// sitemap. Astro 7 passes those fallback pages to the sitemap integration; Astro 5 did not.
export const LOCALIZED_PAGES = new Set(['', 'about', 'contact', 'privacy', 'terms']);
const LOCALE_PREFIX = /^\/(de|es|ru)(?:\/|$)/;

export function sitemapFilter(page) {
  const path = new URL(page).pathname;
  if (path.startsWith('/offline') || path.startsWith('/view')) return false;
  const match = path.match(LOCALE_PREFIX);
  if (!match) return true;
  const rest = path.slice(match[0].length).replace(/\/$/, '');
  return LOCALIZED_PAGES.has(rest);
}

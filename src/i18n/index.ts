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
 * itself (visible breadcrumb so the bug is obvious).
 */
export function t(locale: Locale, key: string): string {
  const get = (dict: any) => key.split('.').reduce((acc: any, part: string) => acc?.[part], dict);
  const value = get(dictionaries[locale]);
  if (typeof value === 'string') return value;
  const fallback = get(dictionaries.en);
  if (typeof fallback === 'string') {
    if (import.meta.env.DEV) console.warn(`[i18n] Missing key "${key}" for locale "${locale}", falling back to en`);
    return fallback;
  }
  return key;
}

/**
 * Build the canonical path for a page in a given locale.
 * localizedPath('en', '/about') → '/about', localizedPath('de', '/about') → '/de/about'.
 */
export function localizedPath(locale: Locale, path: string): string {
  if (locale === defaultLocale) return path;
  return `/${locale}${path === '/' ? '' : path}`;
}

/**
 * Returns the locale from a URL path segment.
 */
export function detectLocale(url: URL): Locale {
  const segment = url.pathname.split('/').filter(Boolean)[0];
  if ((locales as string[]).includes(segment)) return segment as Locale;
  return defaultLocale;
}

/**
 * Returns the path with the locale prefix stripped.
 */
export function pathWithoutLocale(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length > 0 && (locales as string[]).includes(parts[0])) {
    parts.shift();
  }
  return '/' + parts.join('/');
}

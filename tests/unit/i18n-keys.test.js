import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const localeDir = join(root, 'public/assets/locales');
const locales = ['en', 'es', 'ru', 'de'];
const dict = Object.fromEntries(
  locales.map((l) => [l, JSON.parse(readFileSync(join(localeDir, `${l}.json`), 'utf8'))])
);

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  );
const lookup = (obj, key) => key.split('.').reduce((o, p) => o?.[p], obj);

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const sources = walk(join(root, 'src'))
  .filter((p) => /\.(astro|js|ts)$/.test(p))
  .map((p) => ({ path: p.slice(root.length + 1), text: readFileSync(p, 'utf8') }));

// Only literal keys; template-built keys (e.g. `languages.${code}`) can't be checked statically.
const collect = (pattern) =>
  sources.flatMap(({ path, text }) =>
    [...text.matchAll(pattern)].map((m) => ({ path, key: m[1] })).filter(({ key }) => !key.includes('$'))
  );

describe('locale files', () => {
  it('all locales define the same keys as en', () => {
    const enKeys = flatten(dict.en).sort();
    for (const l of locales.slice(1)) {
      expect(flatten(dict[l]).sort(), `${l}.json`).toEqual(enKeys);
    }
  });
});

describe('translation keys used in src/', () => {
  it('every data-i18n* attribute key exists in en.json', () => {
    const missing = collect(/data-i18n(?:-[a-z]+)?="([^"]+)"/g).filter(({ key }) => lookup(dict.en, key) === undefined);
    expect(missing).toEqual([]);
  });

  it("every build-time t(locale, '...') key exists in en.json", () => {
    const missing = collect(/\bt\(\s*locale\s*,\s*'([^']+)'/g).filter(({ key }) => typeof lookup(dict.en, key) !== 'string');
    expect(missing).toEqual([]);
  });
});

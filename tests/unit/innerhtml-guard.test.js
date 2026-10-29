import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// CLAUDE.md: never assign dynamic values to innerHTML; use SecurityUtils or
// build DOM nodes with textContent. Constant markup (a string literal or a
// template literal without ${...}) is allowed.
const ALLOWED = [
  // DOMPurify-sanitized sinks.
  'src/utils/security-utils.js: element.innerHTML = sanitized;',
  // Icons come from a fixed map of static SVG strings keyed by notification type.
  'src/ui/components/notifications.js: icon.innerHTML = this.getIcon(type);',
  "src/ui/components/notifications.js: iconEl.innerHTML = this.getIcon(type || 'info');"
];

const root = resolve(__dirname, '../..');
const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

function findDynamicInnerHTML() {
  const hits = [];
  for (const file of walk(join(root, 'src')).filter((p) => /\.(js|ts|astro)$/.test(p))) {
    const rel = file.slice(root.length + 1);
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\.(?:innerHTML|outerHTML)\s*\+?=\s*/g)) {
      const rest = text.slice(m.index + m[0].length);
      const quote = rest[0];
      if (quote === "'" || quote === '"') continue;
      if (quote === '`') {
        const end = rest.indexOf('`', 1);
        if (end !== -1 && !rest.slice(1, end).includes('${')) continue;
      }
      const lineStart = text.lastIndexOf('\n', m.index) + 1;
      const lineEnd = text.indexOf('\n', m.index);
      hits.push(`${rel}: ${text.slice(lineStart, lineEnd).trim()}`);
    }
  }
  return hits;
}

describe('innerHTML guard', () => {
  it('only allow-listed sinks assign dynamic values to innerHTML', () => {
    const unexpected = findDynamicInnerHTML().filter((hit) => !ALLOWED.includes(hit));
    expect(unexpected).toEqual([]);
  });

  it('allow-list has no stale entries', () => {
    const hits = new Set(findDynamicInnerHTML());
    expect(ALLOWED.filter((entry) => !hits.has(entry))).toEqual([]);
  });
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const headers = readFileSync(resolve(__dirname, '../../public/_headers'), 'utf8');
const cspLines = headers.split('\n').filter((l) => /^\s*Content-Security-Policy:/i.test(l));

describe('public/_headers CSP', () => {
  // Cloudflare Pages merges every matching rule, and browsers enforce each CSP
  // header independently, so a second path-specific policy can only tighten it.
  it('defines exactly one Content-Security-Policy', () => {
    expect(cspLines).toHaveLength(1);
  });

  it('does not allow third-party script CDNs', () => {
    expect(cspLines[0]).not.toMatch(/cdnjs|jsdelivr|unpkg/);
  });
});

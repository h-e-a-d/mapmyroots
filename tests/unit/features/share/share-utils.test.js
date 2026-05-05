import { describe, it, expect } from 'vitest';
import { buildShareUrl, MAX_URL_BYTES } from '../../../../src/features/share/share-utils.js';

describe('share-utils', () => {
  it('buildShareUrl returns a full URL with ?d= param', () => {
    const url = buildShareUrl('https://mapmyroots.com', 'encoded123');
    expect(url).toBe('https://mapmyroots.com/view?d=encoded123');
  });

  it('MAX_URL_BYTES is defined and reasonable (>= 4096)', () => {
    expect(MAX_URL_BYTES).toBeGreaterThanOrEqual(4096);
  });
});

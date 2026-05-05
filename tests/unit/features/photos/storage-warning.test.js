import { describe, it, expect } from 'vitest';
import { shouldWarnAboutStorage } from '../../../../src/features/photos/photo-utils.js';

describe('shouldWarnAboutStorage', () => {
  it('returns true when usage/quota ratio is above 80% (90%)', () => {
    expect(shouldWarnAboutStorage({ usage: 4_500_000, quota: 5_000_000 })).toBe(true);
  });

  it('returns false when usage/quota ratio is below 80% (60%)', () => {
    expect(shouldWarnAboutStorage({ usage: 3_000_000, quota: 5_000_000 })).toBe(false);
  });

  it('returns false when quota is zero (guard for zero quota)', () => {
    expect(shouldWarnAboutStorage({ usage: 0, quota: 0 })).toBe(false);
  });
});

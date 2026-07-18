// cache-manager-dirty.test.js — periodic autosave must be a no-op while the tree is clean.

import { describe, it, expect, vi } from 'vitest';
import { CacheManager } from '../../src/data/cache/core-cache.js';

function makeTreeCore() {
  return {
    getCurrentState: vi.fn(() => ({ version: '2.1.0', persons: [] })),
    getCompressedState: vi.fn(() => ({ version: '2.1.0', persons: [] })),
    cleanOldBackups: vi.fn(),
    enhancedCacheIndicator: null
  };
}

describe('CacheManager dirty flag', () => {
  it('skips autosave while clean', () => {
    const tc = makeTreeCore();
    const cm = new CacheManager(tc);
    cm.autoSave();
    expect(tc.getCurrentState).not.toHaveBeenCalled();
  });

  it('saves once after markDirty, then returns to clean', () => {
    const tc = makeTreeCore();
    const cm = new CacheManager(tc);
    cm.markDirty();
    cm.autoSave();
    expect(tc.getCurrentState).toHaveBeenCalledTimes(1);
    cm.autoSave(); // clean again — no second serialization
    expect(tc.getCurrentState).toHaveBeenCalledTimes(1);
  });
});

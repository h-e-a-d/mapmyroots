// empty-state.test.js — onboarding overlay shows only while the tree is empty.

import { describe, it, expect, beforeEach } from 'vitest';
import { syncEmptyState } from '../../src/ui/components/empty-state.js';

describe('syncEmptyState', () => {
  beforeEach(() => {
    document.body.textContent = '';
  });

  it('shows the overlay when the tree is empty', () => {
    const el = document.createElement('div');
    el.id = 'emptyState';
    el.classList.add('hidden');
    document.body.appendChild(el);
    syncEmptyState(0);
    expect(el.classList.contains('hidden')).toBe(false);
  });

  it('hides the overlay when people exist', () => {
    const el = document.createElement('div');
    el.id = 'emptyState';
    document.body.appendChild(el);
    syncEmptyState(3);
    expect(el.classList.contains('hidden')).toBe(true);
  });

  it('does not throw when the element is missing', () => {
    expect(() => syncEmptyState(0)).not.toThrow();
  });
});

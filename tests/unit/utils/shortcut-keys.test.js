import { describe, it, expect } from 'vitest';
import { shortcutLetter } from '../../../src/utils/shortcut-keys.js';

describe('shortcutLetter', () => {
  it('returns the typed letter, case-insensitively', () => {
    expect(shortcutLetter({ key: 'P', code: 'KeyP' })).toBe('p');
    expect(shortcutLetter({ key: 'p', code: 'KeyP' })).toBe('p');
  });

  it('falls back to the physical key on non-Latin layouts', () => {
    expect(shortcutLetter({ key: 'З', code: 'KeyP' })).toBe('p'); // Russian ЙЦУКЕН
    expect(shortcutLetter({ key: 'П', code: 'KeyG' })).toBe('g');
  });

  it('keeps the typed letter on Latin layouts where keys move (AZERTY)', () => {
    expect(shortcutLetter({ key: 'a', code: 'KeyQ' })).toBe('a');
  });

  it('returns null for non-letter keys', () => {
    expect(shortcutLetter({ key: '/', code: 'Slash' })).toBeNull();
    expect(shortcutLetter({ key: 'Shift', code: 'ShiftLeft' })).toBeNull();
    expect(shortcutLetter({ key: 'Unidentified' })).toBeNull();
  });
});

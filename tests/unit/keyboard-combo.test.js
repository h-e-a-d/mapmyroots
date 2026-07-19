// keyboard-combo.test.js — Cmd (metaKey) must act as the primary modifier on macOS.

import { describe, it, expect } from 'vitest';
import { comboFromEvent } from '../../src/features/accessibility/accessibility.js';
import { KEYBOARD_SHORTCUTS } from '../../src/config/config.js';

const matches = (combo, shortcut) =>
  combo.key === shortcut.key &&
  !!combo.ctrl === !!shortcut.ctrl &&
  !!combo.shift === !!shortcut.shift &&
  !!combo.alt === !!shortcut.alt;

describe('comboFromEvent', () => {
  it('maps Ctrl+Z to the UNDO shortcut', () => {
    const combo = comboFromEvent({ key: 'z', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false });
    expect(matches(combo, KEYBOARD_SHORTCUTS.UNDO)).toBe(true);
  });

  it('maps Cmd+Z (macOS) to the UNDO shortcut', () => {
    const combo = comboFromEvent({ key: 'z', ctrlKey: false, metaKey: true, shiftKey: false, altKey: false });
    expect(matches(combo, KEYBOARD_SHORTCUTS.UNDO)).toBe(true);
  });

  it('does not treat a bare keypress as modified', () => {
    const combo = comboFromEvent({ key: 'z', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false });
    expect(matches(combo, KEYBOARD_SHORTCUTS.UNDO)).toBe(false);
  });
});

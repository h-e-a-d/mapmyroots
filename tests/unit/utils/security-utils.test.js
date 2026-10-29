import { describe, it, expect } from 'vitest';
import { SecurityUtils } from '../../../src/utils/security-utils.js';

describe('SecurityUtils.setTextContent', () => {
  it('shows text exactly as given, including quotes and ampersands', () => {
    const el = document.createElement('span');
    SecurityUtils.setTextContent(el, "O'Brien & Sons \"Ltd\"");
    expect(el.textContent).toBe("O'Brien & Sons \"Ltd\"");
  });

  it('never creates elements from markup', () => {
    const el = document.createElement('span');
    SecurityUtils.setTextContent(el, '<img src=x onerror="alert(1)">');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror="alert(1)">');
  });

  it('clears the element for null/undefined and ignores a missing element', () => {
    const el = document.createElement('span');
    el.textContent = 'old';
    SecurityUtils.setTextContent(el, null);
    expect(el.textContent).toBe('');
    expect(() => SecurityUtils.setTextContent(null, 'x')).not.toThrow();
  });
});

describe('SecurityUtils.createElement', () => {
  it('keeps data- attribute values verbatim', () => {
    const el = SecurityUtils.createElement('div', { 'data-name': 'A & B' }, "Tom's");
    expect(el.getAttribute('data-name')).toBe('A & B');
    expect(el.textContent).toBe("Tom's");
  });
});

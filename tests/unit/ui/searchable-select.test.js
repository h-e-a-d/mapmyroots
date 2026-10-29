import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { updateSearchableSelects } from '../../../src/ui/components/searchableSelect.js';

const XSS_NAME = '<img src=x onerror="window.__xss=1">';

function mountTree(people) {
  window.treeCore = {
    renderer: { nodes: new Map(people.map((p) => [p.id, p])) },
    getPersonData: () => ({})
  };
}

describe('updateSearchableSelects', () => {
  beforeEach(() => {
    document.body.replaceChildren();
    for (const id of ['motherSelect', 'fatherSelect', 'spouseSelect']) {
      const el = document.createElement('div');
      el.id = id;
      document.body.appendChild(el);
    }
  });
  afterEach(() => {
    delete window.treeCore;
  });

  it('lists matching people with the current selection marked', () => {
    mountTree([
      { id: 'm1', name: 'Maria', surname: 'Lopez', maidenName: 'Diaz', gender: 'female' },
      { id: 'f1', name: 'Juan', surname: 'Lopez', gender: 'male' }
    ]);
    updateSearchableSelects({ motherId: 'm1' });

    const options = [...document.querySelectorAll('#motherSelect .select-option')];
    expect(options.map((o) => o.textContent)).toEqual(['None', 'Maria Lopez (Diaz)']);
    expect(options[1].dataset.id).toBe('m1');
    expect(options[1].hasAttribute('selected')).toBe(true);
    expect(options[0].hasAttribute('selected')).toBe(false);
  });

  it('shows only the None option for an empty tree', () => {
    mountTree([]);
    updateSearchableSelects();
    const options = document.querySelectorAll('#fatherSelect .select-option');
    expect([...options].map((o) => o.textContent)).toEqual(['None']);
  });

  it('never parses person names as HTML', () => {
    mountTree([{ id: 'x1', name: XSS_NAME, gender: 'female' }]);
    updateSearchableSelects();
    expect(document.querySelector('#motherSelect img')).toBeNull();
    const option = document.querySelector('#motherSelect .select-option[data-id="x1"]');
    expect(option.textContent).toBe(XSS_NAME);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../../src/ui/components/notifications.js', () => ({ notifications: { error: vi.fn() } }));
const { familyTreeSearch } = await import('../../../../src/features/search/search.js');

const XSS_NAME = '<img src=x onerror="window.__xss=1">';

describe('FamilyTreeSearch suggestions', () => {
  beforeEach(() => {
    familyTreeSearch.searchField = Object.assign(document.createElement('input'), { value: '' });
    familyTreeSearch.suggestions = document.createElement('div');
    familyTreeSearch.selectedIndex = 0;
  });

  it('renders names with the query highlighted', () => {
    familyTreeSearch.searchField.value = 'ann';
    familyTreeSearch.currentSuggestions = [
      { id: 'p1', node: { name: 'Anna', surname: 'Hannover' }, personData: { birth: { date: { year: 1900 } } } }
    ];
    familyTreeSearch.showSuggestions();

    const item = familyTreeSearch.suggestions.querySelector('.search-suggestion');
    expect(item.dataset.personId).toBe('p1');
    expect(item.classList.contains('selected')).toBe(true);
    expect(item.querySelector('.suggestion-name').textContent).toBe('Anna Hannover');
    expect([...item.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['Ann', 'ann']);
    expect(item.querySelector('.suggestion-details').textContent).toBe('Born: 1900');
  });

  it('treats regex metacharacters in the query literally', () => {
    familyTreeSearch.searchField.value = '(';
    expect(() => familyTreeSearch.highlightMatch('Smith (Jones)')).not.toThrow();
    const frag = familyTreeSearch.highlightMatch('Smith (Jones)');
    expect(frag.querySelector('strong').textContent).toBe('(');
  });

  it('shows the plain name when lowercasing changes its length', () => {
    familyTreeSearch.searchField.value = 'i';
    const frag = familyTreeSearch.highlightMatch('İlknur');
    expect(frag.textContent).toBe('İlknur');
    expect(frag.querySelector('strong')).toBeNull();
  });

  it('never parses person names or details as HTML', () => {
    familyTreeSearch.searchField.value = 'img';
    familyTreeSearch.currentSuggestions = [
      { id: 'p2', node: { name: XSS_NAME, maidenName: XSS_NAME }, personData: {} }
    ];
    familyTreeSearch.showSuggestions();

    expect(familyTreeSearch.suggestions.querySelector('img')).toBeNull();
    expect(familyTreeSearch.suggestions.querySelector('.suggestion-name').textContent).toBe(XSS_NAME);
    expect(familyTreeSearch.suggestions.querySelector('.suggestion-details').textContent).toBe(`Maiden: ${XSS_NAME}`);
  });
});

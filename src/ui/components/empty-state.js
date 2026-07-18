// empty-state.js — first-run overlay shown while the tree has no people.

export function syncEmptyState(personCount) {
  const el = document.getElementById('emptyState');
  if (!el) return;
  el.classList.toggle('hidden', personCount > 0);
}

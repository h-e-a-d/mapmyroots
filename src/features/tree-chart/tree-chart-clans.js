// tree-chart-clans.js — Clan detection + color palette (pure)

/**
 * Connected components over parent-child edges only.
 * Spouses do NOT merge clans; shared children DO (handled naturally by the walk).
 *
 * @param {Map<string, Person>} personData
 * @returns {{ clanByPerson: Map<string, number>, clanCount: number, clanSizes: Map<number, number> }}
 */
export function detectClans(personData) {
  const clanByPerson = new Map();
  const clanSizes = new Map();
  let nextClanId = 0;

  for (const [rootId] of personData) {
    if (clanByPerson.has(rootId)) continue;

    const clanId = nextClanId++;
    const stack = [rootId];
    let size = 0;

    while (stack.length) {
      const id = stack.pop();
      if (clanByPerson.has(id)) continue;
      const p = personData.get(id);
      if (!p) continue;

      clanByPerson.set(id, clanId);
      size++;

      // Walk parent edges (up)
      if (p.fatherId && personData.has(p.fatherId) && !clanByPerson.has(p.fatherId)) {
        stack.push(p.fatherId);
      }
      if (p.motherId && personData.has(p.motherId) && !clanByPerson.has(p.motherId)) {
        stack.push(p.motherId);
      }
      // Walk child edges (down) — find anyone whose parent is `id`
      for (const [otherId, other] of personData) {
        if (clanByPerson.has(otherId)) continue;
        if (other.fatherId === id || other.motherId === id) {
          stack.push(otherId);
        }
      }
    }

    clanSizes.set(clanId, size);
  }

  return { clanByPerson, clanCount: nextClanId, clanSizes };
}

// CSS class names applied to node bodies for clans beyond the primary (largest) one.
// Primary clan uses gender-based default (c-purple / c-teal / c-gray).
const CLAN_EXTRA_PALETTES = ['c-coral', 'c-green', 'c-amber'];

/**
 * Assign a body-color CSS class to each non-primary clan, ordered by size (largest first).
 * Returns empty Map when only 1 clan exists (no override needed).
 * The largest clan is intentionally absent from the returned Map so the renderer
 * falls back to gender-based classes (c-purple / c-teal / c-gray).
 *
 * @param {Map<number, number>} clanSizes — clanId -> member count
 * @returns {Map<number, string>} clanId -> CSS class name (e.g. 'c-coral')
 */
export function assignClanColors(clanSizes) {
  if (clanSizes.size < 2) return new Map();

  const sortedClans = Array.from(clanSizes.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([clanId]) => clanId);

  const colors = new Map();
  // Index 0 = largest clan → skip (use gender-based default)
  for (let i = 1; i < sortedClans.length; i++) {
    colors.set(sortedClans[i], CLAN_EXTRA_PALETTES[(i - 1) % CLAN_EXTRA_PALETTES.length]);
  }
  return colors;
}

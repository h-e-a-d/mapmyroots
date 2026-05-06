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

import {
  CLAN_HUE_STEP_DEG,
  CLAN_SATURATION,
  CLAN_LIGHTNESS
} from './tree-chart-config.js';

/**
 * Assign a CSS HSL color string to each clan, ordered by size (largest first).
 * Returns empty Map when only 1 clan exists (no color needed).
 *
 * @param {Map<number, number>} clanSizes — clanId -> member count
 * @returns {Map<number, string>} clanId -> "hsl(h, s%, l%)"
 */
export function assignClanColors(clanSizes) {
  if (clanSizes.size < 2) return new Map();

  const sortedClans = Array.from(clanSizes.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([clanId]) => clanId);

  const colors = new Map();
  for (let i = 0; i < sortedClans.length; i++) {
    const hue = (i * CLAN_HUE_STEP_DEG) % 360;
    colors.set(sortedClans[i], `hsl(${hue}, ${CLAN_SATURATION}%, ${CLAN_LIGHTNESS}%)`);
  }
  return colors;
}

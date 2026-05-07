export function makeMarriageId() {
  return `marr_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Compute updated marriage arrays for every spouse affected by saving person `personId`.
 *
 * @param {string} personId          id of the person being saved
 * @param {Array}  newMarriages      marriages array AFTER edit
 * @param {Array}  previousMarriages marriages array BEFORE edit
 * @param {Map}    personData        Map<id, person> for resolving spouses (read-only)
 * @returns {Map<string, {id, marriages}>} entries that need to be persisted (key = spouse id)
 */
export function syncMarriages(personId, newMarriages, previousMarriages, personData) {
  const updates = new Map();

  const prevById = new Map((previousMarriages || []).filter((m) => m.spouseId).map((m) => [m.id, m]));

  for (const [id, prev] of prevById) {
    const current = newMarriages.find((m) => m.id === id);
    if (!current || !current.spouseId) {
      removeFromSpouse(updates, personData, prev.spouseId, id);
    } else if (current.spouseId !== prev.spouseId) {
      removeFromSpouse(updates, personData, prev.spouseId, id);
    }
  }

  for (const current of newMarriages) {
    if (!current.spouseId) continue;
    addOrUpdateMirror(updates, personData, current, personId);
  }

  return updates;
}

function getOrInitUpdate(updates, personData, spouseId) {
  if (!updates.has(spouseId)) {
    const spouse = personData.get(spouseId);
    if (!spouse) return null;
    updates.set(spouseId, { id: spouseId, marriages: Array.isArray(spouse.marriages) ? [...spouse.marriages] : [] });
  }
  return updates.get(spouseId);
}

function removeFromSpouse(updates, personData, spouseId, marriageId) {
  const update = getOrInitUpdate(updates, personData, spouseId);
  if (!update) return;
  update.marriages = update.marriages.filter((m) => m.id !== marriageId);
}

function addOrUpdateMirror(updates, personData, marriage, savingPersonId) {
  const update = getOrInitUpdate(updates, personData, marriage.spouseId);
  if (!update) return;
  const idx = update.marriages.findIndex((m) => m.id === marriage.id);
  if (idx === -1) {
    update.marriages.push({
      id: marriage.id,
      spouseId: savingPersonId,
      date: marriage.date,
      place: marriage.place,
      note: marriage.note
    });
  } else {
    const existing = update.marriages[idx];
    update.marriages[idx] = {
      id: marriage.id,
      spouseId: savingPersonId,
      date: marriage.date !== undefined ? marriage.date : existing.date,
      place: marriage.place || existing.place,
      note: marriage.note || existing.note
    };
  }
}

/**
 * Migration: localStorage → IndexedDB
 *
 * Reads the monolithic tree state blob that CacheManager writes to
 * localStorage under 'familyTreeCanvas_state', extracts the persons array,
 * and persists each person into IndexedDB — skipping any that already exist.
 *
 * The migration is idempotent: once it sets MIGRATION_FLAG_KEY = 'done',
 * subsequent calls are immediate no-ops regardless of localStorage content.
 *
 * IMPORTANT: The original localStorage entry is intentionally NOT deleted.
 * CacheManager continues to write there as a backup; this migration only
 * ensures IndexedDB is populated for the new primary read path.
 */

import { IndexedDBRepository } from '../repositories/indexed-db-repository.js';

const MIGRATION_FLAG_KEY = 'mapmyroots_migration_v1';

/**
 * Migrate tree state from localStorage to IndexedDB.
 *
 * Safe to call unconditionally at startup — if already migrated, returns
 * immediately. Any error is caught by the caller's `.catch()` handler so
 * that migration failures never block the builder from loading.
 *
 * @returns {Promise<void>}
 */
export async function migrateLocalStorageToIndexedDb() {
  // Idempotency guard: abort if we already ran successfully
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'done') {
    return;
  }

  const idb = new IndexedDBRepository();
  await idb.initialize();

  // Read the state blob CacheManager writes under this key
  const CACHE_KEY = 'familyTreeCanvas_state';
  const raw = localStorage.getItem(CACHE_KEY);

  if (raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Corrupted state blob — nothing to migrate
      parsed = null;
    }

    const persons = parsed?.persons;

    if (Array.isArray(persons) && persons.length > 0) {
      for (const person of persons) {
        if (!person?.id) continue;

        // Only migrate if IDB doesn't already have this record
        const existing = await idb.getPerson(person.id);
        if (!existing) {
          await idb.savePerson(person);
        }
      }
    }
  }

  // Mark migration complete — intentionally after the loop so a partial
  // run (e.g. browser crash mid-loop) will retry on next load
  localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
}

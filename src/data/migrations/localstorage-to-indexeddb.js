import { IndexedDBRepository } from '../repositories/indexed-db-repository.js';
import { RetryManager } from '../../utils/error-handling.js';

const MIGRATION_FLAG_KEY = 'mapmyroots_migration_v1';

export async function migrateLocalStorageToIndexedDb() {
  // Idempotency guard: abort if we already ran successfully
  if (localStorage.getItem(MIGRATION_FLAG_KEY) === 'done') {
    return;
  }

  const idb = new IndexedDBRepository();
  await RetryManager.retry(() => idb.initialize(), { maxRetries: 3, baseDelay: 500 });

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
          await RetryManager.retry(() => idb.savePerson(person), { maxRetries: 3, baseDelay: 500 });
        }
      }
    }
  }

  // Written after the loop so a partial run (e.g. browser crash mid-loop) retries on next load.
  // IMPORTANT: The original localStorage entry is intentionally NOT deleted — CacheManager
  // continues writing there as a backup; this migration only ensures IDB is populated for
  // the new primary read path.
  localStorage.setItem(MIGRATION_FLAG_KEY, 'done');
}

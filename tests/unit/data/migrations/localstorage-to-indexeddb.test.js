/**
 * Tests for localStorage → IndexedDB migration
 *
 * The migration reads the monolithic tree state blob that CacheManager writes
 * to localStorage under the key 'familyTreeCanvas_state', extracts the persons
 * array, and persists each person into IndexedDB via IndexedDBRepository.
 *
 * The migration is idempotent: after it sets MIGRATION_FLAG_KEY = 'done',
 * subsequent calls are no-ops regardless of localStorage content.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Inline mock factories ────────────────────────────────────────────────────

function makeIdbRepo(initialPersons = []) {
  const store = new Map(initialPersons.map(p => [p.id, p]));
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAllPersons: vi.fn(async () => Array.from(store.values())),
    getPerson: vi.fn(async (id) => store.get(id) ?? null),
    savePerson: vi.fn(async (person) => { store.set(person.id, person); return person.id; }),
    _store: store,
  };
}

// ── Module-level mock setup ──────────────────────────────────────────────────

// We vi.mock the two repository modules so the migration module picks up
// our factory stubs instead of the real implementations.

let mockIdbInstance;

vi.mock('../../../../src/data/repositories/indexed-db-repository.js', () => ({
  IndexedDBRepository: vi.fn().mockImplementation(() => mockIdbInstance),
}));

vi.mock('../../../../src/data/repositories/local-storage-repository.js', () => ({}));

// ── Test suite ───────────────────────────────────────────────────────────────

describe('migrateLocalStorageToIndexedDb', () => {
  const MIGRATION_FLAG_KEY = 'mapmyroots_migration_v1';
  const CACHE_KEY = 'familyTreeCanvas_state';

  beforeEach(async () => {
    // Reset localStorage (already cleared by global setup, but be explicit)
    localStorage.clear();

    // Fresh IDB mock for each test
    mockIdbInstance = makeIdbRepo();

    // Re-import the module freshly each test so the flag check runs again
    vi.resetModules();
  });

  async function getMigrateFn() {
    const mod = await import(
      '../../../../src/data/migrations/localstorage-to-indexeddb.js'
    );
    return mod.migrateLocalStorageToIndexedDb;
  }

  // ── 1. Empty localStorage → no-op ─────────────────────────────────────────
  it('empty localStorage: is a no-op, IDB stays empty', async () => {
    const migrate = await getMigrateFn();
    await migrate();

    expect(mockIdbInstance.savePerson).not.toHaveBeenCalled();
    // Flag IS written even when there's nothing to migrate (idempotency marker)
    expect(localStorage.getItem(MIGRATION_FLAG_KEY)).toBe('done');
  });

  // ── 2. Single tree in localStorage → migrated ─────────────────────────────
  it('single person in localStorage: migrated to IDB, localStorage NOT deleted', async () => {
    const tree = {
      version: '2.1.0',
      persons: [{ id: 'p1', name: 'Alice', gender: 'female' }],
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(tree));

    const migrate = await getMigrateFn();
    await migrate();

    expect(mockIdbInstance.savePerson).toHaveBeenCalledTimes(1);
    expect(mockIdbInstance.savePerson).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', name: 'Alice' })
    );
    // localStorage entry must NOT be deleted
    expect(localStorage.getItem(CACHE_KEY)).not.toBeNull();
  });

  // ── 3. Multiple persons → all migrated ────────────────────────────────────
  it('multiple persons in localStorage: all migrated', async () => {
    const persons = [
      { id: 'p1', name: 'Alice', gender: 'female' },
      { id: 'p2', name: 'Bob', gender: 'male' },
      { id: 'p3', name: 'Carol', gender: 'female' },
    ];
    localStorage.setItem(CACHE_KEY, JSON.stringify({ version: '2.1.0', persons }));

    const migrate = await getMigrateFn();
    await migrate();

    expect(mockIdbInstance.savePerson).toHaveBeenCalledTimes(3);
    const savedIds = mockIdbInstance.savePerson.mock.calls.map(c => c[0].id);
    expect(savedIds).toContain('p1');
    expect(savedIds).toContain('p2');
    expect(savedIds).toContain('p3');
  });

  // ── 4. Person already exists in IDB → not overwritten ─────────────────────
  it('person already in IDB: preserved, not overwritten', async () => {
    const existing = { id: 'p1', name: 'Alice-original', gender: 'female' };
    // IDB already has p1
    mockIdbInstance = makeIdbRepo([existing]);

    const incoming = { id: 'p1', name: 'Alice-modified', gender: 'female' };
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ version: '2.1.0', persons: [incoming] })
    );

    const migrate = await getMigrateFn();
    await migrate();

    // savePerson must NOT be called for the already-existing record
    expect(mockIdbInstance.savePerson).not.toHaveBeenCalled();
    // Original record intact
    expect(mockIdbInstance._store.get('p1').name).toBe('Alice-original');
  });

  // ── 5. Idempotent: second run is a no-op ──────────────────────────────────
  it('idempotent: second call is a complete no-op', async () => {
    const tree = {
      version: '2.1.0',
      persons: [{ id: 'p1', name: 'Alice', gender: 'female' }],
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(tree));

    const migrate = await getMigrateFn();

    // First run
    await migrate();
    const callsAfterFirst = mockIdbInstance.savePerson.mock.calls.length;

    // Second run
    await migrate();
    const callsAfterSecond = mockIdbInstance.savePerson.mock.calls.length;

    expect(callsAfterFirst).toBe(1);
    // No additional calls on second run
    expect(callsAfterSecond).toBe(callsAfterFirst);
  });
});

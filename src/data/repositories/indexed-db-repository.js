/**
 * IndexedDBRepository - Scalable data persistence using IndexedDB
 *
 * Benefits over LocalStorage:
 * - No 5MB size limit
 * - Async operations (non-blocking)
 * - Structured queries with indices
 * - Transactional integrity
 * - Support for large datasets (1000+ people)
 *
 * This addresses scalability issue #4 from the architecture review.
 */

import { ERROR_TYPES, ErrorHandler } from '../../utils/error-handling.js';

const DB_NAME = 'FamilyTreeDB';
const DB_VERSION = 1;
const STORE_PERSONS = 'persons';
const STORE_METADATA = 'metadata';
const STORE_CONNECTIONS = 'connections';

export class IndexedDBRepository {
  #db;
  #dbName;
  #version;

  constructor(dbName = DB_NAME, version = DB_VERSION) {
    this.#db = null;
    this.#dbName = dbName;
    this.#version = version;
  }

  /**
   * Initialize the database
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#db) {
      return; // Already initialized
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.#dbName, this.#version);

      request.onerror = () => {
        const error = new Error('Failed to open IndexedDB');
        ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
          operation: 'initialize',
          dbName: this.#dbName
        });
        reject(error);
      };

      request.onsuccess = (event) => {
        this.#db = event.target.result;

        // Handle unexpected close
        this.#db.onversionchange = () => {
          this.#db.close();
          alert('Database is outdated, please reload the page.');
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create persons store
        if (!db.objectStoreNames.contains(STORE_PERSONS)) {
          const personStore = db.createObjectStore(STORE_PERSONS, { keyPath: 'id' });

          // Create indices for efficient queries
          personStore.createIndex('name', 'name', { unique: false });
          personStore.createIndex('surname', 'surname', { unique: false });
          personStore.createIndex('gender', 'gender', { unique: false });
          personStore.createIndex('dob', 'dob', { unique: false });
          personStore.createIndex('motherId', 'motherId', { unique: false });
          personStore.createIndex('fatherId', 'fatherId', { unique: false });
          personStore.createIndex('spouseId', 'spouseId', { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(STORE_METADATA)) {
          db.createObjectStore(STORE_METADATA, { keyPath: 'key' });
        }

        // Create connections store (for hidden connections)
        if (!db.objectStoreNames.contains(STORE_CONNECTIONS)) {
          db.createObjectStore(STORE_CONNECTIONS, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Check if IndexedDB is available
   * @returns {boolean}
   */
  static isAvailable() {
    return 'indexedDB' in window;
  }

  /**
   * Save a person
   * @param {Object} person - Person data
   * @returns {Promise<string>} Person ID
   */
  async savePerson(person) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_PERSONS], 'readwrite');
      const store = transaction.objectStore(STORE_PERSONS);
      const request = store.put(person);

      request.onsuccess = () => resolve(person.id);
      request.onerror = () => {
        const error = new Error('Failed to save person');
        ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
          operation: 'savePerson',
          personId: person.id
        });
        reject(error);
      };
    });
  }

  /**
   * Get a person by ID
   * @param {string} id - Person ID
   * @returns {Promise<Object|null>}
   */
  async getPerson(id) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_PERSONS], 'readonly');
      const store = transaction.objectStore(STORE_PERSONS);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to get person'));
    });
  }

  /**
   * Get all persons
   * @returns {Promise<Object[]>}
   */
  async getAllPersons() {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_PERSONS], 'readonly');
      const store = transaction.objectStore(STORE_PERSONS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to get all persons'));
    });
  }

  /**
   * Find persons by index
   * @param {string} indexName - Index name (name, surname, gender, etc.)
   * @param {any} value - Value to search for
   * @returns {Promise<Object[]>}
   */
  async findByIndex(indexName, value) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_PERSONS], 'readonly');
      const store = transaction.objectStore(STORE_PERSONS);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to find by ${indexName}`));
    });
  }

  /**
   * Search persons by name (partial match)
   * @param {string} searchTerm
   * @returns {Promise<Object[]>}
   */
  async searchByName(searchTerm) {
    await this.#ensureInitialized();

    const allPersons = await this.getAllPersons();
    const lowerSearch = searchTerm.toLowerCase();

    return allPersons.filter(person =>
      person.name?.toLowerCase().includes(lowerSearch) ||
      person.surname?.toLowerCase().includes(lowerSearch)
    );
  }

  /**
   * Delete a person
   * @param {string} id - Person ID
   * @returns {Promise<void>}
   */
  async deletePerson(id) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_PERSONS], 'readwrite');
      const store = transaction.objectStore(STORE_PERSONS);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete person'));
    });
  }

  /**
   * Save multiple persons in a batch
   * @param {Object[]} persons
   * @returns {Promise<void>}
   */
  async savePersonsBatch(persons) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_PERSONS], 'readwrite');
      const store = transaction.objectStore(STORE_PERSONS);

      let completed = 0;
      const total = persons.length;

      for (const person of persons) {
        const request = store.put(person);

        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };

        request.onerror = () => {
          reject(new Error(`Failed to save person ${person.id}`));
        };
      }

      if (total === 0) {
        resolve();
      }
    });
  }

  /**
   * Clear all persons
   * @returns {Promise<void>}
   */
  async clearAllPersons() {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_PERSONS], 'readwrite');
      const store = transaction.objectStore(STORE_PERSONS);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to clear persons'));
    });
  }

  /**
   * Count persons
   * @returns {Promise<number>}
   */
  async countPersons() {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_PERSONS], 'readonly');
      const store = transaction.objectStore(STORE_PERSONS);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Failed to count persons'));
    });
  }

  /**
   * Save metadata
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  async saveMetadata(key, value) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_METADATA], 'readwrite');
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.put({ key, value, timestamp: Date.now() });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save metadata'));
    });
  }

  /**
   * Get metadata
   * @param {string} key
   * @returns {Promise<any|null>}
   */
  async getMetadata(key) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_METADATA], 'readonly');
      const store = transaction.objectStore(STORE_METADATA);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(new Error('Failed to get metadata'));
    });
  }

  /**
   * Save hidden connections
   * @param {string[]} hiddenConnections
   * @returns {Promise<void>}
   */
  async saveHiddenConnections(hiddenConnections) {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_CONNECTIONS], 'readwrite');
      const store = transaction.objectStore(STORE_CONNECTIONS);

      // Clear existing
      store.clear();

      // Save new
      const request = store.put({
        id: 'hidden-connections',
        connections: hiddenConnections,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save hidden connections'));
    });
  }

  /**
   * Get hidden connections
   * @returns {Promise<string[]>}
   */
  async getHiddenConnections() {
    await this.#ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.#db.transaction([STORE_CONNECTIONS], 'readonly');
      const store = transaction.objectStore(STORE_CONNECTIONS);
      const request = store.get('hidden-connections');

      request.onsuccess = () => resolve(request.result?.connections || []);
      request.onerror = () => reject(new Error('Failed to get hidden connections'));
    });
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>}
   */
  async getStats() {
    await this.#ensureInitialized();

    const personCount = await this.countPersons();
    const allPersons = await this.getAllPersons();

    // Calculate storage size (estimate)
    const dataString = JSON.stringify(allPersons);
    const sizeBytes = new Blob([dataString]).size;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    return {
      personCount,
      estimatedSizeMB: parseFloat(sizeMB),
      sizeBytes,
      lastUpdated: await this.getMetadata('lastUpdated')
    };
  }

  /**
   * Export all data
   * @returns {Promise<Object>}
   */
  async exportAllData() {
    await this.#ensureInitialized();

    const [persons, hiddenConnections, metadata] = await Promise.all([
      this.getAllPersons(),
      this.getHiddenConnections(),
      this.getMetadata('treeMetadata')
    ]);

    return {
      persons,
      hiddenConnections,
      metadata,
      exportDate: new Date().toISOString(),
      version: this.#version
    };
  }

  /**
   * Import all data
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async importAllData(data) {
    await this.#ensureInitialized();

    // Clear existing data
    await this.clearAllPersons();

    // Import persons
    if (data.persons && data.persons.length > 0) {
      await this.savePersonsBatch(data.persons);
    }

    // Import hidden connections
    if (data.hiddenConnections) {
      await this.saveHiddenConnections(data.hiddenConnections);
    }

    // Import metadata
    if (data.metadata) {
      await this.saveMetadata('treeMetadata', data.metadata);
    }

    // Update last updated timestamp
    await this.saveMetadata('lastUpdated', Date.now());
  }

  /**
   * Ensure database is initialized
   * @private
   */
  async #ensureInitialized() {
    if (!this.#db) {
      await this.initialize();
    }
  }

  /**
   * Close the database
   */
  close() {
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
  }

  /**
   * Delete the database
   * @returns {Promise<void>}
   */
  async deleteDatabase() {
    this.close();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.#dbName);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to delete database'));
    });
  }

  /**
   * Migrate from LocalStorage to IndexedDB
   * @param {string} localStorageKey
   * @returns {Promise<boolean>} True if migration succeeded
   */
  async migrateFromLocalStorage(localStorageKey) {
    try {
      const data = localStorage.getItem(localStorageKey);
      if (!data) {
        return false; // No data to migrate
      }

      const parsed = JSON.parse(data);

      if (parsed.persons) {
        await this.savePersonsBatch(parsed.persons);
      }

      if (parsed.hiddenConnections) {
        await this.saveHiddenConnections(parsed.hiddenConnections);
      }

      // Save migration metadata
      await this.saveMetadata('migratedFrom', 'localStorage');
      await this.saveMetadata('migrationDate', Date.now());
      await this.saveMetadata('lastUpdated', Date.now());

      console.log('Successfully migrated from LocalStorage to IndexedDB');
      return true;
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'migrateFromLocalStorage'
      });
      return false;
    }
  }
}

/**
 * Create and initialize IndexedDB repository
 * @returns {Promise<IndexedDBRepository>}
 */
export async function createIndexedDBRepository() {
  if (!IndexedDBRepository.isAvailable()) {
    throw new Error('IndexedDB is not available in this browser');
  }

  const repository = new IndexedDBRepository();
  await repository.initialize();
  return repository;
}

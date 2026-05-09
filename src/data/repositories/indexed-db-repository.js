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
const DB_VERSION = 5;            // v5: ensure documents store exists (v4 may have missed it)
const STORE_PERSONS = 'persons';
const STORE_METADATA = 'metadata';
const STORE_CONNECTIONS = 'connections';
const STORE_MEDIA = 'media';
const STORE_DOCUMENTS = 'documents';

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

        // Create media store (added in v2)
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        }

        // Create documents store (added in v4)
        if (!db.objectStoreNames.contains(STORE_DOCUMENTS)) {
          const docStore = db.createObjectStore(STORE_DOCUMENTS, { keyPath: 'id' });
          docStore.createIndex('personId', 'personId', { unique: false });
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
   * Save a media record (image or PDF blob with metadata).
   * @param {{id: string, blob: Blob, mimeType: string, byteLength: number, width?: number, height?: number, createdAt?: number}} media
   * @returns {Promise<string>}
   */
  async saveMedia(media) {
    if (!media?.id) throw new Error('saveMedia: id is required');
    await this.#ensureInitialized();
    // Store bytes as ArrayBuffer rather than Blob. iOS Safari (notably in
    // private/incognito mode) can throw "Error preparing Blob/File data to
    // be stored in object store" when persisting Blobs via IndexedDB; raw
    // buffers don't hit that path and round-trip reliably.
    let arrayBuffer;
    if (media.arrayBuffer instanceof ArrayBuffer) {
      arrayBuffer = media.arrayBuffer;
    } else if (media.blob) {
      try {
        arrayBuffer = await media.blob.arrayBuffer();
      } catch (err) {
        const error = new Error(`Failed to save media (blob-to-buffer): ${err?.name || ''} ${err?.message || err}`.trim(), { cause: err });
        ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
          operation: 'saveMedia',
          mediaId: media.id
        });
        throw error;
      }
    } else {
      throw new Error('saveMedia: blob or arrayBuffer is required');
    }
    const { blob: _ignored, arrayBuffer: _ignored2, ...rest } = media;
    const record = { createdAt: Date.now(), ...rest, arrayBuffer };
    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (cause, label) => {
        if (settled) return;
        settled = true;
        const detail = cause?.name && cause?.message
          ? `${cause.name}: ${cause.message}`
          : (cause?.message || cause?.name || String(cause || 'unknown error'));
        const error = new Error(`Failed to save media (${label}): ${detail}`, { cause });
        ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
          operation: 'saveMedia',
          mediaId: media.id,
          mimeType: media.mimeType,
          byteLength: media.byteLength
        });
        reject(error);
      };
      let tx;
      try {
        tx = this.#db.transaction([STORE_MEDIA], 'readwrite');
      } catch (err) {
        fail(err, 'transaction');
        return;
      }
      tx.onabort = () => fail(tx.error, 'tx-abort');
      tx.onerror = () => fail(tx.error, 'tx-error');
      let req;
      try {
        req = tx.objectStore(STORE_MEDIA).put(record);
      } catch (err) {
        fail(err, 'put-throw');
        return;
      }
      req.onsuccess = () => {
        if (settled) return;
        settled = true;
        resolve(media.id);
      };
      req.onerror = () => fail(req.error, 'req-error');
    });
  }

  /**
   * Get a media record by id.
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getMedia(id) {
    await this.#ensureInitialized();
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction([STORE_MEDIA], 'readonly');
      const req = tx.objectStore(STORE_MEDIA).get(id);
      req.onsuccess = () => {
        const rec = req.result;
        if (!rec) return resolve(null);
        // New records store bytes as ArrayBuffer; reconstitute a Blob for callers.
        // Legacy records still carry a Blob directly — pass through.
        if (rec.arrayBuffer && !rec.blob) {
          try {
            rec.blob = new Blob([rec.arrayBuffer], { type: rec.mimeType || 'application/octet-stream' });
          } catch (err) {
            return reject(new Error(`getMedia: failed to build Blob: ${err?.message || err}`, { cause: err }));
          }
        }
        resolve(rec);
      };
      req.onerror = () => reject(new Error('Failed to get media'));
    });
  }

  /**
   * Delete a media record by id. No-op if absent.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteMedia(id) {
    await this.#ensureInitialized();
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction([STORE_MEDIA], 'readwrite');
      const req = tx.objectStore(STORE_MEDIA).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to delete media'));
    });
  }

  /**
   * Delete every media row whose id is not in `referencedIds`.
   * Returns the list of deleted ids (for logging/tests).
   * @param {Set<string>} referencedIds
   * @returns {Promise<string[]>}
   */
  async garbageCollectMedia(referencedIds) {
    await this.#ensureInitialized();
    const removed = [];
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction([STORE_MEDIA], 'readwrite');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.openCursor();
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (!cursor) { resolve(removed); return; }
        if (!referencedIds.has(cursor.value.id)) {
          removed.push(cursor.value.id);
          cursor.delete();
        }
        cursor.continue();
      };
      req.onerror = () => reject(new Error('GC scan failed'));
    });
  }

  /**
   * Save a document record.
   * @param {Object} doc - Document data
   * @returns {Promise<string>} Document ID
   */
  async saveDocument(doc) {
    if (!doc?.id) throw new Error('saveDocument: id is required');
    await this.#ensureInitialized();
    const record = { createdAt: Date.now(), updatedAt: Date.now(), ...doc };
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction([STORE_DOCUMENTS], 'readwrite');
      const req = tx.objectStore(STORE_DOCUMENTS).put(record);
      req.onsuccess = () => resolve(record.id);
      req.onerror = () => reject(new Error('Failed to save document'));
    });
  }

  /**
   * Get all documents for a person.
   * @param {string} personId
   * @returns {Promise<Object[]>}
   */
  async getDocumentsForPerson(personId) {
    await this.#ensureInitialized();
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction([STORE_DOCUMENTS], 'readonly');
      const req = tx.objectStore(STORE_DOCUMENTS).index('personId').getAll(personId);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(new Error('Failed to query documents'));
    });
  }

  /**
   * Get all documents in the database.
   * @returns {Promise<Object[]>}
   */
  async getAllDocuments() {
    await this.#ensureInitialized();
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction([STORE_DOCUMENTS], 'readonly');
      const req = tx.objectStore(STORE_DOCUMENTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(new Error('Failed to load documents'));
    });
  }

  /**
   * Delete a document by id.
   * @param {string} id
   * @returns {Promise<void>}
   */
  async deleteDocument(id) {
    await this.#ensureInitialized();
    return new Promise((resolve, reject) => {
      const tx = this.#db.transaction([STORE_DOCUMENTS], 'readwrite');
      const req = tx.objectStore(STORE_DOCUMENTS).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(new Error('Failed to delete document'));
    });
  }

  /**
   * Delete all documents for a person.
   * Returns the list of deleted document ids.
   * @param {string} personId
   * @returns {Promise<string[]>}
   */
  async deleteDocumentsForPerson(personId) {
    await this.#ensureInitialized();
    const docs = await this.getDocumentsForPerson(personId);
    await Promise.all(docs.map((d) => this.deleteDocument(d.id)));
    return docs.map((d) => d.id);
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

  /** @internal — for tests only */
  _dbForTest() { return this.#db; }

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

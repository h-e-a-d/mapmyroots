// core-cache.js
// Enhanced cache and auto-save manager with security and validation
//
// PRIMARY STORAGE PATH: IndexedDB (via IndexedDBRepository)
// BACKUP PATH: localStorage — kept as a fallback and for migration continuity.
//
// IndexedDBRepository is the active write path for all new saves.
// LocalStorageRepository (core-cache backup key) is intentionally still
// written as a safety net so the migration module can detect uncached state.

import { SecurityUtils } from '../../utils/security-utils.js';
import { CONFIG } from '../../config/config.js';
import { EVENTS } from '../../utils/event-bus.js';
import { IndexedDBRepository } from '../repositories/indexed-db-repository.js';

export class CacheManager {
  constructor(treeCore) {
    this.treeCore = treeCore;
    this.cacheKey = 'familyTreeCanvas_state';
    this.autoSaveInterval = 30000;
    this.autoSaveTimer = null;
    this.cacheVersion = '2.6';
    this.lastSaveTime = null;

    // Primary write path: IndexedDB
    this.#idb = new IndexedDBRepository();
    this.#idbReady = false;
    this.#initIdb();
  }

  /** @type {IndexedDBRepository} */
  #idb;

  /** @type {boolean} */
  #idbReady;

  /** @returns {Promise<void>} */
  async #initIdb() {
    try {
      await this.#idb.initialize();
      this.#idbReady = true;
    } catch (err) {
      console.warn('[CacheManager] IndexedDB unavailable, falling back to localStorage:', err);
    }
  }

  setupCaching() {
    this.startAutoSave();
    window.addEventListener('beforeunload', () => this.saveToCache());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.saveToCache();
    });
    // Optionally: this.treeCore.addCacheManagementUI();
  }

  startAutoSave() {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    this.autoSaveTimer = setInterval(() => this.autoSave(), this.autoSaveInterval);
  }

  autoSave() {
    try {
      this.saveToCache();
      this.lastSaveTime = new Date();
      if (this.treeCore.enhancedCacheIndicator) {
        this.treeCore.enhancedCacheIndicator.updateSaveStatus('Last saved', this.lastSaveTime.toLocaleTimeString());
        this.treeCore.enhancedCacheIndicator.updateStats();
      }
      const saveIndicator = document.getElementById('saveIndicator');
      if (saveIndicator) {
        saveIndicator.textContent = `Last saved: ${this.lastSaveTime.toLocaleTimeString()}`;
        saveIndicator.style.color = '#27ae60';
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
      if (window.notifications) window.notifications.warning('Auto-save Failed', 'Could not save progress automatically');
    }
  }

  /**
   * Persist current tree state.
   *
   * Primary path: writes each person to IndexedDB (fire-and-forget so the
   * synchronous `beforeunload` caller is not blocked).
   * Backup path: always writes the state blob to localStorage so the
   * migration module and error-recovery paths continue to work.
   *
   * @returns {boolean} true if the synchronous localStorage write succeeded
   */
  saveToCache() {
    try {
      const state = this.treeCore.getCurrentState();
      const stateString = JSON.stringify(state);
      const currentSize = new Blob([stateString]).size;

      // ── localStorage backup (unchanged from original) ────────────────────
      if (currentSize > 5 * 1024 * 1024) {
        const compressedState = this.treeCore.getCompressedState();
        localStorage.setItem(this.cacheKey, JSON.stringify(compressedState));
      } else {
        localStorage.setItem(this.cacheKey, stateString);
      }
      const backupKey = `${this.cacheKey}_backup_${Date.now()}`;
      localStorage.setItem(backupKey, stateString);
      this.treeCore.cleanOldBackups();

      // ── Primary path: IndexedDB (fire-and-forget) ────────────────────────
      if (this.#idbReady && Array.isArray(state?.persons)) {
        this.#persistPersonsToIdb(state.persons).catch((err) => {
          console.warn('[CacheManager] IndexedDB save failed (localStorage backup intact):', err);
        });
      }

      return true;
    } catch (error) {
      console.error('Failed to save to cache:', error);
      return false;
    }
  }

  /**
   * Write each person to IndexedDB.
   * Uses savePersonsBatch for a single transaction when possible.
   *
   * @param {Object[]} persons
   * @returns {Promise<void>}
   */
  async #persistPersonsToIdb(persons) {
    if (persons.length === 0) return;
    await this.#idb.savePersonsBatch(persons);
    await this.#idb.saveMetadata('lastUpdated', Date.now());
  }

  /**
   * Load cached tree state.
   *
   * Reads from IndexedDB first. Falls back to localStorage if IDB is empty
   * or unavailable, ensuring continuity before migration runs.
   *
   * @returns {Promise<boolean>}
   */
  async loadCachedState() {
    // ── Primary path: IndexedDB ──────────────────────────────────────────────
    if (this.#idbReady) {
      try {
        const persons = await this.#idb.getAllPersons();
        if (persons && persons.length > 0) {
          const state = { version: '2.1.0', persons };
          this.treeCore.processLoadedData(state);
          return true;
        }
      } catch (err) {
        console.warn('[CacheManager] IndexedDB load failed, trying localStorage:', err);
      }
    }

    // ── Fallback path: localStorage ──────────────────────────────────────────
    try {
      const cachedState = localStorage.getItem(this.cacheKey);
      if (!cachedState) return false;
      const state = JSON.parse(cachedState);
      if (state.version || state.persons) {
        // Valid format
        this.treeCore.processLoadedData(state);
        return true;
      } else {
        // Invalid or unrecognized format
        console.warn('Unrecognized data format, ignoring cached data');
        return false;
      }
    } catch (error) {
      console.error('Failed to load cached state:', error);
      return false;
    }
  }

  /**
   * Clear all cached data from both storage layers.
   */
  clearCache() {
    // Clear localStorage
    localStorage.removeItem(this.cacheKey);
    // Collect backup keys first — removing inside the loop shifts indices and silently skips keys
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${this.cacheKey}_backup_`)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));

    // Clear IndexedDB
    if (this.#idbReady) {
      this.#idb.clearAllPersons().catch((err) => {
        console.warn('[CacheManager] Failed to clear IndexedDB persons:', err);
      });
    }
  }
}

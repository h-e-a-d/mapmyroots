/**
 * PersonRepository - Centralized data access layer for person entities
 *
 * Responsibilities:
 * - CRUD operations for person data
 * - Data validation
 * - Event emission for data changes
 * - Cache management coordination
 *
 * This follows the Repository pattern to decouple data access from business logic.
 */

import { EVENTS } from '../../utils/event-bus.js';
import { SecurityUtils } from '../../utils/security-utils.js';
import { ERROR_TYPES, ErrorHandler } from '../../utils/error-handling.js';

/**
 * @typedef {Object} Person
 * @property {string} id - Unique identifier
 * @property {string} name - Person's name
 * @property {string} [surname] - Person's surname
 * @property {string} [fatherName] - Father's name
 * @property {string} [dob] - Date of birth
 * @property {string} [dod] - Date of death
 * @property {string} gender - Gender (male/female)
 * @property {string} [motherId] - Mother's ID
 * @property {string} [fatherId] - Father's ID
 * @property {string} [spouseId] - Spouse's ID
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {string} [color] - Node color
 * @property {string} [image] - Profile image URL
 * @property {Object} [additionalInfo] - Additional information
 */

export class PersonRepository {
  #data;
  #eventBus;
  #cache;
  #validator;

  constructor(eventBus, cacheManager = null) {
    this.#data = new Map();
    this.#eventBus = eventBus;
    this.#cache = cacheManager;
    this.#validator = new PersonValidator();
  }

  /**
   * Save a person (create or update)
   * @param {Person} person - Person data
   * @returns {Promise<string>} Person ID
   */
  async save(person) {
    try {
      // Validate
      const validationResult = this.#validator.validate(person);
      if (!validationResult.isValid) {
        this.#eventBus.emit(EVENTS.DATA_VALIDATION_ERROR, {
          errors: validationResult.errors,
          data: person
        });
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Sanitize
      const sanitized = this.#sanitizePerson(person);

      // Generate ID if new
      if (!sanitized.id) {
        sanitized.id = this.#generateId();
      }

      const isUpdate = this.#data.has(sanitized.id);

      // Save to memory
      this.#data.set(sanitized.id, sanitized);

      // Update cache if available
      if (this.#cache) {
        await this.#cache.savePersonData(sanitized.id, sanitized);
      }

      // Emit event
      const eventName = isUpdate ? EVENTS.TREE_PERSON_UPDATED : EVENTS.TREE_PERSON_ADDED;
      this.#eventBus.emit(eventName, sanitized);

      return sanitized.id;
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'save',
        personId: person.id
      });
      throw error;
    }
  }

  /**
   * Find a person by ID
   * @param {string} id - Person ID
   * @returns {Person|null}
   */
  findById(id) {
    return this.#data.get(id) || null;
  }

  /**
   * Find all persons
   * @returns {Person[]}
   */
  findAll() {
    return Array.from(this.#data.values());
  }

  /**
   * Find persons by criteria
   * @param {Function} predicate - Filter function
   * @returns {Person[]}
   */
  findBy(predicate) {
    return this.findAll().filter(predicate);
  }

  /**
   * Find persons by relationship
   * @param {string} personId - Person ID
   * @param {string} relationType - Relationship type (mother, father, spouse, children)
   * @returns {Person[]}
   */
  findByRelationship(personId, relationType) {
    const person = this.findById(personId);
    if (!person) return [];

    switch (relationType) {
      case 'mother':
        return person.motherId ? [this.findById(person.motherId)].filter(Boolean) : [];
      case 'father':
        return person.fatherId ? [this.findById(person.fatherId)].filter(Boolean) : [];
      case 'spouse':
        return person.spouseId ? [this.findById(person.spouseId)].filter(Boolean) : [];
      case 'children':
        return this.findBy(p => p.motherId === personId || p.fatherId === personId);
      case 'parents':
        return [
          person.motherId ? this.findById(person.motherId) : null,
          person.fatherId ? this.findById(person.fatherId) : null
        ].filter(Boolean);
      case 'siblings':
        const parents = this.findByRelationship(personId, 'parents');
        if (parents.length === 0) return [];
        return this.findBy(p =>
          p.id !== personId &&
          ((person.motherId && p.motherId === person.motherId) ||
           (person.fatherId && p.fatherId === person.fatherId))
        );
      default:
        return [];
    }
  }

  /**
   * Delete a person
   * @param {string} id - Person ID
   * @returns {Promise<boolean>}
   */
  async delete(id) {
    try {
      const person = this.findById(id);
      if (!person) return false;

      // Remove from memory
      this.#data.delete(id);

      // Remove from cache
      if (this.#cache) {
        await this.#cache.deletePersonData(id);
      }

      // Emit event
      this.#eventBus.emit(EVENTS.TREE_PERSON_DELETED, { id, person });

      return true;
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'delete',
        personId: id
      });
      throw error;
    }
  }

  /**
   * Delete all persons
   * @returns {Promise<void>}
   */
  async deleteAll() {
    try {
      this.#data.clear();

      if (this.#cache) {
        await this.#cache.clearAllData();
      }

      this.#eventBus.emit(EVENTS.TREE_LOADED, { persons: [] });
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'deleteAll'
      });
      throw error;
    }
  }

  /**
   * Count persons
   * @returns {number}
   */
  count() {
    return this.#data.size;
  }

  /**
   * Check if person exists
   * @param {string} id - Person ID
   * @returns {boolean}
   */
  exists(id) {
    return this.#data.has(id);
  }

  /**
   * Load persons from data
   * @param {Person[]} persons - Array of persons
   * @returns {Promise<void>}
   */
  async loadFromData(persons) {
    try {
      this.#data.clear();

      for (const person of persons) {
        const sanitized = this.#sanitizePerson(person);
        this.#data.set(sanitized.id, sanitized);
      }

      if (this.#cache) {
        await this.#cache.saveAllPersonData(Array.from(this.#data.values()));
      }

      this.#eventBus.emit(EVENTS.TREE_LOADED, { persons: Array.from(this.#data.values()) });
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'loadFromData'
      });
      throw error;
    }
  }

  /**
   * Export all persons
   * @returns {Person[]}
   */
  exportData() {
    return Array.from(this.#data.values());
  }

  /**
   * Sanitize person data
   * @private
   * @param {Person} person
   * @returns {Person}
   */
  #sanitizePerson(person) {
    const sanitized = { ...person };

    // Sanitize text fields
    const textFields = ['name', 'surname', 'fatherName', 'dob', 'dod'];
    textFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = SecurityUtils.sanitizeText(sanitized[field]);
      }
    });

    return sanitized;
  }

  /**
   * Generate unique ID
   * @private
   * @returns {string}
   */
  #generateId() {
    return `person-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get repository statistics
   * @returns {Object}
   */
  getStats() {
    const persons = this.findAll();
    return {
      total: persons.length,
      males: persons.filter(p => p.gender === 'male').length,
      females: persons.filter(p => p.gender === 'female').length,
      withMother: persons.filter(p => p.motherId).length,
      withFather: persons.filter(p => p.fatherId).length,
      withSpouse: persons.filter(p => p.spouseId).length,
      withImages: persons.filter(p => p.image).length
    };
  }
}

/**
 * PersonValidator - Validates person data
 */
class PersonValidator {
  /**
   * Validate person data
   * @param {Person} person
   * @returns {{isValid: boolean, errors: string[]}}
   */
  validate(person) {
    const errors = [];

    // Required fields
    if (!person.name || person.name.trim() === '') {
      errors.push('Name is required');
    }

    if (!person.gender || !['male', 'female'].includes(person.gender)) {
      errors.push('Gender must be "male" or "female"');
    }

    // Name length
    if (person.name && person.name.length > 100) {
      errors.push('Name must be less than 100 characters');
    }

    if (person.surname && person.surname.length > 100) {
      errors.push('Surname must be less than 100 characters');
    }

    // Coordinates
    if (person.x !== undefined && typeof person.x !== 'number') {
      errors.push('X coordinate must be a number');
    }

    if (person.y !== undefined && typeof person.y !== 'number') {
      errors.push('Y coordinate must be a number');
    }

    // Self-referential relationships
    if (person.id) {
      if (person.motherId === person.id) {
        errors.push('Person cannot be their own mother');
      }
      if (person.fatherId === person.id) {
        errors.push('Person cannot be their own father');
      }
      if (person.spouseId === person.id) {
        errors.push('Person cannot be their own spouse');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

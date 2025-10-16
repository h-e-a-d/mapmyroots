/**
 * RelationshipManager - Manages relationships and connections between persons
 *
 * Responsibilities:
 * - Create and remove relationships between persons
 * - Generate connection data for rendering
 * - Validate relationships
 * - Track hidden connections
 *
 * This extracts connection logic from TreeEngine to follow Single Responsibility Principle.
 */

import { EVENTS } from '../utils/event-bus.js';
import { ERROR_TYPES, ErrorHandler } from '../utils/error-handling.js';

/**
 * @typedef {Object} Connection
 * @property {string} fromId - Source person ID
 * @property {string} toId - Target person ID
 * @property {string} type - Connection type (parent, spouse)
 * @property {Object} fromNode - Source node data
 * @property {Object} toNode - Target node data
 */

/**
 * @typedef {Object} Relationship
 * @property {string} personId - Person ID
 * @property {string} relatedPersonId - Related person ID
 * @property {string} type - Relationship type (mother, father, spouse)
 */

export class RelationshipManager {
  #personRepository;
  #eventBus;
  #connections;
  #hiddenConnections;

  constructor(personRepository, eventBus) {
    this.#personRepository = personRepository;
    this.#eventBus = eventBus;
    this.#connections = [];
    this.#hiddenConnections = new Set();
  }

  /**
   * Create a parent-child relationship
   * @param {string} childId - Child person ID
   * @param {string} parentId - Parent person ID
   * @param {string} parentType - 'mother' or 'father'
   * @returns {Promise<boolean>}
   */
  async createParentRelationship(childId, parentId, parentType) {
    try {
      const child = this.#personRepository.findById(childId);
      const parent = this.#personRepository.findById(parentId);

      if (!child || !parent) {
        throw new Error('Child or parent not found');
      }

      // Validate
      const validation = this.#validateParentRelationship(child, parent, parentType);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Update child's parent reference
      const updatedChild = { ...child };
      if (parentType === 'mother') {
        updatedChild.motherId = parentId;
      } else if (parentType === 'father') {
        updatedChild.fatherId = parentId;
      } else {
        throw new Error('Invalid parent type. Must be "mother" or "father"');
      }

      await this.#personRepository.save(updatedChild);

      // Regenerate connections
      this.regenerateConnections();

      // Emit event
      this.#eventBus.emit(EVENTS.TREE_RELATIONSHIP_ADDED, {
        childId,
        parentId,
        type: parentType
      });

      return true;
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'createParentRelationship',
        childId,
        parentId,
        parentType
      });
      throw error;
    }
  }

  /**
   * Create a spouse relationship
   * @param {string} person1Id - First person ID
   * @param {string} person2Id - Second person ID
   * @returns {Promise<boolean>}
   */
  async createSpouseRelationship(person1Id, person2Id) {
    try {
      const person1 = this.#personRepository.findById(person1Id);
      const person2 = this.#personRepository.findById(person2Id);

      if (!person1 || !person2) {
        throw new Error('One or both persons not found');
      }

      // Validate
      const validation = this.#validateSpouseRelationship(person1, person2);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Update both persons
      await this.#personRepository.save({ ...person1, spouseId: person2Id });
      await this.#personRepository.save({ ...person2, spouseId: person1Id });

      // Regenerate connections
      this.regenerateConnections();

      // Emit event
      this.#eventBus.emit(EVENTS.TREE_RELATIONSHIP_ADDED, {
        person1Id,
        person2Id,
        type: 'spouse'
      });

      return true;
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'createSpouseRelationship',
        person1Id,
        person2Id
      });
      throw error;
    }
  }

  /**
   * Remove a parent relationship
   * @param {string} childId - Child person ID
   * @param {string} parentType - 'mother' or 'father'
   * @returns {Promise<boolean>}
   */
  async removeParentRelationship(childId, parentType) {
    try {
      const child = this.#personRepository.findById(childId);
      if (!child) return false;

      const updatedChild = { ...child };
      if (parentType === 'mother') {
        delete updatedChild.motherId;
      } else if (parentType === 'father') {
        delete updatedChild.fatherId;
      } else {
        throw new Error('Invalid parent type');
      }

      await this.#personRepository.save(updatedChild);
      this.regenerateConnections();

      this.#eventBus.emit(EVENTS.TREE_RELATIONSHIP_REMOVED, {
        childId,
        type: parentType
      });

      return true;
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'removeParentRelationship',
        childId,
        parentType
      });
      throw error;
    }
  }

  /**
   * Remove a spouse relationship
   * @param {string} person1Id - First person ID
   * @returns {Promise<boolean>}
   */
  async removeSpouseRelationship(person1Id) {
    try {
      const person1 = this.#personRepository.findById(person1Id);
      if (!person1 || !person1.spouseId) return false;

      const person2Id = person1.spouseId;
      const person2 = this.#personRepository.findById(person2Id);

      // Remove from both persons
      const updated1 = { ...person1 };
      delete updated1.spouseId;
      await this.#personRepository.save(updated1);

      if (person2) {
        const updated2 = { ...person2 };
        delete updated2.spouseId;
        await this.#personRepository.save(updated2);
      }

      this.regenerateConnections();

      this.#eventBus.emit(EVENTS.TREE_RELATIONSHIP_REMOVED, {
        person1Id,
        person2Id,
        type: 'spouse'
      });

      return true;
    } catch (error) {
      ErrorHandler.handleError(error, ERROR_TYPES.DATA_OPERATION_ERROR, {
        operation: 'removeSpouseRelationship',
        person1Id
      });
      throw error;
    }
  }

  /**
   * Regenerate all connections based on current person data
   * This is called after person updates or relationship changes
   */
  regenerateConnections() {
    this.#connections = [];

    const allPersons = this.#personRepository.findAll();

    for (const person of allPersons) {
      // Parent connections
      if (person.motherId) {
        const mother = this.#personRepository.findById(person.motherId);
        if (mother) {
          this.#addConnection(person.id, person.motherId, 'parent', person, mother);
        }
      }

      if (person.fatherId) {
        const father = this.#personRepository.findById(person.fatherId);
        if (father) {
          this.#addConnection(person.id, person.fatherId, 'parent', person, father);
        }
      }

      // Spouse connections (only add once per pair)
      if (person.spouseId && person.id < person.spouseId) {
        const spouse = this.#personRepository.findById(person.spouseId);
        if (spouse) {
          this.#addConnection(person.id, person.spouseId, 'spouse', person, spouse);
        }
      }
    }

    this.#eventBus.emit('relationships:regenerated', {
      connectionCount: this.#connections.length
    });
  }

  /**
   * Add a connection to the list
   * @private
   */
  #addConnection(fromId, toId, type, fromNode, toNode) {
    const connectionKey = `${fromId}-${toId}`;
    if (this.#hiddenConnections.has(connectionKey)) {
      return; // Skip hidden connections
    }

    this.#connections.push({
      fromId,
      toId,
      type,
      fromNode: { x: fromNode.x, y: fromNode.y, id: fromNode.id },
      toNode: { x: toNode.x, y: toNode.y, id: toNode.id }
    });
  }

  /**
   * Get all connections
   * @returns {Connection[]}
   */
  getConnections() {
    return [...this.#connections];
  }

  /**
   * Get connections for a specific person
   * @param {string} personId
   * @returns {Connection[]}
   */
  getConnectionsForPerson(personId) {
    return this.#connections.filter(
      conn => conn.fromId === personId || conn.toId === personId
    );
  }

  /**
   * Hide a connection
   * @param {string} fromId
   * @param {string} toId
   */
  hideConnection(fromId, toId) {
    this.#hiddenConnections.add(`${fromId}-${toId}`);
    this.#hiddenConnections.add(`${toId}-${fromId}`);
    this.regenerateConnections();
  }

  /**
   * Show a hidden connection
   * @param {string} fromId
   * @param {string} toId
   */
  showConnection(fromId, toId) {
    this.#hiddenConnections.delete(`${fromId}-${toId}`);
    this.#hiddenConnections.delete(`${toId}-${fromId}`);
    this.regenerateConnections();
  }

  /**
   * Check if a connection is hidden
   * @param {string} fromId
   * @param {string} toId
   * @returns {boolean}
   */
  isConnectionHidden(fromId, toId) {
    return this.#hiddenConnections.has(`${fromId}-${toId}`);
  }

  /**
   * Clear all hidden connections
   */
  clearHiddenConnections() {
    this.#hiddenConnections.clear();
    this.regenerateConnections();
  }

  /**
   * Validate parent relationship
   * @private
   */
  #validateParentRelationship(child, parent, parentType) {
    // Check for same person
    if (child.id === parent.id) {
      return { isValid: false, error: 'Person cannot be their own parent' };
    }

    // Check gender
    if (parentType === 'mother' && parent.gender !== 'female') {
      return { isValid: false, error: 'Mother must be female' };
    }
    if (parentType === 'father' && parent.gender !== 'male') {
      return { isValid: false, error: 'Father must be male' };
    }

    // Check for circular relationships (child is already parent of parent)
    if (this.#hasCircularRelationship(child.id, parent.id)) {
      return { isValid: false, error: 'Circular relationship detected' };
    }

    return { isValid: true };
  }

  /**
   * Validate spouse relationship
   * @private
   */
  #validateSpouseRelationship(person1, person2) {
    // Check for same person
    if (person1.id === person2.id) {
      return { isValid: false, error: 'Person cannot be their own spouse' };
    }

    // Check if already has spouse
    if (person1.spouseId && person1.spouseId !== person2.id) {
      return { isValid: false, error: 'Person already has a spouse' };
    }
    if (person2.spouseId && person2.spouseId !== person1.id) {
      return { isValid: false, error: 'Person already has a spouse' };
    }

    // Check for parent-child relationship
    if (person1.motherId === person2.id || person1.fatherId === person2.id ||
        person2.motherId === person1.id || person2.fatherId === person1.id) {
      return { isValid: false, error: 'Cannot marry parent or child' };
    }

    // Check for sibling relationship
    if (this.#areSiblings(person1.id, person2.id)) {
      return { isValid: false, error: 'Cannot marry sibling' };
    }

    return { isValid: true };
  }

  /**
   * Check if two persons are siblings
   * @private
   */
  #areSiblings(id1, id2) {
    const person1 = this.#personRepository.findById(id1);
    const person2 = this.#personRepository.findById(id2);

    if (!person1 || !person2) return false;

    // Same mother or same father
    return (person1.motherId && person1.motherId === person2.motherId) ||
           (person1.fatherId && person1.fatherId === person2.fatherId);
  }

  /**
   * Check for circular relationships
   * @private
   */
  #hasCircularRelationship(childId, parentId, visited = new Set()) {
    if (visited.has(childId)) return true;
    visited.add(childId);

    const child = this.#personRepository.findById(childId);
    if (!child) return false;

    // Check if childId is an ancestor of parentId
    const parent = this.#personRepository.findById(parentId);
    if (!parent) return false;

    if (parent.motherId === childId || parent.fatherId === childId) {
      return true;
    }

    // Recursively check ancestors of parent
    if (parent.motherId && this.#hasCircularRelationship(childId, parent.motherId, visited)) {
      return true;
    }
    if (parent.fatherId && this.#hasCircularRelationship(childId, parent.fatherId, visited)) {
      return true;
    }

    return false;
  }

  /**
   * Get relationship statistics
   * @returns {Object}
   */
  getStats() {
    return {
      totalConnections: this.#connections.length,
      parentConnections: this.#connections.filter(c => c.type === 'parent').length,
      spouseConnections: this.#connections.filter(c => c.type === 'spouse').length,
      hiddenConnections: this.#hiddenConnections.size
    };
  }

  /**
   * Export hidden connections for persistence
   * @returns {string[]}
   */
  exportHiddenConnections() {
    return Array.from(this.#hiddenConnections);
  }

  /**
   * Import hidden connections
   * @param {string[]} hiddenConnections
   */
  importHiddenConnections(hiddenConnections) {
    this.#hiddenConnections = new Set(hiddenConnections);
    this.regenerateConnections();
  }
}

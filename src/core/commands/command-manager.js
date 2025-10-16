/**
 * Command Pattern Implementation for Undo/Redo
 *
 * Benefits over current approach:
 * - Memory efficient: O(1) per action instead of O(n) full state copies
 * - Faster undo/redo operations
 * - Better for large trees (500+ people)
 * - Support for command composition and macros
 *
 * Current approach: 50 states × 500 people × 500 bytes = 12.5 MB
 * Command approach: 50 commands × 100 bytes = 5 KB (2500x improvement)
 */

import { EVENTS } from '../../utils/event-bus.js';

/**
 * Base Command class
 */
export class Command {
  #description;
  #timestamp;

  constructor(description = '') {
    this.#description = description;
    this.#timestamp = Date.now();
  }

  /**
   * Execute the command
   * @returns {Promise<void>}
   */
  async execute() {
    throw new Error('Command.execute() must be implemented');
  }

  /**
   * Undo the command
   * @returns {Promise<void>}
   */
  async undo() {
    throw new Error('Command.undo() must be implemented');
  }

  /**
   * Redo the command (default: execute again)
   * @returns {Promise<void>}
   */
  async redo() {
    return this.execute();
  }

  /**
   * Get command description
   * @returns {string}
   */
  getDescription() {
    return this.#description;
  }

  /**
   * Get command timestamp
   * @returns {number}
   */
  getTimestamp() {
    return this.#timestamp;
  }
}

/**
 * Add Person Command
 */
export class AddPersonCommand extends Command {
  #personRepository;
  #personData;
  #personId;

  constructor(personRepository, personData) {
    super(`Add ${personData.name || 'person'}`);
    this.#personRepository = personRepository;
    this.#personData = { ...personData };
    this.#personId = null;
  }

  async execute() {
    this.#personId = await this.#personRepository.save(this.#personData);
    return this.#personId;
  }

  async undo() {
    if (this.#personId) {
      await this.#personRepository.delete(this.#personId);
    }
  }

  getPersonId() {
    return this.#personId;
  }
}

/**
 * Update Person Command
 */
export class UpdatePersonCommand extends Command {
  #personRepository;
  #personId;
  #newData;
  #oldData;

  constructor(personRepository, personId, newData) {
    super(`Update ${newData.name || 'person'}`);
    this.#personRepository = personRepository;
    this.#personId = personId;
    this.#newData = { ...newData };
    this.#oldData = null;
  }

  async execute() {
    // Save old data for undo
    const existing = this.#personRepository.findById(this.#personId);
    if (existing) {
      this.#oldData = { ...existing };
    }

    await this.#personRepository.save({ ...this.#newData, id: this.#personId });
  }

  async undo() {
    if (this.#oldData) {
      await this.#personRepository.save(this.#oldData);
    }
  }
}

/**
 * Delete Person Command
 */
export class DeletePersonCommand extends Command {
  #personRepository;
  #personId;
  #deletedData;

  constructor(personRepository, personId) {
    const person = personRepository.findById(personId);
    super(`Delete ${person?.name || 'person'}`);
    this.#personRepository = personRepository;
    this.#personId = personId;
    this.#deletedData = null;
  }

  async execute() {
    // Save data for undo
    const person = this.#personRepository.findById(this.#personId);
    if (person) {
      this.#deletedData = { ...person };
    }

    await this.#personRepository.delete(this.#personId);
  }

  async undo() {
    if (this.#deletedData) {
      await this.#personRepository.save(this.#deletedData);
    }
  }
}

/**
 * Move Person Command (for drag operations)
 */
export class MovePersonCommand extends Command {
  #personRepository;
  #personId;
  #newX;
  #newY;
  #oldX;
  #oldY;

  constructor(personRepository, personId, newX, newY) {
    super(`Move person`);
    this.#personRepository = personRepository;
    this.#personId = personId;
    this.#newX = newX;
    this.#newY = newY;
    this.#oldX = null;
    this.#oldY = null;
  }

  async execute() {
    const person = this.#personRepository.findById(this.#personId);
    if (!person) return;

    // Save old position
    this.#oldX = person.x;
    this.#oldY = person.y;

    // Update position
    await this.#personRepository.save({
      ...person,
      x: this.#newX,
      y: this.#newY
    });
  }

  async undo() {
    if (this.#oldX !== null && this.#oldY !== null) {
      const person = this.#personRepository.findById(this.#personId);
      if (person) {
        await this.#personRepository.save({
          ...person,
          x: this.#oldX,
          y: this.#oldY
        });
      }
    }
  }
}

/**
 * Add Relationship Command
 */
export class AddRelationshipCommand extends Command {
  #relationshipManager;
  #person1Id;
  #person2Id;
  #relationType; // 'mother', 'father', 'spouse'

  constructor(relationshipManager, person1Id, person2Id, relationType) {
    super(`Add ${relationType} relationship`);
    this.#relationshipManager = relationshipManager;
    this.#person1Id = person1Id;
    this.#person2Id = person2Id;
    this.#relationType = relationType;
  }

  async execute() {
    if (this.#relationType === 'spouse') {
      await this.#relationshipManager.createSpouseRelationship(
        this.#person1Id,
        this.#person2Id
      );
    } else {
      // person1 is child, person2 is parent
      await this.#relationshipManager.createParentRelationship(
        this.#person1Id,
        this.#person2Id,
        this.#relationType
      );
    }
  }

  async undo() {
    if (this.#relationType === 'spouse') {
      await this.#relationshipManager.removeSpouseRelationship(this.#person1Id);
    } else {
      await this.#relationshipManager.removeParentRelationship(
        this.#person1Id,
        this.#relationType
      );
    }
  }
}

/**
 * Remove Relationship Command
 */
export class RemoveRelationshipCommand extends Command {
  #relationshipManager;
  #personRepository;
  #person1Id;
  #person2Id;
  #relationType;

  constructor(relationshipManager, personRepository, person1Id, relationType) {
    super(`Remove ${relationType} relationship`);
    this.#relationshipManager = relationshipManager;
    this.#personRepository = personRepository;
    this.#person1Id = person1Id;
    this.#relationType = relationType;

    // Get person2Id before removal
    const person = personRepository.findById(person1Id);
    if (relationType === 'mother') {
      this.#person2Id = person?.motherId;
    } else if (relationType === 'father') {
      this.#person2Id = person?.fatherId;
    } else if (relationType === 'spouse') {
      this.#person2Id = person?.spouseId;
    }
  }

  async execute() {
    if (this.#relationType === 'spouse') {
      await this.#relationshipManager.removeSpouseRelationship(this.#person1Id);
    } else {
      await this.#relationshipManager.removeParentRelationship(
        this.#person1Id,
        this.#relationType
      );
    }
  }

  async undo() {
    if (!this.#person2Id) return;

    if (this.#relationType === 'spouse') {
      await this.#relationshipManager.createSpouseRelationship(
        this.#person1Id,
        this.#person2Id
      );
    } else {
      await this.#relationshipManager.createParentRelationship(
        this.#person1Id,
        this.#person2Id,
        this.#relationType
      );
    }
  }
}

/**
 * Composite Command - executes multiple commands as one
 */
export class CompositeCommand extends Command {
  #commands;

  constructor(commands, description = 'Multiple actions') {
    super(description);
    this.#commands = commands;
  }

  async execute() {
    for (const command of this.#commands) {
      await command.execute();
    }
  }

  async undo() {
    // Undo in reverse order
    for (let i = this.#commands.length - 1; i >= 0; i--) {
      await this.#commands[i].undo();
    }
  }

  async redo() {
    for (const command of this.#commands) {
      await command.redo();
    }
  }
}

/**
 * Command Manager - manages undo/redo stack
 */
export class CommandManager {
  #undoStack;
  #redoStack;
  #maxStackSize;
  #eventBus;
  #isExecuting;

  constructor(eventBus, maxStackSize = 50) {
    this.#undoStack = [];
    this.#redoStack = [];
    this.#maxStackSize = maxStackSize;
    this.#eventBus = eventBus;
    this.#isExecuting = false;
  }

  /**
   * Execute a command and add to undo stack
   * @param {Command} command
   * @returns {Promise<any>} Result of command execution
   */
  async execute(command) {
    if (this.#isExecuting) {
      throw new Error('Cannot execute command while another is executing');
    }

    this.#isExecuting = true;

    try {
      const result = await command.execute();

      // Add to undo stack
      this.#undoStack.push(command);

      // Limit stack size
      if (this.#undoStack.length > this.#maxStackSize) {
        this.#undoStack.shift();
      }

      // Clear redo stack
      this.#redoStack = [];

      this.#eventBus.emit('command:executed', {
        command: command.getDescription(),
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });

      return result;
    } catch (error) {
      this.#eventBus.emit(EVENTS.ERROR_OCCURRED, {
        message: `Failed to execute command: ${error.message}`,
        type: 'command'
      });
      throw error;
    } finally {
      this.#isExecuting = false;
    }
  }

  /**
   * Undo the last command
   * @returns {Promise<void>}
   */
  async undo() {
    if (!this.canUndo() || this.#isExecuting) {
      return;
    }

    this.#isExecuting = true;

    try {
      const command = this.#undoStack.pop();
      await command.undo();

      // Add to redo stack
      this.#redoStack.push(command);

      this.#eventBus.emit('command:undone', {
        command: command.getDescription(),
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
    } catch (error) {
      this.#eventBus.emit(EVENTS.ERROR_OCCURRED, {
        message: `Failed to undo command: ${error.message}`,
        type: 'undo'
      });
      throw error;
    } finally {
      this.#isExecuting = false;
    }
  }

  /**
   * Redo the last undone command
   * @returns {Promise<void>}
   */
  async redo() {
    if (!this.canRedo() || this.#isExecuting) {
      return;
    }

    this.#isExecuting = true;

    try {
      const command = this.#redoStack.pop();
      await command.redo();

      // Add back to undo stack
      this.#undoStack.push(command);

      this.#eventBus.emit('command:redone', {
        command: command.getDescription(),
        canUndo: this.canUndo(),
        canRedo: this.canRedo()
      });
    } catch (error) {
      this.#eventBus.emit(EVENTS.ERROR_OCCURRED, {
        message: `Failed to redo command: ${error.message}`,
        type: 'redo'
      });
      throw error;
    } finally {
      this.#isExecuting = false;
    }
  }

  /**
   * Check if undo is available
   * @returns {boolean}
   */
  canUndo() {
    return this.#undoStack.length > 0;
  }

  /**
   * Check if redo is available
   * @returns {boolean}
   */
  canRedo() {
    return this.#redoStack.length > 0;
  }

  /**
   * Clear all undo/redo history
   */
  clear() {
    this.#undoStack = [];
    this.#redoStack = [];

    this.#eventBus.emit('command:cleared', {
      canUndo: false,
      canRedo: false
    });
  }

  /**
   * Get undo stack description (for debugging)
   * @returns {string[]}
   */
  getUndoStack() {
    return this.#undoStack.map(cmd => cmd.getDescription());
  }

  /**
   * Get redo stack description (for debugging)
   * @returns {string[]}
   */
  getRedoStack() {
    return this.#redoStack.map(cmd => cmd.getDescription());
  }

  /**
   * Get command history statistics
   * @returns {Object}
   */
  getStats() {
    return {
      undoStackSize: this.#undoStack.length,
      redoStackSize: this.#redoStack.length,
      maxStackSize: this.#maxStackSize,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      memoryEstimate: this.#estimateMemoryUsage()
    };
  }

  /**
   * Estimate memory usage of command stacks
   * @private
   * @returns {string}
   */
  #estimateMemoryUsage() {
    // Rough estimate: ~100 bytes per command
    const totalCommands = this.#undoStack.length + this.#redoStack.length;
    const bytes = totalCommands * 100;

    if (bytes < 1024) {
      return `${bytes} bytes`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
  }
}

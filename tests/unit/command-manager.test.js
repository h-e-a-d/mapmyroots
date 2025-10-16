import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CommandManager,
  AddPersonCommand,
  UpdatePersonCommand,
  DeletePersonCommand,
  MovePersonCommand,
  CompositeCommand
} from '../../src/core/commands/command-manager.js';
import { PersonRepository } from '../../src/data/repositories/person-repository.js';
import { EventBus } from '../../src/utils/event-bus.js';

describe('CommandManager', () => {
  let commandManager;
  let eventBus;
  let personRepository;

  beforeEach(() => {
    eventBus = new EventBus();
    personRepository = new PersonRepository(eventBus);
    commandManager = new CommandManager(eventBus);
  });

  describe('execute', () => {
    it('should execute command and add to undo stack', async () => {
      const command = new AddPersonCommand(personRepository, {
        name: 'John',
        gender: 'male'
      });

      await commandManager.execute(command);

      expect(commandManager.canUndo()).toBe(true);
      expect(commandManager.canRedo()).toBe(false);
      expect(personRepository.count()).toBe(1);
    });

    it('should clear redo stack after executing new command', async () => {
      const command1 = new AddPersonCommand(personRepository, {
        name: 'John',
        gender: 'male'
      });

      await commandManager.execute(command1);
      await commandManager.undo();

      expect(commandManager.canRedo()).toBe(true);

      const command2 = new AddPersonCommand(personRepository, {
        name: 'Jane',
        gender: 'female'
      });

      await commandManager.execute(command2);

      expect(commandManager.canRedo()).toBe(false);
    });
  });

  describe('undo/redo', () => {
    it('should undo and redo add person', async () => {
      const command = new AddPersonCommand(personRepository, {
        name: 'John',
        gender: 'male'
      });

      await commandManager.execute(command);
      expect(personRepository.count()).toBe(1);

      await commandManager.undo();
      expect(personRepository.count()).toBe(0);

      await commandManager.redo();
      expect(personRepository.count()).toBe(1);
    });

    it('should undo and redo update person', async () => {
      const addCommand = new AddPersonCommand(personRepository, {
        name: 'John',
        gender: 'male'
      });

      await commandManager.execute(addCommand);
      const personId = addCommand.getPersonId();

      const updateCommand = new UpdatePersonCommand(personRepository, personId, {
        name: 'Johnny',
        gender: 'male'
      });

      await commandManager.execute(updateCommand);

      const person = personRepository.findById(personId);
      expect(person.name).toBe('Johnny');

      await commandManager.undo();

      const restoredPerson = personRepository.findById(personId);
      expect(restoredPerson.name).toBe('John');

      await commandManager.redo();

      const updatedPerson = personRepository.findById(personId);
      expect(updatedPerson.name).toBe('Johnny');
    });

    it('should handle multiple undo/redo operations', async () => {
      // Add 3 people
      for (let i = 0; i < 3; i++) {
        const command = new AddPersonCommand(personRepository, {
          name: `Person${i}`,
          gender: 'male'
        });
        await commandManager.execute(command);
      }

      expect(personRepository.count()).toBe(3);

      // Undo all
      await commandManager.undo();
      await commandManager.undo();
      await commandManager.undo();

      expect(personRepository.count()).toBe(0);

      // Redo 2
      await commandManager.redo();
      await commandManager.redo();

      expect(personRepository.count()).toBe(2);
    });
  });

  describe('MovePersonCommand', () => {
    it('should move person and undo/redo', async () => {
      const addCommand = new AddPersonCommand(personRepository, {
        name: 'John',
        gender: 'male',
        x: 100,
        y: 200
      });

      await commandManager.execute(addCommand);
      const personId = addCommand.getPersonId();

      const moveCommand = new MovePersonCommand(personRepository, personId, 300, 400);
      await commandManager.execute(moveCommand);

      let person = personRepository.findById(personId);
      expect(person.x).toBe(300);
      expect(person.y).toBe(400);

      await commandManager.undo();

      person = personRepository.findById(personId);
      expect(person.x).toBe(100);
      expect(person.y).toBe(200);

      await commandManager.redo();

      person = personRepository.findById(personId);
      expect(person.x).toBe(300);
      expect(person.y).toBe(400);
    });
  });

  describe('CompositeCommand', () => {
    it('should execute multiple commands as one', async () => {
      const commands = [
        new AddPersonCommand(personRepository, { name: 'John', gender: 'male' }),
        new AddPersonCommand(personRepository, { name: 'Jane', gender: 'female' }),
        new AddPersonCommand(personRepository, { name: 'Bob', gender: 'male' })
      ];

      const composite = new CompositeCommand(commands, 'Add 3 people');
      await commandManager.execute(composite);

      expect(personRepository.count()).toBe(3);

      await commandManager.undo();

      expect(personRepository.count()).toBe(0);

      await commandManager.redo();

      expect(personRepository.count()).toBe(3);
    });
  });

  describe('stack management', () => {
    it('should respect max stack size', async () => {
      const smallCommandManager = new CommandManager(eventBus, 3);

      for (let i = 0; i < 5; i++) {
        const command = new AddPersonCommand(personRepository, {
          name: `Person${i}`,
          gender: 'male'
        });
        await smallCommandManager.execute(command);
      }

      const undoStack = smallCommandManager.getUndoStack();
      expect(undoStack.length).toBe(3);
    });

    it('should provide stack statistics', async () => {
      const command = new AddPersonCommand(personRepository, {
        name: 'John',
        gender: 'male'
      });

      await commandManager.execute(command);
      await commandManager.undo();

      const stats = commandManager.getStats();

      expect(stats.undoStackSize).toBe(0);
      expect(stats.redoStackSize).toBe(1);
      expect(stats.canUndo).toBe(false);
      expect(stats.canRedo).toBe(true);
    });
  });

  describe('memory efficiency', () => {
    it('should use significantly less memory than full state copies', async () => {
      // Add 100 people
      for (let i = 0; i < 100; i++) {
        const command = new AddPersonCommand(personRepository, {
          name: `Person${i}`,
          gender: 'male',
          x: i * 10,
          y: i * 10
        });
        await commandManager.execute(command);
      }

      const stats = commandManager.getStats();

      // With command pattern: ~50 commands × 100 bytes = 5 KB
      // Old approach: 50 states × 100 people × 500 bytes = 2.5 MB
      // Should be significantly smaller

      expect(stats.undoStackSize).toBe(50); // Limited by maxStackSize
      expect(stats.memoryEstimate).toContain('KB'); // Should be in KB, not MB
    });
  });
});

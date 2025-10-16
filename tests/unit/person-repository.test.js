import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PersonRepository } from '../../src/data/repositories/person-repository.js';
import { EventBus, EVENTS } from '../../src/utils/event-bus.js';

describe('PersonRepository', () => {
  let repository;
  let eventBus;
  let mockCache;

  beforeEach(() => {
    eventBus = new EventBus();
    mockCache = {
      savePersonData: vi.fn(),
      deletePersonData: vi.fn(),
      clearAllData: vi.fn(),
      saveAllPersonData: vi.fn()
    };
    repository = new PersonRepository(eventBus, mockCache);
  });

  describe('save', () => {
    it('should save a new person and emit TREE_PERSON_ADDED event', async () => {
      const person = {
        name: 'John Doe',
        gender: 'male',
        x: 100,
        y: 200
      };

      const emitSpy = vi.spyOn(eventBus, 'emit');
      const id = await repository.save(person);

      expect(id).toBeDefined();
      expect(repository.exists(id)).toBe(true);
      expect(emitSpy).toHaveBeenCalledWith(
        EVENTS.TREE_PERSON_ADDED,
        expect.objectContaining({ name: 'John Doe', gender: 'male' })
      );
    });

    it('should update existing person and emit TREE_PERSON_UPDATED event', async () => {
      const person = {
        id: 'test-123',
        name: 'John Doe',
        gender: 'male',
        x: 100,
        y: 200
      };

      await repository.save(person);
      const emitSpy = vi.spyOn(eventBus, 'emit');

      person.name = 'Jane Doe';
      await repository.save(person);

      expect(emitSpy).toHaveBeenCalledWith(
        EVENTS.TREE_PERSON_UPDATED,
        expect.objectContaining({ name: 'Jane Doe' })
      );
    });

    it('should reject invalid person data', async () => {
      const invalidPerson = {
        name: '',
        gender: 'invalid'
      };

      await expect(repository.save(invalidPerson)).rejects.toThrow('Validation failed');
    });

    it('should sanitize text fields', async () => {
      const person = {
        name: 'John<script>alert("xss")</script>',
        gender: 'male'
      };

      const id = await repository.save(person);
      const saved = repository.findById(id);

      expect(saved.name).not.toContain('<script>');
    });
  });

  describe('findById', () => {
    it('should return person by id', async () => {
      const person = {
        name: 'John Doe',
        gender: 'male'
      };

      const id = await repository.save(person);
      const found = repository.findById(id);

      expect(found).toBeDefined();
      expect(found.name).toBe('John Doe');
    });

    it('should return null for non-existent id', () => {
      const found = repository.findById('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('findByRelationship', () => {
    it('should find mother', async () => {
      const mother = { id: 'mom', name: 'Mother', gender: 'female' };
      const child = { name: 'Child', gender: 'male', motherId: 'mom' };

      await repository.save(mother);
      const childId = await repository.save(child);

      const mothers = repository.findByRelationship(childId, 'mother');
      expect(mothers).toHaveLength(1);
      expect(mothers[0].name).toBe('Mother');
    });

    it('should find children', async () => {
      const parent = { id: 'dad', name: 'Father', gender: 'male' };
      const child1 = { name: 'Child1', gender: 'male', fatherId: 'dad' };
      const child2 = { name: 'Child2', gender: 'female', fatherId: 'dad' };

      await repository.save(parent);
      await repository.save(child1);
      await repository.save(child2);

      const children = repository.findByRelationship('dad', 'children');
      expect(children).toHaveLength(2);
    });

    it('should find siblings', async () => {
      const mother = { id: 'mom', name: 'Mother', gender: 'female' };
      const child1 = { id: 'c1', name: 'Child1', gender: 'male', motherId: 'mom' };
      const child2 = { name: 'Child2', gender: 'female', motherId: 'mom' };

      await repository.save(mother);
      await repository.save(child1);
      await repository.save(child2);

      const siblings = repository.findByRelationship('c1', 'siblings');
      // Should exclude the mother and only include siblings
      expect(siblings.length).toBeGreaterThanOrEqual(1);
      expect(siblings.some(s => s.name === 'Child2')).toBe(true);
      expect(siblings.every(s => s.id !== 'mom')).toBe(true);
    });
  });

  describe('delete', () => {
    it('should delete person and emit event', async () => {
      const person = { name: 'John Doe', gender: 'male' };
      const id = await repository.save(person);

      const emitSpy = vi.spyOn(eventBus, 'emit');
      const deleted = await repository.delete(id);

      expect(deleted).toBe(true);
      expect(repository.exists(id)).toBe(false);
      expect(emitSpy).toHaveBeenCalledWith(
        EVENTS.TREE_PERSON_DELETED,
        expect.objectContaining({ id })
      );
    });

    it('should return false for non-existent person', async () => {
      const deleted = await repository.delete('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return repository statistics', async () => {
      await repository.save({ name: 'John', gender: 'male' });
      await repository.save({ name: 'Jane', gender: 'female' });
      await repository.save({ name: 'Bob', gender: 'male', motherId: 'mom' });

      const stats = repository.getStats();
      expect(stats.total).toBe(3);
      expect(stats.males).toBe(2);
      expect(stats.females).toBe(1);
      expect(stats.withMother).toBe(1);
    });
  });

  describe('validation', () => {
    it('should prevent self-referential relationships', async () => {
      const person = {
        id: 'self',
        name: 'Self',
        gender: 'male',
        motherId: 'self'
      };

      await expect(repository.save(person)).rejects.toThrow();
    });

    it('should validate name length', async () => {
      const person = {
        name: 'a'.repeat(101),
        gender: 'male'
      };

      await expect(repository.save(person)).rejects.toThrow();
    });
  });
});

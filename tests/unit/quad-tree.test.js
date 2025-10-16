import { describe, it, expect, beforeEach } from 'vitest';
import { QuadTree, createQuadTreeFromNodes } from '../../src/core/spatial/quad-tree.js';

describe('QuadTree', () => {
  let quadTree;

  beforeEach(() => {
    const bounds = {
      x: 0,
      y: 0,
      width: 1000,
      height: 1000
    };
    quadTree = new QuadTree(bounds, 4);
  });

  describe('insert', () => {
    it('should insert points successfully', () => {
      const point = { x: 100, y: 100, data: { id: 1 } };
      const result = quadTree.insert(point);

      expect(result).toBe(true);
      expect(quadTree.size()).toBe(1);
    });

    it('should not insert points outside bounds', () => {
      const point = { x: 1000, y: 1000, data: { id: 1 } };
      const result = quadTree.insert(point);

      expect(result).toBe(false);
      expect(quadTree.size()).toBe(0);
    });

    it('should subdivide when capacity is exceeded', () => {
      // Insert 5 points (capacity is 4)
      for (let i = 0; i < 5; i++) {
        quadTree.insert({ x: i * 10, y: i * 10, data: { id: i } });
      }

      expect(quadTree.size()).toBe(5);
      expect(quadTree.getDepth()).toBeGreaterThan(1);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Insert test data
      quadTree.insert({ x: 100, y: 100, data: { id: 1 } });
      quadTree.insert({ x: 200, y: 200, data: { id: 2 } });
      quadTree.insert({ x: 300, y: 300, data: { id: 3 } });
      quadTree.insert({ x: 400, y: 400, data: { id: 4 } });
    });

    it('should query points within range', () => {
      const range = {
        x: 150,
        y: 150,
        width: 200,
        height: 200
      };

      const found = quadTree.query(range);

      expect(found.length).toBeGreaterThan(0);
      expect(found.some(p => p.data.id === 2)).toBe(true);
    });

    it('should return empty array for non-intersecting range', () => {
      const range = {
        x: 800,
        y: 800,
        width: 100,
        height: 100
      };

      const found = quadTree.query(range);

      expect(found.length).toBe(0);
    });

    it('should be faster than linear search for large datasets', () => {
      // Insert 1000 points
      for (let i = 0; i < 1000; i++) {
        quadTree.insert({
          x: Math.random() * 1000,
          y: Math.random() * 1000,
          data: { id: i }
        });
      }

      const range = {
        x: 500,
        y: 500,
        width: 100,
        height: 100
      };

      const startTime = performance.now();
      const found = quadTree.query(range);
      const endTime = performance.now();

      const queryTime = endTime - startTime;

      // QuadTree query should be very fast (< 1ms for this range)
      expect(queryTime).toBeLessThan(10);
      expect(found.length).toBeGreaterThan(0);
    });
  });

  describe('queryCircle', () => {
    beforeEach(() => {
      quadTree.insert({ x: 100, y: 100, data: { id: 1 } });
      quadTree.insert({ x: 150, y: 100, data: { id: 2 } });
      quadTree.insert({ x: 200, y: 100, data: { id: 3 } });
      quadTree.insert({ x: 300, y: 300, data: { id: 4 } });
    });

    it('should find points within circle', () => {
      const found = quadTree.queryCircle(100, 100, 60);

      expect(found.length).toBe(2); // id 1 and 2
      expect(found.some(p => p.data.id === 1)).toBe(true);
      expect(found.some(p => p.data.id === 2)).toBe(true);
    });

    it('should not find points outside circle', () => {
      const found = quadTree.queryCircle(100, 100, 60);

      expect(found.some(p => p.data.id === 3)).toBe(false);
      expect(found.some(p => p.data.id === 4)).toBe(false);
    });
  });

  describe('findNearest', () => {
    beforeEach(() => {
      quadTree.insert({ x: 100, y: 100, data: { id: 1, name: 'A' } });
      quadTree.insert({ x: 200, y: 200, data: { id: 2, name: 'B' } });
      quadTree.insert({ x: 300, y: 300, data: { id: 3, name: 'C' } });
    });

    it('should find nearest point', () => {
      const nearest = quadTree.findNearest(110, 110);

      expect(nearest).not.toBeNull();
      expect(nearest.data.name).toBe('A');
    });

    it('should respect max distance', () => {
      const nearest = quadTree.findNearest(110, 110, 5);

      expect(nearest).toBeNull();
    });

    it('should find correct nearest among multiple points', () => {
      const nearest = quadTree.findNearest(195, 195);

      expect(nearest.data.name).toBe('B');
    });
  });

  describe('clear', () => {
    it('should clear all points', () => {
      quadTree.insert({ x: 100, y: 100, data: { id: 1 } });
      quadTree.insert({ x: 200, y: 200, data: { id: 2 } });

      quadTree.clear();

      expect(quadTree.size()).toBe(0);
    });
  });

  describe('createQuadTreeFromNodes', () => {
    it('should create quadtree from node array', () => {
      const nodes = [
        { x: 100, y: 100, id: 1 },
        { x: 200, y: 200, id: 2 },
        { x: 300, y: 300, id: 3 }
      ];

      const tree = createQuadTreeFromNodes(nodes);

      expect(tree.size()).toBe(3);
    });

    it('should calculate appropriate bounds', () => {
      const nodes = [
        { x: 0, y: 0, id: 1 },
        { x: 1000, y: 1000, id: 2 }
      ];

      const tree = createQuadTreeFromNodes(nodes);
      const stats = tree.getStats();

      expect(stats.bounds.width).toBeGreaterThan(1000);
      expect(stats.bounds.height).toBeGreaterThan(1000);
    });

    it('should handle empty array', () => {
      const tree = createQuadTreeFromNodes([]);

      expect(tree.size()).toBe(0);
    });
  });

  describe('performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeQuadTree = new QuadTree({ x: 0, y: 0, width: 10000, height: 10000 }, 4);

      // Insert 5000 points
      const insertStart = performance.now();
      for (let i = 0; i < 5000; i++) {
        largeQuadTree.insert({
          x: Math.random() * 10000,
          y: Math.random() * 10000,
          data: { id: i }
        });
      }
      const insertEnd = performance.now();

      // Query performance
      const queryStart = performance.now();
      const found = largeQuadTree.query({
        x: 5000,
        y: 5000,
        width: 1000,
        height: 1000
      });
      const queryEnd = performance.now();

      const insertTime = insertEnd - insertStart;
      const queryTime = queryEnd - queryStart;

      console.log(`QuadTree Performance:
        - Insert 5000 points: ${insertTime.toFixed(2)}ms
        - Query range: ${queryTime.toFixed(2)}ms
        - Found: ${found.length} points
        - Depth: ${largeQuadTree.getDepth()}`);

      // Should be reasonably fast
      expect(queryTime).toBeLessThan(50);
    });
  });
});

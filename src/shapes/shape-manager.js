/**
 * ShapeManager - Manages different family tree layout shapes
 * Handles shape selection, positioning algorithms, and integration with the tree core
 */

import { GrapeShape } from './grape-shape.js';
import { TreeBranchesShape } from './tree-branches-shape.js';

export class ShapeManager {
    constructor(treeCore) {
        this.treeCore = treeCore;
        this.currentShape = null;
        this.availableShapes = new Map();
        this.isApplyingShape = false;
        
        // Register available shapes
        this.registerShape('grape', GrapeShape);
        this.registerShape('treeBranches', TreeBranchesShape);
        
        // Default shape is none (manual positioning)
        this.currentShapeType = 'none';
    }

    /**
     * Register a new shape type
     * @param {string} name - Shape name
     * @param {class} shapeClass - Shape class constructor
     */
    registerShape(name, shapeClass) {
        this.availableShapes.set(name, shapeClass);
    }

    /**
     * Get all available shape types
     * @returns {Array} Array of shape names
     */
    getAvailableShapes() {
        return ['none', ...Array.from(this.availableShapes.keys())];
    }

    /**
     * Get current shape type
     * @returns {string} Current shape type
     */
    getCurrentShapeType() {
        return this.currentShapeType;
    }

    /**
     * Apply a shape to the current family tree
     * @param {string} shapeType - Type of shape to apply
     * @param {Object} options - Options for shape positioning
     */
    async applyShape(shapeType, options = {}) {
        if (this.isApplyingShape) {
            console.warn('Shape is already being applied');
            return;
        }

        this.isApplyingShape = true;
        
        try {
            // If shape is 'none', just update the current type
            if (shapeType === 'none') {
                this.currentShapeType = 'none';
                this.currentShape = null;
                return;
            }

            // Check if shape exists
            if (!this.availableShapes.has(shapeType)) {
                throw new Error(`Shape type '${shapeType}' not found`);
            }

            // Get people data from tree core
            const people = this.treeCore.getPeople();
            if (!people || people.length === 0) {
                console.warn('No people in tree to arrange');
                return;
            }

            // Create shape instance
            const ShapeClass = this.availableShapes.get(shapeType);
            this.currentShape = new ShapeClass(this.treeCore, options);

            // Apply the shape positioning
            const newPositions = await this.currentShape.calculatePositions(people);
            
            // Update positions in tree core
            this.updatePositions(newPositions);
            
            // Update current shape type
            this.currentShapeType = shapeType;
            
            // Trigger re-render
            this.treeCore.render();
            
            console.log(`Applied ${shapeType} shape to ${people.length} people`);
            
        } catch (error) {
            console.error('Error applying shape:', error);
            throw error;
        } finally {
            this.isApplyingShape = false;
        }
    }

    /**
     * Update positions of people in the tree
     * @param {Map} positions - Map of person ID to {x, y} position
     */
    updatePositions(positions) {
        positions.forEach((position, personId) => {
            this.treeCore.updatePersonPosition(personId, position.x, position.y);
        });
    }

    /**
     * Get shape configuration options for the current shape
     * @returns {Object} Configuration options
     */
    getShapeOptions() {
        if (!this.currentShape) {
            return {};
        }
        return this.currentShape.getOptions();
    }

    /**
     * Update shape options and reapply positioning
     * @param {Object} options - New options to apply
     */
    async updateShapeOptions(options) {
        if (!this.currentShape) {
            return;
        }
        
        await this.currentShape.updateOptions(options);
        await this.applyShape(this.currentShapeType, options);
    }

    /**
     * Check if a shape is currently active
     * @returns {boolean} True if a shape is active
     */
    hasActiveShape() {
        return this.currentShapeType !== 'none';
    }

    /**
     * Reset to manual positioning
     */
    resetToManual() {
        this.currentShapeType = 'none';
        this.currentShape = null;
    }
}
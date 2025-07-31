/**
 * Shapes Module Entry Point
 * Exports all shape-related classes and utilities
 */

export { ShapeManager } from './shape-manager.js';
export { BaseShape } from './base-shape.js';
export { GrapeShape } from './grape-shape.js';
export { TreeBranchesShape } from './tree-branches-shape.js';

// Available shape types
export const SHAPE_TYPES = {
    NONE: 'none',
    GRAPE: 'grape',
    TREE_BRANCHES: 'treeBranches'
};

// Helper function to get all available shapes
export function getAvailableShapes() {
    return [
        {
            type: SHAPE_TYPES.NONE,
            name: 'Manual Positioning',
            description: 'Free-form positioning with drag and drop'
        },
        {
            type: SHAPE_TYPES.GRAPE,
            name: 'Grape Bunch',
            description: 'Arrange family members in a classic grape cluster formation - narrow at stem, widest in middle, tapering to point'
        },
        {
            type: SHAPE_TYPES.TREE_BRANCHES,
            name: 'Tree Branches',
            description: 'Arrange family members in natural tree branching patterns - trunk at top spreading into organic branch clusters'
        }
    ];
}
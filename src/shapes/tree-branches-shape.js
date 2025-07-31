/**
 * TreeBranchesShape - Arranges family tree nodes in a natural tree branching formation
 * Like a real tree with trunk, major branches, sub-branches, and twigs
 */

import { BaseShape } from './base-shape.js';

export class TreeBranchesShape extends BaseShape {
    constructor(treeCore, options = {}) {
        super(treeCore, {
            trunkWidth: 60,        // Width of the main trunk area
            branchSpread: 80,      // How much branches spread horizontally
            verticalSpacing: 120,  // Vertical spacing between generations
            horizontalSpacing: 40, // Horizontal spacing between siblings
            maxBranchWidth: 400,   // Maximum width of branches at any level
            branchingFactor: 0.7,  // How much each branch subdivides
            ...options
        });
    }

    /**
     * Calculate positions for all people in tree branches formation
     * @param {Array} people - Array of person objects
     * @returns {Map} Map of person ID to {x, y} position
     */
    async calculatePositions(people) {
        const positions = new Map();
        
        if (people.length === 0) {
            return positions;
        }

        // Analyze genealogy to understand generations
        const analysis = this.analyzeGenealogy(people);
        const generationGroups = this.groupByGeneration(people, analysis.generations);

        // Calculate tree branches layout
        const branchLayout = this.calculateTreeBranchesLayout(generationGroups, analysis.maxGeneration);
        
        // Apply positions
        branchLayout.forEach((position, personId) => {
            positions.set(personId, position);
        });

        // Center the entire formation
        this.centerPositions(positions, this.options.centerX, this.options.centerY);

        return positions;
    }

    /**
     * Calculate tree branches layout based on generations
     * @param {Map} generationGroups - Map of generation to people array
     * @param {number} maxGeneration - Maximum generation number
     * @returns {Map} Map of person ID to {x, y} position
     */
    calculateTreeBranchesLayout(generationGroups, maxGeneration) {
        const positions = new Map();
        
        let currentY = 0;
        
        // Position each generation in the tree structure
        for (let generation = 0; generation <= maxGeneration; generation++) {
            const people = generationGroups.get(generation) || [];
            if (people.length === 0) continue;
            
            // Calculate branch width for this generation (gets wider as we go down)
            const branchWidth = this.calculateBranchWidth(generation, maxGeneration);
            
            // Calculate positions for this generation using branching algorithm
            const generationPositions = this.positionGenerationInBranches(
                people, 
                generation,
                currentY,
                branchWidth
            );
            
            // Add to positions map
            generationPositions.forEach((pos, personId) => {
                positions.set(personId, pos);
            });
            
            // Update Y position for next generation
            currentY += this.options.verticalSpacing;
        }

        return positions;
    }

    /**
     * Calculate branch width for a given generation (tree spreads wider as it grows)
     * @param {number} generation - Current generation
     * @param {number} maxGeneration - Maximum generation number
     * @returns {number} Branch width for this generation
     */
    calculateBranchWidth(generation, maxGeneration) {
        if (generation === 0) {
            // First generation (trunk) - narrow
            return this.options.trunkWidth;
        }
        
        // Natural tree expansion - exponential growth that levels off
        const growthFactor = 1 - Math.exp(-generation * 0.5);
        const width = this.options.trunkWidth + (this.options.branchSpread * growthFactor * 3);
        
        // Cap at maximum width
        return Math.min(width, this.options.maxBranchWidth);
    }

    /**
     * Position people within a generation using natural branching patterns
     * @param {Array} people - People in this generation
     * @param {number} generation - Generation number
     * @param {number} y - Y position for this generation
     * @param {number} branchWidth - Available width for this generation
     * @returns {Map} Map of person ID to {x, y} position
     */
    positionGenerationInBranches(people, generation, y, branchWidth) {
        const positions = new Map();
        
        if (people.length === 0) {
            return positions;
        }

        if (people.length === 1) {
            // Single person - center them
            positions.set(people[0].id, { x: 0, y });
            return positions;
        }

        if (generation === 0) {
            // Trunk generation - keep tight
            people.forEach((person, index) => {
                const x = (index - (people.length - 1) / 2) * (this.options.horizontalSpacing / 3);
                positions.set(person.id, { x, y });
            });
        } else {
            // Create natural branching clusters
            const branches = this.createNaturalBranches(people, branchWidth);
            
            branches.forEach(branch => {
                branch.people.forEach((person, index) => {
                    const offsetX = (index - (branch.people.length - 1) / 2) * this.options.horizontalSpacing;
                    const x = branch.centerX + offsetX;
                    positions.set(person.id, { x, y });
                });
            });
        }

        return positions;
    }

    /**
     * Create natural branching patterns for a group of people
     * @param {Array} people - People to arrange
     * @param {number} availableWidth - Available width
     * @returns {Array} Array of branch objects with centerX and people
     */
    createNaturalBranches(people, availableWidth) {
        const branches = [];
        
        // Determine number of branches based on people count
        let branchCount;
        if (people.length <= 2) branchCount = 1;
        else if (people.length <= 6) branchCount = 2;
        else if (people.length <= 12) branchCount = 3;
        else if (people.length <= 20) branchCount = 4;
        else branchCount = Math.ceil(people.length / 6);
        
        // Calculate branch spacing
        const branchSpacing = availableWidth / Math.max(branchCount - 1, 1);
        
        // Distribute people among branches (with some natural variation)
        const baseSize = Math.floor(people.length / branchCount);
        const remainder = people.length % branchCount;
        
        let personIndex = 0;
        
        for (let i = 0; i < branchCount; i++) {
            // Natural variation - some branches slightly bigger
            const branchSize = baseSize + (i < remainder ? 1 : 0);
            const branchPeople = people.slice(personIndex, personIndex + branchSize);
            
            if (branchPeople.length > 0) {
                const centerX = (i - (branchCount - 1) / 2) * branchSpacing;
                branches.push({
                    centerX,
                    people: branchPeople
                });
            }
            
            personIndex += branchSize;
        }
        
        return branches;
    }

    /**
     * Get tree branches specific configuration parameters
     * @returns {Object} Configuration parameters
     */
    getConfigParameters() {
        return {
            ...super.getConfigParameters(),
            trunkWidth: {
                type: 'number',
                label: 'Trunk Width',
                min: 40,
                max: 120,
                default: 60
            },
            branchSpread: {
                type: 'number',
                label: 'Branch Spread',
                min: 50,
                max: 150,
                default: 80
            },
            verticalSpacing: {
                type: 'number',
                label: 'Vertical Spacing',
                min: 80,
                max: 200,
                default: 120
            },
            horizontalSpacing: {
                type: 'number',
                label: 'Horizontal Spacing',
                min: 20,
                max: 80,
                default: 40
            },
            maxBranchWidth: {
                type: 'number',
                label: 'Max Branch Width',
                min: 200,
                max: 600,
                default: 400
            },
            branchingFactor: {
                type: 'number',
                label: 'Branching Factor',
                min: 0.3,
                max: 1.0,
                default: 0.7
            }
        };
    }

    /**
     * Get shape display name
     * @returns {string} Display name
     */
    static getDisplayName() {
        return 'Tree Branches';
    }

    /**
     * Get shape description
     * @returns {string} Description
     */
    static getDescription() {
        return 'Arranges family members in a natural tree branching formation. Starts with a narrow trunk and creates organic branch patterns as generations spread out.';
    }
}
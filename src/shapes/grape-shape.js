/**
 * GrapeShape - Arranges family tree nodes in a classic grape bunch formation
 * Narrow at stem, widest in middle, tapering to a point like a real grape
 */

import { BaseShape } from './base-shape.js';

export class GrapeShape extends BaseShape {
    constructor(treeCore, options = {}) {
        super(treeCore, {
            stemWidth: 40,         // Width at the stem (top)
            maxGrapeWidth: 200,    // Maximum width at the widest part
            grapeSpacing: 15,      // Spacing between grapes
            rowSpacing: 10,        // Vertical spacing between rows
            compactness: 0.8,      // How tightly packed the grapes are
            ...options
        });
    }

    /**
     * Calculate positions for all people in grape bunch formation
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

        // Calculate grape bunch layout
        const grapeLayout = this.calculateGrapeBunchLayout(generationGroups, analysis.maxGeneration);
        
        // Apply positions
        grapeLayout.forEach((position, personId) => {
            positions.set(personId, position);
        });

        // Center the entire formation
        this.centerPositions(positions, this.options.centerX, this.options.centerY);

        return positions;
    }

    /**
     * Calculate grape bunch layout based on generations
     * @param {Map} generationGroups - Map of generation to people array
     * @param {number} maxGeneration - Maximum generation number
     * @returns {Map} Map of person ID to {x, y} position
     */
    calculateGrapeBunchLayout(generationGroups, maxGeneration) {
        const positions = new Map();
        
        // Define the grape shape structure
        const grapeStructure = this.defineGrapeStructure(maxGeneration);
        
        let currentY = 0;
        let structureIndex = 0;
        
        // Position each generation in the grape structure
        for (let generation = 0; generation <= maxGeneration; generation++) {
            const people = generationGroups.get(generation) || [];
            if (people.length === 0) continue;
            
            // Get grape row configuration for this generation
            const rowConfig = grapeStructure[Math.min(structureIndex, grapeStructure.length - 1)];
            
            // Calculate positions for this generation
            const generationPositions = this.positionGenerationInGrape(
                people, 
                rowConfig,
                currentY
            );
            
            // Add to positions map
            generationPositions.forEach((pos, personId) => {
                positions.set(personId, pos);
            });
            
            // Update Y position for next generation
            currentY += this.options.generationSpacing + this.options.rowSpacing;
            structureIndex++;
        }

        return positions;
    }

    /**
     * Define the classic grape bunch structure
     * @param {number} maxGeneration - Maximum generation number
     * @returns {Array} Array of row configurations {maxNodes, relativeWidth}
     */
    defineGrapeStructure(maxGeneration) {
        // Classic grape shape: narrow stem → expanding → widest middle → tapering → point
        const baseGrapeStructure = [
            { maxNodes: 1, relativeWidth: 0.2 },  // Stem
            { maxNodes: 2, relativeWidth: 0.4 },  // Upper grape
            { maxNodes: 3, relativeWidth: 0.6 },  // Mid-upper
            { maxNodes: 4, relativeWidth: 0.8 },  // Upper-wide
            { maxNodes: 5, relativeWidth: 1.0 },  // Widest part
            { maxNodes: 4, relativeWidth: 0.8 },  // Mid-lower
            { maxNodes: 3, relativeWidth: 0.6 },  // Lower
            { maxNodes: 2, relativeWidth: 0.4 },  // Near tip
            { maxNodes: 1, relativeWidth: 0.2 }   // Tip
        ];

        // If we have fewer generations, use a shortened grape
        if (maxGeneration < baseGrapeStructure.length) {
            return baseGrapeStructure.slice(0, maxGeneration + 1);
        }
        
        // If we have more generations, extend the grape (repeat the tip)
        const extended = [...baseGrapeStructure];
        while (extended.length <= maxGeneration) {
            extended.push({ maxNodes: 1, relativeWidth: 0.2 });
        }
        
        return extended;
    }

    /**
     * Position people within a generation according to grape structure
     * @param {Array} people - People in this generation
     * @param {Object} rowConfig - Row configuration {maxNodes, relativeWidth}
     * @param {number} y - Y position for this generation
     * @returns {Map} Map of person ID to {x, y} position
     */
    positionGenerationInGrape(people, rowConfig, y) {
        const positions = new Map();
        
        if (people.length === 0) {
            return positions;
        }

        // Calculate the actual width for this row
        const rowWidth = this.options.maxGrapeWidth * rowConfig.relativeWidth;
        
        if (people.length === 1) {
            // Single person - center them
            positions.set(people[0].id, { x: 0, y });
            return positions;
        }

        // If we have more people than the ideal grape row, create multiple sub-rows
        const idealPeoplePerRow = rowConfig.maxNodes;
        const rowsNeeded = Math.ceil(people.length / idealPeoplePerRow);
        
        let personIndex = 0;
        
        for (let subRow = 0; subRow < rowsNeeded; subRow++) {
            const peopleInThisRow = people.slice(
                personIndex, 
                Math.min(personIndex + idealPeoplePerRow, people.length)
            );
            
            if (peopleInThisRow.length === 0) break;
            
            // Calculate positions for this sub-row
            const subRowY = y + (subRow * (this.options.rowSpacing + 50)); // 50 is node height
            const spacing = Math.min(
                rowWidth / Math.max(peopleInThisRow.length - 1, 1),
                this.options.nodeSpacing + this.options.grapeSpacing
            );
            
            peopleInThisRow.forEach((person, index) => {
                const x = (index - (peopleInThisRow.length - 1) / 2) * spacing;
                
                // Add slight random variation for more natural grape look
                const naturalVariation = (Math.random() - 0.5) * this.options.grapeSpacing * 0.3;
                
                positions.set(person.id, { 
                    x: x + naturalVariation, 
                    y: subRowY 
                });
            });
            
            personIndex += peopleInThisRow.length;
        }

        return positions;
    }

    /**
     * Get grape specific configuration parameters
     * @returns {Object} Configuration parameters
     */
    getConfigParameters() {
        return {
            ...super.getConfigParameters(),
            stemWidth: {
                type: 'number',
                label: 'Stem Width',
                min: 20,
                max: 80,
                default: 40
            },
            maxGrapeWidth: {
                type: 'number',
                label: 'Max Grape Width',
                min: 150,
                max: 350,
                default: 200
            },
            grapeSpacing: {
                type: 'number',
                label: 'Grape Spacing',
                min: 10,
                max: 30,
                default: 15
            },
            rowSpacing: {
                type: 'number',
                label: 'Row Spacing',
                min: 5,
                max: 25,
                default: 10
            },
            compactness: {
                type: 'number',
                label: 'Compactness',
                min: 0.5,
                max: 1.0,
                default: 0.8
            }
        };
    }

    /**
     * Get shape display name
     * @returns {string} Display name
     */
    static getDisplayName() {
        return 'Grape Bunch';
    }

    /**
     * Get shape description
     * @returns {string} Description
     */
    static getDescription() {
        return 'Arranges family members in a classic grape bunch formation. Narrow at the stem, widest in the middle, tapering to a point like a real grape cluster.';
    }
}
/**
 * BaseShape - Abstract base class for all family tree shapes
 * Provides common functionality for genealogical analysis and positioning
 */

export class BaseShape {
    constructor(treeCore, options = {}) {
        this.treeCore = treeCore;
        this.options = {
            centerX: 0,
            centerY: 0,
            nodeSpacing: 120,
            generationSpacing: 150,
            ...options
        };
        
        // Cache for genealogical analysis
        this.genealogyCache = new Map();
    }

    /**
     * Calculate positions for all people - must be implemented by subclasses
     * @param {Array} people - Array of person objects
     * @returns {Map} Map of person ID to {x, y} position
     */
    async calculatePositions(people) {
        throw new Error('calculatePositions must be implemented by subclass');
    }

    /**
     * Analyze genealogical relationships and generations
     * @param {Array} people - Array of person objects
     * @returns {Object} Analysis results
     */
    analyzeGenealogy(people) {
        const analysis = {
            generations: new Map(),
            rootPeople: [],
            maxGeneration: 0,
            relationships: new Map()
        };

        // Clear cache
        this.genealogyCache.clear();

        // Find root people (those without parents)
        const peopleWithParents = new Set();
        people.forEach(person => {
            if (person.parents && person.parents.length > 0) {
                peopleWithParents.add(person.id);
            }
        });

        analysis.rootPeople = people.filter(person => !peopleWithParents.has(person.id));

        // If no clear roots, use oldest people as roots
        if (analysis.rootPeople.length === 0) {
            analysis.rootPeople = people.slice(0, Math.min(2, people.length));
        }

        // Calculate generations starting from roots
        analysis.rootPeople.forEach(root => {
            this.calculateGeneration(root, people, 0, analysis.generations);
        });

        // Find max generation
        analysis.generations.forEach((generation, personId) => {
            analysis.maxGeneration = Math.max(analysis.maxGeneration, generation);
        });

        // Build relationship map
        people.forEach(person => {
            analysis.relationships.set(person.id, {
                parents: person.parents || [],
                children: this.findChildren(person.id, people),
                spouses: person.spouses || [],
                siblings: this.findSiblings(person.id, people)
            });
        });

        return analysis;
    }

    /**
     * Calculate generation number for a person recursively
     * @param {Object} person - Person object
     * @param {Array} people - All people
     * @param {number} generation - Current generation
     * @param {Map} generationMap - Map to store results
     */
    calculateGeneration(person, people, generation, generationMap) {
        // Skip if already calculated
        if (generationMap.has(person.id)) {
            return;
        }

        generationMap.set(person.id, generation);

        // Calculate for children
        const children = this.findChildren(person.id, people);
        children.forEach(child => {
            this.calculateGeneration(child, people, generation + 1, generationMap);
        });
    }

    /**
     * Find children of a person
     * @param {string} personId - Person ID
     * @param {Array} people - All people
     * @returns {Array} Array of child person objects
     */
    findChildren(personId, people) {
        return people.filter(person => 
            person.parents && person.parents.includes(personId)
        );
    }

    /**
     * Find siblings of a person
     * @param {string} personId - Person ID
     * @param {Array} people - All people
     * @returns {Array} Array of sibling person objects
     */
    findSiblings(personId, people) {
        const person = people.find(p => p.id === personId);
        if (!person || !person.parents || person.parents.length === 0) {
            return [];
        }

        return people.filter(p => 
            p.id !== personId && 
            p.parents && 
            p.parents.some(parent => person.parents.includes(parent))
        );
    }

    /**
     * Group people by generation
     * @param {Array} people - Array of person objects
     * @param {Map} generationMap - Map of person ID to generation
     * @returns {Map} Map of generation to array of people
     */
    groupByGeneration(people, generationMap) {
        const generations = new Map();
        
        people.forEach(person => {
            const generation = generationMap.get(person.id) || 0;
            if (!generations.has(generation)) {
                generations.set(generation, []);
            }
            generations.get(generation).push(person);
        });

        return generations;
    }

    /**
     * Calculate bounding box for all positions
     * @param {Map} positions - Map of person ID to {x, y} position
     * @returns {Object} Bounding box {minX, maxX, minY, maxY, width, height}
     */
    calculateBoundingBox(positions) {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        positions.forEach(pos => {
            minX = Math.min(minX, pos.x);
            maxX = Math.max(maxX, pos.x);
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        });

        return {
            minX,
            maxX,
            minY,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Center all positions around a specific point
     * @param {Map} positions - Map of person ID to {x, y} position
     * @param {number} centerX - Target center X
     * @param {number} centerY - Target center Y
     */
    centerPositions(positions, centerX = 0, centerY = 0) {
        const bounds = this.calculateBoundingBox(positions);
        const currentCenterX = bounds.minX + bounds.width / 2;
        const currentCenterY = bounds.minY + bounds.height / 2;
        
        const offsetX = centerX - currentCenterX;
        const offsetY = centerY - currentCenterY;

        positions.forEach(pos => {
            pos.x += offsetX;
            pos.y += offsetY;
        });
    }

    /**
     * Get current options
     * @returns {Object} Current options
     */
    getOptions() {
        return { ...this.options };
    }

    /**
     * Update options
     * @param {Object} newOptions - New options to merge
     */
    updateOptions(newOptions) {
        this.options = { ...this.options, ...newOptions };
    }

    /**
     * Get shape-specific configuration parameters
     * @returns {Object} Configuration parameters
     */
    getConfigParameters() {
        return {
            nodeSpacing: {
                type: 'number',
                label: 'Node Spacing',
                min: 80,
                max: 200,
                default: 120
            },
            generationSpacing: {
                type: 'number',
                label: 'Generation Spacing',
                min: 100,
                max: 300,
                default: 150
            }
        };
    }
}
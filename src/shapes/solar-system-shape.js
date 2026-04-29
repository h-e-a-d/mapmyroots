/**
 * SolarSystemShape - Arranges family tree nodes in a solar system formation
 * The center represents the "sun", and each generation forms a concentric circle
 * Higher generations are placed farther from the center
 * Spouses with 0 generation overlap with their spouse's circle
 */

import { BaseShape } from './base-shape.js';

export class SolarSystemShape extends BaseShape {
    constructor(treeCore, options = {}) {
        super(treeCore, {
            minOrbitRadius: 80,        // Minimum radius for first orbit
            orbitIncrement: 150,       // Distance between orbits
            sunRadius: 30,             // Radius of the center "sun" area
            angleOffset: 0,            // Starting angle offset (degrees)
            distributeEvenly: true,    // Evenly distribute nodes around the orbit
            ...options
        });
    }

    /**
     * Calculate positions for all people in solar system formation
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

        // Identify spouses and their generations
        const spouseInfo = this.identifySpouseGenerations(people, analysis);

        // Calculate solar system layout
        const solarLayout = this.calculateSolarSystemLayout(
            generationGroups,
            analysis.maxGeneration,
            spouseInfo,
            people
        );

        // Apply positions
        solarLayout.forEach((position, personId) => {
            positions.set(personId, position);
        });

        // Center the entire formation
        this.centerPositions(positions, this.options.centerX, this.options.centerY);

        return positions;
    }

    /**
     * Identify spouses and their generation relationships
     * Spouses who aren't in the main tree line will have generation 0
     * They should be placed on the same orbit as their spouse
     * @param {Array} people - Array of person objects
     * @param {Object} analysis - Genealogy analysis
     * @returns {Map} Map of person ID to spouse generation info
     */
    identifySpouseGenerations(people, analysis) {
        const spouseInfo = new Map();

        people.forEach(person => {
            const personGeneration = analysis.generations.get(person.id);

            // Check if this person has spouses
            if (person.spouses && person.spouses.length > 0) {
                person.spouses.forEach(spouseId => {
                    const spouse = people.find(p => p.id === spouseId);
                    if (!spouse) return;

                    const spouseGeneration = analysis.generations.get(spouseId);

                    // If spouse has no generation (not in main line), they should be on same orbit
                    if (spouseGeneration === undefined || spouseGeneration === 0) {
                        const hasParents = spouse.parents && spouse.parents.length > 0;
                        const hasChildren = this.findChildren(spouseId, people).length > 0;

                        // If spouse has no parents and no relatives in tree, place on partner's orbit
                        if (!hasParents && hasChildren) {
                            spouseInfo.set(spouseId, {
                                useSpouseOrbit: true,
                                targetGeneration: personGeneration
                            });
                        }
                    }
                });
            }
        });

        return spouseInfo;
    }

    /**
     * Calculate solar system layout based on generations
     * @param {Map} generationGroups - Map of generation to people array
     * @param {number} maxGeneration - Maximum generation number
     * @param {Map} spouseInfo - Spouse generation information
     * @param {Array} people - All people
     * @returns {Map} Map of person ID to {x, y} position
     */
    calculateSolarSystemLayout(generationGroups, maxGeneration, spouseInfo, people) {
        const positions = new Map();

        // Position each generation on its orbit
        for (let generation = 0; generation <= maxGeneration; generation++) {
            const generationPeople = generationGroups.get(generation) || [];

            // Add spouses who should be on this orbit
            const peopleOnThisOrbit = [...generationPeople];
            spouseInfo.forEach((info, spouseId) => {
                if (info.useSpouseOrbit && info.targetGeneration === generation) {
                    const spouse = people.find(p => p.id === spouseId);
                    if (spouse && !peopleOnThisOrbit.includes(spouse)) {
                        peopleOnThisOrbit.push(spouse);
                    }
                }
            });

            if (peopleOnThisOrbit.length === 0) continue;

            // Calculate orbit radius for this generation
            const orbitRadius = this.calculateOrbitRadius(generation);

            // Position people around the orbit
            const orbitPositions = this.positionPeopleOnOrbit(
                peopleOnThisOrbit,
                orbitRadius,
                generation,
                spouseInfo
            );

            // Add to positions map
            orbitPositions.forEach((pos, personId) => {
                positions.set(personId, pos);
            });
        }

        return positions;
    }

    /**
     * Calculate the radius for a given generation orbit
     * @param {number} generation - Generation number
     * @returns {number} Orbit radius
     */
    calculateOrbitRadius(generation) {
        if (generation === 0) {
            return this.options.sunRadius;
        }
        return this.options.minOrbitRadius + (generation - 1) * this.options.orbitIncrement;
    }

    /**
     * Position people around a circular orbit
     * @param {Array} people - People to position on this orbit
     * @param {number} radius - Orbit radius
     * @param {number} generation - Generation number
     * @param {Map} spouseInfo - Spouse information
     * @returns {Map} Map of person ID to {x, y} position
     */
    positionPeopleOnOrbit(people, radius, generation, spouseInfo) {
        const positions = new Map();

        if (people.length === 0) {
            return positions;
        }

        // For generation 0 (center/sun), place in the center
        if (generation === 0) {
            if (people.length === 1) {
                positions.set(people[0].id, { x: 0, y: 0 });
            } else {
                // Multiple people at center - arrange in small circle
                people.forEach((person, index) => {
                    const angle = (index / people.length) * 2 * Math.PI + this.degreesToRadians(this.options.angleOffset);
                    const x = this.options.sunRadius * Math.cos(angle);
                    const y = this.options.sunRadius * Math.sin(angle);
                    positions.set(person.id, { x, y });
                });
            }
            return positions;
        }

        // Group spouses together for better visual arrangement
        const arrangedPeople = this.groupSpousesTogetherForOrbit(people, spouseInfo);

        // Distribute people evenly around the orbit
        if (this.options.distributeEvenly) {
            arrangedPeople.forEach((person, index) => {
                const angle = (index / arrangedPeople.length) * 2 * Math.PI + this.degreesToRadians(this.options.angleOffset);
                const x = radius * Math.cos(angle);
                const y = radius * Math.sin(angle);
                positions.set(person.id, { x, y });
            });
        } else {
            // Alternative: distribute with some spacing variation
            let currentAngle = this.degreesToRadians(this.options.angleOffset);
            const angleIncrement = (2 * Math.PI) / arrangedPeople.length;

            arrangedPeople.forEach(person => {
                const x = radius * Math.cos(currentAngle);
                const y = radius * Math.sin(currentAngle);
                positions.set(person.id, { x, y });
                currentAngle += angleIncrement;
            });
        }

        return positions;
    }

    /**
     * Group spouses together in the arrangement for better visual cohesion
     * @param {Array} people - People on this orbit
     * @param {Map} spouseInfo - Spouse information
     * @returns {Array} Arranged people with spouses grouped
     */
    groupSpousesTogetherForOrbit(people, spouseInfo) {
        const arranged = [];
        const processed = new Set();

        people.forEach(person => {
            if (processed.has(person.id)) return;

            arranged.push(person);
            processed.add(person.id);

            // Check if this person has spouses on the same orbit
            if (person.spouses && person.spouses.length > 0) {
                person.spouses.forEach(spouseId => {
                    const spouse = people.find(p => p.id === spouseId);
                    if (spouse && !processed.has(spouseId)) {
                        arranged.push(spouse);
                        processed.add(spouseId);
                    }
                });
            }
        });

        return arranged;
    }

    /**
     * Convert degrees to radians
     * @param {number} degrees - Angle in degrees
     * @returns {number} Angle in radians
     */
    degreesToRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    /**
     * Get solar system specific configuration parameters
     * @returns {Object} Configuration parameters
     */
    getConfigParameters() {
        return {
            ...super.getConfigParameters(),
            minOrbitRadius: {
                type: 'number',
                label: 'Min Orbit Radius',
                min: 50,
                max: 150,
                default: 80
            },
            orbitIncrement: {
                type: 'number',
                label: 'Orbit Spacing',
                min: 100,
                max: 250,
                default: 150
            },
            sunRadius: {
                type: 'number',
                label: 'Sun Radius',
                min: 20,
                max: 60,
                default: 30
            },
            angleOffset: {
                type: 'number',
                label: 'Angle Offset (degrees)',
                min: 0,
                max: 360,
                default: 0
            },
            distributeEvenly: {
                type: 'boolean',
                label: 'Distribute Evenly',
                default: true
            }
        };
    }

    /**
     * Get shape display name
     * @returns {string} Display name
     */
    static getDisplayName() {
        return 'Solar System';
    }

    /**
     * Get shape description
     * @returns {string} Description
     */
    static getDescription() {
        return 'Arranges family members in a solar system formation with concentric circles. Each generation forms an orbit around the center, with higher generations placed farther out. Spouses are positioned on the same orbit as their partners.';
    }
}

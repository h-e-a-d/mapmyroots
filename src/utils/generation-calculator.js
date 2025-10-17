// generation-calculator.js
// Automatically calculates generation numbers based on parent-child relationships
// Generation is relative - the algorithm assigns generation 0 to root nodes (people with no parents)
// and increments from there

/**
 * Calculates generation numbers for all persons in the family tree
 * Generation numbers are automatically determined based on parent-child relationships
 *
 * Algorithm:
 * 1. Find all root nodes (people with no parents) and assign them generation 0
 * 2. Traverse the tree from roots, assigning children generation = parent_generation + 1
 * 3. If a person has multiple paths to roots, use the minimum generation number
 * 4. Handle cycles gracefully
 */
export class GenerationCalculator {
  constructor() {
    this.generationCache = new Map();
  }

  /**
   * Calculate generations for all persons in the tree
   * @param {Map} personData - Map of person ID to person data
   * @returns {Map} Map of person ID to generation number
   */
  calculateGenerations(personData) {
    if (!personData || personData.size === 0) {
      return new Map();
    }

    this.generationCache.clear();
    const visiting = new Set(); // For cycle detection
    const visited = new Set();

    console.log('Starting generation calculation for', personData.size, 'people');

    // First pass: Find all root nodes (people with no parents)
    const rootNodes = [];
    for (const [id, data] of personData) {
      const hasMother = data.motherId && personData.has(data.motherId);
      const hasFather = data.fatherId && personData.has(data.fatherId);

      if (!hasMother && !hasFather) {
        rootNodes.push(id);
        this.generationCache.set(id, 0);
        console.log(`Root node found: ${id} (${data.name}) - Generation 0`);
      }
    }

    console.log(`Found ${rootNodes.length} root nodes`);

    // If no root nodes found, find the oldest person by DOB as root
    if (rootNodes.length === 0) {
      console.log('No root nodes found, finding oldest person by DOB');
      let oldestId = null;
      let oldestYear = Infinity;

      for (const [id, data] of personData) {
        const year = this.extractYear(data.dob);
        if (year && year < oldestYear) {
          oldestYear = year;
          oldestId = id;
        }
      }

      if (oldestId) {
        rootNodes.push(oldestId);
        this.generationCache.set(oldestId, 0);
        const person = personData.get(oldestId);
        console.log(`Using oldest person as root: ${oldestId} (${person.name}, ${person.dob}) - Generation 0`);
      } else {
        // Last resort: pick the first person
        const firstId = Array.from(personData.keys())[0];
        rootNodes.push(firstId);
        this.generationCache.set(firstId, 0);
        const person = personData.get(firstId);
        console.log(`Using first person as root: ${firstId} (${person.name}) - Generation 0`);
      }
    }

    // Second pass: Traverse from roots and calculate descendant generations
    for (const rootId of rootNodes) {
      this.traverseDescendants(rootId, 0, personData, visiting, visited);
    }

    // Third pass: Calculate ancestor generations (for people who might be ancestors of roots)
    for (const [id, data] of personData) {
      if (!this.generationCache.has(id)) {
        this.calculateAncestorGeneration(id, personData, visiting);
      }
    }

    console.log('Generation calculation complete:', this.generationCache.size, 'generations assigned');

    // Log generation distribution
    const genDistribution = new Map();
    for (const gen of this.generationCache.values()) {
      genDistribution.set(gen, (genDistribution.get(gen) || 0) + 1);
    }
    console.log('Generation distribution:', Array.from(genDistribution.entries()).sort((a, b) => a[0] - b[0]));

    return new Map(this.generationCache);
  }

  /**
   * Traverse descendants from a person and assign generations
   */
  traverseDescendants(personId, generation, personData, visiting, visited) {
    if (visiting.has(personId)) {
      console.warn(`Cycle detected at person ${personId}`);
      return; // Prevent infinite loops
    }

    if (visited.has(personId)) {
      // Already visited, but check if we found a shorter path
      const currentGen = this.generationCache.get(personId);
      if (generation < currentGen) {
        this.generationCache.set(personId, generation);
        console.log(`Updated ${personId} to generation ${generation} (was ${currentGen})`);
      }
      return;
    }

    visiting.add(personId);

    // Set generation for this person
    if (!this.generationCache.has(personId)) {
      this.generationCache.set(personId, generation);
    } else {
      // Use minimum generation if multiple paths exist
      const currentGen = this.generationCache.get(personId);
      if (generation < currentGen) {
        this.generationCache.set(personId, generation);
      }
    }

    // Find all children of this person
    const children = this.findChildren(personId, personData);

    for (const childId of children) {
      this.traverseDescendants(childId, generation + 1, personData, visiting, visited);
    }

    visiting.delete(personId);
    visited.add(personId);
  }

  /**
   * Calculate generation for a person by traversing up to ancestors
   */
  calculateAncestorGeneration(personId, personData, visiting) {
    if (this.generationCache.has(personId) || visiting.has(personId)) {
      return this.generationCache.get(personId) || 0;
    }

    visiting.add(personId);

    const person = personData.get(personId);
    if (!person) {
      visiting.delete(personId);
      return 0;
    }

    const parentGenerations = [];

    // Check mother
    if (person.motherId && personData.has(person.motherId)) {
      if (this.generationCache.has(person.motherId)) {
        parentGenerations.push(this.generationCache.get(person.motherId));
      } else {
        const motherGen = this.calculateAncestorGeneration(person.motherId, personData, visiting);
        parentGenerations.push(motherGen);
      }
    }

    // Check father
    if (person.fatherId && personData.has(person.fatherId)) {
      if (this.generationCache.has(person.fatherId)) {
        parentGenerations.push(this.generationCache.get(person.fatherId));
      } else {
        const fatherGen = this.calculateAncestorGeneration(person.fatherId, personData, visiting);
        parentGenerations.push(fatherGen);
      }
    }

    let generation;
    if (parentGenerations.length > 0) {
      // Generation is max parent generation + 1
      generation = Math.max(...parentGenerations) + 1;
    } else {
      // No parents, this is a root node
      generation = 0;
    }

    this.generationCache.set(personId, generation);
    visiting.delete(personId);

    return generation;
  }

  /**
   * Find all children of a person
   */
  findChildren(personId, personData) {
    const children = [];

    for (const [id, data] of personData) {
      if (data.motherId === personId || data.fatherId === personId) {
        children.push(id);
      }
    }

    return children;
  }

  /**
   * Extract year from date string
   */
  extractYear(dateStr) {
    if (!dateStr) return null;

    // Try to extract 4-digit year
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) {
      return parseInt(yearMatch[0]);
    }

    return null;
  }

  /**
   * Get generation number for a specific person
   * @param {string} personId - Person ID
   * @returns {number|null} Generation number or null if not calculated
   */
  getGeneration(personId) {
    return this.generationCache.get(personId) || null;
  }

  /**
   * Get all people in a specific generation
   * @param {number} generation - Generation number
   * @returns {Array<string>} Array of person IDs in that generation
   */
  getPeopleInGeneration(generation) {
    const people = [];

    for (const [personId, gen] of this.generationCache) {
      if (gen === generation) {
        people.push(personId);
      }
    }

    return people;
  }

  /**
   * Get statistics about generation distribution
   * @returns {Object} Statistics object
   */
  getStatistics() {
    if (this.generationCache.size === 0) {
      return {
        totalPeople: 0,
        minGeneration: null,
        maxGeneration: null,
        generationCount: 0,
        distribution: {}
      };
    }

    const generations = Array.from(this.generationCache.values());
    const distribution = {};

    for (const gen of generations) {
      distribution[gen] = (distribution[gen] || 0) + 1;
    }

    return {
      totalPeople: this.generationCache.size,
      minGeneration: Math.min(...generations),
      maxGeneration: Math.max(...generations),
      generationCount: Object.keys(distribution).length,
      distribution
    };
  }

  /**
   * Clear the generation cache
   */
  clear() {
    this.generationCache.clear();
  }
}

/**
 * QuadTree - Spatial indexing for efficient node queries
 *
 * Benefits:
 * - O(log n) spatial queries instead of O(n)
 * - Efficient viewport culling for large trees
 * - Fast collision detection
 * - Reduces rendering time for 500+ nodes
 *
 * This addresses scalability issue #4 - performance with large trees.
 */

/**
 * Rectangle bounds
 * @typedef {Object} Bounds
 * @property {number} x - Center X
 * @property {number} y - Center Y
 * @property {number} width - Width
 * @property {number} height - Height
 */

/**
 * Point with data
 * @typedef {Object} Point
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {*} data - Associated data (e.g., person node)
 */

export class QuadTree {
  #bounds;
  #capacity;
  #points;
  #divided;
  #northeast;
  #northwest;
  #southeast;
  #southwest;

  /**
   * Create a QuadTree
   * @param {Bounds} bounds - Boundary of this quad
   * @param {number} capacity - Maximum points before subdivision (default: 4)
   */
  constructor(bounds, capacity = 4) {
    this.#bounds = bounds;
    this.#capacity = capacity;
    this.#points = [];
    this.#divided = false;
    this.#northeast = null;
    this.#northwest = null;
    this.#southeast = null;
    this.#southwest = null;
  }

  /**
   * Insert a point into the quadtree
   * @param {Point} point
   * @returns {boolean} True if inserted successfully
   */
  insert(point) {
    // Ignore points that don't belong in this quad tree
    if (!this.#contains(point)) {
      return false;
    }

    // If there's space in this quad tree and it doesn't have subdivisions, add the point here
    if (this.#points.length < this.#capacity && !this.#divided) {
      this.#points.push(point);
      return true;
    }

    // Otherwise, subdivide and add the point to whichever node will accept it
    if (!this.#divided) {
      this.#subdivide();
    }

    // Try to insert into subdivisions
    if (this.#northeast.insert(point)) return true;
    if (this.#northwest.insert(point)) return true;
    if (this.#southeast.insert(point)) return true;
    if (this.#southwest.insert(point)) return true;

    // This should never happen
    return false;
  }

  /**
   * Query points within a range
   * @param {Bounds} range - Query bounds
   * @param {Point[]} found - Array to store found points (optional)
   * @returns {Point[]} Found points
   */
  query(range, found = []) {
    // If range doesn't intersect this quad, return empty array
    if (!this.#intersects(range)) {
      return found;
    }

    // Check points in this quad
    for (const point of this.#points) {
      if (this.#inRange(point, range)) {
        found.push(point);
      }
    }

    // If subdivided, query subdivisions
    if (this.#divided) {
      this.#northeast.query(range, found);
      this.#northwest.query(range, found);
      this.#southeast.query(range, found);
      this.#southwest.query(range, found);
    }

    return found;
  }

  /**
   * Query points within a circle
   * @param {number} x - Circle center X
   * @param {number} y - Circle center Y
   * @param {number} radius - Circle radius
   * @param {Point[]} found - Array to store found points (optional)
   * @returns {Point[]} Found points
   */
  queryCircle(x, y, radius, found = []) {
    // Create a bounding box for the circle
    const range = {
      x: x,
      y: y,
      width: radius * 2,
      height: radius * 2
    };

    // If range doesn't intersect this quad, return empty array
    if (!this.#intersects(range)) {
      return found;
    }

    // Check points in this quad (with actual circle distance check)
    for (const point of this.#points) {
      const dx = point.x - x;
      const dy = point.y - y;
      const distanceSquared = dx * dx + dy * dy;

      if (distanceSquared <= radius * radius) {
        found.push(point);
      }
    }

    // If subdivided, query subdivisions
    if (this.#divided) {
      this.#northeast.queryCircle(x, y, radius, found);
      this.#northwest.queryCircle(x, y, radius, found);
      this.#southeast.queryCircle(x, y, radius, found);
      this.#southwest.queryCircle(x, y, radius, found);
    }

    return found;
  }

  /**
   * Find the nearest point to given coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {number} maxDistance - Maximum search distance (optional)
   * @returns {Point|null} Nearest point or null
   */
  findNearest(x, y, maxDistance = Infinity) {
    let nearest = null;
    let nearestDistance = maxDistance;

    const search = (quad) => {
      // Skip if this quad doesn't intersect search area
      const searchRange = {
        x: x,
        y: y,
        width: nearestDistance * 2,
        height: nearestDistance * 2
      };

      if (!quad.#intersects(searchRange)) {
        return;
      }

      // Check points in this quad
      for (const point of quad.#points) {
        const dx = point.x - x;
        const dy = point.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = point;
        }
      }

      // Recursively search subdivisions
      if (quad.#divided) {
        search(quad.#northeast);
        search(quad.#northwest);
        search(quad.#southeast);
        search(quad.#southwest);
      }
    };

    search(this);
    return nearest;
  }

  /**
   * Clear all points from the quadtree
   */
  clear() {
    this.#points = [];
    this.#divided = false;
    this.#northeast = null;
    this.#northwest = null;
    this.#southeast = null;
    this.#southwest = null;
  }

  /**
   * Get all points in the quadtree
   * @returns {Point[]}
   */
  getAllPoints() {
    const points = [...this.#points];

    if (this.#divided) {
      points.push(...this.#northeast.getAllPoints());
      points.push(...this.#northwest.getAllPoints());
      points.push(...this.#southeast.getAllPoints());
      points.push(...this.#southwest.getAllPoints());
    }

    return points;
  }

  /**
   * Get the total number of points
   * @returns {number}
   */
  size() {
    let count = this.#points.length;

    if (this.#divided) {
      count += this.#northeast.size();
      count += this.#northwest.size();
      count += this.#southeast.size();
      count += this.#southwest.size();
    }

    return count;
  }

  /**
   * Get tree depth (for debugging)
   * @returns {number}
   */
  getDepth() {
    if (!this.#divided) {
      return 1;
    }

    return 1 + Math.max(
      this.#northeast.getDepth(),
      this.#northwest.getDepth(),
      this.#southeast.getDepth(),
      this.#southwest.getDepth()
    );
  }

  /**
   * Get tree statistics (for debugging)
   * @returns {Object}
   */
  getStats() {
    return {
      totalPoints: this.size(),
      depth: this.getDepth(),
      capacity: this.#capacity,
      bounds: this.#bounds
    };
  }

  /**
   * Subdivide this quad into four sub-quads
   * @private
   */
  #subdivide() {
    const { x, y, width, height } = this.#bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    const quarterWidth = width / 4;
    const quarterHeight = height / 4;

    const neBounds = {
      x: x + quarterWidth,
      y: y - quarterHeight,
      width: halfWidth,
      height: halfHeight
    };

    const nwBounds = {
      x: x - quarterWidth,
      y: y - quarterHeight,
      width: halfWidth,
      height: halfHeight
    };

    const seBounds = {
      x: x + quarterWidth,
      y: y + quarterHeight,
      width: halfWidth,
      height: halfHeight
    };

    const swBounds = {
      x: x - quarterWidth,
      y: y + quarterHeight,
      width: halfWidth,
      height: halfHeight
    };

    this.#northeast = new QuadTree(neBounds, this.#capacity);
    this.#northwest = new QuadTree(nwBounds, this.#capacity);
    this.#southeast = new QuadTree(seBounds, this.#capacity);
    this.#southwest = new QuadTree(swBounds, this.#capacity);

    this.#divided = true;

    // Redistribute existing points to subdivisions
    for (const point of this.#points) {
      this.#northeast.insert(point) ||
      this.#northwest.insert(point) ||
      this.#southeast.insert(point) ||
      this.#southwest.insert(point);
    }

    // Clear points from this level
    this.#points = [];
  }

  /**
   * Check if a point is within this quad's bounds
   * @private
   * @param {Point} point
   * @returns {boolean}
   */
  #contains(point) {
    const { x, y, width, height } = this.#bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    return (
      point.x >= x - halfWidth &&
      point.x < x + halfWidth &&
      point.y >= y - halfHeight &&
      point.y < y + halfHeight
    );
  }

  /**
   * Check if a range intersects this quad's bounds
   * @private
   * @param {Bounds} range
   * @returns {boolean}
   */
  #intersects(range) {
    const { x, y, width, height } = this.#bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const rangeHalfWidth = range.width / 2;
    const rangeHalfHeight = range.height / 2;

    return !(
      range.x - rangeHalfWidth > x + halfWidth ||
      range.x + rangeHalfWidth < x - halfWidth ||
      range.y - rangeHalfHeight > y + halfHeight ||
      range.y + rangeHalfHeight < y - halfHeight
    );
  }

  /**
   * Check if a point is within a range
   * @private
   * @param {Point} point
   * @param {Bounds} range
   * @returns {boolean}
   */
  #inRange(point, range) {
    const halfWidth = range.width / 2;
    const halfHeight = range.height / 2;

    return (
      point.x >= range.x - halfWidth &&
      point.x < range.x + halfWidth &&
      point.y >= range.y - halfHeight &&
      point.y < range.y + halfHeight
    );
  }

  /**
   * Draw the quadtree boundaries (for debugging/visualization)
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    const { x, y, width, height } = this.#bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
    ctx.strokeRect(
      x - halfWidth,
      y - halfHeight,
      width,
      height
    );

    if (this.#divided) {
      this.#northeast.draw(ctx);
      this.#northwest.draw(ctx);
      this.#southeast.draw(ctx);
      this.#southwest.draw(ctx);
    }

    // Draw points
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    for (const point of this.#points) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Create a quadtree from a list of nodes
 * @param {Object[]} nodes - Array of node objects with x, y properties
 * @param {number} capacity - Capacity per quad (default: 4)
 * @returns {QuadTree}
 */
export function createQuadTreeFromNodes(nodes, capacity = 4) {
  if (nodes.length === 0) {
    // Default bounds
    return new QuadTree({ x: 0, y: 0, width: 2000, height: 2000 }, capacity);
  }

  // Calculate bounds that contain all nodes
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  }

  // Add padding
  const padding = 100;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  const width = maxX - minX;
  const height = maxY - minY;
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  const bounds = {
    x: centerX,
    y: centerY,
    width,
    height
  };

  const quadTree = new QuadTree(bounds, capacity);

  // Insert all nodes
  for (const node of nodes) {
    quadTree.insert({
      x: node.x,
      y: node.y,
      data: node
    });
  }

  return quadTree;
}

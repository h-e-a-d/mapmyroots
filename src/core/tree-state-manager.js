/**
 * TreeStateManager - Manages tree UI state
 *
 * Responsibilities:
 * - Track selected nodes
 * - Manage camera/viewport state (pan, zoom)
 * - Handle drag operations
 * - Track UI interaction modes
 *
 * This extracts state management from TreeEngine to follow Single Responsibility Principle.
 */

import { EVENTS } from '../utils/event-bus.js';

export class TreeStateManager {
  #eventBus;

  // Selection state
  #selectedNodes;
  #hoveredNodeId;

  // Camera state
  #cameraX;
  #cameraY;
  #scale;

  // Drag state
  #isDragging;
  #dragStartPos;
  #draggedNodeId;

  // Interaction modes
  #mode; // 'select', 'connect', 'pan'
  #connectionState;

  constructor(eventBus) {
    this.#eventBus = eventBus;

    // Initialize selection state
    this.#selectedNodes = new Set();
    this.#hoveredNodeId = null;

    // Initialize camera state
    this.#cameraX = 0;
    this.#cameraY = 0;
    this.#scale = 1;

    // Initialize drag state
    this.#isDragging = false;
    this.#dragStartPos = null;
    this.#draggedNodeId = null;

    // Initialize interaction mode
    this.#mode = 'select';
    this.#connectionState = {
      personA: null,
      personB: null
    };
  }

  // ========== Selection Management ==========

  /**
   * Select a node
   * @param {string} nodeId
   * @param {boolean} multiSelect - Add to selection (Ctrl/Cmd key)
   */
  selectNode(nodeId, multiSelect = false) {
    if (!multiSelect) {
      this.#selectedNodes.clear();
    }

    this.#selectedNodes.add(nodeId);
    this.#eventBus.emit(EVENTS.CANVAS_NODE_SELECTED, {
      nodeId,
      selectedNodes: this.getSelectedNodes(),
      multiSelect
    });
  }

  /**
   * Deselect a node
   * @param {string} nodeId
   */
  deselectNode(nodeId) {
    this.#selectedNodes.delete(nodeId);
    this.#eventBus.emit('node:deselected', {
      nodeId,
      selectedNodes: this.getSelectedNodes()
    });
  }

  /**
   * Toggle node selection
   * @param {string} nodeId
   */
  toggleNodeSelection(nodeId) {
    if (this.#selectedNodes.has(nodeId)) {
      this.deselectNode(nodeId);
    } else {
      this.selectNode(nodeId, true);
    }
  }

  /**
   * Clear all selections
   */
  clearSelection() {
    const hadSelection = this.#selectedNodes.size > 0;
    this.#selectedNodes.clear();

    if (hadSelection) {
      this.#eventBus.emit('selection:cleared');
    }
  }

  /**
   * Get selected node IDs
   * @returns {string[]}
   */
  getSelectedNodes() {
    return Array.from(this.#selectedNodes);
  }

  /**
   * Check if a node is selected
   * @param {string} nodeId
   * @returns {boolean}
   */
  isNodeSelected(nodeId) {
    return this.#selectedNodes.has(nodeId);
  }

  /**
   * Get selected node count
   * @returns {number}
   */
  getSelectedCount() {
    return this.#selectedNodes.size;
  }

  /**
   * Set hovered node
   * @param {string|null} nodeId
   */
  setHoveredNode(nodeId) {
    if (this.#hoveredNodeId !== nodeId) {
      const previousHovered = this.#hoveredNodeId;
      this.#hoveredNodeId = nodeId;

      this.#eventBus.emit('node:hover:changed', {
        previousHovered,
        currentHovered: nodeId
      });
    }
  }

  /**
   * Get hovered node ID
   * @returns {string|null}
   */
  getHoveredNode() {
    return this.#hoveredNodeId;
  }

  // ========== Camera Management ==========

  /**
   * Set camera position
   * @param {number} x
   * @param {number} y
   */
  setCameraPosition(x, y) {
    this.#cameraX = x;
    this.#cameraY = y;

    this.#eventBus.emit(EVENTS.CANVAS_PAN_CHANGED, {
      x: this.#cameraX,
      y: this.#cameraY
    });
  }

  /**
   * Pan camera by delta
   * @param {number} dx
   * @param {number} dy
   */
  panCamera(dx, dy) {
    this.setCameraPosition(this.#cameraX + dx, this.#cameraY + dy);
  }

  /**
   * Get camera position
   * @returns {{x: number, y: number}}
   */
  getCameraPosition() {
    return { x: this.#cameraX, y: this.#cameraY };
  }

  /**
   * Set zoom scale
   * @param {number} scale
   * @param {number} [centerX] - Zoom center X (optional)
   * @param {number} [centerY] - Zoom center Y (optional)
   */
  setScale(scale, centerX, centerY) {
    // Clamp scale between min and max
    const minScale = 0.1;
    const maxScale = 5;
    const newScale = Math.max(minScale, Math.min(maxScale, scale));

    // If zooming around a point, adjust camera to keep that point fixed
    if (centerX !== undefined && centerY !== undefined) {
      const scaleFactor = newScale / this.#scale;
      this.#cameraX = centerX - (centerX - this.#cameraX) * scaleFactor;
      this.#cameraY = centerY - (centerY - this.#cameraY) * scaleFactor;
    }

    this.#scale = newScale;

    this.#eventBus.emit(EVENTS.CANVAS_ZOOM_CHANGED, {
      scale: this.#scale,
      centerX,
      centerY
    });
  }

  /**
   * Zoom in
   * @param {number} [centerX]
   * @param {number} [centerY]
   */
  zoomIn(centerX, centerY) {
    this.setScale(this.#scale * 1.2, centerX, centerY);
  }

  /**
   * Zoom out
   * @param {number} [centerX]
   * @param {number} [centerY]
   */
  zoomOut(centerX, centerY) {
    this.setScale(this.#scale / 1.2, centerX, centerY);
  }

  /**
   * Reset zoom to default
   */
  resetZoom() {
    this.setScale(1);
  }

  /**
   * Get current scale
   * @returns {number}
   */
  getScale() {
    return this.#scale;
  }

  /**
   * Reset camera to origin
   */
  resetCamera() {
    this.setCameraPosition(0, 0);
    this.resetZoom();
  }

  /**
   * Center camera on specific point
   * @param {number} x
   * @param {number} y
   * @param {number} canvasWidth
   * @param {number} canvasHeight
   */
  centerOn(x, y, canvasWidth, canvasHeight) {
    this.setCameraPosition(
      canvasWidth / 2 - x * this.#scale,
      canvasHeight / 2 - y * this.#scale
    );
  }

  // ========== Drag Management ==========

  /**
   * Start dragging a node
   * @param {string} nodeId
   * @param {number} startX - Mouse X in canvas coordinates
   * @param {number} startY - Mouse Y in canvas coordinates
   */
  startNodeDrag(nodeId, startX, startY) {
    this.#isDragging = true;
    this.#draggedNodeId = nodeId;
    this.#dragStartPos = { x: startX, y: startY };

    this.#eventBus.emit('drag:started', {
      nodeId,
      x: startX,
      y: startY
    });
  }

  /**
   * Update drag position
   * @param {number} currentX
   * @param {number} currentY
   * @returns {{dx: number, dy: number}|null} Delta movement
   */
  updateDrag(currentX, currentY) {
    if (!this.#isDragging || !this.#dragStartPos) {
      return null;
    }

    const dx = (currentX - this.#dragStartPos.x) / this.#scale;
    const dy = (currentY - this.#dragStartPos.y) / this.#scale;

    // Update drag start position for continuous dragging
    this.#dragStartPos = { x: currentX, y: currentY };

    this.#eventBus.emit('drag:updated', {
      nodeId: this.#draggedNodeId,
      dx,
      dy
    });

    return { dx, dy };
  }

  /**
   * End drag operation
   */
  endDrag() {
    if (this.#isDragging) {
      this.#eventBus.emit('drag:ended', {
        nodeId: this.#draggedNodeId
      });
    }

    this.#isDragging = false;
    this.#draggedNodeId = null;
    this.#dragStartPos = null;
  }

  /**
   * Check if currently dragging
   * @returns {boolean}
   */
  isDragging() {
    return this.#isDragging;
  }

  /**
   * Get dragged node ID
   * @returns {string|null}
   */
  getDraggedNodeId() {
    return this.#draggedNodeId;
  }

  // ========== Mode Management ==========

  /**
   * Set interaction mode
   * @param {string} mode - 'select', 'connect', 'pan'
   */
  setMode(mode) {
    if (this.#mode !== mode) {
      const previousMode = this.#mode;
      this.#mode = mode;

      // Clear mode-specific state
      if (mode !== 'connect') {
        this.clearConnectionState();
      }

      this.#eventBus.emit('mode:changed', {
        previousMode,
        currentMode: mode
      });
    }
  }

  /**
   * Get current mode
   * @returns {string}
   */
  getMode() {
    return this.#mode;
  }

  // ========== Connection State Management ==========

  /**
   * Set first person for connection
   * @param {string} personId
   */
  setConnectionPersonA(personId) {
    this.#connectionState.personA = personId;
    this.#eventBus.emit('connection:personA:set', { personId });
  }

  /**
   * Set second person for connection
   * @param {string} personId
   */
  setConnectionPersonB(personId) {
    this.#connectionState.personB = personId;
    this.#eventBus.emit('connection:personB:set', { personId });
  }

  /**
   * Get connection state
   * @returns {{personA: string|null, personB: string|null}}
   */
  getConnectionState() {
    return { ...this.#connectionState };
  }

  /**
   * Check if connection is ready (both persons selected)
   * @returns {boolean}
   */
  isConnectionReady() {
    return this.#connectionState.personA !== null &&
           this.#connectionState.personB !== null;
  }

  /**
   * Clear connection state
   */
  clearConnectionState() {
    this.#connectionState.personA = null;
    this.#connectionState.personB = null;
    this.#eventBus.emit('connection:cleared');
  }

  // ========== State Export/Import ==========

  /**
   * Export state for persistence
   * @returns {Object}
   */
  exportState() {
    return {
      selectedNodes: this.getSelectedNodes(),
      camera: {
        x: this.#cameraX,
        y: this.#cameraY,
        scale: this.#scale
      },
      mode: this.#mode
    };
  }

  /**
   * Import state from persistence
   * @param {Object} state
   */
  importState(state) {
    if (state.selectedNodes) {
      this.#selectedNodes = new Set(state.selectedNodes);
    }

    if (state.camera) {
      this.#cameraX = state.camera.x || 0;
      this.#cameraY = state.camera.y || 0;
      this.#scale = state.camera.scale || 1;
    }

    if (state.mode) {
      this.#mode = state.mode;
    }
  }

  /**
   * Reset all state to defaults
   */
  reset() {
    this.clearSelection();
    this.resetCamera();
    this.endDrag();
    this.setMode('select');
    this.clearConnectionState();
    this.#hoveredNodeId = null;
  }

  /**
   * Get state statistics
   * @returns {Object}
   */
  getStats() {
    return {
      selectedCount: this.#selectedNodes.size,
      scale: this.#scale,
      cameraPosition: { x: this.#cameraX, y: this.#cameraY },
      isDragging: this.#isDragging,
      mode: this.#mode,
      hasConnectionA: this.#connectionState.personA !== null,
      hasConnectionB: this.#connectionState.personB !== null
    };
  }
}

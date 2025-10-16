// tree-engine.js - Core family tree engine and state management
// Split from tree-core-canvas.js for better modularity

import { CanvasRenderer } from './canvas-renderer.js';
import { openModalForEdit, closeModal, getSelectedGender } from '../ui/modals/modal.js';
import { rebuildTableView } from '../ui/components/table.js';
import { exportTree, exportGEDCOM, exportCanvasPDF } from '../features/export/exporter.js';
import { notifications } from '../ui/components/notifications.js';
import { UndoRedoManager } from '../data/cache/core-undoRedo.js';
import { CacheManager } from '../data/cache/core-cache.js';
import { setupButtons } from '../ui/components/ui-buttons.js';
import { setupSettings } from '../ui/components/ui-settings.js';
import { setupModals } from '../ui/components/ui-modals.js';
import { setupExport } from '../data/core-export.js';
import { appContext } from '../utils/event-bus.js';

/**
 * Core family tree engine responsible for managing the tree state,
 * coordinating between components, and handling high-level operations.
 */
export class TreeEngine {
  constructor() {
    // Core state
    this.renderer = null;
    this.nodeRadius = 50;
    this.defaultColor = '#3498db';
    this.fontFamily = 'Inter';
    this.fontSize = 11;
    this.nameColor = '#ffffff';
    this.dateColor = '#f0f0f0';
    
    // Display preferences
    this.displayPreferences = {
      showMaidenName: true,
      showDateOfBirth: true,
      showFatherName: true
    };
    
    // Node style
    this.nodeStyle = 'circle'; // 'circle' or 'rectangle'
    
    // UI elements
    this.addPersonBtn = null;
    this.connectBtn = null;
    this.editBtn = null;
    this.styleBtn = null;
    this.undoSidebarBtn = null;
    this.redoSidebarBtn = null;
    this.bringFrontBtn = null;
    
    // State management
    this.selectedCircles = new Set();
    this.undoStack = [];
    this.redoStack = [];
    this.maxUndoSize = 50;
    
    // Connection state for modal
    this.connectionPersonA = null;
    this.connectionPersonB = null;
    
    // Line removal state
    this.currentConnectionToRemove = null;
    this.hiddenConnections = new Set();
    this.lineOnlyConnections = new Set();
    
    // ID counter
    this.nextId = 1;
    
    // Person data storage
    this.personData = new Map();
    
    // Caching system
    this.cacheKey = 'familyTreeCanvas_state';
    this.autoSaveInterval = 30000; // Auto-save every 30 seconds
    this.autoSaveTimer = null;
    this.lastSaveTime = null;
    this.cacheVersion = '2.6';
    
    // Enhanced features
    this.enhancedCacheIndicator = null;
    this.undoRedoManager = null;
    this.cacheManager = null;
  }

  /**
   * Initialize the tree engine and all its components
   */
  async initialize() {
    console.log('=== TREE ENGINE INITIALIZATION ===');
    console.log('Starting TreeEngine initialization...');
    
    // Get container
    const graphicView = document.getElementById('graphicView');
    if (!graphicView) {
      console.error('Graphic view container not found');
      return;
    }
    
    // Clear existing SVG content
    const existingSvg = document.getElementById('svgArea');
    if (existingSvg) {
      existingSvg.remove();
    }
    
    // Create canvas renderer
    this.renderer = new CanvasRenderer(graphicView);
    console.log('Renderer created:', !!this.renderer);
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Setup UI components
    this.setupUI();
    
    // Setup managers
    this.setupManagers();
    
    // Load cached state
    await this.loadInitialState();
    
    // Make globally accessible for debugging
    window.treeCore = this;
    
    console.log('TreeEngine initialization complete');
  }

  /**
   * Set up event handlers for renderer interactions
   */
  setupEventHandlers() {
    this.renderer.onNodeClick = (nodeId, event) => {
      this.handleNodeClick(nodeId, event);
    };
    
    this.renderer.onNodeDoubleClick = (nodeId) => {
      console.log('Double-clicked node:', nodeId);
      openModalForEdit(nodeId);
    };
    
    this.renderer.onNodeDragEnd = (nodeId) => {
      this.regenerateConnections();
      this.undoRedoManager.pushUndoState();
      this.autoSave();
    };
    
    this.renderer.onSelectionCleared = () => {
      this.handleSelectionCleared();
    };

    this.renderer.onConnectionClick = (connection, index) => {
      this.handleConnectionClick(connection, index);
    };
    
    console.log('Event handlers set up');
  }

  /**
   * Set up UI components and panels
   */
  setupUI() {
    setupButtons(this);
    this.setupClearAllFunctionality();
    setupSettings(this);
    setupModals(this);
    setupExport(this);
    
    // Don't call updateRendererSettings() here during initialization
    // It will be called after cached data is loaded to preserve settings
    
    // Setup form submit handler
    const personForm = document.getElementById('personForm');
    if (personForm) {
      personForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.savePersonFromModal();
      });
    }
    
    // Listen for save person event from modal
    document.addEventListener('savePersonFromModal', (e) => {
      console.log('Received savePersonFromModal event', e.detail);
      this.handleSavePersonFromModal(e.detail);
    });
  }

  /**
   * Set up state and cache managers
   */
  setupManagers() {
    this.undoRedoManager = new UndoRedoManager(this, notifications);
    
    // Initialize button states
    setTimeout(() => this.undoRedoManager.updateButtonStates(), 100);
    
    this.cacheManager = new CacheManager(this);
    this.cacheManager.setupCaching();
  }

  /**
   * Load initial state from cache or create new tree (DEPRECATED - replaced by version at end of file)
   */
  async loadInitialStateOld() {
    const loaded = await this.loadCachedState();
    if (!loaded) {
      console.log('No cached state found, starting with empty tree');
    }
    
    // Initial state if nothing was loaded
    if (!this.personData || this.personData.size === 0) {
      this.pushUndoState();
    }
    
    // Initialize enhanced features
    setTimeout(() => {
      this.initializeEnhancedCacheIndicator();
      this.setupBringToFront();
      console.log('Enhanced UI features initialized');
    }, 1000);
  }

  // Event handlers
  handleNodeClick(nodeId, event) {
    this.selectedCircles = this.renderer.getSelectedNodes();
    this.updateActionButtons();
  }

  handleSelectionCleared() {
    this.selectedCircles.clear();
    this.updateActionButtons();
  }

  handleConnectionClick(connection, index) {
    console.log('Connection line clicked:', connection);
    this.currentConnectionToRemove = { connection, index };
    this.openLineRemovalModal(connection);
  }

  updateActionButtons() {
    this.selectedCircles = this.renderer.getSelectedNodes();
    
    const hasSelection = this.selectedCircles.size > 0;
    const canConnect = this.selectedCircles.size === 2;
    const canEdit = this.selectedCircles.size === 1;
    
    const floatingButtons = document.querySelector('.floating-buttons');
    if (!floatingButtons) return;
    
    if (hasSelection) {
      floatingButtons.classList.add('expanded');
      
      if (this.bringFrontBtn) {
        this.bringFrontBtn.classList.remove('hidden');
      }
      
      if (this.editBtn) {
        if (canEdit) {
          this.editBtn.classList.remove('hidden');
        } else {
          this.editBtn.classList.add('hidden');
        }
      }
      
      if (this.connectBtn) {
        if (canConnect) {
          this.connectBtn.classList.remove('hidden');
        } else {
          this.connectBtn.classList.add('hidden');
        }
      }
      
      // Style button should show when any nodes are selected
      if (this.styleBtn) {
        this.styleBtn.classList.remove('hidden');
      }
    } else {
      floatingButtons.classList.remove('expanded');
      
      if (this.bringFrontBtn) {
        this.bringFrontBtn.classList.add('hidden');
      }
      
      if (this.editBtn) {
        this.editBtn.classList.add('hidden');
      }
      
      if (this.connectBtn) {
        this.connectBtn.classList.add('hidden');
      }
      
      if (this.styleBtn) {
        this.styleBtn.classList.add('hidden');
      }
    }
  }

  /**
   * Get connection key for tracking relationships
   */
  getConnectionKey(id1, id2, type = null) {
    const baseKey = id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
    return type ? `${baseKey}:${type}` : baseKey;
  }

  // Placeholder methods - to be implemented with full functionality
  setupClearAllFunctionality() {
    const clearAllBtn = document.getElementById('clearAllBtn');
    const clearAllModal = document.getElementById('clearAllConfirmModal');
    const confirmClearAll = document.getElementById('confirmClearAll');
    const cancelClearAll = document.getElementById('cancelClearAll');
    const modalCloseBtn = clearAllModal?.querySelector('.modal-close-btn');

    if (!clearAllBtn || !clearAllModal) {
      console.warn('Clear All button or modal not found');
      return;
    }

    // Open clear all confirmation modal
    clearAllBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Clear All button clicked - opening confirmation modal');
      clearAllModal.classList.remove('hidden');
    });

    // Confirm clear all action
    if (confirmClearAll) {
      confirmClearAll.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Confirmed clear all data');
        this.clearAllData();
        clearAllModal.classList.add('hidden');
      });
    }

    // Cancel clear all action
    if (cancelClearAll) {
      cancelClearAll.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Cancelled clear all data');
        clearAllModal.classList.add('hidden');
      });
    }

    // Close modal with X button
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        clearAllModal.classList.add('hidden');
      });
    }

    // Close modal when clicking outside
    clearAllModal.addEventListener('click', (e) => {
      if (e.target === clearAllModal) {
        clearAllModal.classList.add('hidden');
      }
    });
  }

  /**
   * Clear all data from the family tree
   */
  clearAllData() {
    console.log('Clearing all family tree data...');

    try {
      // Track node count before clearing
      const nodeCount = this.personData.size;

      // Clear person data
      this.personData.clear();
      
      // Clear renderer data
      if (this.renderer) {
        this.renderer.nodes.clear();
        this.renderer.connections = [];
        this.renderer.selectedNodes.clear();
        this.selectedCircles.clear();
        this.renderer.needsRedraw = true;
      }
      
      // Clear connection sets
      this.hiddenConnections.clear();
      this.lineOnlyConnections.clear();
      
      // Reset ID counter
      this.nextId = 1;
      
      // Clear undo/redo stacks
      if (this.undoRedoManager) {
        this.undoRedoManager.clearStacks();
        this.undoRedoManager.updateButtonStates();
      }
      
      // Clear cache
      if (this.cacheManager) {
        this.cacheManager.clearCache();
      }
      
      // Update UI
      this.updateActionButtons();
      
      // Emit analytics event for tree cleared
      const eventBus = appContext.getEventBus();
      if (eventBus) {
        eventBus.emit('tree:cleared', { nodeCount });
      }

      // Show success notification
      if (window.notifications) {
        window.notifications.success('Data Cleared', 'All family tree data has been cleared successfully');
      }

      console.log('All data cleared successfully');
      
    } catch (error) {
      console.error('Error clearing data:', error);
      if (window.notifications) {
        window.notifications.error('Clear Failed', 'Failed to clear all data');
      }
    }
  }


  savePersonFromModal() {
    // Implementation will be moved from original file
  }

  handleSavePersonFromModal(detail) {
    // Implementation will be moved from original file
  }

  regenerateConnections() {
    // Regenerate family connections based on relationship data
    if (!this.renderer) return;
    
    this.renderer.connections = [];
    
    // Iterate through all persons and create connections based on relationships
    for (const [id, personData] of this.personData) {
      // Create parent connections
      if (personData.fatherId && this.renderer.nodes.has(personData.fatherId)) {
        const parentConnectionKey = this.getConnectionKey(personData.fatherId, id, 'parent');
        
        // Only add if not hidden
        if (!this.hiddenConnections.has(parentConnectionKey)) {
          this.renderer.connections.push({
            from: personData.fatherId,
            to: id,
            type: 'parent'
          });
        }
      }
      
      if (personData.motherId && this.renderer.nodes.has(personData.motherId)) {
        const parentConnectionKey = this.getConnectionKey(personData.motherId, id, 'parent');
        
        // Only add if not hidden
        if (!this.hiddenConnections.has(parentConnectionKey)) {
          this.renderer.connections.push({
            from: personData.motherId,
            to: id,
            type: 'parent'
          });
        }
      }
      
      // Create spouse connections
      if (personData.spouseId && this.renderer.nodes.has(personData.spouseId)) {
        const spouseConnectionKey = this.getConnectionKey(id, personData.spouseId, 'spouse');
        
        // Avoid duplicate spouse connections
        const existingSpouseConnection = this.renderer.connections.find(conn =>
          (conn.from === id && conn.to === personData.spouseId) ||
          (conn.from === personData.spouseId && conn.to === id)
        );
        
        // Only add if not hidden and doesn't already exist
        if (!existingSpouseConnection && !this.hiddenConnections.has(spouseConnectionKey)) {
          this.renderer.connections.push({
            from: id,
            to: personData.spouseId,
            type: 'spouse'
          });
        }
      }
    }
    
    // Restore line-only connections from saved set
    for (const connectionKey of this.lineOnlyConnections) {
      const [personAId, personBId] = connectionKey.split('-');
      const lineOnlyConnectionKey = this.getConnectionKey(personAId, personBId, 'line-only');
      
      // Only add if both nodes exist and connection is not hidden
      if (this.renderer.nodes.has(personAId) && this.renderer.nodes.has(personBId) && !this.hiddenConnections.has(lineOnlyConnectionKey)) {
        // Check if line-only connection already exists (not family connections - they can coexist)
        const existingLineOnlyConnection = this.renderer.connections.find(conn =>
          conn.type === 'line-only' &&
          ((conn.from === personAId && conn.to === personBId) ||
           (conn.from === personBId && conn.to === personAId))
        );
        
        // Only add if no line-only connection already exists
        // Line-only connections can coexist with family relationships (parent/spouse)
        if (!existingLineOnlyConnection) {
          this.renderer.connections.push({
            from: personAId,
            to: personBId,
            type: 'line-only'
          });
        }
      }
    }
    
    console.log(`Generated ${this.renderer.connections.length} connections (including ${this.lineOnlyConnections.size} line-only)`);
  }

  autoSaveOld() {
    // DEPRECATED: Auto-save functionality moved to end of file
    this.autoSave();
  }

  loadCachedState() {
    if (this.cacheManager) {
      return this.cacheManager.loadCachedState();
    }
    return false;
  }

  pushUndoState() {
    if (this.undoRedoManager) {
      this.undoRedoManager.pushUndoState();
    }
  }

  initializeEnhancedCacheIndicator() {
    // Enhanced cache indicator initialization
    if (window.enhancedCacheIndicator) {
      this.enhancedCacheIndicator = window.enhancedCacheIndicator;
      console.log('Enhanced cache indicator connected');
    } else {
      console.log('Enhanced cache indicator not found');
    }
  }

  setupBringToFront() {
    // Bring to front functionality is already implemented in handleBringToFront
    console.log('Bring to front setup complete');
  }

  openLineRemovalModal(connection) {
    const lineRemovalModal = document.getElementById('lineRemovalModal');
    if (lineRemovalModal) {
      lineRemovalModal.classList.remove('hidden');
    }
  }

  /**
   * Get current state for caching with comprehensive relationship data (DEPRECATED - use other getCurrentState)
   */
  getCurrentStateOld() {
    console.log('Saving current state with enhanced relationship data...');
    
    // Get all person data with relationship information
    const personsWithRelationships = [];
    if (this.renderer && this.renderer.nodes) {
      for (const [id, node] of this.renderer.nodes) {
        const personData = this.personData?.get(id) || {};
        
        // Ensure all relationship data is captured
        const personState = {
          id,
          x: node.x,
          y: node.y,
          name: node.name || personData.name || '',
          fatherName: node.fatherName || personData.fatherName || '',
          surname: node.surname || personData.surname || '',
          maidenName: node.maidenName || personData.maidenName || '',
          dob: node.dob || personData.dob || '',
          gender: node.gender || personData.gender || '',
          color: node.color || this.defaultColor,
          radius: node.radius || this.nodeRadius,
          
          // CRITICAL: Ensure relationship data is saved
          motherId: personData.motherId || '',
          fatherId: personData.fatherId || '',
          spouseId: personData.spouseId || ''
        };
        
        personsWithRelationships.push(personState);
      }
    }
    
    const state = {
      version: this.cacheVersion,
      timestamp: Date.now(),
      cacheFormat: 'enhanced',
      settings: {
        nodeRadius: this.nodeRadius,
        defaultColor: this.defaultColor,
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        nameColor: this.nameColor,
        dateColor: this.dateColor,
        
        // Node outline settings
        showNodeOutline: this.renderer?.settings.showNodeOutline ?? true,
        outlineColor: this.renderer?.settings.outlineColor ?? '#2c3e50',
        outlineThickness: this.renderer?.settings.outlineThickness ?? 2,
        
        // Line style settings
        familyLineStyle: this.renderer?.settings.familyLineStyle ?? 'solid',
        familyLineThickness: this.renderer?.settings.familyLineThickness ?? 2,
        familyLineColor: this.renderer?.settings.familyLineColor ?? '#7f8c8d',
        
        spouseLineStyle: this.renderer?.settings.spouseLineStyle ?? 'dashed',
        spouseLineThickness: this.renderer?.settings.spouseLineThickness ?? 2,
        spouseLineColor: this.renderer?.settings.spouseLineColor ?? '#e74c3c',
        
        lineOnlyStyle: this.renderer?.settings.lineOnlyStyle ?? 'dash-dot',
        lineOnlyThickness: this.renderer?.settings.lineOnlyThickness ?? 2,
        lineOnlyColor: this.renderer?.settings.lineOnlyColor ?? '#9b59b6'
      },
      displayPreferences: { ...this.displayPreferences },
      nodeStyle: this.nodeStyle,
      camera: this.renderer ? this.renderer.getCamera() : { x: 0, y: 0, scale: 1 },
      
      // Enhanced connection preservation
      hiddenConnections: Array.from(this.hiddenConnections),
      lineOnlyConnections: Array.from(this.lineOnlyConnections),
      
      // Save persons with embedded relationship data
      persons: personsWithRelationships,
      
      // Also save personData separately as backup
      personDataBackup: this.personData ? Array.from(this.personData.entries()) : [],
      
      // Save current connections for verification
      currentConnections: this.renderer ? this.renderer.connections.map(conn => ({
        from: conn.from,
        to: conn.to,
        type: conn.type
      })) : [],
      
      nextId: this.nextId
    };
    
    return state;
  }

  /**
   * Get compressed state for large data sets
   */
  getCompressedState() {
    return {
      version: this.cacheVersion,
      timestamp: Date.now(),
      cacheFormat: 'compressed',
      persons: this.getPersonsArray(),
      personData: this.personData ? Array.from(this.personData.entries()) : [],
      nextId: this.nextId,
      hiddenConnections: Array.from(this.hiddenConnections),
      lineOnlyConnections: Array.from(this.lineOnlyConnections)
    };
  }

  /**
   * Get persons array for caching
   */
  getPersonsArray() {
    const persons = [];
    if (this.renderer && this.renderer.nodes) {
      for (const [id, node] of this.renderer.nodes) {
        const personData = this.personData?.get(id) || {};
        persons.push({
          id,
          x: node.x,
          y: node.y,
          color: node.color,
          radius: node.radius,
          ...personData
        });
      }
    }
    return persons;
  }

  /**
   * Clean old backup cache entries
   */
  cleanOldBackups() {
    try {
      const backupKeys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`${this.cacheKey}_backup_`)) {
          backupKeys.push({
            key,
            timestamp: parseInt(key.split('_').pop())
          });
        }
      }
      
      // Sort by timestamp and keep only the 3 most recent
      backupKeys.sort((a, b) => b.timestamp - a.timestamp);
      for (let i = 3; i < backupKeys.length; i++) {
        localStorage.removeItem(backupKeys[i].key);
      }
    } catch (error) {
      console.error('Failed to clean old backups:', error);
    }
  }

  /**
   * Generate unique ID for new persons
   */
  generateId() {
    return `person_${this.nextId++}`;
  }

  /**
   * Handle saving person data from modal form
   */
  handleSavePersonFromModal(formData) {
    console.log('🔄 Processing person save:', formData);
    
    try {
      // Validate required fields
      if (!formData.name || !formData.name.trim()) {
        throw new Error('Name is required');
      }
      
      if (!formData.gender) {
        throw new Error('Gender is required');
      }
      
      // Initialize personData if needed
      if (!this.personData) {
        this.personData = new Map();
      }
      
      // Determine if this is edit or new person
      const isEdit = formData.editingId && formData.editingId.trim();
      const personId = isEdit ? formData.editingId : this.generateId();
      
      console.log(`${isEdit ? 'Editing' : 'Creating'} person with ID:`, personId);
      
      // Create person data object
      const personData = {
        id: personId,
        name: formData.name.trim(),
        fatherName: formData.fatherName ? formData.fatherName.trim() : '',
        surname: formData.surname ? formData.surname.trim() : '',
        maidenName: formData.maidenName ? formData.maidenName.trim() : '',
        dob: formData.dob ? formData.dob.trim() : '',
        gender: formData.gender,
        motherId: formData.motherId || '',
        fatherId: formData.fatherId || '',
        spouseId: formData.spouseId || ''
      };
      
      // Store in personData map
      this.personData.set(personId, personData);

      // Emit analytics event for person created/updated
      const eventBus = appContext.getEventBus();
      if (eventBus) {
        if (isEdit) {
          eventBus.emit('tree:person:updated', { id: personId, changes: personData });
        } else {
          eventBus.emit('tree:person:added', personData);
        }
      }

      // Handle canvas node creation/update
      if (this.renderer) {
        let nodeData;
        
        if (isEdit && this.renderer.nodes.has(personId)) {
          // Update existing node
          nodeData = this.renderer.nodes.get(personId);
          Object.assign(nodeData, {
            name: personData.name,
            fatherName: personData.fatherName,
            surname: personData.surname,
            maidenName: personData.maidenName,
            dob: personData.dob,
            gender: personData.gender
          });
          
          console.log('✏️ Updated existing node:', personId);
        } else {
          // Create new node with organized positioning
          const existingNodes = Array.from(this.renderer.nodes.values());
          let x = 300, y = 300;
          
          // Organized positioning: place new nodes below existing content, centered horizontally
          if (existingNodes.length > 0) {
            const position = this.calculateNewNodePosition(existingNodes);
            x = position.x;
            y = position.y;
            console.log(`📍 Positioning new node below existing content at (${x}, ${y})`);
          } else {
            // First node: center it on the canvas
            x = 400;
            y = 300;
            console.log(`📍 Positioning first node at center (${x}, ${y})`);
          }
          
          nodeData = {
            id: personId,
            name: personData.name,
            fatherName: personData.fatherName,
            surname: personData.surname,
            maidenName: personData.maidenName,
            dob: personData.dob,
            gender: personData.gender,
            x: x,
            y: y,
            color: this.defaultColor,
            radius: this.nodeRadius
          };
          
          this.renderer.setNode(personId, nodeData);
          console.log('➕ Created new node:', personId);
          
          // Center camera on newly created node (using search-like approach)
          setTimeout(() => {
            this.centerOnNode(personId);
            console.log('📹 Camera centered on new node using search approach');
          }, 200);
        }
        
        // Regenerate connections and re-render
        this.regenerateConnections();
        this.renderer.needsRedraw = true;
      }
      
      // Trigger auto-save
      if (this.cacheManager) {
        this.cacheManager.autoSave();
      }
      
      console.log('✅ Person saved successfully:', personId);
      
      // Close the modal after successful save
      setTimeout(() => {
        const modal = document.getElementById('personModal');
        if (modal && !modal.classList.contains('hidden')) {
          // Import and call closeModal function
          import('../ui/modals/modal.js').then(modalModule => {
            if (modalModule.closeModal) {
              modalModule.closeModal();
              console.log('Modal closed after successful save');
            }
          }).catch(error => {
            console.error('Failed to import modal module for closing:', error);
            // Fallback - close modal directly
            modal.classList.add('hidden');
          });
        }
      }, 100); // Small delay to allow UI updates
      
    } catch (error) {
      console.error('❌ Error saving person:', error);
      throw error; // Re-throw so modal can handle the error
    }
  }

  /**
   * Calculate optimal position for new node (legacy method)
   */
  calculateNewNodePosition(existingNodes) {
    if (existingNodes.length === 0) {
      return { x: 400, y: 300 };
    }
    
    // Find the bottom-most node
    const bottomNode = existingNodes.reduce((bottom, node) => 
      node.y > bottom.y ? node : bottom
    );
    
    // Calculate average x position for centering
    const avgX = existingNodes.reduce((sum, node) => sum + node.x, 0) / existingNodes.length;
    
    return {
      x: avgX,
      y: bottomNode.y + 150 // Place 150 pixels below the bottom node
    };
  }

  /**
   * Center camera on a specific node (using exact search functionality)
   */
  centerOnNode(nodeId) {
    if (!this.renderer || !this.renderer.canvas) {
      console.error('Renderer or canvas not available for centering');
      return;
    }

    const node = this.renderer.nodes.get(nodeId);
    if (!node) {
      console.error('Node not found for centering:', nodeId);
      return;
    }

    // Use the exact same centering logic as search
    this.centerOnPersonImproved(this.renderer, node, nodeId);
  }

  /**
   * Improved centering method (copied from search functionality)
   */
  centerOnPersonImproved(renderer, node, personId) {
    if (!renderer || !renderer.canvas) {
      console.error('Renderer or canvas not available');
      return;
    }
    
    const canvas = renderer.canvas;
    const canvasWidth = canvas.width / renderer.dpr;
    const canvasHeight = canvas.height / renderer.dpr;
    
    console.log('Canvas dimensions:', canvasWidth, 'x', canvasHeight);
    console.log('Node position:', node.x, node.y);
    console.log('Current camera:', renderer.camera);
    
    // Ensure we have a reasonable zoom level (not too close, not too far)
    let targetScale = renderer.camera.scale;
    
    // If current scale is too small (zoomed out too much), zoom in to a reasonable level
    if (targetScale < 0.8) {
      targetScale = 1.0;
    }
    // If current scale is too large (zoomed in too much), zoom out a bit
    else if (targetScale > 3.0) {
      targetScale = 2.0;
    }
    
    // Calculate the exact center position
    // We want the node to be at the center of the visible canvas
    const targetCameraX = (canvasWidth / 2) - (node.x * targetScale);
    const targetCameraY = (canvasHeight / 2) - (node.y * targetScale);
    
    console.log('Target camera position:', targetCameraX, targetCameraY, 'scale:', targetScale);
    
    // Animate to the new position with improved easing
    this.animateCameraImproved(renderer, {
      x: targetCameraX,
      y: targetCameraY,
      scale: targetScale
    }, node, personId);
  }

  /**
   * Enhanced camera animation (copied from search functionality)
   */
  animateCameraImproved(renderer, targetCamera, node, personId) {
    const startCamera = { ...renderer.camera };
    const duration = 1000; // Slightly longer duration for smoother animation
    const startTime = performance.now();
    
    console.log('Starting camera animation from:', startCamera, 'to:', targetCamera);
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Improved easing function (ease-out cubic)
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      // Interpolate camera position and scale
      renderer.camera.x = startCamera.x + (targetCamera.x - startCamera.x) * easeProgress;
      renderer.camera.y = startCamera.y + (targetCamera.y - startCamera.y) * easeProgress;
      renderer.camera.scale = startCamera.scale + (targetCamera.scale - startCamera.scale) * easeProgress;
      
      renderer.needsRedraw = true;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        // Animation complete - verify centering
        console.log('Camera animation complete. Final camera:', renderer.camera);
        
        // Verify the node is actually centered
        const canvas = renderer.canvas;
        const canvasWidth = canvas.width / renderer.dpr;
        const canvasHeight = canvas.height / renderer.dpr;
        
        // Calculate where the node appears on screen
        const screenX = (node.x * renderer.camera.scale) + renderer.camera.x;
        const screenY = (node.y * renderer.camera.scale) + renderer.camera.y;
        
        console.log('Node screen position:', screenX, screenY);
        console.log('Canvas center:', canvasWidth / 2, canvasHeight / 2);
        
        // Select the newly created node to make it visible
        renderer.clearSelection();
        renderer.selectedNodes.add(personId);
        renderer.needsRedraw = true;
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Center camera on selected nodes
   */
  centerSelectedNode() {
    if (!this.renderer) {
      console.error('Renderer not available for centering');
      if (window.notifications) {
        window.notifications.error('Error', 'Tree renderer not available');
      }
      return;
    }

    const selectedNodes = this.renderer.getSelectedNodes();
    
    if (selectedNodes.size === 0) {
      console.log('No nodes selected for centering');
      if (window.notifications) {
        window.notifications.warning('No Selection', 'Please select a person to locate');
      }
      return;
    }
    
    if (selectedNodes.size > 1) {
      console.log('Multiple nodes selected for centering');
      if (window.notifications) {
        window.notifications.warning('Multiple Selection', 'Only one node can be located. Please select a single person.');
      }
      return;
    }

    // Center on the single selected node
    const selectedNodeId = Array.from(selectedNodes)[0];
    const selectedNode = this.renderer.nodes.get(selectedNodeId);
    
    if (selectedNode) {
      console.log('Centering on selected node:', selectedNodeId);
      this.centerOnNodes([selectedNode]);
      
      if (window.notifications) {
        const personName = selectedNode.name || 'Person';
        window.notifications.success('Located', `Centered view on ${personName}`);
      }
    } else {
      console.error('Selected node not found:', selectedNodeId);
      if (window.notifications) {
        window.notifications.error('Error', 'Selected person not found');
      }
    }
  }

  /**
   * Center camera on given nodes
   */
  centerOnNodes(nodes) {
    if (!this.renderer || nodes.length === 0) return;

    // Calculate center point of nodes
    const centerX = nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length;
    const centerY = nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length;

    // Use the same logic as search function - this works perfectly
    this.centerOnNodeUsingSearchLogic({x: centerX, y: centerY});
  }

  /**
   * Center camera using the same proven logic as search function
   */
  centerOnNodeUsingSearchLogic(node) {
    if (!this.renderer || !this.renderer.canvas) {
      console.error('Renderer or canvas not available');
      return;
    }
    
    const canvas = this.renderer.canvas;
    const canvasWidth = canvas.width / (this.renderer.dpr || 1);
    const canvasHeight = canvas.height / (this.renderer.dpr || 1);
    
    console.log('🎯 Centering using search logic:');
    console.log('  Canvas dimensions:', canvasWidth, 'x', canvasHeight);
    console.log('  Node position:', node.x, node.y);
    console.log('  Current camera:', this.renderer.camera);
    
    // Ensure we have a reasonable zoom level (same as search function)
    let targetScale = this.renderer.camera.scale;
    
    // If current scale is too small (zoomed out too much), zoom in to a reasonable level
    if (targetScale < 0.8) {
      targetScale = 1.0;
    }
    // If current scale is too large (zoomed in too much), zoom out a bit
    else if (targetScale > 3.0) {
      targetScale = 2.0;
    }
    
    // Calculate the exact center position (SAME FORMULA AS SEARCH)
    // We want the node to be at the center of the visible canvas
    const targetCameraX = (canvasWidth / 2) - (node.x * targetScale);
    const targetCameraY = (canvasHeight / 2) - (node.y * targetScale);
    
    console.log('  Target camera position:', targetCameraX, targetCameraY, 'scale:', targetScale);
    
    // Animate to the new position
    this.animateCamera({
      x: targetCameraX,
      y: targetCameraY,
      scale: targetScale
    });
  }

  /**
   * Animate camera to target position
   */
  animateCamera(targetCamera) {
    if (!this.renderer) return;

    const startCamera = { ...this.renderer.camera };
    const duration = 1000; // Same duration as search function
    const startTime = performance.now();

    console.log('🎬 Starting camera animation:');
    console.log('  From:', startCamera.x, startCamera.y, 'scale:', startCamera.scale);
    console.log('  To:', targetCamera.x, targetCamera.y, 'scale:', targetCamera.scale);

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Improved easing function (ease-in-out cubic) - same as search
      const easeProgress = progress < 0.5 
        ? 4 * progress * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      
      this.renderer.camera.x = startCamera.x + (targetCamera.x - startCamera.x) * easeProgress;
      this.renderer.camera.y = startCamera.y + (targetCamera.y - startCamera.y) * easeProgress;
      
      // Animate scale as well (this was missing!)
      if (targetCamera.scale !== undefined) {
        this.renderer.camera.scale = startCamera.scale + (targetCamera.scale - startCamera.scale) * easeProgress;
      }
      
      this.renderer.needsRedraw = true;
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        console.log('✅ Camera animation complete:');
        console.log('  Final position:', this.renderer.camera.x, this.renderer.camera.y);
        console.log('  Final scale:', this.renderer.camera.scale);
      }
    };

    requestAnimationFrame(animate);
  }

  /**
   * Clear all selected nodes
   */
  clearSelection() {
    if (this.renderer) {
      this.renderer.selectedNodes.clear();
      this.selectedCircles.clear();
      this.updateActionButtons();
      this.renderer.needsRedraw = true;
    }
  }

  /**
   * Get person data by ID
   */
  getPersonData(id) {
    return this.personData.get(id);
  }

  /**
   * Update renderer settings with current tree settings
   */
  updateRendererSettings() {
    if (!this.renderer) return;
    
    // Update renderer settings
    this.renderer.settings.nodeRadius = this.nodeRadius;
    this.renderer.settings.nodeColor = this.defaultColor;
    this.renderer.settings.fontFamily = this.fontFamily;
    this.renderer.settings.nameFontSize = this.fontSize;
    this.renderer.settings.nameColor = this.nameColor;
    this.renderer.settings.dateColor = this.dateColor;
    this.renderer.settings.nodeStyle = this.nodeStyle;
    
    // Update line style settings
    if (this.lineStyleSettings) {
      // Family line settings
      if (this.lineStyleSettings.familyLineStyle !== undefined) this.renderer.settings.familyLineStyle = this.lineStyleSettings.familyLineStyle;
      if (this.lineStyleSettings.familyLineThickness !== undefined) this.renderer.settings.familyLineThickness = this.lineStyleSettings.familyLineThickness;
      if (this.lineStyleSettings.familyLineColor !== undefined) this.renderer.settings.familyLineColor = this.lineStyleSettings.familyLineColor;
      
      // Spouse line settings
      if (this.lineStyleSettings.spouseLineStyle !== undefined) this.renderer.settings.spouseLineStyle = this.lineStyleSettings.spouseLineStyle;
      if (this.lineStyleSettings.spouseLineThickness !== undefined) this.renderer.settings.spouseLineThickness = this.lineStyleSettings.spouseLineThickness;
      if (this.lineStyleSettings.spouseLineColor !== undefined) this.renderer.settings.spouseLineColor = this.lineStyleSettings.spouseLineColor;
      
      // Line-only settings
      if (this.lineStyleSettings.lineOnlyStyle !== undefined) this.renderer.settings.lineOnlyStyle = this.lineStyleSettings.lineOnlyStyle;
      if (this.lineStyleSettings.lineOnlyThickness !== undefined) this.renderer.settings.lineOnlyThickness = this.lineStyleSettings.lineOnlyThickness;
      if (this.lineStyleSettings.lineOnlyColor !== undefined) this.renderer.settings.lineOnlyColor = this.lineStyleSettings.lineOnlyColor;
      
      // Node outline settings
      if (this.lineStyleSettings.showNodeOutline !== undefined) this.renderer.settings.showNodeOutline = this.lineStyleSettings.showNodeOutline;
      if (this.lineStyleSettings.outlineColor !== undefined) this.renderer.settings.outlineColor = this.lineStyleSettings.outlineColor;
      if (this.lineStyleSettings.outlineThickness !== undefined) this.renderer.settings.outlineThickness = this.lineStyleSettings.outlineThickness;
    }
    
    // Update display preferences
    this.renderer.updateDisplayPreferences(this.displayPreferences);
    
    // Trigger redraw
    this.renderer.needsRedraw = true;
  }

  /**
   * Update all existing nodes with current settings
   */
  updateAllExistingNodes() {
    if (!this.renderer) return;
    
    for (const [id, node] of this.renderer.nodes) {
      const personData = this.getPersonData(id) || {};
      this.renderer.setNode(id, {
        ...node,
        ...personData,
        color: node.color || this.defaultColor,
        radius: node.radius || this.nodeRadius
      });
    }
    this.renderer.needsRedraw = true;
  }

  /**
   * Handle editing selected person
   */
  handleEditSelected() {
    const selectedNodes = this.renderer.getSelectedNodes();
    
    if (selectedNodes.size !== 1) {
      console.warn('Edit requires exactly one selected person');
      return;
    }
    
    const personId = Array.from(selectedNodes)[0];
    console.log('Opening edit modal for person:', personId);
    
    // Import modal module and open edit modal
    import('../ui/modals/modal.js').then(modalModule => {
      if (modalModule.openModalForEdit) {
        modalModule.openModalForEdit(personId);
      }
    }).catch(error => {
      console.error('Failed to load modal module:', error);
    });
  }

  /**
   * Handle connecting selected persons
   */
  handleConnectSelected() {
    const selectedNodes = this.renderer.getSelectedNodes();
    
    if (selectedNodes.size !== 2) {
      console.warn('Connect requires exactly two selected persons');
      return;
    }
    
    const [personA, personB] = Array.from(selectedNodes);
    console.log('Opening connection modal for persons:', personA, personB);
    
    // Open connection modal with proper setup
    this.openConnectionModal(personA, personB);
  }

  /**
   * Create a basic connection between two persons
   */
  createBasicConnection(personA, personB) {
    if (!this.renderer) return;
    
    // Add a basic line-only connection
    this.renderer.connections.push({
      from: personA,
      to: personB,
      type: 'line-only'
    });
    
    this.lineOnlyConnections.add(`${personA}-${personB}`);
    this.renderer.needsRedraw = true;
    
    console.log(`Created basic connection between ${personA} and ${personB}`);
  }

  /**
   * Open style modal for node styling
   */
  openStyleModal() {
    const styleModal = document.getElementById('styleModal');
    if (styleModal) {
      // Populate modal with current selected node values
      this.populateStyleModal();
      styleModal.classList.remove('hidden');
      console.log('Style modal opened');
    } else {
      console.warn('Style modal not found');
    }
  }

  /**
   * Close style modal
   */
  closeStyleModal() {
    const styleModal = document.getElementById('styleModal');
    if (styleModal) {
      styleModal.classList.add('hidden');
      console.log('Style modal closed');
    }
  }

  /**
   * Populate style modal with current selected node values
   */
  populateStyleModal() {
    const selectedNodes = this.renderer.getSelectedNodes();
    if (selectedNodes.size === 0) return;

    // Get the first selected node as reference
    const firstNodeId = Array.from(selectedNodes)[0];
    const firstNode = this.renderer.nodes.get(firstNodeId);
    
    if (!firstNode) return;

    // Populate color
    const colorInput = document.getElementById('selectedNodeColor');
    if (colorInput) {
      colorInput.value = firstNode.color || this.defaultColor;
    }

    // Populate size
    const sizeInput = document.getElementById('selectedNodeSize');
    if (sizeInput) {
      sizeInput.value = firstNode.radius || this.nodeRadius;
    }

    // Populate font
    const fontSelect = document.getElementById('selectedFont');
    if (fontSelect) {
      fontSelect.value = this.fontFamily;
    }

    // Populate font size
    const fontSizeInput = document.getElementById('selectedFontSize');
    if (fontSizeInput) {
      fontSizeInput.value = this.fontSize;
    }

    // Populate name color
    const nameColorInput = document.getElementById('selectedNameColor');
    if (nameColorInput) {
      nameColorInput.value = this.nameColor;
    }

    // Populate date color
    const dateColorInput = document.getElementById('selectedDateColor');
    if (dateColorInput) {
      dateColorInput.value = this.dateColor;
    }

    console.log('Style modal populated with values from selected nodes');
  }

  /**
   * Apply style changes to selected nodes
   */
  applySelectedStyles() {
    const selectedNodes = this.renderer.getSelectedNodes();
    
    if (selectedNodes.size === 0) {
      console.warn('No nodes selected for styling');
      return;
    }

    console.log('Applying styles to selected nodes:', Array.from(selectedNodes));

    // Get values from modal
    const nodeColor = document.getElementById('selectedNodeColor')?.value;
    const nodeSize = parseInt(document.getElementById('selectedNodeSize')?.value) || this.nodeRadius;
    const font = document.getElementById('selectedFont')?.value;
    const fontSize = parseInt(document.getElementById('selectedFontSize')?.value) || this.fontSize;
    const nameColor = document.getElementById('selectedNameColor')?.value;
    const dateColor = document.getElementById('selectedDateColor')?.value;

    // Apply to each selected node
    for (const nodeId of selectedNodes) {
      const node = this.renderer.nodes.get(nodeId);
      if (node) {
        // Update node properties
        if (nodeColor) node.color = nodeColor;
        if (nodeSize) node.radius = nodeSize;
        
        // Update node in renderer
        this.renderer.setNode(nodeId, node);
      }
    }

    // Update global settings if changed
    if (font && font !== this.fontFamily) {
      this.fontFamily = font;
    }
    if (fontSize && fontSize !== this.fontSize) {
      this.fontSize = fontSize;
    }
    if (nameColor && nameColor !== this.nameColor) {
      this.nameColor = nameColor;
    }
    if (dateColor && dateColor !== this.dateColor) {
      this.dateColor = dateColor;
    }

    // Update renderer settings
    this.updateRendererSettings();

    // Trigger redraw
    if (this.renderer) {
      this.renderer.needsRedraw = true;
    }

    // Close modal
    this.closeStyleModal();

    // Auto-save changes
    if (this.cacheManager) {
      this.cacheManager.autoSave();
    }

    // Push undo state
    if (this.undoRedoManager) {
      this.undoRedoManager.pushUndoState();
    }

    console.log('Styles applied successfully to selected nodes');
  }

  /**
   * Setup connection modal functionality
   */
  setupConnectionModal() {
    const connectionModal = document.getElementById('connectionModal');
    const motherBtn = document.getElementById('motherBtn');
    const fatherBtn = document.getElementById('fatherBtn');
    const childBtn = document.getElementById('childBtn');
    const spouseBtn = document.getElementById('spouseBtn');
    const lineOnlyBtn = document.getElementById('lineOnlyBtn');
    const cancelBtn = document.getElementById('cancelConnectionModal');
    const closeBtn = connectionModal?.querySelector('.modal-close-btn');

    if (!connectionModal) {
      console.warn('Connection modal not found');
      return;
    }

    // Setup relationship type buttons
    if (motherBtn) {
      motherBtn.addEventListener('click', () => this.createConnectionWithType('mother'));
    }
    if (fatherBtn) {
      fatherBtn.addEventListener('click', () => this.createConnectionWithType('father'));
    }
    if (childBtn) {
      childBtn.addEventListener('click', () => this.createConnectionWithType('child'));
    }
    if (spouseBtn) {
      spouseBtn.addEventListener('click', () => this.createConnectionWithType('spouse'));
    }
    if (lineOnlyBtn) {
      lineOnlyBtn.addEventListener('click', () => this.createConnectionWithType('line-only'));
    }

    // Setup cancel and close buttons
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.closeConnectionModal());
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeConnectionModal());
    }

    // Close modal when clicking outside
    connectionModal.addEventListener('click', (e) => {
      if (e.target === connectionModal) {
        this.closeConnectionModal();
      }
    });

    console.log('Connection modal setup complete');
  }

  /**
   * Open connection modal for selected persons
   */
  openConnectionModal(personA, personB) {
    const modal = document.getElementById('connectionModal');
    const connectionText = document.getElementById('connectionText');
    
    if (!modal) return;

    // Store connection data
    this.connectionPersonA = personA;
    this.connectionPersonB = personB;

    // Update modal text with person names
    if (connectionText) {
      const personAData = this.personData.get(personA);
      const personBData = this.personData.get(personB);
      const nameA = personAData?.name || 'Person A';
      const nameB = personBData?.name || 'Person B';
      connectionText.textContent = `${nameA} is __ to ${nameB}`;
    }

    modal.classList.remove('hidden');
    console.log(`Connection modal opened for ${personA} and ${personB}`);
  }

  /**
   * Close connection modal
   */
  closeConnectionModal() {
    const modal = document.getElementById('connectionModal');
    if (modal) {
      modal.classList.add('hidden');
      this.connectionPersonA = null;
      this.connectionPersonB = null;
      console.log('Connection modal closed');
    }
  }

  /**
   * Create connection with specified type
   */
  createConnectionWithType(type) {
    if (!this.connectionPersonA || !this.connectionPersonB) {
      console.error('No persons selected for connection');
      return;
    }

    const personA = this.connectionPersonA;
    const personB = this.connectionPersonB;

    console.log(`Creating ${type} connection between ${personA} and ${personB}`);

    switch (type) {
      case 'mother':
        this.createParentChildRelationship(personA, personB, 'mother');
        break;
      case 'father':
        this.createParentChildRelationship(personA, personB, 'father');
        break;
      case 'child':
        this.createParentChildRelationship(personB, personA, 'parent');
        break;
      case 'spouse':
        this.createSpouseRelationship(personA, personB);
        break;
      case 'line-only':
        this.createLineOnlyConnection(personA, personB);
        break;
      default:
        console.warn('Unknown connection type:', type);
        return;
    }

    // Emit analytics event for relationship created
    const eventBus = appContext.getEventBus();
    if (eventBus) {
      eventBus.emit('tree:relationship:added', {
        type,
        fromNodeId: personA,
        toNodeId: personB
      });
    }

    // Close modal and update UI
    this.closeConnectionModal();
    this.regenerateConnections();
    if (this.renderer) {
      this.renderer.needsRedraw = true;
    }

    // Auto-save
    if (this.cacheManager) {
      this.cacheManager.autoSave();
    }
  }

  /**
   * Create parent-child relationship
   */
  createParentChildRelationship(parentId, childId, parentType) {
    const childData = this.personData.get(childId);
    if (!childData) return;

    if (parentType === 'mother') {
      childData.motherId = parentId;
    } else if (parentType === 'father') {
      childData.fatherId = parentId;
    } else {
      // Generic parent - determine by gender
      const parentData = this.personData.get(parentId);
      if (parentData?.gender === 'female') {
        childData.motherId = parentId;
      } else {
        childData.fatherId = parentId;
      }
    }

    this.personData.set(childId, childData);
    
    // Unhide this specific parent-child connection if it was hidden
    const connectionKey = this.getConnectionKey(parentId, childId, 'parent');
    if (this.hiddenConnections.has(connectionKey)) {
      this.hiddenConnections.delete(connectionKey);
      console.log(`Unhidden parent-child connection: ${connectionKey}`);
    }
    
    console.log(`Created parent-child relationship: ${parentId} -> ${childId}`);
  }

  /**
   * Create spouse relationship
   */
  createSpouseRelationship(personAId, personBId) {
    const personAData = this.personData.get(personAId);
    const personBData = this.personData.get(personBId);
    
    if (!personAData || !personBData) return;

    personAData.spouseId = personBId;
    personBData.spouseId = personAId;
    
    this.personData.set(personAId, personAData);
    this.personData.set(personBId, personBData);
    
    // Unhide this specific spouse connection if it was hidden
    const connectionKey = this.getConnectionKey(personAId, personBId, 'spouse');
    if (this.hiddenConnections.has(connectionKey)) {
      this.hiddenConnections.delete(connectionKey);
      console.log(`Unhidden spouse connection: ${connectionKey}`);
    }
    
    console.log(`Created spouse relationship: ${personAId} <-> ${personBId}`);
  }

  /**
   * Create line-only connection (visual only)
   */
  createLineOnlyConnection(personAId, personBId) {
    if (!this.renderer) return;

    // Check if line-only connection already exists
    const connectionKey = this.getConnectionKey(personAId, personBId);
    
    // Remove existing line-only connection first (allows redrawing)
    if (this.lineOnlyConnections.has(connectionKey)) {
      // Remove from renderer connections
      this.renderer.connections = this.renderer.connections.filter(conn =>
        !(conn.type === 'line-only' &&
          ((conn.from === personAId && conn.to === personBId) ||
           (conn.from === personBId && conn.to === personAId)))
      );
      console.log(`Removed existing line-only connection: ${personAId} <-> ${personBId}`);
    }

    // Add to line-only connections set
    this.lineOnlyConnections.add(connectionKey);

    // Unhide this specific line-only connection if it was hidden
    const lineOnlyConnectionKey = this.getConnectionKey(personAId, personBId, 'line-only');
    if (this.hiddenConnections.has(lineOnlyConnectionKey)) {
      this.hiddenConnections.delete(lineOnlyConnectionKey);
      console.log(`Unhidden line-only connection: ${lineOnlyConnectionKey}`);
    }

    // Add connection to renderer
    this.renderer.connections.push({
      from: personAId,
      to: personBId,
      type: 'line-only'
    });

    console.log(`Created line-only connection: ${personAId} <-> ${personBId}`);
  }

  /**
   * Handle bringing selected nodes to front
   */
  handleBringToFront() {
    const selectedNodes = this.renderer.getSelectedNodes();
    
    if (selectedNodes.size === 0) {
      console.warn('No nodes selected to bring to front');
      return;
    }
    
    console.log('Bringing selected nodes to front:', Array.from(selectedNodes));
    
    if (!this.renderer) return;
    
    // Get current max z-index
    let maxZIndex = 0;
    for (const [id, node] of this.renderer.nodes) {
      if (node.zIndex && node.zIndex > maxZIndex) {
        maxZIndex = node.zIndex;
      }
    }
    
    // Set selected nodes to have higher z-index
    for (const nodeId of selectedNodes) {
      const node = this.renderer.nodes.get(nodeId);
      if (node) {
        maxZIndex++;
        node.zIndex = maxZIndex;
        this.renderer.setNode(nodeId, node);
        console.log(`Set ${nodeId} z-index to ${maxZIndex}`);
      }
    }
    
    // Trigger redraw
    this.renderer.needsRedraw = true;
    
    // Auto-save the new ordering
    if (this.cacheManager) {
      this.cacheManager.autoSave();
    }
    
    console.log('Nodes brought to front successfully');
  }

  /**
   * Process loaded data from JSON file or cache
   */
  processLoadedData(data) {
    console.log('Processing loaded data:', data);
    
    try {
      // Clear existing data
      this.personData.clear();
      if (this.renderer) {
        this.renderer.nodes.clear();
        this.renderer.connections = [];
        this.renderer.selectedNodes.clear();
      }
      
      // Process persons/people data
      const persons = data.persons || data.people || [];
      let maxId = 0;
      
      for (const person of persons) {
        const personId = person.id || this.generateId();
        
        // Extract numeric part of ID to update nextId counter
        const idMatch = personId.match(/(\d+)$/);
        if (idMatch) {
          const idNum = parseInt(idMatch[1]);
          if (idNum >= maxId) {
            maxId = idNum + 1;
          }
        }
        
        // Store person data
        const personData = {
          id: personId,
          name: person.name || '',
          fatherName: person.fatherName || '',
          surname: person.surname || '',
          maidenName: person.maidenName || '',
          dob: person.dob || '',
          gender: person.gender || '',
          motherId: person.motherId || '',
          fatherId: person.fatherId || '',
          spouseId: person.spouseId || ''
        };
        
        this.personData.set(personId, personData);
        
        // Create renderer node if renderer exists
        if (this.renderer) {
          const nodeData = {
            id: personId,
            name: person.name || '',
            fatherName: person.fatherName || '',
            surname: person.surname || '',
            maidenName: person.maidenName || '',
            dob: person.dob || '',
            gender: person.gender || '',
            x: person.x || 300,
            y: person.y || 300,
            color: person.color || this.defaultColor,
            radius: person.radius || this.nodeRadius
          };
          
          this.renderer.setNode(personId, nodeData);
        }
      }
      
      // Update nextId counter
      if (maxId > 0) {
        this.nextId = maxId;
      }
      
      // Restore settings if available
      if (data.settings) {
        // Apply basic settings
        Object.assign(this, data.settings);
        
        // Store line style settings separately for renderer sync
        this.lineStyleSettings = {
          familyLineStyle: data.settings.familyLineStyle,
          familyLineThickness: data.settings.familyLineThickness,
          familyLineColor: data.settings.familyLineColor,
          spouseLineStyle: data.settings.spouseLineStyle,
          spouseLineThickness: data.settings.spouseLineThickness,
          spouseLineColor: data.settings.spouseLineColor,
          lineOnlyStyle: data.settings.lineOnlyStyle,
          lineOnlyThickness: data.settings.lineOnlyThickness,
          lineOnlyColor: data.settings.lineOnlyColor,
          showNodeOutline: data.settings.showNodeOutline,
          outlineColor: data.settings.outlineColor,
          outlineThickness: data.settings.outlineThickness
        };
        
        // Apply settings to renderer
        this.updateRendererSettings();
      }
      
      // Restore display preferences
      if (data.displayPreferences) {
        this.displayPreferences = { ...data.displayPreferences };
      }
      
      // Restore node style
      if (data.nodeStyle) {
        this.nodeStyle = data.nodeStyle;
      }
      
      // Restore camera position
      if (data.camera && this.renderer) {
        this.renderer.camera = { ...data.camera };
      }
      
      // Restore hidden and line-only connections
      if (data.hiddenConnections) {
        this.hiddenConnections = new Set(data.hiddenConnections);
      }
      
      if (data.lineOnlyConnections) {
        this.lineOnlyConnections = new Set(data.lineOnlyConnections);
      }
      
      // Regenerate connections based on relationship data
      this.regenerateConnections();
      
      // Update UI
      if (this.renderer) {
        this.renderer.needsRedraw = true;
      }
      
      // Update undo/redo state
      if (this.undoRedoManager) {
        this.undoRedoManager.clearStacks();
        this.undoRedoManager.pushUndoState();
      }
      
      console.log(`Successfully loaded ${persons.length} people`);
      
    } catch (error) {
      console.error('Error processing loaded data:', error);
      throw error;
    }
  }

  /**
   * Get current state for saving/caching
   */
  getCurrentState() {
    const persons = [];
    
    // Convert person data to saveable format
    for (const [personId, personData] of this.personData) {
      const node = this.renderer?.nodes.get(personId);
      
      const person = {
        id: personId,
        name: personData.name || '',
        fatherName: personData.fatherName || '',
        surname: personData.surname || '',
        maidenName: personData.maidenName || '',
        dob: personData.dob || '',
        gender: personData.gender || '',
        motherId: personData.motherId || '',
        fatherId: personData.fatherId || '',
        spouseId: personData.spouseId || '',
        x: node?.x || 300,
        y: node?.y || 300,
        color: node?.color || this.defaultColor,
        radius: node?.radius || this.nodeRadius,
        zIndex: node?.zIndex || 0
      };
      
      persons.push(person);
    }
    
    return {
      version: this.cacheVersion,
      persons: persons,
      settings: {
        nodeRadius: this.nodeRadius,
        defaultColor: this.defaultColor,
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        nameColor: this.nameColor,
        dateColor: this.dateColor,
        
        // Node outline settings
        showNodeOutline: this.renderer?.settings.showNodeOutline ?? true,
        outlineColor: this.renderer?.settings.outlineColor ?? '#2c3e50',
        outlineThickness: this.renderer?.settings.outlineThickness ?? 2,
        
        // Line style settings
        familyLineStyle: this.renderer?.settings.familyLineStyle ?? 'solid',
        familyLineThickness: this.renderer?.settings.familyLineThickness ?? 2,
        familyLineColor: this.renderer?.settings.familyLineColor ?? '#7f8c8d',
        
        spouseLineStyle: this.renderer?.settings.spouseLineStyle ?? 'dashed',
        spouseLineThickness: this.renderer?.settings.spouseLineThickness ?? 2,
        spouseLineColor: this.renderer?.settings.spouseLineColor ?? '#e74c3c',
        
        lineOnlyStyle: this.renderer?.settings.lineOnlyStyle ?? 'dash-dot',
        lineOnlyThickness: this.renderer?.settings.lineOnlyThickness ?? 2,
        lineOnlyColor: this.renderer?.settings.lineOnlyColor ?? '#9b59b6'
      },
      displayPreferences: this.displayPreferences,
      nodeStyle: this.nodeStyle,
      camera: this.renderer?.camera || { x: 0, y: 0, scale: 1 },
      hiddenConnections: Array.from(this.hiddenConnections),
      lineOnlyConnections: Array.from(this.lineOnlyConnections),
      nextId: this.nextId
    };
  }

  /**
   * Load initial state from cache
   */
  async loadInitialState() {
    console.log('Loading initial state from cache...');
    
    if (this.cacheManager) {
      const loaded = await this.cacheManager.loadCachedState();
      
      if (loaded) {
        console.log('Successfully loaded cached state');
        
        // Now that cached data is loaded, update renderer settings
        // This ensures line styles are properly applied and not overwritten
        this.updateRendererSettings();
        console.log('Renderer settings applied after cache load');
        
        // Update UI form controls to reflect loaded settings
        this.updateUIControls();
        console.log('UI controls updated with cached settings');
        
        // Update cache indicator
        if (this.enhancedCacheIndicator) {
          this.enhancedCacheIndicator.updateStats();
          this.enhancedCacheIndicator.updateSaveStatus('Cached data loaded');
        }
        
        return true;
      } else {
        console.log('No cached state found, starting fresh');
        
        // For fresh start, apply default renderer settings
        this.updateRendererSettings();
        console.log('Default renderer settings applied for fresh start');
        
        return false;
      }
    } else {
      console.warn('Cache manager not available');
      
      // Fallback: apply default renderer settings
      this.updateRendererSettings();
      console.log('Default renderer settings applied as fallback');
      
      return false;
    }
  }

  /**
   * Update UI form controls to reflect current renderer settings
   */
  updateUIControls() {
    if (!this.renderer) return;
    
    console.log('Updating UI controls with current renderer settings...');
    
    // Family line settings
    const familyLineStyleSelect = document.getElementById('familyLineStyleSelect');
    if (familyLineStyleSelect) {
      familyLineStyleSelect.value = this.renderer.settings.familyLineStyle ?? 'solid';
    }
    
    const familyLineThicknessInput = document.getElementById('familyLineThicknessInput');
    if (familyLineThicknessInput) {
      familyLineThicknessInput.value = this.renderer.settings.familyLineThickness ?? 2;
    }
    
    const familyLineColorPicker = document.getElementById('familyLineColorPicker');
    if (familyLineColorPicker) {
      familyLineColorPicker.value = this.renderer.settings.familyLineColor ?? '#7f8c8d';
    }
    
    // Spouse line settings
    const spouseLineStyleSelect = document.getElementById('spouseLineStyleSelect');
    if (spouseLineStyleSelect) {
      spouseLineStyleSelect.value = this.renderer.settings.spouseLineStyle ?? 'dashed';
    }
    
    const spouseLineThicknessInput = document.getElementById('spouseLineThicknessInput');
    if (spouseLineThicknessInput) {
      spouseLineThicknessInput.value = this.renderer.settings.spouseLineThickness ?? 2;
    }
    
    const spouseLineColorPicker = document.getElementById('spouseLineColorPicker');
    if (spouseLineColorPicker) {
      spouseLineColorPicker.value = this.renderer.settings.spouseLineColor ?? '#e74c3c';
    }
    
    // Line-only settings
    const lineOnlyStyleSelect = document.getElementById('lineOnlyStyleSelect');
    if (lineOnlyStyleSelect) {
      lineOnlyStyleSelect.value = this.renderer.settings.lineOnlyStyle ?? 'dash-dot';
    }
    
    const lineOnlyThicknessInput = document.getElementById('lineOnlyThicknessInput');
    if (lineOnlyThicknessInput) {
      lineOnlyThicknessInput.value = this.renderer.settings.lineOnlyThickness ?? 2;
    }
    
    const lineOnlyColorPicker = document.getElementById('lineOnlyColorPicker');
    if (lineOnlyColorPicker) {
      lineOnlyColorPicker.value = this.renderer.settings.lineOnlyColor ?? '#9b59b6';
    }
    
    // Node outline settings
    const showNodeOutline = document.getElementById('showNodeOutline');
    if (showNodeOutline) {
      showNodeOutline.checked = this.renderer.settings.showNodeOutline ?? true;
    }
    
    const outlineThicknessInput = document.getElementById('outlineThicknessInput');
    if (outlineThicknessInput) {
      outlineThicknessInput.value = this.renderer.settings.outlineThickness ?? 2;
    }
    
    const outlineColorPicker = document.getElementById('outlineColorPicker');
    if (outlineColorPicker) {
      outlineColorPicker.value = this.renderer.settings.outlineColor ?? '#2c3e50';
    }
    
    console.log('UI controls updated successfully');
  }

  /**
   * Auto-save current state
   */
  autoSave() {
    if (this.cacheManager) {
      this.cacheManager.autoSave();
    }
  }

  // Methods required for Shape Manager integration
  getPeople() {
    const people = [];
    if (this.personData) {
      for (const [id, data] of this.personData) {
        const person = {
          id,
          ...data,
          parents: []
        };
        
        // Add parent relationships
        if (data.motherId) person.parents.push(data.motherId);
        if (data.fatherId) person.parents.push(data.fatherId);
        
        // Add spouse relationships (as array for consistency)
        if (data.spouseId) person.spouses = [data.spouseId];
        
        people.push(person);
      }
    }
    return people;
  }

  updatePersonPosition(personId, x, y) {
    if (!this.renderer || !this.renderer.nodes.has(personId)) {
      console.warn(`Cannot update position for person ${personId}: not found in renderer`);
      return;
    }
    
    const node = this.renderer.nodes.get(personId);
    node.x = x;
    node.y = y;
    this.renderer.needsRedraw = true;
  }

  render() {
    if (this.renderer) {
      this.renderer.needsRedraw = true;
    }
  }

  getPersonData(personId) {
    return this.personData ? this.personData.get(personId) : null;
  }
}

// Backward compatibility - export as TreeCoreCanvas
export { TreeEngine as TreeCoreCanvas };
/**
 * UICoordinator - Coordinates UI updates via events
 *
 * Responsibilities:
 * - Listen to core events and update UI accordingly
 * - Decouple core logic from UI components
 * - Handle UI notifications and modal coordination
 *
 * This replaces direct UI imports in core logic, following event-driven architecture.
 */

import { EVENTS } from '../utils/event-bus.js';

export class UICoordinator {
  #eventBus;
  #modalManager;
  #notificationManager;
  #tableManager;

  constructor(eventBus) {
    this.#eventBus = eventBus;
    this.#modalManager = null;
    this.#notificationManager = null;
    this.#tableManager = null;

    this.#setupEventListeners();
  }

  /**
   * Register UI managers
   * These are lazy-loaded to avoid circular dependencies
   */
  async registerManagers() {
    try {
      // Dynamically import UI modules
      const [modalModule, notifModule, tableModule] = await Promise.all([
        import('./modals/modal.js').catch(() => null),
        import('./components/notifications.js').catch(() => null),
        import('./components/table.js').catch(() => null)
      ]);

      if (modalModule) {
        this.#modalManager = modalModule;
      }

      if (notifModule) {
        this.#notificationManager = notifModule.notifications;
      }

      if (tableModule) {
        this.#tableManager = tableModule;
      }

      this.#eventBus.emit('ui:managers:registered');
    } catch (error) {
      console.error('Failed to register UI managers:', error);
    }
  }

  /**
   * Setup event listeners
   * @private
   */
  #setupEventListeners() {
    // Person events
    this.#eventBus.on(EVENTS.TREE_PERSON_ADDED, this.#onPersonAdded.bind(this));
    this.#eventBus.on(EVENTS.TREE_PERSON_UPDATED, this.#onPersonUpdated.bind(this));
    this.#eventBus.on(EVENTS.TREE_PERSON_DELETED, this.#onPersonDeleted.bind(this));

    // Relationship events
    this.#eventBus.on(EVENTS.TREE_RELATIONSHIP_ADDED, this.#onRelationshipAdded.bind(this));
    this.#eventBus.on(EVENTS.TREE_RELATIONSHIP_REMOVED, this.#onRelationshipRemoved.bind(this));

    // Tree events
    this.#eventBus.on(EVENTS.TREE_LOADED, this.#onTreeLoaded.bind(this));
    this.#eventBus.on(EVENTS.TREE_SAVED, this.#onTreeSaved.bind(this));

    // Selection events
    this.#eventBus.on(EVENTS.CANVAS_NODE_SELECTED, this.#onNodeSelected.bind(this));

    // Data validation events
    this.#eventBus.on(EVENTS.DATA_VALIDATION_ERROR, this.#onValidationError.bind(this));

    // Export/Import events
    this.#eventBus.on(EVENTS.DATA_EXPORT_COMPLETED, this.#onExportCompleted.bind(this));
    this.#eventBus.on(EVENTS.DATA_IMPORT_COMPLETED, this.#onImportCompleted.bind(this));

    // Error events
    this.#eventBus.on(EVENTS.ERROR_OCCURRED, this.#onError.bind(this));
  }

  /**
   * Handle person added
   * @private
   */
  #onPersonAdded(person) {
    this.showNotification('success', `Added ${person.name}`);
    this.#refreshTable();
  }

  /**
   * Handle person updated
   * @private
   */
  #onPersonUpdated(person) {
    this.showNotification('success', `Updated ${person.name}`);
    this.#refreshTable();
  }

  /**
   * Handle person deleted
   * @private
   */
  #onPersonDeleted({ person }) {
    this.showNotification('info', `Deleted ${person.name}`);
    this.#refreshTable();
  }

  /**
   * Handle relationship added
   * @private
   */
  #onRelationshipAdded({ childId, parentId, person1Id, person2Id, type }) {
    if (type === 'spouse') {
      this.showNotification('success', 'Spouse relationship created');
    } else {
      this.showNotification('success', `${type} relationship created`);
    }
    this.#refreshTable();
  }

  /**
   * Handle relationship removed
   * @private
   */
  #onRelationshipRemoved({ type }) {
    this.showNotification('info', `${type} relationship removed`);
    this.#refreshTable();
  }

  /**
   * Handle tree loaded
   * @private
   */
  #onTreeLoaded({ persons }) {
    this.showNotification('success', `Loaded tree with ${persons.length} people`);
    this.#refreshTable();
  }

  /**
   * Handle tree saved
   * @private
   */
  #onTreeSaved() {
    this.showNotification('success', 'Tree saved successfully');
  }

  /**
   * Handle node selected
   * @private
   */
  #onNodeSelected({ selectedNodes }) {
    // Update UI to reflect selection (e.g., enable/disable buttons)
    this.#eventBus.emit('ui:selection:updated', { count: selectedNodes.length });
  }

  /**
   * Handle validation error
   * @private
   */
  #onValidationError({ errors }) {
    const errorMessage = errors.join(', ');
    this.showNotification('error', `Validation error: ${errorMessage}`);
  }

  /**
   * Handle export completed
   * @private
   */
  #onExportCompleted({ format, filename }) {
    this.showNotification('success', `Exported to ${filename}`);
  }

  /**
   * Handle import completed
   * @private
   */
  #onImportCompleted({ personCount }) {
    this.showNotification('success', `Imported ${personCount} people`);
    this.#refreshTable();
  }

  /**
   * Handle error
   * @private
   */
  #onError({ message, type }) {
    this.showNotification('error', message);
  }

  /**
   * Show notification
   * @param {string} type - 'success', 'error', 'warning', 'info'
   * @param {string} message
   */
  showNotification(type, message) {
    if (this.#notificationManager) {
      this.#notificationManager[type](message);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Open modal for adding person
   */
  openAddPersonModal() {
    if (this.#modalManager) {
      this.#modalManager.openModalForAdd();
      this.#eventBus.emit(EVENTS.UI_MODAL_OPENED, { type: 'add-person' });
    }
  }

  /**
   * Open modal for editing person
   * @param {string} personId
   */
  openEditPersonModal(personId) {
    if (this.#modalManager) {
      this.#modalManager.openModalForEdit(personId);
      this.#eventBus.emit(EVENTS.UI_MODAL_OPENED, { type: 'edit-person', personId });
    }
  }

  /**
   * Close modal
   */
  closeModal() {
    if (this.#modalManager) {
      this.#modalManager.closeModal();
      this.#eventBus.emit(EVENTS.UI_MODAL_CLOSED);
    }
  }

  /**
   * Refresh table view
   * @private
   */
  #refreshTable() {
    if (this.#tableManager) {
      this.#tableManager.rebuildTableView();
    }
  }

  /**
   * Request table rebuild (public method for external use)
   */
  rebuildTable() {
    this.#refreshTable();
  }

  /**
   * Show confirmation dialog
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  async confirm(message) {
    return window.confirm(message);
  }

  /**
   * Show prompt dialog
   * @param {string} message
   * @param {string} defaultValue
   * @returns {Promise<string|null>}
   */
  async prompt(message, defaultValue = '') {
    return window.prompt(message, defaultValue);
  }

  /**
   * Update UI theme
   * @param {string} theme - 'light' or 'dark'
   */
  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.#eventBus.emit(EVENTS.UI_SETTINGS_UPDATED, { theme });
  }

  /**
   * Enable/disable UI controls
   * @param {boolean} enabled
   */
  setControlsEnabled(enabled) {
    this.#eventBus.emit('ui:controls:enabled', { enabled });
  }

  /**
   * Show loading indicator
   * @param {string} message
   */
  showLoading(message = 'Loading...') {
    this.#eventBus.emit('ui:loading:show', { message });
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    this.#eventBus.emit('ui:loading:hide');
  }

  /**
   * Update progress bar
   * @param {number} percent - 0-100
   * @param {string} message
   */
  updateProgress(percent, message = '') {
    this.#eventBus.emit('ui:progress:update', { percent, message });
  }

  /**
   * Show context menu
   * @param {number} x - Screen X coordinate
   * @param {number} y - Screen Y coordinate
   * @param {Array} items - Menu items
   */
  showContextMenu(x, y, items) {
    this.#eventBus.emit('ui:context-menu:show', { x, y, items });
  }

  /**
   * Hide context menu
   */
  hideContextMenu() {
    this.#eventBus.emit('ui:context-menu:hide');
  }

  /**
   * Focus on canvas
   */
  focusCanvas() {
    const canvas = document.getElementById('familyTreeCanvas');
    if (canvas) {
      canvas.focus();
    }
  }

  /**
   * Clean up event listeners
   */
  destroy() {
    this.#eventBus.removeAllListeners(EVENTS.TREE_PERSON_ADDED);
    this.#eventBus.removeAllListeners(EVENTS.TREE_PERSON_UPDATED);
    this.#eventBus.removeAllListeners(EVENTS.TREE_PERSON_DELETED);
    this.#eventBus.removeAllListeners(EVENTS.TREE_RELATIONSHIP_ADDED);
    this.#eventBus.removeAllListeners(EVENTS.TREE_RELATIONSHIP_REMOVED);
    this.#eventBus.removeAllListeners(EVENTS.TREE_LOADED);
    this.#eventBus.removeAllListeners(EVENTS.TREE_SAVED);
    this.#eventBus.removeAllListeners(EVENTS.CANVAS_NODE_SELECTED);
    this.#eventBus.removeAllListeners(EVENTS.DATA_VALIDATION_ERROR);
    this.#eventBus.removeAllListeners(EVENTS.DATA_EXPORT_COMPLETED);
    this.#eventBus.removeAllListeners(EVENTS.DATA_IMPORT_COMPLETED);
    this.#eventBus.removeAllListeners(EVENTS.ERROR_OCCURRED);
  }
}

/**
 * Create and initialize UI coordinator
 * @param {EventBus} eventBus
 * @returns {Promise<UICoordinator>}
 */
export async function createUICoordinator(eventBus) {
  const coordinator = new UICoordinator(eventBus);
  await coordinator.registerManagers();
  return coordinator;
}

/**
 * Analytics Integration Module
 * Connects the analytics service to the application's event bus
 * Automatically tracks events emitted through the event system
 */

import analyticsService from './analytics-service.js';

class AnalyticsIntegration {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.listeners = [];
    this.isInitialized = false;
  }

  /**
   * Initialize analytics integration
   * Sets up event listeners on the event bus
   */
  init() {
    if (this.isInitialized) {
      console.warn('[AnalyticsIntegration] Already initialized');
      return;
    }

    console.log('[AnalyticsIntegration] Initializing analytics integration');

    // Person management events
    this.listen('tree:person:added', (data) => {
      analyticsService.trackPersonCreated(data);
    });

    this.listen('tree:person:updated', (data) => {
      analyticsService.trackPersonUpdated(data.id, data.changes);
    });

    this.listen('tree:person:deleted', (data) => {
      analyticsService.trackPersonDeleted(data.id, data.hadRelationships);
    });

    // Relationship events
    this.listen('tree:relationship:added', (data) => {
      analyticsService.trackRelationshipCreated(
        data.type || data.relationshipType,
        data.fromNodeId || data.from,
        data.toNodeId || data.to
      );
    });

    this.listen('tree:relationship:removed', (data) => {
      analyticsService.trackRelationshipDeleted(
        data.type || data.relationshipType,
        data.fromNodeId || data.from,
        data.toNodeId || data.to
      );
    });

    // Tree management events
    this.listen('tree:loaded', (data) => {
      analyticsService.trackTreeLoaded(data.nodeCount, data.source);
    });

    this.listen('tree:saved', (data) => {
      analyticsService.trackTreeSaved(data.nodeCount, data.saveType);
    });

    this.listen('tree:cleared', (data) => {
      analyticsService.trackTreeCleared(data.nodeCount);
    });

    // Data export/import events
    this.listen('data:export:started', (data) => {
      // Export started - could track this separately if needed
      analyticsService.log('Export started', data);
    });

    this.listen('data:export:completed', (data) => {
      analyticsService.trackTreeExported(
        data.format,
        true,
        data.nodeCount
      );
    });

    this.listen('data:export:failed', (data) => {
      analyticsService.trackTreeExported(
        data.format,
        false,
        data.nodeCount,
        data.error
      );
    });

    this.listen('data:import:started', (data) => {
      analyticsService.log('Import started', data);
    });

    this.listen('data:import:completed', (data) => {
      analyticsService.trackTreeImported(
        data.format,
        data.nodeCount,
        true
      );
    });

    this.listen('data:import:failed', (data) => {
      analyticsService.trackTreeImported(
        data.format,
        data.nodeCount || 0,
        false
      );
    });

    // Canvas interaction events
    this.listen('canvas:node:selected', (data) => {
      analyticsService.trackNodeSelected(
        data.nodeId,
        data.isMultiSelect,
        data.totalSelected
      );
    });

    this.listen('canvas:node:deselected', (data) => {
      analyticsService.trackNodeDeselected(data.nodeId);
    });

    this.listen('canvas:node:dragged', (data) => {
      analyticsService.trackNodeDragged(data.nodeId, data.distance);
    });

    this.listen('canvas:node:double-clicked', (data) => {
      analyticsService.trackNodeDoubleClicked(data.nodeId);
    });

    this.listen('canvas:zoom:changed', (data) => {
      const direction = data.zoomLevel > (data.previousZoom || 1) ? 'in' : 'out';
      analyticsService.trackCameraZoomed(data.zoomLevel, direction);
    });

    this.listen('canvas:pan:changed', (data) => {
      analyticsService.trackCameraPanned(data.deltaX, data.deltaY);
    });

    // UI events
    this.listen('ui:modal:opened', (data) => {
      analyticsService.trackModalOpened(data.modalType, data.context);
    });

    this.listen('ui:modal:closed', (data) => {
      analyticsService.trackModalClosed(data.modalType, data.action);
    });

    this.listen('ui:settings:updated', (data) => {
      analyticsService.trackDisplayPreferenceChanged(
        data.settingName,
        data.settingValue
      );
    });

    this.listen('ui:theme:changed', (data) => {
      analyticsService.trackThemeChanged(data.theme);
    });

    // Node styling events
    this.listen('node:styled', (data) => {
      analyticsService.trackNodeStyled(data.nodeIds, data.styleChanges);
    });

    this.listen('node:brought-to-front', (data) => {
      analyticsService.trackNodeBroughtToFront(data.nodeIds);
    });

    // Undo/Redo events
    this.listen('undo:triggered', (data) => {
      analyticsService.trackUndo(data.actionType);
    });

    this.listen('redo:triggered', (data) => {
      analyticsService.trackRedo(data.actionType);
    });

    // Error events
    this.listen('error:occurred', (data) => {
      analyticsService.trackError(
        data.errorType || 'unknown',
        data.message,
        data.context
      );
    });

    // Search events
    this.listen('search:performed', (data) => {
      analyticsService.trackSearch(data.query, data.resultsFound);
    });

    this.listen('search:result:selected', (data) => {
      analyticsService.trackSearchResultSelected(data.resultIndex);
    });

    // Table view events
    this.listen('table:opened', (data) => {
      analyticsService.trackTableViewOpened(data.rowCount);
    });

    this.listen('table:closed', () => {
      analyticsService.trackTableViewClosed();
    });

    this.listen('table:sorted', (data) => {
      analyticsService.trackTableSorted(data.columnName, data.direction);
    });

    // Form events
    this.listen('form:field:changed', (data) => {
      analyticsService.trackFormFieldChanged(data.fieldName, data.hasValue);
    });

    this.listen('form:validation:failed', (data) => {
      analyticsService.trackFormValidationError(data.fieldName, data.errorType);
    });

    this.listen('form:submitted', (data) => {
      analyticsService.trackFormSubmitted(data.formType, data.fieldsFilled);
    });

    this.listen('form:gender:selected', (data) => {
      analyticsService.trackGenderSelected(data.gender);
    });

    // Button click events
    this.listen('button:clicked', (data) => {
      analyticsService.trackButtonClick(data.buttonName, data.context);
    });

    // Track session started
    analyticsService.trackSessionStarted();

    // Track session ended on page unload
    window.addEventListener('beforeunload', () => {
      const sessionDuration = Math.floor((Date.now() - analyticsService.sessionStartTime) / 1000);
      analyticsService.trackSessionEnded(sessionDuration);
    });

    this.isInitialized = true;
    console.log('[AnalyticsIntegration] Analytics integration initialized successfully');
  }

  /**
   * Helper method to add event listener and track it
   */
  listen(eventName, handler) {
    if (!this.eventBus || !this.eventBus.on) {
      console.error('[AnalyticsIntegration] Event bus not available or invalid');
      return;
    }

    this.eventBus.on(eventName, handler);
    this.listeners.push({ eventName, handler });
  }

  /**
   * Remove all analytics listeners
   */
  destroy() {
    if (!this.eventBus || !this.eventBus.off) {
      return;
    }

    this.listeners.forEach(({ eventName, handler }) => {
      this.eventBus.off(eventName, handler);
    });

    this.listeners = [];
    this.isInitialized = false;
    console.log('[AnalyticsIntegration] Analytics integration destroyed');
  }

  /**
   * Get analytics statistics
   */
  getStats() {
    return analyticsService.getEventStats();
  }

  /**
   * Get event queue (for debugging)
   */
  getEventQueue() {
    return analyticsService.getEventQueue();
  }
}

export default AnalyticsIntegration;

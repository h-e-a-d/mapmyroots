/**
 * Analytics Service for Family Tree Application
 * Implements Google Analytics 4 (GA4) event tracking
 * All events are sent with event_name dimension for GA4
 */

class AnalyticsService {
  constructor() {
    this.isEnabled = false;
    this.isDevelopment = false;
    this.eventQueue = [];
    this.sessionStartTime = Date.now();
    this.eventCounts = {};

    this.init();
  }

  /**
   * Initialize analytics service
   */
  init() {
    // Check if Google Analytics is available
    this.isEnabled = typeof window !== 'undefined' &&
                     (typeof window.gtag === 'function' || typeof window.ga === 'function');

    // Check if we're in development mode
    this.isDevelopment = window.location.hostname === 'localhost' ||
                        window.location.hostname === '127.0.0.1';

    if (this.isDevelopment) {
      console.log('[Analytics] Running in development mode - events will be logged to console');
    }

    // Log initialization
    this.log('Analytics Service Initialized', {
      enabled: this.isEnabled,
      development: this.isDevelopment
    });
  }

  /**
   * Send event to Google Analytics
   * @param {string} eventName - The event name (required)
   * @param {object} params - Event parameters (optional)
   */
  sendEvent(eventName, params = {}) {
    if (!eventName) {
      console.error('[Analytics] Event name is required');
      return;
    }

    // Add standard parameters
    const eventData = {
      event: eventName,  // GTM looks for 'event' property
      event_name: eventName,
      timestamp: new Date().toISOString(),
      session_duration: Math.floor((Date.now() - this.sessionStartTime) / 1000),
      ...params
    };

    // Track event count
    this.eventCounts[eventName] = (this.eventCounts[eventName] || 0) + 1;
    eventData.event_count = this.eventCounts[eventName];

    // In development mode, just log to console
    if (this.isDevelopment) {
      this.log(eventName, eventData);
      this.eventQueue.push({ eventName, params: eventData, timestamp: Date.now() });
      return;
    }

    // Send to dataLayer for GTM (primary method)
    if (typeof window !== 'undefined' && window.dataLayer) {
      try {
        window.dataLayer.push(eventData);
        this.log(`Event sent to dataLayer: ${eventName}`, eventData);
      } catch (error) {
        console.error('[Analytics] Error pushing to dataLayer:', error);
      }
    }
    // Fallback to gtag if available
    else if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', eventName, eventData);
        this.log(`Event sent via gtag: ${eventName}`, eventData);
      } catch (error) {
        console.error('[Analytics] Error sending via gtag:', error);
      }
    }
    // Fallback to Universal Analytics
    else if (typeof window.ga === 'function') {
      try {
        window.ga('send', 'event', {
          eventCategory: params.category || 'general',
          eventAction: eventName,
          eventLabel: params.label || '',
          eventValue: params.value || undefined
        });
        this.log(`Event sent via ga: ${eventName}`, eventData);
      } catch (error) {
        console.error('[Analytics] Error sending via ga:', error);
      }
    } else {
      // Queue events if nothing is available yet
      this.eventQueue.push({ eventName, params: eventData, timestamp: Date.now() });
      console.warn('[Analytics] No analytics method available, event queued');
    }
  }

  /**
   * Log analytics events to console
   */
  log(message, data = {}) {
    if (this.isDevelopment) {
      console.log(`[Analytics] ${message}`, data);
    }
  }

  /**
   * Get queued events (useful for debugging)
   */
  getEventQueue() {
    return this.eventQueue;
  }

  /**
   * Clear event queue
   */
  clearEventQueue() {
    this.eventQueue = [];
  }

  /**
   * Get event statistics
   */
  getEventStats() {
    return {
      totalEvents: Object.values(this.eventCounts).reduce((sum, count) => sum + count, 0),
      uniqueEvents: Object.keys(this.eventCounts).length,
      eventCounts: { ...this.eventCounts },
      sessionDuration: Math.floor((Date.now() - this.sessionStartTime) / 1000)
    };
  }

  // ============================================
  // PERSON MANAGEMENT EVENTS
  // ============================================

  /**
   * Track person created
   */
  trackPersonCreated(personData) {
    this.sendEvent('person_created', {
      category: 'person_management',
      person_id: personData.id,
      has_name: !!personData.name,
      has_surname: !!personData.surname,
      has_dob: !!personData.dob,
      has_father_name: !!personData.fatherName,
      has_maiden_name: !!personData.maidenName,
      gender: personData.gender || 'not_specified',
      has_mother: !!personData.motherId,
      has_father: !!personData.fatherId,
      has_spouse: !!personData.spouseId,
      relationship_count: [personData.motherId, personData.fatherId, personData.spouseId]
        .filter(Boolean).length
    });
  }

  /**
   * Track person updated
   */
  trackPersonUpdated(personId, changes = {}) {
    this.sendEvent('person_updated', {
      category: 'person_management',
      person_id: personId,
      fields_changed: Object.keys(changes).length,
      changed_fields: Object.keys(changes).join(',')
    });
  }

  /**
   * Track person deleted
   */
  trackPersonDeleted(personId, hadRelationships = false) {
    this.sendEvent('person_deleted', {
      category: 'person_management',
      person_id: personId,
      had_relationships: hadRelationships
    });
  }

  // ============================================
  // RELATIONSHIP MANAGEMENT EVENTS
  // ============================================

  /**
   * Track relationship created
   */
  trackRelationshipCreated(relationshipType, fromNodeId, toNodeId) {
    this.sendEvent('relationship_created', {
      category: 'relationship_management',
      relationship_type: relationshipType,
      from_node_id: fromNodeId,
      to_node_id: toNodeId
    });
  }

  /**
   * Track relationship deleted
   */
  trackRelationshipDeleted(relationshipType, fromNodeId, toNodeId) {
    this.sendEvent('relationship_deleted', {
      category: 'relationship_management',
      relationship_type: relationshipType,
      from_node_id: fromNodeId,
      to_node_id: toNodeId
    });
  }

  // ============================================
  // TREE MANAGEMENT EVENTS
  // ============================================

  /**
   * Track tree exported
   */
  trackTreeExported(format, success = true, nodeCount = 0, errorMessage = null) {
    this.sendEvent(success ? 'tree_exported' : 'tree_export_failed', {
      category: 'tree_management',
      export_format: format,
      node_count: nodeCount,
      success: success,
      error_message: errorMessage,
      file_size: null // Can be added if available
    });
  }

  /**
   * Track tree imported
   */
  trackTreeImported(format, nodeCount = 0, success = true) {
    this.sendEvent(success ? 'tree_imported' : 'tree_import_failed', {
      category: 'tree_management',
      import_format: format,
      node_count: nodeCount,
      success: success
    });
  }

  /**
   * Track tree cleared
   */
  trackTreeCleared(nodeCount = 0) {
    this.sendEvent('tree_cleared', {
      category: 'tree_management',
      nodes_cleared: nodeCount
    });
  }

  /**
   * Track tree loaded from cache
   */
  trackTreeLoaded(nodeCount = 0, source = 'cache') {
    this.sendEvent('tree_loaded', {
      category: 'tree_management',
      node_count: nodeCount,
      source: source
    });
  }

  /**
   * Track tree saved
   */
  trackTreeSaved(nodeCount = 0, saveType = 'auto') {
    this.sendEvent('tree_saved', {
      category: 'tree_management',
      node_count: nodeCount,
      save_type: saveType // 'auto' or 'manual'
    });
  }

  // ============================================
  // CANVAS INTERACTION EVENTS
  // ============================================

  /**
   * Track node selection
   */
  trackNodeSelected(nodeId, isMultiSelect = false, totalSelected = 1) {
    this.sendEvent('node_selected', {
      category: 'canvas_interaction',
      node_id: nodeId,
      is_multi_select: isMultiSelect,
      total_selected: totalSelected
    });
  }

  /**
   * Track node deselection
   */
  trackNodeDeselected(nodeId) {
    this.sendEvent('node_deselected', {
      category: 'canvas_interaction',
      node_id: nodeId
    });
  }

  /**
   * Track node dragged
   */
  trackNodeDragged(nodeId, distance = 0) {
    this.sendEvent('node_dragged', {
      category: 'canvas_interaction',
      node_id: nodeId,
      distance: Math.round(distance)
    });
  }

  /**
   * Track camera zoom
   */
  trackCameraZoomed(zoomLevel, direction = 'in') {
    this.sendEvent('camera_zoomed', {
      category: 'canvas_interaction',
      zoom_level: zoomLevel.toFixed(2),
      direction: direction // 'in' or 'out'
    });
  }

  /**
   * Track camera pan
   */
  trackCameraPanned(deltaX = 0, deltaY = 0) {
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    this.sendEvent('camera_panned', {
      category: 'canvas_interaction',
      distance: Math.round(distance),
      delta_x: Math.round(deltaX),
      delta_y: Math.round(deltaY)
    });
  }

  /**
   * Track node double-clicked (for editing)
   */
  trackNodeDoubleClicked(nodeId) {
    this.sendEvent('node_double_clicked', {
      category: 'canvas_interaction',
      node_id: nodeId
    });
  }

  // ============================================
  // STYLING EVENTS
  // ============================================

  /**
   * Track node styled
   */
  trackNodeStyled(nodeIds = [], styleChanges = {}) {
    this.sendEvent('node_styled', {
      category: 'styling',
      nodes_affected: nodeIds.length,
      style_properties: Object.keys(styleChanges).join(','),
      has_color_change: 'color' in styleChanges,
      has_size_change: 'size' in styleChanges
    });
  }

  /**
   * Track node brought to front
   */
  trackNodeBroughtToFront(nodeIds = []) {
    this.sendEvent('node_brought_to_front', {
      category: 'styling',
      nodes_affected: nodeIds.length
    });
  }

  /**
   * Track display preference changed
   */
  trackDisplayPreferenceChanged(settingName, settingValue) {
    this.sendEvent('display_preference_changed', {
      category: 'settings',
      setting_name: settingName,
      setting_value: String(settingValue)
    });
  }

  /**
   * Track theme changed
   */
  trackThemeChanged(theme) {
    this.sendEvent('theme_changed', {
      category: 'settings',
      theme: theme
    });
  }

  // ============================================
  // UNDO/REDO EVENTS
  // ============================================

  /**
   * Track undo action
   */
  trackUndo(actionType = 'unknown') {
    this.sendEvent('undo_triggered', {
      category: 'actions',
      action_type: actionType
    });
  }

  /**
   * Track redo action
   */
  trackRedo(actionType = 'unknown') {
    this.sendEvent('redo_triggered', {
      category: 'actions',
      action_type: actionType
    });
  }

  // ============================================
  // MODAL EVENTS
  // ============================================

  /**
   * Track modal opened
   */
  trackModalOpened(modalType, context = {}) {
    this.sendEvent('modal_opened', {
      category: 'ui_interaction',
      modal_type: modalType, // e.g., 'add_person', 'edit_person', 'connect', 'style'
      ...context
    });
  }

  /**
   * Track modal closed
   */
  trackModalClosed(modalType, action = 'dismissed') {
    this.sendEvent('modal_closed', {
      category: 'ui_interaction',
      modal_type: modalType,
      close_action: action // 'saved', 'cancelled', 'dismissed'
    });
  }

  // ============================================
  // FORM EVENTS
  // ============================================

  /**
   * Track form field changed
   */
  trackFormFieldChanged(fieldName, hasValue = true) {
    this.sendEvent('form_field_changed', {
      category: 'form_interaction',
      field_name: fieldName,
      has_value: hasValue
    });
  }

  /**
   * Track form validation error
   */
  trackFormValidationError(fieldName, errorType) {
    this.sendEvent('form_validation_failed', {
      category: 'form_interaction',
      field_name: fieldName,
      error_type: errorType
    });
  }

  /**
   * Track form submitted
   */
  trackFormSubmitted(formType, fieldsFilled = 0) {
    this.sendEvent('form_submitted', {
      category: 'form_interaction',
      form_type: formType,
      fields_filled: fieldsFilled
    });
  }

  /**
   * Track gender selected
   */
  trackGenderSelected(gender) {
    this.sendEvent('gender_selected', {
      category: 'form_interaction',
      gender: gender
    });
  }

  // ============================================
  // SEARCH EVENTS
  // ============================================

  /**
   * Track search performed
   */
  trackSearch(query, resultsFound = 0) {
    this.sendEvent('search_performed', {
      category: 'search',
      query_length: query.length,
      results_found: resultsFound,
      has_results: resultsFound > 0
    });
  }

  /**
   * Track search result selected
   */
  trackSearchResultSelected(resultIndex = 0) {
    this.sendEvent('search_result_selected', {
      category: 'search',
      result_index: resultIndex
    });
  }

  // ============================================
  // ERROR EVENTS
  // ============================================

  /**
   * Track error occurred
   */
  trackError(errorType, errorMessage, context = {}) {
    this.sendEvent('error_occurred', {
      category: 'error',
      error_type: errorType,
      error_message: errorMessage,
      ...context
    });
  }

  // ============================================
  // USER SESSION EVENTS
  // ============================================

  /**
   * Track session started
   */
  trackSessionStarted() {
    this.sendEvent('session_started', {
      category: 'session',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Track session ended
   */
  trackSessionEnded(duration) {
    this.sendEvent('session_ended', {
      category: 'session',
      duration_seconds: duration
    });
  }

  // ============================================
  // TABLE VIEW EVENTS
  // ============================================

  /**
   * Track table view opened
   */
  trackTableViewOpened(rowCount = 0) {
    this.sendEvent('table_view_opened', {
      category: 'view',
      row_count: rowCount
    });
  }

  /**
   * Track table view closed
   */
  trackTableViewClosed() {
    this.sendEvent('table_view_closed', {
      category: 'view'
    });
  }

  /**
   * Track table sorted
   */
  trackTableSorted(columnName, direction) {
    this.sendEvent('table_sorted', {
      category: 'view',
      column_name: columnName,
      sort_direction: direction
    });
  }

  // ============================================
  // BUTTON CLICK EVENTS
  // ============================================

  /**
   * Track generic button click
   */
  trackButtonClick(buttonName, context = {}) {
    this.sendEvent('button_clicked', {
      category: 'ui_interaction',
      button_name: buttonName,
      ...context
    });
  }
}

// Create singleton instance
const analyticsService = new AnalyticsService();

// Export singleton
export default analyticsService;

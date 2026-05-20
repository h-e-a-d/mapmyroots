# Family Tree Analytics Documentation

## Overview

This analytics system tracks user interactions and events in the MapMyRoots family tree application. All events are sent to Google Analytics 4 (GA4) using Google Tag Manager (GTM), with the `event_name` dimension for easy filtering and analysis in GA4.

## Architecture

The analytics system consists of three main components:

1. **analytics-service.js** - Core service that handles event tracking
2. **analytics-integration.js** - Integrates with the application's event bus
3. **Event emissions** - Added throughout the application codebase

## Google Analytics Setup

### Prerequisites

- Google Tag Manager (GTM) is already installed in `index.html` and `builder.html`
- GTM Container ID: `GTM-MNZ4MJB7`

### GA4 Configuration

1. **Create GA4 Property** in Google Analytics
2. **Set up GTM Tag**:
   - Tag Type: Google Analytics: GA4 Event
   - Measurement ID: Your GA4 Measurement ID (G-XXXXXXXXXX)
   - Event Name: `{{Event}}` (use built-in Event variable)
   - Event Parameters: Add custom parameters from dataLayer

3. **Configure Trigger**: Set to fire on all custom events

## Event Taxonomy

All events follow this structure:

```javascript
{
  event_name: 'event_name',           // Main event identifier
  category: 'category_name',          // Event category
  timestamp: '2025-01-15T10:30:00Z',  // ISO timestamp
  session_duration: 120,               // Seconds since session start
  event_count: 1,                      // Number of times this event fired
  // ... event-specific parameters
}
```

## Event Categories

### 1. Person Management (`category: 'person_management'`)

#### person_created
Triggered when a new person is added to the family tree.

**Parameters:**
- `person_id`: Unique identifier
- `has_name`: boolean
- `has_surname`: boolean
- `has_dob`: boolean
- `has_father_name`: boolean
- `has_maiden_name`: boolean
- `gender`: 'male' | 'female' | 'not_specified'
- `has_mother`: boolean
- `has_father`: boolean
- `has_spouse`: boolean
- `relationship_count`: number

**Example:**
```javascript
{
  event_name: 'person_created',
  category: 'person_management',
  person_id: 'person_123',
  has_name: true,
  has_surname: true,
  gender: 'male',
  relationship_count: 2
}
```

#### person_updated
Triggered when person information is edited.

**Parameters:**
- `person_id`: Unique identifier
- `fields_changed`: number of fields modified
- `changed_fields`: comma-separated list of field names

#### person_deleted
Triggered when a person is removed from the tree.

**Parameters:**
- `person_id`: Unique identifier
- `had_relationships`: boolean

---

### 2. Relationship Management (`category: 'relationship_management'`)

#### relationship_created
Triggered when a family connection is established.

**Parameters:**
- `relationship_type`: 'mother' | 'father' | 'child' | 'spouse' | 'line-only'
- `from_node_id`: Source person ID
- `to_node_id`: Target person ID

**Example:**
```javascript
{
  event_name: 'relationship_created',
  category: 'relationship_management',
  relationship_type: 'father',
  from_node_id: 'person_1',
  to_node_id: 'person_2'
}
```

#### relationship_deleted
Triggered when a family connection is removed.

**Parameters:**
- `relationship_type`: Connection type
- `from_node_id`: Source person ID
- `to_node_id`: Target person ID

---

### 3. Tree Management (`category: 'tree_management'`)

#### tree_exported
Triggered when the family tree is successfully exported.

**Parameters:**
- `export_format`: 'svg' | 'png' | 'png-transparent' | 'jpeg' | 'pdf' | 'gedcom'
- `node_count`: Number of people in tree
- `success`: true

**Example:**
```javascript
{
  event_name: 'tree_exported',
  category: 'tree_management',
  export_format: 'pdf',
  node_count: 25,
  success: true
}
```

#### tree_export_failed
Triggered when export fails.

**Parameters:**
- `export_format`: Format attempted
- `node_count`: Number of people
- `success`: false
- `error_message`: Error description

#### tree_imported
Triggered when tree data is loaded from file.

**Parameters:**
- `import_format`: 'json'
- `node_count`: Number of people imported
- `success`: boolean

#### tree_cleared
Triggered when all tree data is deleted.

**Parameters:**
- `nodes_cleared`: Number of people removed

#### tree_loaded
Triggered when tree is loaded from cache or file.

**Parameters:**
- `node_count`: Number of people loaded
- `source`: 'cache' | 'file'

#### tree_saved
Triggered when tree is saved.

**Parameters:**
- `node_count`: Number of people
- `save_type`: 'auto' | 'manual'

---

### 4. Canvas Interaction (`category: 'canvas_interaction'`)

#### node_selected
Triggered when a person node is clicked/selected.

**Parameters:**
- `node_id`: Person identifier
- `is_multi_select`: boolean (Ctrl+click)
- `total_selected`: Number of nodes currently selected

#### node_deselected
Triggered when a node is deselected.

**Parameters:**
- `node_id`: Person identifier

#### node_dragged
Triggered when a person node is repositioned.

**Parameters:**
- `node_id`: Person identifier
- `distance`: Pixels moved (rounded)

#### camera_zoomed
Triggered when zoom level changes.

**Parameters:**
- `zoom_level`: Current zoom (e.g., "1.50")
- `direction`: 'in' | 'out'

#### camera_panned
Triggered when the canvas view is moved.

**Parameters:**
- `distance`: Total distance panned (pixels)
- `delta_x`: Horizontal movement
- `delta_y`: Vertical movement

#### node_double_clicked
Triggered when a node is double-clicked to edit.

**Parameters:**
- `node_id`: Person identifier

---

### 5. Styling (`category: 'styling'`)

#### node_styled
Triggered when node appearance is customized.

**Parameters:**
- `nodes_affected`: Number of nodes styled
- `style_properties`: Comma-separated list (e.g., "color,size")
- `has_color_change`: boolean
- `has_size_change`: boolean

#### node_brought_to_front
Triggered when Z-index is adjusted.

**Parameters:**
- `nodes_affected`: Number of nodes

#### display_preference_changed
Triggered when display settings are modified.

**Parameters:**
- `setting_name`: Setting identifier
- `setting_value`: New value (string)

#### theme_changed
Triggered when color theme changes.

**Parameters:**
- `theme`: 'light' | 'dark'

---

### 6. Actions (`category: 'actions'`)

#### undo_triggered
Triggered when undo button is clicked.

**Parameters:**
- `action_type`: Type of action being undone

#### redo_triggered
Triggered when redo button is clicked.

**Parameters:**
- `action_type`: Type of action being redone

---

### 7. UI Interaction (`category: 'ui_interaction'`)

#### modal_opened
Triggered when a modal dialog opens.

**Parameters:**
- `modal_type`: 'add_person' | 'edit_person' | 'connect' | 'style' | 'settings'

#### modal_closed
Triggered when a modal dialog closes.

**Parameters:**
- `modal_type`: Modal identifier
- `close_action`: 'saved' | 'cancelled' | 'dismissed'

#### button_clicked
Triggered for generic button interactions.

**Parameters:**
- `button_name`: Button identifier

---

### 8. Form Interaction (`category: 'form_interaction'`)

#### form_field_changed
Triggered when form input value changes.

**Parameters:**
- `field_name`: Input field name
- `has_value`: boolean

#### form_validation_failed
Triggered when form validation error occurs.

**Parameters:**
- `field_name`: Field with error
- `error_type`: Error description

#### form_submitted
Triggered when form is saved.

**Parameters:**
- `form_type`: Form identifier
- `fields_filled`: Number of completed fields

#### gender_selected
Triggered when gender radio button is selected.

**Parameters:**
- `gender`: 'male' | 'female'

---

### 9. Search (`category: 'search'`)

#### search_performed
Triggered when user searches for family members.

**Parameters:**
- `query_length`: Length of search query
- `results_found`: Number of matches
- `has_results`: boolean

#### search_result_selected
Triggered when search result is clicked.

**Parameters:**
- `result_index`: Position in results (0-indexed)

---

### 10. View (`category: 'view'`)

#### table_view_opened
Triggered when table view is activated.

**Parameters:**
- `row_count`: Number of people displayed

#### table_view_closed
Triggered when returning to canvas view.

#### table_sorted
Triggered when table column is sorted.

**Parameters:**
- `column_name`: Column being sorted
- `sort_direction`: 'asc' | 'desc'

---

### 11. Error (`category: 'error'`)

#### error_occurred
Triggered when application error happens.

**Parameters:**
- `error_type`: Error category
- `error_message`: Error description

---

### 12. Media — Photos (`category: 'media_upload'` / `'media_management'`)

#### photo_uploaded
Triggered when an avatar photo is successfully uploaded.

**Parameters:**
- `source`: `'picker'` | `'drop'`
- `file_size_kb`: number (rounded)
- `mime_type`: string
- `width`: number
- `height`: number
- `was_replacement`: boolean (true if a photo was already set)

#### photo_upload_failed
Triggered when an avatar photo upload fails.

**Parameters:**
- `error_type`: `'decode_failed'` | `'invalid_type'` | `'too_large'` | `'storage_unavailable'` | `'unknown'`
- `mime_type`: string
- `file_size_kb`: number
- `success`: false

#### photo_removed
Triggered when the user removes the avatar photo.

#### photo_crop_adjusted
Triggered when the user adjusts the cropper.

**Parameters:**
- `action`: `'zoom'` | `'reset'` (zoom emits at most once per 400ms)

---

### 13. Media — Documents (`category: 'media_upload'` / `'media_management'`)

#### document_uploaded
Triggered when a document (image or PDF) is successfully uploaded.

**Parameters:**
- `kind`: `'image'` | `'pdf'`
- `source`: `'picker'` | `'drop'`
- `file_size_kb`: number
- `mime_type`: string
- `doc_count_after`: number

#### document_upload_failed
**Parameters:**
- `error_type`: `'pdf_invalid'` | `'pdf_too_large'` | `'limit_reached'` | `'image_decode'` | `'too_large'` | `'invalid_type'` | `'unknown'`
- `kind`: `'image'` | `'pdf'` | null
- `file_size_kb`: number
- `mime_type`: string
- `success`: false

#### document_removed
**Parameters:**
- `kind`: `'image'` | `'pdf'`

#### document_metadata_saved
Triggered when the user saves a document's title/place/date metadata.

**Parameters:**
- `kind`: `'image'` | `'pdf'`
- `has_title`: boolean
- `has_place`: boolean
- `has_event_date`: boolean

#### document_viewer_opened
Triggered when the document lightbox opens.

**Parameters:**
- `kind`: `'image'` | `'pdf'`
- `doc_count`: number — total docs in the lightbox queue

#### document_viewer_navigated
Triggered when the user clicks prev/next or uses arrow keys in the lightbox.

**Parameters:**
- `direction`: `'prev'` | `'next'`

---

### 14. Storage (`category: 'storage'`)

#### storage_warning_shown
Triggered when the "Storage almost full" notification fires after an upload.

**Parameters:**
- `usage_mb`: number
- `quota_mb`: number
- `percent_used`: number

---

### 15. Share (`category: 'share'`)

#### share_url_generated
Triggered when a shareable URL is created successfully.

**Parameters:**
- `url_bytes`: number
- `node_count`: number

#### share_url_too_large
Triggered when the encoded tree exceeds `MAX_URL_BYTES` and cannot be shared as a URL.

**Parameters:**
- `url_bytes`: number
- `node_count`: number
- `success`: false

#### share_url_copied
Triggered when the share URL is copied to the clipboard.

---

### 16. Marriages (`category: 'relationship_management'`)

#### marriage_added
Triggered when the user clicks "add another marriage" in the person modal. The initial seed row on modal open is intentionally **not** tracked.

#### marriage_removed
Triggered when the user removes a marriage row.

---

### 17. PWA Install (`category: 'pwa'`)

#### pwa_install_prompt_shown
Triggered when the install banner becomes visible.

#### pwa_install_accepted
Triggered when the user accepts the browser install prompt (or `appinstalled` fires).

#### pwa_install_dismissed
**Parameters:**
- `method`: `'button'` (user clicked the dismiss button) | `'browser'` (user dismissed the native prompt)

---

### 18. View Changes (`category: 'view'`)

#### view_changed
Triggered when the main view switches (graphic / treeChart / table).

**Parameters:**
- `view`: `'graphic'` | `'treeChart'` | `'table'`
- `trigger`: `'click'` | `'keyboard'`

---

### 19. UI Disclosure (`category: 'ui_interaction'`)

#### ui_disclosure_toggled
Triggered when a collapsible disclosure (notes, place, note reveal) is opened by the user. The initial auto-reveal when data is already present is **not** tracked.

**Parameters:**
- `disclosure_name`: e.g. `'person_notes'`, `'person_birth_place'`, `'person_death_note'`
- `expanded`: boolean

---

### 20. Session (`category: 'session'`)

#### session_started
Triggered when user opens the application.

**Parameters:**
- `timestamp`: ISO timestamp

#### session_ended
Triggered when user closes/navigates away.

**Parameters:**
- `duration_seconds`: Session length

---

## Implementation Guide

### Adding New Events

1. **Define the event** in `analytics-service.js`:

```javascript
trackCustomEvent(param1, param2) {
  this.sendEvent('custom_event', {
    category: 'custom_category',
    param1,
    param2
  });
}
```

2. **Emit the event** in your code:

```javascript
import { appContext } from './utils/event-bus.js';

// Emit event
const eventBus = appContext.getEventBus();
eventBus.emit('custom:event', { param1: 'value1', param2: 'value2' });
```

3. **Add listener** in `analytics-integration.js`:

```javascript
this.listen('custom:event', (data) => {
  analyticsService.trackCustomEvent(data.param1, data.param2);
});
```

### Development Mode

In development (localhost), events are logged to console instead of being sent to GA:

```
[Analytics] person_created {event_name: "person_created", category: "person_management", ...}
```

### Debugging

**View event queue:**
```javascript
console.log(window.analyticsIntegration.getEventQueue());
```

**View event statistics:**
```javascript
console.log(window.analyticsIntegration.getStats());
```

## Google Analytics Reports

### Recommended Custom Reports

1. **User Journey Report**
   - Primary dimension: `event_name`
   - Metrics: `event_count`, `users`
   - Filter: `category = 'person_management'`

2. **Feature Usage Report**
   - Dimensions: `category`, `event_name`
   - Metrics: `event_count`, `unique_events`

3. **Export Analytics**
   - Dimension: `export_format`
   - Metrics: `event_count`
   - Filter: `event_name = 'tree_exported'`

4. **Error Tracking**
   - Dimensions: `error_type`, `error_message`
   - Filter: `category = 'error'`

### Conversion Goals

Set up goals in GA4 for key actions:
- `tree_exported` - Successful export (main conversion)
- `person_created` - User engagement
- `tree_saved` - Data persistence
- `session_duration > 300` - High engagement

## Privacy & Compliance

- No personally identifiable information (PII) is tracked
- All `person_id` values are internal application IDs
- User data (names, dates) never sent to analytics
- Compliant with GDPR, CCPA

## Best Practices

1. **Event Naming**: Use lowercase with underscores
2. **Categories**: Keep consistent across similar events
3. **Parameters**: Include relevant context without PII
4. **Testing**: Always test in development mode first
5. **Documentation**: Update this README when adding events

## Troubleshooting

**Events not appearing in GA4:**
1. Check GTM container is published
2. Verify GA4 Measurement ID is correct
3. Use GTM Preview mode to debug
4. Check browser console for errors

**Development mode stuck:**
```javascript
// Force production mode
window.location.hostname = 'production-domain.com';
```

## Analytics Folder Structure

```
src/analytics/
├── analytics-service.js      # Core tracking service
├── analytics-integration.js  # Event bus integration
└── README.md                  # This documentation
```

## Support

For questions or issues with analytics:
1. Check console logs in development mode
2. Review GTM preview mode
3. Verify GA4 DebugView shows events
4. Contact development team

---

**Last Updated:** January 2025
**Version:** 1.0.0

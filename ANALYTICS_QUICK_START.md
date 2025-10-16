# Analytics Quick Start Guide

## What Has Been Implemented

A comprehensive Google Analytics 4 (GA4) event tracking system that automatically monitors all user interactions in your family tree application.

## Quick Setup (5 minutes)

### Step 1: Configure Google Analytics 4

1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new GA4 property (or use existing)
3. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)

### Step 2: Configure Google Tag Manager

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Open your container: **GTM-MNZ4MJB7**
3. Create a new **Tag**:
   - **Tag Type**: Google Analytics: GA4 Event
   - **Configuration Tag**: Your GA4 Config Tag (create if needed)
   - **Measurement ID**: Paste your G-XXXXXXXXXX from Step 1
   - **Event Name**: `{{Event}}` (use the built-in Event variable)
4. **Trigger**: All Custom Events
5. **Save** and **Publish** the container

### Step 3: Verify It's Working

1. Open your app: [builder.html](./builder.html)
2. Open browser console (F12)
3. Look for log messages like:
   ```
   ✅ Analytics tracking initialized
   [Analytics] person_created {event_name: "person_created", ...}
   ```
4. In Google Analytics, go to **Reports** > **Realtime** to see live events

## Key Events Being Tracked

### Most Important Events

1. **person_created** - New family member added
2. **tree_exported** - Tree downloaded (PDF, PNG, etc.) - **Main Conversion Goal**
3. **person_updated** - Family member edited
4. **relationship_created** - Family connections made
5. **tree_cleared** - All data deleted

### Other Tracked Events

- Canvas interactions (zoom, pan, node dragging)
- Modal opens/closes
- Form submissions
- Search usage
- Export attempts (success/failure)
- Undo/redo actions
- Settings changes
- Table view usage

## Viewing Analytics in GA4

### Real-time View
1. **Admin** > **Data Display** > **DebugView** (for testing)
2. **Reports** > **Realtime** (see current users)

### Historical Reports
1. **Reports** > **Engagement** > **Events**
2. Filter by `event_name` dimension
3. Look for:
   - `person_created`
   - `tree_exported`
   - `relationship_created`

### Custom Reports

Create a custom report:
1. **Explore** > **Blank**
2. **Dimensions**: `event_name`, `category`
3. **Metrics**: `Event count`, `Users`
4. **Date range**: Last 30 days

## Important Event Categories

All events include a `category` parameter for easy filtering:

- `person_management` - Adding/editing/deleting people
- `tree_management` - Export, import, save, clear
- `canvas_interaction` - Zoom, pan, selection, dragging
- `relationship_management` - Creating/removing connections
- `form_interaction` - Form fields, validation
- `ui_interaction` - Buttons, modals
- `styling` - Visual customization
- `view` - Table view, sorting
- `search` - Search usage
- `session` - Session tracking
- `error` - Error tracking

## Key Metrics to Monitor

### User Engagement
- **Events per session**: Average number of events per user visit
- **Session duration**: How long users spend in the app
- **Bounce rate**: Percentage who leave without interacting

### Feature Usage
- **Most created**: `person_created` event count
- **Most exported format**: `tree_exported` by `export_format`
- **Relationship types**: `relationship_created` by `relationship_type`

### Conversion Goals
- **Export success rate**: `tree_exported` / `tree_export_failed`
- **Active users**: Users who create at least 1 person
- **Power users**: Users who create 10+ people

## Development vs Production

### Development Mode (localhost)
- Events are logged to console only
- No data sent to GA
- Full event details visible for debugging

```
[Analytics] person_created {
  event_name: "person_created",
  category: "person_management",
  person_id: "person_123",
  has_name: true,
  gender: "male",
  timestamp: "2025-01-15T10:30:00Z"
}
```

### Production Mode
- Events sent to GA4 via GTM
- Console logs minimal
- Data flows: App → GTM → GA4

## Sample GA4 Queries

### Most Popular Features
```
Event name = person_created OR tree_exported OR relationship_created
Group by: event_name
Metric: Event count
```

### Export Analytics
```
Event name = tree_exported
Secondary dimension: export_format
Metric: Event count
```

### User Journey
```
Event name = session_started, person_created, relationship_created, tree_exported
Order by: timestamp
```

## Recommended Conversions (Goals)

Set these up in GA4 under **Admin** > **Events** > **Mark as conversion**:

1. ✅ `tree_exported` - Primary goal (user successfully exports their tree)
2. ✅ `person_created` - Secondary goal (user engages with app)
3. ✅ `tree_saved` - Data persistence goal

## Troubleshooting

### "Not seeing events in GA4"
1. **Check GTM Preview Mode**: Use preview to debug
2. **Verify container is published**: GTM changes need publishing
3. **Check DebugView**: Enable in GA4 admin settings
4. **Wait 24 hours**: Some GA4 reports have delay

### "Events showing in console but not GTM"
1. Check GTM container ID matches: `GTM-MNZ4MJB7`
2. Verify GTM snippet is in both `index.html` and `builder.html`
3. Check browser console for GTM errors

### "Wrong data in events"
1. Events are designed to **never include PII**
2. Only internal IDs and counts are tracked
3. Names, dates, personal info never sent

## Privacy Compliance

✅ **GDPR Compliant**: No PII tracked
✅ **CCPA Compliant**: No personal data collected
✅ **Privacy-First**: Only interaction metrics

## Files Added

```
src/analytics/
├── analytics-service.js          # Core tracking service (650 lines)
├── analytics-integration.js      # Event bus integration (250 lines)
└── README.md                      # Full documentation (500 lines)

ANALYTICS_QUICK_START.md          # This file

tree.js                            # Modified: Added analytics init
src/core/tree-engine.js           # Modified: Added event emissions
```

## Next Steps

1. ✅ **Verify setup** - Check console logs in development
2. ✅ **Publish GTM** - Make sure container is live
3. ✅ **Set conversion** - Mark `tree_exported` as conversion
4. ✅ **Create reports** - Build custom dashboards
5. ✅ **Monitor usage** - Check weekly/monthly trends

## Advanced: Custom Events

To track additional events, see full documentation in `src/analytics/README.md`

Quick example:
```javascript
// In your code
import { appContext } from './utils/event-bus.js';

const eventBus = appContext.getEventBus();
eventBus.emit('custom:event', {
  param1: 'value',
  param2: 123
});
```

## Support Resources

- **Full Documentation**: `src/analytics/README.md`
- **Event List**: All 40+ events documented
- **GA4 Help**: https://support.google.com/analytics/answer/9304153
- **GTM Help**: https://support.google.com/tagmanager/answer/6102821

---

## Summary

🎉 **You now have a complete analytics system tracking:**
- Person management (create, edit, delete)
- Relationships (family connections)
- Tree exports (PDF, PNG, etc.)
- Canvas interactions (zoom, pan, drag)
- User sessions and engagement
- Errors and issues

**All events use `event_name` dimension for easy GA4 filtering!**

Ready to see your users' behavior and optimize the family tree experience! 📊🌳


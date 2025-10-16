# Analytics Troubleshooting Guide

## Issue: Events Not Showing in GA4 Realtime

### Step 1: Check if Analytics is Working in Your App

1. Open your app: `builder.html`
2. Open browser console (F12)
3. Look for these messages:
   ```
   ✅ Analytics tracking initialized
   💡 Debug: Run analyticsDebug.runAll() in console
   📊 Analytics debug helper loaded. Run: analyticsDebug.runAll()
   ```

4. **Run the debug check:**
   ```javascript
   analyticsDebug.runAll()
   ```

   You should see output like:
   ```
   === GTM Status Check ===
   GTM loaded: true
   dataLayer exists: true
   dataLayer length: 5
   ```

### Step 2: Test Event Sending

In the browser console, run:

```javascript
// Monitor all dataLayer events
analyticsDebug.monitor()

// Send a test event
analyticsDebug.sendTest()
```

You should see:
```
📊 dataLayer.push: [{event: "test_event", event_name: "test_event", ...}]
✅ Test event pushed to dataLayer
```

### Step 3: Test Real User Actions

1. **Click "Add Person" button** (the + button)
2. **Fill the form and save**
3. Check console - you should see:
   ```
   [Analytics] person_created {event: "person_created", event_name: "person_created", ...}
   ```

### Step 4: Check GTM Container

1. Go to [Google Tag Manager](https://tagmanager.google.com/)
2. Open container **GTM-MNZ4MJB7**
3. Click **Preview** button (top right)
4. Enter your site URL: `http://localhost:xxxx/builder.html`
5. Click **Connect**

This opens GTM Preview Mode where you can see:
- Which tags are firing
- What data is in the dataLayer
- Any errors or issues

### Step 5: Verify GTM Tag Configuration

In GTM, check your GA4 tag:

**Tag Configuration:**
- Tag Type: `Google Analytics: GA4 Event`
- Measurement ID: `G-XXXXXXXXXX` (your GA4 ID)
- Event Name: `{{Event}}` (must use the Event variable)

**Trigger:**
- Trigger Type: `Custom Event`
- Event name: `.+` (regex for all events) OR leave blank for all custom events
- This trigger fires on: `All Custom Events`

**Important:** The tag must be **published** (not just saved)!

### Step 6: Check GA4 Configuration

1. Go to [Google Analytics](https://analytics.google.com/)
2. Navigate to: **Admin** > **Data Streams** > Select your web stream
3. **Copy the Measurement ID** (format: G-XXXXXXXXXX)
4. Make sure this ID is in your GTM tag

### Step 7: Enable GA4 DebugView

1. In GA4, go to: **Configure** > **DebugView**
2. Install the [Google Analytics Debugger Chrome Extension](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna)
3. Enable the extension
4. Reload your app
5. Check DebugView in GA4 - events should appear here first (before Realtime)

## Common Issues & Solutions

### Issue: "dataLayer not found"

**Solution:**
- GTM snippet is not loaded
- Check that GTM code is in `builder.html` (already installed: GTM-MNZ4MJB7)
- Make sure you're testing on the actual page, not a direct HTML file

### Issue: "Events in console but not in GA4"

**Solution:**
1. **Check you're not on localhost in production mode**
   - Localhost events are logged only, not sent
   - Deploy to a real domain to test production mode

2. **Verify GTM tag is published**
   - In GTM, click "Submit" after making changes
   - Add version name and description
   - Click "Publish"

3. **Check GTM Preview Mode**
   - See which tags are firing
   - Check if GA4 tag fires on your events

### Issue: "GTM loaded: false"

**Solution:**
- GTM script blocked by ad blocker
- Check browser console for errors
- Verify GTM container ID: GTM-MNZ4MJB7

### Issue: "No Measurement ID in GTM"

**Solution:**
1. Get GA4 Measurement ID from Google Analytics
2. In GTM, create or edit GA4 Configuration tag
3. Add Measurement ID
4. Save and publish

### Issue: "Events delayed in GA4"

**Solution:**
- Realtime reports can have 1-5 minute delay
- Use DebugView for instant feedback
- Standard reports have 24-48 hour delay

## Testing Checklist

- [ ] Console shows "✅ Analytics tracking initialized"
- [ ] Run `analyticsDebug.runAll()` - all checks pass
- [ ] Run `analyticsDebug.sendTest()` - event appears in dataLayer
- [ ] Add a person - console shows `person_created` event
- [ ] GTM Preview Mode shows events firing
- [ ] GA4 DebugView shows events (with debugger extension)
- [ ] GA4 Realtime shows events (may take 1-5 minutes)

## Debug Commands Reference

```javascript
// Check status
analyticsDebug.runAll()

// Check GTM specifically
analyticsDebug.checkGTM()

// Monitor all events
analyticsDebug.monitor()

// Send test event
analyticsDebug.sendTest()

// Get analytics stats
analyticsDebug.getStats()

// View event queue
window.analyticsService.getEventQueue()

// View event counts
window.analyticsService.getEventStats()

// Manually send an event
window.analyticsService.sendEvent('test_manual', {
  category: 'test',
  test_param: 'value'
})
```

## Force Production Mode (Testing)

If you want to test production mode on localhost:

```javascript
// In browser console BEFORE page loads
Object.defineProperty(window.location, 'hostname', {
  writable: true,
  value: 'production.com'
});
```

Then reload the page. Events will now be sent to dataLayer.

## GTM Tag Template

Here's the exact configuration for your GTM tag:

**Tag Name:** GA4 - All Events

**Tag Type:** Google Analytics: GA4 Event

**Configuration Tag:** GA4 Configuration (create if needed)
- Measurement ID: `G-XXXXXXXXXX`

**Event Parameters:**
- Parameter Name: `event_name` | Value: `{{event_name}}`
- Parameter Name: `category` | Value: `{{category}}`

**Triggering:**
- Trigger: All Custom Events

**Variables to Create (if needed):**
1. **Event** (built-in, should already exist)
2. **event_name** (Data Layer Variable)
   - Variable Type: Data Layer Variable
   - Data Layer Variable Name: `event_name`
3. **category** (Data Layer Variable)
   - Variable Type: Data Layer Variable
   - Data Layer Variable Name: `category`

## Still Not Working?

### Option 1: Manual Test
```javascript
// Directly push to dataLayer
window.dataLayer.push({
  event: 'manual_test',
  event_name: 'manual_test',
  category: 'debug',
  test: true
});
```

Check if this appears in:
1. GTM Preview Mode
2. GA4 DebugView
3. GA4 Realtime

### Option 2: Check Network Tab

1. Open DevTools > Network tab
2. Filter by "google-analytics" or "gtm"
3. Perform an action (add person)
4. Look for network requests to:
   - `www.google-analytics.com/g/collect`
   - `www.googletagmanager.com/gtm.js`

### Option 3: Use GA4 Measurement Protocol

If nothing works, we can send events directly to GA4:

```javascript
// Direct GA4 API call (requires API Secret)
fetch(`https://www.google-analytics.com/mp/collect?measurement_id=G-XXXXXXXXXX&api_secret=YOUR_SECRET`, {
  method: 'POST',
  body: JSON.stringify({
    client_id: 'test_client',
    events: [{
      name: 'test_event',
      params: {
        test: true
      }
    }]
  })
});
```

## Expected Flow

```
User Action (e.g., Add Person)
    ↓
TreeEngine emits event to EventBus
    ↓
AnalyticsIntegration listens to event
    ↓
AnalyticsService.trackPersonCreated()
    ↓
AnalyticsService.sendEvent()
    ↓
window.dataLayer.push({event: 'person_created', ...})
    ↓
GTM detects custom event
    ↓
GTM fires GA4 tag
    ↓
Event sent to GA4
    ↓
Appears in DebugView (instant)
    ↓
Appears in Realtime (1-5 min delay)
    ↓
Appears in Reports (24-48 hour delay)
```

## Contact Support

If you've tried everything:

1. **GTM Support:** [GTM Community](https://support.google.com/tagmanager/community)
2. **GA4 Support:** [GA4 Help Center](https://support.google.com/analytics/answer/9304153)
3. **Share Debug Output:**
   ```javascript
   // Copy this output and share
   console.log('Debug Info:', {
     gtm: analyticsDebug.checkGTM(),
     stats: analyticsDebug.getStats(),
     queue: window.analyticsService.getEventQueue()
   });
   ```

---

## Quick Fix Checklist

Most common issues:

1. ✅ GTM container is published (not just saved)
2. ✅ GA4 Measurement ID is correct in GTM
3. ✅ GTM tag triggers on "All Custom Events"
4. ✅ Testing on a real server (not file://)
5. ✅ Not blocked by ad blocker
6. ✅ Checked GTM Preview Mode
7. ✅ Enabled GA4 DebugView
8. ✅ Waited 1-5 minutes for Realtime

If all above are true, events WILL show up! 🎉

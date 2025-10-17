# GTM Custom Events Debugging Guide

## Problem
Custom Events tag in GTM is not firing even though events are being pushed to dataLayer.

## Root Cause Analysis

### Your Current Implementation
Your code correctly pushes events to dataLayer:
```javascript
window.dataLayer.push({
  event: 'test_event',
  event_name: 'test_event',
  category: 'test',
  timestamp: new Date().toISOString()
});
```

## Solution Steps

### 1. Check GTM Tag Configuration

Go to Google Tag Manager → Tags → Your Custom Events Tag

**Current Setup Should Be:**
- **Tag Type**: Google Analytics: GA4 Event
- **Configuration Tag**: [Your GA4 Configuration Tag]
- **Event Name**: `{{Event}}` (this is a built-in variable)
- **Event Parameters**: (optional, add custom parameters if needed)

**Trigger Configuration:**
- **Trigger Type**: Custom Event
- **Event name**: `.*` (regex to match all events) OR specific event names like `^(cta_click|demo_click|person_created|tree_exported)$`
- **This trigger fires on**: All Custom Events

### 2. Fix Event Name Variable

The issue might be that GTM is not recognizing your events. You need to:

#### Option A: Use "All Custom Events" Trigger (RECOMMENDED)
1. In GTM, go to **Triggers**
2. Click **New**
3. Name it "All Custom Events"
4. Choose **Custom Event** as trigger type
5. Set Event name to: `.*` (regex for all events)
6. Check "Use regex matching"
7. Save

#### Option B: Create a Custom JavaScript Variable for Event Name
1. Go to **Variables** → **New**
2. Name it "Custom Event Name"
3. Variable Type: **Data Layer Variable**
4. Data Layer Variable Name: `event`
5. Save

Then in your GA4 Event tag:
- Event Name: `{{Custom Event Name}}`

### 3. Verify Trigger Setup

Your GA4 Event tag should trigger on:
- **All Custom Events** trigger (from Option A above)

OR if using specific events:
- Trigger Type: Custom Event
- Event name matches regex: `^(cta_click|demo_click|feature_click|person_created|tree_exported|form_submit)$`

### 4. Debug Using GTM Preview Mode

1. Open GTM in your browser
2. Click **Preview** button (top right)
3. Enter your website URL: `http://localhost:8080` or your production URL
4. Click **Connect**
5. In Preview mode, look for:
   - "Tags Fired" section - your GA4 Event tag should appear here when events fire
   - "Data Layer" tab - you should see your events being pushed
   - If tag is in "Tags Not Fired", click it to see why (usually trigger issue)

### 5. Common Issues & Fixes

#### Issue 1: Tag Not Firing
**Symptom**: Events appear in dataLayer but tag doesn't fire
**Fix**:
- Check that your trigger matches the event name exactly
- Use regex `.*` to match all events
- Ensure "Use regex matching" is checked if using wildcards

#### Issue 2: Wrong Event Name in GA4
**Symptom**: Events show in GTM but not in GA4, or show as "undefined"
**Fix**:
- In GA4 tag, set Event Name to `{{Event}}` (built-in variable)
- OR create custom variable pointing to `event` in dataLayer

#### Issue 3: Parameters Not Passing
**Symptom**: Event fires but custom parameters don't show
**Fix**:
- Add Event Parameters in GA4 tag:
  - Parameter Name: `event_name`
  - Value: `{{Custom - Event Name}}`
  - Parameter Name: `category`
  - Value: `{{dlv - category}}`
  (Create Data Layer Variables for each parameter)

### 6. Testing Your Implementation

Use the test-analytics.html page:

```bash
# Open in browser
open test-analytics.html

# Or serve with a local server
python3 -m http.server 8080
# Then visit: http://localhost:8080/test-analytics.html
```

**Test Checklist:**
1. ✅ GTM container loads (check Network tab for gtm.js)
2. ✅ dataLayer exists (console: `window.dataLayer`)
3. ✅ Events push to dataLayer (console: `window.dataLayer`)
4. ✅ GTM Preview shows events
5. ✅ Tags fire in GTM Preview
6. ✅ Events appear in GA4 DebugView (if GA4 is configured)

### 7. Correct GTM Setup Summary

**Tag: GA4 - Custom Events**
- Tag Type: Google Analytics: GA4 Event
- Configuration Tag: {{Your GA4 Config}}
- Event Name: `{{Event}}`
- Event Parameters: (add these)
  - `event_category`: `{{dlv - category}}`
  - `event_label`: `{{dlv - label}}`
  - `page_url`: `{{Page URL}}`

**Trigger: All Custom Events**
- Trigger Type: Custom Event
- Event name: `.*`
- Use regex matching: ✅ Checked
- This trigger fires on: All Custom Events

**Variables Needed:**
- `{{Event}}` - Built-in Variable (enable in Variables → Built-in Variables)
- `{{dlv - category}}` - Data Layer Variable pointing to `category`
- `{{dlv - event_name}}` - Data Layer Variable pointing to `event_name`

### 8. Verify in GA4

After fixing GTM:

1. Go to GA4 → **DebugView** (Admin → DebugView)
2. Open your site in a new tab
3. Click buttons/perform actions
4. Events should appear in DebugView within seconds
5. Check **Realtime** → **Events** to see live events

### 9. Quick Fix Script

If you want to test without GTM, add this to your page temporarily:

```html
<script>
// Test if events are pushing correctly
window.dataLayer = window.dataLayer || [];
window.dataLayer.push = function() {
  console.log('📊 Event pushed to dataLayer:', arguments[0]);
  Array.prototype.push.apply(window.dataLayer, arguments);
};
</script>
```

### 10. Expected Output

When working correctly, you should see in console:
```
📊 Event pushed to dataLayer: {event: "cta_click", button_text: "Start Building Free", location: "hero", ...}
```

And in GTM Preview:
```
✅ Tags Fired
   - GA4 - Custom Events

📋 Data Layer
   event: "cta_click"
   button_text: "Start Building Free"
   location: "hero"
```

## Need More Help?

Run these commands in browser console:
```javascript
// Check if GTM loaded
console.log('GTM loaded:', typeof window.google_tag_manager !== 'undefined');

// Check dataLayer
console.log('dataLayer:', window.dataLayer);

// Test event push
window.dataLayer.push({
  event: 'test_event',
  test_param: 'hello'
});
console.log('Test event pushed, check GTM Preview');
```

## Resources

- [GTM Custom Event Trigger](https://support.google.com/tagmanager/answer/7679316)
- [GA4 Event Tag Setup](https://support.google.com/tagmanager/answer/9442095)
- [GTM Preview Mode Guide](https://support.google.com/tagmanager/answer/6107056)

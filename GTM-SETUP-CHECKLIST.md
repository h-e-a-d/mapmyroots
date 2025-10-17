# GTM Setup Checklist - Quick Fix Guide

## The Problem
Your Custom Events tag in GTM is not firing, even though events are being pushed to dataLayer correctly.

## The Solution (5 Steps)

### Step 1: Enable Built-in Variables ✅
1. Open GTM → **Variables** (left sidebar)
2. Click **Configure** in the "Built-in Variables" section
3. Make sure these are checked:
   - ✅ Event
   - ✅ Page URL
   - ✅ Page Hostname
   - ✅ Page Path

### Step 2: Create the Trigger ✅
1. Go to **Triggers** → Click **New**
2. Click the pencil icon to configure
3. Choose **Custom Event** as trigger type
4. Configure:
   ```
   Trigger Configuration:
   ├─ Trigger Type: Custom Event
   ├─ Event name: .*
   ├─ ☑️ Use regex matching
   └─ This trigger fires on: All Custom Events
   ```
5. Name it: **"All Custom Events"**
6. Click **Save**

### Step 3: Create/Edit Your GA4 Event Tag ✅
1. Go to **Tags** → Find your tag or click **New**
2. Click the tag configuration area
3. Choose: **Google Analytics: GA4 Event**
4. Configure:
   ```
   Tag Configuration:
   ├─ Tag Type: Google Analytics: GA4 Event
   ├─ Configuration Tag: [Select your GA4 Configuration Tag]
   ├─ Event Name: {{Event}}  ← Use the built-in variable!
   └─ Event Parameters (Optional but recommended):
       ├─ Parameter: event_category → Value: {{DLV - category}}
       ├─ Parameter: event_name → Value: {{DLV - event_name}}
       ├─ Parameter: timestamp → Value: {{DLV - timestamp}}
       └─ Parameter: locale → Value: {{DLV - locale}}
   ```
5. Name it: **"GA4 - Custom Events"**
6. Click **Save**

### Step 4: Attach the Trigger to Your Tag ✅
1. Still in your tag (from Step 3)
2. Scroll down to **Triggering** section
3. Click the triggering area
4. Select: **"All Custom Events"** (the trigger you created in Step 2)
5. Click **Add**
6. Click **Save**

### Step 5: Test with Preview Mode ✅
1. Click **Preview** button (top right in GTM)
2. Enter URL: `http://localhost:8080/test-analytics.html` (or your site URL)
3. Click **Connect**
4. In the new tab with your site:
   - Open browser console (F12)
   - Click any button on the test page
   - Go back to GTM Preview tab
   - You should see:
     ```
     ✅ Tags Fired
        └─ GA4 - Custom Events

     📊 Data Layer
        └─ event: "test_event" (or whatever event you triggered)
     ```

## Visual Diagram

```
Your Website Code
       │
       │ window.dataLayer.push({
       │   event: 'cta_click',
       │   button_text: '...'
       │ });
       ▼
   dataLayer
       │
       │ Event: 'cta_click'
       ▼
   GTM Trigger: "All Custom Events"
       │ (Event name matches: .*)
       │
       │ ✅ Trigger fires!
       ▼
   GTM Tag: "GA4 - Custom Events"
       │ Event Name: {{Event}}
       │
       │ Sends to GA4
       ▼
   Google Analytics 4
       │
       └─ DebugView / Realtime / Reports
```

## Quick Test Script

Paste this in browser console (F12) on your site:

```javascript
// Test 1: Check if GTM is loaded
console.log('GTM loaded:', typeof window.google_tag_manager !== 'undefined' ? '✅ Yes' : '❌ No');

// Test 2: Check if dataLayer exists
console.log('dataLayer exists:', Array.isArray(window.dataLayer) ? '✅ Yes' : '❌ No');

// Test 3: Send a test event
window.dataLayer.push({
  event: 'test_event_from_console',
  test_parameter: 'hello_world',
  timestamp: new Date().toISOString()
});
console.log('✅ Test event sent! Check GTM Preview mode.');

// Test 4: Show recent dataLayer events
console.log('Recent events:', window.dataLayer.slice(-3));
```

## Common Mistakes & Fixes

### ❌ Mistake 1: Event Name Not Set
**Problem**: Event Name field is empty or set to a fixed string
**Fix**: Set Event Name to `{{Event}}` (use the variable, not hardcoded text)

### ❌ Mistake 2: Wrong Trigger Type
**Problem**: Using "All Pages" or "Page View" trigger
**Fix**: Use **Custom Event** trigger with regex `.*`

### ❌ Mistake 3: Regex Not Enabled
**Problem**: Regex matching not checked
**Fix**: Check the "Use regex matching" checkbox

### ❌ Mistake 4: GA4 Config Tag Not Set
**Problem**: Configuration Tag field is empty
**Fix**: Select your GA4 Configuration tag (the one with your Measurement ID)

### ❌ Mistake 5: Trigger Not Attached
**Problem**: Tag has no trigger or wrong trigger
**Fix**: Add the "All Custom Events" trigger to your tag

## What You Should See

### ✅ In GTM Preview Mode:
```
Summary:
├─ Tags Fired: 1
│  └─ GA4 - Custom Events
├─ Tags Not Fired: 0
└─ Data Layer:
   ├─ event: "test_event"
   ├─ category: "test"
   └─ timestamp: "2024-01-..."
```

### ✅ In Browser Console:
```
📊 Event pushed to dataLayer: {event: "test_event", category: "test", ...}
```

### ✅ In GA4 DebugView (if configured):
```
test_event
├─ event_category: test
├─ event_name: test_event
└─ timestamp: 2024-01-...
```

## Still Not Working?

### Checklist:
- [ ] GTM container ID is correct (GTM-MNZ4MJB7)
- [ ] GTM Preview mode is connected to your site
- [ ] Built-in variable {{Event}} is enabled
- [ ] Trigger type is "Custom Event" (not "All Pages")
- [ ] Trigger has regex `.*` with "Use regex matching" checked
- [ ] Tag is type "GA4 Event" (not "GA4 Configuration")
- [ ] Event Name field is set to `{{Event}}`
- [ ] Trigger is attached to the tag
- [ ] GA4 Configuration Tag is selected

### Debug Steps:
1. Open GTM Preview
2. Open Browser Console (F12)
3. Run: `window.dataLayer.push({event: 'debug_test', test: true})`
4. Check if tag fires in GTM Preview
5. If not, click tag in "Tags Not Fired" to see why

## Next Steps After Fixing

Once you confirm the tag is firing:

1. **Submit your GTM changes**:
   - Click **Submit** (top right)
   - Add a version name: "Fixed Custom Events Tag"
   - Click **Publish**

2. **Test on live site**:
   - Visit your live site
   - Open GA4 → DebugView
   - Perform actions
   - Verify events appear in GA4

3. **Monitor in GA4**:
   - Go to **Realtime** → **Events**
   - You should see your custom events appearing
   - Wait 24-48 hours for historical reports

## Need More Help?

Share the following in your GTM workspace:
1. Screenshot of your Tag configuration
2. Screenshot of your Trigger configuration
3. Screenshot of GTM Preview mode when you fire an event
4. Console output from the test script above

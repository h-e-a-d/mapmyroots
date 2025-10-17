# Step-by-Step: Create "All Custom Events" Trigger in GTM

## Why You Need This
GTM doesn't have a built-in "All Custom Events" trigger. You must create it yourself to capture all events pushed to dataLayer.

## Exact Steps (With Screenshots Guide)

### 1. Open Triggers Section
- In GTM workspace, click **"Triggers"** (left sidebar)
- Click **"New"** button (top right corner)

### 2. Name Your Trigger
- Click the pencil icon at the very top (where it says "Untitled Trigger")
- Type: `All Custom Events`
- ✅ This name is important for organization

### 3. Configure Trigger Type
- Click in the large **"Trigger Configuration"** box (center of screen)
- A panel will slide in from the right
- Scroll down and find **"Custom Event"**
- Click **"Custom Event"**

### 4. Set Event Name Pattern
You'll see this form:

```
┌─────────────────────────────────────────┐
│ Custom Event                            │
├─────────────────────────────────────────┤
│                                         │
│ Event name: [Enter event name]          │
│                                         │
│ ☐ Use regex matching                   │
│                                         │
│ This trigger fires on:                  │
│   ⦿ All Custom Events                  │
│   ○ Some Custom Events                  │
│                                         │
└─────────────────────────────────────────┘
```

**Fill it out:**
- Event name: Type `.*` (period asterisk)
- ✅ **CHECK** the box "Use regex matching" (very important!)
- Leave "This trigger fires on" set to **"All Custom Events"** (should be selected by default)

### 5. Save the Trigger
- Click **"Save"** button (top right)
- You should now see "All Custom Events" in your triggers list

## What Each Setting Means

### Event name: `.*`
- This is a regex pattern that matches **any** event name
- `.` = any character
- `*` = zero or more times
- Together: matches all possible event names

### Use regex matching: ✅ Checked
- Tells GTM to interpret `.*` as a pattern, not a literal string
- Without this, GTM would only match events literally named ".*"

### All Custom Events
- This means the trigger will check every custom event
- As opposed to "Some Custom Events" which would require additional conditions

## Now Attach It to Your Tag

### 1. Open Your GA4 Tag
- Click **"Tags"** (left sidebar)
- Find your GA4 Event tag (or create new one)
- Click on the tag name

### 2. Add the Trigger
- Scroll down to **"Triggering"** section (bottom of tag config)
- Click in the triggering area
- Find and select **"All Custom Events"** (the trigger you just created)
- Click **"Add"**

### 3. Verify Tag Configuration
Make sure your tag has:
```
Tag Configuration:
├─ Tag Type: Google Analytics: GA4 Event
├─ Configuration Tag: [Your GA4 Config Tag]
├─ Event Name: {{Event}}  ← Must be this variable!
└─ Triggering: All Custom Events  ← The trigger you created
```

### 4. Save the Tag
- Click **"Save"** (top right)

## Testing Your Trigger

### Method 1: GTM Preview Mode
1. Click **"Preview"** (top right in GTM)
2. Enter your site URL: `http://localhost:8080/test-analytics.html`
3. Click **"Connect"**
4. In your site, click "Send Test Event" button
5. Go back to GTM Preview tab
6. You should see:
   - ✅ "All Custom Events" trigger fired
   - ✅ "GA4 - Custom Events" tag fired

### Method 2: Browser Console Test
1. Open your site
2. Press F12 to open console
3. Paste this code:
```javascript
window.dataLayer.push({
  event: 'manual_test',
  test_param: 'hello',
  timestamp: new Date().toISOString()
});
console.log('Test event sent!');
```
4. Check GTM Preview to see if trigger fired

## Common Mistakes to Avoid

### ❌ Mistake 1: Forgot to check "Use regex matching"
**Result**: Trigger only fires for events literally named ".*"
**Fix**: Go back and check the box

### ❌ Mistake 2: Wrong pattern
**Examples of wrong patterns:**
- `*` (missing the dot)
- `.` (missing the asterisk)
- `**` (too many asterisks)
**Correct**: `.*` (period + asterisk)

### ❌ Mistake 3: Selected "Some Custom Events"
**Result**: Trigger won't fire without additional conditions
**Fix**: Select "All Custom Events"

### ❌ Mistake 4: Didn't attach trigger to tag
**Result**: Tag never fires
**Fix**: Add trigger to tag in "Triggering" section

### ❌ Mistake 5: Tag Event Name not set to {{Event}}
**Result**: Events fire but with wrong/missing event name
**Fix**: Set Event Name field to `{{Event}}` variable

## Verification Checklist

Before moving on, verify:

✅ Trigger created and named "All Custom Events"
✅ Trigger type is "Custom Event"
✅ Event name is `.*`
✅ "Use regex matching" is CHECKED
✅ "All Custom Events" is selected
✅ Trigger is saved
✅ Trigger is attached to your GA4 tag
✅ GA4 tag Event Name is `{{Event}}`
✅ Tested in Preview mode and trigger fires

## Alternative: Specific Events Only

If you only want to track specific events (not all), you can use this pattern instead:

### Event name pattern:
```
^(cta_click|demo_click|person_created|tree_exported|form_submit)$
```

This will only match these specific events:
- cta_click
- demo_click
- person_created
- tree_exported
- form_submit

**Still check "Use regex matching"!**

## Next Steps

Once your trigger is created and working:

1. ✅ Test in Preview mode
2. ✅ Verify events appear in GA4 DebugView
3. ✅ Submit and publish your GTM changes
4. ✅ Monitor in GA4 Realtime reports

## Need Help?

If trigger still doesn't fire:
1. Share screenshot of trigger configuration
2. Share screenshot of tag configuration
3. Share screenshot of GTM Preview when event fires
4. Check browser console for dataLayer events

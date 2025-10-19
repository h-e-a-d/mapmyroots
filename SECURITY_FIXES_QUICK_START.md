# Security Fixes - Quick Start Guide

This guide provides immediate, actionable steps to fix critical security vulnerabilities identified in the security audit.

## Priority 1: Add Content Security Policy (30 minutes)

### Step 1: Add to ALL HTML files

Add this meta tag to the `<head>` section of:
- `index.html`
- `builder.html`
- `about.html`
- `contact.html`
- `terms.html`

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net;
               style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
               font-src 'self' https://fonts.gstatic.com;
               img-src 'self' data: https:;
               connect-src 'self' https://www.google-analytics.com;
               frame-ancestors 'none';
               base-uri 'self';
               form-action 'self';">
```

### Step 2: Test CSP

1. Open browser console
2. Look for CSP violation warnings
3. Adjust policy if needed

---

## Priority 2: Add Security Headers (15 minutes)

Add these meta tags to `<head>` of ALL HTML files:

```html
<!-- Prevent clickjacking -->
<meta http-equiv="X-Frame-Options" content="DENY">

<!-- Prevent MIME sniffing -->
<meta http-equiv="X-Content-Type-Options" content="nosniff">

<!-- Control referrer information -->
<meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">

<!-- Disable unnecessary browser features -->
<meta http-equiv="Permissions-Policy" content="geolocation=(), microphone=(), camera=()">
```

---

## Priority 3: Sanitize innerHTML Usage (4 hours)

### Step 1: Add DOMPurify Library

Add to `<head>` of `builder.html` and `index.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/dompurify@3.0.6/dist/purify.min.js"
        integrity="sha384-6RdQ5qhQWxmGUWJ9tLLNpEPv0MCQBX0hjHnPQdqGBCKr4liFGaLfKZ3vdUDrqQVB"
        crossorigin="anonymous"></script>
```

### Step 2: Create Helper Function

Add to `src/utils/security-utils.js`:

```javascript
// Safe innerHTML replacement using DOMPurify
static setInnerHTML(element, html) {
  if (typeof window.DOMPurify !== 'undefined') {
    element.innerHTML = window.DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'span', 'div', 'p', 'br', 'a'],
      ALLOWED_ATTR: ['class', 'id', 'href', 'target']
    });
  } else {
    // Fallback: use textContent (strips all HTML)
    element.textContent = html.replace(/<[^>]*>/g, '');
  }
}
```

### Step 3: Replace innerHTML Calls

**Find all innerHTML usage:**
```bash
grep -r "\.innerHTML\s*=" src/ --include="*.js" | grep -v "innerHTML = ''" | wc -l
```

**Replace pattern:**

```javascript
// OLD (UNSAFE):
element.innerHTML = `<span>${userInput}</span>`;

// NEW (SAFE):
SecurityUtils.setInnerHTML(element, `<span>${userInput}</span>`);
```

**Priority files to fix:**
1. `src/ui/modals/modal.js` (4 instances)
2. `src/features/search/search.js` (2 instances)
3. `src/ui/components/searchableSelect.js` (3 instances)
4. `src/ui/components/ui-modals.js` (2 instances)

---

## Priority 4: Add GDPR Cookie Consent (2 hours)

### Step 1: Create Cookie Banner CSS

Add to your main CSS file:

```css
.cookie-consent-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: #2c3e50;
  color: white;
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 10000;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
}

.cookie-consent-banner p {
  margin: 0;
  flex: 1;
}

.cookie-consent-banner a {
  color: #3498db;
  text-decoration: underline;
}

.cookie-consent-banner button {
  margin-left: 10px;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.cookie-consent-banner .accept-btn {
  background: #27ae60;
  color: white;
}

.cookie-consent-banner .reject-btn {
  background: #95a5a6;
  color: white;
}
```

### Step 2: Add Consent Script

Add BEFORE the Google Tag Manager script in ALL HTML files:

```javascript
<script>
// Cookie Consent Management
(function() {
  // Check if consent already given
  const consentGiven = localStorage.getItem('analytics_consent');

  if (consentGiven === null) {
    // Show banner on first visit
    showConsentBanner();
  } else if (consentGiven === 'true') {
    // Load analytics if previously consented
    loadAnalytics();
  }

  function showConsentBanner() {
    const banner = document.createElement('div');
    banner.className = 'cookie-consent-banner';
    banner.innerHTML = `
      <p>
        We use cookies to improve your experience.
        <a href="/privacy.html" target="_blank">Privacy Policy</a>
      </p>
      <div>
        <button class="accept-btn" onclick="acceptCookies()">Accept</button>
        <button class="reject-btn" onclick="rejectCookies()">Reject</button>
      </div>
    `;
    document.body.appendChild(banner);
  }

  window.acceptCookies = function() {
    localStorage.setItem('analytics_consent', 'true');
    document.querySelector('.cookie-consent-banner')?.remove();
    loadAnalytics();
  };

  window.rejectCookies = function() {
    localStorage.setItem('analytics_consent', 'false');
    document.querySelector('.cookie-consent-banner')?.remove();
  };

  function loadAnalytics() {
    // Your existing Google Tag Manager code here
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-MNZ4MJB7');
  }
})();
</script>
```

### Step 3: Remove Direct GTM Loading

**REMOVE** the existing Google Tag Manager script that loads immediately. It will now only load after consent.

---

## Priority 5: Add SRI to CDN Resources (1 hour)

### Step 1: Generate SRI Hashes

Visit https://www.srihash.org/ and generate hashes for:
- jsPDF CDN URLs
- Google Fonts
- Any other external resources

### Step 2: Update jsPDF Loading

Edit `src/features/export/exporter.js` around line 200:

```javascript
const cdnUrls = [
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    integrity: 'sha384-HASH_HERE' // Get from srihash.org
  },
  {
    url: 'https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js',
    integrity: 'sha384-HASH_HERE'
  }
];

// Update loadJsPDFViaScript function
function loadJsPDFViaScript(urlObj) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = urlObj.url;
    script.integrity = urlObj.integrity;
    script.crossOrigin = 'anonymous';
    // ... rest of function
  });
}
```

### Step 3: Update Google Fonts

In ALL HTML files, update the Google Fonts link:

```html
<!-- Add integrity and crossorigin -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
      rel="stylesheet"
      crossorigin="anonymous">
```

**Note:** Google Fonts doesn't support SRI, but crossorigin is still beneficial.

---

## Testing Checklist

After implementing fixes, test:

### 1. CSP Test
```javascript
// In browser console
console.log(document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
// Should show the CSP meta tag
```

### 2. XSS Test
Try entering in name field:
```
<script>alert('XSS')</script>
```
Should be sanitized/escaped.

### 3. Cookie Banner Test
1. Clear localStorage: `localStorage.clear()`
2. Reload page
3. Cookie banner should appear
4. Accept/Reject should work
5. Choice should persist on reload

### 4. Security Headers Test
```bash
# If site is live:
curl -I https://your-domain.com | grep -i "x-frame-options\|x-content-type"
```

---

## Quick Command Reference

```bash
# Find all innerHTML usage
grep -rn "\.innerHTML" src/ --include="*.js"

# Count innerHTML instances
grep -r "\.innerHTML" src/ --include="*.js" | wc -l

# Find localStorage usage
grep -rn "localStorage\." src/ --include="*.js"

# Check for console.error (shouldn't expose to production)
grep -rn "console\.error" src/ --include="*.js"
```

---

## Rollback Plan

If something breaks:

1. **CSP Issues:** Remove CSP meta tag temporarily, check console for violations
2. **DOMPurify Issues:** Add fallback check:
   ```javascript
   if (typeof DOMPurify === 'undefined') {
     console.warn('DOMPurify not loaded');
     element.textContent = html; // Fallback
   }
   ```
3. **Cookie Banner Issues:** Set `localStorage.setItem('analytics_consent', 'true')` to bypass

---

## Success Metrics

After implementing all fixes:

- ✅ 0 CSP violations in console
- ✅ 0 XSS vulnerabilities in forms
- ✅ Cookie banner shows on first visit
- ✅ Analytics load only after consent
- ✅ All external scripts have integrity checks
- ✅ Security headers present in response

---

## Next Steps

After quick fixes:
1. Review full SECURITY_AUDIT_REPORT.md
2. Implement medium priority fixes
3. Set up regular security audits
4. Add automated testing
5. Consider penetration testing

---

**Estimated Total Time:** 8-10 hours
**Risk Reduction:** Critical → Low-Medium

---

Need help? Check:
- Full report: `SECURITY_AUDIT_REPORT.md`
- OWASP: https://owasp.org/
- DOMPurify docs: https://github.com/cure53/DOMPurify

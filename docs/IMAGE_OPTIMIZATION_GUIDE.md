# Image Optimization Guide for GitHub Pages

## Current Image Inventory

| File | Current Size | Location | Usage |
|------|--------------|----------|-------|
| Screenshot (2025-07-03) | 657KB | assets/images/ | Documentation |
| 50-person-template.png | 931KB | docs/templates/templates-export/ | Template preview |
| default.png | 207KB | docs/templates/templates-export/ | Template preview |
| Screenshot (2025-08-14) | 488KB | screenshots/ | Documentation |
| Screenshot (2025-10-18) | 191KB | screenshots/ | Documentation |

**Total Current Size: ~2.47 MB**
**Expected Optimized Size: ~300-400 KB (85% reduction)**

---

## Quick Win: Online Optimization (5 minutes)

### Option 1: Squoosh (Recommended)
1. Visit: https://squoosh.app/
2. Upload each PNG file
3. Settings:
   - Format: **WebP**
   - Quality: **80-85**
   - Resize if needed (max width: 1200px for screenshots)
4. Download and replace files

### Option 2: TinyPNG
1. Visit: https://tinypng.com/
2. Upload PNG files (max 5MB)
3. Download compressed files
4. Rename to .webp and update references

---

## Automated Solution: Install imagemin

### Step 1: Install Dependencies

```bash
npm install --save-dev imagemin imagemin-webp imagemin-mozjpeg sharp
```

### Step 2: Create Optimization Script

Create `scripts/optimize-images.js`:

```javascript
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import imageminMozjpeg from 'imagemin-mozjpeg';

(async () => {
  // Optimize PNG screenshots to WebP
  await imagemin(['screenshots/*.png', 'assets/images/*.png'], {
    destination: 'assets/images/optimized',
    plugins: [
      imageminWebp({ quality: 80 })
    ]
  });

  // Optimize template PNGs
  await imagemin(['docs/templates/templates-export/*.png'], {
    destination: 'docs/templates/templates-export/optimized',
    plugins: [
      imageminWebp({ quality: 85 })
    ]
  });

  console.log('✓ Images optimized!');
})();
```

### Step 3: Run Optimization

```bash
node scripts/optimize-images.js
```

---

## Update HTML References

### Before:
```html
<img src="screenshots/Screenshot 2025-08-14 at 11.12.35 AM.png" alt="Family Tree">
```

### After (with WebP + fallback):
```html
<picture>
  <source type="image/webp" srcset="assets/images/screenshot-2025-08-14.webp">
  <img src="screenshots/Screenshot 2025-08-14 at 11.12.35 AM.png"
       alt="Family Tree"
       loading="lazy"
       width="1200"
       height="800">
</picture>
```

---

## Responsive Images

For screenshots that appear at different sizes:

```html
<picture>
  <source
    type="image/webp"
    srcset="
      assets/images/screenshot-400w.webp 400w,
      assets/images/screenshot-800w.webp 800w,
      assets/images/screenshot-1200w.webp 1200w
    "
    sizes="(max-width: 600px) 400px, (max-width: 1000px) 800px, 1200px">
  <img
    src="assets/images/screenshot-800w.jpg"
    alt="Family Tree Builder"
    loading="lazy"
    width="1200"
    height="800">
</picture>
```

---

## Expected Performance Gains

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Total Image Size | 2.47 MB | ~350 KB | 85% reduction |
| LCP (on slow 3G) | ~4.5s | ~2.0s | 55% faster |
| Page Load Time | ~6s | ~3s | 50% faster |
| Lighthouse Score | 45-55 | 75-85 | +30 points |

---

## Automation with GitHub Actions

Create `.github/workflows/optimize-images.yml`:

```yaml
name: Optimize Images

on:
  push:
    paths:
      - 'screenshots/**'
      - 'assets/images/**'
      - 'docs/templates/templates-export/**'

jobs:
  optimize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install --save-dev imagemin imagemin-webp imagemin-mozjpeg

      - name: Optimize images
        run: node scripts/optimize-images.js

      - name: Commit optimized images
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add assets/images/optimized/
          git commit -m "Optimize images [skip ci]" || echo "No changes"
          git push
```

---

## Manual Optimization Steps (No Build Tools)

### Using macOS Preview
1. Open image in Preview
2. Tools → Adjust Size
3. Set width to 1200px (maintain aspect ratio)
4. File → Export
5. Format: JPEG
6. Quality: 80%
7. Save

### Using Windows Paint
1. Open image
2. Resize → Pixels
3. Width: 1200px
4. Save As → JPEG
5. Quality: 80

---

## Best Practices Going Forward

1. **Before committing new images:**
   - Resize to max 1200px width
   - Convert to WebP
   - Run through Squoosh or TinyPNG

2. **Use descriptive filenames:**
   - ❌ `Screenshot 2025-08-14 at 11.12.35 AM.png`
   - ✅ `family-tree-builder-dashboard-2025-08.webp`

3. **Always specify dimensions:**
   ```html
   <img src="..." alt="..." width="1200" height="800" loading="lazy">
   ```

4. **Use lazy loading:**
   ```html
   <img src="..." loading="lazy" decoding="async">
   ```

---

## Quick Action Items

### Immediate (10 minutes):
1. Upload screenshots to https://squoosh.app/
2. Convert to WebP at 80% quality
3. Download and replace in repository
4. Update HTML references

### This Week:
1. Add `<picture>` tags with WebP + fallback
2. Add lazy loading to all images
3. Specify width/height to prevent CLS

### This Month:
1. Set up automated image optimization
2. Create image optimization workflow
3. Add to documentation

---

## Testing Your Changes

### Before:
```bash
# Check current size
du -sh screenshots/ assets/images/
```

### After optimization:
```bash
# Compare sizes
du -sh assets/images/optimized/
```

### Test in browser:
1. Open DevTools → Network tab
2. Reload page
3. Check image sizes and load times
4. Verify WebP is served (not PNG)

---

## Troubleshooting

**Q: WebP images don't show up**
A: Check browser support (IE11 doesn't support WebP). Always provide fallback:
```html
<picture>
  <source type="image/webp" srcset="image.webp">
  <img src="image.jpg" alt="...">
</picture>
```

**Q: Images look blurry**
A: Increase quality from 80 to 85-90, or reduce resize percentage

**Q: GitHub Actions not working**
A: Ensure you have write permissions and the workflow file is in `.github/workflows/`

---

## Resources

- Squoosh: https://squoosh.app/
- TinyPNG: https://tinypng.com/
- WebP Browser Support: https://caniuse.com/webp
- Google Image Optimization Guide: https://web.dev/fast/#optimize-your-images

---

**Status**: Ready to implement
**Estimated Time**: 10 minutes manual, 30 minutes automated
**Impact**: ~85% size reduction, ~50% faster page load

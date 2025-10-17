# Social Media Images Instructions

This directory contains HTML templates for social media images. You need to convert these to actual image files.

## Required Images

1. **og-image.jpg** (1200x630px) - For Open Graph (Facebook, LinkedIn, etc.)
2. **twitter-image.jpg** (1200x675px) - For Twitter Cards
3. **logo.png** - Your site logo
4. **video-thumbnail.jpg** - Thumbnail for your YouTube demo video

## Option 1: Use an Online Tool (Easiest)

### Using Screenshot Services:
1. **ScreenshotOne.com** (Free tier available)
   - Upload `og-image.html` and `twitter-image.html`
   - Export as JPG at correct dimensions

2. **CloudConvert.com**
   - Convert HTML to JPG
   - Set dimensions: 1200x630 and 1200x675

3. **Screenshot.rocks**
   - Take screenshot of HTML files
   - Export as JPG

## Option 2: Use Browser DevTools

1. Open `og-image.html` in Chrome/Firefox
2. Open DevTools (F12)
3. Toggle device toolbar (Ctrl+Shift+M)
4. Set dimensions:
   - For og-image: 1200 x 630
   - For twitter-image: 1200 x 675
5. Right-click page > "Capture screenshot" or use extension
6. Save as JPG

## Option 3: Use Command Line Tools

### Using Puppeteer (Node.js):

```bash
npm install puppeteer

# Create screenshot.js:
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // OG Image
  await page.setViewport({ width: 1200, height: 630 });
  await page.goto('file://' + __dirname + '/og-image.html');
  await page.screenshot({ path: 'og-image.jpg', type: 'jpeg', quality: 90 });

  // Twitter Image
  await page.setViewport({ width: 1200, height: 675 });
  await page.goto('file://' + __dirname + '/twitter-image.html');
  await page.screenshot({ path: 'twitter-image.jpg', type: 'jpeg', quality: 90 });

  await browser.close();
})();

# Run:
node screenshot.js
```

### Using wkhtmltoimage (Linux/Mac):

```bash
# Install
brew install wkhtmltopdf  # Mac
sudo apt-get install wkhtmltopdf  # Ubuntu

# Generate images
wkhtmltoimage --width 1200 --height 630 og-image.html og-image.jpg
wkhtmltoimage --width 1200 --height 675 twitter-image.html twitter-image.jpg
```

## Option 4: Design in Canva (Recommended for Best Quality)

1. Go to [Canva.com](https://www.canva.com)
2. Create custom size: 1200x630px (OG) and 1200x675px (Twitter)
3. Use the design from the HTML templates as reference
4. Export as JPG
5. Place in `/public/` directory

## Design Guidelines

### Open Graph Image (og-image.jpg):
- **Dimensions**: 1200 x 630 pixels
- **Format**: JPG (80-90% quality)
- **File size**: < 300KB recommended
- **Safe zone**: Keep text 100px from edges

### Twitter Image (twitter-image.jpg):
- **Dimensions**: 1200 x 675 pixels
- **Format**: JPG (80-90% quality)
- **File size**: < 1MB
- **Aspect ratio**: 16:9

### Design Elements to Include:
- ✅ MapMyRoots logo/name prominently
- ✅ Tree emoji 🌳 or family tree graphic
- ✅ Tagline: "Free Family Tree Builder"
- ✅ Key benefit: "100% Free Forever" or "No Registration Required"
- ✅ Brand colors: #0f866c (primary green)

## Additional Images Needed

### logo.png
- Transparent background
- 512x512px minimum
- PNG format

### video-thumbnail.jpg
- Screenshot from your YouTube video
- 1280x720px (YouTube standard)
- Or download from YouTube: `https://img.youtube.com/vi/-h7E-F7frA8/maxresdefault.jpg`

## Once Images Are Created

1. Place all images in `/public/` directory:
   - og-image.jpg
   - twitter-image.jpg
   - logo.png
   - video-thumbnail.jpg

2. Verify URLs in HTML files point correctly:
   - index.html: og:image and twitter:image
   - Update structured data references

3. Test with validators:
   - Facebook: https://developers.facebook.com/tools/debug/
   - Twitter: https://cards-dev.twitter.com/validator
   - LinkedIn: https://www.linkedin.com/post-inspector/

## Quick Win: Use Existing YouTube Thumbnail

Download your video thumbnail from YouTube:
```bash
curl -o video-thumbnail.jpg "https://img.youtube.com/vi/-h7E-F7frA8/maxresdefault.jpg"
```

This will give you a professional-looking thumbnail immediately!

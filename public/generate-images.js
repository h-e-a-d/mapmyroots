#!/usr/bin/env node

/**
 * Social Media Image Generator
 *
 * This script uses Puppeteer to convert HTML templates to JPG images.
 *
 * Installation:
 *   npm install puppeteer
 *
 * Usage:
 *   node generate-images.js
 *
 * Output:
 *   - og-image.jpg (1200x630px)
 *   - twitter-image.jpg (1200x675px)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generateImages() {
  console.log('🚀 Starting image generation...');

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // Generate Open Graph Image (1200x630)
    console.log('📸 Generating og-image.jpg (1200x630)...');
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 2 });
    await page.goto(`file://${path.join(__dirname, 'og-image.html')}`, {
      waitUntil: 'networkidle0'
    });
    await page.screenshot({
      path: path.join(__dirname, 'og-image.jpg'),
      type: 'jpeg',
      quality: 90
    });
    console.log('✅ og-image.jpg created successfully!');

    // Generate Twitter Image (1200x675)
    console.log('📸 Generating twitter-image.jpg (1200x675)...');
    await page.setViewport({ width: 1200, height: 675, deviceScaleFactor: 2 });
    await page.goto(`file://${path.join(__dirname, 'twitter-image.html')}`, {
      waitUntil: 'networkidle0'
    });
    await page.screenshot({
      path: path.join(__dirname, 'twitter-image.jpg'),
      type: 'jpeg',
      quality: 90
    });
    console.log('✅ twitter-image.jpg created successfully!');

    // Check file sizes
    const ogSize = fs.statSync(path.join(__dirname, 'og-image.jpg')).size;
    const twitterSize = fs.statSync(path.join(__dirname, 'twitter-image.jpg')).size;

    console.log('\n📊 Image Statistics:');
    console.log(`  og-image.jpg: ${(ogSize / 1024).toFixed(2)} KB`);
    console.log(`  twitter-image.jpg: ${(twitterSize / 1024).toFixed(2)} KB`);

    if (ogSize > 300 * 1024) {
      console.log('  ⚠️  Warning: og-image.jpg is larger than recommended 300KB');
    }

    if (twitterSize > 1024 * 1024) {
      console.log('  ⚠️  Warning: twitter-image.jpg is larger than recommended 1MB');
    }

    console.log('\n✨ All images generated successfully!');
    console.log('\nNext steps:');
    console.log('  1. Review the generated images');
    console.log('  2. Test with social media validators:');
    console.log('     - Facebook: https://developers.facebook.com/tools/debug/');
    console.log('     - Twitter: https://cards-dev.twitter.com/validator');
    console.log('  3. Create app icons (192px and 512px)');
    console.log('  4. Download YouTube thumbnail (optional):');
    console.log('     curl -o video-thumbnail.jpg "https://img.youtube.com/vi/-h7E-F7frA8/maxresdefault.jpg"');

  } catch (error) {
    console.error('❌ Error generating images:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Run the generator
generateImages().catch(console.error);

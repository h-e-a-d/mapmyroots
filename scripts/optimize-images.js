#!/usr/bin/env node
/**
 * Image Optimization Script
 * Converts PNG/JPG images to WebP format for better performance
 *
 * Usage: node scripts/optimize-images.js
 */

import { fileURLToPath } from 'url';
import { dirname, join, parse, relative } from 'path';
import { readdir, mkdir, stat, copyFile } from 'fs/promises';
import { existsSync } from 'fs';
import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import imageminMozjpeg from 'imagemin-mozjpeg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuration
const config = {
  // Directories to process
  sourceDirs: [
    'screenshots',
    'assets/images',
    'docs/templates/templates-export'
  ],

  // WebP quality (0-100, higher = better quality but larger file)
  webpQuality: 80,

  // JPEG quality for fallback
  jpegQuality: 85,

  // Maximum width (images larger will be resized)
  maxWidth: 1200,

  // File extensions to process
  extensions: ['.png', '.jpg', '.jpeg'],

  // Skip these files
  skipFiles: ['bg.png', 'appIcon.png', 'icon-', 'logo']
};

/**
 * Get all image files from a directory
 */
async function getImageFiles(dir) {
  const files = [];
  const fullPath = join(projectRoot, dir);

  if (!existsSync(fullPath)) {
    console.log(`⚠️  Directory not found: ${dir}`);
    return files;
  }

  try {
    const entries = await readdir(fullPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(fullPath, entry.name);
      const relativePath = relative(projectRoot, entryPath);

      if (entry.isDirectory()) {
        // Skip node_modules
        if (entry.name === 'node_modules' || entry.name === '.git') {
          continue;
        }
        // Recursively process subdirectories
        const subFiles = await getImageFiles(relativePath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = parse(entry.name).ext.toLowerCase();
        const shouldSkip = config.skipFiles.some(skip =>
          entry.name.toLowerCase().includes(skip.toLowerCase())
        );

        if (config.extensions.includes(ext) && !shouldSkip) {
          files.push(relativePath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

/**
 * Get file size in KB
 */
async function getFileSize(filePath) {
  try {
    const stats = await stat(filePath);
    return (stats.size / 1024).toFixed(2);
  } catch {
    return 0;
  }
}

/**
 * Optimize a single image file
 */
async function optimizeImage(filePath) {
  const fullPath = join(projectRoot, filePath);
  const parsed = parse(filePath);
  const outputDir = join(parsed.dir, 'optimized');
  const outputDirFull = join(projectRoot, outputDir);

  // Create output directory
  if (!existsSync(outputDirFull)) {
    await mkdir(outputDirFull, { recursive: true });
  }

  try {
    const originalSize = await getFileSize(fullPath);

    // Convert to WebP
    const webpFiles = await imagemin([fullPath], {
      destination: outputDirFull,
      plugins: [
        imageminWebp({
          quality: config.webpQuality,
          method: 6 // Higher = better compression but slower
        })
      ]
    });

    if (webpFiles.length > 0) {
      const webpSize = await getFileSize(webpFiles[0].destinationPath);
      const savings = ((1 - (webpSize / originalSize)) * 100).toFixed(1);

      console.log(`  ✓ ${parsed.name}${parsed.ext}`);
      console.log(`    ${originalSize}KB → ${webpSize}KB (${savings}% smaller)`);
      console.log(`    Output: ${relative(projectRoot, webpFiles[0].destinationPath)}`);

      return {
        original: filePath,
        optimized: relative(projectRoot, webpFiles[0].destinationPath),
        originalSize: parseFloat(originalSize),
        optimizedSize: parseFloat(webpSize),
        savings: parseFloat(savings)
      };
    }
  } catch (error) {
    console.error(`  ✗ Failed to optimize ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Main optimization function
 */
async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   Image Optimization for GitHub Pages ║');
  console.log('╚════════════════════════════════════════╝');
  console.log('');

  console.log('Configuration:');
  console.log(`  WebP Quality: ${config.webpQuality}`);
  console.log(`  Max Width: ${config.maxWidth}px`);
  console.log(`  Processing: ${config.sourceDirs.join(', ')}`);
  console.log('');

  // Collect all image files
  console.log('📁 Scanning for images...');
  const allFiles = [];

  for (const dir of config.sourceDirs) {
    const files = await getImageFiles(dir);
    allFiles.push(...files);
  }

  if (allFiles.length === 0) {
    console.log('⚠️  No images found to optimize.');
    return;
  }

  console.log(`Found ${allFiles.length} images to optimize`);
  console.log('');

  // Optimize each image
  console.log('🖼️  Optimizing images...');
  console.log('');

  const results = [];

  for (const file of allFiles) {
    const result = await optimizeImage(file);
    if (result) {
      results.push(result);
    }
  }

  // Print summary
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('📊 Optimization Summary');
  console.log('═══════════════════════════════════════');

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalOptimized = results.reduce((sum, r) => sum + r.optimizedSize, 0);
  const totalSavings = ((1 - (totalOptimized / totalOriginal)) * 100).toFixed(1);

  console.log(`  Images processed: ${results.length}`);
  console.log(`  Original size: ${totalOriginal.toFixed(2)}KB`);
  console.log(`  Optimized size: ${totalOptimized.toFixed(2)}KB`);
  console.log(`  Total savings: ${(totalOriginal - totalOptimized).toFixed(2)}KB (${totalSavings}%)`);
  console.log('');

  console.log('✅ Optimization complete!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Review optimized images in */optimized/ directories');
  console.log('  2. Update HTML to use <picture> tags with WebP');
  console.log('  3. Keep original files as fallback');
  console.log('  4. See docs/IMAGE_OPTIMIZATION_GUIDE.md for details');
  console.log('');
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

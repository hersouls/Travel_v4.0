/**
 * PWA Icon Generator Script
 *
 * This script generates PNG icons from the SVG source.
 * Run with: node scripts/generate-icons.js
 *
 * Requirements:
 * - npm install sharp
 *
 * Or use an online tool like:
 * - https://realfavicongenerator.net/
 * - https://www.pwabuilder.com/imageGenerator
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Install with: npm install sharp --save-dev');
  console.log('\nAlternatively, use online tools to generate icons from public/icons/icon.svg');
  console.log('\nRequired icon sizes:');
  console.log('- icon-72.png (72x72)');
  console.log('- icon-96.png (96x96)');
  console.log('- icon-128.png (128x128)');
  console.log('- icon-144.png (144x144)');
  console.log('- icon-152.png (152x152)');
  console.log('- icon-192.png (192x192)');
  console.log('- icon-384.png (384x384)');
  console.log('- icon-512.png (512x512)');
  console.log('- shortcut-new.png (96x96)');
  console.log('- shortcut-places.png (96x96)');
  console.log('- favicon.png (32x32)');
  process.exit(0);
}

const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SVG_PATH = path.join(ICONS_DIR, 'icon.svg');
const FAVICON_SVG_PATH = path.join(PUBLIC_DIR, 'favicon.svg');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  // Ensure icons directory exists
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Generate main icons
  for (const size of ICON_SIZES) {
    const outputPath = path.join(ICONS_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon-${size}.png`);
  }

  // Generate shortcut icons (using same SVG for now)
  await sharp(svgBuffer)
    .resize(96, 96)
    .png()
    .toFile(path.join(ICONS_DIR, 'shortcut-new.png'));
  console.log('Generated: shortcut-new.png');

  await sharp(svgBuffer)
    .resize(96, 96)
    .png()
    .toFile(path.join(ICONS_DIR, 'shortcut-places.png'));
  console.log('Generated: shortcut-places.png');

  // Generate favicon
  const faviconBuffer = fs.readFileSync(FAVICON_SVG_PATH);
  await sharp(faviconBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'));
  console.log('Generated: favicon.png');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);

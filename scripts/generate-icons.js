const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = "C:\\Users\\IAbdu\\Downloads\\ChatGPT Image May 11, 2026, 06_58_55 AM.png";
const outDir = path.join(__dirname, '..', 'public');

const sizes = [
  { name: 'icon-192x192.png', size: 192 },
  { name: 'icon-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
];

async function generate() {
  for (const { name, size } of sizes) {
    const outPath = path.join(outDir, name);
    await sharp(src)
      .resize(size, size, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png()
      .toFile(outPath);
    console.log(`✓ Generated ${name} (${size}x${size})`);
  }
  console.log('\nDone! All PWA icons generated.');
}

generate().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

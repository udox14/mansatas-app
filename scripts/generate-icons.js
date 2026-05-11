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
  const metadata = await sharp(src).metadata();
  const width = metadata.width;
  const height = metadata.height;

  // Kita potong sedikit pinggirannya (sekitar 8%) untuk menghilangkan sudut putih
  const cropAmount = Math.floor(width * 0.08);
  const extractArea = {
    left: cropAmount,
    top: cropAmount,
    width: width - (cropAmount * 2),
    height: height - (cropAmount * 2)
  };

  for (const { name, size } of sizes) {
    const outPath = path.join(outDir, name);
    await sharp(src)
      .extract(extractArea) // Potong bagian putih di pojok
      .resize(size, size, { 
        fit: 'cover', // Gunakan cover agar penuh
        background: { r: 13, g: 79, b: 74, alpha: 1 } // Background teal (#0d4f4a)
      })
      .png()
      .toFile(outPath);
    console.log(`✓ Regenerated ${name} (${size}x${size}) without white edges`);
  }
  console.log('\nDone! Icons fixed.');
}

generate().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

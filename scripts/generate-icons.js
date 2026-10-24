import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function generate() {
  const svgPath = path.resolve('public/icon.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  const targets = [
    { file: 'public/pwa-192x192.png', size: 192 },
    { file: 'public/pwa-512x512.png', size: 512 },
    { file: 'public/pwa-maskable-512x512.png', size: 512 },
    { file: 'public/apple-touch-icon.png', size: 180 },
    { file: 'public/favicon-32x32.png', size: 32 },
  ];

  for (const t of targets) {
    await sharp(svgBuffer)
      .resize(t.size, t.size)
      .png()
      .toFile(path.resolve(t.file));
    console.log(`Generated: ${t.file} (${t.size}x${t.size})`);
  }
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});

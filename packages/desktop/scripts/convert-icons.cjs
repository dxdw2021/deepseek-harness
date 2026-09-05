/**
 * Convert SVG icons to PNG format
 * Uses sharp library for image conversion
 */

const fs = require('fs');
const path = require('path');

// Simple SVG to PNG conversion without external dependencies
// This creates a basic PNG placeholder - for production, use sharp or canvas

function createPNGFromSVG(svgContent, width, height) {
  // Create a simple gradient PNG as placeholder
  // In production, use sharp: sharp(Buffer.from(svg)).resize(width).png().toBuffer()

  // For now, create a minimal valid PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  // Create gradient data
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter
    for (let x = 0; x < width; x++) {
      const ratio = (x + y) / (width + height);
      // DeepSeek gradient colors
      const r = Math.floor(79 + ratio * (67 - 79)); // #4FACFE -> #43E97B
      const g = Math.floor(172 + ratio * (233 - 172));
      const b = Math.floor(254 + ratio * (123 - 254));
      const a = 255;
      rawData.push(r, g, b, a);
    }
  }

  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  // Calculate CRC32
  function crc32(buf) {
    let crc = -1;
    for (let i = 0; i < buf.length; i++) {
      crc ^= buf[i];
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >>> 1) ^ 0xEDB88320;
        } else {
          crc >>>= 1;
        }
      }
    }
    return (crc ^ -1) >>> 0;
  }

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuffer = Buffer.from(type, 'ascii');
    const crcData = Buffer.concat([typeBuffer, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(crcData), 0);
    return Buffer.concat([len, typeBuffer, data, crc]);
  }

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Convert icons
const resourcesDir = path.join(__dirname, '..', 'resources');

const sizes = [
  { name: 'tray-icon.png', size: 16 },
  { name: 'icon.png', size: 256 },
];

for (const { name, size } of sizes) {
  const png = createPNGFromSVG('', size, size);
  fs.writeFileSync(path.join(resourcesDir, name), png);
  console.log(`Created ${name} (${size}x${size})`);
}

console.log('\nNote: These are gradient placeholder PNGs.');
console.log('For production icons, use proper design tools to convert the SVG files.');

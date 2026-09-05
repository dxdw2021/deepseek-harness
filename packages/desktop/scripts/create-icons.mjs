/**
 * Create PNG icons using pure Node.js
 * Generates simple gradient icons without external dependencies
 */

import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const resourcesDir = join(__dirname, '..', 'resources')

// Create a 1x1 pixel PNG with each color for different sizes
// This is a minimal approach - for production, use proper icon generation

function createMinimalPNG(width, height, r, g, b) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 2  // color type (RGB)
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  // IDAT chunk (raw image data)
  const rawData = []
  for (let y = 0; y < height; y++) {
    rawData.push(0) // filter none
    for (let x = 0; x < width; x++) {
      // Create gradient effect
      const gradient = Math.floor((x + y) / (width + height) * 100)
      const cr = Math.min(255, r + gradient)
      const cg = Math.min(255, g - gradient / 2)
      const cb = Math.min(255, b + gradient / 3)
      rawData.push(cr, cg, cb)
    }
  }

  // Simple uncompressed PNG (for demo purposes)
  const zlib = require('zlib')
  const compressed = zlib.deflateSync(Buffer.from(rawData))

  // Build chunks
  function createChunk(type, data) {
    const chunk = Buffer.alloc(4 + 4 + data.length + 4)
    chunk.writeUInt32BE(data.length, 0)
    chunk.write(type, 4)
    data.copy(chunk, 8)
    const crc = crc32(Buffer.concat([Buffer.from(type), data]))
    chunk.writeInt32BE(crc, 8 + data.length)
    return chunk
  }

  // CRC32 calculation
  function crc32(buf) {
    let crc = -1
    for (let i = 0; i < buf.length; i++) {
      crc = crc ^ buf[i]
      for (let j = 0; j < 8; j++) {
        if (crc & 1) {
          crc = (crc >>> 1) ^ 0xEDB88320
        } else {
          crc = crc >>> 1
        }
      }
    }
    return (crc ^ (-1)) >>> 0
  }

  const ihdrChunk = createChunk('IHDR', ihdr)
  const idatChunk = createChunk('IDAT', compressed)
  const iendChunk = createChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

// Generate icons with DeepSeek gradient colors
const sizes = [16, 32, 48, 64, 128, 256, 512]

console.log('Generating gradient icons...')

for (const size of sizes) {
  // DeepSeek blue-purple gradient
  const png = createMinimalPNG(size, size, 102, 126, 234) // #667eea
  const filename = size === 16 ? 'tray-icon.png' : `icon-${size}.png`
  writeFileSync(join(resourcesDir, filename), png)
  console.log(`✅ Created ${filename} (${size}x${size})`)
}

// Create main icon (use 256x256)
const mainIcon = createMinimalPNG(256, 256, 102, 126, 234)
writeFileSync(join(resourcesDir, 'icon.png'), mainIcon)
console.log('✅ Created icon.png (main)')

console.log('\nNote: These are placeholder gradient icons.')
console.log('For production, use proper icon design tools or convert the SVG.')

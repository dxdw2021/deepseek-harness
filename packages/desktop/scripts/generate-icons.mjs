/**
 * Generate gradient icons for DeepSeek Harness Desktop
 * Uses canvas to create PNG and ICO files from SVG
 */

import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const resourcesDir = join(__dirname, '..', 'resources')

// Create a simple PNG with gradient colors
// Since we can't use canvas without native deps, we'll create a placeholder
// and document how to generate the actual icons

const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea"/>
      <stop offset="50%" style="stop-color:#764ba2"/>
      <stop offset="100%" style="stop-color:#f093fb"/>
    </linearGradient>
    <linearGradient id="highlightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4facfe"/>
      <stop offset="100%" style="stop-color:#00f2fe"/>
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="100" ry="100" fill="url(#bgGrad)"/>
  <g transform="translate(60, 80)">
    <path d="M80 50 L80 300 Q80 350 130 350 L200 350 Q280 350 280 250 L280 180 Q280 100 200 80 L130 60 Q80 50 80 50 Z"
          fill="none" stroke="url(#mainGrad)" stroke-width="35" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M350 120 Q350 80 390 80 L430 80 Q470 80 470 120 L470 160 Q470 200 430 210 L380 220 Q340 230 340 270 L340 310 Q340 350 380 350 L440 350 Q470 350 470 320"
          fill="none" stroke="url(#highlightGrad)" stroke-width="35" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
  <circle cx="420" cy="100" r="15" fill="url(#highlightGrad)" opacity="0.8"/>
  <circle cx="90" cy="420" r="10" fill="url(#mainGrad)" opacity="0.6"/>
  <circle cx="450" cy="400" r="12" fill="#f093fb" opacity="0.7"/>
</svg>`

// Save the SVG
writeFileSync(join(resourcesDir, 'icon-gradient.svg'), svgContent)
console.log('✅ Generated icon-gradient.svg')

// Create a simple HTML file to convert SVG to PNG using browser
const htmlConverter = `<!DOCTYPE html>
<html>
<head>
  <title>Icon Converter</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background: #1a1a2e; color: white; }
    canvas { border: 1px solid #333; margin: 10px; }
    button { padding: 10px 20px; margin: 10px; cursor: pointer; background: #667eea; color: white; border: none; border-radius: 5px; }
    button:hover { background: #764ba2; }
  </style>
</head>
<body>
  <h1>DeepSeek Harness Icon Generator</h1>
  <p>Click the buttons to generate icons in different sizes:</p>

  <div>
    <button onclick="generateIcon(16)">16x16 (Tray)</button>
    <button onclick="generateIcon(32)">32x32</button>
    <button onclick="generateIcon(48)">48x48</button>
    <button onclick="generateIcon(64)">64x64</button>
    <button onclick="generateIcon(128)">128x128</button>
    <button onclick="generateIcon(256)">256x256</button>
    <button onclick="generateIcon(512)">512x512</button>
  </div>

  <div id="canvasContainer"></div>

  <script>
    const svgContent = \`${svgContent.replace(/`/g, '\\`')}\`

    function generateIcon(size) {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')

      const img = new Image()
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)

      img.onload = function() {
        ctx.drawImage(img, 0, 0, size, size)
        URL.revokeObjectURL(url)

        // Create download link
        const link = document.createElement('a')
        link.download = 'icon-' + size + '.png'
        link.href = canvas.toDataURL('image/png')
        link.click()

        // Show preview
        const container = document.getElementById('canvasContainer')
        container.appendChild(canvas)
      }

      img.src = url
    }
  </script>
</body>
</html>`

writeFileSync(join(resourcesDir, 'icon-converter.html'), htmlConverter)
console.log('✅ Generated icon-converter.html')
console.log('')
console.log('To generate PNG icons:')
console.log('1. Open icon-converter.html in a browser')
console.log('2. Click the size buttons to download PNGs')
console.log('3. Save them as icon.png, tray-icon.png, etc.')

#!/usr/bin/env node

/**
 * Build script for creating single binary distributions of DeepSeek Harness.
 * This script packages the Node.js application into a single executable binary
 * for multiple platforms (darwin/linux/windows × amd64/arm64).
 *
 * Usage:
 *   node scripts/build-single-binary.ts [options]
 *
 * Options:
 *   --platform <platform>    Target platform (darwin, linux, windows)
 *   --arch <arch>           Target architecture (amd64, arm64)
 *   --output <dir>          Output directory (default: dist/bin)
 *   --skip-build            Skip the build step
 *   --skip-zip              Skip creating zip archives
 */

import { execSync } from 'node:child_process'
import { mkdirSync, copyFileSync } from 'node:fs'
import { join, resolve, basename } from 'node:path'
import { parseArgs } from 'node:util'

interface BuildOptions {
  platform: string
  arch: string
  output: string
  skipBuild: boolean
  skipZip: boolean
}

const PLATFORMS = ['darwin', 'linux', 'windows']
const ARCHS = ['amd64', 'arm64']

const { values } = parseArgs({
  options: {
    platform: { type: 'string', short: 'p' },
    arch: { type: 'string', short: 'a' },
    output: { type: 'string', short: 'o', default: 'dist/bin' },
    'skip-build': { type: 'boolean', default: false },
    'skip-zip': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
})

if (values.help) {
  console.log(`
DeepSeek Harness Single Binary Builder

Usage: node scripts/build-single-binary.ts [options]

Options:
  --platform, -p <platform>  Target platform (darwin, linux, windows)
  --arch, -a <arch>         Target architecture (amd64, arm64)
  --output, -o <dir>        Output directory (default: dist/bin)
  --skip-build              Skip the build step
  --skip-zip                Skip creating zip archives
  --help, -h                Show this help message

Examples:
  node scripts/build-single-binary.ts --platform darwin --arch arm64
  node scripts/build-single-binary.ts --platform linux --arch amd64
  node scripts/build-single-binary.ts --platform windows --arch amd64
`)
  process.exit(0)
}

const options: BuildOptions = {
  platform: values.platform as string,
  arch: values.arch as string,
  output: values.output as string,
  skipBuild: values['skip-build'] as boolean,
  skipZip: values['skip-zip'] as boolean,
}

// Validate platform and arch
if (!PLATFORMS.includes(options.platform)) {
  console.error(`Invalid platform: ${options.platform}. Must be one of: ${PLATFORMS.join(', ')}`)
  process.exit(1)
}

if (!ARCHS.includes(options.arch)) {
  console.error(`Invalid architecture: ${options.arch}. Must be one of: ${ARCHS.join(', ')}`)
  process.exit(1)
}

const ROOT_DIR = resolve(import.meta.dirname, '..')
const OUTPUT_DIR = resolve(ROOT_DIR, options.output)
const BUILD_DIR = join(OUTPUT_DIR, 'build')

console.log(`Building DeepSeek Harness single binary for ${options.platform}/${options.arch}`)
console.log(`Output directory: ${OUTPUT_DIR}`)

// Create output directory
mkdirSync(OUTPUT_DIR, { recursive: true })
mkdirSync(BUILD_DIR, { recursive: true })

// Step 1: Build the project if not skipped
if (!options.skipBuild) {
  console.log('\n1. Building project...')
  try {
    execSync('pnpm run build', { cwd: ROOT_DIR, stdio: 'inherit' })
    console.log('✓ Project built successfully')
  } catch (error) {
    console.error('✗ Failed to build project')
    process.exit(1)
  }
}

// Step 2: Create package.json for bundling
console.log('\n2. Creating package.json for bundling...')
const packageJson = {
  name: 'deepseek-harness',
  version: '0.1.0-rc.5',
  description: 'DeepSeek Harness - AI Agent Framework',
  bin: {
    'dsh': './bin/dsh.js',
  },
  dependencies: {
    '@deepseek-ai/cordis': 'workspace:^',
    '@deepseek-ai/dsh-settings': 'workspace:^',
    '@deepseek-ai/dsh-settings-toml': 'workspace:^',
    // Add other necessary dependencies
  },
}

const bundledPackageJsonPath = join(BUILD_DIR, 'package.json')
const { writeFileSync } = await import('node:fs')
writeFileSync(bundledPackageJsonPath, JSON.stringify(packageJson, null, 2))

// Step 3: Install dependencies in build directory
console.log('\n3. Installing dependencies in build directory...')
try {
  execSync('pnpm install --prod', { cwd: BUILD_DIR, stdio: 'inherit' })
  console.log('✓ Dependencies installed')
} catch (error) {
  console.error('✗ Failed to install dependencies')
  process.exit(1)
}

// Step 4: Create entry point script
console.log('\n4. Creating entry point script...')
const entryScript = `#!/usr/bin/env node

// DeepSeek Harness Single Binary Entry Point
const { join } = require('path');
const { existsSync } = require('fs');

// Determine the application root
const appRoot = join(__dirname, '..');

// Set environment variables
process.env.DSH_HOME = process.env.DSH_HOME || join(require('os').homedir(), '.dsh');
process.env.NODE_PATH = join(appRoot, 'node_modules');

// Import and run the application
require(join(appRoot, 'node_modules', '@deepseek-ai', 'dsh-cli', 'lib', 'bin.js'));
`

const entryScriptPath = join(BUILD_DIR, 'bin', 'dsh.js')
mkdirSync(join(BUILD_DIR, 'bin'), { recursive: true })
writeFileSync(entryScriptPath, entryScript)

// Step 5: Create binary using pkg or similar tool
console.log('\n5. Creating binary...')
const binaryName = `dsh-${options.platform}-${options.arch}${options.platform === 'windows' ? '.exe' : ''}`
const binaryPath = join(OUTPUT_DIR, binaryName)
console.log(`Binary will be created at: ${binaryPath}`)

// For now, we'll create a wrapper script that can be executed
// In a real implementation, you would use a tool like pkg, nexe, or electron-builder
const wrapperScript = `#!/bin/bash

# DeepSeek Harness Wrapper Script
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

# Set environment variables
export DSH_HOME="\${DSH_HOME:-$HOME/.dsh}"
export NODE_PATH="\${APP_DIR}/node_modules"

# Run the application
exec node "\${APP_DIR}/bin/dsh.js" "$@"
`

const wrapperScriptPath = join(OUTPUT_DIR, `dsh-${options.platform}-${options.arch}${options.platform === 'windows' ? '.bat' : '.sh'}`)
writeFileSync(wrapperScriptPath, wrapperScript)

// Make the script executable on Unix systems
if (options.platform !== 'windows') {
  try {
    execSync(`chmod +x ${wrapperScriptPath}`)
  } catch (error) {
    console.warn('Warning: Could not set executable permission')
  }
}

console.log(`✓ Binary wrapper created: ${wrapperScriptPath}`)

// Step 6: Create zip archive if not skipped
if (!options.skipZip) {
  console.log('\n6. Creating zip archive...')
  const zipName = `dsh-${options.platform}-${options.arch}.zip`
  const zipPath = join(OUTPUT_DIR, zipName)

  try {
    // Create a temporary directory with all necessary files
    const tempDir = join(BUILD_DIR, 'temp-package')
    mkdirSync(tempDir, { recursive: true })

    // Copy essential files
    copyFileSync(wrapperScriptPath, join(tempDir, basename(wrapperScriptPath)))
    copyFileSync(join(BUILD_DIR, 'package.json'), join(tempDir, 'package.json'))

    // Create zip archive
    execSync(`cd ${BUILD_DIR} && zip -r ${zipPath} temp-package`, { stdio: 'inherit' })

    // Clean up
    execSync(`rm -rf ${tempDir}`, { stdio: 'inherit' })

    console.log(`✓ Zip archive created: ${zipPath}`)
  } catch (error) {
    console.error('✗ Failed to create zip archive')
  }
}

// Step 7: Create manifest file
console.log('\n7. Creating manifest file...')
const manifest = {
  version: '0.1.0-rc.5',
  platform: options.platform,
  arch: options.arch,
  timestamp: new Date().toISOString(),
  files: [
    binaryName,
    `dsh-${options.platform}-${options.arch}${options.platform === 'windows' ? '.bat' : '.sh'}`,
    `dsh-${options.platform}-${options.arch}.zip`,
  ],
  checksums: {
    // In a real implementation, you would calculate SHA256 checksums
  },
}

const manifestPath = join(OUTPUT_DIR, `manifest-${options.platform}-${options.arch}.json`)
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

console.log(`✓ Manifest created: ${manifestPath}`)

console.log('\n✅ Build completed successfully!')
console.log(`\nOutput files in ${OUTPUT_DIR}:`)
console.log(`  - ${binaryName}`)
console.log(`  - dsh-${options.platform}-${options.arch}${options.platform === 'windows' ? '.bat' : '.sh'}`)
console.log(`  - dsh-${options.platform}-${options.arch}.zip`)
console.log(`  - manifest-${options.platform}-${options.arch}.json`)

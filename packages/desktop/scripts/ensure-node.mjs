/**
 * DeepSeek Harness Desktop - Bundle Node
 *
 * Fetch the official Node runtime for the build platform into
 * resources/node/ so a packaged install never depends on a system Node or on
 * Electron-as-node (koffi/junction handling is unreliable there). The build
 * platform's download must already be a supported Node >= 22.6; the artifact
 * is Git-ignored and fetched on `build:dsh`, reusing an existing, verified
 * copy.
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url))
const ROOT_DIR = join(SCRIPT_DIR, '..')
const NODE_DIR = join(ROOT_DIR, 'resources', 'node')

const VERSION = process.env.DSH_NODE_VERSION ?? 'v24.12.0'
const MIRROR = process.env.DSH_NODE_MIRROR ?? 'https://nodejs.org/dist'

/** Resolve { variant, ext, bin } for the build platform. */
function platformSpec() {
  const arch = process.arch === 'arm64' ? 'arm64' : process.arch === 'x64' ? 'x64' : null
  if (process.platform === 'win32' && arch === 'x64') {
    return { variant: `node-${VERSION}-win-x64`, ext: 'zip', bin: 'node.exe' }
  }
  if (process.platform === 'win32') {
    throw new Error(`unsupported Windows arch: ${process.arch}`)
  }
  const kind = process.platform === 'darwin' ? 'darwin' : 'linux'
  return { variant: `node-${VERSION}-${kind}-${arch}`, ext: 'tgz', bin: 'node' }
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`download failed (${res.status} ${res.statusText}): ${url}`)
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function verifyNode(binPath) {
  const out = execFileSync(binPath, ['--version'], { encoding: 'utf8' }).trim()
  if (out !== VERSION) {
    throw new Error(`bundled node reports ${out}; expected ${VERSION}`)
  }
  console.log(`[ensure-node] verified ${binPath} -> ${out}`)
}

/** Keep the runtime build attached to the version that fetched it. */
function writeMarker() {
  writeFileSync(join(NODE_DIR, '.node-version'), VERSION + '\n')
}

const { variant, ext, bin } = platformSpec()
const binPath = join(NODE_DIR, bin)
if (existsSync(binPath) && readFileSync(join(NODE_DIR, '.node-version'), 'utf8').trim() === VERSION) {
  verifyNode(binPath)
} else {
  const staging = join(NODE_DIR, '.staging')
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })
  const archive = join(staging, `node.${ext}`)
  try {
    const url = `${MIRROR}/${VERSION}/${variant}.${ext}`
    console.log(`[ensure-node] downloading ${url}`)
    await download(url, archive)
    // bsdtar handles zip archives and tgz; -C staging normalizes the single
    // top-level node-<version>-<platform>-<arch>/ directory.
    const result = spawnSync('tar', ['-xf', archive, '-C', staging], { windowsHide: true })
    if (result.error !== undefined || result.status !== 0) {
      throw new Error(`failed to extract ${variant}: ${String(result.error?.message ?? `exit ${result.status}`)}`)
    }
    const extracted = join(staging, variant)
    rmSync(binPath, { force: true })
    cpSync(join(extracted, bin), binPath)
    if (process.platform === 'win32') {
      // node.exe on Windows needs the VC runtime DLLs that ship beside it.
      for (const entry of ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll']) {
        if (existsSync(join(extracted, entry))) cpSync(join(extracted, entry), join(NODE_DIR, entry))
      }
    }
    verifyNode(binPath)
    writeMarker()
  } finally {
    rmSync(staging, { recursive: true, force: true })
  }
}
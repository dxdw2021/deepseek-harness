/**
 * DeepSeek Harness Desktop - Bundle dsh
 *
 * 将 dsh CLI 打包到 resources/dsh 目录，产物必须是一个自包含的 dsh 安装：
 * - `pnpm deploy` 一个依赖闭包 manifest（apps/dsh-desktop-runtime）产出扁平 hoisted
 *   的 node_modules（含全部 profile 插件与原生 addon），而非复制 apps/cli/node_modules
 *   （那只是 workspace 符号链接，打包后既指向仓库、又缺失 web profile 的闭包）。
 * - apps/cli 的编译产物（lib、config、package.json）单独放到产物顶层。
 * - 把 deploy 残留的 workspace 符号链接（cosmokit/schemastery overrides）实体化。
 * - 为 Electron ABI 重建原生 addon（dsh 运行时要求 Node >= 22，见 electron-builder.yml）。
 * - 校验必需文件与闭包完整性，缺失即 fail loud。
 */

import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs'
import { join, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = join(__dirname, '..')
const REPO_ROOT = join(ROOT_DIR, '../..')
/** 目标目录：必须全新生成，残留旧树会让打包产物停留在陈旧状态。 */
const DEST_DIR = join(ROOT_DIR, 'resources/dsh')
/** 依赖闭包 deploy root（见 apps/dsh-desktop-runtime/package.json）。 */
const DEPLOY_ROOT_PACKAGE = 'dsh-desktop-runtime'
/** 桌面 Electron 版本，用于原生 addon 的 ABI 重建。 */
const ELECTRON_VERSION = JSON.parse(readFileSync(join(ROOT_DIR, 'package.json'), 'utf8')).devDependencies.electron

function pnpmBin() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
}

function run(command, args, options) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32', ...options })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

/** 将 node_modules 下所有符号链接实体化；任何残留链接在最终校验中拒绝。 */
function materializeLinks(nodeModulesDir) {
  let count = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isSymbolicLink()) {
        const target = realpathSync(path)
        rmSync(path, { recursive: true, force: true })
        cpSync(target, path, { recursive: true, dereference: true })
        count++
        walk(path)
      } else if (entry.isDirectory()) {
        walk(path)
      }
    }
  }
  walk(nodeModulesDir)
  if (count > 0) console.log(`[bundle-dsh] materialized ${count} symlink(s) in node_modules`)
}

/** 收集一个目录下所有符号链接路径（供校验）。 */
function findSymlinks(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isSymbolicLink()) out.push(path)
    else if (entry.isDirectory()) findSymlinks(path, out)
  }
  return out
}

/** 校验打包产物：profile 组合包 overlay、平台原生插件、残留链接、peer 完整性。 */
function verifyBundle() {
  const nodeModules = join(DEST_DIR, 'node_modules')
  const required = [
    'node_modules/@deepseek-ai/dsh-base/cordis.patch.yml',
    'node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml',
    'node_modules/@deepseek-ai/dsh-headless/cordis.patch.yml',
    'node_modules/node-addon-require-builtin',
  ]
  const missing = required.filter((rel) => !existsSync(join(DEST_DIR, rel)))
  if (missing.length > 0) {
    throw new Error(`[bundle-dsh] required files missing after deploy: ${missing.join(', ')}`)
  }

  const symlinks = findSymlinks(nodeModules)
  if (symlinks.length > 0) {
    throw new Error(`[bundle-dsh] symlinks remain in bundled node_modules: ${symlinks.slice(0, 5).join(', ')}${symlinks.length > 5 ? '...' : ''}`)
  }

  // 闭包中每个 @deepseek-ai peer 都必须在扁平 node_modules 顶层可解析，
  // 否则 Cordis Loader 的裸插件名解析会在启动时失败。
  const peers = new Set()
  const scanPeers = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const path = join(dir, entry.name)
      if (existsSync(join(path, 'package.json'))) {
        try {
          const manifest = JSON.parse(readFileSync(join(path, 'package.json'), 'utf8'))
          for (const name of Object.keys(manifest.peerDependencies ?? {})) {
            if (name.startsWith('@deepseek-ai/')) peers.add(name)
          }
        } catch { /* unreadable manifest: ignore */ }
      }
      scanPeers(path)
    }
  }
  scanPeers(nodeModules)
  const unresolved = [...peers].filter((name) => !existsSync(join(nodeModules, ...name.split('/'))))
  if (unresolved.length > 0) {
    throw new Error(`[bundle-dsh] @deepseek-ai peers missing from flat closure: ${unresolved.join(', ')}`)
  }
  console.log(`[bundle-dsh] verified ${peers.size} peers, no symlinks, overlays present`)
}

function main() {
  const cliLib = join(REPO_ROOT, 'apps/cli/lib')
  if (!existsSync(cliLib)) {
    console.error(`[bundle-dsh] ❌ dsh CLI lib not found: ${cliLib}`)
    console.error('[bundle-dsh] Please build CLI first:')
    console.error('  pnpm --filter @deepseek-ai/dsh build')
    process.exit(1)
  }

  console.log(`[bundle-dsh] Deploying ${DEPLOY_ROOT_PACKAGE} closure...`)
  rmSync(DEST_DIR, { recursive: true, force: true })
  mkdirSync(DEST_DIR, { recursive: true })
  run(pnpmBin(), [
    '--filter', DEPLOY_ROOT_PACKAGE,
    'deploy', '--legacy', '--prod',
    '--config.node-linker=hoisted',
    '--config.auto-install-peers=false',
    '--config.link-workspace-packages=true',
    DEST_DIR,
  ], { cwd: REPO_ROOT })

  console.log('[bundle-dsh] Staging CLI lib, config, and package.json...')
  cpSync(cliLib, join(DEST_DIR, 'lib'), { recursive: true })
  const cliConfig = join(REPO_ROOT, 'apps/cli/config')
  if (existsSync(cliConfig)) cpSync(cliConfig, join(DEST_DIR, 'config'), { recursive: true })
  cpSync(join(REPO_ROOT, 'apps/cli/package.json'), join(DEST_DIR, 'package.json'))

  materializeLinks(join(DEST_DIR, 'node_modules'))

  console.log(`[bundle-dsh] Rebuilding native addons for Electron ${ELECTRON_VERSION}...`)
  run(join(ROOT_DIR, 'node_modules', '.bin', process.platform === 'win32' ? 'electron-rebuild.CMD' : 'electron-rebuild'), [
    '--force', '--version', ELECTRON_VERSION, '--module-dir', DEST_DIR,
  ], { cwd: ROOT_DIR })

  verifyBundle()
  const sizeMB = (statSync(DEST_DIR).size / 1024 / 1024).toFixed(2)
  console.log(`[bundle-dsh] ✅ dsh bundled to: ${DEST_DIR} (${sizeMB} MB)`)
}

main()

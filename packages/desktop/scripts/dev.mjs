/**
 * DeepSeek Harness Desktop - Development Script
 *
 * 启动 Electron 桌面应用 (开发模式):
 * 1. 检测 dsh web 是否已在运行
 * 2. 如果未运行，尝试启动
 * 3. 编译 TypeScript
 * 4. 启动 Electron
 *
 * 用法:
 *   pnpm run dev                  # 自动检测并启动 dsh web
 *   pnpm run dev -- --external    # 使用已运行的 dsh web 实例
 *   pnpm run dev -- --port 3081   # 指定端口
 *   pnpm run dev -- --debug       # 启用远程调试
 */

import { spawn } from 'child_process'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createInterface } from 'readline'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const ROOT_DIR = join(__dirname, '..')
const REPO_ROOT = join(ROOT_DIR, '../..')

/** 解析命令行参数 */
const args = process.argv.slice(2)
const useExternalDsh = args.includes('--external')
const debugMode = args.includes('--debug')
const portArg = args.find((_, i, a) => a[i - 1] === '--port')
// 开发版默认 3081，避免与安装版 3080 冲突
const DSH_PORT = portArg ? parseInt(portArg, 10) : 3081

/**
 * 检查端口是否被占用
 */
async function isPortInUse(port) {
  const net = await import('net')
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(true))
    server.once('listening', () => { server.close(); resolve(false) })
    server.listen(port, '127.0.0.1')
  })
}

/**
 * 检测是否已有 dsh web 进程在运行 (不仅仅是端口占用)
 */
async function isDshWebRunning(port) {
  if (!(await isPortInUse(port))) return false
  // 端口被占用，尝试 HTTP 健康检查
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000)
    })
    return resp.ok || resp.status < 500
  } catch {
    return false
  }
}

/**
 * 等待 dsh web 就绪 (带超时)
 */
async function waitForDshWeb(port, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await isDshWebRunning(port)) return true
    await new Promise(r => setTimeout(r, 500))
  }
  return false
}

// ===== 主流程 =====

console.log('╔════════════════════════════════════════════════════════════╗')
console.log('║         DeepSeek Harness Desktop - Development Mode       ║')
console.log('╚════════════════════════════════════════════════════════════╝')
console.log('')

/** Step 1: 确保 dist 目录存在 */
const distDir = join(ROOT_DIR, 'dist')
if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true })
}

/** Step 2: 检测/启动 dsh web */
let dshProcess = null

// 检测安装版是否在运行（端口 3080）
const installedRunning = await isDshWebRunning(3080)
if (installedRunning) {
  console.log('[dev] ℹ️  检测到安装版 DeepSeek Harness 正在运行 (端口 3080)')
  console.log('[dev]    开发版将使用端口 3081，两者独立运行互不影响')
  console.log('')
}

const dshRunning = await isDshWebRunning(DSH_PORT)

if (dshRunning) {
  console.log(`[dev] ✅ dsh web 已在运行 (端口 ${DSH_PORT})`)
} else if (useExternalDsh) {
  console.log(`[dev] ⚠️  端口 ${DSH_PORT} 未被占用，但使用了 --external 参数`)
  console.log(`[dev]    请先手动启动 dsh web: pnpm dsh web --port ${DSH_PORT}`)
  console.log('[dev]    等待 10 秒后继续...')
  await new Promise(r => setTimeout(r, 10000))
} else {
  console.log(`[dev] 🚀 启动 dsh web (端口 ${DSH_PORT})...`)

  // 开发版独立 DSH_HOME。首启需冷初始化 profiles（Windows junction 冷启动可达
  // 数十秒），因此不在此处清空缓存——只有显式 `--reset-profiles` 才清理，
  // 否则每次 dev 都会退化回冷启动并轻易超过就绪等待。
  const devDshHome = join(process.env.USERPROFILE || process.env.HOME || '', '.dsh-dev')
  if (args.includes('--reset-profiles')) {
    const profilesDir = join(devDshHome, 'profiles')
    const nodeModulesDir = join(profilesDir, 'node_modules')
    if (existsSync(nodeModulesDir)) {
      console.log('[dev] 清理 profiles/node_modules...')
      const { rmSync } = await import('fs')
      rmSync(nodeModulesDir, { recursive: true, force: true })
      console.log('[dev] 已清理')
    }
  }

  // Source-launch the CLI exactly like `pnpm dsh` (tsx ESM hook): the built
  // `apps/cli/lib/bin.js` may be stale or absent on a source checkout, and the
  // web-app bundle prefers the Reasonix skin dist over the official shell.
  // 数据目录使用默认 DSH_HOME（~/.dsh），与 7890 后端共享会话与模型配置，
  // 否则桌面端会看到空会话、模型未加载。
  const dshPath = join(REPO_ROOT, 'apps/cli/src/bin.ts')

  dshProcess = spawn(process.execPath, ['--import', 'tsx/esm', dshPath, 'web', '--port', String(DSH_PORT)], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    }
  })

  // 收集输出用于调试
  let output = ''
  dshProcess.stdout?.on('data', (data) => { output += data.toString() })
  dshProcess.stderr?.on('data', (data) => {
    const text = data.toString()
    output += text
    // 实时显示错误
    if (text.includes('Error') || text.includes('error')) {
      console.error(`[dsh] ${text.trim()}`)
    }
  })

  // 等待启动或检测失败。冷启动（首次 profiles 初始化）需要更久，超时放宽到
  // 90 秒；仍失败时给出可重试的提示（第二次为热启动，通常数秒即就绪）。
  const started = await Promise.race([
    waitForDshWeb(DSH_PORT, 90000).then(ok => ok ? 'success' : 'timeout'),
    new Promise(resolve => {
      dshProcess.on('exit', (code) => resolve(`exit:${code}`))
    })
  ])

  if (started === 'success') {
    console.log(`[dev] ✅ dsh web 启动成功 (端口 ${DSH_PORT})`)
  } else {
    console.error(`[dev] ❌ dsh web 启动失败 (${started})`)
    console.error('[dev] 请先在另一个终端运行: pnpm dsh web')
    console.error('[dev] 或使用 --external 参数: pnpm run dev -- --external')
    if (dshProcess) dshProcess.kill()
    process.exit(1)
  }
}

/** Step 3: 编译 TypeScript */
console.log('[dev] 编译 TypeScript...')

const tsc = spawn(process.execPath, [
  join(REPO_ROOT, 'node_modules/typescript/bin/tsc')
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: ROOT_DIR
})

await new Promise(resolve => tsc.on('exit', resolve))

if (tsc.exitCode !== 0) {
  console.error('[dev] ❌ TypeScript 编译失败')
  process.exit(1)
}

console.log('[dev] ✅ TypeScript 编译成功')

// 编译 preload 脚本 (CommonJS)
const tscPreload = spawn(process.execPath, [
  join(REPO_ROOT, 'node_modules/typescript/bin/tsc'),
  '-p', 'tsconfig.preload.json'
], {
  stdio: ['pipe', 'pipe', 'pipe'],
  cwd: ROOT_DIR
})

await new Promise(resolve => tscPreload.on('exit', resolve))
console.log('[dev] ✅ Preload 编译完成')

/** Step 4: 启动 Electron */
console.log('')
console.log('[dev] 🖥️  启动 Electron...')
console.log('')

const electronArgs = [join(ROOT_DIR, 'dist/main/index.js')]

if (debugMode) {
  electronArgs.push('--remote-debugging-port=9222')
  console.log('[dev] 🔍 远程调试已启用: chrome://inspect')
}

// Locate the installed Electron executable. Resolve the installed tree
// directly instead of trusting the declared version string, which can drift
// from the version the lockfile actually resolved.
function findElectronExe(root) {
  const pnpmDir = join(root, 'node_modules/.pnpm')
  if (!existsSync(pnpmDir)) return undefined
  let names
  try { names = readdirSync(pnpmDir) } catch { return undefined }
  const exeName = process.platform === 'win32' ? 'electron.exe' : 'electron'
  for (const name of names.filter((n) => n.startsWith('electron@')).sort().reverse()) {
    const candidate = join(pnpmDir, name, 'node_modules/electron/dist', exeName)
    if (existsSync(candidate)) return candidate
  }
  return undefined
}

const electronPath = findElectronExe(ROOT_DIR) ?? findElectronExe(REPO_ROOT)
if (!electronPath) {
  console.error('[dev] ❌ electron.exe not found. Run `pnpm install` in the repo root first.')
  process.exit(1)
}

const electron = spawn(electronPath, electronArgs, {
  stdio: 'inherit',
  cwd: ROOT_DIR,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    DSH_HOME: join(process.env.USERPROFILE || process.env.HOME || '', '.dsh-dev'),
    DSH_PORT: String(DSH_PORT),
    ELECTRON_ENABLE_LOGGING: '1'
  }
})

/** 处理 Electron 退出 */
electron.on('exit', (code) => {
  console.log(`[dev] Electron 退出 (code: ${code})`)
  if (dshProcess) dshProcess.kill()
  process.exit(code ?? 0)
})

/** 处理进程终止 */
function shutdown() {
  console.log('[dev] 正在关闭...')
  electron.kill()
  if (dshProcess) dshProcess.kill()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('[dev] 按 Ctrl+C 停止')
console.log('')

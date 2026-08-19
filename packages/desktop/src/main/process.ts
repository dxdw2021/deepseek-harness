/**
 * DeepSeek Harness Desktop - dsh web Process Management
 *
 * Manages the dsh web subprocess lifecycle:
 * - Start dsh web and capture the port
 * - Monitor process health
 * - Graceful shutdown
 * - Auto-restart on crash
 */

import { spawn, spawnSync, ChildProcess } from 'child_process'
import { join, dirname, delimiter } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { app } from 'electron'

/** Process state */
let dshProcess: ChildProcess | null = null
let currentPort = 0
let restartCount = 0
const MAX_RESTARTS = 3
// First launch on a fresh home pays the cold profile-init cost: healProfilesModuleFallback
// creates ~500 Windows junctions for the flat closure. Under Electron-as-node this is
// junction-by-junction slow on AV-guarded Windows hosts (~5min measured), so the timeout
// must tolerate the one-time cold boot; the persistent home makes every later boot warm
// (a few seconds, since the junctions are only verified, not recreated).
const STARTUP_TIMEOUT_MS = 600000

/** Start options of the latest invocation, reused by the auto-restart path. */
export interface StartDshWebOptions {
  /**
   * Called when an unexpected dsh web exit was restarted onto a new port, so
   * the window can follow the new URL instead of pointing at a dead server.
   */
  onRestart?: (port: number) => void
}
let startOptions: StartDshWebOptions = {}

/** __dirname equivalent for ES modules */
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Extract the bundled dsh runtime archive (resources/dsh-runtime.zip) into the
 * user-data dir once per shipped archive. Shipping one archive instead of
 * 32k loose files keeps the installer small and install near-instant; the
 * one-time extraction is reflected on the boot page. The marker file records
 * the archive size+mtime so a runtime update re-extracts.
 * @returns the extracted runtime directory.
 */
function ensureRuntimeExtracted(): string {
  const resourcesPath = process.resourcesPath ?? join(__dirname, '../../..')
  const archive = join(resourcesPath, 'dsh-runtime.zip')
  if (!existsSync(archive)) {
    throw new Error(`dsh runtime archive not found at ${archive}. Reinstall the app.`)
  }
  const runtimeDir = join(app.getPath('userData'), 'dsh-runtime')
  const marker = join(runtimeDir, '.dsh-runtime.marker')
  const archiveStat = statSync(archive)
  const expected = `${archiveStat.size}-${archiveStat.mtimeMs}`
  try {
    if (readFileSync(marker, 'utf8') === expected && existsSync(join(runtimeDir, 'lib', 'bin.js'))) {
      return runtimeDir
    }
  } catch { /* first run or marker mismatch: extract below */ }
  console.log('[dsh-process] Extracting dsh runtime...')
  rmSync(runtimeDir, { recursive: true, force: true })
  mkdirSync(runtimeDir, { recursive: true })
  const result = spawnSync('tar', ['-xf', archive, '-C', runtimeDir], { windowsHide: true })
  if (result.error !== undefined || result.status !== 0) {
    throw new Error(`failed to extract dsh runtime: ${String(result.error?.message ?? `exit ${result.status}`)}`)
  }
  writeFileSync(marker, expected, 'utf8')
  return runtimeDir
}

/**
 * Find the dsh executable path.
 * - Development: uses pnpm to run dsh from the repository
 * - Production: the bundled dsh runtime, extracted from the shipped archive
 */
function resolveDshPath(): string {
  const isDev = process.env.NODE_ENV === 'development'
  const exeName = process.platform === 'win32' ? 'dsh.exe' : 'dsh'

  if (isDev) {
    // Development: use apps/cli/lib/bin.js directly
    const repoRoot = join(__dirname, '../../../..')
    const binPath = join(repoRoot, 'apps/cli/lib/bin.js')

    if (existsSync(binPath)) {
      console.log(`[dsh-process] Using dsh bin: ${binPath}`)
      // Return as array to indicate it needs node
      return `node:${binPath}`
    }

    // Fallback
    const fallback = join(repoRoot, 'node_modules/.bin', process.platform === 'win32' ? 'dsh.cmd' : 'dsh')
    console.log(`[dsh-process] Using fallback dsh path: ${fallback}`)
    return fallback
  }

  // Production: the shipped runtime archive, extracted into the user-data dir.
  const resourcesPath = process.resourcesPath ?? join(__dirname, '../../..')
  const archive = join(resourcesPath, 'dsh-runtime.zip')
  if (existsSync(archive)) {
    const runtimeDir = ensureRuntimeExtracted()
    const extractedEntry = join(runtimeDir, 'lib', 'bin.js')
    console.log(`[dsh-process] Using extracted dsh node entry: ${extractedEntry}`)
    return `node:${extractedEntry}`
  }

  // Legacy loose tree fallback for installations built before the archive
  // layout: run the bundled dsh tree under the current executable.
  const bundledBinJs = join(resourcesPath, 'dsh', 'lib', 'bin.js')
  if (existsSync(bundledBinJs)) {
    console.log(`[dsh-process] Using bundled dsh node entry: ${bundledBinJs}`)
    return `node:${bundledBinJs}`
  }

  // Fallback to resources root
  const fallbackPath = join(resourcesPath, exeName)
  console.log(`[dsh-process] Using fallback dsh path: ${fallbackPath}`)
  return fallbackPath
}

/**
 * Parse the port number from dsh web stdout.
 * dsh web outputs: "dsh web: http://127.0.0.1:3080"
 */
function parsePortFromOutput(output: string): number | null {
  const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/)
  if (match) {
    return parseInt(match[1], 10)
  }
  return null
}

/**
 * Resolve the node command that runs the dsh web child.
 *
 * The dsh runtime is a plain Node program; the desktop bundles a Node with the
 * installer (resources/node) so a production install never depends on a system
 * Node or on the Electron-as-node fallback: koffi's FFI (directory picker,
 * Windows-ACL sandbox, fs/session Win32 helpers) is unreliable under
 * Electron-as-node, and its lstat/junction handling breaks profile boot.
 * Precedence: `DSH_RUNTIME_NODE` pins the command and always wins; then the
 * bundled Node; then a real Node on PATH that meets the runtime's floor
 * (>= 22.6, which the code-runtime worker needs for `node:module`
 * `stripTypeScriptTypes`); Electron-as-node remains the fallback for unusual
 * layouts that ship neither.
 */
function resolveNodeCommand(): string {
  const pinned = process.env.DSH_RUNTIME_NODE
  if (pinned !== undefined && pinned !== '') return pinned
  const exe = process.platform === 'win32' ? 'node.exe' : 'node'
  if (app.isPackaged) {
    const bundled = join(process.resourcesPath, 'node', exe)
    if (existsSync(bundled)) {
      const version = spawnSync(bundled, ['--version'], { windowsHide: true }).stdout?.toString() ?? ''
      if (/^v(\d+)\./.exec(version) !== null) {
        console.log(`[dsh-process] Using bundled node ${version.trim()}`)
        return bundled
      }
    }
  }
  for (const dir of (process.env.PATH ?? '').split(delimiter)) {
    if (dir === '') continue
    const candidate = join(dir, exe)
    if (!existsSync(candidate)) continue
    const version = spawnSync(candidate, ['--version'], { windowsHide: true }).stdout?.toString() ?? ''
    const match = /^v(\d+)\.(\d+)/.exec(version)
    const major = match?.[1] === undefined ? 0 : Number(match[1])
    const minor = match?.[2] === undefined ? 0 : Number(match[2])
    if (major > 22 || (major === 22 && minor >= 6)) return candidate
  }
  return process.execPath
}

/**
 * Start dsh web subprocess and wait for it to be ready.
 * @param options - start options; the auto-restart path reuses them.
 * @returns The port number dsh web is listening on.
 */
export async function startDshWeb(options: StartDshWebOptions = {}): Promise<number> {
  startOptions = options

  // Check if dsh web is already running on common ports
  const net = await import('net')
  for (const port of [3080, 3081, 3082]) {
    const inUse = await new Promise<boolean>((resolve) => {
      const server = net.createServer()
      server.once('error', () => resolve(true))
      server.once('listening', () => { server.close(); resolve(false) })
      server.listen(port, '127.0.0.1')
    })
    if (inUse) {
      console.log(`[dsh-process] dsh web already running on port ${port}`)
      currentPort = port
      return port
    }
  }

  // No existing instance found - try to start one
  const dshPath = resolveDshPath()

  // Check if it needs node
  const needsNode = dshPath.startsWith('node:')
  const actualPath = needsNode ? dshPath.slice(5) : dshPath

  // Verify dsh exists
  if (!needsNode && !existsSync(actualPath)) {
    throw new Error(
      `dsh executable not found at ${actualPath}. ` +
      'Ensure the harness is built and installed.',
    )
  }

  console.log(`[dsh-process] Starting dsh from: ${actualPath}`)
  console.log(`[dsh-process] dsh node runtime: ${needsNode ? resolveNodeCommand() : actualPath}`)

  return new Promise((resolve, reject) => {
    // One settle per invocation: port detection, early exit, spawn error, and
    // the startup timeout can otherwise resolve and reject the same promise
    // in a race.
    let settled = false
    const settle = (action: () => void): void => {
      if (settled) return
      settled = true
      action()
    }

    // Start dsh web with port 0 (OS-assigned) to avoid conflicts. The dsh
    // runtime activates its internal module loader (and with it the HMR service)
    // only when launched with --expose-internals, exactly as the CLI launcher does.
    const args = needsNode
      ? ['--expose-internals', actualPath, 'web', '--port', '0']
      : ['web', '--port', '0']
    // Real Node when available, Electron-as-node otherwise (see resolveNodeCommand).
    const command = needsNode ? resolveNodeCommand() : actualPath
    const usesElectronNode = needsNode && command === process.execPath

    // 生产模式下，设置 NODE_PATH 让 Electron-as-Node 能找到 bundled 依赖
    const dshDir = needsNode ? join(dirname(actualPath), '..') : dirname(actualPath)
    const nodeModulesDir = join(dshDir, 'node_modules')

    // 使用持久化 DSH_HOME（默认 ~/.dsh，与 CLI 一致）：保留 settings/sessions，
    // 且 profile 只初始化一次，后续启动走热路径（~2.6s）而不是每次冷启动（~17s）。
    // healProfilesModuleFallback 用 Windows junction 建 profiles/node_modules 链接，
    // 无需管理员权限，打包环境也能创建，因此不再需要临时目录。
    const dshEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: 'production',
    }
    if (needsNode) {
      if (usesElectronNode) dshEnv.ELECTRON_RUN_AS_NODE = '1'
      dshEnv.NODE_PATH = nodeModulesDir
    }

    const child = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: dshDir,
      env: dshEnv,
    })

    dshProcess = child
    let portFound = false
    let startupOutput = ''

    // Handle stdout (port detection)
    child.stdout?.on('data', (data: Buffer) => {
      const text = data.toString()
      startupOutput += text
      console.log(`[dsh-process] stdout: ${text.trim()}`)

      // Try to parse port
      if (!portFound) {
        const port = parsePortFromOutput(startupOutput)
        if (port !== null) {
          portFound = true
          currentPort = port
          restartCount = 0
          settle(() => resolve(port))
        }
      }
    })

    // Handle stderr (error detection)
    child.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      console.error(`[dsh-process] stderr: ${text.trim()}`)
      // 如果是启动错误，直接 reject
      if (!portFound && (text.includes('Error:') || text.includes('error'))) {
        startupOutput += text
      }
    })

    // Handle process exit
    child.on('exit', (code, signal) => {
      console.log(`[dsh-process] Exited with code ${code}, signal ${signal}`)
      dshProcess = null

      if (!portFound) {
        // Process exited before port was detected
        settle(() => reject(new Error(
          `dsh web exited before starting. Exit code: ${code}, Signal: ${signal}\n` +
          `Output: ${startupOutput}`,
        )))
      } else if (!state?.isQuitting) {
        // Unexpected exit - attempt restart
        console.log('[dsh-process] Unexpected exit, attempting restart...')
        attemptRestart()
      }
    })

    // Handle spawn errors
    child.on('error', (error) => {
      console.error('[dsh-process] Spawn error:', error)
      dshProcess = null
      if (!portFound) {
        settle(() => reject(error))
      }
    })

    // Timeout if startup takes too long
    const timeout = setTimeout(() => {
      if (!portFound) {
        child.kill('SIGTERM')
        settle(() => reject(new Error(
          `dsh web failed to start within ${STARTUP_TIMEOUT_MS}ms\n` +
          `Output: ${startupOutput}`,
        )))
      }
    }, STARTUP_TIMEOUT_MS)

    // Clear timeout on exit
    child.once('exit', () => clearTimeout(timeout))
  })
}

/**
 * Attempt to restart dsh web after unexpected exit, reusing the latest start
 * options so the caller's `onRestart` hook keeps receiving new ports.
 */
function attemptRestart(): void {
  if (restartCount >= MAX_RESTARTS) {
    console.error('[dsh-process] Max restart attempts reached, giving up')
    return
  }

  restartCount++
  console.log(`[dsh-process] Restart attempt ${restartCount}/${MAX_RESTARTS}`)

  setTimeout(() => {
    startDshWeb(startOptions).then((port) => {
      console.log(`[dsh-process] Restart successful on port ${port}`)
      restartCount = 0 // Reset on success
      startOptions.onRestart?.(port)
    }).catch((error) => {
      console.error('[dsh-process] Restart failed:', error)
    })
  }, 2000) // Wait 2 seconds before restart
}

/**
 * Stop dsh web subprocess gracefully.
 */
export async function stopDshWeb(): Promise<void> {
  if (!dshProcess) {
    console.log('[dsh-process] No dsh process to stop')
    return
  }

  console.log('[dsh-process] Stopping dsh web...')

  return new Promise((resolve) => {
    const child = dshProcess!

    // One settle, whichever of graceful exit or the force kill lands last.
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      dshProcess = null
      resolve()
    }

    child.on('exit', () => {
      console.log('[dsh-process] dsh web stopped')
      finish()
    })

    // Send SIGTERM for graceful shutdown
    child.kill('SIGTERM')

    // Force kill after 5 seconds if graceful shutdown fails
    setTimeout(() => {
      if (!settled) {
        console.log('[dsh-process] Force killing dsh web...')
        child.kill('SIGKILL')
        finish()
      }
    }, 5000)
  })
}

/**
 * Get the current dsh web port.
 */
export function getDshPort(): number {
  return currentPort
}

/**
 * Check if dsh web is running.
 */
export function isDshRunning(): boolean {
  return dshProcess !== null && !dshProcess.killed
}

/**
 * Access to state for quit detection.
 * This is a workaround for the process module to know when the app is quitting.
 */
let state: { isQuitting: boolean } | null = null

export function setProcessState(appState: { isQuitting: boolean }): void {
  state = appState
}

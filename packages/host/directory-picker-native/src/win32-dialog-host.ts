/**
 * Real-process half of the Win32 dialog driver: spawn the dialog child
 * process (source or built plane) and close a dialog thread's windows. The
 * module itself loads everywhere (the import chain from native-picker.ts is
 * static); what stays win32-only is koffi, imported dynamically inside the
 * bindings' functions. The driver's logic is tested against fakes of this
 * surface instead.
 */

import { spawn, type StdioOptions } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { basename, delimiter, join } from 'node:path'
import type { Win32DialogWorkerData } from './win32-dialog-worker.ts'

/**
 * The node command the dialog worker runs under. The worker is a plain Node
 * script whose only native dependency is koffi (N-API), and koffi FFI is
 * unreliable under Electron-as-node (intermittent `napi_get_last_error_info`
 * aborts in the packaged desktop). Prefer a real Node when one is available;
 * `process.execPath` is only the fallback runtime for hosts that ship no node.
 * `DSH_WORKER_NODE` pins the command explicitly and always wins.
 */
function resolveWorkerNode(): string {
  const pinned = process.env.DSH_WORKER_NODE
  if (pinned !== undefined && pinned !== '') return pinned
  const execName = basename(process.execPath).toLowerCase()
  const isElectronFallback = execName !== 'node' && execName !== 'node.exe'
  if (isElectronFallback) {
    const exe = 'node' + (process.platform === 'win32' ? '.exe' : '')
    for (const dir of (process.env.PATH ?? '').split(delimiter)) {
      if (dir === '') continue
      const candidate = join(dir, exe)
      if (existsSync(candidate)) return candidate
    }
  }
  return process.execPath
}

/**
 * Spawn the dialog child process. Built consumers launch the bundled CJS
 * entry next to this module under plain node; unbuilt (source) consumers
 * bootstrap tsx first, mirroring the dsh CLI's source launch. The dialog is
 * the child's first window, so Windows activates it without a foreground
 * call.
 * @param data - the child payload (dialog title).
 * @returns the spawned child process.
 */
export function spawnDialogWorker(data: Win32DialogWorkerData): ReturnType<typeof spawn> {
  const env = { ...process.env, DSH_DIALOG_TITLE: data.title }
  const stdio: StdioOptions = ['ignore', 'inherit', 'inherit', 'ipc']
  /* v8 ignore next 3 -- the built-output arm: tests always run unbuilt (src/) */
  if (!import.meta.url.endsWith('.ts')) {
    return spawn(resolveWorkerNode(), [fileURLToPath(new URL('./worker.cjs', import.meta.url))], { env, stdio, windowsHide: true })
  }
  return spawn(process.execPath, ['--import', import.meta.resolve('tsx/esm'), fileURLToPath(new URL('./win32-dialog-worker.ts', import.meta.url))], { env, stdio, windowsHide: true })
}

export { closeThreadWindows } from './win32-dialog-bindings.ts'

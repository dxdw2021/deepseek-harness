/**
 * DeepSeek Harness Desktop - File Logger
 *
 * A packaged GUI app on Windows has no attached console, so main-process
 * output would be invisible on a double-click launch. Every console call is
 * mirrored to <userData>/logs/main.log so first-launch failures can be
 * diagnosed on the target machine. Logging never takes the app down.
 */

import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { inspect } from 'node:util'

let logDir: string | null = null

function formatArg(arg: unknown): string {
  if (typeof arg === 'string') return arg
  return inspect(arg, { depth: 4, breakLength: 120 })
}

function write(level: 'log' | 'warn' | 'error', args: unknown[]): void {
  const line = `[${new Date().toISOString()}] [${level}] ${args.map(formatArg).join(' ')}\n`
  try {
    if (logDir === null) {
      logDir = join(app.getPath('userData'), 'logs')
      mkdirSync(logDir, { recursive: true })
    }
    appendFileSync(join(logDir, 'main.log'), line)
  } catch {
    // The logger must never take the app down.
  }
}

/** Path of the main-process log file. */
export function getMainLogPath(): string {
  if (logDir !== null) return join(logDir, 'main.log')
  return join(app.getPath('userData'), 'logs', 'main.log')
}

/** Mirror console output to the log file; called once at startup. */
export function installFileLogging(): void {
  const original = { log: console.log, warn: console.warn, error: console.error }
  console.log = (...args: unknown[]) => {
    write('log', args)
    original.log(...args)
  }
  console.warn = (...args: unknown[]) => {
    write('warn', args)
    original.warn(...args)
  }
  console.error = (...args: unknown[]) => {
    write('error', args)
    original.error(...args)
  }
}

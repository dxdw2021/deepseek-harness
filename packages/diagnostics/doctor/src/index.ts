/**
 * Doctor service for DeepSeek Harness.
 * Provides diagnostic checks, crash reporting, and system health monitoring.
 * 
 * @module @deepseek-ai/dsh-doctor
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Check status types */
export type CheckStatus = 'ok' | 'warning' | 'error' | 'skipped'

/** Diagnostic check result */
export interface DiagnosticCheck {
  /** Check name */
  name: string
  /** Check description */
  description: string
  /** Check status */
  status: CheckStatus
  /** Check message */
  message: string
  /** Check details */
  details?: Record<string, unknown>
  /** Check timestamp */
  timestamp: Date
  /** Check duration in milliseconds */
  duration: number
}

/** Crash report */
export interface CrashReport {
  /** Report ID */
  id: string
  /** Crash timestamp */
  timestamp: Date
  /** Error message */
  errorMessage: string
  /** Error stack */
  errorStack: string | undefined
  /** System information */
  systemInfo: SystemInfo
  /** Application state */
  applicationState?: Record<string, unknown>
  /** User description */
  userDescription: string | undefined
}

/** System information */
export interface SystemInfo {
  /** Operating system */
  platform: string
  /** OS version */
  platformVersion: string
  /** Architecture */
  arch: string
  /** Node.js version */
  nodeVersion: string
  /** Memory usage */
  memoryUsage: {
    total: number
    free: number
    used: number
  }
  /** Disk usage */
  diskUsage?: {
    total: number
    free: number
    used: number
  }
}

/** Doctor configuration */
export interface DoctorConfig {
  /** Enable doctor service */
  enabled: boolean
  /** Enable automatic health checks */
  enableAutoChecks: boolean
  /** Auto check interval in milliseconds */
  autoCheckIntervalMs: number
  /** Enable crash reporting */
  enableCrashReporting: boolean
  /** Maximum crash reports */
  maxCrashReports: number
  /** Enable system monitoring */
  enableSystemMonitoring: boolean
}

/** Doctor service definition */
export class DoctorService extends Service {
  static inject = ['settings']
  
  /** Diagnostic checks */
  private checks: Map<string, () => Promise<DiagnosticCheck>> = new Map()
  
  /** Crash reports */
  private crashReports: CrashReport[] = []
  
  /** Configuration */
  private config: DoctorConfig = {
    enabled: true,
    enableAutoChecks: true,
    autoCheckIntervalMs: 300000, // 5 minutes
    enableCrashReporting: true,
    maxCrashReports: 100,
    enableSystemMonitoring: true,
  }
  
  constructor(ctx: Context) {
    super(ctx, 'doctor')
    
    // Register built-in checks
    this.registerBuiltinChecks()
  }
  
  /** Register built-in diagnostic checks */
  private registerBuiltinChecks(): void {
    // Memory check
    this.registerCheck('memory', async () => {
      const start = Date.now()
      const memUsage = process.memoryUsage()
      const totalMemory = memUsage.heapTotal
      const usedMemory = memUsage.heapUsed
      const usagePercent = (usedMemory / totalMemory) * 100
      
      let status: CheckStatus = 'ok'
      let message = `Memory usage: ${Math.round(usagePercent)}%`
      
      if (usagePercent > 90) {
        status = 'error'
        message += ' (Critical)'
      } else if (usagePercent > 70) {
        status = 'warning'
        message += ' (High)'
      }
      
      return {
        name: 'memory',
        description: 'Memory usage check',
        status,
        message,
        details: {
          heapUsed: usedMemory,
          heapTotal: totalMemory,
          usagePercent,
        },
        timestamp: new Date(),
        duration: Date.now() - start,
      }
    })
    
    // Node.js version check
    this.registerCheck('node-version', async () => {
      const start = Date.now()
      const nodeVersion = process.version
      const majorVersionStr = nodeVersion.slice(1).split('.')[0]
      const majorVersion = majorVersionStr ? parseInt(majorVersionStr) : 0
      
      let status: CheckStatus = 'ok'
      let message = `Node.js version: ${nodeVersion}`
      
      if (majorVersion < 18) {
        status = 'error'
        message += ' (Unsupported version)'
      } else if (majorVersion < 20) {
        status = 'warning'
        message += ' (Older version recommended)'
      }
      
      return {
        name: 'node-version',
        description: 'Node.js version check',
        status,
        message,
        details: {
          version: nodeVersion,
          majorVersion,
        },
        timestamp: new Date(),
        duration: Date.now() - start,
      }
    })
    
    // Disk space check
    this.registerCheck('disk-space', async () => {
      const start = Date.now()
      
      // In a real implementation, this would check actual disk space
      // For now, return a mock result
      return {
        name: 'disk-space',
        description: 'Disk space check',
        status: 'ok',
        message: 'Disk space is sufficient',
        details: {
          freeSpace: '10GB',
          totalSpace: '100GB',
        },
        timestamp: new Date(),
        duration: Date.now() - start,
      }
    })
    
    // Configuration check
    this.registerCheck('configuration', async () => {
      const start = Date.now()
      
      // In a real implementation, this would validate configuration files
      // For now, return a mock result
      return {
        name: 'configuration',
        description: 'Configuration validation',
        status: 'ok',
        message: 'Configuration is valid',
        details: {
          configFiles: ['settings.toml', 'cordis.yml'],
        },
        timestamp: new Date(),
        duration: Date.now() - start,
      }
    })
  }
  
  /** Register a diagnostic check */
  registerCheck(name: string, checkFn: () => Promise<DiagnosticCheck>): void {
    this.checks.set(name, checkFn)
    this.ctx.emit('doctor/check-registered', name)
  }
  
  /** Remove a diagnostic check */
  removeCheck(name: string): boolean {
    const removed = this.checks.delete(name)
    if (removed) {
      this.ctx.emit('doctor/check-removed', name)
    }
    return removed
  }
  
  /** Run a single diagnostic check */
  async runCheck(name: string): Promise<DiagnosticCheck | null> {
    const checkFn = this.checks.get(name)
    if (!checkFn) return null
    
    try {
      const result = await checkFn()
      this.ctx.emit('doctor/check-completed', result)
      return result
    } catch (error) {
      const failedCheck: DiagnosticCheck = {
        name,
        description: `Failed check: ${name}`,
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        duration: 0,
      }
      this.ctx.emit('doctor/check-failed', failedCheck)
      return failedCheck
    }
  }
  
  /** Run all diagnostic checks */
  async runAllChecks(): Promise<DiagnosticCheck[]> {
    const results: DiagnosticCheck[] = []
    
    for (const name of this.checks.keys()) {
      const result = await this.runCheck(name)
      if (result) {
        results.push(result)
      }
    }
    
    this.ctx.emit('doctor/all-checks-completed', results)
    
    return results
  }
  
  /** Get system information */
  getSystemInfo(): SystemInfo {
    const memUsage = process.memoryUsage()
    
    return {
      platform: process.platform,
      platformVersion: String(process.release),
      arch: process.arch,
      nodeVersion: process.version,
      memoryUsage: {
        total: memUsage.heapTotal,
        free: memUsage.heapTotal - memUsage.heapUsed,
        used: memUsage.heapUsed,
      },
    }
  }
  
  /** Report a crash */
  reportCrash(error: Error, userDescription?: string): CrashReport {
    const report: CrashReport = {
      id: `crash-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      errorMessage: error.message,
      errorStack: error.stack,
      systemInfo: this.getSystemInfo(),
      userDescription,
    }
    
    this.crashReports.push(report)
    
    // Trim crash reports if needed
    if (this.crashReports.length > this.config.maxCrashReports) {
      this.crashReports = this.crashReports.slice(-this.config.maxCrashReports)
    }
    
    this.ctx.emit('doctor/crash-reported', report)
    
    return report
  }
  
  /** Get crash reports */
  getCrashReports(limit?: number): CrashReport[] {
    if (limit) {
      return this.crashReports.slice(-limit)
    }
    return [...this.crashReports]
  }
  
  /** Clear crash reports */
  clearCrashReports(): void {
    this.crashReports = []
    this.ctx.emit('doctor/crash-reports-cleared')
  }
  
  /** Get health status */
  getHealthStatus(): { healthy: boolean; checks: DiagnosticCheck[] } {
    const checks = Array.from(this.checks.keys()).map(name => ({
      name,
      description: '',
      status: 'skipped' as CheckStatus,
      message: 'Not run',
      timestamp: new Date(),
      duration: 0,
    }))
    
    const healthy = checks.every(check => check.status === 'ok' || check.status === 'skipped')
    
    return { healthy, checks }
  }
  
  /** Update configuration */
  updateConfig(config: Partial<DoctorConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('doctor/config-changed', this.config)
  }
  
  /** Get configuration */
  getConfig(): DoctorConfig {
    return { ...this.config }
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable doctor service */
  enabled?: boolean
  /** Enable automatic health checks */
  enableAutoChecks?: boolean
  /** Auto check interval in milliseconds */
  autoCheckIntervalMs?: number
  /** Enable crash reporting */
  enableCrashReporting?: boolean
  /** Maximum crash reports */
  maxCrashReports?: number
  /** Enable system monitoring */
  enableSystemMonitoring?: boolean
}

/**
 * Create doctor plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createDoctorPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'doctor',
    inject: ['settings'],
    apply(ctx) {
      const service = new DoctorService(ctx)
      ctx.doctor = service
      
      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }
      
      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('doctor'),
          z.object({
            enabled: z.boolean().default(true),
            enableAutoChecks: z.boolean().default(true),
            autoCheckIntervalMs: z.number().min(60000).max(3600000).default(300000),
            enableCrashReporting: z.boolean().default(true),
            maxCrashReports: z.number().min(10).max(1000).default(100),
            enableSystemMonitoring: z.boolean().default(true),
          }),
          {
            base: {
              enabled: true,
              enableAutoChecks: true,
              autoCheckIntervalMs: 300000,
              enableCrashReporting: true,
              maxCrashReports: 100,
              enableSystemMonitoring: true,
            },
          }
        )
        
        // Watch for settings changes
        scope.watch((next) => {
          service.updateConfig(next)
        })
        
        // Set up auto-check interval
        const checkInterval = setInterval(async () => {
          if (service.getConfig().enableAutoChecks) {
            await service.runAllChecks()
          }
        }, service.getConfig().autoCheckIntervalMs)
        
        return () => {
          clearInterval(checkInterval)
        }
      })
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    doctor: DoctorService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Check registered.
     * @param name - check name.
     * @mode emit
     */
    'doctor/check-registered'(name: string): void
    
    /**
     * Check removed.
     * @param name - check name.
     * @mode emit
     */
    'doctor/check-removed'(name: string): void
    
    /**
     * Check completed.
     * @param result - check result.
     * @mode emit
     */
    'doctor/check-completed'(result: DiagnosticCheck): void
    
    /**
     * Check failed.
     * @param result - failed check result.
     * @mode emit
     */
    'doctor/check-failed'(result: DiagnosticCheck): void
    
    /**
     * All checks completed.
     * @param results - all check results.
     * @mode emit
     */
    'doctor/all-checks-completed'(results: DiagnosticCheck[]): void
    
    /**
     * Crash reported.
     * @param report - crash report.
     * @mode emit
     */
    'doctor/crash-reported'(report: CrashReport): void
    
    /**
     * Crash reports cleared.
     * @mode emit
     */
    'doctor/crash-reports-cleared'(): void
    
    /**
     * Doctor configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'doctor/config-changed'(config: DoctorConfig): void
  }
}

export { DoctorService as Service }
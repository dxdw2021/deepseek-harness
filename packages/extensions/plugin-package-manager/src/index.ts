/**
 * Plugin package manager for DeepSeek Harness.
 * Provides plugin package management capabilities.
 *
 * @module @deepseek-ai/dsh-plugin-package-manager
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Plugin package status */
export type PluginPackageStatus = 'installed' | 'enabled' | 'disabled' | 'error'

/** Plugin package source */
export type PluginPackageSource = 'github' | 'npm' | 'local' | 'registry'

/** Plugin package type */
export type PluginPackageType =
  | 'skill'      // Skills
  | 'command'    // Commands
  | 'hook'       // Hooks
  | 'mcp'        // MCP servers
  | 'prompt'     // Prompts
  | 'theme'      // Themes
  | 'runtime'    // Runtime extensions

/** Plugin package definition */
export interface PluginPackage {
  /** Package name */
  name: string
  /** Package version */
  version: string
  /** Package description */
  description: string
  /** Package author */
  author: string
  /** Package license */
  license: string
  /** Package repository */
  repository?: string
  /** Package source */
  source: PluginPackageSource
  /** Package source URL */
  sourceUrl: string
  /** Package types */
  types: PluginPackageType[]
  /** Package dependencies */
  dependencies: string[]
  /** Package status */
  status: PluginPackageStatus
  /** Package configuration */
  config?: Record<string, unknown>
  /** Package metadata */
  metadata?: Record<string, unknown>
  /** Installation timestamp */
  installedAt: Date
  /** Last updated timestamp */
  updatedAt: Date
}

/** Plugin package installation options */
export interface PluginPackageInstallOptions {
  /** Package source */
  source: PluginPackageSource
  /** Package source URL or identifier */
  sourceUrl: string
  /** Enable package after installation */
  enable?: boolean
  /** Package configuration */
  config?: Record<string, unknown>
}

/** Plugin package manager configuration */
export interface PluginPackageManagerConfig {
  /** Enable plugin package manager */
  enabled: boolean
  /** Plugin packages directory */
  packagesDir: string
  /** Enable auto-updates */
  enableAutoUpdates: boolean
  /** Auto-update interval in milliseconds */
  autoUpdateIntervalMs: number
  /** Enable package validation */
  enableValidation: boolean
  /** Enable package sandboxing */
  enableSandboxing: boolean
  /** Maximum concurrent installations */
  maxConcurrentInstallations: number
}

/** Plugin package manager service definition */
export class PluginPackageManagerService extends Service {
  static inject = ['settings']

  /** Installed packages */
  private packages: Map<string, PluginPackage> = new Map()

  /** Configuration */
  private config: PluginPackageManagerConfig = {
    enabled: true,
    packagesDir: '~/.dsh/plugins',
    enableAutoUpdates: true,
    autoUpdateIntervalMs: 86400000, // 24 hours
    enableValidation: true,
    enableSandboxing: true,
    maxConcurrentInstallations: 3,
  }

  constructor(ctx: Context) {
    super(ctx, 'pluginPackageManager')
  }

  /** Install a plugin package */
  async install(options: PluginPackageInstallOptions): Promise<PluginPackage> {
    if (!this.config.enabled) {
      throw new Error('Plugin package manager is disabled')
    }

    // Check if already installed
    const existingPackage = this.findPackageBySource(options.sourceUrl)
    if (existingPackage) {
      throw new Error(`Package "${existingPackage.name}" is already installed`)
    }

    // Validate package
    if (this.config.enableValidation) {
      await this.validatePackage(options)
    }

    // Create package entry
    const packageEntry: PluginPackage = {
      name: this.extractPackageName(options.sourceUrl),
      version: '0.1.0',
      description: '',
      author: '',
      license: 'MIT',
      source: options.source,
      sourceUrl: options.sourceUrl,
      types: [],
      dependencies: [],
      status: options.enable !== false ? 'enabled' : 'disabled',
      config: options.config,
      installedAt: new Date(),
      updatedAt: new Date(),
    }

    // Install package
    await this.installPackage(packageEntry)

    // Store package
    this.packages.set(packageEntry.name, packageEntry)

    // Emit installation event
    this.ctx.emit('plugin-package-manager/package-installed', packageEntry)

    return packageEntry
  }

  /** Uninstall a plugin package */
  async uninstall(name: string): Promise<boolean> {
    const packageEntry = this.packages.get(name)
    if (!packageEntry) {
      return false
    }

    // Uninstall package
    await this.uninstallPackage(packageEntry)

    // Remove package
    this.packages.delete(name)

    // Emit uninstallation event
    this.ctx.emit('plugin-package-manager/package-uninstalled', packageEntry)

    return true
  }

  /** Enable a plugin package */
  async enable(name: string): Promise<boolean> {
    const packageEntry = this.packages.get(name)
    if (!packageEntry) {
      return false
    }

    if (packageEntry.status === 'enabled') {
      return true
    }

    // Enable package
    await this.enablePackage(packageEntry)

    // Update status
    packageEntry.status = 'enabled'
    packageEntry.updatedAt = new Date()

    // Emit enable event
    this.ctx.emit('plugin-package-manager/package-enabled', packageEntry)

    return true
  }

  /** Disable a plugin package */
  async disable(name: string): Promise<boolean> {
    const packageEntry = this.packages.get(name)
    if (!packageEntry) {
      return false
    }

    if (packageEntry.status === 'disabled') {
      return true
    }

    // Disable package
    await this.disablePackage(packageEntry)

    // Update status
    packageEntry.status = 'disabled'
    packageEntry.updatedAt = new Date()

    // Emit disable event
    this.ctx.emit('plugin-package-manager/package-disabled', packageEntry)

    return true
  }

  /** Get a plugin package by name */
  get(name: string): PluginPackage | undefined {
    return this.packages.get(name)
  }

  /** Get all installed packages */
  getAll(): PluginPackage[] {
    return Array.from(this.packages.values())
  }

  /** Get packages by type */
  getByType(type: PluginPackageType): PluginPackage[] {
    return Array.from(this.packages.values()).filter(pkg => pkg.types.includes(type))
  }

  /** Get packages by status */
  getByStatus(status: PluginPackageStatus): PluginPackage[] {
    return Array.from(this.packages.values()).filter(pkg => pkg.status === status)
  }

  /** Get enabled packages */
  getEnabledPackages(): PluginPackage[] {
    return this.getByStatus('enabled')
  }

  /** Update a plugin package */
  async update(name: string): Promise<PluginPackage | undefined> {
    const packageEntry = this.packages.get(name)
    if (!packageEntry) {
      return undefined
    }

    // Check for updates
    const hasUpdate = await this.checkForUpdate(packageEntry)
    if (!hasUpdate) {
      return packageEntry
    }

    // Update package
    await this.updatePackage(packageEntry)

    // Update metadata
    packageEntry.updatedAt = new Date()

    // Emit update event
    this.ctx.emit('plugin-package-manager/package-updated', packageEntry)

    return packageEntry
  }

  /** Check for updates for all packages */
  async checkForUpdates(): Promise<PluginPackage[]> {
    const updatedPackages: PluginPackage[] = []

    for (const packageEntry of this.packages.values()) {
      const hasUpdate = await this.checkForUpdate(packageEntry)
      if (hasUpdate) {
        updatedPackages.push(packageEntry)
      }
    }

    return updatedPackages
  }

  /** Update all packages */
  async updateAll(): Promise<PluginPackage[]> {
    const updatedPackages: PluginPackage[] = []

    for (const packageEntry of this.packages.values()) {
      try {
        const updated = await this.update(packageEntry.name)
        if (updated) {
          updatedPackages.push(updated)
        }
      } catch (error) {
        // Continue with other packages
      }
    }

    return updatedPackages
  }

  /** Search for packages */
  async search(query: string): Promise<PluginPackage[]> {
    // In a real implementation, this would search package registries
    // For now, return empty array
    return []
  }

  /** Validate a package */
  private async validatePackage(options: PluginPackageInstallOptions): Promise<void> {
    // In a real implementation, this would validate the package
    // For now, do nothing
  }

  /** Install package files */
  private async installPackage(packageEntry: PluginPackage): Promise<void> {
    // In a real implementation, this would download and install package files
    // For now, do nothing
  }

  /** Uninstall package files */
  private async uninstallPackage(packageEntry: PluginPackage): Promise<void> {
    // In a real implementation, this would remove package files
    // For now, do nothing
  }

  /** Enable package */
  private async enablePackage(packageEntry: PluginPackage): Promise<void> {
    // In a real implementation, this would enable the package
    // For now, do nothing
  }

  /** Disable package */
  private async disablePackage(packageEntry: PluginPackage): Promise<void> {
    // In a real implementation, this would disable the package
    // For now, do nothing
  }

  /** Check for package update */
  private async checkForUpdate(packageEntry: PluginPackage): Promise<boolean> {
    // In a real implementation, this would check for updates
    // For now, return false
    return false
  }

  /** Update package */
  private async updatePackage(packageEntry: PluginPackage): Promise<void> {
    // In a real implementation, this would update the package
    // For now, do nothing
  }

  /** Find package by source URL */
  private findPackageBySource(sourceUrl: string): PluginPackage | undefined {
    return Array.from(this.packages.values()).find(pkg => pkg.sourceUrl === sourceUrl)
  }

  /** Extract package name from source URL */
  private extractPackageName(sourceUrl: string): string {
    // Simple extraction - in real implementation would be more sophisticated
    const parts = sourceUrl.split('/')
    return parts[parts.length - 1] || 'unknown-package'
  }

  /** Update configuration */
  updateConfig(config: Partial<PluginPackageManagerConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('plugin-package-manager/config-changed', this.config)
  }

  /** Get configuration */
  getConfig(): PluginPackageManagerConfig {
    return { ...this.config }
  }

  /** Get package count */
  getPackageCount(): number {
    return this.packages.size
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable plugin package manager */
  enabled?: boolean
  /** Plugin packages directory */
  packagesDir?: string
  /** Enable auto-updates */
  enableAutoUpdates?: boolean
  /** Auto-update interval in milliseconds */
  autoUpdateIntervalMs?: number
  /** Enable package validation */
  enableValidation?: boolean
  /** Enable package sandboxing */
  enableSandboxing?: boolean
  /** Maximum concurrent installations */
  maxConcurrentInstallations?: number
}

/**
 * Create plugin package manager plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createPluginPackageManagerPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'plugin-package-manager',
    inject: ['settings'],
    apply(ctx) {
      const service = new PluginPackageManagerService(ctx)
      ctx.pluginPackageManager = service

      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }

      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('plugin-package-manager'),
          z.object({
            enabled: z.boolean().default(true),
            packagesDir: z.string().default('~/.dsh/plugins'),
            enableAutoUpdates: z.boolean().default(true),
            autoUpdateIntervalMs: z.number().min(0).default(86400000),
            enableValidation: z.boolean().default(true),
            enableSandboxing: z.boolean().default(true),
            maxConcurrentInstallations: z.number().min(1).max(10).default(3),
          }),
          {
            base: {
              enabled: true,
              packagesDir: '~/.dsh/plugins',
              enableAutoUpdates: true,
              autoUpdateIntervalMs: 86400000,
              enableValidation: true,
              enableSandboxing: true,
              maxConcurrentInstallations: 3,
            },
          },
        )

        // Watch for settings changes
        scope.watch((next) => {
          service.updateConfig(next)
        })

        // Set up auto-update interval
        const updateInterval = setInterval(async () => {
          if (service.getConfig().enableAutoUpdates) {
            await service.updateAll()
          }
        }, service.getConfig().autoUpdateIntervalMs)

        return () => {
          clearInterval(updateInterval)
        }
      })
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    pluginPackageManager: PluginPackageManagerService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Plugin package installed.
     * @param pkg - installed package.
     * @mode emit
     */
    'plugin-package-manager/package-installed'(pkg: PluginPackage): void

    /**
     * Plugin package uninstalled.
     * @param pkg - uninstalled package.
     * @mode emit
     */
    'plugin-package-manager/package-uninstalled'(pkg: PluginPackage): void

    /**
     * Plugin package enabled.
     * @param pkg - enabled package.
     * @mode emit
     */
    'plugin-package-manager/package-enabled'(pkg: PluginPackage): void

    /**
     * Plugin package disabled.
     * @param pkg - disabled package.
     * @mode emit
     */
    'plugin-package-manager/package-disabled'(pkg: PluginPackage): void

    /**
     * Plugin package updated.
     * @param pkg - updated package.
     * @mode emit
     */
    'plugin-package-manager/package-updated'(pkg: PluginPackage): void

    /**
     * Plugin package manager configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'plugin-package-manager/config-changed'(config: PluginPackageManagerConfig): void
  }
}

export { PluginPackageManagerService as Service }

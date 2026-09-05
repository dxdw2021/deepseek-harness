/**
 * Cache optimizer service for DeepSeek Harness.
 * Provides cache management, optimization, and performance monitoring.
 *
 * @module @deepseek-ai/dsh-cache-optimizer
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Cache entry */
export interface CacheEntry<T = unknown> {
  /** Cache key */
  key: string
  /** Cached value */
  value: T
  /** Entry creation time */
  createdAt: Date
  /** Entry last access time */
  lastAccessedAt: Date
  /** Entry TTL in milliseconds */
  ttl: number
  /** Entry size in bytes (estimated) */
  size: number
  /** Access count */
  accessCount: number
}

/** Cache statistics */
export interface CacheStats {
  /** Total entries */
  totalEntries: number
  /** Total size in bytes */
  totalSize: number
  /** Hit count */
  hitCount: number
  /** Miss count */
  missCount: number
  /** Hit rate (0-1) */
  hitRate: number
  /** Average access time in milliseconds */
  averageAccessTime: number
  /** Eviction count */
  evictionCount: number
}

/** Concurrency task */
export interface ConcurrencyTask<T = unknown> {
  /** Task ID */
  id: string
  /** Task function */
  execute: () => Promise<T>
  /** Task priority (higher = more important) */
  priority: number
  /** Task timeout in milliseconds */
  timeoutMs?: number
  /** Task result promise */
  result: Promise<T> | undefined
  /** Task status */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout'
}

/** Performance metrics */
export interface PerformanceMetrics {
  /** Request count */
  requestCount: number
  /** Average response time in milliseconds */
  averageResponseTime: number
  /** P95 response time in milliseconds */
  p95ResponseTime: number
  /** P99 response time in milliseconds */
  p99ResponseTime: number
  /** Error rate (0-1) */
  errorRate: number
  /** Throughput (requests per second) */
  throughput: number
}

/** Cache optimizer configuration */
export interface CacheOptimizerConfig {
  /** Enable cache optimizer */
  enabled: boolean
  /** Maximum cache size in bytes */
  maxCacheSize: number
  /** Maximum cache entries */
  maxCacheEntries: number
  /** Default TTL in milliseconds */
  defaultTtlMs: number
  /** Enable LRU eviction */
  enableLruEviction: boolean
  /** Enable concurrent task execution */
  enableConcurrency: boolean
  /** Maximum concurrent tasks */
  maxConcurrentTasks: number
  /** Enable performance monitoring */
  enablePerformanceMonitoring: boolean
  /** Performance monitoring interval in milliseconds */
  performanceMonitoringIntervalMs: number
}

/** Cache optimizer service definition */
export class CacheOptimizerService extends Service {
  static inject = ['settings']

  /** Cache storage */
  private cache: Map<string, CacheEntry> = new Map()

  /** Cache statistics */
  private stats: CacheStats = {
    totalEntries: 0,
    totalSize: 0,
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
    averageAccessTime: 0,
    evictionCount: 0,
  }

  /** Concurrency queue */
  private concurrencyQueue: ConcurrencyTask[] = []

  /** Running tasks */
  private runningTasks: Map<string, ConcurrencyTask> = new Map()

  /** Performance metrics */
  private metrics: PerformanceMetrics = {
    requestCount: 0,
    averageResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    errorRate: 0,
    throughput: 0,
  }

  /** Response times for percentile calculation */
  private responseTimes: number[] = []

  /** Configuration */
  private config: CacheOptimizerConfig = {
    enabled: true,
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    maxCacheEntries: 10000,
    defaultTtlMs: 300000, // 5 minutes
    enableLruEviction: true,
    enableConcurrency: true,
    maxConcurrentTasks: 10,
    enablePerformanceMonitoring: true,
    performanceMonitoringIntervalMs: 60000, // 1 minute
  }

  constructor(ctx: Context) {
    super(ctx, 'cacheOptimizer')
  }

  /** Get value from cache */
  get<T>(key: string): T | undefined {
    if (!this.config.enabled) return undefined

    const entry = this.cache.get(key)
    if (!entry) {
      this.stats.missCount++
      this.updateHitRate()
      return undefined
    }

    // Check TTL
    const now = Date.now()
    if (now - entry.createdAt.getTime() > entry.ttl) {
      this.cache.delete(key)
      this.stats.missCount++
      this.updateHitRate()
      return undefined
    }

    // Update access statistics
    entry.lastAccessedAt = new Date()
    entry.accessCount++

    this.stats.hitCount++
    this.updateHitRate()

    return entry.value as T
  }

  /** Set value in cache */
  set<T>(key: string, value: T, ttlMs?: number): void {
    if (!this.config.enabled) return

    const ttl = ttlMs || this.config.defaultTtlMs
    const size = this.estimateSize(value)

    // Check if we need to evict entries
    this.ensureCacheCapacity(size)

    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      ttl,
      size,
      accessCount: 0,
    }

    this.cache.set(key, entry)
    this.updateStats()
  }

  /** Delete value from cache */
  delete(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.updateStats()
    }
    return deleted
  }

  /** Clear cache */
  clear(): void {
    this.cache.clear()
    this.updateStats()
    this.ctx.emit('cache-optimizer/cache-cleared')
  }

  /** Get cache statistics */
  getStats(): CacheStats {
    return { ...this.stats }
  }

  /** Get cache entries */
  getEntries(): CacheEntry[] {
    return Array.from(this.cache.values())
  }

  /** Get cache entry by key */
  getEntry(key: string): CacheEntry | undefined {
    return this.cache.get(key)
  }

  /** Estimate size of value in bytes */
  private estimateSize(value: unknown): number {
    // Simple size estimation
    if (value === null || value === undefined) return 0
    if (typeof value === 'string') return value.length * 2
    if (typeof value === 'number') return 8
    if (typeof value === 'boolean') return 4
    if (Array.isArray(value)) {
      return value.reduce((sum, item) => sum + this.estimateSize(item), 0)
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2
    }
    return 0
  }

  /** Ensure cache has capacity for new entry */
  private ensureCacheCapacity(newEntrySize: number): void {
    // Check entry limit
    while (this.cache.size >= this.config.maxCacheEntries) {
      this.evictEntry()
    }

    // Check size limit
    while (this.stats.totalSize + newEntrySize > this.config.maxCacheSize) {
      this.evictEntry()
    }
  }

  /** Evict entry from cache */
  private evictEntry(): void {
    if (this.cache.size === 0) return

    if (this.config.enableLruEviction) {
      // LRU eviction: find least recently used entry
      let oldestEntry: CacheEntry | undefined
      let oldestKey: string | undefined

      for (const [key, entry] of this.cache) {
        if (!oldestEntry || entry.lastAccessedAt < oldestEntry.lastAccessedAt) {
          oldestEntry = entry
          oldestKey = key
        }
      }

      if (oldestKey) {
        this.cache.delete(oldestKey)
        this.stats.evictionCount++
      }
    } else {
      // FIFO eviction: delete first entry
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
        this.stats.evictionCount++
      }
    }

    this.updateStats()
  }

  /** Update cache statistics */
  private updateStats(): void {
    let totalSize = 0
    for (const entry of this.cache.values()) {
      totalSize += entry.size
    }

    this.stats.totalEntries = this.cache.size
    this.stats.totalSize = totalSize
  }

  /** Update hit rate */
  private updateHitRate(): void {
    const total = this.stats.hitCount + this.stats.missCount
    this.stats.hitRate = total > 0 ? this.stats.hitCount / total : 0
  }

  /** Execute task with concurrency control */
  async executeWithConcurrency<T>(task: ConcurrencyTask<T>): Promise<T> {
    if (!this.config.enabled || !this.config.enableConcurrency) {
      return task.execute()
    }

    return new Promise((resolve, reject) => {
      const wrappedTask: ConcurrencyTask<T> = {
        ...task,
        status: 'pending',
        result: undefined,
      }

      // Check if we can run immediately
      if (this.runningTasks.size < this.config.maxConcurrentTasks) {
        this.runTask(wrappedTask, resolve, reject)
      } else {
        // Add to queue
        this.concurrencyQueue.push(wrappedTask)
        this.concurrencyQueue.sort((a, b) => b.priority - a.priority)

        // Set up timeout if specified
        if (task.timeoutMs) {
          setTimeout(() => {
            if (wrappedTask.status === 'pending') {
              wrappedTask.status = 'timeout'
              reject(new Error(`Task ${task.id} timed out`))
            }
          }, task.timeoutMs)
        }
      }
    })
  }

  /** Run a task */
  private runTask<T>(
    task: ConcurrencyTask<T>,
    resolve: (value: T) => void,
    reject: (reason: unknown) => void,
  ): void {
    task.status = 'running'
    this.runningTasks.set(task.id, task)

    const startTime = Date.now()

    task.execute()
      .then((result) => {
        const duration = Date.now() - startTime
        this.recordResponseTime(duration)

        task.status = 'completed'
        this.runningTasks.delete(task.id)

        this.processQueue()
        resolve(result)
      })
      .catch((error) => {
        const duration = Date.now() - startTime
        this.recordResponseTime(duration)

        task.status = 'failed'
        this.runningTasks.delete(task.id)

        this.processQueue()
        reject(error)
      })
  }

  /** Process concurrency queue */
  private processQueue(): void {
    while (
      this.concurrencyQueue.length > 0 &&
      this.runningTasks.size < this.config.maxConcurrentTasks
    ) {
      const task = this.concurrencyQueue.shift()
      if (task) {
        // Create new promises for queued tasks
        const promise = new Promise<any>((resolve, reject) => {
          this.runTask(task, resolve, reject)
        })
        task.result = promise
      }
    }
  }

  /** Record response time */
  private recordResponseTime(time: number): void {
    this.responseTimes.push(time)

    // Keep only last 1000 response times
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000)
    }

    this.updateMetrics()
  }

  /** Update performance metrics */
  private updateMetrics(): void {
    if (this.responseTimes.length === 0) return

    const sorted = [...this.responseTimes].sort((a, b) => a - b)
    const sum = sorted.reduce((a, b) => a + b, 0)

    this.metrics.requestCount++
    this.metrics.averageResponseTime = sum / sorted.length
    this.metrics.p95ResponseTime = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] || 0 : 0
    this.metrics.p99ResponseTime = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] || 0 : 0
    this.metrics.throughput = this.metrics.requestCount / (Date.now() / 1000)
  }

  /** Get performance metrics */
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }

  /** Update configuration */
  updateConfig(config: Partial<CacheOptimizerConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('cache-optimizer/config-changed', this.config)
  }

  /** Get configuration */
  getConfig(): CacheOptimizerConfig {
    return { ...this.config }
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable cache optimizer */
  enabled?: boolean
  /** Maximum cache size in bytes */
  maxCacheSize?: number
  /** Maximum cache entries */
  maxCacheEntries?: number
  /** Default TTL in milliseconds */
  defaultTtlMs?: number
  /** Enable LRU eviction */
  enableLruEviction?: boolean
  /** Enable concurrent task execution */
  enableConcurrency?: boolean
  /** Maximum concurrent tasks */
  maxConcurrentTasks?: number
  /** Enable performance monitoring */
  enablePerformanceMonitoring?: boolean
  /** Performance monitoring interval in milliseconds */
  performanceMonitoringIntervalMs?: number
}

/**
 * Create cache optimizer plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createCacheOptimizerPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'cache-optimizer',
    inject: ['settings'],
    apply(ctx) {
      const service = new CacheOptimizerService(ctx)
      ctx.cacheOptimizer = service

      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }

      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('cache-optimizer'),
          z.object({
            enabled: z.boolean().default(true),
            maxCacheSize: z.number().min(1024).max(1073741824).default(104857600), // 100MB
            maxCacheEntries: z.number().min(100).max(1000000).default(10000),
            defaultTtlMs: z.number().min(1000).max(86400000).default(300000), // 5 minutes
            enableLruEviction: z.boolean().default(true),
            enableConcurrency: z.boolean().default(true),
            maxConcurrentTasks: z.number().min(1).max(100).default(10),
            enablePerformanceMonitoring: z.boolean().default(true),
            performanceMonitoringIntervalMs: z.number().min(1000).max(3600000).default(60000),
          }),
          {
            base: {
              enabled: true,
              maxCacheSize: 104857600,
              maxCacheEntries: 10000,
              defaultTtlMs: 300000,
              enableLruEviction: true,
              enableConcurrency: true,
              maxConcurrentTasks: 10,
              enablePerformanceMonitoring: true,
              performanceMonitoringIntervalMs: 60000,
            },
          },
        )

        // Watch for settings changes
        scope.watch((next) => {
          service.updateConfig(next)
        })

        return () => {
          // Cleanup
        }
      })
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    cacheOptimizer: CacheOptimizerService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Cache cleared.
     * @mode emit
     */
    'cache-optimizer/cache-cleared'(): void

    /**
     * Cache optimizer configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'cache-optimizer/config-changed'(config: CacheOptimizerConfig): void
  }
}

export { CacheOptimizerService as Service }

/**
 * Context Engine v2 for DeepSeek Harness.
 * Provides standing instructions and background memory for agents.
 *
 * @module @deepseek-ai/dsh-context-engine-v2
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Context types */
export type ContextType = 'instruction' | 'memory' | 'reference' | 'feedback'

/** Context scope */
export type ContextScope = 'project' | 'global' | 'session'

/** Context activation */
export type ContextActivation = 'relevant' | 'pinned' | 'always'

/** Context entry */
export interface ContextEntry {
  /** Unique ID */
  id: string
  /** Context type */
  type: ContextType
  /** Context scope */
  scope: ContextScope
  /** Context activation */
  activation: ContextActivation
  /** Context content */
  content: string
  /** Context metadata */
  metadata?: Record<string, unknown>
  /** Creation timestamp */
  createdAt: Date
  /** Last updated timestamp */
  updatedAt: Date
  /** Expiration timestamp (optional) */
  expiresAt?: Date
  /** Priority (higher = more important) */
  priority: number
  /** Tags for categorization */
  tags: string[]
}

/** Context search result */
export interface ContextSearchResult {
  /** Context entry */
  entry: ContextEntry
  /** Relevance score (0-1) */
  score: number
  /** Match explanation */
  explanation: string
}

/** Context Engine configuration */
export interface ContextEngineConfig {
  /** Enable context engine */
  enabled: boolean
  /** Maximum context entries */
  maxEntries: number
  /** Maximum context tokens */
  maxTokens: number
  /** Enable BM25 search */
  enableBM25: boolean
  /** Enable automatic recall */
  enableAutoRecall: boolean
  /** Recall threshold (0-1) */
  recallThreshold: number
  /** Enable expiration */
  enableExpiration: boolean
  /** Default TTL in milliseconds */
  defaultTtlMs: number
}

/** Context Engine v2 service definition */
export class ContextEngineV2Service extends Service {
  static inject = ['settings']

  /** Context entries storage */
  private entries: Map<string, ContextEntry> = new Map()

  /** Configuration */
  private config: ContextEngineConfig = {
    enabled: true,
    maxEntries: 1000,
    maxTokens: 10000,
    enableBM25: true,
    enableAutoRecall: true,
    recallThreshold: 0.3,
    enableExpiration: true,
    defaultTtlMs: 86400000, // 24 hours
  }

  constructor(ctx: Context) {
    super(ctx, 'contextEngineV2')
  }

  /** Add a context entry */
  add(entry: Omit<ContextEntry, 'id' | 'createdAt' | 'updatedAt'>): ContextEntry {
    if (!this.config.enabled) {
      throw new Error('Context engine is disabled')
    }

    // Check entry limit
    if (this.entries.size >= this.config.maxEntries) {
      this.removeOldestEntry()
    }

    const id = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const now = new Date()

    const newEntry: ContextEntry = {
      ...entry,
      id,
      createdAt: now,
      updatedAt: now,
    }

    this.entries.set(id, newEntry)
    this.ctx.emit('context-engine-v2/entry-added', newEntry)

    return newEntry
  }

  /** Update a context entry */
  update(id: string, updates: Partial<Omit<ContextEntry, 'id' | 'createdAt'>>): ContextEntry | undefined {
    const entry = this.entries.get(id)
    if (!entry) return undefined

    const updatedEntry: ContextEntry = {
      ...entry,
      ...updates,
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: new Date(),
    }

    this.entries.set(id, updatedEntry)
    this.ctx.emit('context-engine-v2/entry-updated', updatedEntry)

    return updatedEntry
  }

  /** Remove a context entry */
  remove(id: string): boolean {
    const entry = this.entries.get(id)
    if (!entry) return false

    this.entries.delete(id)
    this.ctx.emit('context-engine-v2/entry-removed', entry)

    return true
  }

  /** Get a context entry by ID */
  get(id: string): ContextEntry | undefined {
    return this.entries.get(id)
  }

  /** Get all context entries */
  getAll(): ContextEntry[] {
    return Array.from(this.entries.values())
  }

  /** Get entries by type */
  getByType(type: ContextType): ContextEntry[] {
    return Array.from(this.entries.values()).filter(entry => entry.type === type)
  }

  /** Get entries by scope */
  getByScope(scope: ContextScope): ContextEntry[] {
    return Array.from(this.entries.values()).filter(entry => entry.scope === scope)
  }

  /** Get entries by activation */
  getByActivation(activation: ContextActivation): ContextEntry[] {
    return Array.from(this.entries.values()).filter(entry => entry.activation === activation)
  }

  /** Get pinned entries (always included) */
  getPinnedEntries(): ContextEntry[] {
    return this.getByActivation('pinned')
  }

  /** Search context entries */
  search(query: string, limit: number = 10): ContextSearchResult[] {
    if (!this.config.enableBM25) {
      return this.simpleSearch(query, limit)
    }

    return this.bm25Search(query, limit)
  }

  /** Simple text search */
  private simpleSearch(query: string, limit: number): ContextSearchResult[] {
    const results: ContextSearchResult[] = []
    const queryLower = query.toLowerCase()

    for (const entry of this.entries.values()) {
      const contentLower = entry.content.toLowerCase()
      if (contentLower.includes(queryLower)) {
        results.push({
          entry,
          score: 1.0,
          explanation: 'Exact match',
        })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /** BM25 search (simplified implementation) */
  private bm25Search(query: string, limit: number): ContextSearchResult[] {
    // In a real implementation, this would use BM25 algorithm
    // For now, use simple search with scoring
    const results: ContextSearchResult[] = []
    const queryTerms = query.toLowerCase().split(/\s+/)

    for (const entry of this.entries.values()) {
      const contentLower = entry.content.toLowerCase()
      let score = 0

      for (const term of queryTerms) {
        if (contentLower.includes(term)) {
          score += 1
        }
      }

      if (score > 0) {
        results.push({
          entry,
          score: score / queryTerms.length,
          explanation: `Matched ${score}/${queryTerms.length} terms`,
        })
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /** Get context for a query (pinned + relevant) */
  getContextForQuery(query: string): ContextEntry[] {
    const pinned = this.getPinnedEntries()
    const relevant = this.search(query, 10)
      .filter(result => result.score >= this.config.recallThreshold)
      .map(result => result.entry)

    // Combine pinned and relevant, removing duplicates
    const combined = new Map<string, ContextEntry>()
    for (const entry of pinned) {
      combined.set(entry.id, entry)
    }
    for (const entry of relevant) {
      combined.set(entry.id, entry)
    }

    return Array.from(combined.values())
  }

  /** Calculate token count for entries */
  calculateTokenCount(entries: ContextEntry[]): number {
    // Simple token estimation: ~4 chars per token
    let totalChars = 0
    for (const entry of entries) {
      totalChars += entry.content.length
    }
    return Math.ceil(totalChars / 4)
  }

  /** Optimize context to fit within token limit */
  optimizeContext(entries: ContextEntry[]): ContextEntry[] {
    const pinned = entries.filter(e => e.activation === 'pinned')
    const others = entries.filter(e => e.activation !== 'pinned')

    // Sort others by priority and score
    others.sort((a, b) => b.priority - a.priority)

    const result: ContextEntry[] = [...pinned]
    let tokenCount = this.calculateTokenCount(result)

    for (const entry of others) {
      const entryTokens = this.calculateTokenCount([entry])
      if (tokenCount + entryTokens <= this.config.maxTokens) {
        result.push(entry)
        tokenCount += entryTokens
      }
    }

    return result
  }

  /** Clear expired entries */
  clearExpired(): number {
    if (!this.config.enableExpiration) return 0

    const now = new Date()
    let count = 0

    for (const [id, entry] of this.entries) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.entries.delete(id)
        this.ctx.emit('context-engine-v2/entry-expired', entry)
        count++
      }
    }

    return count
  }

  /** Remove oldest entry when limit is reached */
  private removeOldestEntry(): void {
    let oldest: ContextEntry | undefined

    for (const entry of this.entries.values()) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = entry
      }
    }

    if (oldest) {
      this.remove(oldest.id)
    }
  }

  /** Update configuration */
  updateConfig(config: Partial<ContextEngineConfig>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('context-engine-v2/config-changed', this.config)
  }

  /** Get configuration */
  getConfig(): ContextEngineConfig {
    return { ...this.config }
  }

  /** Get entry count */
  getEntryCount(): number {
    return this.entries.size
  }

  /** Get total token count */
  getTotalTokenCount(): number {
    return this.calculateTokenCount(Array.from(this.entries.values()))
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable context engine */
  enabled?: boolean
  /** Maximum context entries */
  maxEntries?: number
  /** Maximum context tokens */
  maxTokens?: number
  /** Enable BM25 search */
  enableBM25?: boolean
  /** Enable automatic recall */
  enableAutoRecall?: boolean
  /** Recall threshold (0-1) */
  recallThreshold?: number
  /** Enable expiration */
  enableExpiration?: boolean
  /** Default TTL in milliseconds */
  defaultTtlMs?: number
}

/**
 * Create Context Engine v2 plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createContextEngineV2Plugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'context-engine-v2',
    inject: ['settings'],
    apply(ctx) {
      const service = new ContextEngineV2Service(ctx)
      ctx.contextEngineV2 = service

      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }

      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('context-engine-v2'),
          z.object({
            enabled: z.boolean().default(true),
            maxEntries: z.number().min(1).max(10000).default(1000),
            maxTokens: z.number().min(100).max(100000).default(10000),
            enableBM25: z.boolean().default(true),
            enableAutoRecall: z.boolean().default(true),
            recallThreshold: z.number().min(0).max(1).default(0.3),
            enableExpiration: z.boolean().default(true),
            defaultTtlMs: z.number().min(0).max(604800000).default(86400000),
          }),
          {
            base: {
              enabled: true,
              maxEntries: 1000,
              maxTokens: 10000,
              enableBM25: true,
              enableAutoRecall: true,
              recallThreshold: 0.3,
              enableExpiration: true,
              defaultTtlMs: 86400000,
            },
          },
        )

        // Watch for settings changes
        scope.watch((next) => {
          service.updateConfig(next)
        })

        // Set up periodic expiration cleanup
        const cleanupInterval = setInterval(() => {
          service.clearExpired()
        }, 60000) // Every minute

        return () => {
          clearInterval(cleanupInterval)
        }
      })
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    contextEngineV2: ContextEngineV2Service
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Context entry added.
     * @param entry - added entry.
     * @mode emit
     */
    'context-engine-v2/entry-added'(entry: ContextEntry): void

    /**
     * Context entry updated.
     * @param entry - updated entry.
     * @mode emit
     */
    'context-engine-v2/entry-updated'(entry: ContextEntry): void

    /**
     * Context entry removed.
     * @param entry - removed entry.
     * @mode emit
     */
    'context-engine-v2/entry-removed'(entry: ContextEntry): void

    /**
     * Context entry expired.
     * @param entry - expired entry.
     * @mode emit
     */
    'context-engine-v2/entry-expired'(entry: ContextEntry): void

    /**
     * Context engine configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'context-engine-v2/config-changed'(config: ContextEngineConfig): void
  }
}

export { ContextEngineV2Service as Service }

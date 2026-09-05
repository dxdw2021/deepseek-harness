/**
 * Model auto-detection capability for DeepSeek Harness.
 * Automatically detects and configures model providers based on API endpoints.
 *
 * @module @deepseek-ai/dsh-model-auto-detect
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Model provider types */
export type ModelProvider =
  | 'deepseek'
  | 'openai'
  | 'anthropic'
  | 'minimax'
  | 'zhipu'
  | 'kimi'
  | 'custom'

/** Reasoning effort levels */
export type ReasoningEffort = 'auto' | 'disabled' | 'low' | 'high' | 'max'

/** Model capabilities */
export interface ModelCapabilities {
  /** Supports streaming */
  streaming: boolean
  /** Supports function calling */
  functionCalling: boolean
  /** Supports vision */
  vision: boolean
  /** Supports reasoning */
  reasoning: boolean
  /** Maximum context length */
  maxContextLength: number
  /** Maximum output tokens */
  maxOutputTokens: number
  /** Supports reasoning effort control */
  reasoningEffort: boolean
  /** Supports thinking tokens */
  thinkingTokens: boolean
}

/** Detected model information */
export interface DetectedModel {
  /** Provider name */
  provider: ModelProvider
  /** Model name */
  model: string
  /** Model capabilities */
  capabilities: ModelCapabilities
  /** API endpoint */
  endpoint: string
  /** API key reference */
  apiKeyRef?: string
  /** Detection confidence */
  confidence: number
  /** Detection method */
  detectionMethod: 'endpoint' | 'model-list' | 'header' | 'probe'
}

/** Provider detection result */
export interface ProviderDetectionResult {
  /** Detected provider */
  provider: ModelProvider
  /** Detection confidence */
  confidence: number
  /** Detected models */
  models: DetectedModel[]
  /** Detection method */
  detectionMethod: string
  /** Detection timestamp */
  timestamp: Date
}

/** Model auto-detect service definition */
export class ModelAutoDetectService extends Service {
  static inject = ['settings']

  /** Known provider endpoints */
  private static readonly PROVIDER_ENDPOINTS: Record<ModelProvider, string[]> = {
    deepseek: [
      'https://api.deepseek.com',
      'https://api.deepseek.com/v1',
      'https://api.deepseek.com/v2',
    ],
    openai: [
      'https://api.openai.com',
      'https://api.openai.com/v1',
      'https://api.openai.com/v2',
    ],
    anthropic: [
      'https://api.anthropic.com',
      'https://api.anthropic.com/v1',
    ],
    minimax: [
      'https://api.minimax.chat',
      'https://api.minimax.chat/v1',
    ],
    zhipu: [
      'https://open.bigmodel.cn',
      'https://open.bigmodel.cn/api',
      'https://open.bigmodel.cn/api/paas/v4',
    ],
    kimi: [
      'https://api.moonshot.cn',
      'https://api.moonshot.cn/v1',
    ],
    custom: [],
  }

  /** Known model patterns */
  private static readonly MODEL_PATTERNS: Record<ModelProvider, RegExp[]> = {
    deepseek: [
      /^deepseek-/i,
      /^deepseek_/i,
    ],
    openai: [
      /^gpt-/i,
      /^o\d+/i,
      /^chatgpt/i,
    ],
    anthropic: [
      /^claude-/i,
    ],
    minimax: [
      /^MiniMax-/i,
      /^minimax-/i,
    ],
    zhipu: [
      /^glm-/i,
      /^GLM-/i,
    ],
    kimi: [
      /^moonshot-/i,
      /^kimi-/i,
    ],
    custom: [],
  }

  /** Detected providers cache */
  private detectionCache: Map<string, ProviderDetectionResult> = new Map()

  constructor(ctx: Context) {
    super(ctx, 'modelAutoDetect')
  }

  /** Auto-detect provider from API endpoint */
  async detectProvider(endpoint: string, apiKey?: string): Promise<ProviderDetectionResult> {
    const cacheKey = `${endpoint}:${apiKey ? 'key' : 'no-key'}`

    // Check cache
    const cached = this.detectionCache.get(cacheKey)
    if (cached) {
      return cached
    }

    // Try endpoint pattern matching
    const endpointResult = this.detectByEndpoint(endpoint)
    if (endpointResult.confidence > 0.8) {
      this.detectionCache.set(cacheKey, endpointResult)
      return endpointResult
    }

    // Try API probe if API key is provided
    if (apiKey) {
      try {
        const probeResult = await this.detectByProbe(endpoint, apiKey)
        if (probeResult.confidence > 0.9) {
          this.detectionCache.set(cacheKey, probeResult)
          return probeResult
        }
      } catch (error) {
        // Probe failed, continue with other methods
      }
    }

    // Return low confidence result
    const result: ProviderDetectionResult = {
      provider: 'custom',
      confidence: 0.3,
      models: [],
      detectionMethod: 'endpoint',
      timestamp: new Date(),
    }

    this.detectionCache.set(cacheKey, result)
    return result
  }

  /** Detect provider by endpoint pattern */
  private detectByEndpoint(endpoint: string): ProviderDetectionResult {
    const normalizedEndpoint = endpoint.toLowerCase().replace(/\/$/, '')

    for (const [provider, endpoints] of Object.entries(ModelAutoDetectService.PROVIDER_ENDPOINTS)) {
      for (const knownEndpoint of endpoints) {
        if (normalizedEndpoint.startsWith(knownEndpoint.toLowerCase())) {
          return {
            provider: provider as ModelProvider,
            confidence: 0.95,
            models: this.getKnownModels(provider as ModelProvider),
            detectionMethod: 'endpoint',
            timestamp: new Date(),
          }
        }
      }
    }

    return {
      provider: 'custom',
      confidence: 0.1,
      models: [],
      detectionMethod: 'endpoint',
      timestamp: new Date(),
    }
  }

  /** Detect provider by API probe */
  private async detectByProbe(endpoint: string, apiKey: string): Promise<ProviderDetectionResult> {
    // In a real implementation, this would make an API call to probe the endpoint
    // For now, return a mock result

    // Try to get model list
    try {
      const response = await fetch(`${endpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json() as { data?: Array<{ id: string }> }
        const models = data.data || []

        // Detect provider from model names
        for (const model of models) {
          const detectedProvider = this.detectProviderFromModelName(model.id)
          if (detectedProvider !== 'custom') {
            return {
              provider: detectedProvider,
              confidence: 0.9,
              models: models.map(m => this.createDetectedModel(detectedProvider, m.id, endpoint)),
              detectionMethod: 'model-list',
              timestamp: new Date(),
            }
          }
        }
      }
    } catch (error) {
      // Probe failed
    }

    return {
      provider: 'custom',
      confidence: 0.2,
      models: [],
      detectionMethod: 'probe',
      timestamp: new Date(),
    }
  }

  /** Detect provider from model name */
  private detectProviderFromModelName(modelName: string): ModelProvider {
    for (const [provider, patterns] of Object.entries(ModelAutoDetectService.MODEL_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(modelName)) {
          return provider as ModelProvider
        }
      }
    }
    return 'custom'
  }

  /** Get known models for a provider */
  private getKnownModels(provider: ModelProvider): DetectedModel[] {
    const knownModels: Record<ModelProvider, string[]> = {
      deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
      openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
      anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
      minimax: ['MiniMax-Text-01', 'MiniMax-Text-02'],
      zhipu: ['glm-4', 'glm-3-turbo', 'glm-4v'],
      kimi: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
      custom: [],
    }

    return (knownModels[provider] || []).map(model =>
      this.createDetectedModel(provider, model, ''),
    )
  }

  /** Create a detected model object */
  private createDetectedModel(provider: ModelProvider, model: string, endpoint: string): DetectedModel {
    const capabilities = this.getModelCapabilities(provider, model)

    return {
      provider,
      model,
      capabilities,
      endpoint,
      confidence: 0.9,
      detectionMethod: 'model-list',
    }
  }

  /** Get model capabilities based on provider and model name */
  private getModelCapabilities(provider: ModelProvider, model: string): ModelCapabilities {
    // Default capabilities
    const defaults: ModelCapabilities = {
      streaming: true,
      functionCalling: true,
      vision: false,
      reasoning: false,
      maxContextLength: 4096,
      maxOutputTokens: 4096,
      reasoningEffort: false,
      thinkingTokens: false,
    }

    // Provider-specific capabilities
    switch (provider) {
      case 'deepseek':
        if (model.includes('reasoner')) {
          return {
            ...defaults,
            reasoning: true,
            reasoningEffort: true,
            thinkingTokens: true,
            maxContextLength: 65536,
            maxOutputTokens: 8192,
          }
        }
        return {
          ...defaults,
          maxContextLength: 32768,
          maxOutputTokens: 4096,
        }

      case 'openai':
        if (model.startsWith('gpt-4')) {
          return {
            ...defaults,
            vision: true,
            maxContextLength: 128000,
            maxOutputTokens: 4096,
          }
        }
        if (model.startsWith('o1')) {
          return {
            ...defaults,
            reasoning: true,
            reasoningEffort: true,
            maxContextLength: 128000,
            maxOutputTokens: 32768,
          }
        }
        return {
          ...defaults,
          maxContextLength: 16385,
          maxOutputTokens: 4096,
        }

      case 'anthropic':
        return {
          ...defaults,
          vision: true,
          maxContextLength: 200000,
          maxOutputTokens: 4096,
        }

      case 'minimax':
        return {
          ...defaults,
          maxContextLength: 32768,
          maxOutputTokens: 4096,
        }

      case 'zhipu':
        if (model.includes('4v')) {
          return {
            ...defaults,
            vision: true,
            maxContextLength: 2048,
            maxOutputTokens: 4096,
          }
        }
        return {
          ...defaults,
          maxContextLength: 128000,
          maxOutputTokens: 4096,
        }

      case 'kimi':
        const contextLength = model.includes('128k') ? 128000 :
          model.includes('32k') ? 32000 : 8000
        return {
          ...defaults,
          maxContextLength: contextLength,
          maxOutputTokens: 4096,
        }

      default:
        return defaults
    }
  }

  /** Get model reasoning effort configuration */
  getModelReasoningEffort(provider: ModelProvider, model: string): ReasoningEffort {
    if (provider === 'deepseek' && model.includes('reasoner')) {
      return 'auto'
    }
    if (provider === 'openai' && model.startsWith('o1')) {
      return 'auto'
    }
    return 'disabled'
  }

  /** Get model thinking token configuration */
  getModelThinkingTokens(provider: ModelProvider, model: string): number | undefined {
    if (provider === 'deepseek' && model.includes('reasoner')) {
      return 32768
    }
    return undefined
  }

  /** Clear detection cache */
  clearCache(): void {
    this.detectionCache.clear()
  }

  /** Get cached detection results */
  getCachedResults(): ProviderDetectionResult[] {
    return Array.from(this.detectionCache.values())
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable auto-detection */
  enabled?: boolean
  /** Cache TTL in milliseconds */
  cacheTtl?: number
  /** Enable API probing */
  enableProbing?: boolean
}

/**
 * Create model auto-detect plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createModelAutoDetectPlugin(_config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'model-auto-detect',
    inject: ['settings'],
    apply(ctx) {
      const service = new ModelAutoDetectService(ctx)
      ctx.modelAutoDetect = service

      // Register settings section
      ctx.effect(() => {
        ctx.settings.register(
          settingsNamespace('model-auto-detect'),
          z.object({
            enabled: z.boolean().default(true),
            cacheTtl: z.number().min(0).default(3600000), // 1 hour
            enableProbing: z.boolean().default(true),
          }),
          {
            base: {
              enabled: true,
              cacheTtl: 3600000,
              enableProbing: true,
            },
          },
        )

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
    modelAutoDetect: ModelAutoDetectService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Model auto-detection completed.
     * @param result - detection result.
     * @mode emit
     */
    'model-auto-detect/detected'(result: ProviderDetectionResult): void
  }
}

export { ModelAutoDetectService as Service }

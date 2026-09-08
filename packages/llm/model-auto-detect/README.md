# model-auto-detect/ — model auto-detection

English | [中文](README.zh.md)

Automatically detects and configures model providers based on API endpoints. Supports detection of DeepSeek, OpenAI, Anthropic, MiniMax, Zhipu, and Kimi providers.

| Package | Role | ctx key |
|---|---|---|
| [`model-auto-detect/`](model-auto-detect/README.md) | Model auto-detection and provider detection | `ctx.modelAutoDetect` |

## Features

- **Provider Auto-Detection**: Automatically detect model providers from API endpoints
- **Model Discovery**: Discover available models from provider APIs
- **Capability Detection**: Detect model capabilities (streaming, vision, reasoning, etc.)
- **Caching**: Cache detection results for performance
- **Multi-Provider Support**: Support for DeepSeek, OpenAI, Anthropic, MiniMax, Zhipu, and Kimi

## Supported Providers

### DeepSeek
- **Endpoints**: `https://api.deepseek.com`, `https://api.deepseek.com/v1`
- **Models**: `deepseek-chat`, `deepseek-reasoner`, `deepseek-coder`
- **Capabilities**: Streaming, function calling, reasoning (for reasoner models)

### OpenAI
- **Endpoints**: `https://api.openai.com`, `https://api.openai.com/v1`
- **Models**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`, `o1-preview`, `o1-mini`
- **Capabilities**: Streaming, function calling, vision (for GPT-4 models)

### Anthropic
- **Endpoints**: `https://api.anthropic.com`, `https://api.anthropic.com/v1`
- **Models**: `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`
- **Capabilities**: Streaming, vision, function calling

### MiniMax
- **Endpoints**: `https://api.minimax.chat`, `https://api.minimax.chat/v1`
- **Models**: `MiniMax-Text-01`, `MiniMax-Text-02`
- **Capabilities**: Streaming, function calling

### Zhipu (GLM)
- **Endpoints**: `https://open.bigmodel.cn`, `https://open.bigmodel.cn/api`
- **Models**: `glm-4`, `glm-3-turbo`, `glm-4v`
- **Capabilities**: Streaming, vision (for 4v models), function calling

### Kimi (Moonshot)
- **Endpoints**: `https://api.moonshot.cn`, `https://api.moonshot.cn/v1`
- **Models**: `moonshot-v1-8k`, `moonshot-v1-32k`, `moonshot-v1-128k`
- **Capabilities**: Streaming, function calling, variable context lengths

## Configuration

```typescript
interface Config {
  /** Enable auto-detection */
  enabled?: boolean
  /** Cache TTL in milliseconds */
  cacheTtl?: number
  /** Enable API probing */
  enableProbing?: boolean
}
```

## Usage

### Basic Usage

```typescript
import { createModelAutoDetectPlugin } from '@deepseek-ai/dsh-model-auto-detect'

// Create model auto-detect plugin with default configuration
const plugin = createModelAutoDetectPlugin()

// Or with custom configuration
const plugin = createModelAutoDetectPlugin({
  enabled: true,
  cacheTtl: 3600000, // 1 hour
  enableProbing: true,
})
```

### Cordis Composition

```yaml
# cordis.yml
plugins:
  - name: model-auto-detect
    package: '@deepseek-ai/dsh-model-auto-detect'
    config:
      enabled: true
      cacheTtl: 3600000
      enableProbing: true
```

### Programmatic Usage

```typescript
import { Context } from '@deepseek-ai/cordis'

// Auto-detect provider from endpoint
const result = await ctx.modelAutoDetect.detectProvider(
  'https://api.deepseek.com',
  'your-api-key'
)

console.log(`Detected provider: ${result.provider}`)
console.log(`Confidence: ${result.confidence}`)
console.log(`Models: ${result.models.map(m => m.model).join(', ')}`)

// Get model capabilities
const model = result.models[0]
console.log(`Capabilities:`, model.capabilities)

// Get reasoning effort configuration
const reasoningEffort = ctx.modelAutoDetect.getModelReasoningEffort(
  'deepseek',
  'deepseek-reasoner'
)

// Get thinking token configuration
const thinkingTokens = ctx.modelAutoDetect.getModelThinkingTokens(
  'deepseek',
  'deepseek-reasoner'
)

// Clear detection cache
ctx.modelAutoDetect.clearCache()

// Get cached results
const cachedResults = ctx.modelAutoDetect.getCachedResults()
```

## Detection Methods

### Endpoint Pattern Matching
- **Confidence**: 95%
- **Method**: Match API endpoint against known provider patterns
- **Pros**: Fast, no network requests
- **Cons**: Requires known endpoints

### Model List Probing
- **Confidence**: 90%
- **Method**: Query provider's model list API
- **Pros**: Accurate, discovers all available models
- **Cons**: Requires API key, network request

### API Header Analysis
- **Confidence**: 80%
- **Method**: Analyze response headers for provider information
- **Pros**: Works with custom endpoints
- **Cons**: Not all providers expose this information

### Direct API Probing
- **Confidence**: 70%
- **Method**: Make test API calls to identify provider
- **Pros**: Works with any endpoint
- **Cons**: Requires API key, network requests, may incur costs

## Model Capabilities

### Streaming
- **Description**: Support for streaming responses
- **Providers**: All supported providers
- **Default**: Enabled

### Function Calling
- **Description**: Support for function/tool calling
- **Providers**: All supported providers
- **Default**: Enabled

### Vision
- **Description**: Support for image inputs
- **Providers**: OpenAI (GPT-4), Anthropic, Zhipu (GLM-4V)
- **Default**: Disabled

### Reasoning
- **Description**: Support for reasoning/thinking capabilities
- **Providers**: DeepSeek (reasoner), OpenAI (o1 series)
- **Default**: Disabled

### Reasoning Effort Control
- **Description**: Ability to control reasoning effort levels
- **Providers**: DeepSeek (reasoner), OpenAI (o1 series)
- **Default**: Disabled

### Thinking Tokens
- **Description**: Support for explicit thinking token allocation
- **Providers**: DeepSeek (reasoner)
- **Default**: Disabled

## Caching

Detection results are cached to improve performance:

```typescript
// Cache TTL is configurable (default: 1 hour)
const plugin = createModelAutoDetectPlugin({
  cacheTtl: 3600000, // 1 hour
})

// Clear cache manually
ctx.modelAutoDetect.clearCache()

// Get cached results
const cachedResults = ctx.modelAutoDetect.getCachedResults()
```

## Events

The model auto-detect service emits events when detection completes:

```typescript
// Listen for detection events
ctx.on('model-auto-detect/detected', (result) => {
  console.log(`Provider detected: ${result.provider}`)
  console.log(`Confidence: ${result.confidence}`)
  console.log(`Models found: ${result.models.length}`)
})
```

## Settings Integration

Model auto-detect settings are persisted through the settings system:

```toml
# settings.toml
[model-auto-detect]
enabled = true
cacheTtl = 3600000
enableProbing = true
```

## Migration from Manual Configuration

### From Manual Provider Configuration

```typescript
// Before: Manual configuration
const provider = {
  name: 'deepseek',
  endpoint: 'https://api.deepseek.com',
  apiKey: 'your-api-key',
  model: 'deepseek-chat',
}

// After: Auto-detection
const result = await ctx.modelAutoDetect.detectProvider(
  'https://api.deepseek.com',
  'your-api-key'
)

const provider = {
  name: result.provider,
  endpoint: 'https://api.deepseek.com',
  apiKey: 'your-api-key',
  model: result.models[0]?.model || 'deepseek-chat',
}
```

## Performance Considerations

### Detection Speed
- **Endpoint Pattern Matching**: ~1ms
- **Model List Probing**: ~100-500ms
- **API Header Analysis**: ~50-200ms
- **Direct API Probing**: ~100-1000ms

### Caching Benefits
- First detection: Full detection time
- Cached detection: ~0ms
- Cache TTL: Configurable (default: 1 hour)

### Network Usage
- **Endpoint Pattern Matching**: No network requests
- **Model List Probing**: One API request
- **API Header Analysis**: One API request
- **Direct API Probing**: Multiple API requests

## Testing

```bash
# Build the package
pnpm run build

# Run tests
pnpm run test
```

## Related Packages

- [`@deepseek-ai/dsh-llm`](../llm/README.md) - LLM service definition
- [`@deepseek-ai/dsh-llm-deepseek`](../llm-deepseek/README.md) - DeepSeek adapter
- [`@deepseek-ai/dsh-llm-pi-ai`](../llm-pi-ai/README.md) - Multi-provider adapter
- [`@deepseek-ai/dsh-settings`](../../settings/settings/README.md) - Settings service definition
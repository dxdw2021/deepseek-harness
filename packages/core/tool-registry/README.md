# tool-registry/ — centralized tool registry

English | [中文](README.zh.md)

Provides centralized tool management with caching, metrics, and permission control for DeepSeek Harness.

| Package | Role | ctx key |
|---|---|---|
| [`tool-registry/`](tool-registry/README.md) | Centralized tool registry and management | `ctx.toolRegistry` |

## Features

- **Centralized Tool Management**: Register, unregister, and manage tools
- **Tool Categories**: Organize tools by category (file, shell, task, network, etc.)
- **Permission Control**: Control tool access based on permissions
- **Caching**: Cache tool execution results for read-only tools
- **Metrics Collection**: Track tool execution metrics
- **Timeout Management**: Configurable tool execution timeouts
- **Event Emission**: Emit events for tool registration and execution

## Tool Categories

### File Operations
- **Tools**: `read_file`, `write_file`, `edit_file`, `move_file`, `delete_file`
- **Permissions**: `read`, `write`
- **Description**: File system operations

### Shell Operations
- **Tools**: `bash`, `bash_output`, `kill_shell`
- **Permissions**: `execute`
- **Description**: Shell command execution

### Task Management
- **Tools**: `todo_write`, `complete_step`, `update_goal`
- **Permissions**: `read`, `write`
- **Description**: Task and goal management

### Network Operations
- **Tools**: `web_fetch`, `web_search`
- **Permissions**: `read`
- **Description**: Network requests and searches

### Search Operations
- **Tools**: `glob`, `grep`, `ls`
- **Permissions**: `read`
- **Description**: File and content search

### Code Operations
- **Tools**: `code_index`, `notebook_edit`
- **Permissions**: `read`, `write`
- **Description**: Code analysis and editing

### Memory Operations
- **Tools**: `compress`, `wait`
- **Permissions**: `read`
- **Description**: Session memory management

### MCP Tools
- **Tools**: Dynamic MCP server tools
- **Permissions**: Varies by tool
- **Description**: Model Context Protocol tools

### Skill Tools
- **Tools**: Dynamic skill tools
- **Permissions**: Varies by tool
- **Description**: Agent skill tools

### Subagent Tools
- **Tools**: `subagent`, `subagent_fork`, `send_message`
- **Permissions**: `execute`
- **Description**: Subagent management

### Workflow Tools
- **Tools**: `workflow`, `ralph`
- **Permissions**: `execute`
- **Description**: Workflow orchestration

## Configuration

```typescript
interface Config {
  /** Enable tool registry */
  enabled?: boolean
  /** Default tool timeout in milliseconds */
  defaultTimeoutMs?: number
  /** Maximum concurrent tool executions */
  maxConcurrentExecutions?: number
  /** Enable tool caching */
  enableCaching?: boolean
  /** Cache TTL in milliseconds */
  cacheTtlMs?: number
  /** Enable tool metrics */
  enableMetrics?: boolean
  /** Enable tool logging */
  enableLogging?: boolean
}
```

## Usage

### Basic Usage

```typescript
import { createToolRegistryPlugin } from '@deepseek-ai/dsh-tool-registry'

// Create tool registry plugin with default configuration
const plugin = createToolRegistryPlugin()

// Or with custom configuration
const plugin = createToolRegistryPlugin({
  enabled: true,
  defaultTimeoutMs: 30000,
  maxConcurrentExecutions: 10,
  enableCaching: true,
  cacheTtlMs: 300000,
  enableMetrics: true,
  enableLogging: true,
})
```

### Cordis Composition

```yaml
# cordis.yml
plugins:
  - name: tool-registry
    package: '@deepseek-ai/dsh-tool-registry'
    config:
      enabled: true
      defaultTimeoutMs: 30000
      maxConcurrentExecutions: 10
      enableCaching: true
      cacheTtlMs: 300000
      enableMetrics: true
      enableLogging: true
```

### Programmatic Usage

```typescript
import { Context } from '@deepseek-ai/cordis'

// Register a tool
const disposable = ctx.toolRegistry.register({
  name: 'my_tool',
  description: 'My custom tool',
  category: 'custom',
  permissions: ['read'],
  schema: z.object({
    input: z.string(),
  }),
  execute: async (args, context) => {
    return `Result: ${args.input}`
  },
  readOnly: true,
  streaming: false,
})

// Get a tool
const tool = ctx.toolRegistry.get('my_tool')

// Get all tools
const allTools = ctx.toolRegistry.getAll()

// Get tools by category
const fileTools = ctx.toolRegistry.getByCategory('file')

// Get tools by permission
const readTools = ctx.toolRegistry.getByPermission('read')

// Get read-only tools
const readOnlyTools = ctx.toolRegistry.getReadOnlyTools()

// Execute a tool
const result = await ctx.toolRegistry.execute(
  'my_tool',
  { input: 'test' },
  {
    sessionId: 'session-123',
    agentId: 'agent-123',
    cwd: '/path/to/workspace',
    callId: 'call-123',
    signal: new AbortController().signal,
  }
)

// Get tool metrics
const metrics = ctx.toolRegistry.getMetrics('my_tool')

// Get all metrics
const allMetrics = ctx.toolRegistry.getAllMetrics()

// Clear cache
ctx.toolRegistry.clearCache()

// Get cache size
const cacheSize = ctx.toolRegistry.getCacheSize()

// Update configuration
ctx.toolRegistry.updateConfig({
  defaultTimeoutMs: 60000,
  enableCaching: false,
})

// Get configuration
const config = ctx.toolRegistry.getConfig()

// Unregister tool
disposable()
```

## Tool Definition

### ToolDefinition Interface

```typescript
interface ToolDefinition {
  name: string
  description: string
  category: ToolCategory
  permissions: ToolPermission[]
  schema: z.ZodType
  execute: (args: unknown, context: ToolExecutionContext) => Promise<unknown>
  preview?: (args: unknown) => Promise<string>
  image?: (args: unknown) => Promise<Buffer>
  readOnly: boolean
  streaming: boolean
  timeoutMs?: number
  metadata?: Record<string, unknown>
}
```

### ToolExecutionContext Interface

```typescript
interface ToolExecutionContext {
  sessionId: string
  agentId: string
  cwd: string
  userId?: string
  callId: string
  signal: AbortSignal
  context?: Record<string, unknown>
}
```

### ToolExecutionResult Interface

```typescript
interface ToolExecutionResult {
  success: boolean
  value?: unknown
  error?: string
  metadata?: Record<string, unknown>
  executionTime: number
  tokenUsage?: {
    input: number
    output: number
    total: number
  }
}
```

## Permission System

### Permission Levels

- **read**: Read-only access to data
- **write**: Write access to data
- **execute**: Execute commands and scripts
- **admin**: Administrative access

### Permission Checking

```typescript
// Check if tool has required permissions
const hasPermissions = ctx.toolRegistry.hasRequiredPermissions(tool, context)
```

## Caching System

### Cache Behavior

- **Read-only tools**: Results are cached
- **Writable tools**: Results are not cached
- **Cache TTL**: Configurable (default: 5 minutes)
- **Cache Key**: Based on tool name and arguments

### Cache Management

```typescript
// Clear cache
ctx.toolRegistry.clearCache()

// Get cache size
const cacheSize = ctx.toolRegistry.getCacheSize()
```

## Metrics Collection

### Metrics Tracked

- **Total Executions**: Number of tool executions
- **Successful Executions**: Number of successful executions
- **Failed Executions**: Number of failed executions
- **Average Execution Time**: Average execution time in milliseconds
- **Last Execution Time**: Timestamp of last execution

### Metrics Access

```typescript
// Get metrics for a tool
const metrics = ctx.toolRegistry.getMetrics('my_tool')

// Get all metrics
const allMetrics = ctx.toolRegistry.getAllMetrics()
```

## Events

The tool registry emits events for tool management:

```typescript
// Listen for tool registration
ctx.on('tool-registry/tool-registered', (name, category) => {
  console.log(`Tool "${name}" registered in category "${category}"`)
})

// Listen for tool unregistration
ctx.on('tool-registry/tool-unregistered', (name) => {
  console.log(`Tool "${name}" unregistered`)
})

// Listen for tool execution
ctx.on('tool-registry/tool-executed', (name, success, executionTime) => {
  console.log(`Tool "${name}" executed in ${executionTime}ms: ${success ? 'success' : 'failed'}`)
})

// Listen for configuration changes
ctx.on('tool-registry/config-changed', (config) => {
  console.log('Tool registry configuration changed:', config)
})
```

## Settings Integration

Tool registry settings are persisted through the settings system:

```toml
# settings.toml
[tool-registry]
enabled = true
defaultTimeoutMs = 30000
maxConcurrentExecutions = 10
enableCaching = true
cacheTtlMs = 300000
enableMetrics = true
enableLogging = true
```

## Integration with Existing Tools

### Registering Existing Tools

```typescript
import { read_file } from '@deepseek-ai/dsh-tool-fs'
import { bash } from '@deepseek-ai/dsh-tool-bash'

// Register existing tools
ctx.toolRegistry.register(read_file)
ctx.toolRegistry.register(bash)
```

### Using with Agent System

```typescript
// Agent can use tool registry
const agent = ctx.agentLoop.create('agent-123', {
  provider: 'deepseek',
  model: 'deepseek-chat',
})

// Execute tool through registry
const result = await ctx.toolRegistry.execute(
  'read_file',
  { path: '/path/to/file' },
  {
    sessionId: agent.session.id,
    agentId: agent.id,
    cwd: '/path/to/workspace',
    callId: 'call-123',
    signal: new AbortController().signal,
  }
)
```

## Performance Considerations

### Caching Benefits
- **Reduced Execution Time**: Cached results return immediately
- **Reduced Resource Usage**: Avoid re-executing read-only tools
- **Configurable TTL**: Balance freshness vs performance

### Metrics Overhead
- **Minimal Impact**: Metrics collection is lightweight
- **Optional**: Can be disabled for maximum performance
- **Useful for Monitoring**: Track tool usage and performance

### Concurrency Control
- **Configurable Limits**: Control maximum concurrent executions
- **Prevent Resource Exhaustion**: Avoid overwhelming the system
- **Fair Scheduling**: Ensure all tools get execution time

## Testing

```bash
# Build the package
pnpm run build

# Run tests
pnpm run test
```

## Related Packages

- [`@deepseek-ai/dsh-tools`](../tools/README.md) - Tool registry and execution pipeline
- [`@deepseek-ai/dsh-settings`](../../settings/settings/README.md) - Settings service definition
- [`@deepseek-ai/dsh-agent`](../agent/README.md) - Agent interface and registry
- [`@deepseek-ai/dsh-agent-loop`](../agent-loop/README.md) - Concrete agent loop driver
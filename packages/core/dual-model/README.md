# dual-model/ — dual model collaboration

English | [中文](README.zh.md)

Provides Executor + Planner separation for improved task execution in DeepSeek Harness agents. The Planner model creates detailed execution plans, while the Executor model carries out the actual work.

| Package | Role | ctx key |
|---|---|---|
| [`dual-model/`](dual-model/README.md) | Dual model collaboration (Executor + Planner) | `ctx.dualModel` |

## Features

- **Executor + Planner Separation**: Different models for planning and execution
- **Multiple Collaboration Strategies**: Sequential, parallel, iterative, and adaptive
- **Task Planning**: Create detailed execution plans with steps and dependencies
- **Execution Tracking**: Track execution progress and collect evidence
- **Metrics Collection**: Gather performance metrics for analysis
- **Settings Integration**: Persistent configuration through the settings system

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Dual Model Service                                      │
│  ├── Planner Model (deepseek-reasoner)                   │
│  │   ├── Task Analysis                                   │
│  │   ├── Step Planning                                   │
│  │   └── Dependency Resolution                           │
│  └── Executor Model (deepseek-chat)                      │
│      ├── Step Execution                                  │
│      ├── Tool Calls                                      │
│      └── Result Validation                               │
└─────────────────────────────────────────────────────────┘
```

## Model Roles

### Planner Model
- **Purpose**: Analyze tasks and create execution plans
- **Default Model**: `deepseek-reasoner`
- **Characteristics**: Strong reasoning, detailed planning, dependency analysis

### Executor Model
- **Purpose**: Execute planned steps and make tool calls
- **Default Model**: `deepseek-chat`
- **Characteristics**: Fast execution, tool usage, result validation

## Configuration

```typescript
interface Config {
  /** Enable dual model collaboration */
  enabled?: boolean
  /** Executor model configuration */
  executor?: {
    provider: string
    model: string
    maxTokens?: number
    temperature?: number
  }
  /** Planner model configuration */
  planner?: {
    provider: string
    model: string
    maxTokens?: number
    temperature?: number
  }
  /** Collaboration strategy */
  strategy?: 'sequential' | 'parallel' | 'iterative' | 'adaptive'
}
```

## Usage

### Basic Usage

```typescript
import { createDualModelPlugin } from '@deepseek-ai/dsh-dual-model'

// Create dual model plugin with default configuration
const plugin = createDualModelPlugin()

// Or with custom configuration
const plugin = createDualModelPlugin({
  enabled: true,
  executor: {
    provider: 'deepseek',
    model: 'deepseek-chat',
    temperature: 0.7,
  },
  planner: {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    temperature: 0.3,
  },
  strategy: 'sequential',
})
```

### Cordis Composition

```yaml
# cordis.yml
plugins:
  - name: dual-model
    package: '@deepseek-ai/dsh-dual-model'
    config:
      enabled: true
      executor:
        provider: 'deepseek'
        model: 'deepseek-chat'
      planner:
        provider: 'deepseek'
        model: 'deepseek-reasoner'
      strategy: 'sequential'
```

### Programmatic Usage

```typescript
import { Context } from '@deepseek-ai/cordis'

// Check if dual model is enabled
const isEnabled = ctx.dualModel.isEnabled()

// Enable dual model
ctx.dualModel.setEnabled(true)

// Get configuration
const config = ctx.dualModel.getConfig()

// Update configuration
ctx.dualModel.updateConfig({
  strategy: 'adaptive',
  executor: {
    provider: 'deepseek',
    model: 'deepseek-chat-v3',
  },
})

// Plan a task
const plan = await ctx.dualModel.planTask('Implement a new feature')

// Execute a plan
const result = await ctx.dualModel.executePlan(plan)

// Get model for current execution mode
const model = ctx.dualModel.getModelForMode('delivery')
```

## Collaboration Strategies

### Sequential
- **Description**: Planner creates plan first, then Executor executes it
- **Use Case**: Standard tasks with clear requirements
- **Pros**: Clear separation, predictable execution
- **Cons**: Slower due to sequential processing

### Parallel
- **Description**: Planner and Executor work simultaneously
- **Use Case**: Independent tasks that can be parallelized
- **Pros**: Faster execution for independent tasks
- **Cons**: Requires careful coordination

### Iterative
- **Description**: Alternating between Planner and Executor
- **Use Case**: Complex tasks requiring iterative refinement
- **Pros**: Continuous improvement during execution
- **Cons**: May require multiple planning cycles

### Adaptive
- **Description**: Strategy based on task complexity
- **Use Case**: Variable task complexity
- **Pros**: Optimal strategy selection
- **Cons**: Complex strategy selection logic

## Task Planning

### Task Plan Structure

```typescript
interface TaskPlan {
  id: string
  description: string
  steps: TaskStep[]
  complexity: 'low' | 'medium' | 'high'
  resources: string[]
  dependencies: Record<string, string[]>
}

interface TaskStep {
  id: string
  description: string
  toolCalls: string[]
  expectedOutput: string
  validationCriteria: string[]
}
```

### Example Plan

```json
{
  "id": "plan-123",
  "description": "Implement user authentication",
  "steps": [
    {
      "id": "step-1",
      "description": "Design authentication schema",
      "toolCalls": ["read_file", "write_file"],
      "expectedOutput": "Authentication schema document",
      "validationCriteria": ["Schema covers all requirements", "Security considerations included"]
    },
    {
      "id": "step-2",
      "description": "Implement authentication logic",
      "toolCalls": ["write_file", "edit_file"],
      "expectedOutput": "Authentication implementation",
      "validationCriteria": ["Code follows best practices", "Unit tests pass"]
    }
  ],
  "complexity": "high",
  "resources": ["file_system", "database"],
  "dependencies": {
    "step-2": ["step-1"]
  }
}
```

## Execution Tracking

### Execution Result Structure

```typescript
interface ExecutionResult {
  planId: string
  stepResults: StepResult[]
  success: boolean
  error?: string
  evidence: string[]
  metrics: ExecutionMetrics
}
```

### Metrics Collection

```typescript
interface ExecutionMetrics {
  totalTime: number
  stepTimes: Record<string, number>
  tokenUsage: {
    planner: number
    executor: number
    total: number
  }
  toolCallCount: number
}
```

## Events

The dual model service emits events for state changes:

```typescript
// Listen for enabled state changes
ctx.on('dual-model/enabled-changed', (enabled) => {
  console.log(`Dual model ${enabled ? 'enabled' : 'disabled'}`)
})

// Listen for configuration changes
ctx.on('dual-model/config-changed', (config) => {
  console.log('Dual model configuration updated:', config)
})

// Listen for strategy changes
ctx.on('dual-model/strategy-changed', (strategy) => {
  console.log(`Collaboration strategy changed to: ${strategy}`)
})
```

## Settings Integration

Dual model settings are persisted through the settings system:

```toml
# settings.toml
[dual-model]
enabled = true

[dual-model.executor]
provider = "deepseek"
model = "deepseek-chat"
maxTokens = 4096
temperature = 0.7

[dual-model.planner]
provider = "deepseek"
model = "deepseek-reasoner"
maxTokens = 8192
temperature = 0.3

[dual-model]
strategy = "sequential"
```

## Migration from Single Model

### From Single Model to Dual Model

1. **Enable dual model**: Set `enabled: true` in configuration
2. **Configure models**: Set appropriate executor and planner models
3. **Choose strategy**: Select collaboration strategy based on use case
4. **Update code**: Use `ctx.dualModel.planTask()` and `executePlan()` methods

### Example Migration

```typescript
// Before: Single model
const result = await ctx.llm.generate({
  model: 'deepseek-chat',
  prompt: task,
})

// After: Dual model
const plan = await ctx.dualModel.planTask(task)
const result = await ctx.dualModel.executePlan(plan)
```

## Performance Considerations

### Token Usage
- **Planner**: Typically uses more tokens for detailed planning
- **Executor**: Uses tokens for execution and tool calls
- **Total**: May be higher than single model, but with better results

### Latency
- **Sequential**: Higher latency due to planning phase
- **Parallel**: Lower latency for independent tasks
- **Iterative**: Variable latency based on refinement cycles

### Cost
- **Planning**: Additional cost for planner model usage
- **Execution**: Standard executor model costs
- **ROI**: Better results may justify additional cost

## Testing

```bash
# Build the package
pnpm run build

# Run tests
pnpm run test
```

## Related Packages

- [`@deepseek-ai/dsh-execution-mode`](../execution-mode/README.md) - Execution mode management
- [`@deepseek-ai/dsh-agent`](../agent/README.md) - Agent interface and registry
- [`@deepseek-ai/dsh-agent-loop`](../agent-loop/README.md) - Concrete agent loop driver
- [`@deepseek-ai/dsh-llm`](../../llm/llm/README.md) - LLM service definition
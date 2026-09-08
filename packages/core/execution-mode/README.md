# execution-mode/ — execution mode management

English | [中文](README.zh.md)

Provides three execution modes for DeepSeek Harness agents: Light, Balanced, and Delivery. Each mode has different characteristics for tool calls, streaming, plan mode, goal mode, and subagent support.

| Package | Role | ctx key |
|---|---|---|
| [`execution-mode/`](execution-mode/README.md) | Execution mode management (Light/Balanced/Delivery) | `ctx.executionMode` |

## Features

- **Three Execution Modes**: Light, Balanced, and Delivery modes
- **Mode Switching**: Switch between modes via commands
- **Mode-Specific Configuration**: Different settings for each mode
- **History Tracking**: Track mode changes over time
- **Settings Integration**: Persistent mode settings through the settings system

## Execution Modes

### Light Mode
- **Purpose**: Fast simple tasks
- **Max Tool Calls**: 5 per step
- **Streaming**: Enabled
- **Plan Mode**: Disabled
- **Goal Mode**: Disabled
- **Subagents**: Disabled

### Balanced Mode
- **Purpose**: Standard execution mode
- **Max Tool Calls**: 10 per step
- **Streaming**: Enabled
- **Plan Mode**: Enabled
- **Goal Mode**: Enabled
- **Subagents**: Enabled

### Delivery Mode
- **Purpose**: Strict validation and evidence support
- **Max Tool Calls**: 20 per step
- **Streaming**: Enabled
- **Plan Mode**: Enabled
- **Goal Mode**: Enabled
- **Subagents**: Enabled
- **Evidence Collection**: Enabled
- **Strict Validation**: Enabled

## Configuration

```typescript
interface Config {
  /** Default execution mode */
  defaultMode?: 'light' | 'balanced' | 'delivery'
  /** Enable mode switching via commands */
  enableModeSwitching?: boolean
}
```

## Usage

### Basic Usage

```typescript
import { createExecutionModePlugin } from '@deepseek-ai/dsh-execution-mode'

// Create execution mode plugin with default configuration
const plugin = createExecutionModePlugin()

// Or with custom configuration
const plugin = createExecutionModePlugin({
  defaultMode: 'balanced',
  enableModeSwitching: true,
})
```

### Cordis Composition

```yaml
# cordis.yml
plugins:
  - name: execution-mode
    package: '@deepseek-ai/dsh-execution-mode'
    config:
      defaultMode: 'balanced'
      enableModeSwitching: true
```

### Programmatic Usage

```typescript
import { Context } from '@deepseek-ai/cordis'

// Get current mode
const currentMode = ctx.executionMode.getCurrentMode()

// Switch to delivery mode
ctx.executionMode.setMode('delivery')

// Get mode configuration
const config = ctx.executionMode.getModeConfig('light')

// Check if mode switching is enabled
const isEnabled = ctx.executionMode.isModeSwitchingEnabled()

// Get mode history
const history = ctx.executionMode.getHistory()

// Reset to default mode
ctx.executionMode.resetToDefault()
```

## Mode-Specific Behavior

### Tool Execution
- **Light Mode**: Limited to 5 tool calls per step
- **Balanced Mode**: Up to 10 tool calls per step
- **Delivery Mode**: Up to 20 tool calls per step with evidence collection

### Streaming
All modes support streaming, but Delivery mode may include additional validation of streamed content.

### Plan and Goal Modes
- **Light Mode**: No plan or goal mode support
- **Balanced Mode**: Full plan and goal mode support
- **Delivery Mode**: Full plan and goal mode support with strict validation

### Subagents
- **Light Mode**: No subagent support
- **Balanced Mode**: Full subagent support
- **Delivery Mode**: Full subagent support with evidence collection

## Events

The execution mode service emits events when modes change:

```typescript
// Listen for mode changes
ctx.on('execution-mode/changed', (mode, previousMode) => {
  console.log(`Execution mode changed from ${previousMode} to ${mode}`)
})
```

## Settings Integration

Mode settings are persisted through the settings system:

```toml
# settings.toml
[execution-mode]
defaultMode = "balanced"
enableModeSwitching = true

[execution-mode.modes.light]
maxToolCalls = 5
enableStreaming = true
enablePlanMode = false
enableGoalMode = false

[execution-mode.modes.balanced]
maxToolCalls = 10
enableStreaming = true
enablePlanMode = true
enableGoalMode = true
enableSubagents = true

[execution-mode.modes.delivery]
maxToolCalls = 20
enableStreaming = true
enablePlanMode = true
enableGoalMode = true
enableSubagents = true
enableEvidenceCollection = true
enableStrictValidation = true
```

## Migration from Other Systems

### From Single Mode
If you're migrating from a single execution mode system:

1. Add the execution-mode plugin to your composition
2. Set the default mode to match your current behavior
3. Update any mode-specific logic to use the new service

### From Custom Mode System
If you have a custom mode system:

1. Map your existing modes to Light/Balanced/Delivery
2. Migrate configuration to the new format
3. Update any mode-switching logic to use the new service

## Testing

```bash
# Build the package
pnpm run build

# Run tests
pnpm run test
```

## Related Packages

- [`@deepseek-ai/dsh-agent`](../agent/README.md) - Agent interface and registry
- [`@deepseek-ai/dsh-agent-loop`](../agent-loop/README.md) - Concrete agent loop driver
- [`@deepseek-ai/dsh-settings`](../../settings/settings/README.md) - Settings service definition
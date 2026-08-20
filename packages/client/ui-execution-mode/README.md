# @deepseek-ai/dsh-client-ui-execution-mode

English | [中文](README.zh.md)

Execution Mode settings UI plugin — registers the Execution Mode settings section for switching between Light, Balanced, and Delivery modes.

## Features

- **Mode Selection**: Switch between Light, Balanced, and Delivery execution modes
- **Configuration**: Customize mode-specific settings (max tool calls, streaming, plan mode, etc.)
- **Mode Switching Control**: Enable/disable mode switching capability
- **Real-time Updates**: Push invalidations keep the UI in sync with Host state

## Modes

### Light Mode
- Maximum 5 tool calls per step
- Streaming enabled
- Plan mode disabled
- Goal mode disabled
- Best for simple, fast-response tasks

### Balanced Mode
- Maximum 10 tool calls per step
- Streaming enabled
- Plan mode enabled
- Goal mode enabled
- Subagents enabled
- Best for general-purpose tasks

### Delivery Mode
- Maximum 20 tool calls per step
- Streaming enabled
- Plan mode enabled
- Goal mode enabled
- Subagents enabled
- Evidence collection enabled
- Strict validation enabled
- Best for complex, high-reliability tasks

## Integration

This plugin registers into the `settings.section` slot with:
- `id: 'execution-mode'`
- `order: 15` (positioned after General and Models sections)

## Host Communication

The plugin communicates with the Host through the settings API:
- **Read**: `settings.read('execution-mode')` — loads current mode and configuration
- **Write**: `settings.write('execution-mode', data)` — saves mode changes

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No undo for mode switches** — mode changes are applied immediately without confirmation
- **Configuration validation** — mode configs are not validated against Host capabilities
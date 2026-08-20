# @deepseek-ai/dsh-client-ui-dual-model

English | [中文](README.zh.md)

Dual Model settings UI plugin — registers the Dual Model settings section for configuring Executor + Planner collaboration.

## Features

- **Enable/Disable**: Toggle dual model collaboration on/off
- **Model Configuration**: Configure Executor and Planner models separately
- **Provider Selection**: Choose from available AI providers (DeepSeek, OpenAI, Anthropic)
- **Model Selection**: Select specific models for each role
- **Parameter Tuning**: Adjust max tokens and temperature for each model
- **Strategy Selection**: Choose collaboration strategy (Sequential, Parallel, Iterative, Adaptive)

## Collaboration Strategies

### Sequential
- Planner generates a complete plan first
- Executor follows the plan step by step
- Best for structured, predictable tasks

### Parallel
- Both models work simultaneously
- Planner and Executor collaborate in real-time
- Best for time-sensitive tasks

### Iterative
- Planner and Executor alternate work
- Gradually refines the result through multiple passes
- Best for quality-critical tasks

### Adaptive
- Automatically selects the best strategy
- Based on task complexity analysis
- Best for general-purpose use

## Integration

This plugin registers into the `settings.section` slot with:
- `id: 'dual-model'`
- `order: 20` (positioned after Execution Mode section)

## Host Communication

The plugin communicates with the Host through the settings API:
- **Read**: `settings.read('dual-model')` — loads current configuration
- **Write**: `settings.write('dual-model', data)` — saves configuration changes

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No model validation** — selected models are not validated against provider capabilities
- **No cost estimation** — dual model usage may increase API costs
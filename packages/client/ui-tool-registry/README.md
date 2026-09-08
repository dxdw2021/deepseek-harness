# @deepseek-ai/dsh-client-ui-tool-registry

English | [中文](README.zh.md)

Tool Registry settings UI plugin — registers the Tool Registry settings section for managing tools and their configurations.

## Features

- **Tool List**: View all registered tools with their details
- **Category Filtering**: Filter tools by category (file, shell, task, network, etc.)
- **Search**: Search tools by name or description
- **Enable/Disable**: Toggle individual tools on/off
- **Tool Details**: View permissions, usage statistics, and last used time
- **Batch Operations**: Manage multiple tools at once

## Tool Categories

- **File**: File operations (read, write, edit, glob)
- **Shell**: Shell operations (bash, command execution)
- **Task**: Task management (todo, goals)
- **Network**: Network operations (web search, fetch)
- **Search**: Search operations (grep, find)
- **Code**: Code operations (analysis, generation)
- **Memory**: Memory operations (context, history)
- **MCP**: MCP tools (Model Context Protocol)
- **Skill**: Skill tools (ability extensions)
- **Subagent**: Subagent tools (delegation)
- **Workflow**: Workflow tools (orchestration)
- **Custom**: Custom tools (user-defined)

## Integration

This plugin registers into the `settings.section` slot with:
- `id: 'tool-registry'`
- `order: 30` (positioned after Dual Model section)

## Host Communication

The plugin communicates with the Host through the settings API:
- **Read**: `settings.read('tool-registry')` — loads tool list and configurations
- **Write**: `settings.write('tool-registry', data)` — saves tool enable/disable changes

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No tool execution** — this UI only manages tool registration, not execution
- **No real-time usage updates** — usage statistics require manual refresh
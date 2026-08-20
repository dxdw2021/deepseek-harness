# @deepseek-ai/dsh-client-ui-permission-management

English | [中文](README.zh.md)

Permission Management settings UI plugin — registers the Permission Management settings section for managing permission rules and audit logs.

## Features

- **Rule Management**: Create, edit, and delete permission rules
- **Rule Configuration**: Configure resource types, patterns, and allowed actions
- **Rule Toggle**: Enable/disable individual rules
- **Audit Log**: View permission check history with granted/denied status
- **Tabbed Interface**: Switch between Rules and Audit Log views

## Rule Configuration

### Resource Types
- **file**: File operations
- **directory**: Directory operations
- **tool**: Tool execution
- **session**: Session management
- **agent**: Agent operations
- **plugin**: Plugin management
- **system**: System operations

### Permission Actions
- **read**: Read access
- **write**: Write access
- **execute**: Execute access
- **admin**: Administrative access
- **create**: Create access
- **delete**: Delete access
- **update**: Update access

## Integration

This plugin registers into the `settings.section` slot with:
- `id: 'permission-management'`
- `order: 40` (positioned after Tool Registry section)

## Host Communication

The plugin communicates with the Host through the settings API:
- **Read**: `settings.read('permission-management')` — loads rules and audit log
- **Write**: `settings.write('permission-management', data)` — saves rule changes

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No real-time audit updates** — audit log requires manual refresh
- **No rule validation** — resource patterns are not validated against syntax
# settings-toml/ — TOML-backed settings provider

English | [中文](README.zh.md)

Stores user-editable settings in a TOML document under the harness home, with hot-reload on external edits and atomic cross-process writes.

| Package | Role | ctx key |
|---|---|---|
| [`settings-toml/`](settings-toml/README.md) | Stores settings in TOML format and observes external edits | registers on `ctx.settings` |

## Features

- **TOML Format**: Native TOML configuration file support
- **Hot Reload**: Watches for external file changes and updates settings in real-time
- **Atomic Writes**: Cross-process writer lock prevents concurrent write corruption
- **Comment Preservation**: Maintains TOML comments and formatting during updates
- **Schema Validation**: Uses Schemastery for configuration validation
- **Default Path**: `settings.toml` under the harness home (`$DSH_HOME` or `~/.dsh`)

## Configuration

```typescript
interface Config {
  /** Settings document path; defaults to `settings.toml` under the harness home. */
  path?: string
  /** Harness home used when `path` is omitted; defaults to `$DSH_HOME` or `~/.dsh`. */
  dshHome?: string
  /** Watch the document and hot-publish external edits; defaults to true. */
  watch?: boolean
  /** Watcher write-settle window in milliseconds; defaults to 100. */
  debounceMs?: number
}
```

## Usage

### Basic Usage

```typescript
import { createTomlSettingsProvider } from '@deepseek-ai/dsh-settings-toml'

// Create a TOML settings provider with default configuration
const plugin = createTomlSettingsProvider()

// Or with custom configuration
const plugin = createTomlSettingsProvider({
  path: '/path/to/custom/settings.toml',
  watch: true,
  debounceMs: 200,
})
```

### Cordis Composition

```yaml
# cordis.yml
plugins:
  - name: settings-toml
    package: '@deepseek-ai/dsh-settings-toml'
    config:
      watch: true
      debounceMs: 150
```

## TOML Document Structure

The TOML document is organized by namespace sections:

```toml
# settings.toml

[llm]
defaultProvider = 'deepseek'
defaultModel = 'deepseek-chat'

[permission]
mode = 'ask'

[shell]
maxConcurrent = 6

[workspace]
root = '/path/to/project'
```

## Migration from YAML/JSON

To migrate from `settings.yaml` or `settings.json` to TOML:

1. Rename the file to `settings.toml`
2. Convert the content to TOML format
3. Update the provider configuration if using a custom path

### Conversion Examples

**YAML to TOML:**
```yaml
# settings.yaml
llm:
  defaultProvider: deepseek
  defaultModel: deepseek-chat
```

becomes:

```toml
# settings.toml
[llm]
defaultProvider = "deepseek"
defaultModel = "deepseek-chat"
```

**JSON to TOML:**
```json
{
  "llm": {
    "defaultProvider": "deepseek",
    "defaultModel": "deepseek-chat"
  }
}
```

becomes:

```toml
# settings.toml
[llm]
defaultProvider = "deepseek"
defaultModel = "deepseek-chat"
```

## Advanced Features

### Atomic Writes

The provider uses atomic writes with file locking to prevent corruption when multiple processes write to the same settings file simultaneously.

### Hot Reload

When `watch: true` (default), the provider monitors the TOML file for external changes and automatically updates the in-memory settings. The debounce window prevents rapid successive updates.

### Comment Preservation

The provider attempts to preserve TOML comments and formatting during updates, though complex structural changes may cause comment loss.

### Schema Validation

Settings are validated against the registered schema for each namespace. Invalid values are rejected with descriptive error messages.

## Known Limitations

- **Comment Preservation**: Complex structural changes may cause comment loss
- **Nested Arrays**: Deeply nested arrays may not preserve formatting perfectly
- **Binary Data**: TOML doesn't support binary data; use base64 encoding
- **Date Precision**: TOML date precision may vary by implementation

## Testing

```bash
# Build the package
pnpm run build

# Run tests
pnpm run test
```

## Related Packages

- [`@deepseek-ai/dsh-settings`](../settings/README.md) - Settings service definition
- [`@deepseek-ai/dsh-settings-file`](../settings-file/README.md) - YAML/JSON file provider
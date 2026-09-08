# @deepseek-ai/dsh-client-ui-desktop

Desktop integration plugin for the dsh web GUI. When the page runs inside the Electron shell it detects the preload bridge (`window.electronAPI`) and:

- **Desktop Bridge** — forwards native menu/tray events to web GUI actions (new session, open settings, toggle sidebar) and toggles an `electron-maximized` class on the document root when the window maximize state changes.
- **Status bar** — injects a small desktop badge into the fixed bottom-right corner.
- **Command palette** — opens a Ctrl+K / Cmd+K fuzzy overlay with new session, settings, and sidebar actions, and closes on Escape or outside click.

When the bridge is absent (plain browser tab) the plugin no-ops gracefully: nothing is injected and no shortcuts are bound.

## Model Experience

None: this plugin is browser/desktop chrome and never reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Full command palette is a D3-free DOM overlay** — it lists a fixed command set rather than scanning the slash-command registry, and does not yet support arrow-key navigation or history.
- **Electron bridge surface is best-effort** — menu events are applied via optional chaining, so a preload exposing a different API shape silently skips the corresponding action.
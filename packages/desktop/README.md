# DeepSeek Harness Desktop

Native desktop wrapper for the DeepSeek Harness Web GUI. Provides window management, system tray, auto-update, and other desktop-level features.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                        │
│  ├── Window Management (BrowserWindow)                  │
│  ├── System Tray (Tray)                                 │
│  ├── Subprocess Management (dsh web)                    │
│  ├── IPC Bridge (main ↔ renderer)                       │
│  └── Auto Updater (electron-updater)                    │
└───────────────▲───────────────────────────┬─────────────┘
     IPC Bridge                     Child Process
┌───────────────┴───────────────────────────▼─────────────┐
│  Electron Renderer Process (Chromium)                   │
│  ├── Loads http://localhost:<port> (dsh web GUI)        │
│  └── Bridges Desktop API (window.electronAPI)           │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Window Management**: Create, minimize, maximize, close windows with state persistence
- **System Tray**: Tray icon with context menu, double-click to show/hide
- **Native Menu**: File, Edit, View, Window, Help menus with keyboard shortcuts
- **Auto Update**: Check for updates, download, and install automatically
- **Cross-Platform**: Windows, macOS, Linux support

## Prerequisites

- Node.js 22+
- pnpm 10+
- DeepSeek Harness built and installed (`pnpm run build` from repository root)

## Development

```bash
# Install dependencies
cd packages/desktop
pnpm install

# Start in development mode
pnpm run dev

# Start with external dsh web instance
pnpm run dev -- --external-dsh
```

## Icons

The desktop app uses colorful gradient icons inspired by the Reasonix design:

- **Main Icon** (`icon.png`): 256x256 with blue-purple gradient
- **Tray Icon** (`tray-icon.png`): 16x16 for system tray
- **SVG Source** (`icon-gradient.svg`): Vector source for icon generation

To regenerate icons from SVG:
1. Open `resources/icon-converter.html` in a browser
2. Click size buttons to download PNGs
3. Save as `icon.png`, `tray-icon.png`, etc.

Icon color scheme:
- Primary: `#667eea` (Blue)
- Secondary: `#764ba2` (Purple)
- Accent: `#f093fb` (Pink)
- Highlight: `#4facfe` (Light Blue)

## Build

```bash
# Build for current platform
pnpm run build

# Build for specific platform
pnpm run build:win    # Windows
pnpm run build:mac    # macOS
pnpm run build:linux  # Linux
```

Output will be in `dist/installers/`.

## Project Structure

```
packages/desktop/
├── src/main/              # Electron main process
│   ├── index.ts           # Main entry point
│   ├── window.ts          # Window management
│   ├── process.ts         # dsh web subprocess management
│   ├── tray.ts            # System tray
│   ├── menu.ts            # Native menu
│   ├── preload.ts         # Preload script (IPC bridge)
│   ├── ipc.ts             # IPC handlers
│   └── updater.ts         # Auto updater
├── resources/             # App resources (icons, entitlements)
├── scripts/               # Development scripts
├── electron-builder.yml   # Build configuration
├── package.json           # Project configuration
└── tsconfig.json          # TypeScript configuration
```

## Security

- Context Isolation enabled
- Node Integration disabled
- Sandboxed renderer
- CSP headers configured
- Only necessary APIs exposed via preload

## Platform Notes

### macOS
- Hidden title bar with inset traffic lights
- Native menu bar integration
- Dock menu support
- Hardened runtime with entitlements

### Windows
- Native title bar
- System tray with balloon notifications
- Jump list support
- NSIS installer

### Linux
- Native title bar
- System tray (appindicator)
- AppImage, DEB, RPM packages

## Troubleshooting

### dsh web fails to start
- Ensure the harness is built: `pnpm run build` from repository root
- Check that dsh is in PATH or bundled correctly

### Window not showing
- Check console for errors
- Try resetting window state: delete `~/.config/deepseek-harness/window-state.json`

### Auto-update not working
- Ensure the app is properly signed (macOS/Windows)
- Check network connectivity
- Verify update server configuration

## License

MIT

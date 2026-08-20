# DeepSeek Harness Desktop 开发指南

## 架构概览

Electron 包装器，将 `dsh web` Web GUI 加载到原生桌面窗口中。

```
┌─────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                │
│  ├── Window Management (BrowserWindow)          │
│  ├── System Tray (Tray)                         │
│  ├── dsh web 子进程管理                          │
│  ├── IPC Bridge (main ↔ renderer)               │
│  └── Auto Updater (electron-updater)            │
└───────────▲───────────────────────┬─────────────┘
     IPC Bridge            Child Process (dsh web)
┌───────────┴───────────────────────▼─────────────┐
│  Electron Renderer (Chromium)                    │
│  ├── 加载 http://localhost:<port> (dsh web)     │
│  └── 桥接 Desktop API (window.electronAPI)      │
└─────────────────────────────────────────────────┘
```

## 前提条件

- Node.js >= 22
- pnpm 10+
- 仓库根目录已完成 `pnpm install`
- 仓库根目录已完成构建: `pnpm run build`

## 快速开始

### 方式 1: 开发模式 (推荐)

```bash
# 在一个终端启动 dsh web
cd D:\DEV\tool\AI\deepseek-harness
pnpm dsh web --port 3080

# 在另一个终端启动桌面应用
cd packages/desktop
pnpm run dev
```

`dev` 脚本会自动:
1. 检测 dsh web 是否已在运行
2. 编译 TypeScript (主进程 + preload)
3. 启动 Electron 窗口

### 方式 2: 独立运行

直接运行解压版:
```
packages/desktop/dist/installers/win-unpacked/DeepSeek Harness.exe
```
此版本需要 dsh web 已在运行 (端口 3080)。

### 方式 3: 外部 dsh web

```bash
cd packages/desktop
pnpm run dev -- --external
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | 开发模式 (自动检测 dsh web) |
| `pnpm run dev -- --external` | 使用外部 dsh web |
| `pnpm run dev -- --port 3081` | 指定端口 |
| `pnpm run dev -- --debug` | 启用远程调试 (chrome://inspect) |
| `pnpm run build:electron` | 编译 TypeScript |
| `pnpm run build:electron:win` | 编译 + 打包 Windows |
| `pnpm run clean` | 清理构建产物 |

## 构建独立 exe

```bash
# 1. 确保前端已构建
cd D:\DEV\tool\AI\deepseek-harness
pnpm --filter @deepseek-ai/dsh-web-frontend build

# 2. 确保 CLI 已构建
pnpm --filter @deepseek-ai/dsh-cli build

# 3. 打包 dsh 到 resources/dsh
cd packages/desktop
pnpm run bundle:dsh

# 4. 编译 TypeScript
npx tsc
npx tsc -p tsconfig.preload.json

# 5. electron-builder 打包
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npx electron-builder --win --x64
```

输出位置:
- 解压版: `dist/installers/win-unpacked/DeepSeek Harness.exe`
- 安装包: `dist/installers/DeepSeek-Harness-*-win-x64.exe`

## 常见问题

### 1. dsh web 启动失败: profiles 损坏

错误信息:
```
Error: dsh: plugin tree failed to load: failed to apply loader entry include
```

解决:
```bash
# 删除损坏的 profiles 目录
Remove-Item -Recurse -Force "$env:USERPROFILE\.dsh\profiles\node_modules"
# 重新启动 dsh web
pnpm dsh web --port 3080
```

### 2. port 3080 被占用

```bash
# 查看占用端口的进程
netstat -ano | findstr :3080

# 停止该进程
Stop-Process -Id <PID> -Force
```

### 3. TypeScript 编译报错

```bash
# 确保在 packages/desktop 目录下
cd packages/desktop
npx tsc                    # 主进程
npx tsc -p tsconfig.preload.json  # preload (CommonJS)
```

### 4. electron-builder 找不到 electron

pnpm strict hoisting 导致 electron-builder 无法自动检测版本。
已通过 `electron-builder.yml` 中的 `electronVersion: 33.4.11` 固定解决。

## 文件结构

```
packages/desktop/
├── src/main/
│   ├── index.ts          # 主进程入口
│   ├── process.ts        # dsh web 子进程管理
│   ├── window.ts         # BrowserWindow 创建
│   ├── tray.ts           # 系统托盘
│   ├── menu.ts           # 原生菜单
│   ├── preload.ts        # preload 脚本 (CommonJS)
│   ├── ipc.ts            # IPC 处理
│   └── updater.ts        # 自动更新
├── scripts/
│   ├── dev.mjs           # 开发启动脚本
│   └── bundle-dsh.mjs   # dsh 打包脚本
├── resources/            # 图标、dsh 二进制
├── electron-builder.yml  # 打包配置
├── tsconfig.json         # TS 配置 (ESM)
└── tsconfig.preload.json # Preload TS 配置 (CommonJS)
```

## 图标

参考 Reasonix 风格的彩色渐变设计:
- `resources/icon-gradient.svg` - SVG 源文件
- `resources/icon.png` - 主图标
- `resources/tray-icon.png` - 托盘图标

配色: `#6366F1` → `#8B5CF6` → `#A855F7` (紫罗兰渐变) + `#38BDF8` → `#22D3EE` (蓝色横线)

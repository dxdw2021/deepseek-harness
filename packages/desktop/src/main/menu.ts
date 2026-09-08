/**
 * DeepSeek Harness Desktop - Native Menu
 *
 * Application menu bar:
 * - File menu (new session, open workspace, settings, quit)
 * - Edit menu (undo, redo, cut, copy, paste)
 * - View menu (reload, devtools, zoom, fullscreen)
 * - Window menu (minimize, zoom, close)
 * - Help menu (about, documentation)
 */

import { Menu, BrowserWindow, shell, app, dialog } from 'electron'

/**
 * Setup the native application menu.
 */
export function setupMenu(mainWindow: BrowserWindow, state: { webPort: number }): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    // File menu
    {
      label: '文件',
      submenu: [
        {
          label: '新建会话',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu:new-session')
          },
        },
        {
          label: '打开工作区...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu:open-workspace')
          },
        },
        { type: 'separator' },
        {
          label: '设置...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu:open-settings')
          },
        },
        { type: 'separator' },
        process.platform === 'darwin'
          ? { role: 'hide' }
          : { role: 'quit' },
      ],
    },

    // Edit menu
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'pasteAndMatchStyle' },
        { role: 'delete' },
        { role: 'selectAll' },
      ],
    },

    // View menu
    {
      label: '视图',
      submenu: [
        {
          label: '刷新',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.reload()
          },
        },
        {
          label: '强制刷新',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            mainWindow.webContents.reloadIgnoringCache()
          },
        },
        { type: 'separator' },
        {
          label: '开发者工具',
          accelerator: process.platform === 'darwin' ? 'Alt+Cmd+I' : 'Ctrl+Shift+I',
          click: () => {
            mainWindow.webContents.toggleDevTools()
          },
        },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Window menu
    {
      label: '窗口',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin'
          ? [
            { type: 'separator' as const },
            { role: 'front' as const },
          ]
          : []),
        { type: 'separator' },
        { role: 'close' },
      ],
    },

    // Help menu
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 DeepSeek Harness',
          click: () => {
            showAboutDialog()
          },
        },
        { type: 'separator' },
        {
          label: '文档',
          click: () => {
            shell.openExternal('https://deepseek-ai.github.io/deepseek-harness/')
          },
        },
        {
          label: 'GitHub',
          click: () => {
            shell.openExternal('https://github.com/deepseek-ai/deepseek-harness')
          },
        },
      ],
    },
  ]

  // macOS: add app menu at the beginning
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    })
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

/**
 * Show the About dialog.
 */
function showAboutDialog(): void {
  dialog.showMessageBox({
    type: 'info',
    title: '关于 DeepSeek Harness',
    message: 'DeepSeek Harness',
    detail: [
      `版本: ${app.getVersion()}`,
      `Electron: ${process.versions.electron}`,
      `Node.js: ${process.versions.node}`,
      `Chromium: ${process.versions.chrome}`,
      '',
      '基于插件的 AI Agent 开发框架',
    ].join('\n'),
    buttons: ['确定'],
  })
}

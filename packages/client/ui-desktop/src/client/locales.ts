/**
 * Desktop integration locale keys.
 */
export type DesktopKey =
  | 'desktop.version'
  | 'desktop.connected'
  | 'desktop.disconnected'
  | 'desktop.platform'
  | 'desktop.electron'
  | 'desktop.web'
  | 'palette.placeholder'
  | 'palette.noResults'
  | 'palette.newSession'
  | 'palette.openSettings'
  | 'palette.goToHistory'
  | 'palette.exportSession'
  | 'palette.toggleSidebar'
  | 'palette.shortcuts'
  | 'statusbar.model'
  | 'statusbar.connection'
  | 'statusbar.tokens'
  | 'statusbar.online'
  | 'statusbar.offline'

export const zh: Record<DesktopKey, string> = {
  'desktop.version': '版本 {{version}}',
  'desktop.connected': '已连接',
  'desktop.disconnected': '未连接',
  'desktop.platform': '桌面版',
  'desktop.electron': 'Electron',
  'desktop.web': 'Web',
  'palette.placeholder': '搜索命令…',
  'palette.noResults': '没有匹配结果',
  'palette.newSession': '新建会话',
  'palette.openSettings': '打开设置',
  'palette.goToHistory': '查看历史',
  'palette.exportSession': '导出会话',
  'palette.toggleSidebar': '切换侧边栏',
  'palette.shortcuts': '快捷键参考',
  'statusbar.model': '模型',
  'statusbar.connection': '连接',
  'statusbar.tokens': 'Token',
  'statusbar.online': '在线',
  'statusbar.offline': '离线',
}

export const en: Record<DesktopKey, string> = {
  'desktop.version': 'Version {{version}}',
  'desktop.connected': 'Connected',
  'desktop.disconnected': 'Disconnected',
  'desktop.platform': 'Desktop',
  'desktop.electron': 'Electron',
  'desktop.web': 'Web',
  'palette.placeholder': 'Search commands…',
  'palette.noResults': 'No matching results',
  'palette.newSession': 'New Session',
  'palette.openSettings': 'Open Settings',
  'palette.goToHistory': 'View History',
  'palette.exportSession': 'Export Session',
  'palette.toggleSidebar': 'Toggle Sidebar',
  'palette.shortcuts': 'Keyboard Shortcuts',
  'statusbar.model': 'Model',
  'statusbar.connection': 'Connection',
  'statusbar.tokens': 'Tokens',
  'statusbar.online': 'Online',
  'statusbar.offline': 'Offline',
}

/**
 * Tool Registry UI locales — Chinese and English translations.
 *
 * @module locales
 */

/** Locale key type */
export type ToolRegistryKey =
  | 'nav'
  | 'title'
  | 'description'
  | 'search'
  | 'search.placeholder'
  | 'filter.all'
  | 'filter.file'
  | 'filter.shell'
  | 'filter.task'
  | 'filter.network'
  | 'filter.search'
  | 'filter.code'
  | 'filter.memory'
  | 'filter.mcp'
  | 'filter.skill'
  | 'filter.subagent'
  | 'filter.workflow'
  | 'filter.custom'
  | 'tool.enabled'
  | 'tool.disabled'
  | 'tool.readOnly'
  | 'tool.streaming'
  | 'tool.permissions'
  | 'tool.usage'
  | 'tool.lastUsed'
  | 'status.loading'
  | 'status.error'
  | 'status.empty'
  | 'status.toolsCount'

/** Chinese translations */
export const zh: Record<ToolRegistryKey, string> = {
  'nav': '工具注册表',
  'title': '工具注册表管理',
  'description': '查看和管理所有已注册的工具，包括启用/禁用、权限和使用统计。',
  'search': '搜索工具',
  'search.placeholder': '输入工具名称或描述...',
  'filter.all': '全部',
  'filter.file': '文件操作',
  'filter.shell': 'Shell操作',
  'filter.task': '任务管理',
  'filter.network': '网络操作',
  'filter.search': '搜索操作',
  'filter.code': '代码操作',
  'filter.memory': '内存操作',
  'filter.mcp': 'MCP工具',
  'filter.skill': '技能工具',
  'filter.subagent': '子代理工具',
  'filter.workflow': '工作流工具',
  'filter.custom': '自定义工具',
  'tool.enabled': '已启用',
  'tool.disabled': '已禁用',
  'tool.readOnly': '只读',
  'tool.streaming': '流式传输',
  'tool.permissions': '权限',
  'tool.usage': '使用次数',
  'tool.lastUsed': '最后使用',
  'status.loading': '加载中...',
  'status.error': '加载失败',
  'status.empty': '没有找到工具',
  'status.toolsCount': '共 {count} 个工具',
}

/** English translations */
export const en: Record<ToolRegistryKey, string> = {
  'nav': 'Tool Registry',
  'title': 'Tool Registry Management',
  'description': 'View and manage all registered tools, including enable/disable, permissions, and usage statistics.',
  'search': 'Search Tools',
  'search.placeholder': 'Enter tool name or description...',
  'filter.all': 'All',
  'filter.file': 'File Operations',
  'filter.shell': 'Shell Operations',
  'filter.task': 'Task Management',
  'filter.network': 'Network Operations',
  'filter.search': 'Search Operations',
  'filter.code': 'Code Operations',
  'filter.memory': 'Memory Operations',
  'filter.mcp': 'MCP Tools',
  'filter.skill': 'Skill Tools',
  'filter.subagent': 'Subagent Tools',
  'filter.workflow': 'Workflow Tools',
  'filter.custom': 'Custom Tools',
  'tool.enabled': 'Enabled',
  'tool.disabled': 'Disabled',
  'tool.readOnly': 'Read Only',
  'tool.streaming': 'Streaming',
  'tool.permissions': 'Permissions',
  'tool.usage': 'Usage Count',
  'tool.lastUsed': 'Last Used',
  'status.loading': 'Loading...',
  'status.error': 'Failed to load',
  'status.empty': 'No tools found',
  'status.toolsCount': '{count} tools total',
}
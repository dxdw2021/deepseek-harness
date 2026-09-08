/**
 * Execution Mode UI locales — Chinese and English translations.
 *
 * @module locales
 */

/** Locale key type */
export type ExecutionModeKey =
  | 'nav'
  | 'title'
  | 'description'
  | 'currentMode'
  | 'mode.light'
  | 'mode.balanced'
  | 'mode.delivery'
  | 'mode.light.description'
  | 'mode.balanced.description'
  | 'mode.delivery.description'
  | 'config.maxToolCalls'
  | 'config.enableStreaming'
  | 'config.enablePlanMode'
  | 'config.enableGoalMode'
  | 'config.enableSubagents'
  | 'config.enableEvidenceCollection'
  | 'config.enableStrictValidation'
  | 'config.enableModeSwitching'
  | 'actions.switch'
  | 'actions.save'
  | 'actions.cancel'
  | 'status.loading'
  | 'status.error'
  | 'status.success'

/** Chinese translations */
export const zh: Record<ExecutionModeKey, string> = {
  'nav': '执行模式',
  'title': '执行模式设置',
  'description': '配置代理的执行模式，影响工具调用、流式传输和协作行为。',
  'currentMode': '当前模式',
  'mode.light': '轻量模式',
  'mode.balanced': '平衡模式',
  'mode.delivery': '交付模式',
  'mode.light.description': '快速响应，最少工具调用，适合简单任务。',
  'mode.balanced.description': '平衡性能和功能，支持计划和目标模式。',
  'mode.delivery.description': '完整功能，支持证据收集和严格验证。',
  'config.maxToolCalls': '最大工具调用次数',
  'config.enableStreaming': '启用流式传输',
  'config.enablePlanMode': '启用计划模式',
  'config.enableGoalMode': '启用目标模式',
  'config.enableSubagents': '启用子代理',
  'config.enableEvidenceCollection': '启用证据收集',
  'config.enableStrictValidation': '启用严格验证',
  'config.enableModeSwitching': '允许切换模式',
  'actions.switch': '切换模式',
  'actions.save': '保存配置',
  'actions.cancel': '取消',
  'status.loading': '加载中...',
  'status.error': '加载失败',
  'status.success': '保存成功',
}

/** English translations */
export const en: Record<ExecutionModeKey, string> = {
  'nav': 'Execution Mode',
  'title': 'Execution Mode Settings',
  'description': 'Configure the agent execution mode, affecting tool calls, streaming, and collaboration behavior.',
  'currentMode': 'Current Mode',
  'mode.light': 'Light Mode',
  'mode.balanced': 'Balanced Mode',
  'mode.delivery': 'Delivery Mode',
  'mode.light.description': 'Fast response, minimal tool calls, suitable for simple tasks.',
  'mode.balanced.description': 'Balanced performance and features, supports plan and goal modes.',
  'mode.delivery.description': 'Full features, supports evidence collection and strict validation.',
  'config.maxToolCalls': 'Max Tool Calls',
  'config.enableStreaming': 'Enable Streaming',
  'config.enablePlanMode': 'Enable Plan Mode',
  'config.enableGoalMode': 'Enable Goal Mode',
  'config.enableSubagents': 'Enable Subagents',
  'config.enableEvidenceCollection': 'Enable Evidence Collection',
  'config.enableStrictValidation': 'Enable Strict Validation',
  'config.enableModeSwitching': 'Allow Mode Switching',
  'actions.switch': 'Switch Mode',
  'actions.save': 'Save Configuration',
  'actions.cancel': 'Cancel',
  'status.loading': 'Loading...',
  'status.error': 'Failed to load',
  'status.success': 'Saved successfully',
}
/**
 * Dual Model UI locales — Chinese and English translations.
 *
 * @module locales
 */

/** Locale key type */
export type DualModelKey =
  | 'nav'
  | 'title'
  | 'description'
  | 'enabled'
  | 'executor'
  | 'planner'
  | 'strategy'
  | 'strategy.sequential'
  | 'strategy.parallel'
  | 'strategy.iterative'
  | 'strategy.adaptive'
  | 'strategy.sequential.description'
  | 'strategy.parallel.description'
  | 'strategy.iterative.description'
  | 'strategy.adaptive.description'
  | 'config.provider'
  | 'config.model'
  | 'config.maxTokens'
  | 'config.temperature'
  | 'actions.save'
  | 'actions.cancel'
  | 'status.loading'
  | 'status.error'
  | 'status.success'

/** Chinese translations */
export const zh: Record<DualModelKey, string> = {
  'nav': '双模型协作',
  'title': '双模型协作设置',
  'description': '配置Executor和Planner模型的协作方式，优化复杂任务的执行。',
  'enabled': '启用双模型协作',
  'executor': '执行器模型',
  'planner': '规划器模型',
  'strategy': '协作策略',
  'strategy.sequential': '顺序执行',
  'strategy.parallel': '并行执行',
  'strategy.iterative': '迭代执行',
  'strategy.adaptive': '自适应执行',
  'strategy.sequential.description': '规划器先生成计划，然后执行器逐步执行。',
  'strategy.parallel.description': '两个模型同时工作，提高执行效率。',
  'strategy.iterative.description': '规划器和执行器交替工作，逐步优化结果。',
  'strategy.adaptive.description': '根据任务复杂度自动选择最佳策略。',
  'config.provider': '提供商',
  'config.model': '模型',
  'config.maxTokens': '最大Token数',
  'config.temperature': '温度',
  'actions.save': '保存配置',
  'actions.cancel': '取消',
  'status.loading': '加载中...',
  'status.error': '加载失败',
  'status.success': '保存成功',
}

/** English translations */
export const en: Record<DualModelKey, string> = {
  'nav': 'Dual Model',
  'title': 'Dual Model Settings',
  'description': 'Configure Executor and Planner model collaboration for optimized complex task execution.',
  'enabled': 'Enable Dual Model',
  'executor': 'Executor Model',
  'planner': 'Planner Model',
  'strategy': 'Collaboration Strategy',
  'strategy.sequential': 'Sequential',
  'strategy.parallel': 'Parallel',
  'strategy.iterative': 'Iterative',
  'strategy.adaptive': 'Adaptive',
  'strategy.sequential.description': 'Planner generates plan first, then Executor executes step by step.',
  'strategy.parallel.description': 'Both models work simultaneously for improved efficiency.',
  'strategy.iterative.description': 'Planner and Executor alternate work, gradually optimizing results.',
  'strategy.adaptive.description': 'Automatically selects the best strategy based on task complexity.',
  'config.provider': 'Provider',
  'config.model': 'Model',
  'config.maxTokens': 'Max Tokens',
  'config.temperature': 'Temperature',
  'actions.save': 'Save Configuration',
  'actions.cancel': 'Cancel',
  'status.loading': 'Loading...',
  'status.error': 'Failed to load',
  'status.success': 'Saved successfully',
}
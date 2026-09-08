/** `trajectory` namespace dictionaries (view tab label + toolbar strings). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'trajectory'

/** The trajectory dictionary key set (the source of truth for both locales). */
export type TrajectoryKey =
  | 'view.trajectory'
  | 'toolbar.aria'
  | 'toolbar.duration'
  | 'toolbar.useActualDuration'
  | 'toolbar.useEqualWidth'
  | 'toolbar.actualTime'
  | 'toolbar.turns'
  | 'toolbar.expandTurns'
  | 'toolbar.collapseTurns'
  | 'toolbar.calls'
  | 'toolbar.expandCalls'
  | 'toolbar.collapseCalls'
  | 'toolbar.search'
  | 'toolbar.searchPlaceholder'
  | 'table.notAvailable'
  | 'table.notRecorded'
  | 'table.usageUnavailable'
  | 'table.betweenTurns'
  | 'table.turn'
  | 'table.noContent'
  | 'table.noOutput'
  | 'table.openImage'
  | 'table.timingSource'
  | 'table.sessionTimestamps'
  | 'table.sessionTimestampsRunning'
  | 'details.aria'
  | 'details.close'
  | 'details.tabs'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The trajectory view tab label and toolbar strings. */
    'trajectory': TrajectoryKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<TrajectoryKey, string> = {
  'view.trajectory': '轨迹',
  'toolbar.aria': '轨迹工具栏',
  'toolbar.duration': '时长',
  'toolbar.useActualDuration': '使用实际时长',
  'toolbar.useEqualWidth': '使用等宽操作',
  'toolbar.actualTime': '实际时间',
  'toolbar.turns': '轮次',
  'toolbar.expandTurns': '展开轮次',
  'toolbar.collapseTurns': '收起轮次',
  'toolbar.calls': '调用',
  'toolbar.expandCalls': '展开调用',
  'toolbar.collapseCalls': '收起调用',
  'toolbar.search': '搜索轨迹',
  'toolbar.searchPlaceholder': '搜索',
  'table.notAvailable': '不可用',
  'table.notRecorded': '未记录',
  'table.usageUnavailable': '用量不可用',
  'table.betweenTurns': '轮次之间',
  'table.turn': '第 {turn} 轮',
  'table.noContent': '无内容',
  'table.noOutput': '无输出',
  'table.openImage': '打开图片',
  'table.timingSource': '计时来源',
  'table.sessionTimestamps': '会话时间戳',
  'table.sessionTimestampsRunning': '会话时间戳（运行中）',
  'details.aria': '事件详情',
  'details.close': '关闭详情',
  'details.tabs': '事件详情',
}

/** English dictionary. */
export const en: Record<TrajectoryKey, string> = {
  'view.trajectory': 'Trajectory',
  'toolbar.aria': 'Trajectory toolbar',
  'toolbar.duration': 'Duration',
  'toolbar.useActualDuration': 'Use actual duration',
  'toolbar.useEqualWidth': 'Use equal-width operations',
  'toolbar.actualTime': 'Actual time',
  'toolbar.turns': 'Turns',
  'toolbar.expandTurns': 'Expand turns',
  'toolbar.collapseTurns': 'Collapse turns',
  'toolbar.calls': 'Calls',
  'toolbar.expandCalls': 'Expand calls',
  'toolbar.collapseCalls': 'Collapse calls',
  'toolbar.search': 'Search trajectory',
  'toolbar.searchPlaceholder': 'Search',
  'table.notAvailable': 'Not available',
  'table.notRecorded': 'Not recorded',
  'table.usageUnavailable': 'Usage unavailable',
  'table.betweenTurns': 'Between turns',
  'table.turn': 'Turn {turn}',
  'table.noContent': 'No content',
  'table.noOutput': 'No output',
  'table.openImage': 'Open image',
  'table.timingSource': 'Timing source',
  'table.sessionTimestamps': 'Session timestamps',
  'table.sessionTimestampsRunning': 'Session timestamps (running)',
  'details.aria': 'Event details',
  'details.close': 'Close details',
  'details.tabs': 'Event details',
}

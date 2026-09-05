/**
 * Simplified-Chinese translations for host-registered command descriptions.
 *
 * Host commands (`ctx.commands.register`) ship a plain-English `description`
 * string through the `command.list` Remote; the client has no i18n key to
 * look up, so this map keys the exact English source to its zh rendering. When
 * the active locale is `zh`, `CommandUiRuntime.candidates` substitutes the
 * Chinese text; any description absent here passes through unchanged (English
 * fallback). Client-only contributions (e.g. `/model`) already localize their
 * own description through the locale framework and are not listed here.
 */

/** Host command English description → Simplified Chinese. */
export const hostCommandDescriptionZh: Readonly<Record<string, string>> = {
  'Compact older conversation history': '压缩较早的对话历史',
  'Download this Session log as a ZIP archive': '下载当前会话日志为 ZIP 压缩包',
  'record feedback about this session': '记录对本次会话的反馈',
  'set or view the goal for a long-running task': '设置或查看长期任务的目标',
  'Switch the permission preset (sandbox mode + approval policy)': '切换权限预设（沙箱模式 + 审批策略）',
  'Enter or leave plan mode': '进入或退出计划模式',
}

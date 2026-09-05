/**
 * Permission Management UI locales — Chinese and English translations.
 *
 * @module locales
 */

/** Locale key type */
export type PermissionManagementKey =
  | 'nav'
  | 'title'
  | 'description'
  | 'tabs.rules'
  | 'tabs.audit'
  | 'rules.create'
  | 'rules.delete'
  | 'rules.enable'
  | 'rules.disable'
  | 'rules.resourceType'
  | 'rules.resourcePattern'
  | 'rules.actions'
  | 'rules.priority'
  | 'rules.enabled'
  | 'rules.disabled'
  | 'audit.granted'
  | 'audit.denied'
  | 'audit.user'
  | 'audit.resource'
  | 'audit.action'
  | 'audit.timestamp'
  | 'audit.reason'
  | 'status.loading'
  | 'status.error'
  | 'status.empty'
  | 'status.rulesCount'
  | 'status.auditCount'

/** Chinese translations */
export const zh: Record<PermissionManagementKey, string> = {
  'nav': '权限管理',
  'title': '权限管理设置',
  'description': '管理权限规则和审计日志，控制对资源的访问。',
  'tabs.rules': '权限规则',
  'tabs.audit': '审计日志',
  'rules.create': '创建规则',
  'rules.delete': '删除规则',
  'rules.enable': '启用规则',
  'rules.disable': '禁用规则',
  'rules.resourceType': '资源类型',
  'rules.resourcePattern': '资源模式',
  'rules.actions': '允许操作',
  'rules.priority': '优先级',
  'rules.enabled': '已启用',
  'rules.disabled': '已禁用',
  'audit.granted': '已授权',
  'audit.denied': '已拒绝',
  'audit.user': '用户',
  'audit.resource': '资源',
  'audit.action': '操作',
  'audit.timestamp': '时间',
  'audit.reason': '原因',
  'status.loading': '加载中...',
  'status.error': '加载失败',
  'status.empty': '没有数据',
  'status.rulesCount': '共 {count} 条规则',
  'status.auditCount': '共 {count} 条日志',
}

/** English translations */
export const en: Record<PermissionManagementKey, string> = {
  'nav': 'Permission Management',
  'title': 'Permission Management Settings',
  'description': 'Manage permission rules and audit logs to control resource access.',
  'tabs.rules': 'Permission Rules',
  'tabs.audit': 'Audit Log',
  'rules.create': 'Create Rule',
  'rules.delete': 'Delete Rule',
  'rules.enable': 'Enable Rule',
  'rules.disable': 'Disable Rule',
  'rules.resourceType': 'Resource Type',
  'rules.resourcePattern': 'Resource Pattern',
  'rules.actions': 'Allowed Actions',
  'rules.priority': 'Priority',
  'rules.enabled': 'Enabled',
  'rules.disabled': 'Disabled',
  'audit.granted': 'Granted',
  'audit.denied': 'Denied',
  'audit.user': 'User',
  'audit.resource': 'Resource',
  'audit.action': 'Action',
  'audit.timestamp': 'Timestamp',
  'audit.reason': 'Reason',
  'status.loading': 'Loading...',
  'status.error': 'Failed to load',
  'status.empty': 'No data found',
  'status.rulesCount': '{count} rules total',
  'status.auditCount': '{count} entries total',
}
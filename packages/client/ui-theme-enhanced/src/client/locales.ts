/**
 * Theme Enhanced UI locales — Chinese and English translations.
 *
 * @module locales
 */

/** Locale key type */
export type ThemeEnhancedKey =
  | 'nav'
  | 'title'
  | 'description'
  | 'currentTheme'
  | 'preview'
  | 'edit'
  | 'save'
  | 'cancel'
  | 'delete'
  | 'createCustom'
  | 'colors.primary'
  | 'colors.secondary'
  | 'colors.background'
  | 'colors.surface'
  | 'colors.text'
  | 'colors.textSecondary'
  | 'colors.border'
  | 'colors.error'
  | 'colors.warning'
  | 'colors.success'
  | 'colors.info'
  | 'status.loading'
  | 'status.error'
  | 'status.success'
  | 'status.customTheme'

/** Chinese translations */
export const zh: Record<ThemeEnhancedKey, string> = {
  'nav': '主题增强',
  'title': '主题增强设置',
  'description': '管理自定义主题，预览和编辑主题颜色。',
  'currentTheme': '当前主题',
  'preview': '预览',
  'edit': '编辑',
  'save': '保存',
  'cancel': '取消',
  'delete': '删除',
  'createCustom': '创建自定义主题',
  'colors.primary': '主色调',
  'colors.secondary': '次要颜色',
  'colors.background': '背景色',
  'colors.surface': '表面色',
  'colors.text': '文本色',
  'colors.textSecondary': '次要文本色',
  'colors.border': '边框色',
  'colors.error': '错误色',
  'colors.warning': '警告色',
  'colors.success': '成功色',
  'colors.info': '信息色',
  'status.loading': '加载中...',
  'status.error': '加载失败',
  'status.success': '保存成功',
  'status.customTheme': '自定义主题',
}

/** English translations */
export const en: Record<ThemeEnhancedKey, string> = {
  'nav': 'Theme Enhanced',
  'title': 'Theme Enhanced Settings',
  'description': 'Manage custom themes, preview and edit theme colors.',
  'currentTheme': 'Current Theme',
  'preview': 'Preview',
  'edit': 'Edit',
  'save': 'Save',
  'cancel': 'Cancel',
  'delete': 'Delete',
  'createCustom': 'Create Custom Theme',
  'colors.primary': 'Primary Color',
  'colors.secondary': 'Secondary Color',
  'colors.background': 'Background Color',
  'colors.surface': 'Surface Color',
  'colors.text': 'Text Color',
  'colors.textSecondary': 'Secondary Text Color',
  'colors.border': 'Border Color',
  'colors.error': 'Error Color',
  'colors.warning': 'Warning Color',
  'colors.success': 'Success Color',
  'colors.info': 'Info Color',
  'status.loading': 'Loading...',
  'status.error': 'Failed to load',
  'status.success': 'Saved successfully',
  'status.customTheme': 'Custom Theme',
}
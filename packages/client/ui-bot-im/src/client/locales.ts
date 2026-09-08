/**
 * Bot/IM Integration UI locales — Chinese and English translations.
 *
 * @module locales
 */

/** Locale key type */
export type BotImKey =
  | 'nav'
  | 'title'
  | 'description'
  | 'platform.feishu'
  | 'platform.lark'
  | 'platform.wechat'
  | 'platform.qq'
  | 'platform.telegram'
  | 'platform.slack'
  | 'platform.discord'
  | 'platform.enabled'
  | 'platform.disabled'
  | 'platform.connected'
  | 'platform.disconnected'
  | 'config.appId'
  | 'config.appSecret'
  | 'config.verificationToken'
  | 'config.webhookUrl'
  | 'config.botName'
  | 'config.commandPrefix'
  | 'config.enableAutoReply'
  | 'config.autoReplyMessage'
  | 'actions.testConnection'
  | 'actions.save'
  | 'status.loading'
  | 'status.error'
  | 'status.connected'
  | 'status.disconnected'

/** Chinese translations */
export const zh: Record<BotImKey, string> = {
  'nav': 'Bot/IM集成',
  'title': 'Bot/IM集成设置',
  'description': '配置与消息平台的集成，如飞书、微信、QQ等。',
  'platform.feishu': '飞书',
  'platform.lark': 'Lark',
  'platform.wechat': '微信',
  'platform.qq': 'QQ',
  'platform.telegram': 'Telegram',
  'platform.slack': 'Slack',
  'platform.discord': 'Discord',
  'platform.enabled': '已启用',
  'platform.disabled': '已禁用',
  'platform.connected': '已连接',
  'platform.disconnected': '未连接',
  'config.appId': 'App ID',
  'config.appSecret': 'App Secret',
  'config.verificationToken': '验证令牌',
  'config.webhookUrl': 'Webhook URL',
  'config.botName': '机器人名称',
  'config.commandPrefix': '命令前缀',
  'config.enableAutoReply': '启用自动回复',
  'config.autoReplyMessage': '自动回复消息',
  'actions.testConnection': '测试连接',
  'actions.save': '保存配置',
  'status.loading': '加载中...',
  'status.error': '加载失败',
  'status.connected': '连接成功',
  'status.disconnected': '连接失败',
}

/** English translations */
export const en: Record<BotImKey, string> = {
  'nav': 'Bot/IM Integration',
  'title': 'Bot/IM Integration Settings',
  'description': 'Configure integrations with messaging platforms like Feishu, WeChat, QQ, etc.',
  'platform.feishu': 'Feishu',
  'platform.lark': 'Lark',
  'platform.wechat': 'WeChat',
  'platform.qq': 'QQ',
  'platform.telegram': 'Telegram',
  'platform.slack': 'Slack',
  'platform.discord': 'Discord',
  'platform.enabled': 'Enabled',
  'platform.disabled': 'Disabled',
  'platform.connected': 'Connected',
  'platform.disconnected': 'Disconnected',
  'config.appId': 'App ID',
  'config.appSecret': 'App Secret',
  'config.verificationToken': 'Verification Token',
  'config.webhookUrl': 'Webhook URL',
  'config.botName': 'Bot Name',
  'config.commandPrefix': 'Command Prefix',
  'config.enableAutoReply': 'Enable Auto Reply',
  'config.autoReplyMessage': 'Auto Reply Message',
  'actions.testConnection': 'Test Connection',
  'actions.save': 'Save Configuration',
  'status.loading': 'Loading...',
  'status.error': 'Failed to load',
  'status.connected': 'Connected successfully',
  'status.disconnected': 'Connection failed',
}
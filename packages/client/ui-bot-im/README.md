# @deepseek-ai/dsh-client-ui-bot-im

English | [中文](README.zh.md)

Bot/IM Integration settings UI plugin — registers the Bot/IM settings section for configuring messaging platform integrations.

## Features

- **Platform Configuration**: Configure multiple messaging platforms
- **Enable/Disable**: Toggle individual platforms on/off
- **Connection Status**: View connection status for each platform
- **Test Connection**: Test platform connectivity
- **Global Settings**: Configure command prefix and auto-reply settings

## Supported Platforms

- **Feishu**: 飞书企业协作平台
- **Lark**: Lark international version
- **WeChat**: 微信公众平台
- **QQ**: QQ机器人
- **Telegram**: Telegram Bot API
- **Slack**: Slack App
- **Discord**: Discord Bot

## Integration

This plugin registers into the `settings.section` slot with:
- `id: 'bot-im'`
- `order: 50` (positioned after Permission Management section)

## Host Communication

The plugin communicates with the Host through the settings API:
- **Read**: `settings.read('bot-im')` — loads platform configurations
- **Write**: `settings.write('bot-im', data)` — saves configuration changes

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No real-time connection status** — connection status requires manual refresh
- **No message history** — message logs are not displayed in this UI
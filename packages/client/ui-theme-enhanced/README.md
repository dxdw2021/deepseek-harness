# @deepseek-ai/dsh-client-ui-theme-enhanced

English | [中文](README.zh.md)

Theme Enhanced settings UI plugin — registers the Theme Enhanced settings section for custom theme management and preview.

## Features

- **Theme Selection**: Choose from built-in and custom themes
- **Theme Preview**: Preview themes before applying
- **Custom Theme Creation**: Create new custom themes
- **Color Editing**: Edit individual theme colors
- **Theme Management**: Delete custom themes

## Built-in Themes

- **Light**: Default light theme
- **Dark**: Default dark theme
- **System**: Follows system preference

## Custom Themes

Create custom themes by:
1. Clicking "Create Custom Theme"
2. Editing color values in the color picker
3. Saving the theme
4. Selecting it as the active theme

## Integration

This plugin registers into the `settings.section` slot with:
- `id: 'theme-enhanced'`
- `order: 60` (positioned after Bot/IM section)

## Host Communication

The plugin communicates with the Host through the settings API:
- **Read**: `settings.read('theme-enhanced')` — loads theme list and current theme
- **Write**: `settings.write('theme-enhanced', data)` — saves theme changes

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No theme import/export** — themes cannot be shared between instances
- **No theme validation** — color values are not validated against accessibility standards
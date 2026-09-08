/**
 * Terminal TUI service for DeepSeek Harness.
 * Provides interactive terminal UI features including prompts, completion, and formatting.
 *
 * @module @deepseek-ai/dsh-terminal-tui
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

/** Prompt types */
export type PromptType = 'text' | 'password' | 'confirm' | 'select' | 'multiselect' | 'autocomplete'

/** Prompt option */
export interface PromptOption {
  /** Option value */
  value: string
  /** Option label */
  label: string
  /** Option description */
  description?: string
  /** Whether option is disabled */
  disabled?: boolean
}

/** Prompt configuration */
export interface PromptConfig {
  /** Prompt message */
  message: string
  /** Prompt type */
  type: PromptType
  /** Default value */
  defaultValue?: unknown
  /** Options for select/multiselect */
  options?: PromptOption[]
  /** Validation function */
  validate?: (value: unknown) => boolean | string
  /** Completion function for autocomplete */
  completions?: (input: string) => Promise<string[]>
  /** Placeholder text */
  placeholder?: string
  /** Whether prompt is required */
  required?: boolean
}

/** Prompt result */
export interface PromptResult {
  /** Whether prompt was answered */
  answered: boolean
  /** User's answer */
  value?: unknown
  /** Whether prompt was cancelled */
  cancelled: boolean
}

/** Progress bar configuration */
export interface ProgressConfig {
  /** Total steps */
  total: number
  /** Current step */
  current: number
  /** Progress message */
  message?: string
  /** Whether to show percentage */
  showPercentage?: boolean
  /** Whether to show bar */
  showBar?: boolean
  /** Bar width in characters */
  barWidth?: number
}

/** Table configuration */
export interface TableConfig {
  /** Column headers */
  headers: string[]
  /** Table rows */
  rows: unknown[][]
  /** Column widths */
  widths?: number[]
  /** Whether to show borders */
  borders?: boolean
  /** Alignment for each column */
  alignments?: ('left' | 'center' | 'right')[]
}

/** Spinner configuration */
export interface SpinnerConfig {
  /** Spinner message */
  message: string
  /** Spinner frames (ASCII art) */
  frames?: string[]
  /** Frame interval in milliseconds */
  interval?: number
}

/** Terminal TUI service definition */
export class TerminalTuiService extends Service {
  static inject = ['settings', 'commands']

  /** Configuration */
  private config = {
    enabled: true,
    enableColors: true,
    enableAnimations: true,
    defaultTimeout: 30000,
  }

  constructor(ctx: Context) {
    super(ctx, 'terminalTui')
  }

  /** Show a prompt and get user input */
  async prompt(config: PromptConfig): Promise<PromptResult> {
    if (!this.config.enabled) {
      return { answered: false, cancelled: true }
    }

    // In a real implementation, this would use readline or inquirer
    // For now, return a mock result
    return {
      answered: true,
      value: config.defaultValue,
      cancelled: false,
    }
  }

  /** Show a confirmation prompt */
  async confirm(message: string, defaultValue = false): Promise<boolean> {
    const result = await this.prompt({
      message,
      type: 'confirm',
      defaultValue,
    })

    return result.answered && result.value === true
  }

  /** Show a selection prompt */
  async select(message: string, options: PromptOption[]): Promise<string | undefined> {
    const result = await this.prompt({
      message,
      type: 'select',
      options,
    })

    return result.answered ? result.value as string : undefined
  }

  /** Show a multi-select prompt */
  async multiselect(message: string, options: PromptOption[]): Promise<string[]> {
    const result = await this.prompt({
      message,
      type: 'multiselect',
      options,
    })

    return result.answered ? result.value as string[] : []
  }

  /** Show autocomplete prompt */
  async autocomplete(message: string, completions: (input: string) => Promise<string[]>): Promise<string | undefined> {
    const result = await this.prompt({
      message,
      type: 'autocomplete',
      completions,
    })

    return result.answered ? result.value as string : undefined
  }

  /** Show progress bar */
  showProgress(config: ProgressConfig): void {
    if (!this.config.enabled || !this.config.enableAnimations) return

    const { total, current, message, showPercentage = true, showBar = true, barWidth = 30 } = config
    const percentage = Math.round((current / total) * 100)
    const filledWidth = Math.round((current / total) * barWidth)
    const emptyWidth = barWidth - filledWidth

    const filled = '█'.repeat(filledWidth)
    const empty = '░'.repeat(emptyWidth)

    let output = ''
    if (showBar) {
      output += `[${filled}${empty}]`
    }
    if (showPercentage) {
      output += ` ${percentage}%`
    }
    if (message) {
      output += ` ${message}`
    }

    process.stdout.write(`\r${output}`)

    if (current === total) {
      process.stdout.write('\n')
    }
  }

  /** Show spinner */
  showSpinner(config: SpinnerConfig): () => void {
    if (!this.config.enabled || !this.config.enableAnimations) {
      return () => {}
    }

    const { message, frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'], interval = 80 } = config

    let frameIndex = 0
    let running = true

    const render = () => {
      if (!running) return
      process.stdout.write(`\r${frames[frameIndex]} ${message}`)
      frameIndex = (frameIndex + 1) % frames.length
    }

    render()
    const timer = setInterval(render, interval)

    return () => {
      running = false
      clearInterval(timer)
      process.stdout.write('\r' + ' '.repeat(message.length + 10) + '\r')
    }
  }

  /** Format a table */
  formatTable(config: TableConfig): string {
    const { headers, rows, borders = true, alignments = [] } = config

    // Calculate column widths
    const widths = headers.map((header, i) => {
      const headerWidth = header.length
      const dataWidth = rows.reduce((max, row) => {
        const cellWidth = String(row[i] || '').length
        return Math.max(max, cellWidth)
      }, 0)
      return Math.max(headerWidth, dataWidth, config.widths?.[i] || 0)
    })

    // Format header
    const formatRow = (row: unknown[]) => {
      const cells = row.map((cell, i) => {
        const cellStr = String(cell || '')
        const width = widths[i] || 0
        const alignment = alignments[i] || 'left'

        if (alignment === 'center') {
          const padding = width - cellStr.length
          const leftPad = Math.floor(padding / 2)
          const rightPad = padding - leftPad
          return ' '.repeat(leftPad) + cellStr + ' '.repeat(rightPad)
        } else if (alignment === 'right') {
          return cellStr.padStart(width)
        } else {
          return cellStr.padEnd(width)
        }
      })

      return borders ? `│ ${cells.join(' │ ')} │` : cells.join('  ')
    }

    // Build table
    const lines: string[] = []

    if (borders) {
      const separator = '─'.repeat(widths.reduce((sum, w) => sum + w + 3, -1))
      lines.push(`┌${separator}┐`)
    }

    lines.push(formatRow(headers))

    if (borders) {
      const separator = '─'.repeat(widths.reduce((sum, w) => sum + w + 3, -1))
      lines.push(`├${separator}┤`)
    }

    for (const row of rows) {
      lines.push(formatRow(row))
    }

    if (borders) {
      const separator = '─'.repeat(widths.reduce((sum, w) => sum + w + 3, -1))
      lines.push(`└${separator}┘`)
    }

    return lines.join('\n')
  }

  /** Format a box */
  formatBox(content: string, options?: { title?: string; padding?: number }): string {
    const { title, padding = 1 } = options || {}
    const lines = content.split('\n')
    const maxWidth = Math.max(...lines.map(l => l.length), title?.length || 0)
    const totalWidth = maxWidth + padding * 2 + 2

    const result: string[] = []

    // Top border
    if (title) {
      const titlePadding = Math.floor((totalWidth - title.length - 2) / 2)
      result.push(`┌${'─'.repeat(titlePadding)} ${title} ${'─'.repeat(totalWidth - titlePadding - title.length - 2)}┐`)
    } else {
      result.push(`┌${'─'.repeat(totalWidth - 2)}┐`)
    }

    // Content
    for (const line of lines) {
      const paddedLine = ' '.repeat(padding) + line.padEnd(maxWidth) + ' '.repeat(padding)
      result.push(`│${paddedLine}│`)
    }

    // Bottom border
    result.push(`└${'─'.repeat(totalWidth - 2)}┘`)

    return result.join('\n')
  }

  /** Format text with colors */
  colorize(text: string, color: string): string {
    if (!this.config.enableColors) return text

    const colors: Record<string, string> = {
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
      gray: '\x1b[90m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      italic: '\x1b[3m',
      underline: '\x1b[4m',
    }

    const reset = '\x1b[0m'
    const colorCode = colors[color] || ''

    return `${colorCode}${text}${reset}`
  }

  /** Clear terminal */
  clear(): void {
    process.stdout.write('\x1Bc')
  }

  /** Move cursor to position */
  moveTo(x: number, y: number): void {
    process.stdout.write(`\x1B[${y};${x}H`)
  }

  /** Clear line */
  clearLine(): void {
    process.stdout.write('\x1B[2K\r')
  }

  /** Update configuration */
  updateConfig(config: Partial<typeof this.config>): void {
    this.config = { ...this.config, ...config }
    this.ctx.emit('terminal-tui/config-changed', this.config)
  }

  /** Get configuration */
  getConfig(): typeof this.config {
    return { ...this.config }
  }
}

/** Plugin configuration */
export interface Config {
  /** Enable terminal TUI */
  enabled?: boolean
  /** Enable colors */
  enableColors?: boolean
  /** Enable animations */
  enableAnimations?: boolean
  /** Default timeout in milliseconds */
  defaultTimeout?: number
}

/**
 * Create terminal TUI plugin.
 * @param config - plugin configuration.
 * @returns the Cordis plugin.
 */
export function createTerminalTuiPlugin(config: Config = {}): {
  name: string
  inject: string[]
  apply: (ctx: Context) => void
} {
  return {
    name: 'terminal-tui',
    inject: ['settings', 'commands'],
    apply(ctx) {
      const service = new TerminalTuiService(ctx)
      ctx.terminalTui = service

      // Apply configuration
      if (Object.keys(config).length > 0) {
        service.updateConfig(config)
      }

      // Register settings section
      ctx.effect(() => {
        const scope = ctx.settings.register(
          settingsNamespace('terminal-tui'),
          z.object({
            enabled: z.boolean().default(true),
            enableColors: z.boolean().default(true),
            enableAnimations: z.boolean().default(true),
            defaultTimeout: z.number().min(1000).max(300000).default(30000),
          }),
          {
            base: {
              enabled: true,
              enableColors: true,
              enableAnimations: true,
              defaultTimeout: 30000,
            },
          },
        )

        // Watch for settings changes
        scope.watch((next) => {
          service.updateConfig(next)
        })

        return () => {
          // Cleanup
        }
      })
    },
  }
}

// Type augmentation for Cordis context
declare module '@deepseek-ai/cordis' {
  interface Context {
    terminalTui: TerminalTuiService
  }
}

// Event declarations
declare module '@deepseek-ai/cordis' {
  interface Events {
    /**
     * Terminal TUI configuration changed.
     * @param config - new configuration.
     * @mode emit
     */
    'terminal-tui/config-changed'(config: { enabled: boolean; enableColors: boolean; enableAnimations: boolean; defaultTimeout: number }): void
  }
}

export { TerminalTuiService as Service }

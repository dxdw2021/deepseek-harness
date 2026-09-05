import { Check, X, Wrench } from 'lucide-react'
import type { ToolCall } from '../types'

export function ToolRow({ tool }: { tool: ToolCall }) {
  return (
    <div className="tool-row">
      <Wrench size={13} style={{ color: 'var(--text-faint)' }} />
      <span className="tool-row__name">{tool.name}</span>
      <span className="tool-row__args">{tool.args}</span>
      <span className={`tool-row__status tool-row__status--${tool.status}`}>
        {tool.status === 'running' && <span className="spinner" style={{ display: 'inline-block' }} />}
        {tool.status === 'success' && <Check size={13} />}
        {tool.status === 'error' && <X size={13} />}
        {tool.status === 'pending' && '等待'}
        {tool.status === 'success' && (tool.durationMs ? ` ${tool.durationMs}ms` : ' 完成')}
      </span>
    </div>
  )
}

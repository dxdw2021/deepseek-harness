import { useState } from 'react'
import { ChevronRight, Sparkles } from 'lucide-react'
import type { ReasoningSummary } from '../types'

export function ReasoningCard({ summary }: { summary: ReasoningSummary }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="summary-card">
      <div className="summary-card__head" onClick={() => setOpen(v => !v)}>
        <ChevronRight size={15} className={`summary-card__chevron ${open ? 'summary-card__chevron--open' : ''}`} />
        <Sparkles size={14} style={{ color: 'var(--accent)' }} />
        <span>{summary.headline}</span>
        <span className="summary-card__badge">
          {summary.toolsCount} 个工具 · {summary.thinkingCount} 段思考
        </span>
      </div>
      {open && summary.detail && (
        <div className="summary-card__detail">
          <p>{summary.detail}</p>
        </div>
      )}
    </div>
  )
}

import { useMemo, useState, type CSSProperties } from 'react'
import { BarChart3, FileText, FolderOpen, GitCompare, Wrench } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Message, ToolCall } from '../types'

/**
 * Right-side inspector pane. Toggled by the PanelRight button in the top-right
 * chrome (store.inspectorOpen) and switchable between three tabs:
 *
 *  - overview: live session metrics, context ring and token distribution
 *  - files:    file paths referenced by tool calls in the current transcript
 *  - changes:  tool-call log (reference to DeepSeek-GUI ChangeInspector), with
 *              an expandable detail strip for the selected call
 *
 * The pane is an `aside` on the right edge of `.app__body`; the existing
 * `.inspector` styles in app.css drive its layout and collapse animation.
 */

type InspectorTab = 'overview' | 'files' | 'changes'

const TABS: { id: InspectorTab; label: string }[] = [
  { id: 'overview', label: '概览' },
  { id: 'files', label: '文件' },
  { id: 'changes', label: '变更' },
]

function formatTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rest = Math.round(s % 60)
  return `${m}m ${rest}s`
}

function formatCost(n: number): string {
  if (n === 0) return '$0'
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(3)}`
}

// File extensions commonly produced by harness tool calls; used to pull
// candidate paths out of tool args/results for the files tab. The `*` is
// included so glob patterns like `**/*.syso` or `build/*.syso` are captured.
const FILE_EXT =
  '(?:syso|exe|go|ts|tsx|js|jsx|json|css|html?|py|rs|toml|ya?ml|md|txt|conf|ini|cfg|c|h|cpp|java|sql|png|jpe?g|svg|bat|ps1|sh|dll|a|lib|so|zip)'
const FILE_RE = new RegExp(`[\\w@./*\\\\-]+\\.${FILE_EXT}`, 'g')

interface FileHit {
  path: string
  count: number
  tools: string[]
}

function collectFiles(messages: Message[]): FileHit[] {
  const hits = new Map<string, FileHit>()
  for (const m of messages) {
    for (const tool of m.tools ?? []) {
      const text = `${tool.args} ${tool.result ?? ''}`
      for (const raw of text.match(FILE_RE) ?? []) {
        const path = raw.replace(/^\.\//, '').trim()
        if (!path) continue
        const hit = hits.get(path) ?? { path, count: 0, tools: [] }
        hit.count += 1
        if (!hit.tools.includes(tool.name)) hit.tools.push(tool.name)
        hits.set(path, hit)
      }
    }
  }
  return [...hits.values()].sort((a, b) => b.count - a.count)
}

interface ChangeItem {
  tool: ToolCall
  messageId: string
}

function collectChanges(messages: Message[]): ChangeItem[] {
  const items: ChangeItem[] = []
  for (const m of messages) {
    for (const tool of m.tools ?? []) {
      items.push({ tool, messageId: m.id })
    }
  }
  return items
}

function TabIcon({ id }: { id: InspectorTab }) {
  if (id === 'overview') return <BarChart3 size={13} />
  if (id === 'files') return <FolderOpen size={13} />
  return <GitCompare size={13} />
}

export function Inspector() {
  const open = useStore(s => s.inspectorOpen)
  const tab = useStore(s => s.inspectorTab)
  const setTab = useStore(s => s.setInspectorTab)
  const context = useStore(s => s.context)
  const metrics = useStore(s => s.metrics)
  const tokenUsage = useStore(s => s.tokenUsage)
  const messages = useStore(s => s.messages)
  const [selectedChange, setSelectedChange] = useState<string | null>(null)

  const files = useMemo(() => collectFiles(messages), [messages])
  const changes = useMemo(() => collectChanges(messages), [messages])
  const activeChange = changes.find(c => c.tool.id === selectedChange) ?? null

  const totalSource = tokenUsage.bySource.reduce((n, s) => n + s.tokens, 0)
  const totalType = tokenUsage.byType.reduce((n, s) => n + s.tokens, 0)

  return (
    <aside className={open ? 'inspector' : 'inspector inspector--closed'} aria-hidden={!open}>
      <div className="inspector__tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`inspector__tab ${tab === t.id ? 'inspector__tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <TabIcon id={t.id} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="inspector__body">
        {tab === 'overview' && (
          <>
            <div className="panel-block">
              <div className="panel-block__title">上下文用量</div>
              <div className="ring-wrap">
                <div className="ring" style={{ '--pct': context.usedPct } as CSSProperties}>
                  <div className="ring__inner">{context.usedPct}%</div>
                </div>
                <div className="inspector-ring-meta">
                  <span>
                    <b>{formatTokens(context.usedTokens)}</b> / {formatTokens(context.capacityTokens)} tokens
                  </span>
                  <span>
                    压缩阈值 {context.compactionThresholdPct}%
                    {context.usedPct >= context.compactionThresholdPct ? ' · 建议压缩' : ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="panel-block">
              <div className="panel-block__title">会话指标</div>
              <div className="metric-grid">
                <div className="metric">
                  <div className="metric__label">缓存命中</div>
                  <div className="metric__value">{metrics.cacheHitPct}%</div>
                </div>
                <div className="metric">
                  <div className="metric__label">累计成本</div>
                  <div className="metric__value">{formatCost(metrics.cost)}</div>
                </div>
                <div className="metric">
                  <div className="metric__label">运行时长</div>
                  <div className="metric__value">{formatMs(metrics.runTimeMs)}</div>
                </div>
                <div className="metric">
                  <div className="metric__label">请求数</div>
                  <div className="metric__value">{metrics.requestCount}</div>
                </div>
                <div className="metric">
                  <div className="metric__label">总 Token</div>
                  <div className="metric__value">{formatTokens(metrics.totalTokens)}</div>
                </div>
                <div className="metric">
                  <div className="metric__label">轮次</div>
                  <div className="metric__value">{metrics.turns}</div>
                </div>
              </div>
            </div>

            <div className="panel-block">
              <div className="panel-block__title">Token 分布 · 按来源</div>
              {totalSource > 0 ? (
                <>
                  <div className="token-bar">
                    {tokenUsage.bySource.map(s => (
                      <div
                        key={s.label}
                        className="token-bar__seg"
                        style={{ width: `${(s.tokens / totalSource) * 100}%`, background: s.color }}
                        title={`${s.label} · ${formatTokens(s.tokens)}`}
                      />
                    ))}
                  </div>
                  <div className="legend">
                    {tokenUsage.bySource.map(s => (
                      <div key={s.label} className="legend__row">
                        <span className="legend__dot" style={{ background: s.color }} />
                        <span>{s.label}</span>
                        <span className="inspector-legend-tokens">{formatTokens(s.tokens)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="inspector-empty">暂无 Token 数据</div>
              )}
            </div>

            <div className="panel-block">
              <div className="panel-block__title">Token 分布 · 按类型</div>
              {totalType > 0 ? (
                <div className="legend">
                  {tokenUsage.byType.map(s => (
                    <div key={s.label} className="legend__row">
                      <span className="legend__dot" style={{ background: s.color }} />
                      <span>{s.label}</span>
                      <span className="inspector-legend-tokens">{formatTokens(s.tokens)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="inspector-empty">暂无 Token 数据</div>
              )}
            </div>
          </>
        )}

        {tab === 'files' && (
          files.length === 0 ? (
            <div className="inspector-empty">
              <FolderOpen size={28} />
              <span>当前会话暂无文件操作</span>
            </div>
          ) : (
            <div className="inspector-file-list">
              {files.map(f => (
                <div key={f.path} className="inspector-file">
                  <FileText size={13} className="inspector-file__icon" />
                  <div className="inspector-file__main">
                    <div className="inspector-file__path">{f.path}</div>
                    <div className="inspector-file__meta">
                      {f.count} 次 · {f.tools.join(' / ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'changes' && (
          changes.length === 0 ? (
            <div className="inspector-empty">
              <GitCompare size={28} />
              <span>暂无变更记录</span>
            </div>
          ) : (
            <>
              <div className="inspector-change-list">
                {changes.map(c => (
                  <button
                    key={c.tool.id}
                    className={`change-item ${activeChange?.tool.id === c.tool.id ? 'change-item--active' : ''}`}
                    onClick={() => setSelectedChange(c.tool.id)}
                  >
                    <Wrench size={13} className="change-item__icon" />
                    <div className="change-item__main">
                      <div className="change-item__name">{c.tool.name}</div>
                      <div className="change-item__args">{c.tool.args}</div>
                    </div>
                    <span className={`change-item__status change-item__status--${c.tool.status}`}>
                      {c.tool.status === 'success' ? (c.tool.durationMs ? `${c.tool.durationMs}ms` : '完成') : c.tool.status}
                    </span>
                  </button>
                ))}
              </div>
              <div className="change-detail">
                {activeChange ? (
                  <>
                    <div className="change-detail__title">{activeChange.tool.name}</div>
                    <div className="change-detail__arg">{activeChange.tool.args}</div>
                    {activeChange.tool.result && (
                      <div className="change-detail__result">{activeChange.tool.result}</div>
                    )}
                  </>
                ) : (
                  <div className="inspector-empty">选择一条变更查看详情</div>
                )}
              </div>
            </>
          )
        )}
      </div>
    </aside>
  )
}

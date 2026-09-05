import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { BarChart3, ChevronRight, FileText, Folder, FolderOpen, FolderUp, GitCompare, Home, Loader2, Wrench } from 'lucide-react'
import { useStore } from '../lib/store'
import type { FileEntry, Message, ToolCall } from '../types'

/**
 * Right-side inspector pane. Toggled by the PanelRight button in the top-right
 * chrome (store.inspectorOpen) and switchable between three tabs:
 *
 *  - overview: live session metrics, context ring and token distribution
 *  - files:    project file browser rooted at the active session's cwd
 *              (`host.listFiles`, one level at a time with breadcrumbs)
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

/** Parent of a path: drop the last segment; stops at a drive root (`D:\`) or filesystem root (`/`). */
function parentPath(path: string): string {
  const norm = path.replace(/[\\/]+$/, '')
  const idx = Math.max(norm.lastIndexOf('/'), norm.lastIndexOf('\\'))
  if (idx <= 1) return path.replace(/[\\/]+$/, '') === '' ? path : norm.slice(0, idx + 1)
  return norm.slice(0, idx)
}

/** Breadcrumb chain of a path: `D:\a\b` → [`D:\`, `D:\a`, `D:\a\b`]. */
function breadcrumbs(path: string): string[] {
  const parts: string[] = []
  let cur = path
  for (;;) {
    parts.unshift(cur)
    const parent = parentPath(cur)
    if (parent === cur) break
    cur = parent
  }
  return parts
}

interface FileBrowserState {
  path?: string
  listing: FileEntry[] | null
  loading: boolean
  error: string | null
}

function FileBrowser({ root }: { root?: string }) {
  const listFiles = useStore(s => s.listFiles)
  const [state, setState] = useState<FileBrowserState>({ path: root, listing: null, loading: true, error: null })

  // Re-root when the active session changes.
  useEffect(() => {
    setState({ path: root, listing: null, loading: true, error: null })
  }, [root])

  useEffect(() => {
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: null }))
    listFiles(state.path)
      .then((l) => {
        if (!cancelled) setState({ path: l.path, listing: l.entries, loading: false, error: null })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : String(e) }))
      })
    return () => { cancelled = true }
  }, [state.path, listFiles])

  const crumbs = state.path ? breadcrumbs(state.path) : []
  const parent = state.path ? parentPath(state.path) : undefined

  if (state.loading && !state.listing) {
    return <div className="inspector-empty"><Loader2 size={20} className="spin" /><span>加载目录…</span></div>
  }
  if (state.error && !state.listing) {
    return <div className="inspector-empty"><span>无法读取目录：{state.error}</span></div>
  }

  return (
    <div className="inspector-files">
      <div className="inspector-files__head">
        {parent && (
          <button className="inspector-files__up" title="上级目录" onClick={() => setState({ path: parent, listing: null, loading: true, error: null })}>
            <FolderUp size={13} />
          </button>
        )}
        <div className="inspector-files__crumbs">
          {crumbs.map((c, i) => (
            <span key={c}>
              {i > 0 && <ChevronRight size={10} className="inspector-files__crumb-sep" />}
              <button
                className="inspector-files__crumb"
                title={c}
                onClick={() => setState({ path: c, listing: null, loading: true, error: null })}
              >
                {i === 0 ? <Home size={10} /> : c === state.path ? <span className="inspector-files__crumb-current">{i === crumbs.length - 1 ? c.split(/[\\/]/).pop() : c}</span> : c.split(/[\\/]/).pop()}
              </button>
            </span>
          ))}
        </div>
      </div>

      {state.loading && <div className="inspector-files__status"><Loader2 size={12} className="spin" /> 加载中…</div>}
      {state.error && <div className="inspector-files__status">读取失败：{state.error}</div>}

      {state.listing && state.listing.length === 0 && !state.loading && (
        <div className="inspector-empty"><FolderOpen size={22} /><span>空目录</span></div>
      )}

      <div className="inspector-files__list">
        {state.listing?.map(f => (
          <button
            key={f.path}
            className={`inspector-file ${f.isDirectory ? 'inspector-file--dir' : ''}`}
            onClick={() => { if (f.isDirectory) setState({ path: f.path, listing: null, loading: true, error: null }) }}
            title={f.path}
          >
            {f.isDirectory ? <Folder size={13} className="inspector-file__icon" /> : <FileText size={13} className="inspector-file__icon" />}
            <span className="inspector-file__path">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function Inspector() {
  const open = useStore(s => s.inspectorOpen)
  const tab = useStore(s => s.inspectorTab)
  const setTab = useStore(s => s.setInspectorTab)
  const context = useStore(s => s.context)
  const metrics = useStore(s => s.metrics)
  const tokenUsage = useStore(s => s.tokenUsage)
  const messages = useStore(s => s.messages)
  const sessions = useStore(s => s.sessions)
  const activeSessionId = useStore(s => s.activeSessionId)
  const [selectedChange, setSelectedChange] = useState<string | null>(null)

  const changes = useMemo(() => collectChanges(messages), [messages])
  const activeChange = changes.find(c => c.tool.id === selectedChange) ?? null
  const activeSession = sessions.find(s => s.id === activeSessionId)

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
          <>
            <div className="inspector-files__root">
              <FolderOpen size={12} />
              <span title={activeSession?.cwd ?? '未设置工作目录'}>
                {activeSession ? (activeSession.projectName === '未分组' && activeSession.cwd ? activeSession.cwd.split(/[\\/]/).pop() : activeSession.projectName) : '未选择会话'}
                {activeSession?.cwd && <span className="inspector-files__root-cwd">{activeSession.cwd}</span>}
              </span>
            </div>
            <FileBrowser root={activeSession?.cwd} />
          </>
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

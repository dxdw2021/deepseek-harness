import { useEffect, useRef, useState } from 'react'
import { PanelLeft, PanelRight, Search, Plus, Square, Minus, X, Loader2 } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import type { SessionSearchItem } from '../types'
import { useStore } from '../lib/store'

interface Props {
  sidebarCollapsed: boolean
  inspectorOpen: boolean
  onToggleSidebar: () => void
  onToggleInspector: () => void
  onNewTab: () => void
  onOpenPalette: () => void
  onOpenSettings: () => void
  /** Project name of the active session (shown as the top tab title). */
  activeProject?: string
  /** Working directory of the active session (shown as the tab tooltip). */
  activeCwd?: string
}

export function AppChrome({
  sidebarCollapsed,
  inspectorOpen,
  onToggleSidebar,
  onToggleInspector,
  onNewTab,
  onOpenPalette,
  onOpenSettings,
  activeProject,
  activeCwd,
}: Props) {
  const searchSessions = useStore(s => s.searchSessions)
  const selectSession = useStore(s => s.selectSession)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SessionSearchItem[]>([])
  const [searching, setSearching] = useState(false)
  const [focused, setFocused] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        setResults(await searchSessions(q))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, searchSessions])

  // Close the dropdown when clicking outside the search box.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setFocused(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const pickResult = (id: string) => {
    void selectSession(id)
    setQuery('')
    setResults([])
    setFocused(false)
  }

  return (
    <header className="app-chrome">
      <div className="app-chrome__brand">
        <BrandLogo />
        <span>Reasonix</span>
      </div>

      <button className="chrome-btn" title="新建会话" onClick={onNewTab}>
        <Plus size={16} />
      </button>

      <div className="tab-strip">
        <div className="tab tab--active" title={activeCwd ? `工作目录：${activeCwd}` : '默认工作目录'}>
          <span>{activeProject ?? '未选择项目'}</span>
          <button className="tab__close" title="关闭">
            <X size={12} />
          </button>
        </div>
      </div>

      <div className="app-chrome__spacer" />

      <div className="chrome-search" ref={boxRef}>
        <Search size={13} className="chrome-search__icon" />
        <input
          className="chrome-search__input"
          placeholder="搜索会话内容…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setQuery('')
              setResults([])
              setFocused(false)
            }
          }}
        />
        {query && (
          <button
            className="chrome-search__clear"
            title="清空"
            onClick={() => {
              setQuery('')
              setResults([])
            }}
          >
            <X size={12} />
          </button>
        )}
        {focused && query.trim() !== '' && (
          <div className="chrome-search__dropdown">
            {searching && (
              <div className="chrome-search__status">
                <Loader2 size={12} className="spin" /> 搜索中…
              </div>
            )}
            {!searching && results.length === 0 && (
              <div className="chrome-search__status">无结果</div>
            )}
            {results.map(r => (
              <button
                key={r.sessionId}
                className="chrome-search__result"
                onClick={() => pickResult(r.sessionId)}
                title={r.sessionId}
              >
                <span className="chrome-search__snippet">{r.snippet}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button className="chrome-btn" title="命令面板 (Ctrl/Cmd+K)" onClick={onOpenPalette}>
        <Search size={16} />
      </button>
      <button className="chrome-btn" title="设置" onClick={onOpenSettings}>
        <span style={{ fontSize: 15 }}>⚙</span>
      </button>
      <button
        className={`chrome-btn ${sidebarCollapsed ? '' : 'chrome-btn--active'}`}
        title="切换侧边栏"
        onClick={onToggleSidebar}
      >
        <PanelLeft size={16} />
      </button>
      <button
        className={`chrome-btn ${inspectorOpen ? 'chrome-btn--active' : ''}`}
        title="切换检查器"
        onClick={onToggleInspector}
      >
        <PanelRight size={16} />
      </button>

      {/* Decorative window controls (desktop shell affordance) */}
      <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
        <button className="chrome-btn" title="最小化"><Minus size={14} /></button>
        <button className="chrome-btn" title="最大化"><Square size={13} /></button>
        <button className="chrome-btn" title="关闭"><X size={14} /></button>
      </div>
    </header>
  )
}

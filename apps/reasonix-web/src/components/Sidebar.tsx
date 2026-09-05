import { useEffect, useMemo, useState } from 'react'
import { Plus, Brain, Puzzle, Settings, Clock, FolderOpen, ChevronRight, ChevronDown, ChevronsUpDown } from 'lucide-react'
import type { Session } from '../types'

interface Props {
  collapsed: boolean
  sessions: Session[]
  activeId: string | null
  runningSessions: Record<string, boolean>
  onSelect: (id: string) => void
  onNew: () => void
  /** Start a new session in a specific project directory (cwd). */
  onNewInProject: (cwd: string, projectName: string) => void
  onOpenSettings: () => void
  onOpenPanel: (kind: 'history' | 'memory' | 'mcp-skills') => void
}

interface SessionGroup {
  name: string
  items: Session[]
  /** The group's working directory (from its first session); used to start new sessions in the project. */
  cwd?: string
}

const COLLAPSE_KEY = 'reasonix:collapsed-groups'

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return '刚刚'
  if (m < 60) return `${m} 分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

/** Bucket sessions by project, most recent project first, newest session first within each group. */
function groupSessions(sessions: Session[]): SessionGroup[] {
  const byProject = new Map<string, Session[]>()
  for (const s of sessions) {
    const key = s.projectName || '未分组'
    const list = byProject.get(key)
    if (list) list.push(s)
    else byProject.set(key, [s])
  }
  return [...byProject.entries()]
    .map(([name, items]) => {
      const sorted = [...items].sort((a, b) => b.updatedAt - a.updatedAt)
      return {
        name,
        items: sorted,
        cwd: sorted.find(s => s.cwd)?.cwd,
      }
    })
    .sort((a, b) => (b.items[0]?.updatedAt ?? 0) - (a.items[0]?.updatedAt ?? 0))
}

export function Sidebar({
  collapsed,
  sessions,
  activeId,
  runningSessions,
  onSelect,
  onNew,
  onNewInProject,
  onOpenSettings,
  onOpenPanel,
}: Props) {
  const groups = useMemo(() => groupSessions(sessions), [sessions])
  // Per-project collapse state, persisted. Groups default to collapsed — the
  // previous all-expanded sidebar was unwieldy with many projects.
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(loadCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsedMap))
    } catch {
      // storage unavailable or full — collapse still works for this session
    }
  }, [collapsedMap])

  const isCollapsed = (name: string): boolean => collapsedMap[name] ?? true
  const allCollapsed = groups.every(g => isCollapsed(g.name))

  const toggle = (name: string): void => {
    setCollapsedMap(m => ({ ...m, [name]: !isCollapsed(name) }))
  }

  const toggleAll = (): void => {
    // Record every group explicitly: an empty map would be read as "default
    // collapsed" by the `?? true` fallback, so "expand all" writes `false` per
    // group rather than `{}`.
    setCollapsedMap(Object.fromEntries(groups.map(g => [g.name, !allCollapsed])))
  }

  const handleSelect = (id: string): void => {
    // Selecting a session inside a collapsed group expands that group, so the
    // active conversation is never hidden behind a collapsed header.
    const group = groups.find(g => g.items.some(s => s.id === id))
    if (group && isCollapsed(group.name)) {
      setCollapsedMap(m => ({ ...m, [group.name]: false }))
    }
    onSelect(id)
  }

  // Auto-expand the group of any session that starts running so the "对话中"
  // indicator is never hidden behind a collapsed header.
  const runningIds = Object.keys(runningSessions)
  useEffect(() => {
    if (runningIds.length === 0) return
    setCollapsedMap((m) => {
      let changed = false
      const next = { ...m }
      for (const id of runningIds) {
        const group = groups.find(g => g.items.some(s => s.id === id))
        if (group && (next[group.name] ?? true)) {
          next[group.name] = false
          changed = true
        }
      }
      return changed ? next : m
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runningIds.join(',')])

  if (collapsed) return <aside className="sidebar sidebar--collapsed" />
  return (
    <aside className="sidebar">
      <button className="btn btn--primary sidebar__new" onClick={onNew}>
        <Plus size={15} /> 新建会话
      </button>

      <div className="sidebar__section sidebar__section--row">
        <span>会话 · {groups.length} 个项目</span>
        <button
          className="sidebar__collapse-all"
          onClick={toggleAll}
          title={allCollapsed ? '全部展开' : '全部收起'}
        >
          <ChevronsUpDown size={12} />
        </button>
      </div>
      <div className="sidebar__list">
        {groups.map((g) => {
          const groupCollapsed = isCollapsed(g.name)
          return (
            <div key={g.name} className="sidebar__group">
              <div
                className="sidebar__group-title"
                title={g.name}
                onClick={() => toggle(g.name)}
                role="button"
                aria-expanded={!groupCollapsed}
              >
                {groupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                <FolderOpen size={12} />
                <span className="sidebar__group-name">{g.name}</span>
                <span className="sidebar__group-count">{g.items.length}</span>
                {g.cwd && (
                  <button
                    className="sidebar__group-new"
                    title={`在 ${g.name} 项目新建会话`}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (g.cwd) onNewInProject(g.cwd, g.name)
                    }}
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
              {!groupCollapsed &&
                g.items.map((s) => {
                  const running = !!runningSessions[s.id]
                  return (
                    <div
                      key={s.id}
                      className={`session-item ${s.id === activeId ? 'session-item--active' : ''} ${running ? 'session-item--running' : ''}`}
                      onClick={() => handleSelect(s.id)}
                    >
                      <span className="session-item__title">
                        {running && <span className="session-item__spinner" aria-label="对话中" />}
                        {s.title}
                      </span>
                      <span className="session-item__meta">
                        {running ? <span className="session-item__running-tag">对话中</span> : timeAgo(s.updatedAt)}
                      </span>
                    </div>
                  )
                })}
            </div>
          )
        })}
        {groups.length === 0 && <div className="sidebar__empty">暂无会话</div>}
      </div>

      <div className="sidebar__footer">
        <button onClick={() => onOpenPanel('history')}><Clock size={16} /> 历史</button>
        <button onClick={() => onOpenPanel('memory')}><Brain size={16} /> 记忆</button>
        <button onClick={() => onOpenPanel('mcp-skills')}><Puzzle size={16} /> MCP 与技能</button>
        <button onClick={onOpenSettings}><Settings size={16} /> 设置</button>
      </div>
    </aside>
  )
}

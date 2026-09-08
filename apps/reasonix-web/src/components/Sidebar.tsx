import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Archive,
  Brain,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Clock,
  Copy,
  Link2,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Puzzle,
  Settings,
  Trash2,
} from 'lucide-react'
import type { Session } from '../types'

interface Props {
  collapsed: boolean
  sessions: Session[]
  pinnedSessionIds: string[]
  activeId: string | null
  runningSessions: Record<string, boolean>
  onSelect: (id: string) => void
  onNew: () => void
  onNewInProject: (cwd: string, projectName: string) => void
  onTogglePin: (id: string) => void
  onArchive: (id: string) => void
  /** Hide a session locally without a host write (the host has no delete RPC). */
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onOpenSettings: () => void
  onOpenPanel: (k: 'history' | 'memory' | 'mcp-skills') => void
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

/** Bucket sessions by project; pinned sessions sort first within each group, then by recency. */
function groupSessions(sessions: Session[], pinned: ReadonlySet<string>): SessionGroup[] {
  const byProject = new Map<string, Session[]>()
  for (const s of sessions) {
    const key = s.projectName || '未分组'
    const list = byProject.get(key)
    if (list) list.push(s)
    else byProject.set(key, [s])
  }
  return [...byProject.entries()]
    .map(([name, items]) => {
      const sorted = [...items].sort((a, b) => {
        const pa = pinned.has(a.id) ? 1 : 0
        const pb = pinned.has(b.id) ? 1 : 0
        if (pa !== pb) return pb - pa
        return b.updatedAt - a.updatedAt
      })
      return {
        name,
        items: sorted,
        cwd: sorted.find(s => s.cwd)?.cwd,
      }
    })
    .sort((a, b) => (b.items[0]?.updatedAt ?? 0) - (a.items[0]?.updatedAt ?? 0))
}

/** Copy a string to the clipboard; failures are silent (no user-visible error). */
async function copyText(text: string): Promise<void> {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // clipboard unavailable (permissions/HTTP) — the menu stays usable
  }
}

/** Deep-link to a session: the app restores `#session=<id>` on load. */
function shareUrl(id: string): string {
  const loc = globalThis.location
  const base = loc && loc.origin && loc.origin !== 'null' ? loc.origin : 'http://127.0.0.1:7890'
  return `${base}/#session=${id}`
}

/** One open session action menu: fixed-position floating panel with groups. */
interface MenuState {
  id: string
  x: number
  y: number
}

export function Sidebar({
  collapsed,
  sessions,
  pinnedSessionIds,
  activeId,
  runningSessions,
  onSelect,
  onNew,
  onNewInProject,
  onTogglePin,
  onArchive,
  onDelete,
  onRename,
  onOpenSettings,
  onOpenPanel,
}: Props) {
  const pinnedSet = useMemo(() => new Set(pinnedSessionIds), [pinnedSessionIds])
  const groups = useMemo(() => groupSessions(sessions, pinnedSet), [sessions, pinnedSet])
  // Per-project collapse state, persisted. Groups default to collapsed — the
  // previous all-expanded sidebar was unwieldy with many projects.
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(loadCollapsed)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const renameInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsedMap))
    } catch {
      // storage unavailable or full — collapse still works for this session
    }
  }, [collapsedMap])

  // Close the menu on any outside click or Escape.
  useEffect(() => {
    if (!menu) return
    const close = (): void => setMenu(null)
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('click', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  // Focus and select the input when a session enters rename mode.
  useEffect(() => {
    if (renaming) {
      renameInput.current?.focus()
      renameInput.current?.select()
    }
  }, [renaming])

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

  const menuSession = menu ? sessions.find(s => s.id === menu.id) : undefined

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
                <span className="sidebar__group-name">{g.name}</span>
                <span className="sidebar__group-count">{g.items.length}</span>
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
              </div>
              {!groupCollapsed &&
                g.items.map((s) => {
                  const running = !!runningSessions[s.id]
                  const isPinned = pinnedSet.has(s.id)
                  const isRenaming = renaming === s.id
                  return (
                    <div
                      key={s.id}
                      className={`session-item ${s.id === activeId ? 'session-item--active' : ''} ${running ? 'session-item--running' : ''}`}
                      onClick={() => handleSelect(s.id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setMenu({ id: s.id, x: e.clientX, y: e.clientY })
                      }}
                    >
                      <span className="session-item__title">
                        {running && <span className="session-item__spinner" aria-label="对话中" />}
                        {isPinned && <Pin size={10} className="session-item__pin" aria-label="已置顶" />}
                        {isRenaming ? (
                          <input
                            ref={renameInput}
                            className="session-item__rename"
                            value={draft}
                            onChange={e => setDraft(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.stopPropagation()
                                onRename(s.id, draft)
                                setRenaming(null)
                              } else if (e.key === 'Escape') {
                                e.stopPropagation()
                                setRenaming(null)
                              }
                            }}
                            onBlur={() => setRenaming(null)}
                          />
                        ) : (
                          s.title
                        )}
                      </span>
                      <span className="session-item__meta">
                        {running ? <span className="session-item__running-tag">对话中</span> : timeAgo(s.updatedAt)}
                        <button
                          className="session-item__more"
                          title="会话操作"
                          aria-label={`操作 ${s.title}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            setMenu({ id: s.id, x: Math.max(8, r.right - 168), y: r.bottom + 4 })
                          }}
                        >
                          <MoreHorizontal size={13} />
                        </button>
                      </span>
                    </div>
                  )
                })}
            </div>
          )
        })}
        {groups.length === 0 && <div className="sidebar__empty">暂无会话</div>}
      </div>

      {menu && menuSession && (
        <div
          className="session-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={e => e.stopPropagation()}
          role="menu"
        >
          <button
            className="session-menu__item"
            role="menuitem"
            onClick={() => {
              onTogglePin(menuSession.id)
              setMenu(null)
            }}
          >
            {pinnedSet.has(menuSession.id) ? <PinOff size={14} /> : <Pin size={14} />}
            {pinnedSet.has(menuSession.id) ? '取消置顶' : '置顶'}
          </button>
          <div className="session-menu__sep" />
          <button
            className="session-menu__item"
            role="menuitem"
            onClick={() => {
              void copyText(shareUrl(menuSession.id))
              setMenu(null)
            }}
          >
            <Link2 size={14} /> 复制分享链接
          </button>
          <button
            className="session-menu__item"
            role="menuitem"
            onClick={() => {
              void copyText(menuSession.cwd ?? '')
              setMenu(null)
            }}
          >
            <Copy size={14} /> 复制工作目录路径
          </button>
          <div className="session-menu__sep" />
          <button
            className="session-menu__item"
            role="menuitem"
            onClick={() => {
              setDraft(menuSession.title)
              setRenaming(menuSession.id)
              setMenu(null)
            }}
          >
            <Pencil size={14} /> 重命名
          </button>
          <div className="session-menu__sep" />
          <button
            className="session-menu__item"
            role="menuitem"
            onClick={() => {
              void onArchive(menuSession.id)
              setMenu(null)
            }}
          >
            <Archive size={14} /> 归档对话
          </button>
          <div className="session-menu__sep" />
          <button
            className="session-menu__item session-menu__item--danger"
            role="menuitem"
            onClick={() => {
              void onDelete(menuSession.id)
              setMenu(null)
            }}
          >
            <Trash2 size={14} /> 删除
          </button>
        </div>
      )}

      <div className="sidebar__footer">
        <button onClick={() => onOpenPanel('history')}><Clock size={16} /> 历史</button>
        <button onClick={() => onOpenPanel('memory')}><Brain size={16} /> 记忆</button>
        <button onClick={() => onOpenPanel('mcp-skills')}><Puzzle size={16} /> MCP 与技能</button>
        <button onClick={onOpenSettings}><Settings size={16} /> 设置</button>
      </div>
    </aside>
  )
}

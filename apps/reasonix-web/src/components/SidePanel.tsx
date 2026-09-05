import { useEffect, useMemo, useState } from 'react'
import { X, Clock, Brain, Puzzle, Settings, Search, Save } from 'lucide-react'
import type { Session, SettingsNamespaceView, SidePanelKind, SkillEntry } from '../types'
import { useStore } from '../lib/store'

function nsValue(ns: SettingsNamespaceView | undefined, key: string): unknown {
  const v = (ns?.value ?? {}) as Record<string, unknown>
  return v[key]
}

function SettingsPanel() {
  const namespaces = useStore(s => s.settingsNamespaces)
  const writable = useStore(s => s.settingsWritable)
  const loadSettings = useStore(s => s.loadSettings)
  const saveSetting = useStore(s => s.saveSetting)
  const applyThemePref = useStore(s => s.applyThemePref)
  const [draft, setDraft] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const themeNs = namespaces.find(n => n.ns === 'ui-theme')
  const loopNs = namespaces.find(n => n.ns === 'agent-loop')
  const modelNs = namespaces.find(n => n.ns === 'model')

  const themePref = draft.themePref ?? String(nsValue(themeNs, 'preference') ?? 'system')
  const maxParallel = draft.maxParallel ?? String(nsValue(loopNs, 'maxParallelToolCalls') ?? '')
  const maxRetries = draft.maxRetries ?? String(nsValue(modelNs, 'maxRetries') ?? '')

  const doSave = async () => {
    if (!writable) return
    setSaving(true)
    setMsg('')
    let ok = true
    if (themeNs) {
      ok = (await saveSetting(themeNs.ns, { preference: themePref }, themeNs.revision)) && ok
      if (ok) applyThemePref(themePref as 'system' | 'dark' | 'light')
    }
    if (loopNs && maxParallel !== '' && !Number.isNaN(Number(maxParallel))) {
      ok = (await saveSetting(loopNs.ns, { maxParallelToolCalls: Number(maxParallel) }, loopNs.revision)) && ok
    }
    if (modelNs && maxRetries !== '' && !Number.isNaN(Number(maxRetries))) {
      ok = (await saveSetting(modelNs.ns, { maxRetries: Number(maxRetries) }, modelNs.revision)) && ok
    }
    setSaving(false)
    setMsg(ok ? '已保存' : '部分保存失败，请重试')
    if (ok) {
      void loadSettings()
      setDraft({})
    }
  }

  if (namespaces.length === 0) {
    return <div className="sidepanel__empty">设置加载中…</div>
  }

  return (
    <div className="sidepanel__body">
      {!writable && <div className="sidepanel__note">当前后端为只读，无法保存设置。</div>}

      <div className="sidepanel__section">
        <div className="sidepanel__label">默认模型（当前会话模型见顶部切换）</div>
        <div className="sidepanel__ns">
          <details>
            <summary>llm-opencode-zen · 模型列表</summary>
            <pre>{JSON.stringify(nsValue(namespaces.find(n => n.ns === 'llm-opencode-zen'), 'models') ?? [], null, 2)}</pre>
          </details>
        </div>
      </div>

      <div className="sidepanel__section">
        <div className="sidepanel__label">主题（ui-theme）</div>
        <select value={themePref} onChange={e => setDraft({ ...draft, themePref: e.target.value })}>
          <option value="system">跟随系统</option>
          <option value="dark">深色</option>
          <option value="light">浅色</option>
        </select>
      </div>

      {loopNs && (
        <div className="sidepanel__section">
          <div className="sidepanel__label">并行工具调用上限（agent-loop）</div>
          <input value={maxParallel} onChange={e => setDraft({ ...draft, maxParallel: e.target.value })} />
        </div>
      )}

      {modelNs && (
        <div className="sidepanel__section">
          <div className="sidepanel__label">重试次数（model）</div>
          <input value={maxRetries} onChange={e => setDraft({ ...draft, maxRetries: e.target.value })} />
        </div>
      )}

      <button className="sidepanel__primary" onClick={() => void doSave()} disabled={!writable || saving}>
        <Save size={14} /> {saving ? '保存中…' : '保存设置'}
      </button>
      {msg && <div className="sidepanel__msg">{msg}</div>}

      <div className="sidepanel__section">
        <div className="sidepanel__label">全部命名空间（只读）</div>
        {namespaces.map(n => (
          <details key={n.ns} className="sidepanel__ns">
            <summary>{n.ns} · {n.applies === 'live' ? '即时生效' : '需重启'}</summary>
            <pre>{JSON.stringify(n.value ?? {}, null, 2)}</pre>
          </details>
        ))}
      </div>
    </div>
  )
}

function HistoryPanel() {
  const historyAll = useStore(s => s.historyAll)
  const loadHistory = useStore(s => s.loadHistory)
  const selectSession = useStore(s => s.selectSession)
  const [q, setQ] = useState('')

  useEffect(() => {
    void loadHistory()
  }, [loadHistory])

  const groups = useMemo(() => {
    const items = historyAll.filter(s => !q || s.title.toLowerCase().includes(q.toLowerCase()))
    const map = new Map<string, Session[]>()
    for (const s of items) {
      const list = map.get(s.projectName) ?? []
      list.push(s)
      map.set(s.projectName, list)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [historyAll, q])

  return (
    <div className="sidepanel__body">
      <div className="sidepanel__search">
        <Search size={14} />
        <input placeholder="按标题过滤历史会话…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {groups.length === 0 && <div className="sidepanel__empty">暂无历史会话</div>}
      {groups.map(([project, items]) => (
        <div key={project} className="sidepanel__group">
          <div className="sidepanel__group-name">{project} · {items.length}</div>
          {items.map(s => (
            <button key={s.id} className="sidepanel__row" onClick={() => void selectSession(s.id)}>
              <span className="sidepanel__row-title">{s.title}</span>
              <span className="sidepanel__row-meta">{new Date(s.updatedAt).toLocaleString()}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function MemoryPanel() {
  const memoryResults = useStore(s => s.memoryResults)
  const searchMemory = useStore(s => s.searchMemory)
  const selectSession = useStore(s => s.selectSession)
  const [q, setQ] = useState('')

  const doSearch = (v: string) => {
    setQ(v)
    if (v.trim().length > 0) void searchMemory(v.trim())
    else void searchMemory(' ')
  }

  return (
    <div className="sidepanel__body">
      <div className="sidepanel__note">
        记忆 = 对历史会话内容的全文检索。输入关键词回忆此前对话中做过的事、踩过的坑与结论。
      </div>
      <div className="sidepanel__search">
        <Search size={14} />
        <input placeholder="回忆：搜索历史消息内容…" value={q} onChange={e => doSearch(e.target.value)} />
      </div>
      {memoryResults.length === 0 ? (
        <div className="sidepanel__empty">{q ? '没有匹配的记忆' : '输入关键词开始检索'}</div>
      ) : (
        memoryResults.map(r => (
          <button key={r.sessionId} className="sidepanel__row" onClick={() => void selectSession(r.sessionId)}>
            <span className="sidepanel__row-title">{r.snippet.slice(0, 120)}</span>
            <span className="sidepanel__row-meta">{r.sessionId.slice(0, 20)}</span>
          </button>
        ))
      )}
    </div>
  )
}

function McpSkillsPanel() {
  const skills = useStore(s => s.skills)
  const loadSkills = useStore(s => s.loadSkills)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (skills.length === 0) {
      setLoading(true)
      void loadSkills().finally(() => setLoading(false))
    }
  }, [skills.length, loadSkills])

  const filtered: SkillEntry[] = useMemo(
    () => skills.filter(sk => !q || sk.name.toLowerCase().includes(q.toLowerCase()) || (sk.description ?? '').toLowerCase().includes(q.toLowerCase())),
    [skills, q],
  )

  return (
    <div className="sidepanel__body">
      <div className="sidepanel__note">
        MCP 与技能：Harness 以「技能（Skill）」提供扩展能力（模型可调用工具与流程）。当前后端未暴露独立 MCP 服务器管理接口，以下为全部可用技能。
      </div>
      <div className="sidepanel__search">
        <Search size={14} />
        <input placeholder="搜索技能名称或说明…" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {loading && <div className="sidepanel__empty">技能加载中…</div>}
      {!loading && filtered.length === 0 && <div className="sidepanel__empty">没有匹配的技能</div>}
      {filtered.map(sk => (
        <div key={sk.name} className="sidepanel__skill">
          <div className="sidepanel__skill-head">
            <span className="sidepanel__skill-name">{sk.name}</span>
            {sk.modelInvocable && <span className="sidepanel__badge">模型可调用</span>}
          </div>
          <div className="sidepanel__skill-desc">{sk.description}</div>
          {sk.whenToUse && <div className="sidepanel__skill-when">适用：{sk.whenToUse}</div>}
        </div>
      ))}
    </div>
  )
}

const PANEL_META: Record<SidePanelKind, { title: string; icon: typeof Clock }> = {
  history: { title: '历史会话', icon: Clock },
  memory: { title: '记忆检索', icon: Brain },
  'mcp-skills': { title: 'MCP 与技能', icon: Puzzle },
  settings: { title: '设置', icon: Settings },
}

export function SidePanel() {
  const kind = useStore(s => s.sidePanel)
  const close = useStore(s => s.closeSidePanel)
  if (!kind) return null
  const meta = PANEL_META[kind]
  const Icon = meta.icon
  return (
    <div className="sidepanel">
      <div className="sidepanel__head">
        <Icon size={15} />
        <span>{meta.title}</span>
        <button className="sidepanel__close" onClick={close} title="关闭"><X size={14} /></button>
      </div>
      {kind === 'history' && <HistoryPanel />}
      {kind === 'memory' && <MemoryPanel />}
      {kind === 'mcp-skills' && <McpSkillsPanel />}
      {kind === 'settings' && <SettingsPanel />}
    </div>
  )
}

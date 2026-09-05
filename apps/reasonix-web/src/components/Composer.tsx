import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUp, AtSign, Cpu, FilePlus2, Hash, Loader2, Mic, MicOff, Plus, Send, Slash, Undo2, Wand2 } from 'lucide-react'
import type { ComposerMode, PromptAttachment, Session } from '../types'
import { createSpeechRecognizer, speechRecognitionSupported, type SpeechRecognizer } from '../lib/stt'
import { useStore } from '../lib/store'

const MODES: { id: ComposerMode; label: string }[] = [
  { id: 'normal', label: '常规' },
  { id: 'delivery', label: '交付' },
  { id: 'ask', label: '询问' },
  { id: 'auto', label: '自动' },
  { id: 'yolo', label: 'Yolo' },
]

const SLASH_COMMANDS = [
  { cmd: '/new', desc: '新建会话' },
  { cmd: '/clear', desc: '清空上下文' },
  { cmd: '/compact', desc: '压缩上下文' },
  { cmd: '/model', desc: '切换模型' },
  { cmd: '/provider', desc: '切换提供商' },
  { cmd: '/effort', desc: '推理强度' },
  { cmd: '/permission', desc: '设置权限预设' },
  { cmd: '/plan', desc: '进入计划模式' },
  { cmd: '/mcp', desc: '查看 MCP 服务状态' },
  { cmd: '/skills', desc: '查看可用技能' },
  { cmd: '/init', desc: '初始化项目配置' },
  { cmd: '/status', desc: '查看会话状态' },
  { cmd: '/undo', desc: '撤销上一步' },
  { cmd: '/redo', desc: '重做' },
  { cmd: '/prune', desc: '剪枝历史消息' },
  { cmd: '/debug', desc: '切换调试日志' },
  { cmd: '/editor', desc: '打开文件编辑器' },
  { cmd: '/memory', desc: '查看/管理记忆' },
  { cmd: '/goal', desc: '目标管理' },
  { cmd: '/hooks', desc: '查看 hooks' },
  { cmd: '/explore', desc: '探索项目结构' },
  { cmd: '/research', desc: '研究一个主题' },
  { cmd: '/review', desc: '审查最近改动' },
  { cmd: '/test', desc: '运行测试' },
]

export function Composer({
  mode,
  onMode,
  onSubmit,
}: {
  mode: ComposerMode
  onMode: (m: ComposerMode) => void
  onSubmit: (text: string, attachments?: PromptAttachment[]) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const [slash, setSlash] = useState<{ open: boolean; query: string }>({ open: false, query: '' })
  const taRef = useRef<HTMLTextAreaElement>(null)

  const enhancePrompt = useStore(s => s.enhancePrompt)

  // --- 模型切换（/model 或模型按钮 → 浮层选择）---
  const currentModel = useStore(s => s.currentModel)
  const modelGroups = useStore(s => s.modelGroups)
  const loadModels = useStore(s => s.loadModels)
  const selectModel = useStore(s => s.selectModel)
  const sessions = useStore(s => s.sessions)
  const skills = useStore(s => s.skills)
  const loadSkills = useStore(s => s.loadSkills)
  const submitError = useStore(s => s.submitError)
  const clearSubmitError = useStore(s => s.clearSubmitError)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [modelLoading, setModelLoading] = useState(false)
  const [modelError, setModelError] = useState('')
  const [skillsPickerOpen, setSkillsPickerOpen] = useState(false)
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [skillQuery, setSkillQuery] = useState('')

  // --- "添加内容"（+ 按钮 → 附件/@文件/#会话//命令）---
  const [contentMenuOpen, setContentMenuOpen] = useState(false)
  const [picker, setPicker] = useState<null | 'session'>(null)

  const closeContentMenu = () => {
    setContentMenuOpen(false)
    setPicker(null)
  }

  const insertIntoText = (insert: string) => {
    setText(text + insert)
    closeContentMenu()
    taRef.current?.focus()
  }

  const openSessionPicker = () => {
    setContentMenuOpen(false)
    setPicker('session')
  }

  const insertSessionRef = (s: Session) => {
    insertIntoText(`#[${s.title}]`)
  }

  const openSkillsPicker = async () => {
    setSlash({ open: false, query: '' })
    setText('')
    setSkillQuery('')
    setSkillsPickerOpen(true)
    if (skills.length === 0) {
      setSkillsLoading(true)
      await loadSkills()
      setSkillsLoading(false)
    }
  }

  const closeSkillsPicker = () => {
    setSkillsPickerOpen(false)
    taRef.current?.focus()
  }

  const openModelPicker = async () => {
    setModelPickerOpen(true)
    if (modelGroups.length === 0) {
      setModelLoading(true)
      await loadModels()
      setModelLoading(false)
    }
  }

  const closeModelPicker = () => {
    setModelPickerOpen(false)
    setSlash({ open: false, query: '' })
  }

  const pickModel = async (provider: string, model: string) => {
    try {
      await selectModel(provider, model)
    } catch (e) {
      // backend rejected the switch — show the reason, keep the picker open
      setModelError(e instanceof Error ? e.message : String(e))
      return
    }
    setModelError('')
    setModelPickerOpen(false)
    setText('')
    taRef.current?.focus()
  }

  // 切换思考深度（模型声明了 reasoningEfforts 时可用）
  const pickEffort = async (provider: string, model: string, effortId: string) => {
    try {
      await selectModel(provider, model, effortId)
      setModelError('')
    } catch (e) {
      setModelError(e instanceof Error ? e.message : String(e))
    }
  }

  // --- 提示词增强（输入框按钮：调模型润色当前输入，可还原）---
  const [enhancing, setEnhancing] = useState(false)
  const [enhancedOriginal, setEnhancedOriginal] = useState<string | null>(null)

  // --- 语音转文字（STT，浏览器 Web Speech API）---
  const [sttListening, setSttListening] = useState(false)
  const [sttError, setSttError] = useState('')
  const sttRef = useRef<SpeechRecognizer | null>(null)
  const sttCommittedRef = useRef('') // final 片段已上屏文本
  const lastInterimRef = useRef('') // 当前 interim，用于删旧插新
  const sendLockedRef = useRef(false) // 防重复提交（连按 Enter/按钮）
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<PromptAttachment[]>([])
  const [attachError, setAttachError] = useState('')
  const sttSupported = useMemo(() => speechRecognitionSupported(), [])

  useEffect(() => {
    return () => {
      sttRef.current?.stop()
    }
  }, [])

  const ensureStt = (): SpeechRecognizer | null => {
    if (sttRef.current) return sttRef.current
    const rec = createSpeechRecognizer({
      onInterim: (t) => {
        lastInterimRef.current = t
        setText(sttCommittedRef.current + t)
      },
      onFinal: (t) => {
        sttCommittedRef.current += t
        lastInterimRef.current = ''
        setText(sttCommittedRef.current)
      },
      onState: l => setSttListening(l),
      onError: msg => setSttError(msg),
    })
    sttRef.current = rec
    return rec
  }

  const toggleStt = () => {
    if (sttListening) {
      ensureStt()?.stop()
      if (lastInterimRef.current) {
        sttCommittedRef.current += lastInterimRef.current
        lastInterimRef.current = ''
        setText(sttCommittedRef.current)
      }
    } else {
      setSttError('')
      ensureStt()?.start()
    }
  }

  const handleChange = (v: string) => {
    setText(v)
    const match = /(^|\s)\/(\w*)$/.exec(v)
    setSlash({ open: !!match, query: match ? match[2] : '' })
  }

  // --- 附件上传：图片 → base64 image 块；文本（.md/.log/.txt 等）→ 内容 text 块 ---
  const pickAttachments = () => {
    setAttachError('')
    closeContentMenu()
    fileInputRef.current?.click()
  }

  const onPickFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setAttachError('')
    const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
    const TEXT_EXTS = new Set([
      'md', 'markdown', 'log', 'txt', 'json', 'yaml', 'yml', 'xml', 'toml', 'ini', 'cfg',
      'py', 'js', 'ts', 'tsx', 'jsx', 'c', 'h', 'cpp', 'hpp', 'java', 'go', 'rs', 'sh', 'bat',
      'ps1', 'html', 'css', 'scss', 'csv', 'sql', 'vue', 'svelte', 'proto', 'gradle', 'kt',
      'swift', 'rb', 'php', 'pl', 'lua', 'r', 'dockerfile',
    ])
    const MAX_TEXT_BYTES = 256 * 1024
    for (const file of Array.from(files)) {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (IMAGE_TYPES.has(file.type)) {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = String(reader.result ?? '')
          const comma = dataUrl.indexOf(',')
          const data = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl
          setAttachments(prev => [
            ...prev,
            { name: file.name, kind: 'image', mediaType: file.type, data, previewUrl: dataUrl },
          ])
        }
        reader.onerror = () => setAttachError(`读取文件失败：${file.name}`)
        reader.readAsDataURL(file)
        continue
      }
      if (TEXT_EXTS.has(ext) || file.type.startsWith('text/')) {
        if (file.size > MAX_TEXT_BYTES) {
          setAttachError(`文本附件过大：${file.name}（${(file.size / 1024).toFixed(0)}KB，上限 256KB）`)
          continue
        }
        const reader = new FileReader()
        reader.onload = () => {
          setAttachments(prev => [
            ...prev,
            {
              name: file.name,
              kind: 'text',
              mediaType: 'text/plain',
              data: '',
              previewUrl: '',
              textContent: String(reader.result ?? ''),
            },
          ])
        }
        reader.onerror = () => setAttachError(`读取文件失败：${file.name}`)
        reader.readAsText(file)
        continue
      }
      setAttachError(`不支持的文件类型 ${file.name}，支持图片（PNG/JPEG/WebP/GIF）与文本类（.md/.log/.txt/.json/代码 等）`)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index))
  }

  const send = async () => {
    const t = text.trim()
    if (!t || sendLockedRef.current) return
    // Guard against accidental double-submit (rapid Enter/button taps or an
    // IME commit racing a click): the queue accepts every prompt, so two
    // triggers would enqueue the same turn twice.
    sendLockedRef.current = true
    globalThis.setTimeout(() => {
      sendLockedRef.current = false
    }, 800)
    const ok = await onSubmit(t, attachments.length > 0 ? attachments : undefined)
    if (!ok) return // 后端拒绝（如模型不支持图片）：保留文本与附件，错误由 store 展示
    setText('')
    setAttachments([])
    setAttachError('')
    setSlash({ open: false, query: '' })
    sttCommittedRef.current = ''
    lastInterimRef.current = ''
    setEnhancedOriginal(null)
    if (sttListening) sttRef.current?.stop()
  }

  const doEnhance = async () => {
    const current = text.trim()
    if (!current || enhancing) return
    setEnhancing(true)
    setEnhancedOriginal(current)
    try {
      const result = await enhancePrompt(current)
      if (result) {
        setText(result)
        sttCommittedRef.current = ''
        lastInterimRef.current = ''
      }
    } finally {
      setEnhancing(false)
    }
  }

  const revertEnhance = () => {
    if (enhancedOriginal == null) return
    setText(enhancedOriginal)
    sttCommittedRef.current = enhancedOriginal
    lastInterimRef.current = ''
    setEnhancedOriginal(null)
  }

  const filtered = SLASH_COMMANDS.filter(c => c.cmd.includes(`/${slash.query}`))

  return (
    <div className="composer">
      <div className="composer__card" style={{ position: 'relative' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,.md,.markdown,.log,.txt,.json,.yaml,.yml,.xml,.toml,.ini,.cfg,.py,.js,.ts,.tsx,.jsx,.c,.h,.cpp,.hpp,.java,.go,.rs,.sh,.bat,.ps1,.html,.css,.scss,.csv,.sql,.vue,.proto,.gradle,.kt,.swift,.rb,.php,.lua,.dockerfile,text/*"
          multiple
          hidden
          onChange={e => onPickFiles(e.target.files)}
        />
        {attachments.length > 0 && (
          <div className="composer__attachments">
            {attachments.map((a, i) => (
              <div className="composer__attachment" key={`${a.name}-${i}`}>
                {a.kind === 'text' ? (
                  <span className="composer__attachment-thumb composer__attachment-thumb--text">📄</span>
                ) : (
                  <img className="composer__attachment-thumb" src={a.previewUrl} alt={a.name} />
                )}
                <span className="composer__attachment-name" title={a.name}>{a.name}</span>
                <button
                  className="composer__attachment-remove"
                  title="移除附件"
                  onClick={() => removeAttachment(i)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {attachError && <div className="composer__attach-error">{attachError}</div>}
        {submitError && (
          <div className="composer__attach-error" role="alert">
            {submitError}
            <button
              className="composer__attach-error-close"
              onClick={() => clearSubmitError()}
              title="关闭"
            >
              ×
            </button>
          </div>
        )}
        <textarea
          ref={taRef}
          className="composer__textarea"
          placeholder="给 Reasonix 发消息…（/ 命令 · @ 文件 · 麦克风语音输入）"
          value={text}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />

        {slash.open && filtered.length > 0 && (
          <div className="slash-menu">
            {filtered.map(c => (
              <div
                key={c.cmd}
                className="slash-menu__item"
                onClick={() => {
                  if (c.cmd === '/model') {
                    setSlash({ open: false, query: '' })
                    void openModelPicker()
                    return
                  }
                  if (c.cmd === '/skills') {
                    void openSkillsPicker()
                    return
                  }
                  setText(text.replace(/\/\w*$/, `${c.cmd} `))
                  setSlash({ open: false, query: '' })
                  taRef.current?.focus()
                }}
              >
                <span className="slash-menu__cmd">{c.cmd}</span>
                <span className="slash-menu__desc">{c.desc}</span>
              </div>
            ))}
          </div>
        )}

        <div className="composer__row">
          <div className="composer__modes">
            <button
              className={`mode-chip${contentMenuOpen ? ' mode-chip--active' : ''}`}
              onClick={() => setContentMenuOpen(!contentMenuOpen)}
              title="添加内容"
            >
              <Plus size={13} />
            </button>
            <button className="mode-chip" title="引用文件"><AtSign size={13} /></button>
            <button className="mode-chip" title="命令"><Slash size={13} /></button>
            {MODES.map(m => (
              <button
                key={m.id}
                className={`mode-chip ${mode === m.id ? 'mode-chip--active' : ''}`}
                onClick={() => onMode(m.id)}
              >
                {m.label}
              </button>
            ))}
            {sttSupported && (
              <button
                className={`mode-chip ${sttListening ? 'mode-chip--mic-on' : ''}`}
                onClick={toggleStt}
                title={sttListening ? '停止语音输入' : '语音输入（STT）'}
              >
                {sttListening ? <MicOff size={13} /> : <Mic size={13} />}
              </button>
            )}
            <button
              className="mode-chip"
              onClick={() => void doEnhance()}
              disabled={enhancing || !text.trim()}
              title="用 AI 增强提示词"
            >
              {enhancing ? <Loader2 size={13} className="spin" /> : <Wand2 size={13} />}
            </button>
            {enhancedOriginal != null && (
              <button className="mode-chip" onClick={revertEnhance} title="还原为增强前文本">
                <Undo2 size={13} />
              </button>
            )}
            <button
              className="mode-chip mode-chip--model"
              onClick={() => void openModelPicker()}
              title="切换模型"
            >
              <Cpu size={13} />
              <span className="mode-chip__model-name">
                {currentModel ? currentModel.model : '模型'}
              </span>
            </button>
          </div>
          <button className="composer__send" onClick={send} disabled={!text.trim()}>
            {text.trim() ? <ArrowUp size={15} /> : <Send size={15} />}
          </button>
        </div>

        {modelPickerOpen && (
          <div className="model-picker">
            <div className="model-picker__head">
              <span>切换模型</span>
              <button className="model-picker__close" onClick={closeModelPicker} title="关闭">
                ✕
              </button>
            </div>
            {modelLoading && <div className="model-picker__loading">加载模型中…</div>}
            {!modelLoading && modelError && (
              <div className="model-picker__error">{modelError}</div>
            )}
            {!modelLoading && modelGroups.length === 0 && (
              <div className="model-picker__empty">暂无可用的模型目录</div>
            )}
            {modelGroups.map(g => (
              <div key={g.id} className="model-picker__group">
                <div className="model-picker__group-name">{g.name}</div>
                {g.models.map((m) => {
                  const active =
                    currentModel != null && currentModel.provider === g.id && currentModel.model === m.id
                  const effort = currentModel != null && active ? currentModel.reasoningEffort : undefined
                  return (
                    <div key={m.id}>
                      <div
                        className={`model-picker__item${active ? ' model-picker__item--active' : ''}`}
                        onClick={() => void pickModel(g.id, m.id)}
                      >
                        <span className="model-picker__item-id">{m.name}</span>
                        {m.description && (
                          <span className="model-picker__item-desc">{m.description}</span>
                        )}
                        {active && <span className="model-picker__item-check">✓</span>}
                      </div>
                      {active && m.reasoning && m.reasoning.efforts.length > 0 && (
                        <div className="model-picker__efforts">
                          <span className="model-picker__efforts-label">思考深度</span>
                          {m.reasoning.efforts.map(e => (
                            <button
                              key={e.id}
                              className={`model-picker__effort${effort === e.id ? ' model-picker__effort--active' : ''}`}
                              onClick={() => void pickEffort(g.id, m.id, e.id)}
                              title={e.description ?? e.name}
                            >
                              {e.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {contentMenuOpen && (
          <div className="content-menu">
            <div className="content-menu__section">
              <button
                className="content-menu__item"
                onClick={pickAttachments}
                title="选择本地图片作为附件上传到当前会话"
              >
                <FilePlus2 size={15} />
                <span className="content-menu__copy">
                  <span className="content-menu__title">添加附件</span>
                  <span className="content-menu__desc">上传图片或文本文件（.md/.log/.txt/代码）到当前会话</span>
                </span>
              </button>
              <button
                className="content-menu__item"
                onClick={() => insertIntoText('@')}
                title="插入 @ 后输入文件路径"
              >
                <AtSign size={15} />
                <span className="content-menu__copy">
                  <span className="content-menu__title">@ 引用文件</span>
                  <span className="content-menu__desc">插入 @ 触发符，输入文件路径</span>
                </span>
              </button>
              <button className="content-menu__item" onClick={openSessionPicker}>
                <Hash size={15} />
                <span className="content-menu__copy">
                  <span className="content-menu__title"># 引用会话</span>
                  <span className="content-menu__desc">引用一个历史会话</span>
                </span>
              </button>
              <button
                className="content-menu__item"
                onClick={() => {
                  setText('/')
                  setContentMenuOpen(false)
                  setSlash({ open: true, query: '' })
                  taRef.current?.focus()
                }}
                disabled={text.trim().length > 0}
                title={text.trim().length > 0 ? '命令仅可在空输入时使用' : undefined}
              >
                <span className="content-menu__trigger-icon">/</span>
                <span className="content-menu__copy">
                  <span className="content-menu__title">/ 使用命令</span>
                  <span className="content-menu__desc">
                    {text.trim().length > 0 ? '命令仅可在空输入时使用' : '打开命令菜单'}
                  </span>
                </span>
              </button>
            </div>
          </div>
        )}

        {picker === 'session' && (
          <div className="content-menu content-menu--picker">
            <div className="content-menu__head">
              <span># 引用会话</span>
              <button className="content-menu__close" onClick={closeContentMenu} title="关闭">
                ✕
              </button>
            </div>
            <div className="dir-picker__list">
              {sessions.map(s => (
                <button
                  key={s.id}
                  className="dir-picker__entry"
                  onClick={() => insertSessionRef(s)}
                  title={s.id}
                >
                  <Hash size={13} />
                  <span className="dir-picker__entry-name">{s.title}</span>
                  <span className="dir-picker__entry-meta">{s.projectName}</span>
                </button>
              ))}
              {sessions.length === 0 && <div className="dir-picker__empty">暂无会话</div>}
            </div>
          </div>
        )}

        {skillsPickerOpen && (
          <div className="content-menu content-menu--picker">
            <div className="content-menu__head">
              <span>可用技能（{skills.length}）</span>
              <button className="content-menu__close" onClick={closeSkillsPicker} title="关闭">
                ✕
              </button>
            </div>
            <div className="dir-picker__search">
              <input
                className="dir-picker__search-input"
                placeholder="搜索技能…"
                value={skillQuery}
                onChange={e => setSkillQuery(e.target.value)}
                autoFocus
              />
            </div>
            {skillsLoading && <div className="dir-picker__loading">加载技能中…</div>}
            {!skillsLoading && (
              <div className="dir-picker__list">
                {skills
                  .filter(
                    sk =>
                      skillQuery.trim() === '' ||
                      sk.name.toLowerCase().includes(skillQuery.trim().toLowerCase()) ||
                      sk.description.toLowerCase().includes(skillQuery.trim().toLowerCase()),
                  )
                  .sort((a, b) => {
                    const q = skillQuery.trim().toLowerCase()
                    if (!q) return a.name.localeCompare(b.name)
                    // Name matches rank above description-only matches so a
                    // short query like "ima" surfaces ima-* skills instead of
                    // unrelated skills whose descriptions happen to contain
                    // the substring.
                    const aName = a.name.toLowerCase().includes(q) ? 0 : 1
                    const bName = b.name.toLowerCase().includes(q) ? 0 : 1
                    return aName - bName || a.name.localeCompare(b.name)
                  })
                  .map(sk => (
                    <button
                      key={sk.name}
                      className="dir-picker__entry dir-picker__entry--stack"
                      onClick={() => {
                        insertIntoText(`/skill ${sk.name} `)
                        closeSkillsPicker()
                      }}
                      title={sk.whenToUse}
                    >
                      <span className="dir-picker__entry-head">
                        <span className="dir-picker__entry-name">/skill {sk.name}</span>
                        {sk.modelInvocable && (
                          <span className="dir-picker__entry-badge">模型可调用</span>
                        )}
                      </span>
                      <span className="dir-picker__entry-desc">{sk.description}</span>
                      <span className="dir-picker__entry-tag">{sk.name}</span>
                    </button>
                  ))}
                {!skillsLoading && skills.length > 0 &&
                  skills.filter(
                    sk =>
                      skillQuery.trim() === '' ||
                      sk.name.toLowerCase().includes(skillQuery.trim().toLowerCase()) ||
                      sk.description.toLowerCase().includes(skillQuery.trim().toLowerCase()),
                  ).length === 0 && <div className="dir-picker__empty">无匹配技能</div>}
                {!skillsLoading && skills.length === 0 && <div className="dir-picker__empty">暂无可用技能</div>}
              </div>
            )}
          </div>
        )}
      </div>
      {sttError && <div className="composer__stt-error">{sttError}</div>}
      <div className="composer__status">
        <span>{mode === 'yolo' ? 'Yolo · 自动批准' : '普通'}</span>
        {sttListening && <span className="composer__stt-live">● 正在聆听…</span>}
        <span
          className="composer__status-model"
          onClick={() => void openModelPicker()}
          title="点击切换模型"
        >
          {currentModel ? `${currentModel.provider} / ${currentModel.model}` : '模型未加载'}
        </span>
        <span>Shift+Tab 切换模式</span>
      </div>
    </div>
  )
}

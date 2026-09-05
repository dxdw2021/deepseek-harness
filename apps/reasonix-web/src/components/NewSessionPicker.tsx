import { useState } from 'react'
import { Folder, FolderOpen, Plus, X } from 'lucide-react'
import { useStore } from '../lib/store'

export interface ProjectOption {
  name: string
  cwd?: string
}

interface NewSessionPickerProps {
  projects: ProjectOption[]
  onPick: (cwd: string | undefined) => void
  onClose: () => void
}

/**
 * Project picker shown before creating a session: choose an existing project
 * (from prior sessions' cwd), the default workspace, browse the host filesystem
 * via the native folder dialog, or type a custom working directory.
 */
export function NewSessionPicker({ projects, onPick, onClose }: NewSessionPickerProps) {
  const [custom, setCustom] = useState('')
  const [browsing, setBrowsing] = useState(false)
  const pickDirectory = useStore(s => s.pickDirectory)

  const createCustom = () => {
    const path = custom.trim()
    if (!path) return
    onPick(path)
  }

  const browse = async () => {
    setBrowsing(true)
    try {
      const path = await pickDirectory()
      if (path) onPick(path)
    } finally {
      setBrowsing(false)
    }
  }

  return (
    <div className="nsp-backdrop" onClick={onClose}>
      <div className="nsp" onClick={e => e.stopPropagation()} role="dialog" aria-label="选择项目">
        <div className="nsp__head">
          <span className="nsp__title">新建会话 · 选择项目</span>
          <button className="nsp__close" title="关闭" onClick={onClose} aria-label="关闭">
            <X size={14} />
          </button>
        </div>
        <div className="nsp__list">
          {projects.map(p => (
            <button
              key={p.cwd ?? '__default__'}
              className="nsp__row"
              onClick={() => onPick(p.cwd)}
              title={p.cwd ?? '默认工作目录'}
            >
              <Folder size={14} className="nsp__row-icon" />
              <span className="nsp__row-name">{p.name}</span>
              {p.cwd && <span className="nsp__row-cwd">{p.cwd}</span>}
            </button>
          ))}
          {projects.length === 0 && (
            <div className="nsp__empty">暂无项目，可在下方浏览文件夹或输入自定义目录</div>
          )}
        </div>
        <div className="nsp__custom">
          <button
            className="nsp__browse"
            onClick={() => void browse()}
            disabled={browsing}
            title="打开系统文件夹选择器"
          >
            <FolderOpen size={14} /> {browsing ? '选择中…' : '浏览文件夹'}
          </button>
          <input
            className="nsp__input"
            placeholder="或输入自定义工作目录"
            value={custom}
            onChange={e => setCustom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createCustom() }}
          />
          <button className="nsp__create" onClick={createCustom} disabled={!custom.trim()}>
            <Plus size={14} /> 创建
          </button>
        </div>
      </div>
    </div>
  )
}

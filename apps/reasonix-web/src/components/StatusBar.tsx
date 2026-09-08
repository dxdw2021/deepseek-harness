import { Cpu, Folder, RefreshCw } from 'lucide-react'
import { useStore } from '../lib/store'

/**
 * Bottom-right status bar. Mirrors the reference UI's status bar: current
 * model, active workspace, session turns, context usage, compaction threshold,
 * tokens and cost. All values come from the live store (metrics/context update
 * as the backend streams events).
 */
export function StatusBar() {
  const currentModel = useStore(s => s.currentModel)
  const sessions = useStore(s => s.sessions)
  const activeSessionId = useStore(s => s.activeSessionId)
  const metrics = useStore(s => s.metrics)
  const context = useStore(s => s.context)
  const connected = useStore(s => s.connected)

  const active = sessions.find(s => s.id === activeSessionId)
  const workspace = active?.projectName ?? ''

  return (
    <div className="statusbar">
      <div className="statusbar__group">
        {currentModel && (
          <span className="statusbar__item" title="当前模型">
            <Cpu size={12} />
            <b>{currentModel.model}</b>
          </span>
        )}
        {workspace && (
          <span className="statusbar__item" title="当前项目">
            <Folder size={12} />
            {workspace}
          </span>
        )}
        <span className="statusbar__item" title="会话轮数">
          <RefreshCw size={12} />
          会话 {metrics.turns} 轮
        </span>
        <span className="statusbar__item" title="上下文占用">
          上下文 {context.usedPct}%
        </span>
        <span className="statusbar__item" title="压缩阈值">
          压缩阈值 {context.compactionThresholdPct}%
        </span>
        <span className="statusbar__item" title="已用 tokens">
          tokens {context.usedTokens.toLocaleString()}
        </span>
        <span className="statusbar__item" title="会话费用">
          费用 {metrics.cost.toFixed(4)}
        </span>
      </div>
      <div className="statusbar__group">
        <span className="statusbar__item" title="后端连接状态">
          {connected ? '已连接后端' : '后端未连接'}
        </span>
      </div>
    </div>
  )
}

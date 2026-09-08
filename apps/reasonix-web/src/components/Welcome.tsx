import { BrandLogo } from './BrandLogo'

const SUGGESTIONS = [
  '讲讲这个代码库的架构',
  '总结最近的 git 改动',
  '智能体的运行主循环在哪，它做了什么？',
]

export function Welcome({ onPrompt }: { onPrompt: (text: string) => void }) {
  return (
    <div className="welcome">
      <BrandLogo size={64} />
      <div className="welcome__title">Reasonix</div>
      <div className="welcome__subtitle">一个编码智能体 —— 描述任务或随便问点什么。</div>
      <div className="welcome__chips">
        <span>/ 命令</span>·<span>@ 引用文件</span>·<span>▶ 发送</span>
      </div>
      <div className="welcome__prompts">
        {SUGGESTIONS.map(s => (
          <button key={s} className="prompt-card" onClick={() => onPrompt(s)}>
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}

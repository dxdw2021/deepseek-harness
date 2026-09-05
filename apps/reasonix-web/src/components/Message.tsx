import { useEffect, useState } from 'react'
import { Copy, GitBranch, Clock } from 'lucide-react'
import type { Message as Msg, MessageImage } from '../types'
import { Markdown } from './Markdown'
import { ReasoningCard } from './ReasoningCard'
import { ToolRow } from './ToolRow'
import { useStore } from '../lib/store'

function AttachmentImage({ image }: { image: MessageImage }) {
  const readAttachment = useStore(s => s.readAttachment)
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    readAttachment(image.attachmentId).then((url) => {
      if (alive && url) setSrc(url)
    })
    return () => {
      alive = false
    }
  }, [image.attachmentId, readAttachment])
  if (!src) {
    return (
      <div className="msg__image msg__image--loading" title={image.name ?? '图片附件'}>
        图片加载中…
      </div>
    )
  }
  return (
    <img
      className="msg__image"
      src={src}
      alt={image.name ?? '图片附件'}
      title={image.name ?? '图片附件'}
    />
  )
}

export function Message({ message }: { message: Msg }) {
  if (message.role === 'user') {
    return (
      <div className="msg msg--user">
        <div className="msg__bubble">
          {message.images && message.images.length > 0 && (
            <div className="msg__images">
              {message.images.map((img, i) => (
                <AttachmentImage key={`${img.attachmentId}-${i}`} image={img} />
              ))}
            </div>
          )}
          {message.attachments && message.attachments.length > 0 && (
            <div className="msg__attachments">
              {message.attachments.map((a, i) => (
                <span key={`${a.name}-${i}`} className="msg__attachment-tag" title={a.name}>
                  📄 {a.name}
                </span>
              ))}
            </div>
          )}
          {message.content}
        </div>
      </div>
    )
  }

  return (
    <div className="msg msg--assistant">
      <div className="msg__body">
        {message.reasoning?.map(r => (
          <ReasoningCard key={r.id} summary={r} />
        ))}

        {message.content && <Markdown source={message.content} />}

        {message.tools?.map(t => (
          <ToolRow key={t.id} tool={t} />
        ))}

        <div className="msg__footer">
          <div className="msg__actions">
            <button className="icon-btn" title="复制"><Copy size={14} /></button>
            <button className="icon-btn" title="分支会话"><GitBranch size={14} /></button>
            <button className="icon-btn" title="耗时"><Clock size={14} /></button>
          </div>
          {message.statusLine && <span>{message.statusLine}</span>}
          {message.streaming && <span className="muted">生成中…</span>}
        </div>
      </div>
    </div>
  )
}

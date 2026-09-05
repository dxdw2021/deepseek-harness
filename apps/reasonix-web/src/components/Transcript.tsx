import { useEffect, useRef } from 'react'
import type { Message as Msg } from '../types'
import { Message } from './Message'

export function Transcript({ messages }: { messages: Msg[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="transcript" ref={ref}>
      <div className="transcript__inner">
        {messages.map(m => (
          <Message key={m.id} message={m} />
        ))}
      </div>
    </div>
  )
}

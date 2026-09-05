import React from 'react'

// Minimal, dependency-free Markdown renderer covering the subset Reasonix chat
// content uses: code fences, inline code, bold, links, and lists.
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyPrefix}-${i++}`
    if (tok.startsWith('`')) {
      nodes.push(<code key={key}>{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('[')) {
      const lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok)
      if (lm) nodes.push(<a key={key} href={lm[2]} target="_blank" rel="noreferrer">{lm[1]}</a>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export function Markdown({ source }: { source: string }) {
  const lines = source.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0
  let listBuf: string[] = []
  let key = 0

  const flushList = () => {
    if (listBuf.length === 0) return
    const items = listBuf
    blocks.push(
      <ul key={`ul-${key++}`}>
        {items.map((it, idx) => (
          <li key={idx}>{renderInline(it, `li-${key}-${idx}`)}</li>
        ))}
      </ul>,
    )
    listBuf = []
  }

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      flushList()
      const buf: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i])
        i++
      }
      i++ // closing fence
      blocks.push(<pre key={`pre-${key++}`}><code>{buf.join('\n')}</code></pre>)
      continue
    }
    if (/^#{1,3}\s/.test(line)) {
      flushList()
      const level = (line.match(/^#+/) ?? [''])[0].length
      const Tag = (`h${level}` as unknown) as keyof JSX.IntrinsicElements
      blocks.push(<Tag key={`h-${key++}`}>{renderInline(line.replace(/^#+\s/, ''), `h-${key}`)}</Tag>)
      i++
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^[-*]\s+/, ''))
      i++
      continue
    }
    if (line.trim() === '') {
      flushList()
      i++
      continue
    }
    flushList()
    blocks.push(<p key={`p-${key++}`}>{renderInline(line, `p-${key}`)}</p>)
    i++
  }
  flushList()
  return <div className="md">{blocks}</div>
}

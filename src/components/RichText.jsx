// The coach's replies use a little markdown (**bold**, "- " lists,
// numbered lists). Rendered as real formatting instead of showing the
// asterisks and dashes. Plain text only — no HTML is ever injected.
export default function RichText({ text }) {
  const blocks = []
  let list = null
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)$/)
    if (bullet) {
      const ordered = /^\s*\d/.test(line)
      if (!list || list.ordered !== ordered) { list = { type: 'list', ordered, items: [] }; blocks.push(list) }
      list.items.push(bullet[1])
      continue
    }
    list = null
    if (!line.trim()) { blocks.push({ type: 'gap' }); continue }
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    blocks.push({ type: heading ? 'heading' : 'p', text: heading ? heading[1] : line })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {blocks.map((b, i) => {
        if (b.type === 'gap') return null
        if (b.type === 'list') {
          const Tag = b.ordered ? 'ol' : 'ul'
          return (
            <Tag key={i} style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
            </Tag>
          )
        }
        if (b.type === 'heading') return <div key={i} style={{ fontWeight: 800 }}>{inline(b.text)}</div>
        return <p key={i} style={{ margin: 0 }}>{inline(b.text)}</p>
      })}
    </div>
  )
}

// **bold** and *italic* within a line.
function inline(text) {
  const parts = []
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|__(.+?)__/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[1] || m[3]) parts.push(<strong key={m.index}>{m[1] || m[3]}</strong>)
    else parts.push(<em key={m.index}>{m[2]}</em>)
    last = re.lastIndex
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

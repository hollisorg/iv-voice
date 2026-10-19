import { useMemo, useState } from 'react'

const dayLabel = (t) => {
  const d = new Date(t)
  const today = new Date()
  const yest = new Date(Date.now() - 864e5)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

export default function History({ history, setHistory }) {
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(null)

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const items = q ? history.filter((h) => h.text.toLowerCase().includes(q)) : history
    const map = new Map()
    for (const h of items) {
      const k = dayLabel(h.at)
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(h)
    }
    return [...map.entries()]
  }, [history, query])

  const copy = async (h) => {
    await navigator.clipboard.writeText(h.text)
    setCopied(h.id)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div className="history">
      <p className="mono label">04 / History</p>
      <div className="history-head">
        <h1 className="page-title">What you said.</h1>
        <div className="history-tools">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" />
          {history.length > 0 && (
            <button
              className="link-btn mono dim"
              onClick={async () => {
                if (!confirm('Delete all dictation history? This cannot be undone.')) return
                await window.iv.history.clear()
                setHistory([])
              }}
            >
              Clear all
            </button>
          )}
        </div>
      </div>
      <p className="dim small">Kept only on this PC. Audio is never saved.</p>

      {groups.length === 0 && <p className="empty dim">{query ? 'Nothing matches.' : 'Nothing yet. Your dictations will show up here.'}</p>}

      {groups.map(([day, items]) => (
        <section key={day} className="day">
          <h2 className="mono dim">{day}</h2>
          <ul>
            {items.map((h) => (
              <li key={h.id} className="entry">
                <p className="entry-text">{h.text}</p>
                <div className="entry-meta mono dim">
                  <span>{new Date(h.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                  <span>{h.words} words</span>
                  <span>{(h.latencyMs / 1000).toFixed(2)} s</span>
                  <span>{h.engine.replace('local:', 'local · ').replace('cloud:', 'cloud · ')}</span>
                  <span className="spacer" />
                  <button className="link-btn mono" onClick={() => copy(h)}>
                    {copied === h.id ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    className="link-btn mono dim"
                    onClick={async () => {
                      await window.iv.history.remove(h.id)
                      setHistory((list) => list.filter((x) => x.id !== h.id))
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

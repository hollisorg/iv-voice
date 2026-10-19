import { useCallback, useEffect, useState } from 'react'
import Home from './components/Home'
import Dictionary from './components/Dictionary'
import History from './components/History'
import Settings from './components/Settings'

const PAGES = [
  ['home', 'Home'],
  ['dictionary', 'Dictionary'],
  ['history', 'History'],
  ['settings', 'Settings']
]

export default function App() {
  const [page, setPage] = useState('home')
  const [settings, setSettings] = useState(null)
  const [hotkeys, setHotkeys] = useState({})
  const [engine, setEngine] = useState(null)
  const [history, setHistory] = useState([])
  const [update, setUpdate] = useState(null)

  const refreshEngine = useCallback(() => window.iv.engine.status().then(setEngine), [])

  useEffect(() => {
    window.iv.settings.get().then(({ settings, hotkeys }) => {
      setSettings(settings)
      setHotkeys(hotkeys)
    })
    refreshEngine()
    window.iv.history.list().then(setHistory)
    window.iv.app.update().then(setUpdate)
    const offs = [
      window.iv.settings.onChange(setSettings),
      window.iv.history.onAdded((entry) => setHistory((h) => [entry, ...h])),
      window.iv.app.onUpdate(setUpdate)
    ]
    return () => offs.forEach((f) => f())
  }, [refreshEngine])

  const saveSettings = async (patch) => setSettings(await window.iv.settings.set(patch))

  if (!settings) return null

  const ctx = { settings, saveSettings, setSettings, hotkeys, engine, setEngine, refreshEngine, history, setHistory, go: setPage }

  return (
    <div className="app">
      <header className="titlebar">
        <span className="brand-mark">IV</span>
        <span className="mono">Infinite Variance</span>
        <span className="mono dim">/ Voice</span>
      </header>
      <nav className="nav">
        {PAGES.map(([id, label], i) => (
          <button key={id} className={`nav-item ${page === id ? 'on' : ''}`} onClick={() => setPage(id)}>
            <span className="mono dim">0{i + 1}</span>
            {label}
          </button>
        ))}
        <div className="nav-foot mono dim">
          {update?.status === 'ready' ? (
            <button className="link-btn mono update-ready" onClick={() => window.iv.app.installUpdate()}>
              Restart to update to v{update.available}
            </button>
          ) : (
            <span>v{update?.version}</span>
          )}
        </div>
      </nav>
      <main className="page">
        {page === 'home' && <Home {...ctx} />}
        {page === 'dictionary' && <Dictionary />}
        {page === 'history' && <History {...ctx} />}
        {page === 'settings' && <Settings {...ctx} />}
      </main>
    </div>
  )
}

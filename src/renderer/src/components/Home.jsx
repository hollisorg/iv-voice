import { useEffect, useMemo, useState } from 'react'
import Setup from './Setup'

export default function Home({ settings, hotkeys, engine, refreshEngine, history, setSettings, go }) {
  const [live, setLive] = useState(null)

  useEffect(() => window.iv.dictation.onState(setLive), [])

  const localReady = engine?.engine && engine.models.some((m) => m.key === settings.model && m.installed)
  const ready = settings.engine === 'cloud' ? settings.cloud.hasKey : localReady
  const combo = hotkeys[settings.hotkey] || 'Ctrl + Win'

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 864e5
    const week = history.filter((h) => h.at > weekAgo)
    const words = week.reduce((n, h) => n + (h.words || 0), 0)
    const latency = history.slice(0, 20)
    const avg = latency.length ? Math.round(latency.reduce((n, h) => n + h.latencyMs, 0) / latency.length) : null
    return { words, count: week.length, avg }
  }, [history])

  return (
    <div className="home">
      <p className="mono label">01 / The voice</p>
      <h1 className="headline">
        Say it<span className="accent">.</span>
      </h1>
      <p className="lede">
        Hold <kbd>{combo}</kbd>, speak, let go. Your words appear wherever you’re typing.
        <span className="lede-small">
          Long thought? Tap <kbd>{settings.hotkey === 'ctrl-shift-space' ? 'Enter' : 'Space'}</kbd> while holding to go
          hands-free, then press <kbd>{combo}</kbd> again to finish.
        </span>
      </p>

      {!ready && <Setup engine={engine} settings={settings} onDone={refreshEngine} setSettings={setSettings} go={go} />}

      {ready && (
        <>
          <div className="status-row">
            <div className="status-card">
              <span className="mono dim">Engine</span>
              <strong>
                {settings.engine === 'cloud'
                  ? `Cloud · ${engine?.providers.find((p) => p.key === settings.cloud.provider)?.label}`
                  : `Local · ${engine?.models.find((m) => m.key === settings.model)?.label}`}
              </strong>
              <span className="dim small">
                {settings.engine === 'cloud'
                  ? 'Audio is sent to your provider'
                  : engine?.engine?.variant === 'cuda' && settings.useGpu
                    ? engine?.gpu?.name || 'NVIDIA GPU'
                    : 'CPU'}
              </span>
            </div>
            <div className="status-card">
              <span className="mono dim">This week</span>
              <strong>{stats.words.toLocaleString()} words</strong>
              <span className="dim small">{stats.count} dictations</span>
            </div>
            <div className="status-card">
              <span className="mono dim">Speed</span>
              <strong>{stats.avg != null ? `${(stats.avg / 1000).toFixed(2)} s` : '—'}</strong>
              <span className="dim small">average, last 20</span>
            </div>
          </div>

          <p className="mono label try-label">02 / Try it</p>
          <textarea
            className="tryit"
            placeholder={`Click here, hold ${combo} and talk. Let go and your words land here.`}
            spellCheck
          />
          {live?.error && <p className="notice">{live.message}</p>}
        </>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import './overlay.css'
import { chime, Mic } from './recorder'

const BARS = 18
const mic = new Mic()

function Pill() {
  const [state, setState] = useState({ state: 'idle' })
  const [levels, setLevels] = useState(() => Array(BARS).fill(0))
  const config = useRef({ warm: false, micId: 'default', sounds: true })
  const starting = useRef(null)

  useEffect(() => {
    // Keep the microphone ready (or not) as Settings say; reopen if the device disappears.
    mic.onLost = () => {
      if (config.current.warm) setTimeout(() => mic.open(config.current.micId).catch(() => {}), 2000)
    }
    const offConfig = window.pill.onMicConfig((c) => {
      config.current = { ...config.current, ...c }
      if (c.warm) mic.open(c.micId).catch(() => {})
      else if (!mic.chunks) mic.close()
    })

    const offStart = window.pill.onStart(({ micId, sounds }) => {
      config.current = { ...config.current, micId, sounds }
      setLevels(Array(BARS).fill(0))
      if (sounds) chime('start')
      const onLevel = (rms) => setLevels((prev) => [...prev.slice(1), Math.min(1, rms * 9)])
      // Warm mic: capture starts now, including the pre-roll. Cold mic: open it first.
      starting.current = mic.ready && mic.micId === micId ? Promise.resolve(mic.begin(onLevel)) : mic.open(micId).then(() => mic.begin(onLevel))
    })

    const offStop = window.pill.onStop(async () => {
      if (config.current.sounds) chime('stop')
      try {
        await starting.current
        window.pill.sendAudio(mic.end())
      } catch (err) {
        window.pill.sendAudio({ error: micError(err) })
      } finally {
        starting.current = null
        if (!config.current.warm) mic.close()
      }
    })

    const offCancel = window.pill.onCancel(async () => {
      try {
        await starting.current
      } catch {
        /* mic never opened */
      }
      mic.discard()
      starting.current = null
      if (!config.current.warm) mic.close()
    })

    const offState = window.pill.onState((s) => {
      if (s.locked && config.current.sounds) chime('lock')
      setState(s)
    })
    return () => [offConfig, offStart, offStop, offCancel, offState].forEach((f) => f())
  }, [])

  const { state: s, message, error, locked, finishHint } = state
  return (
    <div className={`pill pill-${s} ${locked ? 'pill-locked' : ''} ${error ? 'pill-error' : ''}`}>
      <span className="mark">{locked ? <LockGlyph /> : 'IV'}</span>
      {s === 'recording' && (
        <div className="bars" aria-hidden>
          {levels.map((v, i) => (
            <span key={i} style={{ transform: `scaleY(${0.12 + v * 0.88})` }} />
          ))}
        </div>
      )}
      {s === 'working' && (
        <div className="dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      )}
      {s === 'idle' && message && message !== 'done' && <p className="msg">{message}</p>}
      {s === 'idle' && message === 'done' && <p className="msg ok">✓</p>}
      <span className="label">
        {s === 'recording' ? (locked ? finishHint || 'Hands-free' : 'Listening') : s === 'working' ? 'Typing' : ''}
      </span>
    </div>
  )
}

function LockGlyph() {
  return (
    <svg width="13" height="14" viewBox="0 0 13 14" aria-hidden>
      <rect x="1" y="6" width="11" height="7.5" rx="1.5" fill="currentColor" />
      <path d="M3.5 6V4.2a3 3 0 0 1 6 0V6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

function micError(err) {
  if (err?.name === 'NotAllowedError') return 'Microphone access is blocked in Windows privacy settings'
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'No microphone found. Check Settings'
  return String(err?.message || err)
}

createRoot(document.getElementById('root')).render(<Pill />)

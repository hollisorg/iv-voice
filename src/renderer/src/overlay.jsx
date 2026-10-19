import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import './overlay.css'
import { chime, startRecorder } from './recorder'

const BARS = 18

function Pill() {
  const [state, setState] = useState({ state: 'idle' })
  const [levels, setLevels] = useState(() => Array(BARS).fill(0))
  const rec = useRef(null)
  const sounds = useRef(true)

  useEffect(() => {
    const offStart = window.pill.onStart(({ micId, sounds: s }) => {
      sounds.current = s
      setLevels(Array(BARS).fill(0))
      if (s) chime(true)
      // Keep the promise so a quick release still waits for the mic to open.
      rec.current = startRecorder({
        micId,
        onLevel: (rms) => setLevels((prev) => [...prev.slice(1), Math.min(1, rms * 9)])
      })
    })
    const offStop = window.pill.onStop(async () => {
      if (sounds.current) chime(false)
      try {
        const r = await rec.current
        const { wav, durationMs, peak } = await r.stop()
        window.pill.sendAudio({ wav, durationMs, peak })
      } catch (err) {
        window.pill.sendAudio({ error: micError(err) })
      }
      rec.current = null
    })
    const offCancel = window.pill.onCancel(async () => {
      try {
        ;(await rec.current)?.cancel()
      } catch {
        /* mic never opened */
      }
      rec.current = null
    })
    const offState = window.pill.onState(setState)
    return () => [offStart, offStop, offCancel, offState].forEach((f) => f())
  }, [])

  const { state: s, message, error } = state
  return (
    <div className={`pill pill-${s} ${error ? 'pill-error' : ''}`}>
      <span className="mark">IV</span>
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
      <span className="label">{s === 'recording' ? 'Listening' : s === 'working' ? 'Typing' : ''}</span>
    </div>
  )
}

function micError(err) {
  if (err?.name === 'NotAllowedError') return 'Microphone access is blocked in Windows privacy settings'
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'No microphone found. Check Settings'
  return String(err?.message || err)
}

createRoot(document.getElementById('root')).render(<Pill />)

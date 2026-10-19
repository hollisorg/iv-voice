import { useEffect, useState } from 'react'

const fmt = (mb) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`)

// First run: pick where speech recognition happens and download what it needs.
export default function Setup({ engine, settings, onDone, go }) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => window.iv.engine.onProgress(setProgress), [])

  if (!engine) return null
  const gpu = engine.gpu
  const plan = gpu
    ? { variant: 'cuda', model: 'turbo', engineMb: 685, title: `${gpu.name} found`, text: 'Speech recognition runs on your graphics card: fast and fully private.' }
    : { variant: 'cpu', model: 'small', engineMb: 9, title: 'No NVIDIA GPU found', text: 'Speech recognition runs on your processor. Fine for short dictation, or use a cloud key for speed.' }
  const model = engine.models.find((m) => m.key === plan.model)
  const engineNeeded = !engine.engine || engine.engine.variant !== plan.variant
  const total = (engineNeeded ? plan.engineMb : 0) + (model.installed ? 0 : model.mb)

  const run = async (p = plan) => {
    setBusy(true)
    setError(null)
    try {
      await window.iv.engine.setup({ variant: p.variant, model: p.model })
      await onDone()
    } catch (err) {
      setError(String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''))
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }

  const step = progress?.step === 'engine' ? 'Speech engine' : progress?.step === 'model' ? `${model.label} model` : null

  return (
    <section className="setup">
      <p className="mono label">00 / Set up</p>
      {settings.engine === 'cloud' ? (
        <>
          <h2>Add your API key.</h2>
          <p className="dim">Cloud mode needs a key from Groq or OpenAI. Add it in Settings.</p>
          <button className="btn btn-primary" onClick={() => go('settings')}>
            Open Settings <span aria-hidden>→</span>
          </button>
        </>
      ) : (
        <>
          <h2>{plan.title}.</h2>
          <p className="dim">
            {plan.text} One-time download of about {fmt(total)}: the official whisper.cpp engine and the {model.label}{' '}
            model, both checked against their published checksums.
          </p>
          {busy && (
            <div className="setup-progress">
              <span className="mono">
                {step ? `${step} · ${progress?.phase}` : 'Starting'}
                {progress?.percent != null && progress.phase === 'downloading' ? ` · ${Math.floor(progress.percent)}%` : ''}
              </span>
              <div className="bar">
                <span style={{ width: `${progress?.phase === 'downloading' ? progress.percent || 1 : progress?.phase === 'extracting' ? 100 : 2}%` }} />
              </div>
            </div>
          )}
          {error && <p className="notice">{error}</p>}
          <div className="setup-actions">
            <button className="btn btn-primary" onClick={() => run()} disabled={busy}>
              {busy ? 'Setting up…' : `Set up (${fmt(total)})`} <span aria-hidden>↓</span>
            </button>
            {gpu && (
              <button className="link-btn mono" disabled={busy} onClick={() => run({ variant: 'cpu', model: 'small' })}>
                Use CPU instead
              </button>
            )}
            <button className="link-btn mono" disabled={busy} onClick={() => go('settings')}>
              Use a cloud key instead
            </button>
          </div>
        </>
      )}
    </section>
  )
}

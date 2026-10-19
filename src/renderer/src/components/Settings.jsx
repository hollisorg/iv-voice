import { useEffect, useState } from 'react'

const LANGUAGES = [
  ['en', 'English'],
  ['auto', 'Detect automatically'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['nl', 'Dutch'],
  ['ja', 'Japanese'],
  ['ko', 'Korean'],
  ['zh', 'Chinese'],
  ['hi', 'Hindi']
]

const clean = (err) => String(err?.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

export default function Settings({ settings, saveSettings, setSettings, hotkeys, engine, setEngine, refreshEngine }) {
  const [mics, setMics] = useState([])
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(null)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => window.iv.engine.onProgress(setProgress), [])

  // Device labels are only visible once the microphone has been allowed once.
  useEffect(() => {
    ;(async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true })
        s.getTracks().forEach((t) => t.stop())
      } catch {
        /* listed without labels */
      }
      const devices = await navigator.mediaDevices.enumerateDevices()
      setMics(devices.filter((d) => d.kind === 'audioinput' && d.deviceId !== 'communications'))
    })()
  }, [])

  const setup = async (variant, model) => {
    setBusy(model)
    setError(null)
    try {
      setEngine(await window.iv.engine.setup({ variant, model }))
    } catch (err) {
      setError(clean(err))
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  const s = settings
  const variant = engine?.engine?.variant
  const provider = engine?.providers.find((p) => p.key === s.cloud.provider)

  return (
    <div className="settings">
      <p className="mono label">05 / Settings</p>
      <h1 className="page-title">Make it yours.</h1>

      <Group
        title="Talk"
        note={`Hold the shortcut to record, let go to type. For longer dictation, tap ${s.hotkey === 'ctrl-shift-space' ? 'Enter' : 'Space'} while holding to go hands-free; press the shortcut again to finish, or Esc to cancel. Pressing any other key while holding cancels, so normal shortcuts keep working.`}
      >
        <Row label="Shortcut">
          <select value={s.hotkey} onChange={(e) => saveSettings({ hotkey: e.target.value })}>
            {Object.entries(hotkeys).map(([id, label]) => (
              <option key={id} value={id}>
                Hold {label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Microphone">
          <select value={s.micId} onChange={(e) => saveSettings({ micId: e.target.value })}>
            <option value="default">System default</option>
            {mics
              .filter((m) => m.deviceId !== 'default')
              .map((m, i) => (
                <option key={m.deviceId} value={m.deviceId}>
                  {m.label || `Microphone ${i + 1}`}
                </option>
              ))}
          </select>
        </Row>
        <Row label="Language">
          <select value={s.language} onChange={(e) => saveSettings({ language: e.target.value })}>
            {LANGUAGES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Row>
        <Toggle label="Start and stop sounds" checked={s.sounds} onChange={(v) => saveSettings({ sounds: v })} />
        <Toggle
          label="Instant start (keep the microphone ready)"
          checked={s.instantStart}
          onChange={(v) => saveSettings({ instantStart: v })}
        />
        <p className="dim small">
          Opening a microphone takes about 0.2 s, which can clip your first word. With instant start, IV Voice keeps the
          mic open and holds only the last 0.3 s in memory, so recording starts the moment you press. Windows will show
          the microphone as in use. It pauses while your PC is locked or asleep.
        </p>
      </Group>

      <Group title="Speech engine" note="Local keeps your voice on this PC. Cloud sends audio to the provider you choose and is faster on PCs without a GPU.">
        <div className="segmented">
          {[
            ['local', 'Local'],
            ['cloud', 'Cloud API']
          ].map(([v, l]) => (
            <button key={v} className={s.engine === v ? 'on' : ''} onClick={() => saveSettings({ engine: v })}>
              {l}
            </button>
          ))}
        </div>

        {s.engine === 'local' && engine && (
          <>
            <p className="dim small">
              {engine.engine ? `whisper.cpp ${engine.engine.tag} · ${engine.engine.label}` : 'Not installed yet.'}
              {engine.gpu ? ` · ${engine.gpu.name}` : ' · No NVIDIA GPU found'}
            </p>
            <div className="models">
              {engine.models.map((m) => {
                const active = s.model === m.key && m.installed
                return (
                  <div key={m.key} className={`model ${active ? 'on' : ''}`}>
                    <div>
                      <strong>{m.label}</strong>
                      <span className="dim small">
                        {m.note} {m.mb} MB
                      </span>
                    </div>
                    {m.installed ? (
                      <div className="model-actions">
                        {active ? (
                          <span className="mono pink">In use</span>
                        ) : (
                          <button className="link-btn mono" onClick={() => saveSettings({ model: m.key })}>
                            Use
                          </button>
                        )}
                        <button
                          className="link-btn mono dim"
                          onClick={async () => setEngine(await window.iv.engine.removeModel(m.key))}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        className="btn btn-small"
                        disabled={Boolean(busy)}
                        onClick={() => setup(variant || (engine.gpu ? 'cuda' : 'cpu'), m.key)}
                      >
                        {busy === m.key ? `${progress?.phase || 'Starting'} ${progress?.percent != null ? Math.floor(progress.percent) + '%' : ''}` : 'Download'}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {engine.gpu && (
              <Row label="Engine build">
                <select
                  value={variant || ''}
                  disabled={Boolean(busy)}
                  onChange={(e) => setup(e.target.value, s.model)}
                >
                  {!variant && <option value="">Not installed</option>}
                  <option value="cuda">NVIDIA GPU (CUDA, 685 MB)</option>
                  <option value="cpu">CPU only (9 MB)</option>
                </select>
              </Row>
            )}
            <Row label="Free GPU memory">
              <select value={s.idleMinutes} onChange={(e) => saveSettings({ idleMinutes: Number(e.target.value) })}>
                <option value={5}>After 5 minutes idle</option>
                <option value={15}>After 15 minutes idle</option>
                <option value={60}>After 1 hour idle</option>
                <option value={0}>Never (fastest)</option>
              </select>
            </Row>
            <p className="dim small">
              The first dictation after the engine sleeps takes a few seconds while the model loads.{' '}
              <button className="link-btn mono" onClick={async () => setEngine(await window.iv.engine.warm())}>
                Wake it now
              </button>
            </p>
          </>
        )}

        {s.engine === 'cloud' && (
          <>
            <Row label="Provider">
              <select value={s.cloud.provider} onChange={(e) => saveSettings({ cloud: { provider: e.target.value } })}>
                {engine?.providers.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Row>
            {s.cloud.provider === 'custom' && (
              <>
                <Row label="Base URL">
                  <input
                    defaultValue={s.cloud.baseUrl}
                    placeholder="https://…/v1"
                    onBlur={(e) => saveSettings({ cloud: { baseUrl: e.target.value } })}
                  />
                </Row>
                <Row label="Model">
                  <input defaultValue={s.cloud.model} placeholder="whisper-1" onBlur={(e) => saveSettings({ cloud: { model: e.target.value } })} />
                </Row>
              </>
            )}
            <Row label="API key">
              <form
                className="key-form"
                onSubmit={async (e) => {
                  e.preventDefault()
                  try {
                    setSettings(await window.iv.settings.setApiKey(key))
                    setKey('')
                  } catch (err) {
                    setError(clean(err))
                  }
                }}
              >
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder={s.cloud.hasKey ? 'Saved. Paste a new key to replace it' : 'Paste your key'}
                  autoComplete="off"
                />
                <button className="btn btn-small" type="submit" disabled={!key.trim()}>
                  Save
                </button>
                {s.cloud.hasKey && (
                  <button
                    type="button"
                    className="link-btn mono dim"
                    onClick={async () => setSettings(await window.iv.settings.setApiKey(''))}
                  >
                    Remove
                  </button>
                )}
              </form>
            </Row>
            <p className="dim small">
              Uses {provider?.label}’s {provider?.model || 'transcription'} model. The key is encrypted with Windows and
              stays on this PC.
            </p>
          </>
        )}
        {error && <p className="notice">{error}</p>}
      </Group>

      <Group title="Text" note="What happens to your words before they’re typed.">
        <Toggle label="Remove filler words (um, uh)" checked={s.removeFillers} onChange={(v) => saveSettings({ removeFillers: v })} />
        <Toggle label="“New line” and “new paragraph” start new lines" checked={s.spokenCommands} onChange={(v) => saveSettings({ spokenCommands: v })} />
        <Toggle label="Put my clipboard back after typing" checked={s.restoreClipboard} onChange={(v) => saveSettings({ restoreClipboard: v })} />
      </Group>

      <Group title="App">
        <Toggle label="Start IV Voice when I sign in to Windows" checked={s.launchAtLogin} onChange={(v) => saveSettings({ launchAtLogin: v })} />
        <p className="dim small">Closing the window keeps IV Voice running in the tray, so the shortcut always works.</p>
      </Group>
    </div>
  )

}

// Defined at module level so inputs inside keep focus across re-renders.
function Group({ title, note, children }) {
  return (
    <section className="group">
      <div className="group-head">
        <h2>{title}</h2>
        {note && <p className="dim small">{note}</p>}
      </div>
      <div className="group-body">{children}</div>
    </section>
  )
}

function Row({ label, children }) {
  return (
    <label className="row">
      <span className="row-label">{label}</span>
      <span className="row-control">{children}</span>
    </label>
  )
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" aria-hidden />
      <span>{label}</span>
    </label>
  )
}

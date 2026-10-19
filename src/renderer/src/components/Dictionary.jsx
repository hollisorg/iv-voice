import { useEffect, useState } from 'react'

export default function Dictionary() {
  const [dict, setDict] = useState(null)
  const [term, setTerm] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    window.iv.dictionary.get().then(setDict)
  }, [])

  const save = async (next) => setDict(await window.iv.dictionary.set(next))

  if (!dict) return null

  return (
    <div className="dictionary">
      <p className="mono label">03 / Dictionary</p>
      <h1 className="page-title">Your words.</h1>

      <section className="panel">
        <div className="panel-head">
          <h2>Vocabulary</h2>
          <p className="dim">
            Names, brands and jargon the speech engine should spell your way. It hears these as hints.
          </p>
        </div>
        <form
          className="inline-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!term.trim()) return
            save({ ...dict, terms: [...dict.terms, term.trim()] })
            setTerm('')
          }}
        >
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="e.g. Infinite Variance, ComfyUI, Seedance" />
          <button className="btn btn-primary" type="submit" disabled={!term.trim()}>
            Add
          </button>
        </form>
        <div className="chips">
          {dict.terms.length === 0 && <p className="dim small">No words yet.</p>}
          {dict.terms.map((t) => (
            <span className="chip" key={t}>
              {t}
              <button aria-label={`Remove ${t}`} onClick={() => save({ ...dict, terms: dict.terms.filter((x) => x !== t) })}>
                ×
              </button>
            </span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Replacements</h2>
          <p className="dim">When you say the left side, type the right side. Handy for emails, links and sign-offs.</p>
        </div>
        <form
          className="inline-form two"
          onSubmit={(e) => {
            e.preventDefault()
            if (!from.trim()) return
            save({ ...dict, replacements: [...dict.replacements, { from: from.trim(), to }] })
            setFrom('')
            setTo('')
          }}
        >
          <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="When I say… (e.g. my website)" />
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Type… (e.g. infinitevariance.ai)" />
          <button className="btn btn-primary" type="submit" disabled={!from.trim()}>
            Add
          </button>
        </form>
        <ul className="rows">
          {dict.replacements.length === 0 && <li className="dim small">No replacements yet.</li>}
          {dict.replacements.map((r, i) => (
            <li key={`${r.from}-${i}`}>
              <span className="say">{r.from}</span>
              <span className="arrow mono dim">→</span>
              <span className="type">{r.to || <em className="dim">(remove)</em>}</span>
              <button
                className="link-btn mono dim"
                onClick={() => save({ ...dict, replacements: dict.replacements.filter((_, j) => j !== i) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

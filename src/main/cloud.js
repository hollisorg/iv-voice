// Optional cloud transcription for PCs without a capable GPU. Any OpenAI-compatible
// /audio/transcriptions endpoint works; the key never leaves the main process.
export const PROVIDERS = {
  groq: { label: 'Groq', base: 'https://api.groq.com/openai/v1', model: 'whisper-large-v3-turbo' },
  openai: { label: 'OpenAI', base: 'https://api.openai.com/v1', model: 'gpt-4o-mini-transcribe' },
  custom: { label: 'Custom (OpenAI-compatible)', base: '', model: '' }
}

export async function transcribeCloud(wav, { provider, baseUrl, model, apiKey, language, prompt }) {
  const preset = PROVIDERS[provider] || PROVIDERS.custom
  const base = (provider === 'custom' ? baseUrl : preset.base || baseUrl || '').replace(/\/+$/, '')
  if (!/^https:\/\//i.test(base)) throw new Error('Cloud transcription needs an https:// base URL')
  if (!apiKey) throw new Error('Add an API key in Settings to use cloud transcription')
  const form = new FormData()
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'dictation.wav')
  form.append('model', model || preset.model)
  form.append('response_format', 'json')
  if (language && language !== 'auto') form.append('language', language)
  if (prompt) form.append('prompt', prompt)
  const res = await fetch(`${base}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(60_000)
  })
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300)
    if (res.status === 401) throw new Error('The cloud API key was rejected')
    throw new Error(`Cloud transcription failed (${res.status}): ${detail}`)
  }
  const body = await res.json()
  return String(body.text || '')
}

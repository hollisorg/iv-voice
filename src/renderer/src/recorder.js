// Microphone capture at 16 kHz mono (what Whisper wants), returned as a 16-bit PCM WAV.
//
// "Instant start" keeps the stream open and holds the last PRE_ROLL_MS of audio in memory, so
// recording begins the moment the shortcut is pressed (opening a mic takes ~200 ms) and the first
// syllable isn't clipped. Nothing outside that short rolling window is kept until you press the
// shortcut, and nothing is ever written to disk.

const RATE = 16000
const PRE_ROLL_MS = 300
const PRE_ROLL_SAMPLES = (RATE * PRE_ROLL_MS) / 1000

export class Mic {
  constructor() {
    this.stream = null
    this.ctx = null
    this.source = null
    this.proc = null
    this.micId = null
    this.opening = null
    this.ring = [] // recent chunks while idle
    this.ringSamples = 0
    this.chunks = null // non-null while capturing
    this.peak = 0
    this.onLevel = null
    this.onLost = null
  }

  get ready() {
    return Boolean(this.proc)
  }

  async open(micId) {
    if (this.ready && this.micId === micId) return
    if (this.opening) return this.opening
    this.opening = (async () => {
      await this.close()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: micId && micId !== 'default' ? { exact: micId } : undefined,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      })
      const ctx = new AudioContext({ sampleRate: RATE })
      const source = ctx.createMediaStreamSource(stream)
      // ScriptProcessor is deprecated but needs no separate worklet file, which keeps file:// loading simple.
      const proc = ctx.createScriptProcessor(2048, 1, 1)
      proc.onaudioprocess = (e) => this.onAudio(new Float32Array(e.inputBuffer.getChannelData(0)))
      source.connect(proc)
      proc.connect(ctx.destination) // required for processing; the output buffer stays silent
      stream.getAudioTracks()[0]?.addEventListener('ended', () => {
        this.close()
        this.onLost?.()
      })
      Object.assign(this, { stream, ctx, source, proc, micId })
    })().finally(() => {
      this.opening = null
    })
    return this.opening
  }

  onAudio(data) {
    if (this.chunks) {
      this.chunks.push(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) {
        const v = Math.abs(data[i])
        if (v > this.peak) this.peak = v
        sum += data[i] * data[i]
      }
      this.onLevel?.(Math.sqrt(sum / data.length))
      return
    }
    // Idle: keep only the last PRE_ROLL_MS.
    this.ring.push(data)
    this.ringSamples += data.length
    while (this.ring.length > 1 && this.ringSamples - this.ring[0].length >= PRE_ROLL_SAMPLES) {
      this.ringSamples -= this.ring.shift().length
    }
  }

  // Start capturing; a warm stream contributes its pre-roll.
  begin(onLevel) {
    this.onLevel = onLevel
    this.peak = 0
    this.chunks = []
    for (const c of this.ring) this.onAudio(c)
    this.ring = []
    this.ringSamples = 0
  }

  end() {
    const chunks = this.chunks || []
    this.chunks = null
    this.onLevel = null
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const samples = new Float32Array(total)
    let offset = 0
    for (const c of chunks) {
      samples.set(c, offset)
      offset += c.length
    }
    return { wav: encodeWav(samples, RATE), durationMs: (total / RATE) * 1000, peak: this.peak }
  }

  discard() {
    this.chunks = null
    this.onLevel = null
  }

  async close() {
    this.chunks = null
    this.ring = []
    this.ringSamples = 0
    if (this.proc) {
      this.proc.onaudioprocess = null
      this.proc.disconnect()
      this.source.disconnect()
    }
    this.stream?.getTracks().forEach((t) => t.stop())
    await this.ctx?.close().catch(() => {})
    Object.assign(this, { stream: null, ctx: null, source: null, proc: null, micId: null })
  }
}

function encodeWav(samples, rate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const str = (o, s) => [...s].forEach((ch, i) => view.setUint8(o + i, ch.charCodeAt(0)))
  str(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  str(8, 'WAVE')
  str(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  str(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return buffer
}

// Short, quiet cues so you know when recording begins, locks and ends.
export function chime(kind = 'start') {
  const [from, to] = { start: [660, 880], stop: [880, 520], lock: [880, 1175] }[kind] || [660, 880]
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  const t = ctx.currentTime
  osc.frequency.setValueAtTime(from, t)
  osc.frequency.exponentialRampToValueAtTime(to, t + 0.09)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.13)
  osc.onended = () => ctx.close()
}

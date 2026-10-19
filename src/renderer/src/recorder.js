// Microphone capture at 16 kHz mono (what Whisper wants), returned as a 16-bit PCM WAV.

const RATE = 16000

export async function startRecorder({ micId, onLevel } = {}) {
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
  const chunks = []
  let peak = 0
  proc.onaudioprocess = (e) => {
    const data = e.inputBuffer.getChannelData(0)
    chunks.push(new Float32Array(data))
    let sum = 0
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i])
      if (v > peak) peak = v
      sum += data[i] * data[i]
    }
    onLevel?.(Math.sqrt(sum / data.length))
  }
  source.connect(proc)
  proc.connect(ctx.destination) // required for processing; the output buffer stays silent

  const release = async () => {
    proc.onaudioprocess = null
    proc.disconnect()
    source.disconnect()
    stream.getTracks().forEach((t) => t.stop())
    await ctx.close().catch(() => {})
  }

  return {
    async stop() {
      await release()
      const total = chunks.reduce((n, c) => n + c.length, 0)
      const samples = new Float32Array(total)
      let offset = 0
      for (const c of chunks) {
        samples.set(c, offset)
        offset += c.length
      }
      return { wav: encodeWav(samples, RATE), durationMs: (total / RATE) * 1000, peak }
    },
    cancel: release
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

// Short, quiet start/stop cues so you know when recording begins and ends.
export function chime(up = true) {
  const ctx = new AudioContext()
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  const t = ctx.currentTime
  osc.frequency.setValueAtTime(up ? 660 : 880, t)
  osc.frequency.exponentialRampToValueAtTime(up ? 880 : 520, t + 0.09)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.06, t + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.13)
  osc.onended = () => ctx.close()
}

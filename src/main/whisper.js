// Runs whisper.cpp's whisper-server on localhost with the model loaded, so each dictation is one
// HTTP request instead of a cold model load. It can stop itself after idle time to free GPU memory.
import { spawn } from 'node:child_process'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

export class WhisperServer {
  constructor() {
    this.proc = null
    this.port = null
    this.config = null // { serverPath, modelPath, language, useGpu }
    this.starting = null
    this.idleTimer = null
    this.log = []
  }

  get running() {
    return Boolean(this.proc && this.proc.exitCode === null && this.port)
  }

  configure(config) {
    const changed = JSON.stringify(config) !== JSON.stringify(this.config)
    this.config = config
    if (changed && this.running) this.stop()
  }

  async ensure() {
    if (this.running) return
    if (this.starting) return this.starting
    this.starting = this.start().finally(() => {
      this.starting = null
    })
    return this.starting
  }

  async start() {
    const { serverPath, modelPath, language, useGpu } = this.config || {}
    if (!serverPath || !modelPath) throw new Error('The local engine is not set up yet')
    this.port = await freePort()
    const threads = Math.max(2, Math.min(8, os.cpus().length - 2))
    const args = ['-m', modelPath, '--host', '127.0.0.1', '--port', String(this.port), '-t', String(threads)]
    args.push('-l', language || 'en')
    if (!useGpu) args.push('-ng') // --no-gpu
    this.log = []
    this.proc = spawn(serverPath, args, { cwd: path.dirname(serverPath), windowsHide: true })
    const keep = (d) => {
      this.log.push(String(d))
      if (this.log.length > 200) this.log.splice(0, 100)
    }
    this.proc.stdout.on('data', keep)
    this.proc.stderr.on('data', keep)
    this.proc.on('exit', () => {
      this.proc = null
      this.port = null
    })

    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      if (!this.proc) throw new Error(`Speech engine stopped while starting: ${this.tail()}`)
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/`, { signal: AbortSignal.timeout(1000) })
        if (res.ok) return
      } catch {
        /* not listening yet */
      }
      await new Promise((r) => setTimeout(r, 250))
    }
    this.stop()
    throw new Error('Speech engine took too long to start')
  }

  tail() {
    return this.log.join('').split(/\r?\n/).filter(Boolean).slice(-3).join(' | ')
  }

  // prompt: words the model should prefer (dictionary terms), passed as Whisper's initial prompt.
  async transcribe(wav, { prompt = '', idleMinutes = 0 } = {}) {
    clearTimeout(this.idleTimer)
    await this.ensure()
    const form = new FormData()
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'dictation.wav')
    form.append('response_format', 'json')
    form.append('temperature', '0')
    if (prompt) form.append('prompt', prompt)
    const res = await fetch(`http://127.0.0.1:${this.port}/inference`, { method: 'POST', body: form })
    if (!res.ok) throw new Error(`Speech engine error ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const body = await res.json()
    if (body.error) throw new Error(`Speech engine error: ${body.error}`)
    if (idleMinutes > 0) this.idleTimer = setTimeout(() => this.stop(), idleMinutes * 60_000)
    return String(body.text || '')
  }

  stop() {
    clearTimeout(this.idleTimer)
    if (this.proc && this.proc.exitCode === null) this.proc.kill()
    this.proc = null
    this.port = null
  }
}

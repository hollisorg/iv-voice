// Local control channel so other apps on this PC (e.g. Baby Mode Control's on-screen keyboard)
// can drive dictation without faking keystrokes.
//
// Windows named pipe: \\.\pipe\iv-voice-<username>. Newline-delimited JSON, one object per line.
//   -> {"cmd":"toggle"|"start"|"stop"|"cancel"|"paste-last"|"status"|"subscribe"}
//   <- {"ok":true,"state":"idle"|"recording"|"working","locked":bool}   (or {"ok":false,"error":"…"})
// "subscribe" keeps the connection open and pushes a status line on every change.
import net from 'node:net'
import os from 'node:os'

export const PIPE_PATH = `\\\\.\\pipe\\iv-voice-${os.userInfo().username.replace(/[^\w.-]/g, '_')}`

export function startControlServer({ status, commands }) {
  const subscribers = new Set()

  const server = net.createServer((socket) => {
    socket.setEncoding('utf8')
    let buffer = ''
    const reply = (obj) => {
      if (!socket.destroyed) socket.write(JSON.stringify(obj) + '\n')
    }
    socket.on('data', async (chunk) => {
      buffer += chunk
      if (buffer.length > 4096) return socket.destroy() // nothing legitimate is this long
      let nl
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        if (!line) continue
        let msg
        try {
          msg = JSON.parse(line)
        } catch {
          reply({ ok: false, error: 'Bad JSON' })
          continue
        }
        try {
          if (msg.cmd === 'subscribe') {
            subscribers.add(socket)
            reply({ ok: true, ...status() })
          } else if (msg.cmd === 'status') {
            reply({ ok: true, ...status() })
          } else if (commands[msg.cmd]) {
            await commands[msg.cmd]()
            reply({ ok: true, ...status() })
          } else {
            reply({ ok: false, error: `Unknown command: ${msg.cmd}` })
          }
        } catch (err) {
          reply({ ok: false, error: String(err.message || err) })
        }
      }
    })
    socket.on('close', () => subscribers.delete(socket))
    socket.on('error', () => subscribers.delete(socket))
  })

  server.on('error', (err) => console.error('IV Voice control channel:', err.message))
  server.listen(PIPE_PATH)

  return {
    notify() {
      const line = JSON.stringify({ ok: true, ...status() }) + '\n'
      for (const s of subscribers) if (!s.destroyed) s.write(line)
    },
    close() {
      for (const s of subscribers) s.destroy()
      server.close()
    }
  }
}

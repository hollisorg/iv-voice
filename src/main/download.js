// Streamed downloads that are hashed while they arrive and only kept if the SHA-256 matches.
import { net } from 'electron'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export async function fetchJson(url) {
  const res = await net.fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

export async function downloadVerified({ url, dest, sha256, size, onProgress = () => {}, signal }) {
  if (!/^[a-f0-9]{64}$/i.test(sha256 || '')) throw new Error(`No checksum available for ${path.basename(dest)}`)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  const tmp = `${dest}.download`
  const res = await net.fetch(url, { signal })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} downloading ${path.basename(dest)}`)
  const total = Number(res.headers.get('content-length')) || size || 0
  const hash = createHash('sha256')
  const out = fs.createWriteStream(tmp)
  let received = 0
  let lastReport = 0
  try {
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      hash.update(value)
      received += value.length
      if (!out.write(value)) await new Promise((r) => out.once('drain', r))
      const now = Date.now()
      if (now - lastReport > 150) {
        lastReport = now
        onProgress({ received, total, percent: total ? (received / total) * 100 : null })
      }
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())))
  } catch (err) {
    out.destroy()
    fs.rmSync(tmp, { force: true })
    throw err
  }
  const actual = hash.digest('hex')
  if (actual.toLowerCase() !== sha256.toLowerCase()) {
    fs.rmSync(tmp, { force: true })
    throw new Error(`${path.basename(dest)} failed its checksum; nothing was installed`)
  }
  fs.renameSync(tmp, dest)
  onProgress({ received, total: received, percent: 100 })
  return dest
}

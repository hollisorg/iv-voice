// Local speech engine: whisper.cpp (official Windows builds from ggml-org/whisper.cpp releases,
// verified against GitHub's published SHA-256 digests) plus a ggml model from Hugging Face
// (verified against its LFS SHA-256). Everything lives in userData; nothing is bundled.
import { app } from 'electron'
import { spawn, execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { downloadVerified, fetchJson } from './download'

const RELEASES = 'https://api.github.com/repos/ggml-org/whisper.cpp/releases?per_page=15'
const MODEL_TREE = 'https://huggingface.co/api/models/ggerganov/whisper.cpp/tree/main'
const MODEL_URL = (file) => `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/${file}`

export const VARIANTS = {
  cuda: {
    label: 'NVIDIA GPU (CUDA)',
    // Asset names changed over time; accept both spellings of the CUDA 12 x64 build.
    asset: /^whisper-(bin-win-cuda-12[\d.]*-x64|cublas-12[\d.]*-bin-x64)\.zip$/
  },
  cpu: { label: 'CPU', asset: /^whisper-bin-x64\.zip$/ }
}

export const MODELS = {
  turbo: { file: 'ggml-large-v3-turbo-q5_0.bin', label: 'Turbo', note: 'Best accuracy. Wants a GPU.', mb: 574 },
  small: { file: 'ggml-small-q5_1.bin', label: 'Small', note: 'Good accuracy, fine on most CPUs.', mb: 190 },
  base: { file: 'ggml-base-q5_1.bin', label: 'Base', note: 'Fastest, least accurate.', mb: 60 }
}

const root = () => path.join(app.getPath('userData'), 'engine')
const modelsDir = () => path.join(app.getPath('userData'), 'models')
const manifestPath = () => path.join(root(), 'engine.json')

export function engineManifest() {
  try {
    const m = JSON.parse(fs.readFileSync(manifestPath(), 'utf8'))
    if (m.serverPath && fs.existsSync(m.serverPath)) return m
  } catch {
    /* not installed */
  }
  return null
}

export function modelPath(key) {
  const m = MODELS[key]
  return m ? path.join(modelsDir(), m.file) : null
}

export function installedModels() {
  return Object.keys(MODELS).filter((k) => fs.existsSync(modelPath(k)))
}

// NVIDIA driver installs nvidia-smi; if it runs and lists a GPU we can use the CUDA build.
export function detectGpu() {
  return new Promise((resolve) => {
    execFile(
      'nvidia-smi',
      ['--query-gpu=name,memory.total', '--format=csv,noheader,nounits'],
      { windowsHide: true, timeout: 5000 },
      (err, stdout) => {
        if (err) return resolve(null)
        const [name, mem] = String(stdout).split(/\r?\n/)[0].split(',').map((s) => s.trim())
        resolve(name ? { vendor: 'nvidia', name, vramMb: Number(mem) || null } : null)
      }
    )
  })
}

async function findRelease(variant) {
  const releases = await fetchJson(RELEASES)
  for (const rel of releases) {
    if (rel.draft || rel.prerelease) continue
    const asset = rel.assets.find((a) => VARIANTS[variant].asset.test(a.name))
    if (asset) return { tag: rel.tag_name, asset }
  }
  throw new Error(`No ${VARIANTS[variant].label} build found in recent whisper.cpp releases`)
}

function extractZip(zip, dest) {
  fs.mkdirSync(dest, { recursive: true })
  return new Promise((resolve, reject) => {
    // Windows 10+ ships bsdtar, which reads zip files.
    const tar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe')
    const p = spawn(tar, ['-xf', zip, '-C', dest], { windowsHide: true })
    let err = ''
    p.stderr.on('data', (d) => (err += d))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`Extracting failed: ${err.trim()}`))))
  })
}

function findFile(dir, name) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const hit = findFile(p, name)
      if (hit) return hit
    } else if (entry.name.toLowerCase() === name.toLowerCase()) return p
  }
  return null
}

export async function installEngine(variant, onProgress) {
  if (!VARIANTS[variant]) throw new Error('Unknown engine variant')
  onProgress({ step: 'engine', phase: 'checking' })
  const { tag, asset } = await findRelease(variant)
  const digest = String(asset.digest || '').replace(/^sha256:/, '')
  const dlDir = path.join(root(), 'downloads')
  const zip = path.join(dlDir, asset.name)
  await downloadVerified({
    url: asset.browser_download_url,
    dest: zip,
    sha256: digest,
    size: asset.size,
    onProgress: (p) => onProgress({ step: 'engine', phase: 'downloading', ...p })
  })
  onProgress({ step: 'engine', phase: 'extracting' })
  const dest = path.join(root(), `${variant}-${tag}`)
  fs.rmSync(dest, { recursive: true, force: true })
  await extractZip(zip, dest)
  fs.rmSync(zip, { force: true })
  const serverPath = findFile(dest, 'whisper-server.exe')
  if (!serverPath) throw new Error('whisper-server.exe was not in the download')
  const previous = engineManifest()
  fs.writeFileSync(manifestPath(), JSON.stringify({ variant, tag, dir: dest, serverPath }, null, 2))
  // Remove the engine this one replaces.
  if (previous && previous.dir !== dest) fs.rmSync(previous.dir, { recursive: true, force: true })
  onProgress({ step: 'engine', phase: 'done' })
  return engineManifest()
}

export async function installModel(key, onProgress) {
  const m = MODELS[key]
  if (!m) throw new Error('Unknown model')
  onProgress({ step: 'model', phase: 'checking' })
  const tree = await fetchJson(MODEL_TREE)
  const entry = tree.find((f) => f.path === m.file)
  if (!entry?.lfs?.oid) throw new Error(`No checksum published for ${m.file}`)
  await downloadVerified({
    url: MODEL_URL(m.file),
    dest: modelPath(key),
    sha256: entry.lfs.oid,
    size: entry.size,
    onProgress: (p) => onProgress({ step: 'model', phase: 'downloading', ...p })
  })
  onProgress({ step: 'model', phase: 'done' })
}

export function removeModel(key) {
  const p = modelPath(key)
  if (p) fs.rmSync(p, { force: true })
}

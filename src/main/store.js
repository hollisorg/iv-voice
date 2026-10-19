// Small JSON stores in userData, written atomically. The cloud API key is encrypted with
// Windows DPAPI via Electron safeStorage and is never sent to the renderer.
import { app, safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const file = (name) => path.join(app.getPath('userData'), name)

function readJson(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file(name), 'utf8'))
  } catch {
    return fallback
  }
}

function writeJson(name, data) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true })
  const tmp = `${file(name)}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2))
  fs.renameSync(tmp, file(name))
}

export const HOTKEYS = {
  'ctrl-win': 'Ctrl + Win',
  'right-alt': 'Right Alt',
  'right-ctrl': 'Right Ctrl',
  'ctrl-shift-space': 'Ctrl + Shift + Space'
}

const DEFAULTS = {
  engine: 'local', // 'local' | 'cloud'
  model: 'turbo',
  useGpu: true,
  idleMinutes: 15, // stop the local engine after this long unused (frees GPU memory); 0 = never
  language: 'en',
  hotkey: 'ctrl-win',
  micId: 'default',
  removeFillers: true,
  spokenCommands: true,
  restoreClipboard: true,
  sounds: true,
  launchAtLogin: false,
  cloud: { provider: 'groq', baseUrl: '', model: '' }
}

export class Store {
  constructor() {
    const saved = readJson('settings.json', {})
    this.settings = { ...DEFAULTS, ...saved, cloud: { ...DEFAULTS.cloud, ...(saved.cloud || {}) } }
    this.secret = saved.cloudKey || null // base64 of DPAPI-encrypted key
    delete this.settings.cloudKey
    this.dictionary = readJson('dictionary.json', { terms: [], replacements: [] })
    this.history = readJson('history.json', [])
  }

  publicSettings() {
    return { ...this.settings, cloud: { ...this.settings.cloud, hasKey: Boolean(this.secret) } }
  }

  saveSettings(patch) {
    const s = { ...this.settings }
    const pick = (key, ok) => {
      if (key in patch && ok(patch[key])) s[key] = patch[key]
    }
    pick('engine', (v) => ['local', 'cloud'].includes(v))
    pick('model', (v) => ['turbo', 'small', 'base'].includes(v))
    pick('useGpu', (v) => typeof v === 'boolean')
    pick('idleMinutes', (v) => Number.isInteger(v) && v >= 0 && v <= 240)
    pick('language', (v) => typeof v === 'string' && /^(auto|[a-z]{2,3})$/.test(v))
    pick('hotkey', (v) => v in HOTKEYS)
    pick('micId', (v) => typeof v === 'string' && v.length < 300)
    for (const k of ['removeFillers', 'spokenCommands', 'restoreClipboard', 'sounds', 'launchAtLogin']) {
      pick(k, (v) => typeof v === 'boolean')
    }
    if (patch.cloud && typeof patch.cloud === 'object') {
      const c = { ...s.cloud }
      if (['groq', 'openai', 'custom'].includes(patch.cloud.provider)) c.provider = patch.cloud.provider
      if (typeof patch.cloud.baseUrl === 'string') c.baseUrl = patch.cloud.baseUrl.trim().slice(0, 300)
      if (typeof patch.cloud.model === 'string') c.model = patch.cloud.model.trim().slice(0, 100)
      s.cloud = c
    }
    this.settings = s
    this.persistSettings()
    return this.publicSettings()
  }

  persistSettings() {
    writeJson('settings.json', { ...this.settings, cloudKey: this.secret })
  }

  setApiKey(key) {
    const value = String(key || '').trim()
    if (!value) {
      this.secret = null
    } else {
      if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure storage is not available on this PC')
      this.secret = safeStorage.encryptString(value).toString('base64')
    }
    this.persistSettings()
    return this.publicSettings()
  }

  apiKey() {
    if (!this.secret) return null
    try {
      return safeStorage.decryptString(Buffer.from(this.secret, 'base64'))
    } catch {
      return null
    }
  }

  saveDictionary(dict) {
    const terms = (Array.isArray(dict.terms) ? dict.terms : [])
      .map((t) => String(t).trim().slice(0, 80))
      .filter(Boolean)
      .slice(0, 500)
    const replacements = (Array.isArray(dict.replacements) ? dict.replacements : [])
      .map((r) => ({ from: String(r.from || '').trim().slice(0, 120), to: String(r.to ?? '').slice(0, 500) }))
      .filter((r) => r.from)
      .slice(0, 500)
    this.dictionary = { terms: [...new Set(terms)], replacements }
    writeJson('dictionary.json', this.dictionary)
    return this.dictionary
  }

  addHistory(entry) {
    this.history.unshift(entry)
    if (this.history.length > 1000) this.history.length = 1000
    writeJson('history.json', this.history)
  }

  removeHistory(id) {
    this.history = this.history.filter((h) => h.id !== id)
    writeJson('history.json', this.history)
  }

  clearHistory() {
    this.history = []
    writeJson('history.json', this.history)
  }
}

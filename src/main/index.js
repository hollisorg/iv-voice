import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, session, shell, Tray } from 'electron'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { PROVIDERS, transcribeCloud } from './cloud'
import { cleanTranscript, vocabularyPrompt } from './cleanup'
import { detectGpu, engineManifest, installedModels, installEngine, installModel, MODELS, modelPath, removeModel, VARIANTS } from './engine'
import { PushToTalk } from './hotkey'
import { insertText } from './insert'
import { HOTKEYS, Store } from './store'
import { initUpdater, updateState } from './updater'
import { WhisperServer } from './whisper'

if (!app.requestSingleInstanceLock()) app.quit()

let store
let hub = null
let overlay = null
let tray = null
let quitting = false
let updater = null
let gpu = null
const whisper = new WhisperServer()
const ptt = new PushToTalk()

const rendererUrl = (page) =>
  process.env.ELECTRON_RENDERER_URL
    ? `${process.env.ELECTRON_RENDERER_URL}/${page}`
    : path.join(__dirname, `../renderer/${page}`)

const load = (win, page) =>
  process.env.ELECTRON_RENDERER_URL ? win.loadURL(rendererUrl(page)) : win.loadFile(rendererUrl(page))

const resource = (name) => path.join(app.getAppPath(), 'resources', name)

function sendHub(channel, payload) {
  if (hub && !hub.isDestroyed()) hub.webContents.send(channel, payload)
}

function sendOverlay(channel, payload) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(channel, payload)
}

function lockDown(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (url !== win.webContents.getURL()) e.preventDefault()
  })
}

// ---------- windows ----------

function createHub(show = true) {
  hub = new BrowserWindow({
    width: 1080,
    height: 760,
    minWidth: 820,
    minHeight: 600,
    show: false,
    backgroundColor: '#100c0e',
    title: 'IV Voice',
    icon: resource('icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#100c0e', symbolColor: '#f1ede5', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  lockDown(hub)
  if (show) hub.once('ready-to-show', () => hub.show())
  // Closing the window keeps dictation running in the tray.
  hub.on('close', (e) => {
    if (!quitting) {
      e.preventDefault()
      hub.hide()
    }
  })
  load(hub, 'index.html')
}

function showHub() {
  if (!hub || hub.isDestroyed()) createHub()
  else {
    if (hub.isMinimized()) hub.restore()
    hub.show()
    hub.focus()
  }
}

const PILL = { width: 300, height: 72 }

function createOverlay() {
  overlay = new BrowserWindow({
    ...PILL,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    focusable: false, // never take focus from the app the user is dictating into
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/overlay.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  })
  overlay.setAlwaysOnTop(true, 'screen-saver')
  overlay.setIgnoreMouseEvents(true)
  lockDown(overlay)
  load(overlay, 'overlay.html')
}

function showPill() {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const { x, y, width, height } = display.workArea
  overlay.setBounds({
    x: Math.round(x + (width - PILL.width) / 2),
    y: Math.round(y + height - PILL.height - 28),
    ...PILL
  })
  overlay.showInactive()
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(resource('tray.png')))
  tray.setToolTip('IV Voice')
  tray.on('click', showHub)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open IV Voice', click: showHub },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
}

// ---------- engine ----------

function configureWhisper() {
  const m = engineManifest()
  const s = store.settings
  whisper.configure({
    serverPath: m?.serverPath || null,
    modelPath: installedModels().includes(s.model) ? modelPath(s.model) : null,
    language: s.language === 'auto' ? 'auto' : s.language,
    useGpu: s.useGpu && m?.variant === 'cuda'
  })
}

async function engineStatus() {
  gpu ??= await detectGpu()
  const m = engineManifest()
  return {
    gpu,
    engine: m ? { variant: m.variant, label: VARIANTS[m.variant]?.label, tag: m.tag } : null,
    models: Object.entries(MODELS).map(([key, v]) => ({ key, ...v, installed: installedModels().includes(key) })),
    running: whisper.running,
    providers: Object.entries(PROVIDERS).map(([key, v]) => ({ key, label: v.label, model: v.model }))
  }
}

let setupJob = null
function setupEngine({ variant, model }) {
  setupJob ??= (async () => {
    const progress = (p) => sendHub('engine:progress', p)
    whisper.stop()
    const current = engineManifest()
    if (!current || current.variant !== variant) await installEngine(variant, progress)
    if (!installedModels().includes(model)) await installModel(model, progress)
    store.saveSettings({ engine: 'local', model, useGpu: variant === 'cuda' })
    configureWhisper()
    sendHub('settings:changed', store.publicSettings())
  })().finally(() => {
    setupJob = null
  })
  return setupJob.then(engineStatus)
}

// ---------- dictation ----------

let state = 'idle' // idle | recording | working
let pendingAudio = null

function setState(next, extra = {}) {
  state = next
  sendOverlay('pill:state', { state: next, ...extra })
  sendHub('dictation:state', { state: next, ...extra })
}

function hidePillSoon(ms) {
  setTimeout(() => {
    if (state === 'idle' && overlay && !overlay.isDestroyed()) overlay.hide()
  }, ms)
}

function onStart() {
  if (state !== 'idle') return
  showPill()
  setState('recording')
  sendOverlay('record:start', { micId: store.settings.micId, sounds: store.settings.sounds })
}

function onStop() {
  if (state !== 'recording') return
  setState('working')
  pendingAudio = new Promise((resolve) => {
    const timer = setTimeout(() => {
      ipcMain.removeAllListeners('record:audio')
      resolve({ error: 'The microphone did not respond' })
    }, 10_000)
    ipcMain.once('record:audio', (_e, payload) => {
      clearTimeout(timer)
      resolve(payload)
    })
  })
  sendOverlay('record:stop')
  pendingAudio.then(finishDictation)
}

function onCancel() {
  if (state !== 'recording') return
  sendOverlay('record:cancel')
  setState('idle')
  overlay.hide()
}

async function transcribe(wav) {
  const s = store.settings
  const prompt = vocabularyPrompt(store.dictionary.terms)
  if (s.engine === 'cloud') {
    return transcribeCloud(wav, { ...s.cloud, apiKey: store.apiKey(), language: s.language, prompt })
  }
  configureWhisper()
  return whisper.transcribe(wav, { prompt, idleMinutes: s.idleMinutes })
}

function processText(raw) {
  const s = store.settings
  return cleanTranscript(raw, {
    removeFillers: s.removeFillers,
    spokenCommands: s.spokenCommands,
    replacements: store.dictionary.replacements
  })
}

async function finishDictation({ wav, durationMs, peak, error }) {
  try {
    if (error) throw new Error(error)
    // Very short or near-silent clips make Whisper invent text; skip them.
    if (!wav || durationMs < 300 || peak < 0.015) {
      setState('idle', { message: 'Didn’t catch that' })
      return hidePillSoon(900)
    }
    const started = Date.now()
    const raw = await transcribe(Buffer.from(wav))
    const text = processText(raw)
    if (!text) {
      setState('idle', { message: 'Didn’t catch that' })
      return hidePillSoon(900)
    }
    ptt.setPaused(true)
    try {
      await insertText(text, { restore: store.settings.restoreClipboard })
    } finally {
      ptt.setPaused(false)
    }
    const entry = {
      id: randomUUID(),
      at: Date.now(),
      text,
      raw,
      words: text.split(/\s+/).filter(Boolean).length,
      audioMs: Math.round(durationMs),
      latencyMs: Date.now() - started,
      engine: store.settings.engine === 'cloud' ? `cloud:${store.settings.cloud.provider}` : `local:${store.settings.model}`
    }
    store.addHistory(entry)
    sendHub('history:added', entry)
    setState('idle', { message: 'done' })
    hidePillSoon(500)
  } catch (err) {
    setState('idle', { message: String(err.message || err).slice(0, 140), error: true })
    hidePillSoon(3500)
  }
}

// ---------- IPC ----------

function registerIpc() {
  ipcMain.handle('settings:get', () => ({ settings: store.publicSettings(), hotkeys: HOTKEYS }))
  ipcMain.handle('settings:set', (_e, patch) => {
    const before = store.settings
    const next = store.saveSettings(patch || {})
    if (before.hotkey !== next.hotkey) ptt.setCombo(next.hotkey)
    if (before.launchAtLogin !== next.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: next.launchAtLogin, args: ['--hidden'] })
    }
    configureWhisper()
    return next
  })
  ipcMain.handle('settings:setApiKey', (_e, key) => store.setApiKey(key))

  ipcMain.handle('engine:status', engineStatus)
  ipcMain.handle('engine:setup', (_e, opts) => {
    if (!VARIANTS[opts?.variant] || !MODELS[opts?.model]) throw new Error('Unknown engine or model')
    return setupEngine(opts)
  })
  ipcMain.handle('engine:removeModel', (_e, key) => {
    if (!MODELS[key]) return engineStatus()
    if (store.settings.model === key) whisper.stop()
    removeModel(key)
    return engineStatus()
  })
  ipcMain.handle('engine:warm', async () => {
    configureWhisper()
    await whisper.ensure()
    return engineStatus()
  })

  ipcMain.handle('dictionary:get', () => store.dictionary)
  ipcMain.handle('dictionary:set', (_e, dict) => store.saveDictionary(dict || {}))

  ipcMain.handle('history:list', () => store.history)
  ipcMain.handle('history:remove', (_e, id) => store.removeHistory(String(id)))
  ipcMain.handle('history:clear', () => store.clearHistory())

  ipcMain.handle('update:state', () => updateState())
  ipcMain.handle('update:install', () => updater?.install())

  // Development only: run the pipeline on a WAV file from disk.
  if (!app.isPackaged) {
    ipcMain.handle('dev:transcribeFile', async (_e, file) => {
      const raw = await transcribe(fs.readFileSync(file))
      return { raw, text: processText(raw) }
    })
    // Record from the real microphone for `ms` and run everything except the paste.
    ipcMain.handle('dev:simulateRecording', async (_e, ms = 1500) => {
      onStart()
      await new Promise((r) => setTimeout(r, ms))
      setState('working')
      const audio = await new Promise((resolve) => {
        ipcMain.once('record:audio', (_ev, payload) => resolve(payload))
        sendOverlay('record:stop')
      })
      setState('idle')
      overlay.hide()
      return { durationMs: audio.durationMs, peak: audio.peak, bytes: audio.wav?.byteLength ?? 0, error: audio.error }
    })
  }
}

// ---------- lifecycle ----------

app.on('second-instance', showHub)

app.whenReady().then(async () => {
  // The app only needs the microphone, plus clipboard writes for History's Copy button.
  const allowed = new Set(['media', 'clipboard-sanitized-write'])
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(allowed.has(permission)))
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => allowed.has(permission))
  store = new Store()
  registerIpc()
  createOverlay()
  createTray()
  createHub(!process.argv.includes('--hidden'))
  updater = initUpdater((s) => sendHub('update:changed', s))

  ptt.setCombo(store.settings.hotkey)
  ptt.on('start', onStart)
  ptt.on('stop', onStop)
  ptt.on('cancel', onCancel)
  ptt.start()
  configureWhisper()
})

app.on('before-quit', () => {
  quitting = true
  ptt.stop()
  whisper.stop()
})

// The tray keeps the app alive with no windows open.
app.on('window-all-closed', () => {})

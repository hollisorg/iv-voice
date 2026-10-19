import { contextBridge, ipcRenderer } from 'electron'

const on = (channel) => (cb) => {
  const listener = (_e, payload) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('iv', {
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch),
    setApiKey: (key) => ipcRenderer.invoke('settings:setApiKey', key),
    onChange: on('settings:changed')
  },
  engine: {
    status: () => ipcRenderer.invoke('engine:status'),
    setup: (opts) => ipcRenderer.invoke('engine:setup', opts),
    removeModel: (key) => ipcRenderer.invoke('engine:removeModel', key),
    warm: () => ipcRenderer.invoke('engine:warm'),
    onProgress: on('engine:progress')
  },
  dictionary: {
    get: () => ipcRenderer.invoke('dictionary:get'),
    set: (dict) => ipcRenderer.invoke('dictionary:set', dict)
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    remove: (id) => ipcRenderer.invoke('history:remove', id),
    clear: () => ipcRenderer.invoke('history:clear'),
    onAdded: on('history:added')
  },
  dictation: {
    onState: on('dictation:state')
  },
  // Development-only hooks; the handlers are not registered in packaged builds.
  dev: {
    transcribeFile: (file) => ipcRenderer.invoke('dev:transcribeFile', file),
    simulateRecording: (ms) => ipcRenderer.invoke('dev:simulateRecording', ms)
  },
  app: {
    update: () => ipcRenderer.invoke('update:state'),
    installUpdate: () => ipcRenderer.invoke('update:install'),
    onUpdate: on('update:changed')
  }
})

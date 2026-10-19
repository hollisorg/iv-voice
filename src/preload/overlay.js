import { contextBridge, ipcRenderer } from 'electron'

const on = (channel) => (cb) => {
  const listener = (_e, payload) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('pill', {
  onStart: on('record:start'),
  onStop: on('record:stop'),
  onCancel: on('record:cancel'),
  onState: on('pill:state'),
  onMicConfig: on('mic:config'),
  sendAudio: (payload) => ipcRenderer.send('record:audio', payload)
})
